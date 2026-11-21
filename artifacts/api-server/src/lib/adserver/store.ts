/**
 * Ad system persistence (Postgres). Production uses the public schema; every other runtime uses the ads_preview schema
 * in the same database, so preview QA never touches production delivery, ledgers or statements.
 * All DDL is additive (CREATE ... IF NOT EXISTS). Aggregate reporting only: no visitor-level rows leave this module.
 */
import { AD_DEFAULTS, AD_SLOTS, findSlot, setContractHubs, type ContractHub, type Placement } from "./config";
import type { Campaign, CampaignStatus, Pricing } from "./engine";

export type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };

let poolOverride: Queryable | null = null;
let schemaOverride: string | null = null;
export function setAdPoolForTests(p: Queryable | null, schema: string | null = null): void {
  poolOverride = p;
  schemaOverride = schema;
  ready = null;
  invAt = 0;
}

const isProductionRuntime = () => process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production" && process.env.ADS_STORE === "public");
export const adSchema = () => schemaOverride ?? (isProductionRuntime() ? "public" : "ads_preview");

async function pool(): Promise<Queryable> {
  if (poolOverride) return poolOverride;
  return (await import("@workspace/db")).pool as unknown as Queryable;
}

export const S = () => adSchema();
const DDL = (s: string) => [
  `CREATE SCHEMA IF NOT EXISTS ${s}`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_email text NOT NULL, brand text NOT NULL, category text,
    order_ref text, order_kind text, currency text NOT NULL DEFAULT 'usd', budget_micros bigint NOT NULL DEFAULT 0,
    spent_micros bigint NOT NULL DEFAULT 0, pricing text NOT NULL DEFAULT 'cpm', primary_placement text NOT NULL DEFAULT 'post_purchase',
    hubs text[] NOT NULL DEFAULT '{}', allow_substitute boolean NOT NULL DEFAULT true, rate_multiplier_bps integer NOT NULL DEFAULT 10000,
    flight_start timestamptz, flight_end timestamptz, status text NOT NULL DEFAULT 'draft', click_url text,
    freq_cap_per_day integer NOT NULL DEFAULT ${AD_DEFAULTS.freqCapPerDay}, click_window_days integer NOT NULL DEFAULT ${AD_DEFAULTS.clickWindowDays},
    view_window_days integer NOT NULL DEFAULT ${AD_DEFAULTS.viewWindowDays}, exclusive boolean NOT NULL DEFAULT false,
    is_test boolean NOT NULL DEFAULT false, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ad_campaigns_order_ref ON ${s}.ad_campaigns (order_ref) WHERE order_ref IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS ad_campaigns_email ON ${s}.ad_campaigns (account_email)`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_creatives (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id uuid NOT NULL, mime text NOT NULL, width integer NOT NULL, height integer NOT NULL,
    bytes integer NOT NULL, data bytea NOT NULL, alt text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending',
    uploaded_by text, reviewed_by text, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS ad_creatives_campaign ON ${s}.ad_creatives (campaign_id)`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_events (
    id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), kind text NOT NULL, campaign_id uuid, creative_id uuid,
    slot_key text, hub text, placement text, eligibility text, cost_micros bigint NOT NULL DEFAULT 0, currency text,
    vid_hash text, dedupe_key text, click_id text, value_micros bigint, attributed_via text, is_test boolean NOT NULL DEFAULT false)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ad_events_dedupe ON ${s}.ad_events (dedupe_key)`,
  `CREATE INDEX IF NOT EXISTS ad_events_campaign_at ON ${s}.ad_events (campaign_id, at)`,
  `CREATE INDEX IF NOT EXISTS ad_events_click ON ${s}.ad_events (click_id) WHERE click_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS ad_events_freq ON ${s}.ad_events (vid_hash, campaign_id) WHERE vid_hash IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_ledger (
    id bigserial PRIMARY KEY, campaign_id uuid NOT NULL, at timestamptz NOT NULL DEFAULT now(), kind text NOT NULL,
    bucket text, slot_key text, partner text, units integer NOT NULL DEFAULT 0, amount_micros bigint NOT NULL, currency text NOT NULL,
    note text, actor text, is_test boolean NOT NULL DEFAULT false)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ad_ledger_bucket ON ${s}.ad_ledger (bucket)`,
  `CREATE INDEX IF NOT EXISTS ad_ledger_campaign ON ${s}.ad_ledger (campaign_id, at)`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_partners (partner text PRIMARY KEY, share_bps integer, updated_by text, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_payouts (
    partner text NOT NULL, month text NOT NULL, currency text NOT NULL, gross_micros bigint NOT NULL, share_bps integer NOT NULL,
    payable_micros bigint NOT NULL, status text NOT NULL DEFAULT 'approved', approved_by text, approved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (partner, month, currency))`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_alert_prefs (email text PRIMARY KEY, categories text[] NOT NULL DEFAULT '{}', opted_in boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_promo_codes (
    code_key text PRIMARY KEY, code text NOT NULL, aliases text[] NOT NULL DEFAULT '{}', credit_micros bigint NOT NULL, currency text NOT NULL DEFAULT 'usd',
    max_redemptions integer, active boolean NOT NULL DEFAULT true, expires_at timestamptz, created_by text, notes text, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_promo_redemptions (
    id bigserial PRIMARY KEY, code_key text NOT NULL, email text NOT NULL, domain_key text, company text, site text NOT NULL DEFAULT 'birch', st text, src text,
    session_id text, campaign_id uuid, credit_micros bigint NOT NULL, status text NOT NULL DEFAULT 'pending', is_test boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ad_promo_red_email ON ${s}.ad_promo_redemptions (code_key, email) WHERE status <> 'void'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ad_promo_red_domain ON ${s}.ad_promo_redemptions (code_key, domain_key) WHERE domain_key IS NOT NULL AND status <> 'void'`,
  `CREATE INDEX IF NOT EXISTS ad_promo_red_session ON ${s}.ad_promo_redemptions (session_id) WHERE session_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_street_members (id text PRIMARY KEY, label text NOT NULL, active boolean NOT NULL DEFAULT true, created_by text, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_street_qrs (
    id bigserial PRIMARY KEY, member text NOT NULL, label text NOT NULL, site text NOT NULL DEFAULT 'birch', url text NOT NULL, created_by text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (member, label))`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_street_events (
    id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), member text NOT NULL, kind text NOT NULL, qr text, site text, ref text,
    amount_cents bigint, currency text, is_test boolean NOT NULL DEFAULT false, dedupe_key text)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ad_street_events_dedupe ON ${s}.ad_street_events (dedupe_key) WHERE dedupe_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS ad_street_events_member ON ${s}.ad_street_events (member, kind)`,
  `INSERT INTO ${s}.ad_promo_codes (code_key, code, aliases, credit_micros, notes, created_by) VALUES
    ('street100','STREET100','{streetteam100,streetteamhundred,streethundred}',100000000,'Street team: $100 USD ad credit handed out by street team members. Ad spend only, no cash value, non-transferable.','seed') ON CONFLICT DO NOTHING`,
  `INSERT INTO ${s}.ad_street_members (id, label, created_by) VALUES ('bridget','Bridget','seed'),('mona','Mona','seed') ON CONFLICT DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_hubs (
    key text PRIMARY KEY, name text NOT NULL, category text NOT NULL DEFAULT '', url text NOT NULL, partner text NOT NULL, contract_ref text NOT NULL,
    status text NOT NULL DEFAULT 'live', is_test boolean NOT NULL DEFAULT false, created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `ALTER TABLE ${s}.ad_creatives ADD COLUMN IF NOT EXISTS review_note text`,
  `ALTER TABLE ${s}.ad_creatives ADD COLUMN IF NOT EXISTS source_ref text`,
  `ALTER TABLE ${s}.ad_payouts ADD COLUMN IF NOT EXISTS paid_ref text`,
  `ALTER TABLE ${s}.ad_payouts ADD COLUMN IF NOT EXISTS paid_by text`,
  `ALTER TABLE ${s}.ad_payouts ADD COLUMN IF NOT EXISTS paid_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS ${s}.ad_audit (id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), actor text, action text NOT NULL, target text, detail text)`,
  `INSERT INTO ${s}.ad_street_qrs (member, label, site, url, created_by) VALUES ('bridget','birch-intake','birch','https://birchreserve.net/intake?code=STREET100&st=bridget&qr=birch-intake','seed'),('bridget','scale-intake','scale','https://scalehealth.ca/intake?code=STREET100&st=bridget&qr=scale-intake','seed'),('mona','birch-intake','birch','https://birchreserve.net/intake?code=STREET100&st=mona&qr=birch-intake','seed'),('mona','scale-intake','scale','https://scalehealth.ca/intake?code=STREET100&st=mona&qr=scale-intake','seed'),('mona','scale-intake-digital','scale','https://scalehealth.ca/intake?code=STREET100&st=mona&qr=scale-intake-digital','seed') ON CONFLICT DO NOTHING`,
  `INSERT INTO ${s}.ad_audit (actor, action, target, detail) SELECT 'seed','street.qr','mona/scale-intake-digital','https://scalehealth.ca/intake?code=STREET100&st=mona&qr=scale-intake-digital (Mona digital Scale intake QR registered)' WHERE NOT EXISTS (SELECT 1 FROM ${s}.ad_audit WHERE action = 'street.qr' AND target = 'mona/scale-intake-digital')`,
];

let ready: Promise<void> | null = null;
export async function db(): Promise<Queryable> {
  const p = await pool();
  ready ??= (async () => {
    for (const stmt of DDL(S())) await p.query(stmt);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  await refreshInventory(p);
  return p;
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const date = (v: unknown) => (v === null || v === undefined ? null : new Date(v as string));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v.startsWith("{") ? v.slice(1, -1).split(",").filter(Boolean) : []);

function toCampaign(r: Record<string, unknown>): Campaign {
  return {
    id: String(r.id), accountEmail: String(r.account_email), brand: String(r.brand), category: (r.category as string) ?? null,
    orderRef: (r.order_ref as string) ?? null, orderKind: (r.order_kind as string) ?? null, currency: r.currency === "cad" ? "cad" : "usd",
    budgetMicros: num(r.budget_micros), spentMicros: num(r.spent_micros), pricing: r.pricing === "cpc" ? "cpc" : "cpm",
    primaryPlacement: String(r.primary_placement) as Placement, hubs: arr(r.hubs), allowSubstitute: Boolean(r.allow_substitute),
    rateMultiplierBps: num(r.rate_multiplier_bps), flightStart: date(r.flight_start), flightEnd: date(r.flight_end),
    status: String(r.status) as CampaignStatus, clickUrl: (r.click_url as string) ?? null, freqCapPerDay: num(r.freq_cap_per_day),
    clickWindowDays: num(r.click_window_days), viewWindowDays: num(r.view_window_days), exclusive: Boolean(r.exclusive),
    isTest: Boolean(r.is_test), notes: (r.notes as string) ?? null, createdAt: new Date(String(r.created_at)),
  };
}

export async function audit(actor: string | null, action: string, target: string | null, detail?: string): Promise<void> {
  try {
    const p = await db();
    await p.query(`INSERT INTO ${S()}.ad_audit (actor, action, target, detail) VALUES ($1,$2,$3,$4)`, [actor, action, target, detail?.slice(0, 2000) ?? null]);
  } catch {
    /* audit never blocks the action */
  }
}

export type NewCampaign = {
  accountEmail: string; brand: string; category?: string | null; orderRef?: string | null; orderKind?: string | null;
  currency?: "usd" | "cad"; budgetMicros: number; pricing?: Pricing; primaryPlacement?: Placement; hubs?: string[];
  allowSubstitute?: boolean; rateMultiplierBps?: number; clickUrl?: string | null; exclusive?: boolean; isTest?: boolean; notes?: string | null; actor?: string | null;
};

/** Idempotent per order_ref: a repeat (webhook retry) returns the existing campaign and adds no second credit. */
export async function createCampaign(n: NewCampaign): Promise<{ campaign: Campaign; created: boolean }> {
  const p = await db();
  if (n.orderRef) {
    const { rows } = await p.query(`SELECT * FROM ${S()}.ad_campaigns WHERE order_ref = $1`, [n.orderRef]);
    if (rows[0]) return { campaign: toCampaign(rows[0]), created: false };
  }
  const { rows } = await p.query(
    `INSERT INTO ${S()}.ad_campaigns (account_email, brand, category, order_ref, order_kind, currency, budget_micros, pricing, primary_placement, hubs,
      allow_substitute, rate_multiplier_bps, click_url, exclusive, is_test, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING RETURNING *`,
    [n.accountEmail.trim().toLowerCase(), n.brand.slice(0, 160), n.category ?? null, n.orderRef ?? null, n.orderKind ?? null, n.currency ?? "usd",
      Math.max(0, Math.round(n.budgetMicros)), n.pricing ?? "cpm", n.primaryPlacement ?? "post_purchase", n.hubs ?? [], n.allowSubstitute ?? true,
      n.rateMultiplierBps ?? 10_000, n.clickUrl ?? null, n.exclusive ?? false, n.isTest ?? false, n.notes ?? null],
  );
  if (!rows[0]) {
    const again = await p.query(`SELECT * FROM ${S()}.ad_campaigns WHERE order_ref = $1`, [n.orderRef]);
    return { campaign: toCampaign(again.rows[0]!), created: false };
  }
  const c = toCampaign(rows[0]);
  await p.query(
    `INSERT INTO ${S()}.ad_ledger (campaign_id, kind, bucket, amount_micros, currency, note, actor, is_test) VALUES ($1,'credit',$2,$3,$4,$5,$6,$7) ON CONFLICT (bucket) DO NOTHING`,
    [c.id, `credit:${c.id}:open`, c.budgetMicros, c.currency, n.orderKind ? `Media credit from ${n.orderKind}${n.orderRef ? ` (${n.orderRef})` : ""}` : "Media credit", n.actor ?? "system", c.isTest],
  );
  await audit(n.actor ?? "system", "campaign.create", c.id, `${c.brand} ${c.budgetMicros}`);
  return { campaign: c, created: true };
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_campaigns WHERE id = $1`, [id]);
  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function listCampaigns(opts: { email?: string; includeTest?: boolean } = {}): Promise<Campaign[]> {
  const p = await db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.email) {
    params.push(opts.email.trim().toLowerCase());
    where.push(`account_email = $${params.length}`);
  }
  if (opts.includeTest === false) where.push("is_test = false");
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_campaigns ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 500`, params);
  return rows.map(toCampaign);
}

export type CampaignPatch = Partial<Pick<Campaign, "status" | "brand" | "category" | "pricing" | "primaryPlacement" | "hubs" | "allowSubstitute" | "rateMultiplierBps" | "flightStart" | "flightEnd" | "clickUrl" | "freqCapPerDay" | "clickWindowDays" | "viewWindowDays" | "exclusive" | "notes">>;
const COLS: Record<keyof CampaignPatch, string> = {
  status: "status", brand: "brand", category: "category", pricing: "pricing", primaryPlacement: "primary_placement", hubs: "hubs",
  allowSubstitute: "allow_substitute", rateMultiplierBps: "rate_multiplier_bps", flightStart: "flight_start", flightEnd: "flight_end",
  clickUrl: "click_url", freqCapPerDay: "freq_cap_per_day", clickWindowDays: "click_window_days", viewWindowDays: "view_window_days",
  exclusive: "exclusive", notes: "notes",
};
export async function updateCampaign(id: string, patch: CampaignPatch, actor: string): Promise<Campaign | null> {
  const p = await db();
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    params.push(v instanceof Date ? v.toISOString() : v);
    sets.push(`${COLS[k as keyof CampaignPatch]} = $${params.length}`);
  }
  if (sets.length === 0) return getCampaign(id);
  params.push(id);
  const { rows } = await p.query(`UPDATE ${S()}.ad_campaigns SET ${sets.join(", ")}, updated_at = now() WHERE id = $${params.length} RETURNING *`, params);
  await audit(actor, "campaign.update", id, JSON.stringify(patch));
  return rows[0] ? toCampaign(rows[0]) : null;
}

/** Top up / adjust credit with a ledger line. Budget can never drop below what is already spent. */
export async function adjustBudget(id: string, deltaMicros: number, note: string, actor: string): Promise<Campaign | null> {
  const p = await db();
  const { rows } = await p.query(
    `UPDATE ${S()}.ad_campaigns SET budget_micros = budget_micros + $2, updated_at = now() WHERE id = $1 AND budget_micros + $2 >= spent_micros RETURNING *`,
    [id, Math.round(deltaMicros)],
  );
  if (!rows[0]) return null;
  const c = toCampaign(rows[0]);
  await p.query(`INSERT INTO ${S()}.ad_ledger (campaign_id, kind, amount_micros, currency, note, actor, is_test) VALUES ($1,'adjust',$2,$3,$4,$5,$6)`, [id, Math.round(deltaMicros), c.currency, note.slice(0, 300), actor, c.isTest]);
  await audit(actor, "campaign.budget", id, `${deltaMicros} ${note}`);
  return c;
}

/* --------------------------------------------------------------------------------------------- creatives */
export type Creative = { id: string; campaignId: string; mime: string; width: number; height: number; bytes: number; alt: string; status: "pending" | "approved" | "rejected"; uploadedBy: string | null; createdAt: Date; reviewNote?: string | null; sourceRef?: string | null };
const toCreative = (r: Record<string, unknown>): Creative => ({
  id: String(r.id), campaignId: String(r.campaign_id), mime: String(r.mime), width: num(r.width), height: num(r.height), bytes: num(r.bytes),
  alt: String(r.alt ?? ""), status: String(r.status) as Creative["status"], uploadedBy: (r.uploaded_by as string) ?? null, createdAt: new Date(String(r.created_at)),
  reviewNote: (r.review_note as string) ?? null, sourceRef: (r.source_ref as string) ?? null,
});

export async function addCreative(c: { campaignId: string; mime: string; width: number; height: number; data: Buffer; alt: string; uploadedBy: string; status?: Creative["status"]; sourceRef?: string | null }): Promise<Creative> {
  const p = await db();
  const { rows } = await p.query(
    `INSERT INTO ${S()}.ad_creatives (campaign_id, mime, width, height, bytes, data, alt, status, uploaded_by, source_ref) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, campaign_id, mime, width, height, bytes, alt, status, uploaded_by, created_at, review_note, source_ref`,
    [c.campaignId, c.mime, c.width, c.height, c.data.length, c.data, c.alt.slice(0, 200), c.status ?? "pending", c.uploadedBy, c.sourceRef ?? null],
  );
  await audit(c.uploadedBy, "creative.add", String(rows[0]!.id), c.campaignId);
  return toCreative(rows[0]!);
}

export async function listCreatives(opts: { campaignId?: string; status?: Creative["status"] } = {}): Promise<Creative[]> {
  const p = await db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.campaignId) {
    params.push(opts.campaignId);
    where.push(`campaign_id = $${params.length}`);
  }
  if (opts.status) {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }
  const { rows } = await p.query(`SELECT id, campaign_id, mime, width, height, bytes, alt, status, uploaded_by, created_at, review_note, source_ref FROM ${S()}.ad_creatives ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 500`, params);
  return rows.map(toCreative);
}

export async function creativeData(id: string): Promise<{ mime: string; data: Buffer; status: string; campaignId: string; accountEmail: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const p = await db();
  const { rows } = await p.query(`SELECT cr.mime, cr.data, cr.status, cr.campaign_id, c.account_email FROM ${S()}.ad_creatives cr JOIN ${S()}.ad_campaigns c ON c.id = cr.campaign_id WHERE cr.id = $1`, [id]);
  const r = rows[0];
  if (!r) return null;
  const raw = r.data as Buffer | Uint8Array;
  return { mime: String(r.mime), data: Buffer.from(raw), status: String(r.status), campaignId: String(r.campaign_id), accountEmail: String(r.account_email) };
}

export async function setCreativeStatus(id: string, status: Creative["status"], actor: string, note: string | null = null): Promise<boolean> {
  const p = await db();
  const { rows } = await p.query(`UPDATE ${S()}.ad_creatives SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4 WHERE id = $1 RETURNING id`, [id, status, actor, note]);
  await audit(actor, `creative.${status}`, id, note ?? undefined);
  return rows.length > 0;
}

/* --------------------------------------------------------------------------------------------- serving */
/** Active campaigns with their approved creatives (decisioning input). */
export async function servableCandidates(now = new Date()): Promise<Array<{ campaign: Campaign; creativeIds: string[] }>> {
  const p = await db();
  const { rows } = await p.query(
    `SELECT c.*, COALESCE(array_agg(cr.id::text) FILTER (WHERE cr.id IS NOT NULL), '{}') AS creative_ids
       FROM ${S()}.ad_campaigns c LEFT JOIN ${S()}.ad_creatives cr ON cr.campaign_id = c.id AND cr.status = 'approved'
      WHERE c.status = 'active' AND c.flight_start <= $1 AND c.flight_end > $1 AND c.spent_micros < c.budget_micros
      GROUP BY c.id`,
    [now.toISOString()],
  );
  return rows.map((r) => ({ campaign: toCampaign(r), creativeIds: arr(r.creative_ids) }));
}

export async function viewsTodayFor(vidHash: string, campaignIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!vidHash || campaignIds.length === 0) return out;
  const p = await db();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { rows } = await p.query(
    `SELECT campaign_id::text AS id, count(*)::int AS n FROM ${S()}.ad_events WHERE vid_hash = $1 AND kind = 'view' AND at >= $2 AND campaign_id = ANY($3::uuid[]) GROUP BY campaign_id`,
    [vidHash, since.toISOString(), campaignIds],
  );
  for (const r of rows) out.set(String(r.id), num(r.n));
  return out;
}

export type AdEvent = {
  kind: "serve" | "view" | "click" | "conv"; campaignId: string; creativeId?: string | null; slotKey?: string | null; eligibility?: string | null;
  vidHash?: string | null; dedupeKey?: string | null; clickId?: string | null; valueMicros?: number | null; currency?: string | null;
  attributedVia?: string | null; isTest: boolean; at?: Date;
};

/** Insert one event. Returns its id, or null when the dedupe key was already used (a repeat beacon or click). */
export async function insertEvent(e: AdEvent): Promise<number | null> {
  const p = await db();
  const slot = e.slotKey ? findSlot(e.slotKey) : null;
  const { rows } = await p.query(
    `INSERT INTO ${S()}.ad_events (at, kind, campaign_id, creative_id, slot_key, hub, placement, eligibility, vid_hash, dedupe_key, click_id, value_micros, currency, attributed_via, is_test)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
    [(e.at ?? new Date()).toISOString(), e.kind, e.campaignId, e.creativeId ?? null, e.slotKey ?? null, slot?.hub ?? null, slot?.placement ?? null, e.eligibility ?? null,
      e.vidHash ?? null, e.dedupeKey ?? null, e.clickId ?? null, e.valueMicros ?? null, e.currency ?? null, e.attributedVia ?? null, e.isTest],
  );
  return rows[0] ? num(rows[0].id) : null;
}

/**
 * Charge one billable event. Atomic: succeeds only while spent + cost stays within the budget (never overspends).
 * On success the event row gets its cost and the hourly ledger line for that slot is incremented.
 */
export async function chargeEvent(eventId: number, c: Campaign, slotKey: string, costMicros: number, at = new Date()): Promise<boolean> {
  if (costMicros <= 0) return false;
  const p = await db();
  const { rows } = await p.query(
    `UPDATE ${S()}.ad_campaigns SET spent_micros = spent_micros + $2, updated_at = now() WHERE id = $1 AND spent_micros + $2 <= budget_micros RETURNING spent_micros, budget_micros`,
    [c.id, costMicros],
  );
  if (!rows[0]) return false;
  await p.query(`UPDATE ${S()}.ad_events SET cost_micros = $2 WHERE id = $1`, [eventId, costMicros]);
  const hour = new Date(at);
  hour.setUTCMinutes(0, 0, 0);
  const slot = findSlot(slotKey);
  await p.query(
    `INSERT INTO ${S()}.ad_ledger AS l (campaign_id, at, kind, bucket, slot_key, partner, units, amount_micros, currency, note, actor, is_test)
     VALUES ($1,$2,'charge',$3,$4,$5,1,$6,$7,$8,'engine',$9)
     ON CONFLICT (bucket) DO UPDATE SET units = l.units + 1, amount_micros = l.amount_micros + EXCLUDED.amount_micros`,
    [c.id, hour.toISOString(), `charge:${c.id}:${hour.toISOString()}:${slotKey}:${c.pricing}`, slotKey, slot?.partner ?? null, -costMicros, c.currency,
      `${c.pricing === "cpm" ? "Viewable impressions" : "Clicks"} on ${slot?.label ?? slotKey} (hourly)`, c.isTest],
  );
  // Fully spent: close the campaign so it stops being a candidate.
  if (num(rows[0].spent_micros) >= num(rows[0].budget_micros)) {
    await p.query(`UPDATE ${S()}.ad_campaigns SET status = 'completed', updated_at = now() WHERE id = $1 AND status = 'active'`, [c.id]);
  }
  return true;
}

export async function findClick(clickId: string): Promise<{ campaignId: string; at: Date; slotKey: string | null; isTest: boolean } | null> {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(clickId)) return null;
  const p = await db();
  const { rows } = await p.query(`SELECT campaign_id, at, slot_key, is_test FROM ${S()}.ad_events WHERE click_id = $1 AND kind = 'click' ORDER BY at DESC LIMIT 1`, [clickId]);
  const r = rows[0];
  return r ? { campaignId: String(r.campaign_id), at: new Date(String(r.at)), slotKey: (r.slot_key as string) ?? null, isTest: Boolean(r.is_test) } : null;
}

export async function findViews(dedupeKeys: string[]): Promise<Array<{ campaignId: string; at: Date; slotKey: string | null; isTest: boolean }>> {
  if (dedupeKeys.length === 0) return [];
  const p = await db();
  const { rows } = await p.query(`SELECT campaign_id, at, slot_key, is_test FROM ${S()}.ad_events WHERE kind = 'view' AND dedupe_key = ANY($1::text[]) ORDER BY at DESC`, [dedupeKeys]);
  return rows.map((r) => ({ campaignId: String(r.campaign_id), at: new Date(String(r.at)), slotKey: (r.slot_key as string) ?? null, isTest: Boolean(r.is_test) }));
}

/* --------------------------------------------------------------------------------------------- reporting (aggregate only) */
export type Totals = { serves: number; views: number; clicks: number; convs: number; convValueMicros: number; spendMicros: number };
const emptyTotals = (): Totals => ({ serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 });
function fold(rows: Array<Record<string, unknown>>, key: (r: Record<string, unknown>) => string): Map<string, Totals> {
  const m = new Map<string, Totals>();
  for (const r of rows) {
    const k = key(r);
    const t = m.get(k) ?? emptyTotals();
    const n = num(r.n);
    if (r.kind === "serve") t.serves += n;
    if (r.kind === "view") t.views += n;
    if (r.kind === "click") t.clicks += n;
    if (r.kind === "conv") {
      t.convs += n;
      t.convValueMicros += num(r.v);
    }
    t.spendMicros += num(r.cost);
    m.set(k, t);
  }
  return m;
}

export async function totalsByCampaign(ids: string[] | "all", sinceDays = 400): Promise<Map<string, Totals>> {
  const p = await db();
  const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
  const { rows } = await p.query(
    `SELECT campaign_id::text AS c, kind, count(*)::int AS n, COALESCE(sum(cost_micros),0)::bigint AS cost, COALESCE(sum(value_micros),0)::bigint AS v
       FROM ${S()}.ad_events WHERE at >= $1 ${ids === "all" ? "" : "AND campaign_id = ANY($2::uuid[])"} GROUP BY campaign_id, kind`,
    ids === "all" ? [since] : [since, ids],
  );
  return fold(rows, (r) => String(r.c));
}

export async function dailyFor(ids: string[], days = 30): Promise<Array<{ day: string } & Totals>> {
  if (ids.length === 0) return [];
  const p = await db();
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { rows } = await p.query(
    `SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS d, kind, count(*)::int AS n, COALESCE(sum(cost_micros),0)::bigint AS cost, COALESCE(sum(value_micros),0)::bigint AS v
       FROM ${S()}.ad_events WHERE at >= $1 AND campaign_id = ANY($2::uuid[]) GROUP BY 1, kind ORDER BY 1`,
    [since, ids],
  );
  const m = fold(rows, (r) => String(r.d));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, t]) => ({ day, ...t }));
}

export async function bySlotFor(ids: string[] | "all", days = 30, includeTest = true): Promise<Map<string, Totals>> {
  const p = await db();
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const params: unknown[] = [since];
  let filter = "";
  if (ids !== "all") {
    params.push(ids);
    filter += ` AND campaign_id = ANY($${params.length}::uuid[])`;
  }
  if (!includeTest) filter += " AND is_test = false";
  const { rows } = await p.query(
    `SELECT COALESCE(slot_key,'-') AS s, kind, count(*)::int AS n, COALESCE(sum(cost_micros),0)::bigint AS cost, COALESCE(sum(value_micros),0)::bigint AS v
       FROM ${S()}.ad_events WHERE at >= $1 ${filter} GROUP BY 1, kind`,
    params,
  );
  return fold(rows, (r) => String(r.s));
}

export type LedgerLine = { id: number; campaignId: string; at: Date; kind: string; slotKey: string | null; partner: string | null; units: number; amountMicros: number; currency: string; note: string | null; actor: string | null; isTest: boolean };
export async function ledger(opts: { campaignId?: string; limit?: number } = {}): Promise<LedgerLine[]> {
  const p = await db();
  const params: unknown[] = [];
  let where = "";
  if (opts.campaignId) {
    params.push(opts.campaignId);
    where = `WHERE campaign_id = $1`;
  }
  params.push(opts.limit ?? 500);
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_ledger ${where} ORDER BY at DESC, id DESC LIMIT $${params.length}`, params);
  return rows.map((r) => ({
    id: num(r.id), campaignId: String(r.campaign_id), at: new Date(String(r.at)), kind: String(r.kind), slotKey: (r.slot_key as string) ?? null,
    partner: (r.partner as string) ?? null, units: num(r.units), amountMicros: num(r.amount_micros), currency: String(r.currency), note: (r.note as string) ?? null,
    actor: (r.actor as string) ?? null, isTest: Boolean(r.is_test),
  }));
}

/* --------------------------------------------------------------------------------------------- royalties */
export type RoyaltyRow = { isTest?: boolean; paidRef?: string | null; paidAt?: Date | null; paidBy?: string | null; partner: string; month: string; currency: string; grossMicros: number; units: number; shareBps: number | null; payableMicros: number | null; status: "calculated" | "approved" | "paid"; approvedBy: string | null; approvedAt: Date | null };

/** Per hub partner and month, from delivered (charged) spend on that partner's slots. Test campaigns excluded. */
export async function royalties(months = 6, opts: { testOnly?: boolean } = {}): Promise<RoyaltyRow[]> {
  const p = await db();
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  const [{ rows }, shares, approved] = await Promise.all([
    p.query(
      `SELECT partner, to_char(date_trunc('month', at), 'YYYY-MM') AS m, currency, (-sum(amount_micros))::bigint AS gross, sum(units)::int AS u
         FROM ${S()}.ad_ledger WHERE kind = 'charge' AND is_test = ${opts.testOnly ? "true" : "false"} AND partner IS NOT NULL AND at >= $1 GROUP BY 1,2,3 ORDER BY 2 DESC, 1`,
      [since.toISOString()],
    ),
    p.query(`SELECT partner, share_bps FROM ${S()}.ad_partners`),
    p.query(`SELECT * FROM ${S()}.ad_payouts`),
  ]);
  const share = new Map(shares.rows.map((r) => [String(r.partner), r.share_bps === null ? null : num(r.share_bps)]));
  const appr = new Map(approved.rows.map((r) => [`${r.partner}|${r.month}|${r.currency}`, r]));
  return rows.map((r) => {
    const key = `${r.partner}|${r.m}|${r.currency}`;
    const a = appr.get(key);
    const bps = a ? num(a.share_bps) : (share.get(String(r.partner)) ?? null);
    const gross = num(r.gross);
    return {
      partner: String(r.partner), month: String(r.m), currency: String(r.currency), grossMicros: gross, units: num(r.u), shareBps: bps,
      payableMicros: bps === null ? null : Math.floor((gross * bps) / 10_000), status: opts.testOnly ? "calculated" : a ? (a.status === "paid" ? "paid" : "approved") : "calculated",
      approvedBy: a && !opts.testOnly ? String(a.approved_by) : null, approvedAt: a && !opts.testOnly ? new Date(String(a.approved_at)) : null,
      isTest: Boolean(opts.testOnly), paidRef: a && !opts.testOnly ? ((a.paid_ref as string) ?? null) : null, paidAt: a && !opts.testOnly && a.paid_at ? new Date(String(a.paid_at)) : null, paidBy: a && !opts.testOnly ? ((a.paid_by as string) ?? null) : null,
    };
  });
}

export async function partnerShares(): Promise<Map<string, number | null>> {
  const p = await db();
  const { rows } = await p.query(`SELECT partner, share_bps FROM ${S()}.ad_partners`);
  return new Map(rows.map((r) => [String(r.partner), r.share_bps === null ? null : num(r.share_bps)]));
}

export async function setPartnerShare(partner: string, bps: number | null, actor: string): Promise<void> {
  const p = await db();
  await p.query(
    `INSERT INTO ${S()}.ad_partners (partner, share_bps, updated_by) VALUES ($1,$2,$3) ON CONFLICT (partner) DO UPDATE SET share_bps = EXCLUDED.share_bps, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [partner, bps, actor],
  );
  await audit(actor, "partner.share", partner, String(bps));
}

/** Approve a statement: freezes gross, share and payable. Records the approval only; no money moves. */
export async function approvePayout(partner: string, month: string, currency: string, actor: string): Promise<RoyaltyRow | null> {
  const rows = await royalties(13);
  const r = rows.find((x) => x.partner === partner && x.month === month && x.currency === currency);
  if (!r || r.shareBps === null || r.payableMicros === null || r.status !== "calculated") return null;
  const p = await db();
  await p.query(
    `INSERT INTO ${S()}.ad_payouts (partner, month, currency, gross_micros, share_bps, payable_micros, approved_by) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
    [partner, month, currency, r.grossMicros, r.shareBps, r.payableMicros, actor],
  );
  await audit(actor, "payout.approve", `${partner}|${month}|${currency}`, String(r.payableMicros));
  return { ...r, status: "approved", approvedBy: actor, approvedAt: new Date() };
}

/* --------------------------------------------------------------------------------------------- alerts */
export async function getAlertPrefs(email: string): Promise<{ categories: string[]; optedIn: boolean }> {
  const p = await db();
  const { rows } = await p.query(`SELECT categories, opted_in FROM ${S()}.ad_alert_prefs WHERE email = $1`, [email.toLowerCase()]);
  return rows[0] ? { categories: arr(rows[0].categories), optedIn: Boolean(rows[0].opted_in) } : { categories: [], optedIn: false };
}
export async function setAlertPrefs(email: string, categories: string[], optedIn: boolean): Promise<void> {
  const p = await db();
  await p.query(
    `INSERT INTO ${S()}.ad_alert_prefs (email, categories, opted_in) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET categories = EXCLUDED.categories, opted_in = EXCLUDED.opted_in, updated_at = now()`,
    [email.toLowerCase(), categories, optedIn],
  );
}
export async function alertSubscribers(): Promise<Array<{ email: string; categories: string[] }>> {
  const p = await db();
  const { rows } = await p.query(`SELECT email, categories FROM ${S()}.ad_alert_prefs WHERE opted_in = true`);
  return rows.map((r) => ({ email: String(r.email), categories: arr(r.categories) }));
}

export async function auditLog(limit = 100): Promise<Array<{ at: Date; actor: string | null; action: string; target: string | null; detail: string | null }>> {
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_audit ORDER BY at DESC LIMIT $1`, [limit]);
  return rows.map((r) => ({ at: new Date(String(r.at)), actor: (r.actor as string) ?? null, action: String(r.action), target: (r.target as string) ?? null, detail: (r.detail as string) ?? null }));
}

/** Remove one test campaign and everything it produced. Refuses anything not flagged is_test. */
export async function purgeTestCampaign(id: string, actor: string): Promise<boolean> {
  const c = await getCampaign(id);
  if (!c || !c.isTest) return false;
  const p = await db();
  await p.query(`DELETE FROM ${S()}.ad_events WHERE campaign_id = $1 AND is_test = true`, [id]);
  await p.query(`DELETE FROM ${S()}.ad_ledger WHERE campaign_id = $1 AND is_test = true`, [id]);
  await p.query(`DELETE FROM ${S()}.ad_creatives WHERE campaign_id = $1`, [id]);
  await p.query(`DELETE FROM ${S()}.ad_campaigns WHERE id = $1 AND is_test = true`, [id]);
  await audit(actor, "campaign.purge_test", id, c.brand);
  return true;
}

export const SLOT_KEYS = AD_SLOTS.map((s) => s.key);

/* --------------------------------------------------------------------------------------------- hub inventory on contract */
let invAt = 0;
const INV_MS = 15_000;
async function refreshInventory(p: Queryable, force = false): Promise<void> {
  if (!force && Date.now() - invAt < INV_MS) return;
  invAt = Date.now();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_hubs ORDER BY created_at`);
  setContractHubs(rows.map(toHub));
}
const toHub = (r: Record<string, unknown>): ContractHub & { createdBy: string | null; createdAt: Date } => ({
  key: String(r.key), name: String(r.name), category: String(r.category ?? ""), url: String(r.url), partner: String(r.partner), contractRef: String(r.contract_ref),
  status: r.status === "paused" ? "paused" : "live", isTest: Boolean(r.is_test), createdBy: (r.created_by as string) ?? null, createdAt: new Date(String(r.created_at)),
});

export async function listContractHubs(): Promise<Array<ReturnType<typeof toHub>>> {
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_hubs ORDER BY created_at DESC`);
  return rows.map(toHub);
}

/** Onboard (or update) a hub on contract: its placements become sellable at card rates. A contract reference is required. */
export async function upsertContractHub(h: ContractHub, actor: string): Promise<void> {
  const p = await db();
  await p.query(
    `INSERT INTO ${S()}.ad_hubs (key, name, category, url, partner, contract_ref, status, is_test, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, url = EXCLUDED.url, partner = EXCLUDED.partner, contract_ref = EXCLUDED.contract_ref, status = EXCLUDED.status, updated_at = now()`,
    [h.key, h.name, h.category, h.url, h.partner, h.contractRef, h.status, h.isTest, actor],
  );
  await refreshInventory(p, true);
  await audit(actor, "hub.onboard", h.key, `${h.name} contract=${h.contractRef} status=${h.status}${h.isTest ? " TEST" : ""}`);
}

export async function setHubStatus(key: string, status: "live" | "paused", actor: string): Promise<boolean> {
  const p = await db();
  const { rows } = await p.query(`UPDATE ${S()}.ad_hubs SET status = $2, updated_at = now() WHERE key = $1 RETURNING key`, [key, status]);
  await refreshInventory(p, true);
  await audit(actor, `hub.${status}`, key);
  return rows.length > 0;
}

/** Remove a QA hub. Refuses real hubs. Test ledger lines on it go with their test campaigns (purgeTestCampaign). */
export async function purgeTestHub(key: string, actor: string): Promise<boolean> {
  const p = await db();
  const { rows } = await p.query(`DELETE FROM ${S()}.ad_hubs WHERE key = $1 AND is_test = true RETURNING key`, [key]);
  await refreshInventory(p, true);
  if (rows.length) await audit(actor, "hub.purge_test", key);
  return rows.length > 0;
}

/* --------------------------------------------------------------------------------------------- manual payouts */
/** Record that an approved statement was paid outside this system (e-transfer, cheque, wire). Records only; no money moves. */
export async function markPayoutPaid(partner: string, month: string, currency: string, ref: string, actor: string): Promise<boolean> {
  const p = await db();
  const { rows } = await p.query(
    `UPDATE ${S()}.ad_payouts SET status = 'paid', paid_ref = $4, paid_by = $5, paid_at = now() WHERE partner = $1 AND month = $2 AND currency = $3 AND status = 'approved' RETURNING partner`,
    [partner, month, currency, ref, actor],
  );
  if (rows.length) await audit(actor, "payout.mark_paid", `${partner}|${month}|${currency}`, ref);
  return rows.length > 0;
}

export async function payoutRows(): Promise<Array<Record<string, unknown>>> {
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_payouts ORDER BY month DESC, partner`);
  return rows;
}
