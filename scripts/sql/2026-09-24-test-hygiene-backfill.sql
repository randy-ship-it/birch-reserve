-- Birch Reserve 6:50pm: backfill is_test on QA / probe rows that landed before the
-- hygiene deploy. Run AFTER 2026-09-24-test-hygiene-attribution.sql and after the
-- deploy, in DEV and PROD:
--   psql "$DATABASE_URL" -f scripts/sql/2026-09-24-test-hygiene-backfill.sql
-- Only ever sets is_test = true on matching rows (never deletes, never unsets).
-- Idempotent: re-running changes nothing (WHERE NOT is_test).

BEGIN;

UPDATE leads SET is_test = true
 WHERE NOT is_test
   AND (name ILIKE 'QA Test%' OR name ILIKE '%QA Test%'
        OR name ILIKE '%Pulse Probe%'
        OR email ILIKE 'qa+%'
        OR source_ref LIKE 'emma-qa%' OR source_ref LIKE 'qa-%'
        OR id LIKE 'chat:emma-qa%' OR id LIKE 'voice:qa-%' OR id LIKE 'voice:emma-qa%');

UPDATE voice_calls SET is_test = true
 WHERE NOT is_test
   AND (call_id LIKE 'qa-%' OR call_id LIKE 'emma-qa%'
        OR extracted->>'name' ILIKE '%QA Test%' OR extracted->>'name' ILIKE '%Pulse Probe%'
        OR extracted->>'email' ILIKE 'qa+%'
        OR lead_id IN (SELECT id FROM leads WHERE is_test));

UPDATE randy_chat_sessions SET is_test = true
 WHERE NOT is_test
   AND (id LIKE 'emma-qa%'
        OR contact->>'name' ILIKE '%QA Test%' OR contact->>'name' ILIKE '%Pulse Probe%'
        OR contact->>'email' ILIKE 'qa+%'
        OR qualify->>'company' ILIKE 'emma-qa%');

-- Leads whose source row is now test traffic.
UPDATE leads SET is_test = true
 WHERE NOT is_test
   AND (id IN (SELECT 'chat:' || id FROM randy_chat_sessions WHERE is_test)
        OR id IN (SELECT lead_id FROM voice_calls WHERE is_test AND lead_id IS NOT NULL));

UPDATE splash_ad_reservations SET is_test = true
 WHERE NOT is_test
   AND (email ILIKE 'qa+%' OR brand_name ILIKE '%QA Test%' OR brand_name ILIKE '%Pulse Probe%');

COMMIT;

-- Check:
-- SELECT 'leads' t, count(*) FILTER (WHERE is_test) test, count(*) total FROM leads
-- UNION ALL SELECT 'voice_calls', count(*) FILTER (WHERE is_test), count(*) FROM voice_calls
-- UNION ALL SELECT 'randy_chat_sessions', count(*) FILTER (WHERE is_test), count(*) FROM randy_chat_sessions
-- UNION ALL SELECT 'splash_ad_reservations', count(*) FILTER (WHERE is_test), count(*) FROM splash_ad_reservations;
