/**
 * Birch Reserve ad system (Randy t330u, Nov 21 2026, from Rick Egan's advice): slot inventory, rates and switches.
 *
 * Rates come straight from the public rate card (lib/overhaul/pricing.ts RATE_SURFACES, starter "starting-at" CPM / CPC).
 * A campaign is charged the rate of the slot it actually ran on, times its negotiated multiplier (exclusive = 25% off),
 * so a buyer moved from a premium slot to a cheaper eligible one is always charged the cheaper slot's card rate.
 * Pure module: no Node or DB imports.
 */
import { RATE_SURFACES, type RateSurface } from "../overhaul/pricing";
import { HUBS } from "../sponsorKit";

export type Placement = RateSurface["key"];
export const PLACEMENTS: readonly Placement[] = RATE_SURFACES.map((s) => s.key);

export type AdSlot = {
  key: string; // `${hub}.${placement}`
  hub: string;
  hubName: string;
  hubCategory: string;
  hubUrl: string;
  partner: string; // royalty statement party (the hub partner)
  placement: Placement;
  label: string;
  cpmUsd: number; // rate-card starter CPM (USD)
  cpcUsd: number; // rate-card starter CPC (USD)
  live: boolean; // live hubs serve; queued hubs are listed but never fill
};

const SURFACE = new Map(RATE_SURFACES.map((s) => [s.key, s] as const));

/** Live inventory follows the kit's hub status ("Live inventory"). Everything else is listed, not served. */
export const AD_SLOTS: readonly AdSlot[] = HUBS.flatMap((h) =>
  RATE_SURFACES.map((s) => ({
    key: `${h.key}.${s.key}`,
    hub: h.key,
    hubName: h.name,
    hubCategory: h.category,
    hubUrl: h.url,
    partner: h.name,
    placement: s.key,
    label: `${h.name} · ${s.label}`,
    cpmUsd: s.cpmStarter[0],
    cpcUsd: s.cpcStarter[0],
    live: h.status === "Live inventory",
  })),
);

export const findSlot = (key: unknown): AdSlot | null => (typeof key === "string" ? AD_SLOTS.find((s) => s.key === key) ?? null : null);
export const placementRate = (p: Placement): { cpmUsd: number; cpcUsd: number } => {
  const s = SURFACE.get(p)!;
  return { cpmUsd: s.cpmStarter[0], cpcUsd: s.cpcStarter[0] };
};
export const placementLabel = (p: string): string => SURFACE.get(p as Placement)?.label ?? p;

/** Same CAD ladder every Birch price uses ($190 → $270, $490 → $690). */
export const CAD_PER_USD = 1.4;
export const MICROS = 1_000_000;

/**
 * Credit source rate basis. Promo credit is valued and spent at the regular (card) rate. Paid credit keeps the multiplier it was sold at:
 * card for $190 / $490 / sponsor packs, 25% below card for the exclusive display reserve (service.ts). No end date exists in config,
 * so copy says "current pricing" and never a deadline.
 */
export const PROMO_RATE_BPS = 10_000;
export const EXCLUSIVE_RATE_BPS = 7_500;
export const isPromoCampaign = (c: { orderKind: string | null }): boolean => (c.orderKind ?? "").startsWith("promo ");
export function regularRateSummary(): { cpmLow: number; cpmHigh: number; cpcLow: number; cpcHigh: number; line: string; compare: string } {
  const cpm = RATE_SURFACES.map((s) => s.cpmStarter[0]);
  const cpc = RATE_SURFACES.map((s) => s.cpcStarter[0]);
  const f = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
  const cpmLow = Math.min(...cpm), cpmHigh = Math.max(...cpm), cpcLow = Math.min(...cpc), cpcHigh = Math.max(...cpc);
  const off = Math.round((1 - EXCLUSIVE_RATE_BPS / 10_000) * 100);
  return {
    cpmLow, cpmHigh, cpcLow, cpcHigh,
    line: `Promo credit runs at regular rate-card rates (current pricing: ${f(cpmLow)}–${f(cpmHigh)} CPM or ${f(cpcLow)}–${f(cpcHigh)} CPC depending on the placement).`,
    compare: `Exclusive display packages run ${off}% below regular; $190 looks, $490 reserves and sponsor packs run at the card rate.`,
  };
}

export const AD_DEFAULTS = {
  flightDays: 182, // up to 6 months (SPEND_DOWN_MAX_MONTHS)
  maxFlightDays: 186,
  freqCapPerDay: 6, // viewable impressions per visitor per campaign per day
  clickWindowDays: 7,
  viewWindowDays: 1,
  tokenTtlMs: 60 * 60_000, // a served ad's view / click token is good for 1 hour
  minClickMs: 400, // a click faster than this after serve is not a human
  paceAheadDays: 1, // even pacing may run at most one day ahead of plan
} as const;

/** Viewability: IAB / MRC display standard (50% of pixels in view for 1 continuous second). */
export const VIEWABILITY = { ratio: 0.5, ms: 1000 } as const;

export const BOT_UA =
  /(bot\b|bot\/|crawler|spider|crawl|slurp|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|quora link|python-requests|python-urllib|aiohttp|httpx|\bcurl\/|\bwget\/?|scrapy|go-http-client|libwww-perl|java\/\d|okhttp|node-fetch|axios\/|undici)/i;

export function isBotUa(ua: string | undefined): boolean {
  const v = (ua ?? "").trim();
  if (v.length < 20) return true;
  return BOT_UA.test(v);
}

/** Switches. Ads serve only when ADS_SERVING_ENABLED is not "false" (kill switch). Login emails stay OFF until Randy previews them. */
export const adsServingEnabled = (env: NodeJS.ProcessEnv = process.env) => env.ADS_SERVING_ENABLED !== "false";
export const adsLoginEmailEnabled = (env: NodeJS.ProcessEnv = process.env) => env.ADS_LOGIN_EMAIL_ENABLED === "true";
export const adsAlertEmailEnabled = (env: NodeJS.ProcessEnv = process.env) => env.ADS_HUB_ALERT_EMAIL_ENABLED === "true";

/** Admin allowlist (Randy and Jon). ADS_ADMIN_EMAILS overrides; the key lives in ADS_ADMIN_KEY. */
/** Jon's address is added through ADS_ADMIN_EMAILS once Randy confirms it (not guessed here). */
export const DEFAULT_ADMIN_EMAILS = ["randy@silverbirchgrowth.com", "randy@scalehealth.ca"] as const;
export function adminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.ADS_ADMIN_EMAILS?.trim();
  return (raw ? raw.split(/[,\s]+/) : [...DEFAULT_ADMIN_EMAILS]).map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/** Categories a customer can follow for new-hub alerts (the 8 public categories). */
export const ALERT_CATEGORIES = [
  "Pain relief topicals",
  "Recovery hardware",
  "Nutrition",
  "Sleep",
  "Meal prep",
  "Women’s health",
  "Men’s health",
  "Diagnostics and services",
] as const;
