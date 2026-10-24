import { Hono } from 'hono';
import { createTelegramChannel, type JsonValue } from '@flue/telegram';
import { allowedTelegramUser, authorized, verifyCallback } from './auth.ts';
import { SurveyStore } from './storage.ts';
import type { D1Like } from './storage.ts';
import { publicRecord, runDemo, SurveyService, telegramSender, validDemoRequest } from './service.ts';
import type { Sender } from './service.ts';
import { operatorPage } from './operator.ts';

export interface POCEnv {
  DB: D1Like;
  OPERATOR_READ_TOKEN?: string;
  OPERATOR_DEMO_TOKEN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET_TOKEN?: string;
  TELEGRAM_ALLOWED_USER_IDS?: string;
}
export function createApp(env:POCEnv,sender:Sender=telegramSender(env.TELEGRAM_BOT_TOKEN,env.TELEGRAM_WEBHOOK_SECRET_TOKEN)) {
  const app=new Hono();
  const service=new SurveyService(new SurveyStore(env.DB),sender);
  app.use('*',async(c,next)=>{
    c.header('Cache-Control','no-store');c.header('X-Robots-Tag','noindex, nofollow');
    c.header('X-Content-Type-Options','nosniff');c.header('Referrer-Policy','no-referrer');
    await next();
  });
  app.onError((_error,c)=>c.json({error:'request_failed'},500));
  app.get('/',(c)=>{const nonce=crypto.randomUUID().replaceAll('-','');c.header('Content-Security-Policy',"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");return c.html(operatorPage(nonce));});
  app.get('/health',(c)=>c.json({status:'ok',demo:true,telegramConfigured:Boolean(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_WEBHOOK_SECRET_TOKEN&&env.TELEGRAM_ALLOWED_USER_IDS)}));
  app.get('/api/records',async(c)=>{
    if(!authorized(c.req.raw,env.OPERATOR_READ_TOKEN)) return c.json({error:'unauthorized'},401);
    const rows=await service.store.list();
    const deliveries=await service.store.recentDeliveries();
    return c.json({records:rows.map(row=>publicRecord(row.state,row.demo)),deliveries:deliveries.map(({status,kind,demo,updatedAt})=>({status,kind,demo,updatedAt})),disclaimer:'Dados fictícios; percepções declaradas, não equivalência objetiva.'});
  });
  app.post('/api/demo',async(c)=>{
    if(!authorized(c.req.raw,env.OPERATOR_DEMO_TOKEN)) return c.json({error:'unauthorized'},401);
    if(Number(c.req.header('content-length')??0)>2048) return c.json({error:'body_too_large'},413);
    const text=await c.req.text();
    if(text.length>2048) return c.json({error:'body_too_large'},413);
    let input:unknown;
    try {input=JSON.parse(text);}catch{return c.json({error:'invalid_request'},400);}
    if(!validDemoRequest(input)) return c.json({error:'invalid_request'},400);
    const result=await runDemo(service,input.scenario,input.action,new Date());
    return c.json(result,result.status==='conflict'?409:200);
  });
  if(env.TELEGRAM_WEBHOOK_SECRET_TOKEN) {
    const channel=createTelegramChannel({secretToken:env.TELEGRAM_WEBHOOK_SECRET_TOKEN,bodyLimit:32768,async webhook({update}):Promise<Response|JsonValue> {
      const callback=update.callback_query;
      const incoming=callback?.message??update.message;
      const author=callback?.from??update.message?.from;
      if(!incoming || !author || author.is_bot || !allowedTelegramUser(author.id,incoming.chat.id,incoming.chat.type,env.TELEGRAM_ALLOWED_USER_IDS)) return {ok:true};
      if(!env.TELEGRAM_BOT_TOKEN) return new Response('Telegram not configured',{status:503});
      const participantId=`tg:${incoming.chat.id}`;
      let event:{kind:'text'|'choice',value:string};
      let expectedRevision:number|undefined;
      if(callback) {
        const current=await service.store.getCurrent(participantId);
        if(!current || !callback.data) return {method:'answerCallbackQuery',callback_query_id:callback.id,text:'Use /start para continuar.'};
        const value=await verifyCallback(callback.data,env.TELEGRAM_WEBHOOK_SECRET_TOKEN!,participantId,current.state.attemptId,current.state.revision);
        if(value===null) return {method:'answerCallbackQuery',callback_query_id:callback.id,text:'Esta pergunta foi atualizada. Use /start.'};
        expectedRevision=current.state.revision;event={kind:'choice',value};
      } else {
        const text='text' in incoming?incoming.text:undefined;
        if(typeof text!=='string' || text.length>1200) return {ok:true};
        event={kind:'text',value:text.trim()};
      }
      const result=await service.handleAuthorizedInput({participantId,eventId:`telegram:${update.update_id}`,event,demo:false,now:new Date(),expectedRevision});
      return result.status==='conflict'?new Response('Retry later',{status:503}):callback?{method:'answerCallbackQuery',callback_query_id:callback.id}:{ok:true};
    }});
    app.route('/channels/telegram',channel.route());
  }
  return app;
}
export default {
  fetch(request:Request,env:POCEnv) {return createApp(env).fetch(request);},
};
