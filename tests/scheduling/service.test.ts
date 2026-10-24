import test from 'node:test';
import assert from 'node:assert/strict';
import { SurveyService } from '../../src/service.ts';
import type { Outbox } from '../../src/storage.ts';
import { SurveyStore } from '../../src/storage.ts';
import { createTestDatabase } from '../storage/sqlite-d1.ts';

const now=new Date('2026-11-01T12:00:00Z');
function setup(uncertain=false) {
  const db=createTestDatabase();const sent:Outbox[]=[];
  const service=new SurveyService(new SurveyStore(db),{async send(message){sent.push(message);return {status:uncertain?'unknown':'sent',messageId:'test-provider-id'};}});
  let seq=0;
  const input=(value:string,kind:'text'|'choice'='text')=>service.handleAuthorizedInput({participantId:'tg:1001',eventId:`test-${seq++}`,event:{kind,value},demo:false,now});
  return {db,service,sent,input};
}
async function schedule(input:ReturnType<typeof setup>['input']) {await input('/start');await input('2026-11-02');await input('confirm','choice');}

test('first contact identifies the fictitious course and certification',async(t)=>{
  const {db,input,sent}=setup();t.after(()=>db.close());
  await input('/start');
  assert.match(sent[0].message,/Curso Alfa/);
  assert.match(sent[0].message,/Certificação Alfa/);
  assert.match(sent[0].message,/fictícios/);
});
test('pausing blocks a scheduled followup but not reactive acknowledgement',async(t)=>{
  const {db,input,service,sent}=setup();t.after(()=>db.close());
  await schedule(input);await input('/pausar');
  assert.ok(sent.some(row=>row.message.includes('pausados')));
  await service.tick(new Date('2026-11-03T13:00:00Z'));
  assert.equal(sent.filter(row=>row.kind==='followup').length,0);
  await input('/retomar');await service.tick(new Date('2026-11-03T13:00:00Z'));
  await service.tick(new Date('2026-11-03T14:00:00Z'));
  assert.equal(sent.filter(row=>row.kind==='followup').length,1);
});
test('rescheduling prevents the former deadline and new attempt preserves history',async(t)=>{
  const {db,input,service,sent}=setup();t.after(()=>db.close());
  await schedule(input);await input('/data');await input('2026-11-04');await input('confirm','choice');
  await service.tick(new Date('2026-11-03T13:00:00Z'));
  assert.equal(sent.filter(row=>row.kind==='followup').length,0);
  const before=await service.store.getCurrent('tg:1001');
  await input('/nova');
  const rows=await service.store.list();
  assert.equal(rows.length,2);
  assert.ok(rows.some(row=>row.state.attemptId===before!.state.attemptId));
});
test('unknown delivery is persisted and never automatically attempted again',async(t)=>{
  const {db,input,service,sent}=setup(true);t.after(()=>db.close());
  await input('/start');assert.equal(sent.length,1);
  await service.flush();await service.flush();assert.equal(sent.length,1);
  const deliveries=await service.store.recentDeliveries();assert.equal(deliveries[0].status,'unknown');
});

import cloudflareEntry from '../../src/cloudflare.ts';
test('Flue native Cloudflare entry exports and executes the cron handler',async(t)=>{
  const db=createTestDatabase();t.after(()=>db.close());
  assert.equal(typeof cloudflareEntry.scheduled,'function');
  await cloudflareEntry.scheduled({cron:'*/5 * * * *'},{DB:db});
});

import { telegramSender } from '../../src/service.ts';
test('revoked Telegram recipient is canceled at dispatch without a provider call',async()=>{
 const sender=telegramSender('invalid-token','test-secret','1002');
 const receipt=await sender.send({demo:false,participantId:'tg:1001',buttons:[]} as unknown as Outbox);
 assert.equal(receipt.status,'canceled');
});
test('one cron passage dispatches no more than twenty messages with due backlog',async(t)=>{
 const {db,service,sent}=setup();t.after(()=>db.close());
 for(let index=0;index<25;index++){
 const participantId=`tg:${2000+index}`;
 for(const [seq,value,kind] of [[0,'/start','text'],[1,'2026-11-02','text'],[2,'confirm','choice']] as const){
 await service.handleAuthorizedInput({participantId,eventId:`${participantId}:${seq}`,event:{kind,value},demo:false,now});
 }
 }
 sent.length=0;
 await service.tick(new Date('2026-11-03T13:00:00Z'));
 assert.equal(sent.length,20);
});

import {runDemo} from '../../src/service.ts';
test('demo A remarca para outra data e invalida a agenda anterior',async(t)=>{
 const {db,service}=setup();t.after(()=>db.close());
 for(let i=0;i<3;i++)await runDemo(service,'A','next',now);
 const before=(await service.store.getCurrent('demo:A'))!.state;
 await runDemo(service,'A','reschedule',now);
 await runDemo(service,'A','next',now);await runDemo(service,'A','next',now);
 const after=(await service.store.getCurrent('demo:A'))!.state;
 assert.notEqual(after.examDate,before.examDate);assert.notEqual(after.dueAt,before.dueAt);assert.ok(after.scheduleRevision>before.scheduleRevision);
});

test('self-service test completes immediately without scheduled contact and preserves attempts',async(t)=>{
 const {db,service,input,sent}=setup();t.after(()=>db.close());
 await input('/teste');
 const initial=(await service.store.getCurrent('tg:1001'))!.state;
 assert.equal(initial.testMode,true);
 assert.match(sent[0].message,/Modo de teste/);
 await input('02/11/2026');await input('confirm','choice');
 const confirmed=(await service.store.getCurrent('tg:1001'))!.state;
 assert.equal(confirmed.step,'attendance');assert.equal(confirmed.dueAt,null);
 for(const value of ['yes','approved','yes','much','yes','partly','little','harder','skip'])await input(value,'choice');
 assert.equal((await service.store.getCurrent('tg:1001'))!.state.step,'done');
 await service.tick(new Date('2027-01-01T13:00:00Z'));
 assert.equal(sent.filter(row=>row.kind==='followup').length,0);
 const event={participantId:'tg:1001',eventId:'same-test-command',event:{kind:'text' as const,value:'/teste'},demo:false,now};
 await service.handleAuthorizedInput(event);const count=(await service.store.list()).length;
 await service.handleAuthorizedInput(event);assert.equal((await service.store.list()).length,count);
 await input('/nova');assert.equal((await service.store.getCurrent('tg:1001'))!.state.testMode,false);
 assert.ok((await service.store.list()).some(row=>row.state.attemptId===initial.attemptId));
});

test('test command preserves a live scheduled attempt and explains the conflict',async(t)=>{
 const {db,input,service,sent}=setup();t.after(()=>db.close());await schedule(input);
 const before=(await service.store.getCurrent('tg:1001'))!.state;
 await input('/teste');assert.deepEqual((await service.store.getCurrent('tg:1001'))!.state,before);
 assert.match(sent.at(-1)!.message,/agenda foi preservada/);
});

test('callback from replaced attempt is stale even when revisions match',async(t)=>{
 const {db,service,input}=setup();t.after(()=>db.close());await input('/teste');
 const old=(await service.store.getCurrent('tg:1001'))!.state;
 await input('/teste');
 const reply=await service.handleAuthorizedInput({participantId:'tg:1001',eventId:'old-callback',event:{kind:'choice',value:'unknown'},demo:false,now,expectedRevision:old.revision,expectedAttemptId:old.attemptId});
 assert.equal(reply.status,'stale');
 assert.equal((await service.store.getCurrent('tg:1001'))!.state.step,'date');
});
