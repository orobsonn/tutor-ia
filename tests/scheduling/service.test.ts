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
