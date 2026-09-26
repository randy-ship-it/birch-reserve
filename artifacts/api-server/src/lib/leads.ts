/**
 * Birch Reserve leads: ONE system of record for every inbound lead (HARD 5:46pm).
 *
 * Every lead source upserts exactly one row in `leads`, keyed deterministically:
 *   chat:<sessionId>   Chat Randy intake (qualify answers) or callback request
 *   voice:<callId>     phone call via POST /api/voice/call-ended
 *   webvoice:<id>      in-browser live voice session (or chat:<sessionId> when the
 *                      voice session started from a chat, so one visitor = one lead)
 *   intake:<uuid>      advertiser follow-up form (advertiser_intakes row)
 *   email:<sha256>     linger email capture (source email_capture), keyed by email hash
 *   checkout:<resId>   paid Stripe checkout (source checkout); re-posts to Friday under the
 *                      matching prior lead's externalId when one exists (meta.friday_external_id)
 *   localbiz:<extId>   Local Biz Bot shared write path (source local_biz); Friday externalId =
 *                      the Local Biz externalId (meta.friday_external_id) for idempotent intake
 *
 * meta (jsonb, 7:21pm): Friday deal metadata (category, hubs, sku, value, paid, ...), merged key-wise.
 *
 * is_test (6:50pm): QA / probe rows are stored but never emailed or pushed to Friday.
 * Attribution (utm_*, referrer, landing_page) is first-touch: set once, never overwritten.
 *
 * The source tables keep the detail (transcripts, raw payloads). This row holds
 * the normalized contact/qualify fields plus the Friday CRM push status.
 *
 * Storage: Postgres via @workspace/db (lazy import so tests never need a DB),
 * with a CREATE TABLE IF NOT EXISTS safety net identical to
 * scripts/sql/2026-09-24-leads-voice-calls.sql. Additive only.
 */
import { logger } from "./logger";
import { applyAdditiveColumns } from "./schemaEnsure";

export type LeadSource = "chat_intake" | "chat_callback" | "voice" | "web_voice" | "advertiser_intake" | "email_capture" | "checkout" | "local_biz";

/** Friday deal metadata carried on the lead (unknown keys are simply absent). */
export type LeadMeta = {
  category?: string;
  hubs?: string;
  sku?: string;
  value?: number;
  paid?: boolean;
  stripe_session_id?: string;
  /** Re-post under this Friday externalId (a paid checkout joins the visitor's prior lead). */
  friday_external_id?: string;
  /** QA only (X-Birch-QA + /api/launch/qa/friday-test-lead): push this is_test lead to Friday once. */
  friday_qa_ok?: boolean;
};
const META_STRING_KEYS = ["category", "hubs", "sku", "stripe_session_id", "friday_external_id"] as const;

/** Keep only well-typed, non-empty keys (never empty strings). */
export function cleanLeadMeta(raw: unknown): LeadMeta {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: LeadMeta = {};
  for (const k of META_STRING_KEYS) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  if (typeof src["value"] === "number" && Number.isFinite(src["value"]) && src["value"] >= 0) out.value = src["value"];
  if (src["paid"] === true) out.paid = true;
  if (src["friday_qa_ok"] === true) out.friday_qa_ok = true;
  return out;
}
export type FridayStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export const LEAD_FIELDS = ["name", "company", "role", "phone", "email", "need", "size", "timing", "pagePath"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

/** First-touch attribution captured by the browser (utm_*, document.referrer, landing page). */
export const ATTRIBUTION_FIELDS = ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent", "referrer", "landingPage"] as const;
export type AttributionField = (typeof ATTRIBUTION_FIELDS)[number];
export type Attribution = Partial<Record<AttributionField, string>>;
const ATTRIBUTION_COLUMN: Record<AttributionField, string> = {
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmTerm: "utm_term",
  utmContent: "utm_content",
  referrer: "referrer",
  landingPage: "landing_page",
};

export type LeadInput = {
  id: string;
  source: LeadSource;
  sourceRef: string;
  now?: Date;
  /** Sticky: once a lead is test traffic it stays test traffic. */
  isTest?: boolean;
  /** Merged key-wise into the stored meta (never erases a known key). */
  meta?: LeadMeta;
} & Partial<Record<LeadField, string | null | undefined>> &
  Partial<Record<AttributionField, string | null | undefined>>;

export type Lead = {
  id: string;
  source: LeadSource;
  sourceRef: string;
  fridayStatus: FridayStatus;
  fridayAttempts: number;
  fridayLastError: string | null;
  fridayContactId: string | null;
  fridayDealId: string | null;
  fridayPushedAt: Date | null;
  fridayAttemptedAt: Date | null;
  isTest: boolean;
  meta: LeadMeta;
  createdAt: Date;
  updatedAt: Date;
} & Record<LeadField, string | null> &
  Record<AttributionField, string | null>;

export type FridayResult =
  | { status: "sent"; contactId: string | null; dealId: string | null }
  | { status: "failed" | "skipped"; error: string };

export interface LeadStore {
  /** Merge-upsert; returns the stored row and whether any lead field changed. */
  upsert(input: LeadInput): Promise<{ lead: Lead; created: boolean; changed: boolean }>;
  get(id: string): Promise<Lead | undefined>;
  /** Atomically claim a Friday push (status → sending, attempts + 1). */
  claimFriday(id: string, now: Date, staleMs: number): Promise<Lead | undefined>;
  /** afterClaim (default true): a lead edited mid-send stays pending so it is re-pushed. */
  markFriday(id: string, result: FridayResult, now: Date, afterClaim?: boolean): Promise<void>;
  listFridayRetryable(opts: { now: Date; retryAfterMs: number; maxAttempts: number; includeSkipped: boolean; limit: number }): Promise<string[]>;
  /** Oldest real (non-test, non-checkout) lead with this email: a paid checkout joins it in Friday. */
  findPriorByEmail(email: string): Promise<Lead | undefined>;
}

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

const FIELD_MAX: Record<LeadField, number> = {
  name: 200,
  company: 200,
  role: 200,
  phone: 60,
  email: 320,
  need: 1000,
  size: 300,
  timing: 300,
  pagePath: 500,
};
const ATTRIBUTION_MAX = 500;

/** Source precedence: a callback request is never downgraded to a plain intake. */
const SOURCE_RANK: Record<LeadSource, number> = {
  advertiser_intake: 0,
  chat_intake: 1,
  chat_callback: 2,
  voice: 2,
  web_voice: 2,
  email_capture: 0,
  local_biz: 0,
  checkout: 3,
};

function clean(field: LeadField, v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, FIELD_MAX[field]) : null;
}

export function emptyLead(input: LeadInput, now: Date): Lead {
  const base = {
    id: input.id,
    source: input.source,
    sourceRef: input.sourceRef,
    fridayStatus: "pending" as FridayStatus,
    fridayAttempts: 0,
    fridayLastError: null,
    fridayContactId: null,
    fridayDealId: null,
    fridayPushedAt: null,
    fridayAttemptedAt: null,
    isTest: false,
    meta: {} as LeadMeta,
    createdAt: now,
    updatedAt: now,
  };
  const fields = Object.fromEntries(LEAD_FIELDS.map((f) => [f, null])) as Record<LeadField, string | null>;
  const attribution = Object.fromEntries(ATTRIBUTION_FIELDS.map((f) => [f, null])) as Record<AttributionField, string | null>;
  return { ...base, ...fields, ...attribution };
}

/** Non-empty incoming values win; empty/missing never erase what we already have. */
export function mergeLead(existing: Lead | undefined, input: LeadInput, now: Date): { lead: Lead; changed: boolean } {
  const base = existing ?? emptyLead(input, now);
  let changed = !existing;
  const next: Lead = { ...base };
  for (const f of LEAD_FIELDS) {
    const v = clean(f, input[f]);
    if (v !== null && v !== base[f]) {
      next[f] = v;
      if (f !== "pagePath") changed = true;
    }
  }
  // First-touch attribution: fill gaps only (never counts as a "change" that re-pushes).
  for (const f of ATTRIBUTION_FIELDS) {
    const raw = input[f];
    const v = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, ATTRIBUTION_MAX) : null;
    if (v !== null && base[f] === null) next[f] = v;
  }
  if (input.isTest && !base.isTest) next.isTest = true;
  // Friday meta: merge known keys (side data, like attribution; not a "change" that re-emails).
  const incomingMeta = cleanLeadMeta(input.meta);
  if (Object.keys(incomingMeta).length) next.meta = { ...base.meta, ...incomingMeta };
  if (SOURCE_RANK[input.source] > SOURCE_RANK[base.source]) {
    next.source = input.source;
    changed = true;
  }
  if (changed) {
    next.updatedAt = now;
    // New info on an already-pushed lead: push again (Friday upserts by externalId).
    // A lead edited mid-send ("sending") also flips back to pending, so markFriday keeps it queued.
    if (existing && base.fridayStatus !== "pending") {
      next.fridayStatus = "pending";
      next.fridayAttempts = base.fridayStatus === "sent" ? 0 : base.fridayAttempts;
    }
  }
  return { lead: next, changed };
}

export function leadMetaEqual(a: LeadMeta, b: LeadMeta): boolean {
  return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
}

/** True when a lead has something a human can follow up on. */
export function leadIsActionable(l: Pick<Lead, "phone" | "email" | "name" | "company">): boolean {
  return Boolean(l.phone || l.email || l.name || l.company);
}

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

export class MemoryLeadStore implements LeadStore {
  rows = new Map<string, Lead>();

  async upsert(input: LeadInput) {
    const now = input.now ?? new Date();
    const existing = this.rows.get(input.id);
    const { lead, changed } = mergeLead(existing, input, now);
    this.rows.set(lead.id, lead);
    return { lead: { ...lead }, created: !existing, changed };
  }

  async get(id: string) {
    const l = this.rows.get(id);
    return l ? { ...l } : undefined;
  }

  async claimFriday(id: string, now: Date, staleMs: number) {
    const l = this.rows.get(id);
    if (!l) return undefined;
    if (l.fridayStatus === "sent") return undefined;
    if (l.fridayStatus === "sending" && l.fridayAttemptedAt && now.getTime() - l.fridayAttemptedAt.getTime() < staleMs) {
      return undefined;
    }
    l.fridayStatus = "sending";
    l.fridayAttempts += 1;
    l.fridayAttemptedAt = now;
    return { ...l };
  }

  async markFriday(id: string, result: FridayResult, now: Date, afterClaim = true) {
    const l = this.rows.get(id);
    if (!l) return;
    // Lead changed while we were sending → leave it pending so the next pass re-pushes.
    const repush = afterClaim && l.fridayStatus === "pending";
    applyFridayResult(l, result, now, repush);
  }

  async listFridayRetryable(opts: { now: Date; retryAfterMs: number; maxAttempts: number; includeSkipped: boolean; limit: number }) {
    const out: string[] = [];
    for (const l of this.rows.values()) {
      if (retryable(l, opts)) out.push(l.id);
      if (out.length >= opts.limit) break;
    }
    return out;
  }

  async findPriorByEmail(email: string) {
    const e = email.trim().toLowerCase();
    let best: Lead | undefined;
    for (const l of this.rows.values()) {
      if (l.isTest || l.source === "checkout" || l.email?.toLowerCase() !== e) continue;
      if (!best || l.createdAt < best.createdAt) best = l;
    }
    return best ? { ...best } : undefined;
  }
}

function applyFridayResult(l: Lead, result: FridayResult, now: Date, repush: boolean): void {
  if (result.status === "sent") {
    l.fridayStatus = repush ? "pending" : "sent";
    l.fridayLastError = null;
    l.fridayContactId = result.contactId ?? l.fridayContactId;
    l.fridayDealId = result.dealId ?? l.fridayDealId;
    l.fridayPushedAt = now;
  } else {
    l.fridayStatus = repush ? "pending" : result.status;
    l.fridayLastError = result.error.slice(0, 300);
  }
}

function retryable(
  l: Lead,
  opts: { now: Date; retryAfterMs: number; maxAttempts: number; includeSkipped: boolean },
): boolean {
  if (!leadIsActionable(l)) return false;
  if (l.isTest) return false;
  const last = l.fridayAttemptedAt?.getTime() ?? 0;
  const aged = opts.now.getTime() - last >= opts.retryAfterMs;
  if (l.fridayStatus === "skipped") return opts.includeSkipped;
  if (l.fridayStatus === "pending") return l.fridayAttempts < opts.maxAttempts && (l.fridayAttempts === 0 || aged);
  if (l.fridayStatus === "failed" || l.fridayStatus === "sending") return l.fridayAttempts < opts.maxAttempts && aged;
  return false;
}

/** Mirrors lib/db/src/schema/leads.ts and scripts/sql/2026-09-24-leads-voice-calls.sql exactly. */
export const LEADS_DDL = [
  `CREATE TABLE IF NOT EXISTS leads (
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
)`,
  `CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at)`,
  `CREATE INDEX IF NOT EXISTS leads_friday_status_idx ON leads (friday_status, updated_at)`,
] as const;

/**
 * 6:50pm hygiene + attribution columns. ADD COLUMN IF NOT EXISTS only (no drops,
 * renames or type changes). Mirrors scripts/sql/2026-09-24-test-hygiene-attribution.sql.
 */
export const LEADS_HYGIENE_DDL = [
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_source text`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_medium text`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_campaign text`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_term text`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS utm_content text`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS referrer text`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS landing_page text`,
  `ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS meta jsonb`,
] as const;

type DbModule = typeof import("@workspace/db");
type RawRow = Record<string, unknown>;

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function str(v: unknown): string | null {
  return v == null ? null : String(v);
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function rowToLead(r: RawRow): Lead {
  return {
    id: String(r["id"]),
    source: String(r["source"]) as LeadSource,
    sourceRef: String(r["source_ref"]),
    name: str(r["name"]),
    company: str(r["company"]),
    role: str(r["role"]),
    phone: str(r["phone"]),
    email: str(r["email"]),
    need: str(r["need"]),
    size: str(r["size"]),
    timing: str(r["timing"]),
    pagePath: str(r["page_path"]),
    fridayStatus: String(r["friday_status"] ?? "pending") as FridayStatus,
    fridayAttempts: Number(r["friday_attempts"] ?? 0),
    fridayLastError: str(r["friday_last_error"]),
    fridayContactId: str(r["friday_contact_id"]),
    fridayDealId: str(r["friday_deal_id"]),
    fridayPushedAt: toDate(r["friday_pushed_at"]),
    fridayAttemptedAt: toDate(r["friday_attempted_at"]),
    isTest: r["is_test"] === true,
    meta: cleanLeadMeta(typeof r["meta"] === "string" ? safeJson(r["meta"]) : r["meta"]),
    utmSource: str(r["utm_source"]),
    utmMedium: str(r["utm_medium"]),
    utmCampaign: str(r["utm_campaign"]),
    utmTerm: str(r["utm_term"]),
    utmContent: str(r["utm_content"]),
    referrer: str(r["referrer"]),
    landingPage: str(r["landing_page"]),
    createdAt: toDate(r["created_at"]) ?? new Date(),
    updatedAt: toDate(r["updated_at"]) ?? new Date(),
  };
}

let dbModPromise: Promise<DbModule> | null = null;
let leadsEnsured = false;

/** Shared lazy DB handle; runs the additive DDL once per process. */
export async function leadsDb(): Promise<DbModule> {
  dbModPromise ??= import("@workspace/db");
  const m = await dbModPromise;
  if (!leadsEnsured) {
    for (const stmt of LEADS_DDL) await m.pool.query(stmt);
    await applyAdditiveColumns(m.pool, LEADS_HYGIENE_DDL);
    leadsEnsured = true;
  }
  return m;
}

export class PgLeadStore implements LeadStore {
  async upsert(input: LeadInput) {
    const m = await leadsDb();
    const now = input.now ?? new Date();
    const client = await m.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM leads WHERE id = $1 FOR UPDATE", [input.id]);
      const existing = found.rows[0] ? rowToLead(found.rows[0] as RawRow) : undefined;
      const { lead, changed } = mergeLead(existing, input, now);
      const sideChanged =
        existing !== undefined &&
        (lead.isTest !== existing.isTest ||
          !leadMetaEqual(lead.meta, existing.meta) ||
          ATTRIBUTION_FIELDS.some((f) => lead[f] !== existing[f]));
      if (changed || !existing) {
        await client.query(
          `INSERT INTO leads (id, source, source_ref, name, company, role, phone, email, need, size, timing,
                              page_path, friday_status, friday_attempts, created_at, updated_at,
                              is_test, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
                              referrer, landing_page, meta)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb)
           ON CONFLICT (id) DO UPDATE SET
             source = EXCLUDED.source, name = EXCLUDED.name, company = EXCLUDED.company,
             role = EXCLUDED.role, phone = EXCLUDED.phone, email = EXCLUDED.email,
             need = EXCLUDED.need, size = EXCLUDED.size, timing = EXCLUDED.timing,
             page_path = EXCLUDED.page_path, friday_status = EXCLUDED.friday_status,
             friday_attempts = EXCLUDED.friday_attempts, updated_at = EXCLUDED.updated_at,
             is_test = leads.is_test OR EXCLUDED.is_test,
             utm_source = COALESCE(leads.utm_source, EXCLUDED.utm_source),
             utm_medium = COALESCE(leads.utm_medium, EXCLUDED.utm_medium),
             utm_campaign = COALESCE(leads.utm_campaign, EXCLUDED.utm_campaign),
             utm_term = COALESCE(leads.utm_term, EXCLUDED.utm_term),
             utm_content = COALESCE(leads.utm_content, EXCLUDED.utm_content),
             referrer = COALESCE(leads.referrer, EXCLUDED.referrer),
             landing_page = COALESCE(leads.landing_page, EXCLUDED.landing_page),
             meta = COALESCE(leads.meta, '{}'::jsonb) || COALESCE(EXCLUDED.meta, '{}'::jsonb)`,
          [
            lead.id, lead.source, lead.sourceRef, lead.name, lead.company, lead.role, lead.phone,
            lead.email, lead.need, lead.size, lead.timing, lead.pagePath, lead.fridayStatus,
            lead.fridayAttempts, lead.createdAt, lead.updatedAt, lead.isTest,
            ...ATTRIBUTION_FIELDS.map((f) => lead[f]),
            Object.keys(lead.meta).length ? JSON.stringify(lead.meta) : null,
          ],
        );
      } else if (lead.pagePath !== existing.pagePath || sideChanged) {
        await client.query(
          `UPDATE leads SET page_path = $2, is_test = is_test OR $3,
                  ${ATTRIBUTION_FIELDS.map((f, i) => `${ATTRIBUTION_COLUMN[f]} = COALESCE(${ATTRIBUTION_COLUMN[f]}, $${i + 4})`).join(", ")},
                  meta = COALESCE(meta, '{}'::jsonb) || COALESCE($${ATTRIBUTION_FIELDS.length + 4}::jsonb, '{}'::jsonb)
            WHERE id = $1`,
          [
            lead.id,
            lead.pagePath,
            lead.isTest,
            ...ATTRIBUTION_FIELDS.map((f) => lead[f]),
            Object.keys(lead.meta).length ? JSON.stringify(lead.meta) : null,
          ],
        );
      }
      await client.query("COMMIT");
      return { lead, created: !existing, changed };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async findPriorByEmail(email: string) {
    const m = await leadsDb();
    const res = await m.pool.query(
      `SELECT * FROM leads WHERE lower(email) = lower($1) AND source <> 'checkout' AND NOT is_test
        ORDER BY created_at LIMIT 1`,
      [email.trim()],
    );
    return res.rows[0] ? rowToLead(res.rows[0] as RawRow) : undefined;
  }

  async get(id: string) {
    const m = await leadsDb();
    const res = await m.pool.query("SELECT * FROM leads WHERE id = $1", [id]);
    return res.rows[0] ? rowToLead(res.rows[0] as RawRow) : undefined;
  }

  async claimFriday(id: string, now: Date, staleMs: number) {
    const m = await leadsDb();
    const res = await m.pool.query(
      `UPDATE leads SET friday_status = 'sending', friday_attempts = friday_attempts + 1, friday_attempted_at = $2
        WHERE id = $1
          AND friday_status <> 'sent'
          AND (friday_status <> 'sending' OR friday_attempted_at IS NULL OR friday_attempted_at <= $3)
        RETURNING *`,
      [id, now, new Date(now.getTime() - staleMs)],
    );
    return res.rows[0] ? rowToLead(res.rows[0] as RawRow) : undefined;
  }

  async markFriday(id: string, result: FridayResult, now: Date, afterClaim = true) {
    const m = await leadsDb();
    // If the lead was edited mid-send (status flipped back to pending), keep it pending.
    if (result.status === "sent") {
      await m.pool.query(
        `UPDATE leads SET friday_status = CASE WHEN $5 AND friday_status = 'pending' THEN 'pending' ELSE 'sent' END,
                friday_last_error = NULL,
                friday_contact_id = COALESCE($2, friday_contact_id),
                friday_deal_id = COALESCE($3, friday_deal_id),
                friday_pushed_at = $4
          WHERE id = $1`,
        [id, result.contactId, result.dealId, now, afterClaim],
      );
    } else {
      await m.pool.query(
        `UPDATE leads SET friday_status = CASE WHEN $4 AND friday_status = 'pending' THEN 'pending' ELSE $2 END,
                friday_last_error = $3
          WHERE id = $1`,
        [id, result.status, result.error.slice(0, 300), afterClaim],
      );
    }
  }

  async listFridayRetryable(opts: { now: Date; retryAfterMs: number; maxAttempts: number; includeSkipped: boolean; limit: number }) {
    const m = await leadsDb();
    const agedBefore = new Date(opts.now.getTime() - opts.retryAfterMs);
    const res = await m.pool.query(
      `SELECT id FROM leads
        WHERE (phone IS NOT NULL OR email IS NOT NULL OR name IS NOT NULL OR company IS NOT NULL)
          AND NOT is_test
          AND updated_at >= $5
          AND (
            ($4 AND friday_status = 'skipped')
            OR (friday_status = 'pending' AND friday_attempts < $2
                AND (friday_attempts = 0 OR friday_attempted_at IS NULL OR friday_attempted_at <= $1))
            OR (friday_status IN ('failed', 'sending') AND friday_attempts < $2
                AND (friday_attempted_at IS NULL OR friday_attempted_at <= $1))
          )
        ORDER BY updated_at
        LIMIT $3`,
      [agedBefore, opts.maxAttempts, opts.limit, opts.includeSkipped, new Date(opts.now.getTime() - 7 * 24 * 60 * 60_000)],
    );
    return (res.rows as RawRow[]).map((r) => String(r["id"]));
  }
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

let leadStore: LeadStore = new PgLeadStore();

export function getLeadStore(): LeadStore {
  return leadStore;
}

export function setLeadStoreForTests(store: LeadStore): void {
  leadStore = store;
}

/** Upsert a lead; never throws (lead capture must not break chat or webhooks). */
export async function upsertLeadSafe(input: LeadInput): Promise<Lead | undefined> {
  try {
    const { lead } = await leadStore.upsert(input);
    return lead;
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : "lead_upsert_failed", lead: input.id, source: input.source },
      "Lead upsert failed",
    );
    return undefined;
  }
}

/** Like upsertLeadSafe, but also reports whether the row was created. Never throws. */
export async function upsertLeadSafeDetailed(input: LeadInput): Promise<{ lead: Lead; created: boolean; changed: boolean } | undefined> {
  try {
    return await leadStore.upsert(input);
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : "lead_upsert_failed", lead: input.id, source: input.source },
      "Lead upsert failed",
    );
    return undefined;
  }
}
