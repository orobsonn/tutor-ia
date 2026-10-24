import type { SurveyResponse, SurveyState } from './domain/survey.ts';

export interface D1ResultLike {
  success?: boolean;
  results?: unknown[];
  meta?: {
    changes?: number;
    last_row_id?: number;
  };
}

export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success?: boolean }>;
  run(): Promise<D1ResultLike>;
}

export interface D1Like {
  prepare(sql: string): D1PreparedLike;
  batch(statements: D1PreparedLike[]): Promise<D1ResultLike[]>;
}

export type OutboxStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'simulated'
  | 'unknown'
  | 'canceled';

export interface Outbox {
  id: string;
  participantId: string;
  attemptId: string;
  revision: number;
  scheduleRevision: number;
  message: string;
  buttons: SurveyResponse['buttons'];
  status: OutboxStatus;
  demo: boolean;
  kind: 'reply' | 'followup';
}

export interface OutboundSummary extends Outbox {
  messageId: string | null;
  updatedAt: string;
}

export interface ApplyEventInput {
  participantId: string;
  eventId: string;
  expectedRevision: number | null;
  expectedAttemptId?: string | null;
  state: SurveyState;
  response: Pick<SurveyResponse, 'message' | 'buttons'>;
  demo: boolean;
  kind?: 'reply' | 'followup';
}

type StoredStateRow = {
  state_json: string;
  demo: number;
};

type StoredOutboxRow = {
  id: string;
  participant_id: string;
  attempt_id: string;
  revision: number;
  schedule_revision: number;
  message: string;
  buttons_json: string;
  status: OutboxStatus;
  demo: number;
  kind: 'reply' | 'followup';
  message_id?: string | null;
  updated_at?: string;
};

const MAX_BATCH_SIZE = 20;

export class SurveyStore {
  private readonly db: D1Like;

  constructor(db: D1Like) {
    this.db = db;
  }

  async getCurrent(
    participantId: string,
  ): Promise<{ state: SurveyState; demo: boolean } | null> {
    const row = await this.db.prepare(`
      SELECT attempt.state_json, attempt.demo
      FROM current_attempts AS current
      JOIN survey_attempts AS attempt
        ON attempt.participant_id = current.participant_id
       AND attempt.attempt_id = current.attempt_id
      WHERE current.participant_id = ?
    `).bind(participantId).first<StoredStateRow>();
    return row === null ? null : deserializeState(row);
  }

  async applyEvent(input: ApplyEventInput): Promise<'applied' | 'duplicate' | 'conflict'> {
    if (input.state.participantId !== input.participantId) {
      throw new TypeError('state participant does not match event participant');
    }
    if (input.expectedRevision !== null && input.expectedRevision < 0) {
      throw new RangeError('expected revision must be null or non-negative');
    }

    const operationNonce = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const kind = input.kind ?? 'reply';
    const outboxId = stableOutboxId(input.participantId, input.eventId);
    const stateJson = JSON.stringify(input.state);
    const buttonsJson = JSON.stringify(input.response.buttons);

    const statements = [
      this.db.prepare(`
        INSERT OR IGNORE INTO survey_events (
          participant_id, event_id, operation_nonce, attempt_id, created_at
        )
        SELECT ?, ?, ?, ?, ?
        WHERE (
          ? IS NULL
          AND ? = 0
          AND NOT EXISTS (
            SELECT 1 FROM current_attempts WHERE participant_id = ?
          )
        ) OR (
          ? IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM current_attempts AS current
            JOIN survey_attempts AS attempt
              ON attempt.participant_id = current.participant_id
             AND attempt.attempt_id = current.attempt_id
            WHERE current.participant_id = ?
              AND attempt.revision = ?
              AND current.attempt_id = ?
              AND (
                (
                  current.attempt_id = ?
                  AND (
                    ? = attempt.revision + 1
                    OR (
                      ? = attempt.revision
                      AND attempt.state_json = ?
                    )
                  )
                )
                OR (
                  current.attempt_id <> ?
                  AND ? = 0
                  AND NOT EXISTS (
                    SELECT 1
                    FROM survey_attempts AS previous
                    WHERE previous.participant_id = ?
                      AND previous.attempt_id = ?
                  )
                )
              )
          )
        )
      `).bind(
        input.participantId,
        input.eventId,
        operationNonce,
        input.state.attemptId,
        timestamp,
        input.expectedRevision,
        input.state.revision,
        input.participantId,
        input.expectedRevision,
        input.participantId,
        input.expectedRevision,
        input.expectedAttemptId ?? input.state.attemptId,
        input.state.attemptId,
        input.state.revision,
        input.state.revision,
        stateJson,
        input.state.attemptId,
        input.state.revision,
        input.participantId,
        input.state.attemptId,
      ),
      this.db.prepare(`
        UPDATE outbound_messages
        SET status = 'canceled', updated_at = ?
        WHERE participant_id = ?
          AND status = 'pending'
          AND EXISTS (
            SELECT 1 FROM survey_events WHERE operation_nonce = ?
          )
      `).bind(timestamp, input.participantId, operationNonce),
      this.db.prepare(`
        INSERT INTO survey_attempts (
          participant_id, attempt_id, revision, schedule_revision, step, due_at,
          paused, demo, state_json, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM survey_events WHERE operation_nonce = ?
        )
        ON CONFLICT (participant_id, attempt_id) DO UPDATE SET
          revision = excluded.revision,
          schedule_revision = excluded.schedule_revision,
          step = excluded.step,
          due_at = excluded.due_at,
          paused = excluded.paused,
          demo = excluded.demo,
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `).bind(
        input.participantId,
        input.state.attemptId,
        input.state.revision,
        input.state.scheduleRevision,
        input.state.step,
        input.state.dueAt,
        input.state.paused ? 1 : 0,
        input.demo ? 1 : 0,
        stateJson,
        timestamp,
        timestamp,
        operationNonce,
      ),
      this.db.prepare(`
        INSERT INTO current_attempts (participant_id, attempt_id, updated_at)
        SELECT ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM survey_events WHERE operation_nonce = ?
        )
        ON CONFLICT (participant_id) DO UPDATE SET
          attempt_id = excluded.attempt_id,
          updated_at = excluded.updated_at
      `).bind(
        input.participantId,
        input.state.attemptId,
        timestamp,
        operationNonce,
      ),
      this.db.prepare(`
        INSERT INTO outbound_messages (
          id, participant_id, attempt_id, revision, schedule_revision,
          message, buttons_json, status, demo, kind, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM survey_events WHERE operation_nonce = ?
        )
      `).bind(
        outboxId,
        input.participantId,
        input.state.attemptId,
        input.state.revision,
        input.state.scheduleRevision,
        input.response.message,
        buttonsJson,
        input.demo ? 1 : 0,
        kind,
        timestamp,
        timestamp,
        operationNonce,
      ),
    ];

    const [eventResult] = await this.db.batch(statements);
    if ((eventResult.meta?.changes ?? 0) > 0) return 'applied';

    const duplicate = await this.db.prepare(`
      SELECT 1 AS present
      FROM survey_events
      WHERE participant_id = ? AND event_id = ?
    `).bind(input.participantId, input.eventId).first<{ present: number }>();
    return duplicate === null ? 'conflict' : 'duplicate';
  }

  async list(): Promise<Array<{ state: SurveyState; demo: boolean }>> {
    const { results } = await this.db.prepare(`
      SELECT state_json, demo
      FROM survey_attempts
      ORDER BY updated_at DESC, participant_id ASC, attempt_id ASC
    `).all<StoredStateRow>();
    return results.map(deserializeState);
  }

  async due(
    nowIso: string,
    limit: number = MAX_BATCH_SIZE,
    demo?: boolean,
  ): Promise<Array<{ state: SurveyState; demo: boolean }>> {
    const demoValue = demo === undefined ? null : demo ? 1 : 0;
    const { results } = await this.db.prepare(`
      SELECT attempt.state_json, attempt.demo
      FROM survey_attempts AS attempt
      JOIN current_attempts AS current
        ON current.participant_id = attempt.participant_id
       AND current.attempt_id = attempt.attempt_id
      WHERE attempt.step = 'scheduled'
        AND attempt.paused = 0
        AND COALESCE(json_extract(attempt.state_json, '$.testMode'), 0) = 0
        AND attempt.due_at IS NOT NULL
        AND attempt.due_at <= ?
        AND (? IS NULL OR attempt.demo = ?)
      ORDER BY attempt.due_at ASC, attempt.participant_id ASC
      LIMIT ?
    `).bind(nowIso, demoValue, demoValue, boundedLimit(limit)).all<StoredStateRow>();
    return results.map(deserializeState);
  }

  async pending(limit: number = MAX_BATCH_SIZE): Promise<Outbox[]> {
    const { results } = await this.db.prepare(`
      SELECT id, participant_id, attempt_id, revision, schedule_revision,
             message, buttons_json, status, demo, kind
      FROM outbound_messages
      WHERE status = 'pending'
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    `).bind(boundedLimit(limit)).all<StoredOutboxRow>();
    return results.map(deserializeOutbox);
  }

  async claim(id: string): Promise<Outbox | null> {
    const timestamp = new Date().toISOString();
    const validCurrent = `
      EXISTS (
        SELECT 1
        FROM current_attempts AS current
        JOIN survey_attempts AS attempt
          ON attempt.participant_id = current.participant_id
         AND attempt.attempt_id = current.attempt_id
        WHERE current.participant_id = outbound_messages.participant_id
          AND current.attempt_id = outbound_messages.attempt_id
          AND attempt.revision = outbound_messages.revision
          AND attempt.schedule_revision = outbound_messages.schedule_revision
          AND (outbound_messages.kind = 'reply' OR attempt.paused = 0)
      )
    `;
    const [claimed] = await this.db.batch([
      this.db.prepare(`
        UPDATE outbound_messages
        SET status = 'sending', updated_at = ?
        WHERE id = ? AND status = 'pending' AND ${validCurrent}
      `).bind(timestamp, id),
      this.db.prepare(`
        UPDATE outbound_messages
        SET status = 'canceled', updated_at = ?
        WHERE id = ? AND status = 'pending' AND NOT ${validCurrent}
      `).bind(timestamp, id),
    ]);
    if ((claimed.meta?.changes ?? 0) === 0) return null;

    const row = await this.db.prepare(`
      SELECT id, participant_id, attempt_id, revision, schedule_revision,
             message, buttons_json, status, demo, kind
      FROM outbound_messages
      WHERE id = ? AND status = 'sending'
    `).bind(id).first<StoredOutboxRow>();
    return row === null ? null : deserializeOutbox(row);
  }

  async markDelivery(
    id: string,
    status: 'sent' | 'simulated' | 'unknown' | 'canceled',
    messageId?: string,
  ): Promise<void> {
    await this.db.prepare(`
      UPDATE outbound_messages
      SET status = ?, message_id = ?, updated_at = ?
      WHERE id = ? AND status = 'sending'
    `).bind(status, messageId ?? null, new Date().toISOString(), id).run();
  }

  async recoverStaleSending(beforeIso: string): Promise<void> {
    await this.db.prepare(`
      UPDATE outbound_messages
      SET status = 'unknown', updated_at = ?
      WHERE status = 'sending' AND updated_at < ?
    `).bind(new Date().toISOString(), beforeIso).run();
  }

  async recentDeliveries(limit: number = 50): Promise<OutboundSummary[]> {
    const { results } = await this.db.prepare(`
      SELECT id, participant_id, attempt_id, revision, schedule_revision,
             message, buttons_json, status, demo, kind, message_id, updated_at
      FROM outbound_messages
      WHERE status <> 'pending'
      ORDER BY updated_at DESC, id ASC
      LIMIT ?
    `).bind(boundedRecentLimit(limit)).all<StoredOutboxRow>();
    return results.map((row) => ({
      ...deserializeOutbox(row),
      messageId: row.message_id ?? null,
      updatedAt: row.updated_at ?? '',
    }));
  }
}

function stableOutboxId(participantId: string, eventId: string): string {
  return `event:${participantId.length}:${participantId}:${eventId}`;
}

function boundedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return MAX_BATCH_SIZE;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_BATCH_SIZE);
}

function boundedRecentLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function deserializeState(row: StoredStateRow): { state: SurveyState; demo: boolean } {
  return {
    state: JSON.parse(row.state_json) as SurveyState,
    demo: row.demo === 1,
  };
}

function deserializeOutbox(row: StoredOutboxRow): Outbox {
  return {
    id: row.id,
    participantId: row.participant_id,
    attemptId: row.attempt_id,
    revision: row.revision,
    scheduleRevision: row.schedule_revision,
    message: row.message,
    buttons: JSON.parse(row.buttons_json) as SurveyResponse['buttons'],
    status: row.status,
    demo: row.demo === 1,
    kind: row.kind,
  };
}
