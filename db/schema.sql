-- QA call review schema (PostgreSQL / Neon).
-- Idempotent: safe to run repeatedly via `npm run db:setup`.

CREATE TABLE IF NOT EXISTS calls (
  id                 text PRIMARY KEY,
  call_date          date NOT NULL,
  estimated_duration text NOT NULL,
  transcript         text NOT NULL,
  summary            text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Every decision is kept as a row, so a call's review history is preserved;
-- the app shows the most recent one per call.
CREATE TABLE IF NOT EXISTS reviews (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  call_id    text NOT NULL REFERENCES calls (id) ON DELETE CASCADE,
  decision   text NOT NULL CHECK (decision IN ('approve', 'reject', 'needs_edit')),
  reason     text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 280),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_call_id_created_at_idx
  ON reviews (call_id, created_at DESC);
