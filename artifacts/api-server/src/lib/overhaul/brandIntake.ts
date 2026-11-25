/**
 * Brand intake + report on birchreserve.net (PREVIEW, Nov 18 2026; Randy via Emma 9:51 PM ET).
 * Birch owns the front end; Friday App keeps the data, API, intake, versions, pipeline and approvals.
 * Pure module shared by the client (relative import) and tests. No Node imports.
 *
 * NO NEW NUMBERS. Every rate, CTR band and view figure is re-used from an existing source:
 *   - CPM / CPC starter ranges: RATE_SURFACES (./pricing), illustrative 2026 planning estimates.
 *   - CTR bands: INTENT_LADDER (./audiences), benchmark ranges, not promises.
 *   - Newsletter: the partner_email slot (../sponsorKit), $12 CPM per 1,000 opens, views per network median partner.
 *   - Monthly views: the network median partner row (../sponsorKit HUBS, modelled).
 *   - Sell-through: SELL_ASSUMPTION_PCT (./agencyShowcase), Randy's 20% planning assumption; bands 20/40/60% (low/typical/high), same as hubEstimate.
 *   - Payout share 70% base, tiered 75/80/85% at 1MM/3MM/5MM views a month (SHARE_TIERS) (Randy, Nov 22 2026: "don't be under market"; was 35%). Market set: Rokt Thanks 50%, AdSense 68%, Journey 70%, Mediavine/Raptive 75%, Ezoic 82% (median ~72%). Tier breakpoints are NOT set: placeholders only.
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

/** Volume tiers on the hub's total monthly views (Randy, Nov 22 2026 9:48 AM ET: "we can match this"). Flat rate by tier, Mediavine-style
 * (their tiers are 75/80/85/90% by annual earnings): the whole month's media revenue is paid at the tier reached. */
export const SHARE_TIERS = [
  { key: "t1", label: "Under 1MM", pct: 70, fromViews: 0, breakpoint: "under 1MM views a month" },
  { key: "t2", label: "1MM+", pct: 75, fromViews: 1_000_000, breakpoint: "1MM+ views a month" },
  { key: "t3", label: "3MM+", pct: 80, fromViews: 3_000_000, breakpoint: "3MM+ views a month" },
  { key: "t4", label: "5MM+", pct: 85, fromViews: 5_000_000, breakpoint: "5MM+ views a month" },
] as const;
/** Hub share (%) at a monthly view count. */
export const shareForViews = (views: number): number => [...SHARE_TIERS].reverse().find((t) => views >= t.fromViews)!.pct;

/** Clinic services booked through a hub (BR-39, Randy Nov 22 2026 10:48 AM ET): the hub keeps half of what Scale Health charges. Plain copy only, no formula.
 * Provider terms are unchanged. Scale voice on Scale; Birch names Scale Health clinic services. */
export const SERVICES_SPLIT = {
  hubPct: 50,
  assessmentPrice: 49,
  sessionPrice: 29,
  /** Hub side, per booking. */
  hubAssessment: 24.5,
  hubSession: 14.5,
  /** Scale-voice sentence (also the neutral one used in popovers). */
  line: "Clinic services booked through your hub: you keep half of what Scale Health charges, $24.50 per $49 assessment and $14.50 per $29 session.",
  /** Birch-voice sentence. */
  birchLine: "Scale Health clinic services booked through your hub: you keep half of what Scale Health charges, $24.50 per $49 assessment and $14.50 per $29 session.",
} as const;

/** Hub onboarding fee framing (BR-39 follow-up, Randy Nov 22 2026 11:23 AM ET). Same $5,000 USD figure as the supplier "Stand-up fee" (SUPPLIER_FEES).
 * Larger hubs (the 1MM+ views tier) have it waived as a favour: still free to launch. Smaller hubs: it may apply. Never a guarantee. */
export const HUB_ONBOARDING = {
  feeUsd: 5000,
  waiverFromViews: 1_000_000,
  target: "Our target hubs are in the 50%+ payout range.",
  smaller: "Smaller hubs are welcome. A $5,000 USD onboarding fee may apply, and it can be harder to waive.",
  larger: "For larger hubs it's on us: the $5,000 USD onboarding fee is waived as a thank-you, so it's free to launch. The waiver is reserved for hubs at 1MM+ views a month.",
  chipLarge: "onboarding fee waived: free to launch, our gift to larger hubs.",
  chipSmall: "A $5,000 USD onboarding fee may apply to smaller hubs.",
} as const;
export const onboardingWaived = (views: number) => views >= HUB_ONBOARDING.waiverFromViews;

export const PAYOUT = {
  basePct: 70,
  line: "Hubs earn 70% of media revenue, rising to 75% at 1MM views a month, 80% at 3MM and 85% at 5MM.",
  tiers: SHARE_TIERS,
  tiersLabel: "Volume tiers",
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
  { key: "newsletter", label: "Newsletter", where: EMAIL_SLOT.where, monthlyViews: MEDIAN.partner_email, cpm: [EMAIL_SLOT.cpmUsd, EMAIL_SLOT.cpmUsd], cpc: null, ctr: null, source: "Rate card: partner email module, $12 per 1,000 opens. No CPC or CTR on file.", defaultOn: false },
  { key: "social", label: "Social", where: "Paid posts on the hub's own social accounts.", monthlyViews: null, cpm: null, cpc: null, ctr: null, source: "No Birch rate on file yet. Priced by IO.", defaultOn: false },
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
  /** Offers shown at the typical (40%) sell-through. */
  soldViews: number;
  clicks: [number, number];
  /** Gross media revenue: [low, high] = 20% sold at the low price end, 60% sold at the high price end. */
  grossUsd: [number, number];
  /** Hub payout [low, high] and typical (40% sold at the price midpoint). Same method as the hub calculator (hubEstimate). */
  payoutUsd: [number, number];
  likelyUsd: number;
};

/** Typical newsletter open rate (%): midpoint of the public health and fitness benchmarks used by hubEstimate (EMAIL.openRate 19.2-47.81). */
export const EMAIL_OPEN_PCT_MID = (19.2 + 47.81) / 2;
/** Sell-through bands, % of views carrying a paid offer: low = planning assumption, typical = 2x, high = 3x (60%, bottom of Google's 60-80% direct-sold target). */
export const PUBLISHER_SELL_BAND = [SELL_ASSUMPTION_PCT, SELL_ASSUMPTION_PCT * 2, SELL_ASSUMPTION_PCT * 3] as const;

const mid = (r: Range) => (r[0] + r[1]) / 2;

export function projectPublisher(input: PublisherInput) {
  const sizeX = Math.min(20, Math.max(0.1, input.sizeX || 1));
  const [sLo, sMid, sHi] = PUBLISHER_SELL_BAND;
  const viewsOf = (s: PubSurface) => {
    // Newsletter views on file are sends; the $12 price is per 1,000 OPENS, so convert at the typical open rate.
    const base = s.monthlyViews == null ? 0 : s.key === "newsletter" ? (s.monthlyViews * EMAIL_OPEN_PCT_MID) / 100 : s.monthlyViews;
    return Math.round(base * sizeX);
  };
  const totalViews = PUBLISHER_SURFACES.reduce((a, s) => a + ((input.on[s.key] ?? s.defaultOn) ? viewsOf(s) : 0), 0);
  const sharePct = shareForViews(totalViews);
  const share = sharePct / 100;
  const rows: SurfaceProjection[] = PUBLISHER_SURFACES.map((s) => {
    const on = input.on[s.key] ?? s.defaultOn;
    const views = viewsOf(s);
    const soldAt = (pct: number) => (views * pct) / 100;
    const useCpc = input.mode === "cpc" && s.cpc && s.ctr;
    const clicksAt = (pct: number) => (s.ctr ? soldAt(pct) * mid(s.ctr) : 0);
    // [low, likely, high] gross. CPM: sold/1000 x price. CPC: clicks x per-click price.
    let g: [number, number, number] = [0, 0, 0];
    if (useCpc) g = [clicksAt(sLo) * s.cpc![0], clicksAt(sMid) * mid(s.cpc!), clicksAt(sHi) * s.cpc![1]];
    else if (s.cpm) g = [(soldAt(sLo) / 1000) * s.cpm[0], (soldAt(sMid) / 1000) * mid(s.cpm), (soldAt(sHi) / 1000) * s.cpm[1]];
    const priced = !!(s.cpm || (useCpc && s.cpc));
    if (!on) g = [0, 0, 0];
    const sold = Math.round(soldAt(sMid));
    return {
      key: s.key,
      label: s.label,
      on,
      priced: priced && s.monthlyViews != null,
      soldViews: on ? sold : 0,
      clicks: on && s.ctr ? [Math.round(soldAt(sMid) * s.ctr[0]), Math.round(soldAt(sMid) * s.ctr[1])] : [0, 0],
      grossUsd: [Math.round(g[0]), Math.round(g[2])],
      payoutUsd: [Math.round(g[0] * share), Math.round(g[2] * share)],
      likelyUsd: Math.round(g[1] * share),
    };
  });
  const sum = (f: (r: SurfaceProjection) => number) => rows.reduce((a, r) => a + f(r), 0);
  const mediaPayout: [number, number] = [sum((r) => r.payoutUsd[0]), sum((r) => r.payoutUsd[1])];
  const mediaLikely = sum((r) => r.likelyUsd);
  const clicksMid = rows.reduce((a, r) => a + (r.clicks[0] + r.clicks[1]) / 2, 0);
  const conv = Math.max(0, Math.min(100, input.conversionPct || 0));
  const value = Math.max(0, input.valuePerConversionUsd || 0);
  const conversions = Math.round((clicksMid * conv) / 100);
  const transactionsUsd = Math.round(conversions * value);
  return {
    rows,
    sellPct: sMid,
    sellBand: PUBLISHER_SELL_BAND,
    payoutPct: sharePct,
    totalViews,
    mediaPayoutUsd: mediaPayout,
    mediaLikelyUsd: mediaLikely,
    conversions,
    transactionsUsd,
    monthlyTotalUsd: [mediaPayout[0] + transactionsUsd, mediaPayout[1] + transactionsUsd] as [number, number],
    monthlyLikelyUsd: mediaLikely + transactionsUsd,
    yearTotalUsd: [(mediaPayout[0] + transactionsUsd) * 12, (mediaPayout[1] + transactionsUsd) * 12] as [number, number],
    yearLikelyUsd: (mediaLikely + transactionsUsd) * 12,
  };
}

export const PUBLISHER_ASSUMPTIONS = [
  `Views: the network median partner hub (modelled), scaled by your hub-size slider.`,
  `Sell-through: ${PUBLISHER_SELL_BAND[0]}% of views carry a paid offer in the low case, ${PUBLISHER_SELL_BAND[1]}% typical, ${PUBLISHER_SELL_BAND[2]}% high (the bottom of the 60-80% direct-sold target Google News Initiative cites). A planning assumption, not a delivery commitment.`,
  `Low = ${PUBLISHER_SELL_BAND[0]}% sold at the low end of each published starter price. Typical = ${PUBLISHER_SELL_BAND[1]}% sold at the midpoint. High = ${PUBLISHER_SELL_BAND[2]}% sold at the top. The newsletter is priced per 1,000 opens ($12), at a typical open rate. No later-rate numbers are published.`,
  `CPC mode uses the midpoint of each placement's modelled engagement range. Ranges, not promises.`,
  `Your payout: ${PAYOUT.basePct}% of media revenue under 1MM views a month, ${SHARE_TIERS[1].pct}% at 1MM+, ${SHARE_TIERS[2].pct}% at 3MM+, ${SHARE_TIERS[3].pct}% at 5MM+, paid at the tier you reach (flat rate, like ad networks). Modelled; the hub agreement governs.`,
  `Transactions (bookings, products) use only the numbers you enter. Leave them at 0 to skip.`,
  `${SERVICES_SPLIT.line} Modelled; the hub agreement governs.`,
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
  note: "Supplier-only reaches every hub that accepts your category. Add a hub of your own to unlock max exposure.",
} as const;

export const INTEREST_FINE =
  "Interest only. Subject to approval and terms. Nothing is binding, nothing is booked and there is no checkout here. Your selections go to Birch Reserve as pending approval.";

/* ------------------------------------------------------------------ sponsor */

export const SPONSOR_OFFERS = [
  { key: "hold-190", name: "7-day category look", priceUsd: 190, priceLabel: "$190 USD", href: "/buycalc?sku=hold-190", line: "Hold your category for 7 days. Converts in full to the $490 USD reserve within 7 days, or refunded.", kind: "category" as const },
  { key: "reserve-490", name: "Category reserve", priceUsd: 490, priceLabel: "$490 USD", href: "/buycalc?sku=reserve-490", line: "Media credit, fully refundable until 14 days before the launch date on the IO, usable for 12 months. Nothing runs before you approve an insertion order.", kind: "category" as const },
  { key: "area-lock", name: "Area lock", priceUsd: AREA_LOCK.priceUsd, priceLabel: `$${AREA_LOCK.priceUsd.toLocaleString("en-US")} USD`, href: "/advertise/local", line: `Launch price through ${AREA_LOCK.launchRateUntil}. Up to ${AREA_LOCK.standardSharePct}% of hub display slots within ${AREA_LOCK.radiusKm} km, for the term on the IO.`, kind: "area" as const, launchPrice: true },
] as const;

/* ------------------------------------------------------------------ channel tiles */

export const CHANNEL_TILES_LABEL = "Network figures / targets";
/** Retail Network copy, exactly, everywhere (Friday report-design-system v2 copy rules; Randy Nov 18 2026). */
/** Retail network line (Randy, Nov 19 2026 2:27 PM ET via Emma): a retail-network estimate, site-wide. */
export const RETAIL_COPY = "200+ locations, 500+ soon · 1MM+ captive recovery consumers · Canada + USA";
export const RETAIL_TAG = "private network of digital and brick-and-mortar fitness & recovery retailers";
/** Randy Nov 21 1:00 PM: one audience framing, three channels, sitewide (AUDIENCE_CHANNELS). Plan figures, not delivered impressions. */
export const AUDIENCE_CHANNELS = [
  { key: "scale-hubs", name: "Branded ScaleHealth.ca hubs", v: "700MM+", l: "captive page views activating", detail: "Private, members-only hubs on ScaleHealth.ca where recovery and wellness customers already shop and book care." },
  { key: "retail-network", name: "Private retail network", v: "200+", l: "locations · 500+ soon · 1MM+ captive recovery consumers", detail: "Our private network of digital and brick-and-mortar fitness & recovery retailers, in Canada and the USA." },
  { key: "calm-street", name: "Calm Joints + Street Team Ambassadors", v: "1MM+", l: "consumers now · 3MM+ est. in 2027", detail: "Our provider network activating, our owned digital clinic Calm Joints, and the Street Team Ambassadors doing on-site product sampling and door-to-door." },
] as const;
export const AUDIENCE_LINE = "700MM+ captive page views activating · 200+ retail locations (500+ soon) with 1MM+ captive recovery consumers · 1MM+ consumers now through our provider network and Street Team, expanding to an estimated 3MM+ in 2027";
export const AUDIENCE_FINE = "Audience and reach figures are based on signed partnership contracts. Reach and audience, not delivered impressions, and not a guarantee of views, clicks or results. The 3MM+ figure for 2027 is an estimate. Street Team: Canada for now.";
/** Street Team + Calm Joints reach. */
export const STREET_REACH_FIG = { v: "1MM+", l: "consumers now · 3MM+ est. in 2027" } as const;
export const STREET_REACH_LINE = "reaching 1MM+ consumers now, expanding to an estimated 3MM+ in 2027";
export const STREET_REACH_SENTENCE = "Our provider network is activating and, with our Street Team Ambassadors, reaches 1MM+ consumers now, expanding to an estimated 3MM+ in 2027.";

export const CHANNEL_TILES = [
  { key: "scale-hubs", name: "Branded ScaleHealth.ca hubs", stats: [{ v: "700MM+", l: "captive page views activating" }], line: "Private health and wellness hubs: physio, recovery, longevity and food brands." },
  { key: "calm-joints", name: "Calm Joints", stats: [] as { v: string; l: string }[], line: "Our owned digital clinic. Its reach is counted with the Street Team: 1MM+ consumers now, 3MM+ est. in 2027." },
  { key: "street-team", name: "Calm Joints + Street Team", stats: [{ v: STREET_REACH_FIG.v, l: STREET_REACH_FIG.l }], line: "Street Team Ambassadors: on-site product sampling and door-to-door, targeted by neighbourhood. Area-level only.", image: "/street-team/door-route.webp", imageNote: "Day-1 route heat map (area-level). The network-wide census map is still needed." },
  { key: "retail-network", name: "Private retail network", stats: [{ v: "200+", l: "locations (500+ soon)" }, { v: "1MM+", l: "captive recovery consumers" }, { v: "CA + US", l: "Canada + USA" }], line: `${RETAIL_COPY} · ${RETAIL_TAG}` },
] as const;

export const CHANNEL_TILES_FINE =
  "Audience figures are based on signed partnership contracts, as of Nov 21 2026. They are reach and audience, not delivered impressions, and not a guarantee. The 3MM+ figure for 2027 is an estimate. Street Team: Canada for now. They are separate from the /inventory pricing feed.";

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
  /** Where the brand sells and ships (Randy via Emma, 10:48 PM ET). Sent to v1 as profile.geography text. */
  market?: import("../kitCalc/channelGeo").Market;
  publisher?: { surfaces: Array<{ key: PubSurfaceKey; on: boolean }>; mode: PricingMode; size_x: number; conversion_pct: number; value_per_conversion_usd: number };
  supplier?: { max_distribution: boolean; categories: Array<{ key: string; state: TriState; first_look: boolean }> };
  sponsor?: { interest: Array<(typeof SPONSOR_OFFERS)[number]["key"]>; category?: string; area?: string };
  /** Kit calculator inputs (captured data, no PII). Not yet in Friday's contract: see CONTRACT-GAPS.md. */
  /** v1.2 shared category key (fast mode: guessed from the site title/meta, or a labelled default). */
  category?: string;
  kit_calculator?: { aov_usd: number; monthly_orders: number; purchases_per_year: number; purchases_per_year_range?: [number, number]; repeat_band?: string; margin_band: string; spend_usd: number; conversion_pct: number; category: string; brand_label?: string; calc_version: string };
  /**
   * One-form intake (Randy via Emma, Nov 19 2026 9:34 AM ET): shared answers asked once and sent to both sides, plus
   * role-specific detail after the fast submit. Mapped to v1 keys in toFridayBody (fridayBrandIntake.ts):
   * company_name (v1.1; dropped on strict v1, so it is also in the blurb), profile.audience / profile.reach (v1),
   * publisher.surfaces (v1), supplier.first_look (v1), calculator (v1). Anything without a v1 field goes into `notes`
   * → the v1 `blurb` as labelled lines. See /workspace/br-intake/CONTRACT-GAPS.md §H.
   */
  company_name?: string;
  /**
   * Optional checkbox (Randy, voice, Nov 24 2026): interest in trusted agency partners.
   * Birch-only boolean (Friday v1 is strict, so the server strips it and keeps a labelled blurb line).
   */
  agency_partner_interest?: boolean;
  /** physical: "Do you have physical locations?" (Nov 19 2026 10:54 AM ET) → In-location display line; see inLocation.ts. */
  shared?: { categories?: string[]; skus?: number; audience_customers?: number; physical?: import("./inLocation").PhysicalAnswer };
  hub?: { type?: string; locations?: number; foot_traffic_month?: number; web_visitors_month?: number; page_views_month?: number; email_list?: number; screens?: number; surfaces?: string[]; cities?: string; decision_maker_role?: string };
  supplier_detail?: { avg_price_usd?: number; margin_band?: string; retail_now?: string; ships?: string; accelerate_budget?: string };
  notes?: string[];
  /** Supplier hub request (/intake/supplier): Birch-only key, stripped server-side; always pending_approval (never auto-publish). */
  hub_request?: { role: "supplier"; status: "pending_approval"; hub_name?: string; hub_slug?: string };
  /** Lead events (e.g. kit_download). Not yet in Friday's contract: see CONTRACT-GAPS.md. */
  events?: Array<{ type: "kit_download"; at: string; formats: Array<"pdf" | "png"> }>;
};

/** Exact checkbox wording on /intake (Randy, voice, Nov 24 2026). */
export const AGENCY_PARTNER_QUESTION =
  "Do you want to know about any of our trusted agency partners that can help with things like creative new distribution channels, traditional full-service ad buying and end-to-end campaign management?";
export const agencyPartnerBlurb = (yes: boolean) => `Agency partner interest: ${yes ? "yes" : "no"}.`;

/* ------------------------------------------------------------------ kit Side B: exposure */

/**
 * Anchor hubs going up next. PROPOSED, PENDING RANDY'S CONFIRMATION.
 * Public-OK only: every name is already shown publicly on birchreserve.net (/hubs brand hubs and the
 * "Live hubs today" line). No private partners. Randy confirms or edits this list before anything ships.
 */
export const ANCHOR_HUBS_STATUS = "Proposed, pending Randy's confirmation" as const;
/**
 * Anchor set (Randy, Nov 18 2026 11:34–11:35 PM ET): named publicly on birchreserve.net and in brand kits, Kalaya
 * included. Status follows the hub list: DR-HO'S and SOLE are live today; the rest are in queue. Proposed, not confirmed.
 * Retail locations are referred to only as "retail hubs" (Retail Network tile), never by an operator name.
 */
export const PROPOSED_ANCHOR_HUBS = [
  { key: "dr-ho", name: "DR-HO’S", what: "Pain relief and physio", fits: ["recovery", "physio", "sleep"], live: true },
  { key: "integrity-fitness", name: "Integrity Fitness", what: "Gym members, with recovery and physio built into the membership", fits: ["recovery", "fitness", "physio", "sports-nutrition"], live: true },
  { key: "calm-joints", name: "Calm Joints", what: "Members of our own digital physio clinic", fits: ["recovery", "physio", "sleep"], live: true },
  { key: "roll-recovery", name: "Roll Recovery", what: "Recovery tools and a member marketplace", fits: ["recovery", "fitness", "physio", "sports-nutrition"], live: false },
  { key: "jill-health", name: "Jill Health", what: "Women's health, midlife and menopause", fits: ["longevity", "sleep", "supplements"], live: false },
  { key: "jack-health", name: "Jack Health", what: "Men's health and longevity", fits: ["longevity", "supplements", "fitness"], live: false },
  { key: "nutriprocan", name: "NutriProCan", what: "Nutrition and dietitian-guided eating", fits: ["supplements", "sports-nutrition", "longevity"], live: false },
  { key: "sole", name: "SOLE", what: "Foot pain, insoles and active footwear", fits: ["recovery", "fitness"], live: true },
  { key: "effortless-admin", name: "Effortless Admin", what: "Benefits and wellness admin hub", fits: ["longevity", "supplements", "sleep"], live: false },
  { key: "bird-and-be", name: "Bird & Be", what: "Postpartum recovery and pelvic-floor care", fits: ["recovery", "physio", "longevity"], live: false },
  { key: "kalaya", name: "Kalaya", what: "Topical pain relief", fits: ["recovery", "physio", "sleep"], live: false },
] as const;

export const anchorName = (key: string | undefined, name: string) => PROPOSED_ANCHOR_HUBS.find((h) => h.key === key)?.name ?? name;

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
  { key: "hubs", name: "Branded ScaleHealth.ca hubs", reach: "700MM+ captive page views activating", cpm: HUB_RATE_RANGE.cpm, cpc: HUB_RATE_RANGE.cpc, rateNote: "Rate card starter range" },
  { key: "calm-joints", name: "Calm Joints", reach: "Counted with the Street Team: 1MM+ consumers now, 3MM+ est. in 2027", cpm: null, cpc: null, rateNote: "Priced by IO" },
  { key: "street-team", name: "Calm Joints + Street Team", reach: "1MM+ consumers now, 3MM+ est. in 2027", cpm: null, cpc: null, rateNote: "Inquire: priced by route" },
  { key: "retail-network", name: "Private retail network", reach: RETAIL_COPY, cpm: null, cpc: null, rateNote: "Priced by IO" },
] as const;

export const KIT_FIT_FINE = "Fit is a suggestion based on your category. Every placement is subject to human confirmation, hub approval and terms. Nothing is booked. Reach figures are network figures / targets, not guaranteed delivery.";
