-- Birch Reserve: leads (single system of record) + voice_calls (xAI post-call).
-- ADDITIVE and idempotent: CREATE ... IF NOT EXISTS only. No DROP, no RENAME,
-- no ALTER ... DROP. Safe to run repeatedly.
--
-- Run this in the Replit DEV database before publishing, so the dev schema
-- already matches lib/db/src/schema/leads.ts and the publish diff only ever
-- proposes these same CREATEs (never drops):
--   psql "$DATABASE_URL" -f scripts/sql/2026-09-24-leads-voice-calls.sql
-- The api-server also runs the same statements at runtime as a safety net.

CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  source text NOT NULL,
  source_ref text NOT NULL,
  name text,
  company text,
  role text,
  phone text,
  email text,
  need text,
  size text,
  timing text,
  page_path text,
  friday_status text NOT NULL DEFAULT 'pending',
  friday_attempts integer NOT NULL DEFAULT 0,
  friday_last_error text,
  friday_contact_id text,
  friday_deal_id text,
  friday_pushed_at timestamptz,
  friday_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at);
CREATE INDEX IF NOT EXISTS leads_friday_status_idx ON leads (friday_status, updated_at);

CREATE TABLE IF NOT EXISTS voice_calls (
  call_id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'phone',
  lead_id text,
  caller_number text,
  called_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  end_reason text,
  transcript text,
  transcript_turns jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_count integer NOT NULL DEFAULT 1,
  notified_at timestamptz,
  notify_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_calls_created_at_idx ON voice_calls (created_at);
