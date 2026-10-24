import assert from 'node:assert/strict';
import test from 'node:test';

import { createSurvey, type SurveyState } from '../../src/domain/survey.ts';
import { SurveyStore } from '../../src/storage.ts';
import { createTestDatabase, SqliteD1 } from './sqlite-d1.ts';

function setup(): { db: SqliteD1; store: SurveyStore } {
  const db = createTestDatabase();
  return { db, store: new SurveyStore(db) };
}

function scheduled(
  participantId: string,
  attemptId: string,
  options: Partial<SurveyState> = {},
): SurveyState {
  return {
    ...createSurvey(participantId, attemptId),
    step: 'scheduled',
    examDate: '2026-10-30',
    dueAt: '2026-10-31T13:00:00.000Z',
    scheduleRevision: 1,
    ...options,
  };
}

const response = {
  message: 'Resposta fictícia da pesquisa.',
  buttons: [{ text: 'Continuar', value: 'continue' }],
};

test('aplica evento uma vez, deduplica por participante e usa o schema real', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  const stateA = createSurvey('participant-a', 'attempt-a');
  assert.equal(await store.applyEvent({
    participantId: 'participant-a',
    eventId: 'update-1',
    expectedRevision: null,
    state: stateA,
    response,
    demo: true,
  }), 'applied');

  assert.equal(await store.applyEvent({
    participantId: 'participant-a',
    eventId: 'update-1',
    expectedRevision: null,
    state: stateA,
    response,
    demo: true,
  }), 'duplicate');

  const stateB = createSurvey('participant-b', 'attempt-b');
  assert.equal(await store.applyEvent({
    participantId: 'participant-b',
    eventId: 'update-1',
    expectedRevision: null,
    state: stateB,
    response,
    demo: true,
  }), 'applied');

  assert.equal((await store.pending()).length, 2);
  assert.deepEqual(db.query('PRAGMA foreign_key_check'), []);
  const indexes = db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_survey_attempts_due'",
  );
  assert.deepEqual(indexes.map(({ name }) => name), ['idx_survey_attempts_due']);
});

test('CAS concorrente aceita uma revisão e rejeita a outra sem outbox órfã', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  const initial = createSurvey('participant-cas', 'attempt-cas');
  assert.equal(await store.applyEvent({
    participantId: initial.participantId,
    eventId: 'initial',
    expectedRevision: null,
    state: initial,
    response,
    demo: true,
  }), 'applied');

  const first = scheduled(initial.participantId, initial.attemptId, {
    revision: 1,
    dueAt: '2026-10-31T13:00:00.000Z',
  });
  const second = scheduled(initial.participantId, initial.attemptId, {
    revision: 1,
    dueAt: '2026-11-01T13:00:00.000Z',
  });

  const results = await Promise.all([
    store.applyEvent({
      participantId: initial.participantId,
      eventId: 'race-a',
      expectedRevision: 0,
      state: first,
      response: { ...response, message: 'A' },
      demo: true,
    }),
    store.applyEvent({
      participantId: initial.participantId,
      eventId: 'race-b',
      expectedRevision: 0,
      state: second,
      response: { ...response, message: 'B' },
      demo: true,
    }),
  ]);

  assert.deepEqual(results.toSorted(), ['applied', 'conflict']);
  assert.equal((await store.getCurrent(initial.participantId))?.state.revision, 1);
  assert.equal((await store.pending()).length, 1);
  assert.equal(db.query<{ count: number }>('SELECT count(*) AS count FROM survey_events').length, 1);
  assert.equal(db.query<{ count: number }>('SELECT count(*) AS count FROM survey_events')[0].count, 2);
});

test('evento somente de leitura responde sem inventar revisão nem sobrescrever estado', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  const state = scheduled('participant-summary', 'attempt-summary');
  await store.applyEvent({
    participantId: state.participantId,
    eventId: 'seed-summary',
    expectedRevision: null,
    state,
    response,
    demo: true,
  });

  assert.equal(await store.applyEvent({
    participantId: state.participantId,
    eventId: 'summary',
    expectedRevision: 0,
    state: structuredClone(state),
    response: { message: 'Resumo da tentativa.', buttons: [] },
    demo: true,
  }), 'applied');
  assert.equal((await store.getCurrent(state.participantId))?.state.revision, 0);
  assert.equal((await store.pending())[0].message, 'Resumo da tentativa.');

  const changedWithoutRevision = { ...state, dueAt: '2027-01-01T13:00:00.000Z' };
  assert.equal(await store.applyEvent({
    participantId: state.participantId,
    eventId: 'invalid-overwrite',
    expectedRevision: 0,
    state: changedWithoutRevision,
    response,
    demo: true,
  }), 'conflict');
});

test('nova tentativa vira corrente e preserva a tentativa anterior no histórico', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  const previous = createSurvey('participant-history', 'attempt-old');
  assert.equal(await store.applyEvent({
    participantId: previous.participantId,
    eventId: 'old',
    expectedRevision: null,
    state: previous,
    response,
    demo: true,
  }), 'applied');

  const next = createSurvey(previous.participantId, 'attempt-new');
  assert.equal(await store.applyEvent({
    participantId: next.participantId,
    eventId: 'new',
    expectedRevision: 0,
    state: next,
    response,
    demo: true,
  }), 'applied');

  assert.equal((await store.getCurrent(next.participantId))?.state.attemptId, 'attempt-new');
  assert.deepEqual(
    (await store.list()).map(({ state }) => state.attemptId).toSorted(),
    ['attempt-new', 'attempt-old'],
  );
});

test('remarcação e pausa invalidam pendências antigas sem bloquear a resposta reativa', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  const original = scheduled('participant-change', 'attempt-change');
  await store.applyEvent({
    participantId: original.participantId,
    eventId: 'scheduled',
    expectedRevision: null,
    state: original,
    response,
    demo: true,
  });
  const firstOutbox = (await store.pending())[0];

  const rescheduled = scheduled(original.participantId, original.attemptId, {
    revision: 1,
    scheduleRevision: 2,
    examDate: '2026-11-02',
    dueAt: '2026-11-03T13:00:00.000Z',
  });
  await store.applyEvent({
    participantId: original.participantId,
    eventId: 'rescheduled',
    expectedRevision: 0,
    state: rescheduled,
    response,
    demo: true,
  });
  assert.equal(await store.claim(firstOutbox.id), null);

  const rescheduledOutbox = (await store.pending())[0];
  const paused = { ...rescheduled, revision: 2, paused: true, scheduleRevision: 3 };
  await store.applyEvent({
    participantId: original.participantId,
    eventId: 'paused',
    expectedRevision: 1,
    state: paused,
    response: { message: 'Contatos pausados.', buttons: [] },
    demo: true,
  });
  assert.equal(await store.claim(rescheduledOutbox.id), null);

  const pauseReply = (await store.pending())[0];
  assert.equal((await store.claim(pauseReply.id))?.status, 'sending');

  const proactive = createSurvey('participant-proactive', 'attempt-proactive');
  proactive.paused = true;
  await store.applyEvent({
    participantId: proactive.participantId,
    eventId: 'followup-paused',
    expectedRevision: null,
    state: proactive,
    response,
    demo: true,
    kind: 'followup',
  });
  const proactiveOutbox = (await store.pending())[0];
  assert.equal(await store.claim(proactiveOutbox.id), null);
});

test('claim é único e entrega incerta não volta para a fila', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  const state = createSurvey('participant-claim', 'attempt-claim');
  await store.applyEvent({
    participantId: state.participantId,
    eventId: 'claim',
    expectedRevision: null,
    state,
    response,
    demo: true,
  });
  const pending = (await store.pending())[0];

  assert.equal((await store.claim(pending.id))?.status, 'sending');
  assert.equal(await store.claim(pending.id), null);
  await store.markDelivery(pending.id, 'unknown');
  assert.deepEqual(await store.pending(), []);
  assert.equal((await store.recentDeliveries())[0].status, 'unknown');
  assert.equal((await store.recentDeliveries())[0].messageId, null);
});

test('claim abandonado vira unknown sem ser reenfileirado', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  const state = createSurvey('participant-crash', 'attempt-crash');
  await store.applyEvent({
    participantId: state.participantId,
    eventId: 'crash',
    expectedRevision: null,
    state,
    response,
    demo: true,
  });
  const outbox = (await store.pending())[0];
  assert.equal((await store.claim(outbox.id))?.status, 'sending');
  assert.equal((await store.recentDeliveries())[0].status, 'sending');

  await store.recoverStaleSending('9999-12-31T23:59:59.999Z');

  assert.equal((await store.recentDeliveries())[0].status, 'unknown');
  assert.deepEqual(await store.pending(), []);
  assert.equal(await store.claim(outbox.id), null);
});

test('due retorna apenas tentativas correntes vencidas e limita cada passagem a 20', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  for (let index = 0; index < 25; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const state = scheduled(`participant-${suffix}`, `attempt-${suffix}`);
    assert.equal(await store.applyEvent({
      participantId: state.participantId,
      eventId: `seed-${suffix}`,
      expectedRevision: null,
      state,
      response,
      demo: true,
    }), 'applied');
  }

  const paused = scheduled('participant-paused', 'attempt-paused', { paused: true });
  await store.applyEvent({
    participantId: paused.participantId,
    eventId: 'seed-paused',
    expectedRevision: null,
    state: paused,
    response,
    demo: true,
  });
  const future = scheduled('participant-future', 'attempt-future', {
    dueAt: '2026-11-20T13:00:00.000Z',
  });
  await store.applyEvent({
    participantId: future.participantId,
    eventId: 'seed-future',
    expectedRevision: null,
    state: future,
    response,
    demo: true,
  });

  const firstPage = await store.due('2026-11-01T13:00:00.000Z');
  const oversizedPage = await store.due('2026-11-01T13:00:00.000Z', 100);
  assert.equal(firstPage.length, 20);
  assert.equal(oversizedPage.length, 20);
  assert.ok(firstPage.every(({ state }) => state.step === 'scheduled' && !state.paused));
  assert.deepEqual(
    firstPage.map(({ state }) => state.participantId),
    Array.from({ length: 20 }, (_, index) => `participant-${String(index).padStart(2, '0')}`),
  );
});

test('due filtra o modo antes do limite para cenários demo não bloquearem Telegram', async (t) => {
  const { db, store } = setup();
  t.after(() => db.close());

  for (let index = 0; index < 20; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const state = scheduled(`demo-${suffix}`, `attempt-demo-${suffix}`, {
      dueAt: '2026-10-30T13:00:00.000Z',
    });
    await store.applyEvent({
      participantId: state.participantId,
      eventId: `seed-demo-${suffix}`,
      expectedRevision: null,
      state,
      response,
      demo: true,
    });
  }

  const telegram = scheduled('telegram-real', 'attempt-telegram', {
    dueAt: '2026-10-31T13:00:00.000Z',
  });
  await store.applyEvent({
    participantId: telegram.participantId,
    eventId: 'seed-telegram',
    expectedRevision: null,
    state: telegram,
    response,
    demo: false,
  });

  const dueTelegram = await store.due('2026-11-01T13:00:00.000Z', 20, false);
  assert.deepEqual(
    dueTelegram.map(({ state, demo }) => ({ participantId: state.participantId, demo })),
    [{ participantId: 'telegram-real', demo: false }],
  );
});
