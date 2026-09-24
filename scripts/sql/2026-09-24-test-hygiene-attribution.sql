-- Birch Reserve 6:50pm: test-traffic hygiene (is_test) + first-touch attribution.
-- ADDITIVE ONLY and idempotent: ADD COLUMN IF NOT EXISTS. No DROP, no RENAME,
-- no type / default changes to existing columns. Safe to run repeatedly.
--
-- Order:
--   1. scripts/sql/2026-09-24-leads-voice-calls.sql   (creates leads + voice_calls; already run)
--   2. THIS FILE                                        (schema; run in DEV before publish, then PROD)
--   3. scripts/sql/2026-09-24-test-hygiene-backfill.sql (after deploy; flags past QA rows)
--
--   psql "$DATABASE_URL" -f scripts/sql/2026-09-24-test-hygiene-attribution.sql
--
-- Mirrors lib/db/src/schema (Drizzle) so the publish diff only proposes these same
-- ADD COLUMNs (never drops). The api-server also runs the leads / voice_calls /
-- randy_chat_sessions statements at runtime as a safety net.

-- leads: QA flag + first-touch attribution
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS referrer text;
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS landing_page text;

-- voice_calls: QA flag
ALTER TABLE IF EXISTS voice_calls ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- randy_chat_sessions: QA flag
ALTER TABLE IF EXISTS randy_chat_sessions ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- splash_ad_reservations: QA flag (marking only; seat logic unchanged)
ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
