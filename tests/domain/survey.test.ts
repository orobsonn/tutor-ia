import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSurvey,
  transition,
  type SurveyResponse,
  type SurveyState,
} from '../../src/domain/survey.ts';

const NOW = new Date('2026-10-24T15:00:00.000Z');
const EXAM_DATE = '2026-10-25';
const DUE_AT = new Date('2026-10-26T13:00:00.000Z');

function send(
  state: SurveyState,
  kind: 'text' | 'choice' | 'followup',
  value = '',
  now = NOW,
): SurveyResponse {
  return transition(
    state,
    kind === 'followup' ? { kind } : { kind, value },
    now,
  );
}

function schedule(
  state = createSurvey('participant-demo', 'attempt-demo'),
  examDate = EXAM_DATE,
): SurveyState {
  const proposed = send(state, 'text', examDate).state;
  return send(proposed, 'choice', 'confirm').state;
}

function startFeedback(state = schedule()): SurveyState {
  const asked = send(state, 'followup', '', DUE_AT).state;
  return send(asked, 'choice', 'yes').state;
}

function choose(state: SurveyState, value: string): SurveyState {
  return send(state, 'choice', value).state;
}

test('percorre o questionário completo e agenda D+1 às 10h em America/Fortaleza', () => {
  let response = send(createSurvey('participant-demo', 'attempt-demo'), 'text', EXAM_DATE);
  assert.equal(response.state.step, 'confirm_date');
  assert.equal(response.state.candidateDate, EXAM_DATE);
  assert.deepEqual(response.buttons.map((button) => button.value), ['confirm', 'intended', 'no']);

  response = send(response.state, 'choice', 'confirm');
  assert.equal(response.state.step, 'scheduled');
  assert.equal(response.state.examDate, EXAM_DATE);
  assert.equal(response.state.dueAt, '2026-10-26T13:00:00.000Z');
  assert.equal(response.state.scheduleRevision, 1);

  response = send(response.state, 'followup', '', DUE_AT);
  assert.equal(response.state.step, 'attendance');
  assert.deepEqual(response.buttons.map((button) => button.value), [
    'yes',
    'no',
    '/data',
    '/cancelar',
  ]);

  response = send(response.state, 'choice', 'yes');
  response = send(response.state, 'choice', 'approved');
  response = send(response.state, 'choice', 'yes');
  response = send(response.state, 'choice', 'much');
  response = send(response.state, 'choice', 'yes');
  response = send(response.state, 'choice', 'partly');
  response = send(response.state, 'choice', 'little');
  response = send(response.state, 'choice', 'harder');
  response = send(response.state, 'text', 'O conteúdo ajudou; o formato poderia ser mais próximo.');

  assert.equal(response.state.step, 'done');
  assert.equal(response.state.attendance, 'performed');
  assert.equal(response.state.result, 'approved');
  assert.equal(response.state.courseUsed, true);
  assert.equal(response.state.courseAlignment, 'much');
  assert.equal(response.state.simulationUsed, true);
  assert.equal(response.state.simulationContent, 'partly');
  assert.equal(response.state.simulationFormat, 'little');
  assert.equal(response.state.simulationDifficulty, 'harder');
  assert.equal(
    response.state.comment,
    'O conteúdo ajudou; o formato poderia ser mais próximo.',
  );
});

test('não uso pula as avaliações dependentes e mantém valores nulos', () => {
  let state = startFeedback();
  state = choose(state, 'failed');
  state = choose(state, 'no');
  assert.equal(state.step, 'simulation_use');
  assert.equal(state.courseUsed, false);
  assert.equal(state.courseAlignment, null);

  state = choose(state, 'no');
  assert.equal(state.step, 'comment');
  assert.equal(state.simulationUsed, false);
  assert.equal(state.simulationContent, null);
  assert.equal(state.simulationFormat, null);
  assert.equal(state.simulationDifficulty, null);

  state = choose(state, 'skip');
  assert.equal(state.step, 'done');
  assert.equal(state.comment, null);
});

test('resultado pendente permite registrar todo o feedback', () => {
  let state = startFeedback();
  state = choose(state, 'pending');
  assert.equal(state.step, 'course_use');
  assert.equal(state.result, 'pending');

  state = choose(state, 'yes');
  state = choose(state, 'partly');
  state = choose(state, 'no');
  state = choose(state, 'skip');

  assert.equal(state.step, 'done');
  assert.equal(state.result, 'pending');
  assert.equal(state.courseAlignment, 'partly');
  assert.equal(state.simulationUsed, false);
});

test('faz as perguntas de conteúdo, formato e dificuldade dos simulados na ordem', () => {
  let state = startFeedback();
  state = choose(state, 'approved');
  state = choose(state, 'no');
  state = choose(state, 'yes');

  let response = send(state, 'choice', 'much');
  assert.equal(response.state.step, 'simulation_format');
  assert.match(response.message, /formato/i);

  response = send(response.state, 'choice', 'partly');
  assert.equal(response.state.step, 'simulation_difficulty');
  assert.match(response.message, /mais fácil|semelhante|mais difícil/i);
});

test('rejeita data impossível, passada e além de 730 dias', () => {
  const initial = createSurvey('participant-demo', 'attempt-demo');

  for (const invalidDate of ['2026-02-30', '2026-10-23', '2028-10-25']) {
    const response = send(initial, 'text', invalidDate);
    assert.equal(response.state.step, 'date');
    assert.equal(response.state.revision, 0);
    assert.equal(response.state.examDate, null);
    assert.match(response.message, /data/i);
  }
});

test('remarcação invalida agenda anterior e cria novo vencimento sem alterar identificadores', () => {
  const first = schedule();
  const invalidated = send(first, 'text', '/data').state;

  assert.equal(invalidated.step, 'date');
  assert.equal(invalidated.dueAt, null);
  assert.ok(invalidated.scheduleRevision > first.scheduleRevision);
  assert.equal(invalidated.participantId, first.participantId);
  assert.equal(invalidated.attemptId, first.attemptId);

  const second = schedule(invalidated, '2026-11-02');
  assert.equal(second.examDate, '2026-11-02');
  assert.equal(second.dueAt, '2026-11-03T13:00:00.000Z');
  assert.ok(second.scheduleRevision > invalidated.scheduleRevision);
});

test('pausa suspende follow-up, permite corrigir a data e retoma do passo preservado', () => {
  const scheduled = schedule();
  const paused = send(scheduled, 'text', '/pausar').state;
  assert.equal(paused.paused, true);
  assert.equal(paused.step, 'scheduled');

  const blocked = send(paused, 'followup', '', DUE_AT);
  assert.equal(blocked.state.step, 'scheduled');
  assert.match(blocked.message, /paus/i);

  const correcting = send(paused, 'text', '/data').state;
  assert.equal(correcting.paused, true);
  assert.equal(correcting.step, 'date');

  const rescheduled = schedule(correcting, '2026-11-02');
  const resumed = send(rescheduled, 'text', '/retomar').state;
  assert.equal(resumed.paused, false);
  assert.equal(resumed.step, 'scheduled');

  const asked = send(resumed, 'followup', '', new Date(resumed.dueAt!));
  assert.equal(asked.state.step, 'attendance');
});

test('ausência encerra a tentativa sem abrir perguntas de resultado ou avaliação', () => {
  let state = schedule();
  state = send(state, 'followup', '', DUE_AT).state;
  const absent = send(state, 'choice', 'no');

  assert.equal(absent.state.step, 'done');
  assert.equal(absent.state.attendance, 'absent');
  assert.equal(absent.state.result, null);
  assert.equal(absent.state.courseUsed, null);
  assert.equal(absent.state.simulationUsed, null);
  assert.deepEqual(absent.buttons, []);

  const ignored = send(absent.state, 'choice', 'approved');
  assert.equal(ignored.state.step, 'done');
  assert.equal(ignored.state.result, null);
});

test('/resultado corrige o resultado e volta ao passo anterior sem apagar feedback', () => {
  let state = startFeedback();
  state = choose(state, 'approved');
  state = choose(state, 'yes');
  state = choose(state, 'much');
  state = choose(state, 'yes');
  state = choose(state, 'partly');
  state = choose(state, 'little');
  state = choose(state, 'harder');
  state = send(state, 'text', 'Comentário preservado.').state;

  const beforeCorrection = state;
  const correcting = send(state, 'text', '/resultado').state;
  assert.equal(correcting.step, 'result');
  assert.equal(correcting.returnStep, 'done');

  const corrected = send(correcting, 'choice', 'failed').state;
  assert.equal(corrected.step, 'done');
  assert.equal(corrected.result, 'failed');
  assert.equal(corrected.courseAlignment, 'much');
  assert.equal(corrected.simulationContent, 'partly');
  assert.equal(corrected.simulationFormat, 'little');
  assert.equal(corrected.simulationDifficulty, 'harder');
  assert.equal(corrected.comment, 'Comentário preservado.');
  assert.equal(beforeCorrection.result, 'approved');

  const redate = send(corrected, 'text', '/data');
  assert.equal(redate.state.step, 'done');
  assert.equal(redate.state.examDate, EXAM_DATE);
  assert.match(redate.message, /nova/i);
});

test('rejeita escolha fora das opções sem avançar nem incrementar revisão', () => {
  const state = send(schedule(), 'followup', '', DUE_AT).state;
  const response = send(state, 'choice', 'maybe');

  assert.equal(response.state.step, 'attendance');
  assert.equal(response.state.revision, state.revision);
  assert.equal(response.state.attendance, null);
  assert.match(response.message, /opç/i);
});

test('limita comentário a 1000 caracteres e aceita exatamente o limite', () => {
  let state = startFeedback();
  state = choose(state, 'unknown');
  state = choose(state, 'no');
  state = choose(state, 'no');
  assert.equal(state.step, 'comment');

  const rejected = send(state, 'text', 'x'.repeat(1001));
  assert.equal(rejected.state.step, 'comment');
  assert.equal(rejected.state.revision, state.revision);
  assert.match(rejected.message, /1000/);

  const accepted = send(state, 'text', 'x'.repeat(1000));
  assert.equal(accepted.state.step, 'done');
  assert.equal(accepted.state.comment?.length, 1000);
});

test('oferece escolhas significativas para ausência de data e cancelamento', () => {
  const initial = createSurvey('participant-demo', 'attempt-demo');
  const started = send(initial, 'text', '/start');
  assert.deepEqual(started.buttons.map((button) => button.value), ['unknown', 'no']);

  const noDate = send(initial, 'choice', 'unknown');
  assert.equal(noDate.state.step, 'scheduled');
  assert.equal(noDate.state.examDate, null);
  assert.equal(noDate.state.dueAt, null);
  assert.match(noDate.message, /sem data/i);

  const cancelled = send(initial, 'choice', 'no');
  assert.equal(cancelled.state.step, 'done');
  assert.equal(cancelled.state.attendance, 'cancelled');

  const summary = send(cancelled.state, 'text', '/resumo');
  assert.match(summary.message, /cancel/i);
  assert.equal(summary.state.revision, cancelled.state.revision);
});

test('late confirmation cannot schedule an expired candidate date',()=>{
 const proposed=send(createSurvey('demo','late'),'text','2026-10-24').state;
 const result=send(proposed,'choice','confirm',new Date('2026-10-26T15:00:00Z'));
 assert.equal(result.state.step,'date');
 assert.equal(result.state.dueAt,null);
});

test('intended date stays distinct from scheduled and undated without scheduling a contact',()=>{
 const base=createSurvey('demo','intended');
 const candidate=send(base,'text',EXAM_DATE).state;
 const intended=send(candidate,'choice','intended').state;
 assert.equal(intended.examDateStatus,'intended');
 assert.equal(intended.examDate,EXAM_DATE);
 assert.equal(intended.dueAt,null);
 assert.equal(send(intended,'followup','',DUE_AT).state.step,'scheduled');
 const reopened=send(intended,'text','/data').state;
 const marked=send(send(reopened,'text',EXAM_DATE).state,'choice','confirm').state;
 assert.equal(marked.examDateStatus,'scheduled');
 assert.ok(marked.dueAt);
 const undated=send(base,'choice','unknown').state;
 assert.equal(undated.examDateStatus,'undated');
 assert.equal(undated.examDate,null);
});

test('aceita data brasileira e preserva representação canônica e vencimento no fuso',()=>{
 const candidate=send(createSurvey('demo','br-date'),'text','25/10/2026');
 assert.equal(candidate.state.step,'confirm_date');assert.equal(candidate.state.candidateDate,'2026-10-25');
 const confirmed=send(candidate.state,'choice','confirm');assert.equal(confirmed.state.examDate,'2026-10-25');assert.equal(confirmed.state.dueAt,'2026-10-26T13:00:00.000Z');
 assert.match(confirmed.message,/25\/10\/2026/);assert.match(confirmed.message,/26\/10\/2026/);assert.match(confirmed.message,/10:00/);assert.ok(!confirmed.message.includes('T13:00'));
});
test('data brasileira impossível ou ambígua não altera estado nem agenda',()=>{
 const state=createSurvey('demo','br-invalid');
 for(const value of ['31/02/2027','25/13/2026','amanhã','1/2/26']){
  const result=send(state,'text',value);assert.deepEqual(result.state,state);assert.equal(result.state.dueAt,null);
 }
});
test('resumo apresenta resultado e avaliações em português e blocos separados',()=>{
 let state=startFeedback();for(const value of ['approved','yes','much','yes','partly','little','harder','skip'])state=choose(state,value);
 const summary=send(state,'text','/resumo').message;
 assert.match(summary,/Aprovado/);assert.match(summary,/Em parte/);assert.match(summary,/Mais difícil/);assert.ok(summary.includes('\n\n'));assert.ok(!summary.includes('approved'));assert.ok(!summary.includes('performed'));
});
