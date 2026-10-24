PRAGMA foreign_keys = ON;

CREATE TABLE survey_attempts (
  participant_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  schedule_revision INTEGER NOT NULL CHECK (schedule_revision >= 0),
  step TEXT NOT NULL,
  due_at TEXT,
  paused INTEGER NOT NULL CHECK (paused IN (0, 1)),
  demo INTEGER NOT NULL CHECK (demo IN (0, 1)),
  state_json TEXT NOT NULL CHECK (json_valid(state_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (participant_id, attempt_id)
);

CREATE TABLE current_attempts (
  participant_id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (participant_id, attempt_id)
    REFERENCES survey_attempts (participant_id, attempt_id)
);

CREATE TABLE survey_events (
  participant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  operation_nonce TEXT NOT NULL UNIQUE,
  attempt_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (participant_id, event_id),
  FOREIGN KEY (participant_id, attempt_id)
    REFERENCES survey_attempts (participant_id, attempt_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE outbound_messages (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  schedule_revision INTEGER NOT NULL CHECK (schedule_revision >= 0),
  message TEXT NOT NULL,
  buttons_json TEXT NOT NULL CHECK (json_valid(buttons_json)),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'sending', 'sent', 'simulated', 'unknown', 'canceled')
  ),
  demo INTEGER NOT NULL CHECK (demo IN (0, 1)),
  kind TEXT NOT NULL CHECK (kind IN ('reply', 'followup')),
  message_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (participant_id, attempt_id)
    REFERENCES survey_attempts (participant_id, attempt_id)
);

CREATE INDEX idx_survey_attempts_due
  ON survey_attempts (due_at, participant_id, attempt_id)
  WHERE step = 'scheduled' AND paused = 0 AND due_at IS NOT NULL;

CREATE INDEX idx_outbound_messages_pending
  ON outbound_messages (status, created_at, id);

CREATE INDEX idx_outbound_messages_participant
  ON outbound_messages (participant_id, status, updated_at);

CREATE INDEX idx_survey_events_attempt
  ON survey_events (participant_id, attempt_id, created_at);
