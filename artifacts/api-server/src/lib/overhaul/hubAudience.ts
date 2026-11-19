/**
 * Hub-reported audience profiles from Friday (Nov 18 2026 preview; docs: friday-crm docs/CUSTOMER_PROFILE.md).
 *
 * Source: Friday's hub inventory feed GET {FRIDAY_TAM_URL}/api/tam/partners (X-TAM-Key) adds an `audience` block
 * to each record whose hub has a matched, non-TEST profile. Labelled "hub-reported": the hub told us, Birch has
 * not audited it.
 *
 * Two modes, server-side flag BIRCH_HUB_AUDIENCE_PUBLIC (default OFF = "private"):
 *   private  pricing, targeting and quote / IO output only (agent JSON quote). Nothing renders on public pages.
 *   summary  additionally, a one-line aggregate summary on public listings and quotes.
 * Randy decides which mode ships. Until then production stays "private".
 *
 * Aggregate only: never submitter names or emails, raw blurbs, FSAs/postal codes on anything public, or anything
 * individual. Hubs without a profile show nothing. Published SKUs and prices never change here.
 */
import { BRAND_HUBS, SURFACES } from "./model";
import { SPEC_ROWS } from "./agencyShowcase";

export const AUDIENCE_LABEL = "hub-reported" as const;
export type AudienceMode = "private" | "summary";

const INCOME_BANDS = ["Under $50K", "$50K–$100K", "$100K–$150K", "$150K–$250K", "$250K+", "Mixed"] as const;
const HIGH_INCOME = new Set(["$100K–$150K", "$150K–$250K", "$250K+"]);
const AGE_BANDS = ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"] as const;

/** The sanitized, aggregate-only view Birch keeps. Everything else in the feed block is dropped. */
export type HubAudience = {
  label: typeof AUDIENCE_LABEL;
  submissions_combined: number | null;
  last_submitted_at: string | null;
  age_bands: string[];
  women_pct: number | null;
  income_band: string;
  /** City or region only (never a postal code / FSA). */
  geography: string;
  /** Kept for targeting; never leaves the server except in admin-only output. */
  fsas: string[];
  interests: string[];
  cross_sell: string[];
  spend: string;
  visit_frequency: string;
  audience_size: { customers: number | null; emails: number | null; followers: number | null };
  channels: string[];
};

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /\+?\d[\d\s().-]{7,}\d/;
/** Canadian FSA / postal code, US ZIP. */
const POSTAL = /\b[ABCEGHJ-NPRSTVXY]\d[A-Z](?:\s?\d[A-Z]\d)?\b|\b\d{5}(?:-\d{4})?\b/i;

function cleanText(v: unknown, max = 60): string {
  const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  if (!s || EMAIL.test(s) || PHONE.test(s)) return "";
  return s;
}
function cleanList(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = cleanText(x, 40);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}
function int(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
}

/** Whitelist + scrub one feed `audience` block. Returns null when it is not a usable hub-reported aggregate. */
export function sanitizeAudience(raw: unknown): HubAudience | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.label !== AUDIENCE_LABEL || a.aggregate_only === false) return null;
  const gender = (a.gender ?? {}) as Record<string, unknown>;
  const size = (a.audience ?? {}) as Record<string, unknown>;
  const geo = cleanText(a.geography, 60);
  const out: HubAudience = {
    label: AUDIENCE_LABEL,
    submissions_combined: int(a.submissions_combined, 0, 1e6),
    last_submitted_at: typeof a.last_submitted_at === "string" ? a.last_submitted_at.slice(0, 30) : null,
    age_bands: cleanList(a.age_bands).filter((b) => (AGE_BANDS as readonly string[]).includes(b)),
    women_pct: int(gender.women_pct, 0, 100),
    income_band: (INCOME_BANDS as readonly string[]).includes(String(a.income_band)) ? String(a.income_band) : "",
    geography: POSTAL.test(geo) ? "" : geo,
    fsas: cleanList(a.fsas, 40).filter((f) => /^[A-Z]\d[A-Z]$/i.test(f)).map((f) => f.toUpperCase()),
    interests: cleanList(a.interests),
    cross_sell: cleanList(a.cross_sell),
    spend: cleanText(a.spend, 40),
    visit_frequency: cleanText(a.visit_frequency, 40),
    audience_size: { customers: int(size.customers, 0, 1e9), emails: int(size.emails, 0, 1e9), followers: int(size.followers, 0, 1e9) },
    channels: cleanList(a.channels, 12),
  };
  const hasAny = out.age_bands.length || out.women_pct != null || out.income_band || out.geography || out.interests.length || out.cross_sell.length;
  return hasAny ? out : null;
}

/** "25–34" + "35–44" → "25–44"; non-contiguous bands → the widest span is not claimed, first run only. */
function ageSpan(bands: string[]): string {
  const idx = AGE_BANDS.map((b, i) => (bands.includes(b) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return "";
  let end = idx[0]!;
  while (idx.includes(end + 1)) end++;
  const lo = AGE_BANDS[idx[0]!]!.split("–")[0]!;
  const hiBand = AGE_BANDS[end]!;
  if (hiBand === "65+") return `${lo === "65+" ? "65" : lo}+`;
  return `${lo}–${hiBand.split("–")[1]}`;
}
function incomeShort(band: string): string {
  if (!band || band === "Mixed") return "";
  if (HIGH_INCOME.has(band)) return `$${band.replace(/^\$/, "").split("–")[0]!.replace("+", "")}+ HHI`;
  return `${band} HHI`;
}

/**
 * The public one-liner (mode "summary" only), e.g.
 * "Mostly women 25–44 · Toronto · $100K+ HHI · also buys sleep, meal kits · hub-reported".
 * Never sizes, FSAs, spend or channels. Null when there is nothing to say.
 */
export function publicSummary(a: HubAudience | null): string | null {
  if (!a) return null;
  const who = a.women_pct == null ? "" : a.women_pct >= 60 ? "Mostly women" : a.women_pct <= 40 ? "Mostly men" : "Women and men";
  const age = ageSpan(a.age_bands);
  const parts = [[who, age].filter(Boolean).join(" ") || (age ? `Ages ${age}` : ""), a.geography, incomeShort(a.income_band)];
  if (a.cross_sell.length) parts.push(`also buys ${a.cross_sell.slice(0, 2).map((c) => c.toLowerCase()).join(", ")}`);
  const body = parts.filter(Boolean);
  return body.length ? [...body, AUDIENCE_LABEL].join(" · ") : null;
}

/** The agent-JSON / quote view: aggregate fields, no FSAs (FSAs stay server-side for targeting). */
export function quoteAudience(a: HubAudience): Omit<HubAudience, "fsas"> & { fsas_on_file: number } {
  const { fsas, ...rest } = a;
  return { ...rest, fsas_on_file: fsas.length };
}

/* ---------------- Pricing: a transparent, capped uplift for IO-priced lines ---------------- */

export const AUDIENCE_PRICING_RULE = {
  appliesTo: "IO-priced display (CPM) and CPC lines only. The $190 USD look, the $490 USD reserve and the published media-kit rates, Test Rail and Category Lock do not change.",
  incomeUpliftPct: 5,
  incomeBands: [...HIGH_INCOME],
  categoryUpliftPct: 5,
  capPct: 10,
  minSubmissions: 1,
  line: "When a hub has a hub-reported profile: +5% if its household income band is $100K or more, +5% if the advertiser's category matches the hub's also-buy or interest categories. Capped at +10%. No profile, no change. Never applied to the $190 / $490 SKUs.",
} as const;

export function audienceUpliftPct(a: HubAudience | null, advertiserCategory?: string): { pct: number; reasons: string[] } {
  if (!a || (a.submissions_combined ?? 0) < AUDIENCE_PRICING_RULE.minSubmissions) return { pct: 0, reasons: [] };
  const reasons: string[] = [];
  let pct = 0;
  if (HIGH_INCOME.has(a.income_band)) {
    pct += AUDIENCE_PRICING_RULE.incomeUpliftPct;
    reasons.push(`hub-reported income band ${a.income_band}`);
  }
  const cat = String(advertiserCategory ?? "").trim().toLowerCase();
  if (cat.length >= 3) {
    const tokens = cat.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    const hit = [...a.cross_sell, ...a.interests].find((c) => tokens.some((t) => c.toLowerCase().includes(t)));
    if (hit) {
      pct += AUDIENCE_PRICING_RULE.categoryUpliftPct;
      reasons.push(`category match: ${hit}`);
    }
  }
  return { pct: Math.min(pct, AUDIENCE_PRICING_RULE.capPct), reasons };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
export function ioRateGuidance(a: HubAudience | null, advertiserCategory?: string) {
  const { pct, reasons } = audienceUpliftPct(a, advertiserCategory);
  return {
    currency: "usd" as const,
    uplift_pct: pct,
    reasons,
    rule: AUDIENCE_PRICING_RULE.line,
    lines: SPEC_ROWS.map((r) => ({
      surface: r.key,
      label: r.label,
      cpm_from_usd: r.cpmFloorUsd,
      cpc_from_usd: r.cpcFloorUsd,
      io_cpm_usd: round2(r.cpmFloorUsd * (1 + pct / 100)),
      io_cpc_usd: round2(r.cpcFloorUsd * (1 + pct / 100)),
    })),
  };
}

/* ---------------- Mode flag ---------------- */

/**
 * BIRCH_HUB_AUDIENCE_PUBLIC=summary turns on public summaries. Anything else (or unset) = private.
 * Off production only (VERCEL_ENV preview/development or a local run), `?audience_mode=summary` forces mode (b)
 * so Randy can review it on a preview. Production ignores the query.
 */
export function audienceMode(env: Record<string, string | undefined>, query?: unknown): AudienceMode {
  if (String(env.BIRCH_HUB_AUDIENCE_PUBLIC ?? "").trim().toLowerCase() === "summary") return "summary";
  const isProd = env.VERCEL_ENV === "production" || (!env.VERCEL_ENV && env.NODE_ENV === "production");
  if (!isProd && String(query ?? "").toLowerCase() === "summary") return "summary";
  return "private";
}

/* ---------------- Feed read (server-side, cached, never throws) ---------------- */

export type FeedRecord = { external_id?: string; name?: string; audience?: unknown };
type Source = () => Promise<FeedRecord[]>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const HUB_FEED_IDS: Record<string, string> = {}; // optional explicit joins: hub key → fri-deal-<id>

async function fetchFeed(): Promise<FeedRecord[]> {
  const key = process.env.FRIDAY_TAM_KEY?.trim();
  if (!key) return [];
  const base = (process.env.FRIDAY_TAM_URL?.trim() || "https://fridayapp.org").replace(/\/$/, "");
  const r = await fetch(`${base}/api/tam/partners`, { headers: { "X-TAM-Key": key, Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
  if (!r.ok) return [];
  const j = (await r.json()) as { records?: FeedRecord[] };
  return Array.isArray(j.records) ? j.records : [];
}

let source: Source = fetchFeed;
let cache: { at: number; map: Map<string, HubAudience> } | null = null;
const TTL_MS = 10 * 60 * 1000;

/** Tests only: swap the feed source (e.g. the EXAMPLE fixture). Never called by the app. */
export function setHubAudienceSourceForTests(fn: Source | null): void {
  source = fn ?? fetchFeed;
  cache = null;
}

/** hub key → sanitized audience, for hubs Birch lists that have a hub-reported profile. */
export async function hubAudiences(now = Date.now()): Promise<Map<string, HubAudience>> {
  if (cache && now - cache.at < TTL_MS) return cache.map;
  const map = new Map<string, HubAudience>();
  try {
    const records = await source();
    for (const hub of BRAND_HUBS) {
      const rec = records.find((r) => (HUB_FEED_IDS[hub.key] && r.external_id === HUB_FEED_IDS[hub.key]) || (r.name && norm(r.name) === norm(hub.name)));
      const a = rec ? sanitizeAudience(rec.audience) : null;
      if (a) map.set(hub.key, a);
    }
  } catch {
    /* feed must never break the site */
  }
  cache = { at: now, map };
  return map;
}

export const SURFACE_KEYS = SURFACES.map((s) => s.key);
