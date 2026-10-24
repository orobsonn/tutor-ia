import { Api } from 'grammy';
import { createSurvey, transition } from './domain/survey.ts';
import type { SurveyEvent, SurveyResponse, SurveyState } from './domain/survey.ts';
import { SurveyStore } from './storage.ts';
import type { Outbox } from './storage.ts';
import { allowedTelegramUser, callbackToken } from './auth.ts';

export type DeliveryReceipt = {status: 'sent' | 'simulated' | 'unknown' | 'canceled'; messageId?: string};
export interface Sender {send(message:Outbox):Promise<DeliveryReceipt>}
export function telegramSender(token:string|undefined,webhookSecret:string|undefined,allowlist:string|undefined):Sender {
  return {async send(message) {
    if(message.demo) return {status:'simulated',messageId:`demo:${message.id}`};
    if(!token || !webhookSecret || !/^tg:\d+$/.test(message.participantId)) return {status:'unknown'};
    const id=Number(message.participantId.slice(3));
    if(!allowedTelegramUser(id,id,'private',allowlist)) return {status:'canceled'};
    const keyboard=await Promise.all(message.buttons.map(async button=>[{
      text:button.text,
      callback_data:await callbackToken(webhookSecret,message.participantId,message.attemptId,message.revision,button.value),
    }]));
    try {
      const client=new Api(token,{timeoutSeconds:10});
      const sent=await client.sendMessage(message.participantId.slice(3),message.message,{reply_markup:{inline_keyboard:keyboard}});
      return {status:'sent',messageId:String(sent.message_id)};
    } catch {return {status:'unknown'};}
  }};
}

export class SurveyService {
  readonly store:SurveyStore;
  readonly sender:Sender;
  constructor(store:SurveyStore,sender:Sender) {this.store=store;this.sender=sender;}

  async handleAuthorizedInput(input:{participantId:string,eventId:string,event:SurveyEvent,demo:boolean,now:Date,expectedRevision?:number,deferFlush?:boolean}) {
    const current=await this.store.getCurrent(input.participantId);
    if(current && current.demo !== input.demo) throw new Error('participant mode mismatch');
    if(input.expectedRevision !== undefined && current?.state.revision!==input.expectedRevision) return {status:'stale' as const};
    let state=current?.state??createSurvey(input.participantId,crypto.randomUUID());
    if(!current && !(input.event.kind==='text' && input.event.value==='/start')) return {status:'start_required' as const};
    let response:SurveyResponse;
    if(input.event.kind==='text' && input.event.value==='/nova' && current) {
      state=createSurvey(input.participantId,crypto.randomUUID());
      response=transition(state,{kind:'text',value:'/start'},input.now);
    } else response=transition(state,input.event,input.now);
    if(!current || (input.event.kind==='text' && input.event.value==='/nova')) response={...response,message:'Demonstração com dados fictícios: Curso Alfa · Certificação Alfa.\n\n'+response.message};
    const status=await this.store.applyEvent({
      participantId:input.participantId,eventId:input.eventId,
      expectedRevision:current?.state.revision??null,state:response.state,response,demo:input.demo,
      kind:input.event.kind==='followup'?'followup':'reply',
    });
    if(status==='applied' && !input.deferFlush) await this.flush();
    return {status,state:response.state,message:response.message};
  }

  async flush() {
    for(const pending of await this.store.pending(20)) {
      const claimed=await this.store.claim(pending.id);
      if(!claimed) continue;
      const current=await this.store.getCurrent(claimed.participantId);
      if(!current || current.state.attemptId!==claimed.attemptId || current.state.revision!==claimed.revision || current.state.scheduleRevision!==claimed.scheduleRevision || (claimed.kind==='followup' && current.state.paused)) {
        await this.store.markDelivery(claimed.id,'canceled');continue;
      }
      try {
        const receipt=await this.sender.send(claimed);
        await this.store.markDelivery(claimed.id,receipt.status,receipt.messageId);
      } catch {await this.store.markDelivery(claimed.id,'unknown');}
    }
  }

  async tick(now:Date) {
    await this.store.recoverStaleSending(new Date(now.getTime()-120000).toISOString());
    for(const row of await this.store.due(now.toISOString(),20,false)) {
      // Demo time advances only through an authenticated scenario action.
      if(row.demo) continue;
      await this.handleAuthorizedInput({participantId:row.state.participantId,eventId:`followup:${row.state.attemptId}:${row.state.scheduleRevision}`,event:{kind:'followup'},demo:false,now,expectedRevision:row.state.revision,deferFlush:true});
    }
    await this.flush();
  }
}

export type DemoAction='next'|'reschedule'|'pause'|'resume'|'cancel'|'absent'|'correct'|'new';
export function validDemoRequest(value:unknown):value is {scenario:'A'|'B'|'C',action:DemoAction} {
  if(!value || typeof value!=='object' || Array.isArray(value)) return false;
  const object=value as Record<string,unknown>;
  return Object.keys(object).length===2 && ['A','B','C'].includes(String(object.scenario)) && ['next','reschedule','pause','resume','cancel','absent','correct','new'].includes(String(object.action));
}
export async function runDemo(service:SurveyService,scenario:'A'|'B'|'C',action:DemoAction,now:Date) {
  const participantId=`demo:${scenario}`;
  const row=await service.store.getCurrent(participantId);
  if(row && !row.demo) throw new Error('not a demonstration record');
  let event:SurveyEvent={kind:'text',value:'/start'};
  let effectiveNow=now;
  if(action==='new') event={kind:'text',value:'/nova'};
  else if(action==='absent') event={kind:'choice',value:'no'};
  else if(action==='correct') event=row?.state.step==='result'?{kind:'choice',value:'approved'}:{kind:'text',value:'/resultado'};
  else if(action!=='next') event={kind:'text',value:({reschedule:'/data',pause:'/pausar',resume:'/retomar',cancel:'/cancelar'} as const)[action]};
  else if(row) {
    const state=row.state;
    switch(state.step) {
      case 'date': event={kind:'text',value:new Date(now.getTime()+(state.scheduleRevision>0?2:1)*86400000).toISOString().slice(0,10)};break;
      case 'confirm_date':event={kind:'choice',value:'confirm'};break;
      case 'scheduled':
        if(state.dueAt) {effectiveNow=new Date(state.dueAt);event={kind:'followup'};}
        else event={kind:'text',value:'/data'};
        break;
      case 'attendance':event={kind:'choice',value:scenario==='C'?'no':'yes'};break;
      case 'result':event={kind:'choice',value:scenario==='A'?'approved':'pending'};break;
      case 'course_use':event={kind:'choice',value:'yes'};break;
      case 'course_alignment':event={kind:'choice',value:scenario==='A'?'much':'partly'};break;
      case 'simulation_use':event={kind:'choice',value:scenario==='A'?'yes':'no'};break;
      case 'simulation_content':event={kind:'choice',value:'partly'};break;
      case 'simulation_format':event={kind:'choice',value:'little'};break;
      case 'simulation_difficulty':event={kind:'choice',value:'harder'};break;
      case 'comment':event={kind:'text',value:scenario==='A'?'O curso ajudou; o formato e a dificuldade dos simulados poderiam se aproximar mais da prova.':'Ainda aguardo o resultado; não utilizei simulados.'};break;
      case 'done':event={kind:'text',value:'/resumo'};break;
    }
  }
  return service.handleAuthorizedInput({participantId,eventId:`demo:${crypto.randomUUID()}`,event,demo:true,now:effectiveNow});
}

export function publicRecord(state:SurveyState,demo:boolean) {
  const {participantId,attemptId,revision,scheduleRevision,...fields}=state;
  return {...fields,id:attemptId,alias:participantId==='demo:A'?'Estudante A':participantId==='demo:B'?'Estudante B':participantId==='demo:C'?'Estudante C':'Participante de demonstração',fictitious:true,deliveryMode:demo?'simulated':'telegram',product:'Curso Alfa',certification:'Certificação Alfa',source:'declarado pelo participante'};
}
