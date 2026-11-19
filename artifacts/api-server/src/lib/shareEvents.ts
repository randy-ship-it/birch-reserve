/**
 * Share + referral tracking (Randy via Emma, Nov 19 2026 8:31 AM ET).
 *
 * POST /v1/share-events  {kind, channel, path, ref?, utm_source?, utm_medium?, utm_campaign?, referrer?, sid?}
 *   kind: "share" (a share tap), "click" (a tracked CTA click toward /intake), "arrival" (a visit that came in on a
 *   tracked link: ?ref=… or utm_*). Server stamps the time. Referrer is reduced to its host.
 * GET /api/sales/share-events  internal only (Clerk sign-in + active sales staff, the same guard as
 *   /sales/advertiser-requests). Counts by channel / kind / page + the latest events.
 *
 * Store: production (VERCEL_ENV=production) writes the share_events Postgres table (created on first use, additive).
 * Every other environment (Vercel previews, local, tests) keeps events in this server instance's memory, so preview
 * QA never writes into the production database. Preview memory resets when the instance recycles.
 */
import { db, shareEventsTable } from "@workspace/db";
import { desc, gte, sql } from "drizzle-orm";

export const SHARE_KINDS = ["share", "click", "arrival"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];
export const SHARE_CHANNELS = ["copy", "email", "sms", "linkedin", "x", "native", "cta", "direct", "other"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export type ShareEvent = {
  kind: ShareKind;
  channel: ShareChannel;
  path: string;
  ref: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
  shareId: string | null;
  createdAt: Date;
};

const KIND_SET = new Set<string>(SHARE_KINDS);
const CHANNEL_SET = new Set<string>(SHARE_CHANNELS);
const ALLOWED = new Set(["kind", "channel", "path", "ref", "utm_source", "utm_medium", "utm_campaign", "referrer", "sid"]);
const PATH_RE = /^\/[A-Za-z0-9._~/-]{0,199}$/;
const TOKEN_RE = /^[A-Za-z0-9._-]{1,64}$/;
const SID_RE = /^[a-z0-9]{6,24}$/;

/** "share_linkedin" → linkedin; placements like "hero_home" → cta. */
export function channelFromRef(ref: string | null): ShareChannel {
  if (!ref) return "direct";
  const m = /^share_([a-z]+)$/.exec(ref);
  if (m && CHANNEL_SET.has(m[1]!)) return m[1] as ShareChannel;
  return "cta";
}

const tok = (v: unknown): string | null | undefined => {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !TOKEN_RE.test(v)) return undefined;
  return v.toLowerCase();
};

export function referrerHost(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  try {
    const h = new URL(v).hostname.toLowerCase();
    return /^[a-z0-9.-]{1,120}$/.test(h) ? h : null;
  } catch {
    return null;
  }
}

export function parseShareEvent(body: unknown, now = new Date()): ShareEvent | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const r = body as Record<string, unknown>;
  if (Object.keys(r).some((k) => !ALLOWED.has(k))) return null;
  if (typeof r.kind !== "string" || !KIND_SET.has(r.kind)) return null;
  if (typeof r.path !== "string" || !PATH_RE.test(r.path)) return null;
  const ref = tok(r.ref);
  const utmSource = tok(r.utm_source);
  const utmMedium = tok(r.utm_medium);
  const utmCampaign = tok(r.utm_campaign);
  if (ref === undefined || utmSource === undefined || utmMedium === undefined || utmCampaign === undefined) return null;
  let channel: ShareChannel;
  if (r.kind === "arrival") channel = ref ? channelFromRef(ref) : utmSource ? "other" : "direct";
  else {
    if (typeof r.channel !== "string" || !CHANNEL_SET.has(r.channel)) return null;
    channel = r.channel as ShareChannel;
  }
  let shareId: string | null = null;
  if (r.sid != null && r.sid !== "") {
    if (typeof r.sid !== "string" || !SID_RE.test(r.sid)) return null;
    shareId = r.sid;
  }
  const path = /^\/kit\/r\//.test(r.path) ? "/kit/r/report" : r.path; // report tokens are never stored
  return { kind: r.kind as ShareKind, channel, path, ref, utmSource, utmMedium, utmCampaign, referrerHost: referrerHost(r.referrer), shareId, createdAt: now };
}

/* ------------------------------------------------------------------ stores */
export type ShareStore = { name: "postgres" | "memory"; add(e: ShareEvent): Promise<void>; list(sinceDays: number, limit: number): Promise<ShareEvent[]> };

const MEMORY_MAX = 5000;
export function memoryStore(): ShareStore {
  const rows: ShareEvent[] = [];
  return {
    name: "memory",
    async add(e) {
      rows.push(e);
      if (rows.length > MEMORY_MAX) rows.splice(0, rows.length - MEMORY_MAX);
    },
    async list(sinceDays, limit) {
      const since = Date.now() - sinceDays * 864e5;
      return rows.filter((r) => r.createdAt.getTime() >= since).slice(-limit).reverse();
    },
  };
}

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  tableReady ??= db
    .execute(sql`CREATE TABLE IF NOT EXISTS share_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL, channel text NOT NULL, path text NOT NULL,
      ref text, utm_source text, utm_medium text, utm_campaign text, referrer_host text, share_id text,
      created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS share_events_created_idx ON share_events (created_at);`)
    .then(() => undefined)
    .catch((e) => {
      tableReady = null;
      throw e;
    });
  return tableReady;
}

export function postgresStore(): ShareStore {
  return {
    name: "postgres",
    async add(e) {
      await ensureTable();
      await db.insert(shareEventsTable).values(e);
    },
    async list(sinceDays, limit) {
      await ensureTable();
      const since = new Date(Date.now() - sinceDays * 864e5);
      const rows = await db.select().from(shareEventsTable).where(gte(shareEventsTable.createdAt, since)).orderBy(desc(shareEventsTable.createdAt)).limit(limit);
      return rows.map((r) => ({ ...r, kind: r.kind as ShareKind, channel: r.channel as ShareChannel }));
    },
  };
}

export const isProductionRuntime = () => process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production" && process.env.SHARE_EVENTS_STORE === "postgres");

let store: ShareStore | null = null;
export function shareStore(): ShareStore {
  store ??= isProductionRuntime() ? postgresStore() : memoryStore();
  return store;
}
export function setShareStoreForTests(s: ShareStore | null): void {
  store = s;
}

/* ------------------------------------------------------------------ summary for the internal view */
export type ShareSummary = {
  store: ShareStore["name"];
  since_days: number;
  totals: Record<ShareKind, number>;
  by_channel: Array<{ channel: string; share: number; click: number; arrival: number }>;
  by_path: Array<{ path: string; share: number; click: number; arrival: number }>;
  by_ref: Array<{ ref: string; arrival: number; click: number }>;
  recent: Array<{ at: string; kind: ShareKind; channel: string; path: string; ref: string | null; utm: string | null; referrer_host: string | null; share_id: string | null }>;
};

export function summarize(rows: ShareEvent[], storeName: ShareStore["name"], sinceDays: number): ShareSummary {
  const totals: Record<ShareKind, number> = { share: 0, click: 0, arrival: 0 };
  const ch = new Map<string, { share: number; click: number; arrival: number }>();
  const pa = new Map<string, { share: number; click: number; arrival: number }>();
  const rf = new Map<string, { arrival: number; click: number }>();
  const bump = <T extends Record<string, number>>(m: Map<string, T>, k: string, init: T, f: keyof T) => {
    const v = m.get(k) ?? { ...init };
    (v[f] as number) += 1;
    m.set(k, v);
  };
  for (const r of rows) {
    totals[r.kind] += 1;
    bump(ch, r.channel, { share: 0, click: 0, arrival: 0 }, r.kind);
    bump(pa, r.path, { share: 0, click: 0, arrival: 0 }, r.kind);
    if (r.ref && r.kind !== "share") bump(rf, r.ref, { arrival: 0, click: 0 }, r.kind);
  }
  const sortBy = <T extends Record<string, number>>(m: Map<string, T>) => [...m.entries()].sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0));
  return {
    store: storeName,
    since_days: sinceDays,
    totals,
    by_channel: sortBy(ch).map(([channel, v]) => ({ channel, ...v })),
    by_path: sortBy(pa).map(([path, v]) => ({ path, ...v })),
    by_ref: sortBy(rf).map(([ref, v]) => ({ ref, ...v })),
    recent: rows.slice(0, 200).map((r) => ({ at: r.createdAt.toISOString(), kind: r.kind, channel: r.channel, path: r.path, ref: r.ref, utm: [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(" / ") || null, referrer_host: r.referrerHost, share_id: r.shareId })),
  };
}

/* ------------------------------------------------------------------ burst limit */
let hits: number[] = [];
export function shareBurstLimited(now = Date.now(), max = 300): boolean {
  hits = hits.filter((h) => now - h < 10_000);
  if (hits.length >= max) return true;
  hits.push(now);
  return false;
}
