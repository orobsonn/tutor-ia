import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../src/app.ts';

const noDatabase = { prepare() { throw new Error('Unexpected database access before authorization'); } };
const env = {
  DB: noDatabase,
  OPERATOR_READ_TOKEN: 'test-read-only-token',
  OPERATOR_DEMO_TOKEN: 'test-demo-only-token',
  TELEGRAM_WEBHOOK_SECRET_TOKEN: 'test-webhook-secret',
  TELEGRAM_BOT_TOKEN: '000000:test-only-never-call',
  TELEGRAM_ALLOWED_USER_IDS: '1001',
};
const request = (path: string, init?: RequestInit) => new Request(`https://demo.invalid${path}`, init);

test('operator records reject missing credentials before reading the database', async () => {
  const response = await worker.fetch(request('/api/records'), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('a read credential cannot mutate the demonstration', async () => {
  const response = await worker.fetch(request('/api/demo', { method: 'POST', headers: { authorization: 'Bearer test-read-only-token', 'content-type': 'application/json' }, body: JSON.stringify({scenario: 'A', action: 'next'}) }), env);
  assert.equal(response.status, 401);
});
test('Telegram webhook rejects invalid ingress secret', async () => {
  const response = await worker.fetch(request('/channels/telegram/webhook', { method: 'POST', headers: {'content-type': 'application/json'}, body: '{}' }), env);
  assert.equal(response.status, 401);
});
test('there is no public agent conversation route', async () => {
  const response = await worker.fetch(request('/agents/tutor/arbitrary'), env);
  assert.equal(response.status, 404);
});

import { createTestDatabase } from '../storage/sqlite-d1.ts';

test('the same demo HTTP frontier persists the full survey without a bot token', async () => {
  const db = createTestDatabase();
  const localEnv = {...env, DB: db, TELEGRAM_BOT_TOKEN: undefined};
  for(let index=0; index<13; index++) {
    const response = await worker.fetch(request('/api/demo',{method:'POST',headers:{authorization:'Bearer test-demo-only-token','content-type':'application/json'},body:JSON.stringify({scenario:'A',action:'next'})}),localEnv);
    assert.equal(response.status,200,await response.text());
  }
  const response = await worker.fetch(request('/api/records',{headers:{authorization:'Bearer test-read-only-token'}}),localEnv);
  assert.equal(response.status,200);
  const data = await response.json() as {records: Array<{result:string; courseAlignment:string; simulationContent:string; simulationFormat:string; simulationDifficulty:string}>, deliveries:Array<{status:string}>};
  assert.equal(data.records.length,1);
  assert.equal(data.records[0].result,'approved');
  assert.equal(data.records[0].courseAlignment,'much');
  assert.equal(data.records[0].simulationContent,'partly');
  assert.equal(data.records[0].simulationFormat,'little');
  assert.equal(data.records[0].simulationDifficulty,'harder');
  assert.ok(data.deliveries.every(row=>row.status==='simulated'));
  db.close();
});

test('demo mutation accepts only enumerated actions and scenarios', async () => {
  const db=createTestDatabase();
  for(const body of [{scenario:'other-person',action:'next'},{scenario:'A',action:'sql'},{scenario:'A',action:'next',timestamp:'2100-01-01'}]) {
    const response=await worker.fetch(request('/api/demo',{method:'POST',headers:{authorization:'Bearer test-demo-only-token','content-type':'application/json'},body:JSON.stringify(body)}),{...env,DB:db});
    assert.equal(response.status,400);
  }
  db.close();
});

test('verified ingress still rejects a participant outside the allowlist without storage',async()=>{
  const response=await worker.fetch(request('/channels/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','X-Telegram-Bot-Api-Secret-Token':'test-webhook-secret'},body:JSON.stringify({update_id:1,message:{message_id:1,date:1,from:{id:9999,is_bot:false,first_name:'Fictitious'},chat:{id:9999,type:'private'},text:'/start'}})}),env);
  assert.equal(response.status,200);
});

import { createApp } from '../../src/app.ts';
import { callbackToken } from '../../src/auth.ts';
import { SurveyStore } from '../../src/storage.ts';

test('authorized Telegram updates are deduplicated and old buttons cannot mutate a newer revision',async()=>{
  const db=createTestDatabase();
  const sent:Array<unknown>=[];
  const app=createApp({...env,DB:db},{async send(message){sent.push(message);return {status:'simulated'};}});
  const post=async(update:unknown)=>app.fetch(request('/channels/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','X-Telegram-Bot-Api-Secret-Token':'test-webhook-secret'},body:JSON.stringify(update)}));
  const message=(id:number,text:string)=>({update_id:id,message:{message_id:id,date:1,from:{id:1001,is_bot:false,first_name:'Demo'},chat:{id:1001,type:'private'},text}});
  assert.equal((await post(message(1,'/start'))).status,200);
  assert.equal((await post(message(1,'/start'))).status,200);
  assert.equal(sent.length,1);
  const store=new SurveyStore(db);
  const before=(await store.getCurrent('tg:1001'))!.state;
  const staleToken=await callbackToken('test-webhook-secret','tg:1001',before.attemptId,before.revision,'unknown');
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  assert.equal((await post(message(2,tomorrow))).status,200);
  const state=(await store.getCurrent('tg:1001'))!.state;
  assert.equal(state.step,'confirm_date');
  const response=await post({update_id:3,callback_query:{id:'test-callback',from:{id:1001,is_bot:false,first_name:'Demo'},chat_instance:'test',data:staleToken,message:{message_id:1,date:1,chat:{id:1001,type:'private'}}}});
  assert.equal(response.status,200);
  assert.equal((await store.getCurrent('tg:1001'))!.state.revision,state.revision);
  db.close();
});

test('operator page exposes no credentials or stored comments and uses a restrictive CSP',async()=>{
  const response=await worker.fetch(request('/'),env);
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/Tutor IA/);
  assert.ok(!html.includes('test-read-only-token'));
  assert.ok(!html.includes('localStorage'));
  assert.ok(response.headers.get('content-security-policy')?.includes("default-src 'none'"));
});

import { Script } from 'node:vm';
test('the delivered operator script parses before browser execution',async()=>{
  const response=await worker.fetch(request('/'),env);
  const html=await response.text();
  const script=/<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(script);
  assert.doesNotThrow(()=>new Script(script[1]));
});

 test('equal operator secrets fail closed for mutation before storage',async()=>{
 const response=await worker.fetch(request('/api/demo',{method:'POST',headers:{authorization:'Bearer test-read-only-token'},body:JSON.stringify({scenario:'A',action:'next'})}),{...env,OPERATOR_DEMO_TOKEN:env.OPERATOR_READ_TOKEN});
 assert.equal(response.status,401);
 });

test('demo C proves pause, absence and cancellation while B allows result correction',async(t)=>{
 const db=createTestDatabase();t.after(()=>db.close());
 const localEnv={...env,DB:db,TELEGRAM_BOT_TOKEN:undefined};
 const action=async(scenario:string,action:string)=>{
  const response=await worker.fetch(request('/api/demo',{method:'POST',headers:{authorization:'Bearer test-demo-only-token','content-type':'application/json'},body:JSON.stringify({scenario,action})}),localEnv);
  assert.equal(response.status,200);return await response.json() as {state:{step:string;paused:boolean;attendance:string|null;result:string|null;courseAlignment:string|null;simulationUsed:boolean|null}};
 };
 for(let i=0;i<3;i++)await action('C','next');
 await action('C','pause');
 const paused=await action('C','next');assert.equal(paused.state.step,'scheduled');assert.equal(paused.state.paused,true);
 await action('C','resume');await action('C','next');
 const absent=await action('C','next');assert.equal(absent.state.attendance,'absent');assert.equal(absent.state.courseAlignment,null);
 const preserved=await action('C','cancel');assert.equal(preserved.state.attendance,'absent');
 await action('C','new');
 const canceled=await action('C','cancel');assert.equal(canceled.state.attendance,'cancelled');assert.equal(canceled.state.step,'done');
 for(let i=0;i<13;i++)await action('B','next');
 await action('B','correct');const corrected=await action('B','correct');
 assert.equal(corrected.state.result,'approved');assert.equal(corrected.state.simulationUsed,false);assert.equal(corrected.state.courseAlignment,'partly');
 const response=await worker.fetch(request('/api/records',{headers:{authorization:'Bearer test-read-only-token'}}),localEnv);
 const data=await response.json() as {records:Array<{alias:string;result:string}>,metrics:Array<{label:string;value:number;total:number}>};
 assert.equal(data.records.length,3);assert.equal(data.records.find(row=>row.alias==='Estudante B')?.result,'approved');
 const nonUse=data.metrics.find(row=>row.label==='Simulados: não usaram / provas realizadas');assert.deepEqual(nonUse,{label:'Simulados: não usaram / provas realizadas',value:1,total:1});
});
