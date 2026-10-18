/**
 * Runtime safety net for the 6:50pm additive columns. Runs an
 * `ALTER TABLE IF EXISTS t ADD COLUMN IF NOT EXISTS c ...` statement only when the
 * column is actually missing, so a warm boot never takes an ALTER lock.
 */
type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

const STMT = /^ALTER TABLE IF EXISTS (\w+) ADD COLUMN IF NOT EXISTS (\w+) /i;

export function parseAdditiveColumn(stmt: string): { table: string; column: string } | null {
  const m = STMT.exec(stmt.trim());
  return m ? { table: m[1]!, column: m[2]! } : null;
}

export async function applyAdditiveColumns(pool: Queryable, stmts: readonly string[]): Promise<number> {
  const byTable = new Map<string, Array<{ column: string; stmt: string }>>();
  for (const stmt of stmts) {
    const p = parseAdditiveColumn(stmt);
    if (!p) throw new Error("applyAdditiveColumns only runs ADD COLUMN IF NOT EXISTS statements");
    byTable.set(p.table, [...(byTable.get(p.table) ?? []), { column: p.column, stmt }]);
  }
  let applied = 0;
  for (const [table, cols] of byTable) {
    const res = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
      [table],
    );
    const have = new Set((res.rows as Array<{ column_name: string }>).map((r) => r.column_name));
    if (have.size === 0) continue; // table not there (yet): nothing to add to
    for (const c of cols) {
      if (have.has(c.column)) continue;
      await pool.query(c.stmt);
      applied += 1;
    }
  }
  return applied;
}

export const SPLASH_HYGIENE_DDL = [
  "ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false",
] as const;

/**
 * Idempotent splash_ad_reservations schema for the seat-count query
 * (`status`, `payment_status`, `offer_key`). Mirrors
 * scripts/sql/2026-10-18-splash-ad-reservations-offer-key.sql and
 * lib/db/src/schema/splash-ad-reservations.ts.
 *
 * CREATE runs only when the table is absent. ALTER runs only when that
 * column is absent, so a warm boot does not take an AccessExclusiveLock.
 * No DROP, RENAME, or rewrite of existing columns.
 */
export const SPLASH_SEAT_CREATE_DDL = [
  `CREATE TABLE IF NOT EXISTS splash_ad_reservations (
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
)`,
  "CREATE INDEX IF NOT EXISTS splash_ad_reservations_email ON splash_ad_reservations (email)",
  "CREATE INDEX IF NOT EXISTS splash_ad_reservations_status ON splash_ad_reservations (status)",
  "CREATE INDEX IF NOT EXISTS splash_ad_reservations_follow_up ON splash_ad_reservations (follow_up_by)",
  "CREATE INDEX IF NOT EXISTS splash_ad_reservations_lifecycle ON splash_ad_reservations (offer_key, status, inventory_held_at)",
  "CREATE INDEX IF NOT EXISTS splash_ad_reservations_creative_warning ON splash_ad_reservations (creative_deadline_warning_status, paid_at)",
  "CREATE UNIQUE INDEX IF NOT EXISTS splash_ad_reservations_activation_token ON splash_ad_reservations (activation_token)",
  "CREATE UNIQUE INDEX IF NOT EXISTS splash_ad_reservations_checkout_session ON splash_ad_reservations (stripe_checkout_session_id)",
  "CREATE UNIQUE INDEX IF NOT EXISTS splash_ad_reservations_public_idempotency ON splash_ad_reservations (public_idempotency_key)",
] as const;

export const SPLASH_OFFER_KEY_DDL =
  "ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS offer_key text NOT NULL DEFAULT 'reserve-490'";

export const SPLASH_SEAT_COLUMN_DDL = [
  SPLASH_OFFER_KEY_DDL,
  "ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'interest_captured'",
  "ALTER TABLE IF EXISTS splash_ad_reservations ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'",
] as const;

const TABLE_PRESENT_SQL =
  "SELECT 1 AS present FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1";
const COLUMN_NAMES_SQL =
  "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1";

export type SplashSeatSchemaResult = "created" | "added_columns" | "ready";

export async function ensureSplashSeatSchema(pool: Queryable): Promise<SplashSeatSchemaResult> {
  const present = await pool.query(TABLE_PRESENT_SQL, ["splash_ad_reservations"]);
  if (present.rows.length === 0) {
    for (const stmt of SPLASH_SEAT_CREATE_DDL) await pool.query(stmt);
    return "created";
  }
  const cols = await pool.query(COLUMN_NAMES_SQL, ["splash_ad_reservations"]);
  const have = new Set((cols.rows as Array<{ column_name: string }>).map((row) => row.column_name));
  let added = 0;
  for (const stmt of SPLASH_SEAT_COLUMN_DDL) {
    const parsed = parseAdditiveColumn(stmt);
    if (!parsed || have.has(parsed.column)) continue;
    await pool.query(stmt);
    added += 1;
  }
  return added > 0 ? "added_columns" : "ready";
}

let splashSeatSchemaReady: Promise<void> | null = null;

/** One successful ensure per process. A failed attempt is retried next call. */
export function ensureSplashSeatSchemaOnce(pool: Queryable): Promise<void> {
  if (!splashSeatSchemaReady) {
    splashSeatSchemaReady = ensureSplashSeatSchema(pool).then(
      () => undefined,
      (error: unknown) => {
        splashSeatSchemaReady = null;
        throw error;
      },
    );
  }
  return splashSeatSchemaReady;
}
