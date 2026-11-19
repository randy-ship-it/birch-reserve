/**
 * Brand intake + report on birchreserve.net (PREVIEW, Nov 18 2026; Randy via Emma 9:51 PM ET).
 * Birch owns the front end; Friday App keeps the data, API, intake, versions, pipeline and approvals.
 * Pure module shared by the client (relative import) and tests. No Node imports.
 *
 * NO NEW NUMBERS. Every rate, CTR band and view figure is re-used from an existing source:
 *   - CPM / CPC starter ranges: RATE_SURFACES (./pricing), illustrative 2026 planning estimates.
 *   - CTR bands: INTENT_LADDER (./audiences), benchmark ranges, not promises.
 *   - Newsletter: the partner_email slot (../sponsorKit), $30 CPM, views per network median partner.
 *   - Monthly views: the network median partner row (../sponsorKit HUBS, modelled).
 *   - Sell-through: SELL_ASSUMPTION_PCT (./agencyShowcase), Randy's 20% planning assumption.
 *   - Payout share 35% (Randy, Nov 18 2026). Tier breakpoints are NOT set: placeholders only.
 *   - Sponsor SKUs: $190 look, $490 reserve (./agent publicOffers), $3,500 area lock launch price (./model AREA_LOCK).
 *   - Channel tiles: Randy's network figures / targets (Nov 18 2026). They differ from /inventory, which is unchanged.
 * Every projection is an Estimate. Nothing here is a guarantee, a booking or a checkout.
 */
import { RATE_SURFACES, BLENDED, type Range } from "./pricing";
import { INTENT_LADDER, CATEGORY_DEMAND } from "./audiences";
import { SELL_ASSUMPTION_PCT } from "./agencyShowcase";
import { AREA_LOCK, CPC_FLOOR_USD } from "./model";
import { HUBS, SLOTS } from "../sponsorKit";

export const INTAKE_TERMS_VERSION = "birch-intake-preview-2026-11-18";

/* ------------------------------------------------------------------ publisher */

export const PAYOUT = {
  basePct: 35,
  line: "Hubs earn 35% of media revenue, escalating by tier.",
  /** Breakpoints and step-ups are not set yet (Randy to decide). Labels only, no numbers. */
  tiers: [
    { key: "t1", label: "Tier 1", pct: 35 as number | null, breakpoint: null as string | null, placeholder: false },
    { key: "t2", label: "Tier 2", pct: null, breakpoint: null, placeholder: true },
    { key: "t3", label: "Tier 3", pct: null, breakpoint: null, placeholder: true },
  ],
  tiersLabel: "Placeholder tiers",
} as const;

const MEDIAN = HUBS.find((h) => h.key === "jack-health")!.views; // network median partner (modelled)
const rate = (k: (typeof RATE_SURFACES)[number]["key"]) => RATE_SURFACES.find((s) => s.key === k)!;
const ctr = (moment: string): Range => {
  const r = INTENT_LADDER.find((x) => x.moment === moment)!;
  return [r.lo, r.hi];
};
const EMAIL_SLOT = SLOTS.find((s) => s.key === "partner_email")!;

export type PubSurfaceKey = "newsletter" | "social" | "post_purchase" | "home" | "product" | "services" | "member_dashboard";

export type PubSurface = {
  key: PubSurfaceKey;
  label: string;
  where: string;
  /** Modelled monthly views at a network-median hub (null = no figure on file). */
  monthlyViews: number | null;
  cpm: Range | null;
  cpc: Range | null;
  ctr: Range | null;
  source: string;
  defaultOn: boolean;
};

export const PUBLISHER_SURFACES: PubSurface[] = [
  { key: "post_purchase", label: "Post-purchase", where: rate("post_purchase").where, monthlyViews: MEDIAN.thank_you, cpm: rate("post_purchase").cpmStarter, cpc: rate("post_purchase").cpcStarter, ctr: ctr("Just bought"), source: "Rate card: post-purchase. CTR band: Just bought.", defaultOn: true },
  { key: "home", label: "Hub home", where: rate("landing").where, monthlyViews: MEDIAN.hub_hero, cpm: rate("landing").cpmStarter, cpc: rate("landing").cpcStarter, ctr: ctr("Browsing the hub"), source: "Rate card: hub landing page. CTR band: Browsing the hub.", defaultOn: true },
  { key: "product", label: "Product pages", where: rate("products").where, monthlyViews: Math.round(MEDIAN.product_services / 2), cpm: rate("products").cpmStarter, cpc: rate("products").cpcStarter, ctr: ctr("Browsing the hub"), source: "Rate card: product pages. Views: half of product / services (modelled split).", defaultOn: true },
  { key: "services", label: "Services & booking", where: rate("services").where, monthlyViews: MEDIAN.product_services - Math.round(MEDIAN.product_services / 2), cpm: rate("services").cpmStarter, cpc: rate("services").cpcStarter, ctr: ctr("Browsing the hub"), source: "Rate card: services & booking pages. Views: half of product / services (modelled split).", defaultOn: true },
  { key: "member_dashboard", label: "Member dashboard", where: rate("dashboard").where, monthlyViews: MEDIAN.member_dashboard, cpm: rate("dashboard").cpmStarter, cpc: rate("dashboard").cpcStarter, ctr: ctr("Coming back"), source: "Rate card: member dashboard. CTR band: Coming back.", defaultOn: true },
  { key: "newsletter", label: "Newsletter", where: EMAIL_SLOT.where, monthlyViews: MEDIAN.partner_email, cpm: [EMAIL_SLOT.cpmUsd, EMAIL_SLOT.cpmUsd], cpc: null, ctr: null, source: "Spec sheet: partner email module, $30 CPM. No CPC or CTR on file.", defaultOn: false },
  { key: "social", label: "Social", where: "Sponsored posts on the hub's own social accounts.", monthlyViews: null, cpm: null, cpc: null, ctr: null, source: "No Birch rate on file yet. Priced by IO.", defaultOn: false },
];

export type PricingMode = "cpm" | "cpc";
export type PublisherInput = {
  on: Partial<Record<PubSurfaceKey, boolean>>;
  mode: PricingMode;
  /** Hub size vs the network median partner (1 = median). UI slider input, not data. */
  sizeX: number;
  /** Optional, the hub's own numbers: conversion % of clicks and value per transaction (USD). */
  conversionPct: number;
  valuePerConversionUsd: number;
};

export type SurfaceProjection = {
  key: PubSurfaceKey;
  label: string;
  on: boolean;
  priced: boolean;
  soldViews: number;
  clicks: [number, number];
  /** Gross media revenue: at ramp (starter low) and once pricing normalizes (top of the published starter range). */
  grossUsd: [number, number];
  payoutUsd: [number, number];
};

const mid = (r: Range) => (r[0] + r[1]) / 2;

export function projectPublisher(input: PublisherInput) {
  const sizeX = Math.min(20, Math.max(0.1, input.sizeX || 1));
  const share = PAYOUT.basePct / 100;
  const rows: SurfaceProjection[] = PUBLISHER_SURFACES.map((s) => {
    const on = input.on[s.key] ?? s.defaultOn;
    const views = s.monthlyViews == null ? 0 : Math.round(s.monthlyViews * sizeX);
    const sold = Math.round((views * SELL_ASSUMPTION_PCT) / 100);
    const useCpc = input.mode === "cpc" && s.cpc && s.ctr;
    const clicksMid = s.ctr ? Math.round(sold * mid(s.ctr)) : 0;
    let gross: [number, number] = [0, 0];
    if (useCpc) gross = [clicksMid * s.cpc![0], clicksMid * s.cpc![1]];
    else if (s.cpm) gross = [(sold / 1000) * s.cpm[0], (sold / 1000) * s.cpm[1]];
    const priced = !!(s.cpm || (useCpc && s.cpc));
    if (!on) gross = [0, 0];
    return {
      key: s.key,
      label: s.label,
      on,
      priced: priced && s.monthlyViews != null,
      soldViews: on ? sold : 0,
      clicks: on && s.ctr ? [Math.round(sold * s.ctr[0]), Math.round(sold * s.ctr[1])] : [0, 0],
      grossUsd: [Math.round(gross[0]), Math.round(gross[1])],
      payoutUsd: [Math.round(gross[0] * share), Math.round(gross[1] * share)],
    };
  });
  const sum = (f: (r: SurfaceProjection) => number) => rows.reduce((a, r) => a + f(r), 0);
  const mediaPayout: [number, number] = [sum((r) => r.payoutUsd[0]), sum((r) => r.payoutUsd[1])];
  const clicksMid = rows.reduce((a, r) => a + (r.clicks[0] + r.clicks[1]) / 2, 0);
  const conv = Math.max(0, Math.min(100, input.conversionPct || 0));
  const value = Math.max(0, input.valuePerConversionUsd || 0);
  const conversions = Math.round((clicksMid * conv) / 100);
  const transactionsUsd = Math.round(conversions * value);
  return {
    rows,
    sellPct: SELL_ASSUMPTION_PCT,
    payoutPct: PAYOUT.basePct,
    mediaPayoutUsd: mediaPayout,
    conversions,
    transactionsUsd,
    monthlyTotalUsd: [mediaPayout[0] + transactionsUsd, mediaPayout[1] + transactionsUsd] as [number, number],
    yearTotalUsd: [(mediaPayout[0] + transactionsUsd) * 12, (mediaPayout[1] + transactionsUsd) * 12] as [number, number],
  };
}

export const PUBLISHER_ASSUMPTIONS = [
  `Views: the network median partner hub (modelled), scaled by your hub-size slider.`,
  `Sell-through: ${SELL_ASSUMPTION_PCT}% of available space is sold (a planning assumption, not a delivery commitment).`,
  `At ramp = the low end of each published starter range. Normalized = the top of the same published range. No later-rate numbers are published.`,
  `CPC mode uses the midpoint of each placement's benchmark CTR band. Ranges, not promises.`,
  `Your payout: ${PAYOUT.basePct}% of media revenue. Tier breakpoints are not set yet (placeholder tiers).`,
  `Transactions (bookings, products) use only the numbers you enter. Leave them at 0 to skip.`,
  `Estimates only. Not a guarantee of views, clicks, sales or payouts. Payouts follow the hub agreement.`,
];

/* ------------------------------------------------------------------ supplier */

export type TriState = "off" | "on" | "maybe";

/** Categories ranked by modelled annual orders (CATEGORY_DEMAND, /audiences). Top 3 offer First look. */
export const FIRST_LOOK_TOP_N = 3;
export const SUPPLIER_CATEGORIES = [...CATEGORY_DEMAND]
  .sort((a, b) => b.ordersYr - a.ordersYr)
  .map((c, i) => ({ key: c.key, label: c.label, ordersYr: c.ordersYr, age: c.age, skew: c.skew, intents: c.intents, firstLook: i < FIRST_LOOK_TOP_N, rank: i + 1 }));

export const FIRST_LOOK = {
  title: "First look",
  line: "Get a chance to say no before others buy.",
  /** Limited rate: the published blended starter CPM and the CPC floor. */
  cpmUsd: BLENDED.starterCpm,
  cpcUsd: CPC_FLOOR_USD,
  fine: "First look is a right to review and decline a category before it is offered to other buyers, at the published starter CPM / CPC. It is not a lock and not exclusive. Interest only, subject to approval and terms.",
} as const;

export const MAX_DISTRIBUTION = {
  label: "Max distribution",
  line: "Show my offers on every eligible hub, newsletter and surface in the network.",
  note: "Without a hub or publisher of your own in the network, your performance TAM is limited to the hubs that accept your category.",
} as const;

export const INTEREST_FINE =
  "Interest only. Subject to approval and terms. Nothing is binding, nothing is booked and there is no checkout here. Your selections go to Birch Reserve (powered by Friday) as pending approval.";

/* ------------------------------------------------------------------ sponsor */

export const SPONSOR_OFFERS = [
  { key: "hold-190", name: "7-day category look", priceUsd: 190, priceLabel: "$190 USD", href: "/buycalc?sku=hold-190", line: "Hold your category for 7 days. Converts in full to the $490 USD reserve within 7 days, or refunded.", kind: "category" as const },
  { key: "reserve-490", name: "Category reserve", priceUsd: 490, priceLabel: "$490 USD", href: "/buycalc?sku=reserve-490", line: "Media credit, fully refundable until 14 days before the launch date on the IO, usable for 12 months. Nothing runs before you approve an insertion order.", kind: "category" as const },
  { key: "area-lock", name: "Area lock", priceUsd: AREA_LOCK.priceUsd, priceLabel: `$${AREA_LOCK.priceUsd.toLocaleString("en-US")} USD`, href: "/advertise/local", line: `Launch price through ${AREA_LOCK.launchRateUntil}. Up to ${AREA_LOCK.standardSharePct}% of hub display slots within ${AREA_LOCK.radiusKm} km, for the term on the IO.`, kind: "area" as const, launchPrice: true },
] as const;

/* ------------------------------------------------------------------ channel tiles */

export const CHANNEL_TILES_LABEL = "Network figures / targets";
export const CHANNEL_TILES = [
  { key: "scale-hubs", name: "Scale Hubs", stats: [{ v: ">20MM", l: "unique customers" }, { v: ">700MM", l: "page views rolling out" }, { v: ">5B", l: "page views in 2027 (target)" }], line: "Private health and wellness hubs: physio, recovery, longevity and food brands." },
  { key: "calm-joints", name: "Calm Joints", stats: [] as { v: string; l: string }[], line: "Joint-pain and recovery audience channel. Figures to come." },
  { key: "street-team", name: "Street Team", stats: [{ v: "500K", l: "high-value homes" }, { v: "3MM+", l: "homes, expanding" }], line: "Ambassador door routes, targeted by neighbourhood. Area-level only.", image: "/street-team/door-route.webp", imageNote: "Day-1 route heat map (area-level). The network-wide census map is still needed." },
  { key: "retail-network", name: "Retail Network", stats: [{ v: ">120", l: "locations across Canada" }, { v: ">1MM", l: "recovery customers" }], line: "In-store recovery retail across Canada." },
] as const;

export const CHANNEL_TILES_FINE =
  "Network figures and targets as reported by Scale Health, Nov 18 2026. Targets are goals, not guarantees. They are not measured delivery and are separate from the modelled /inventory feed.";

/* ------------------------------------------------------------------ Friday payload (adapter) */

export type IntakeRole = "publisher" | "supplier" | "sponsor" | "kit";
export type IntakePayload = {
  schema: "birch-brand-intake/v1-draft";
  role: IntakeRole;
  /** Extra roles picked on the short landing form (sent as Friday `roles`). */
  roles?: IntakeRole[];
  site: "birchreserve.net";
  terms_version: string;
  website?: string;
  email?: string;
  publisher?: { surfaces: Array<{ key: PubSurfaceKey; on: boolean }>; mode: PricingMode; size_x: number; conversion_pct: number; value_per_conversion_usd: number };
  supplier?: { max_distribution: boolean; categories: Array<{ key: string; state: TriState; first_look: boolean }> };
  sponsor?: { interest: Array<(typeof SPONSOR_OFFERS)[number]["key"]>; category?: string; area?: string };
  /** Kit calculator inputs (captured data, no PII). Not yet in Friday's contract: see CONTRACT-GAPS.md. */
  kit_calculator?: { aov_usd: number; monthly_orders: number; purchases_per_year: number; purchases_per_year_range?: [number, number]; repeat_band?: string; margin_band: string; spend_usd: number; conversion_pct: number; category: string; brand_label?: string; calc_version: string };
  /** Lead events (e.g. kit_download). Not yet in Friday's contract: see CONTRACT-GAPS.md. */
  events?: Array<{ type: "kit_download"; at: string; formats: Array<"pdf" | "png"> }>;
};

/* ------------------------------------------------------------------ kit Side B: exposure */

/**
 * Anchor hubs going up next. PROPOSED, PENDING RANDY'S CONFIRMATION.
 * Public-OK only: every name is already shown publicly on birchreserve.net (/hubs brand hubs and the
 * "Live hubs today" line). No private partners. Randy confirms or edits this list before anything ships.
 */
export const ANCHOR_HUBS_STATUS = "Proposed, pending Randy's confirmation" as const;
export const PROPOSED_ANCHOR_HUBS = [
  { key: "dr-ho", name: "DR-HO’S", what: "Pain relief and physio", fits: ["recovery", "physio", "sleep"], live: true },
  { key: "integrity-fitness", name: "Integrity Fitness", what: "Studio and fitness hub", fits: ["fitness", "sports-nutrition", "supplements", "physio"], live: true },
  { key: "jill-health", name: "Jill Health", what: "Women's health, midlife and menopause", fits: ["longevity", "sleep", "supplements"], live: false },
  { key: "jack-health", name: "Jack Health", what: "Men's health and longevity", fits: ["longevity", "supplements", "fitness"], live: false },
  { key: "nutriprocan", name: "NutriProCan", what: "Nutrition and dietitian-guided eating", fits: ["supplements", "sports-nutrition", "longevity"], live: false },
  { key: "sole", name: "SOLE", what: "Foot pain, insoles and active footwear", fits: ["recovery", "fitness"], live: false },
] as const;

const allRates = RATE_SURFACES;
/** Per-placement rate card rows (Friday estimate_math / placements use the same keys). */
export const RATE_PLACEMENTS = allRates.map((r) => ({ key: r.key === "dashboard" ? "dashboard" : r.key, label: r.label, cpm: r.cpmStarter as Range, cpc: r.cpcStarter as Range }));

export const HUB_RATE_RANGE = {
  cpm: [Math.min(...allRates.map((r) => r.cpmStarter[0])), Math.max(...allRates.map((r) => r.cpmStarter[1]))] as Range,
  cpc: [Math.min(...allRates.map((r) => r.cpcStarter[0])), Math.max(...allRates.map((r) => r.cpcStarter[1]))] as Range,
  source: "Birch rate card starter ranges across the five hub surfaces (illustrative 2026 planning estimates).",
};

export function hubFit(categoryKey: string) {
  return PROPOSED_ANCHOR_HUBS.map((h) => ({ ...h, fit: (h.fits as readonly string[]).includes(categoryKey) ? ("Likely fit" as const) : ("Possible fit" as const) }));
}

/** Side B channels. Rates only where the rate card / spec sheet has one; reach = network figures / targets. */
export const EXPOSURE_CHANNELS = [
  { key: "hubs", name: "Scale Hubs", reach: ">20MM unique customers · >700MM page views rolling out", cpm: HUB_RATE_RANGE.cpm, cpc: HUB_RATE_RANGE.cpc, rateNote: "Rate card starter range" },
  { key: "calm-joints", name: "Calm Joints", reach: "Figures to come", cpm: null, cpc: null, rateNote: "Priced by IO" },
  { key: "street-team", name: "Street Team", reach: "500K high-value homes, expanding to 3MM+ (target)", cpm: null, cpc: null, rateNote: "Inquire: priced by route" },
  { key: "retail-network", name: "Retail Network", reach: ">120 locations across Canada · >1MM recovery customers", cpm: null, cpc: null, rateNote: "Priced by IO" },
] as const;

export const KIT_FIT_FINE = "Fit is a suggestion based on your category. Every placement is subject to human confirmation, hub approval and terms. Nothing is booked. Reach figures are network figures / targets, not guaranteed delivery.";
