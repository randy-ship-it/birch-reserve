/**
 * Pure ad decisioning: rate-card charging, even pacing with a hard budget cap, eligibility (primary slot or an
 * equal-or-lower-rate substitute), category exclusivity, frequency caps and the pick. No I/O, so it is unit tested.
 *
 * Pacing: a campaign's allowed spend at time t is budget × min(1, (elapsed + 1 day) / flight). It can run at most one
 * day ahead of an even plan and never past its budget (the store also charges atomically: spent + cost <= budget).
 * Reallocation: a campaign that bought one placement and allows substitutes may also fill any slot on its hubs whose
 * card rate is equal or lower. The pick prefers primary-slot campaigns, then the one furthest behind its even plan,
 * so an under-delivering campaign is moved onto other eligible space automatically.
 */
import { AD_DEFAULTS, CAD_PER_USD, MICROS, isPromoCampaign, placementRate, type AdSlot, type Placement } from "./config";

export type Pricing = "cpm" | "cpc";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export type Campaign = {
  id: string;
  accountEmail: string;
  brand: string;
  category: string | null;
  orderRef: string | null;
  orderKind: string | null;
  /** Who sold it: Birch Reserve (reseller channel) or Scale Health direct (its own proprietary ads). Same rig, one ledger. */
  seller?: "birch" | "scale";
  /** Birch only runs it internally as cost accounting (Randy 2:45 PM): its own, lower override rate. */
  internal?: boolean;
  /** Street-team / partner member whose link or QR brought this order in (30-day last click), its QR label and the site it was bought on. */
  referrer?: string | null;
  referrerQr?: string | null;
  referrerSite?: string | null;
  currency: "usd" | "cad";
  budgetMicros: number;
  spentMicros: number;
  pricing: Pricing;
  primaryPlacement: Placement;
  hubs: string[]; // empty = every live hub
  allowSubstitute: boolean;
  rateMultiplierBps: number; // 10000 = card rate; 7500 = 25% below card (exclusive)
  flightStart: Date | null;
  flightEnd: Date | null;
  status: CampaignStatus;
  clickUrl: string | null;
  freqCapPerDay: number;
  clickWindowDays: number;
  viewWindowDays: number;
  exclusive: boolean;
  isTest: boolean;
  notes: string | null;
  createdAt: Date;
};

export type Eligibility = "primary" | "substitute" | null;

const fx = (c: Pick<Campaign, "currency">) => (c.currency === "cad" ? CAD_PER_USD : 1);

/** Cost of one billable event in the campaign's currency (micros). CPM bills viewable impressions; CPC bills clicks. */
export function eventCostMicros(c: Pick<Campaign, "pricing" | "rateMultiplierBps" | "currency">, slot: Pick<AdSlot, "cpmUsd" | "cpcUsd">, kind: "view" | "click"): number {
  const mult = c.rateMultiplierBps / 10_000;
  if (c.pricing === "cpm" && kind === "view") return Math.round((slot.cpmUsd / 1000) * mult * fx(c) * MICROS);
  if (c.pricing === "cpc" && kind === "click") return Math.round(slot.cpcUsd * mult * fx(c) * MICROS);
  return 0;
}

export function eligibility(c: Campaign, slot: AdSlot): Eligibility {
  if (!slot.live) return null;
  if (slot.test && !c.isTest) return null; // QA hubs never carry real buyers
  // Marketing/intake pages: only campaigns that name the page explicitly, never by auto-move.
  if (slot.kind === "marketing") return c.hubs.includes(slot.hub) ? "primary" : null;
  if (c.hubs.length > 0 && !c.hubs.includes(slot.hub)) return null;
  if (slot.placement === c.primaryPlacement) return "primary";
  if (!c.allowSubstitute) return null;
  const bought = placementRate(c.primaryPlacement);
  const rate = c.pricing === "cpm" ? [slot.cpmUsd, bought.cpmUsd] : [slot.cpcUsd, bought.cpcUsd];
  return rate[0]! <= rate[1]! ? "substitute" : null;
}

export function inFlight(c: Pick<Campaign, "status" | "flightStart" | "flightEnd">, now: number): boolean {
  if (c.status !== "active" || !c.flightStart || !c.flightEnd) return false;
  return now >= c.flightStart.getTime() && now < c.flightEnd.getTime();
}

/** Share of the flight elapsed, 0..1. */
export function flightProgress(c: Pick<Campaign, "flightStart" | "flightEnd">, now: number): number {
  if (!c.flightStart || !c.flightEnd) return 0;
  const len = c.flightEnd.getTime() - c.flightStart.getTime();
  if (len <= 0) return 1;
  return Math.min(1, Math.max(0, (now - c.flightStart.getTime()) / len));
}

/** Spend the even plan allows by `now` (one day ahead at most), capped at the budget. */
export function allowedSpendMicros(c: Campaign, now: number): number {
  if (!c.flightStart || !c.flightEnd) return 0;
  const len = c.flightEnd.getTime() - c.flightStart.getTime();
  if (len <= 0) return c.budgetMicros;
  const ahead = AD_DEFAULTS.paceAheadDays * 864e5;
  const frac = Math.min(1, Math.max(0, (now - c.flightStart.getTime() + ahead) / len));
  return Math.floor(c.budgetMicros * frac);
}

export function canSpend(c: Campaign, costMicros: number, now: number): boolean {
  if (c.spentMicros + costMicros > c.budgetMicros) return false;
  return c.spentMicros + costMicros <= allowedSpendMicros(c, now);
}

/** Spent ÷ even-plan spend so far. 1 = on pace, < 1 behind, > 1 ahead. */
export function paceRatio(c: Campaign, now: number): number {
  const planned = c.budgetMicros * flightProgress(c, now);
  if (planned <= 0) return c.spentMicros > 0 ? 2 : 0;
  return c.spentMicros / planned;
}

export type PacingState = "not_started" | "behind" | "on_pace" | "ahead" | "spent" | "ended" | "draft" | "paused";
export function pacingState(c: Campaign, now: number): PacingState {
  if (c.status === "draft") return "draft";
  if (c.status === "paused") return "paused";
  if (c.budgetMicros > 0 && c.spentMicros >= c.budgetMicros) return "spent";
  if (c.status === "completed" || (c.flightEnd && now >= c.flightEnd.getTime())) return "ended";
  if (!c.flightStart || now < c.flightStart.getTime()) return "not_started";
  const r = paceRatio(c, now);
  if (r < 0.85) return "behind";
  if (r > 1.15) return "ahead";
  return "on_pace";
}

export type Candidate = { campaign: Campaign; creativeIds: string[]; viewsToday?: number };
export type AdPick = { campaign: Campaign; creativeId: string; eligibility: Exclude<Eligibility, null> };

/** Choose what fills `slot`. Returns null for house content. `rand` is injectable for tests. */
export function pickAd(slot: AdSlot, cands: Candidate[], now: number, opts: { test?: boolean; rand?: () => number } = {}): AdPick | null {
  const rand = opts.rand ?? Math.random;
  // A category held by an exclusive campaign on this hub blocks other campaigns in that category.
  const held = new Set(
    cands
      .filter((x) => x.campaign.exclusive && inFlight(x.campaign, now) && x.campaign.category && (x.campaign.hubs.length === 0 || x.campaign.hubs.includes(slot.hub)))
      .map((x) => `${x.campaign.id}|${x.campaign.category!.toLowerCase()}`),
  );
  const heldCats = new Map<string, string>();
  for (const h of held) {
    const [id, cat] = h.split("|") as [string, string];
    heldCats.set(cat, id);
  }
  const pool: Array<{ x: Candidate; el: Exclude<Eligibility, null>; ratio: number }> = [];
  for (const x of cands) {
    const c = x.campaign;
    if (Boolean(opts.test) !== c.isTest) continue; // test campaigns only on test requests, and never the other way round
    if (!inFlight(c, now) || x.creativeIds.length === 0) continue;
    const el = eligibility(c, slot);
    if (!el) continue;
    const holder = c.category ? heldCats.get(c.category.toLowerCase()) : undefined;
    if (holder && holder !== c.id) continue;
    if (x.viewsToday !== undefined && x.viewsToday >= c.freqCapPerDay) continue;
    // Must be able to afford at least one billable event at this slot's rate.
    const unit = Math.max(eventCostMicros(c, slot, "view"), eventCostMicros(c, slot, "click"));
    if (!canSpend(c, unit, now)) continue;
    pool.push({ x, el, ratio: paceRatio(c, now) });
  }
  if (pool.length === 0) return null;
  pool.sort((a, b) => (a.el === b.el ? a.ratio - b.ratio : a.el === "primary" ? -1 : 1));
  // Light rotation among near-equals so two on-pace campaigns share the slot (within 10% pace of the leader).
  const lead = pool[0]!;
  const near = pool.filter((p) => p.el === lead.el && p.ratio - lead.ratio <= 0.1);
  let chosen = near[Math.floor(rand() * near.length)] ?? lead;
  // One buyer with promo credit and paid credit: spend the promo credit first (it runs at regular rates). Never lets promo jump other brands.
  if (!isPromoCampaign(chosen.x.campaign)) {
    const promoFirst = pool.find((p) => p.el === chosen.el && isPromoCampaign(p.x.campaign) && p.x.campaign.accountEmail === chosen.x.campaign.accountEmail);
    if (promoFirst) chosen = promoFirst;
  }
  const ids = chosen.x.creativeIds;
  return { campaign: chosen.x.campaign, creativeId: ids[Math.floor(rand() * ids.length)] ?? ids[0]!, eligibility: chosen.el };
}

/** Append UTMs and the click id to the brand's landing URL. Keeps any UTMs the brand already set. */
export function landingUrl(raw: string, p: { campaignId: string; slot: AdSlot; clickId: string; brand: string }): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "https://birchreserve.net/";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "https://birchreserve.net/";
  const set = (k: string, v: string) => {
    if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  };
  set("utm_source", "birchreserve");
  set("utm_medium", "display");
  set("utm_campaign", `br-${p.campaignId.slice(0, 8)}`);
  set("utm_content", p.slot.key);
  u.searchParams.set("br_click", p.clickId);
  return u.toString();
}

export function money(micros: number, currency: string): string {
  const v = micros / MICROS;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
}
