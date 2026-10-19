-- Birch Reserve: splash_ad_reservations seat-count schema.
-- ADDITIVE ONLY and idempotent. Existing columns stay as they are.
-- Safe to run repeatedly.
--
-- Applied on API boot (Vercel function and the long-running server) by
-- ensureSplashSeatSchema in artifacts/api-server/src/lib/schemaEnsure.ts.
-- DATABASE_URL is a sensitive env var, so the Vercel build cannot apply it;
-- the new deployment applies it on first boot, and getSplashSeatCounts
-- applies it again before reading seats. If Postgres is unreachable the
-- page still answers from the open pool.
--
--   psql "$DATABASE_URL" -f scripts/sql/2026-10-18-splash-ad-reservations-offer-key.sql

CREATE TABLE IF NOT EXISTS splash_ad_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text,
  email text NOT NULL,
  website_url text,
  ad_interest text NOT NULL DEFAULT 'display',
  promoted_offer text,
  launch_window text,
  status text NOT NULL DEFAULT 'interest_captured',
  offer_key text NOT NULL DEFAULT 'reserve-490',
  amount_cents integer NOT NULL DEFAULT 49000,
  currency text NOT NULL DEFAULT 'usd',
  source text NOT NULL DEFAULT 'splash_ad_prebuy',
  follow_up_by timestamptz NOT NULL,
  sheet_sync_status text NOT NULL DEFAULT 'pending',
  sheet_sync_error text,
  alert_delivery_status text NOT NULL DEFAULT 'pending',
  alert_delivery_error text,
  alert_delivered_at timestamptz,
  activation_token text,
  payment_status text NOT NULL DEFAULT 'unpaid',
  stripe_checkout_session_id text,
  stripe_checkout_url text,
  checkout_attempt integer NOT NULL DEFAULT 0,
  checkout_request jsonb,
  checkout_idempotency_key text,
  checkout_attempt_started_at timestamptz,
  checkout_recovery_error text,
  checkout_recovery_attempted_at timestamptz,
  stripe_payment_intent_id text,
  public_idempotency_key text,
  public_request_fingerprint text,
  ucp_agent_profile_url text,
  ucp_agent_identity_hash text,
  ucp_agent_public_key jsonb,
  ucp_identity_operation_id text,
  ucp_identity_operation_started_at timestamptz,
  paid_at timestamptz,
  creative_status text NOT NULL DEFAULT 'locked',
  inventory_held_at timestamptz,
  expired_at timestamptz,
  recycled_at timestamptz,
  lifecycle_reason text,
  creative_deadline_warning_status text NOT NULL DEFAULT 'pending',
  creative_deadline_warning_error text,
  creative_deadline_warning_attempted_at timestamptz,
  creative_deadline_warning_delivered_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS splash_ad_reservations_email ON splash_ad_reservations (email);
CREATE INDEX IF NOT EXISTS splash_ad_reservations_status ON splash_ad_reservations (status);
CREATE INDEX IF NOT EXISTS splash_ad_reservations_follow_up ON splash_ad_reservations (follow_up_by);
CREATE INDEX IF NOT EXISTS splash_ad_reservations_lifecycle ON splash_ad_reservations (offer_key, status, inventory_held_at);
CREATE INDEX IF NOT EXISTS splash_ad_reservations_creative_warning ON splash_ad_reservations (creative_deadline_warning_status, paid_at);
CREATE UNIQUE INDEX IF NOT EXISTS splash_ad_reservations_activation_token ON splash_ad_reservations (activation_token);
CREATE UNIQUE INDEX IF NOT EXISTS splash_ad_reservations_checkout_session ON splash_ad_reservations (stripe_checkout_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS splash_ad_reservations_public_idempotency ON splash_ad_reservations (public_idempotency_key);

ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS offer_key text NOT NULL DEFAULT 'reserve-490';
ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'interest_captured';
ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
