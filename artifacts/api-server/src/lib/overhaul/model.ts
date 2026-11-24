/**
 * Birch Reserve overhaul (Nov 12 2026): one pure model shared by the API and the
 * client (the client imports this file by relative path). No Node imports here.
 *
 * EVERY audience and view figure is MODELLED from the public TAM feed
 * (birch-inventory /api/tam, mirrored at scalehealth.ca/tam, read 2026-11-12):
 * 20MM+ audience orders being onboarded (no network views headline in public copy), 42 listed
 * partners, 0 signed. Nothing here is measured delivery.
 *
 * Copy rules: never name the clinic operator; say "clinic hubs". Listed, not
 * signed. Do-not-pitch brands never appear.
 */
import { HUB_PLACEMENT_STARTER_CPM as STARTER } from "./pricing";
import { hubTier, ladderLine, publicHubs } from "../hubLadder";
import { HUBS as KIT_HUBS, SLOTS, DEPOSIT_TIERS, CUSTOM_MIN, CUSTOM_MAX, SMB_LADDER, toCad, type Hub, type Slot } from "../sponsorKit";

export { SLOTS, DEPOSIT_TIERS, CUSTOM_MIN, CUSTOM_MAX, SMB_LADDER, toCad };
export type { Hub, Slot };

export type Currency = "usd" | "cad";

/** CAD/USD ratio used by every existing Birch price ladder ($190→$270, $490→$690). */
export const CAD_PER_USD = 1.4;

export const TAM = {
  readOn: "2026-11-12",
  source: "https://scalehealth.ca/tam",
  feed: "https://birch-inventory.vercel.app/inventory/api/tam",
  ordersLabel: "20MM+",
  ordersNote: "audience orders being onboarded now (modelled)",
  listedPartners: 42,
  signedPartners: 0,
  /** Monthly modelled views by surface, CA market feed snapshot 2026-11-12. */
  monthly: {
    hubHome: 606360, // half of pv_hub (modelled split)
    productServices: 606359, // half of pv_hub (modelled split)
    memberDashboard: 1212719, // pv_dash (logged-in member dashboard)
    postPurchase: 1758251, // pv_pp
    partnerSite: 69049468, // pv_web
    partnerEmail: 33276408, // pv_email
    displayTotal: 110147725, // display_imps
    viewsTotal: 127891345,
  },
  /** Modelled display CTR band from the feed. */
  ctrLo: 0.0041,
  ctrHi: 0.0107,
} as const;

/** The four hub placements (Randy, Nov 12 1:10 PM), each sold as display or CPC. cpmUsd = starter (starting-at) rate from pricing.ts, an illustrative estimate. */
export const SURFACES = [
  { key: "post_purchase", label: "Post-Purchase", cpmUsd: STARTER.post_purchase, monthly: TAM.monthly.postPurchase, blurb: "On the thank-you and booking-confirmation page, right after a paid order or booking." },
  { key: "hub_home", label: "Hub Home Page", cpmUsd: STARTER.hub_home, monthly: TAM.monthly.hubHome, blurb: "Top-of-hub banner and native tiles on the co-branded hub home." },
  { key: "product_services", label: "Product / Services pages", cpmUsd: STARTER.product_services, monthly: TAM.monthly.productServices, blurb: "Inside product, service and booking pages while the visitor is browsing." },
  { key: "member_dashboard", label: "Member Dashboard (behind login)", cpmUsd: STARTER.member_dashboard, monthly: TAM.monthly.memberDashboard, blurb: "On the logged-in member dashboard, where members come back to track orders, plans and bookings." },
] as const;

export const PLACEMENT_LABELS = SURFACES.map((s) => s.label);

/** Rate-card CPM blended across the four hub placements, weighted by modelled views. */
export function blendedHubCpmUsd(): number {
  const views = SURFACES.reduce((a, s) => a + s.monthly, 0);
  const dollars = SURFACES.reduce((a, s) => a + (s.monthly * s.cpmUsd) / 1000, 0);
  return (dollars / views) * 1000;
}

/** Proposed CPC floor (USD) for click-priced versions of the same surfaces. */
export const CPC_FLOOR_USD = 0.85;

/** Effortless Admin has no hub feed row yet: network median like the others (modelled). */
const MEDIAN_VIEWS = KIT_HUBS.find((h) => h.key === "jack-health")!.views;

export type BrandHub = Hub & {
  logo: string;
  banner: string;
  recovery: "Recovery" | "Longevity" | "Food" | "Wellness services";
  audience: string;
  bannerStatus: "Live" | "Activating" | "In queue";
};

const EXTRA: Record<string, Pick<BrandHub, "logo" | "banner" | "recovery" | "audience" | "bannerStatus">> = {
  "dr-ho": { logo: "/partner-logos/dr-ho.png", banner: "/hub-banners/dr-ho.webp", recovery: "Recovery", audience: "Pain-relief device buyers (TENS / EMS), mostly 45+", bannerStatus: "Live" },
  "jack-health": { logo: "/partner-logos/jack-health.png", banner: "/hub-banners/jack-health.webp", recovery: "Longevity", audience: "Men's health and longevity members", bannerStatus: "In queue" },
  "jill-health": { logo: "/partner-logos/jill-health.png", banner: "/hub-banners/jill-health.webp", recovery: "Longevity", audience: "Women's health, midlife and menopause members", bannerStatus: "In queue" },
  "bird-and-be": { logo: "/partner-logos/bird-and-be.png", banner: "/hub-banners/bird-and-be.webp", recovery: "Recovery", audience: "Postpartum recovery and pelvic-floor care", bannerStatus: "In queue" },
  "roll-recovery": { logo: "/partner-logos/roll-recovery.png", banner: "/hub-banners/roll-recovery.webp", recovery: "Recovery", audience: "Athletes and active adults buying recovery hardware", bannerStatus: "In queue" },
  nutriprocan: { logo: "/partner-logos/nutriprocan.png", banner: "/hub-banners/nutriprocan.webp", recovery: "Food", audience: "Nutrition and dietitian-guided eating", bannerStatus: "In queue" },
  sole: { logo: "/partner-logos/sole.png", banner: "/hub-banners/sole.webp", recovery: "Recovery", audience: "Foot pain, insoles and active footwear buyers", bannerStatus: "Live" },
};

/** Status words come from the one hub ladder (lib/hubLadder.ts): Live / Activating, never "In queue" for a hub that is on it. */
function ladderStatus(key: string, fallback: BrandHub["bannerStatus"]): { bannerStatus: BrandHub["bannerStatus"]; status?: string } {
  const t = hubTier(key);
  if (t === "live") return { bannerStatus: "Live" };
  if (t === "activating") return { bannerStatus: "Activating", status: "Activating" };
  return { bannerStatus: fallback };
}

/** The brand hubs Randy named (Nov 12). DR-HO'S and SOLE are live today (SOLE added Nov 19 2026, Randy 11:10 AM ET); the rest are in queue. */
const BASE_BRAND_HUBS: BrandHub[] = [
  ...KIT_HUBS.filter((h) => h.kind === "brand").map((h) => ({ ...h, ...EXTRA[h.key]!, ...ladderStatus(h.key, EXTRA[h.key]!.bannerStatus) })),
  {
    key: "effortless-admin",
    name: "Effortless Admin",
    kind: "brand",
    status: "Activating",
    url: "",
    category: "Workplace benefits and admin",
    basis: "Network median partner (no hub feed yet)",
    views: MEDIAN_VIEWS,
    logo: "/partner-logos/effortless-admin.png",
    banner: "/hub-banners/effortless-admin.webp",
    recovery: "Wellness services",
    audience: "Employees reaching care through their benefits",
    bannerStatus: "Activating",
  },
];

/**
 * Every hub on the ladder, in ladder order (Live now first), for every hub list on the site (carousel, media kit tiles,
 * /hubs detail cards, rate card, trust strip). Integrity Fitness and Calm Joints have no hub feed row, so they use the
 * network-median basis like SOLE and a wordmark logo. Display only; ad serving still reads sponsorKit status.
 */
export const BRAND_HUBS: BrandHub[] = (() => {
  const med = BASE_BRAND_HUBS.find((h) => h.key === "jack-health")!;
  const extra: Record<string, Partial<BrandHub>> = {
    "integrity-fitness": { name: "Integrity Fitness", url: "https://www.scalehealth.ca/integrity", category: "Gym and recovery membership", logo: "/partner-logos/integrity-fitness.svg", banner: "/hub-gallery/integrity.webp", recovery: "Recovery" },
    "calm-joints": { name: "Calm Joints", url: "https://www.scalehealth.ca/calmjoints", category: "Digital physio clinic", logo: "/partner-logos/calm-joints.svg", banner: "/hub-gallery/calmjoints.webp", recovery: "Recovery" },
  };
  return publicHubs().flatMap((l) => {
    const have = BASE_BRAND_HUBS.find((b) => b.key === l.key);
    if (have) return [have];
    if (!extra[l.key]) return [];
    return [{ ...med, key: l.key, basis: "Network median partner (no hub feed yet)", audience: l.audience, ...extra[l.key], ...ladderStatus(l.key, "Live") } as BrandHub];
  });
})();
/** Kept for the /hubs page import. */
export const LADDER_BRAND_HUBS = BRAND_HUBS;

/** Inventory framing (Randy, Nov 12 1:10 PM): named hubs are live inventory now; more in queue by year end. */
export const INVENTORY = {
  liveSpendDownMonths: 6,
  queueMultiple: 3,
  queueBy: "year end 2026",
  line: `${ladderLine()} Placements are curated as each hub launches.`,
  queueLine: "Activating hubs are going live now; more hubs launch over time.",
} as const;

export const CLINIC_NETWORK = KIT_HUBS.find((h) => h.kind === "clinic")!;

/** Positioning: the only places we sell. */
export const POSITIONING = {
  recoveryBrandVerticals: [
    { key: "recovery", label: "Recovery", inQueue: false },
    { key: "longevity", label: "Longevity", inQueue: false },
    { key: "food", label: "Food", inQueue: false },
    { key: "pets", label: "Pets", inQueue: true },
  ],
  businessHubs: "Health & wellness business hubs: physio, mobility, gyms, studios and clinic hubs",
} as const;

// ---------------------------------------------------------------- area lock

/** Configurable. Defaults flagged for Randy (see AREA-LOCK-PRICING.md). */
export const AREA_LOCK = {
  priceCad: 4900,
  priceUsd: 3500,
  /** Proposed: deposit buys media at 25% below rate card. */
  discountPct: 25,
  radiusKm: 5,
  standardSharePct: 50,
  denseCoreSharePct: 25,
  minTermMonths: 1,
  maxTermMonths: 6,
  termsVersion: "area-lock-2026-11-12",
  /** The lock price itself is a launch rate (year-end discount). */
  launchRateUntil: "Dec 31, 2026",
  /** Locking also unlocks discounted follow-on spend. */
  followOnDiscountPct: 25,
  followOnCapUsd: 100000,
  followOnCapCad: 140000,
  unusedCredit: "Unused credit at the end of the term: take a refund, or extend the spend-down month by month at the same discount.",
} as const;

export type Density = "dense_core" | "standard" | "rural";

/** Residents inside a 5 km circle by density class (modelled planning numbers). */
export const RESIDENTS_5KM: Record<Density, number> = { dense_core: 250000, standard: 100000, rural: 25000 };
/** Canada population used to turn the national feed into a per-resident rate (StatCan, 2025). */
export const CANADA_POPULATION = 41_650_000;

const CA_POSTAL = /^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s*-?\s*(\d[ABCEGHJ-NPRSTV-Z]\d)?$/i;
const US_ZIP = /^(\d{5})(?:-\d{4})?$/;

/** Dense downtown cores where the lockable share drops to 25%. */
const CA_DENSE_FSA: RegExp[] = [
  /^M5/, // Toronto downtown core
  /^M4Y$/, /^M4W$/, /^M6J$/, // Church-Wellesley, Rosedale edge, West Queen West
  /^H2[LXYZ]$/, /^H3[ABCGH]$/, // Montreal centre-ville / Vieux-Montréal / Plateau edge
  /^V6[BCEGZ]$/, // Vancouver downtown, West End, Coal Harbour
  /^T2[PRG]$/, // Calgary beltline / downtown
  /^T5J$/, // Edmonton downtown
  /^K1[NPR]$/, // Ottawa centretown / ByWard
  /^R3C$/, // Winnipeg exchange
  /^G1[KR]$/, // Québec vieux
  /^B3J$/, // Halifax downtown
];

const US_DENSE_ZIP: Array<[number, number]> = [
  [10001, 10282], // Manhattan
  [60601, 60607], [60611, 60611], [60654, 60654], // Chicago Loop / River North
  [94102, 94111], [94133, 94133], // San Francisco downtown
  [2108, 2111], [2116, 2116], [2210, 2210], // Boston
  [90012, 90017], [90071, 90071], // Los Angeles downtown
  [98101, 98101], [98104, 98104], [98121, 98121], // Seattle
  [20001, 20006], [20036, 20037], // Washington DC
  [19102, 19103], [19106, 19107], // Philadelphia
  [33130, 33132], // Miami
  [78701, 78701], // Austin
  [80202, 80202], // Denver
  [30303, 30303], [30308, 30309], // Atlanta
  [77002, 77002], [77010, 77010], // Houston
  [75201, 75202], // Dallas
  [97204, 97205], [97209, 97209], // Portland
  [55401, 55403], // Minneapolis
  [92101, 92101], // San Diego
];

export type AreaLookup =
  | { ok: false; error: string }
  | { ok: true; country: "CA" | "US"; code: string; area: string; density: Density; sharePct: number; currency: Currency };

export function lookupArea(raw: string): AreaLookup {
  const input = String(raw ?? "").trim().toUpperCase();
  const ca = CA_POSTAL.exec(input);
  if (ca) {
    const fsa = ca[1]!;
    const dense = CA_DENSE_FSA.some((re) => re.test(fsa));
    const rural = fsa[1] === "0";
    const density: Density = dense ? "dense_core" : rural ? "rural" : "standard";
    return { ok: true, country: "CA", code: ca[2] ? `${fsa} ${ca[2]}` : fsa, area: fsa, density, sharePct: dense ? AREA_LOCK.denseCoreSharePct : AREA_LOCK.standardSharePct, currency: "cad" };
  }
  const us = US_ZIP.exec(input);
  if (us) {
    const zip = Number(us[1]);
    const dense = US_DENSE_ZIP.some(([a, b]) => zip >= a && zip <= b);
    return { ok: true, country: "US", code: us[1]!, area: us[1]!, density: dense ? "dense_core" : "standard", sharePct: dense ? AREA_LOCK.denseCoreSharePct : AREA_LOCK.standardSharePct, currency: "usd" };
  }
  return { ok: false, error: "Enter a Canadian postal code (like L4C 3G5) or a US ZIP (like 98052)." };
}

/** Page views (modelled, illustrative estimate) the deposit buys: credit at the starter rate card ÷ blended hub CPM, rounded down to 10k. The charged price (AREA_LOCK.priceUsd/priceCad) does not depend on this. */
export function areaLockGuaranteedViews(): { creditUsd: number; blendedCpmUsd: number; views: number; effectiveCpmUsd: number } {
  const creditUsd = AREA_LOCK.priceUsd / (1 - AREA_LOCK.discountPct / 100);
  const blendedCpmUsd = blendedHubCpmUsd();
  const views = Math.floor((creditUsd / blendedCpmUsd) * 1000 / 10000) * 10000;
  return { creditUsd, blendedCpmUsd, views, effectiveCpmUsd: (AREA_LOCK.priceUsd / views) * 1000 };
}

export type AreaQuote = {
  ok: true;
  area: Extract<AreaLookup, { ok: true }>;
  termMonths: number;
  currency: Currency;
  price: number;
  creditAtRateCard: number;
  discountPct: number;
  guaranteedViews: number;
  effectiveCpm: number;
  localMonthlySupply: number;
  lockedMonthly: number;
  localOverTerm: number;
  networkTopUp: number;
  sharePct: number;
  radiusKm: number;
  modelled: true;
};

export function quoteAreaLock(postal: string, termMonths: number, currencyOverride?: Currency): AreaQuote | { ok: false; error: string } {
  const area = lookupArea(postal);
  if (!area.ok) return area;
  const term = Math.min(AREA_LOCK.maxTermMonths, Math.max(AREA_LOCK.minTermMonths, Math.round(Number.isFinite(Number(termMonths)) ? Number(termMonths) : 3)));
  const currency = currencyOverride ?? area.currency;
  const g = areaLockGuaranteedViews();
  const perResident = TAM.monthly.displayTotal / CANADA_POPULATION;
  const localMonthlySupply = Math.round((RESIDENTS_5KM[area.density] * perResident) / 1000) * 1000;
  const lockedMonthly = Math.round((localMonthlySupply * area.sharePct) / 100 / 100) * 100;
  const localOverTerm = lockedMonthly * term;
  const networkTopUp = Math.max(0, g.views - localOverTerm);
  const price = currency === "cad" ? AREA_LOCK.priceCad : AREA_LOCK.priceUsd;
  return {
    ok: true,
    area,
    termMonths: term,
    currency,
    price,
    creditAtRateCard: Math.round(price / (1 - AREA_LOCK.discountPct / 100)),
    discountPct: AREA_LOCK.discountPct,
    guaranteedViews: g.views,
    effectiveCpm: Math.round((price / g.views) * 1000 * 100) / 100,
    localMonthlySupply,
    lockedMonthly,
    localOverTerm,
    networkTopUp,
    sharePct: area.sharePct,
    radiusKm: AREA_LOCK.radiusKm,
    modelled: true,
  };
}

/** Non-exclusive slots: smaller deposits that buy down the rate (bonus credit). */
export const SLOT_LADDER = [
  { key: "slot-490", label: "Starter slot", usd: 490, cad: 690, bonusPct: 0, note: "Non-exclusive. Rate card." },
  ...DEPOSIT_TIERS.map((t) => ({ key: t.key, label: t.label, usd: t.usd, cad: t.cad, bonusPct: t.bonusPct, note: `Non-exclusive. +${t.bonusPct}% bonus credit (${(100 - 100 / (1 + t.bonusPct / 100)).toFixed(1)}% effective discount).` })),
] as const;

// ---------------------------------------------------------------- publishers

export const PUBLISHER_INCENTIVE = {
  cashCad: 500,
  creditCad: 700,
  paidDaysAfterFirstTransaction: 90,
  activationChannels: ["email", "text", "a link on your website", "at checkout", "social media"],
  clockRule: "The 90-day clock starts once we see real traffic or transactions from your audience.",
  selfPurchaseRule: "Self-purchases (you, your staff or your own accounts buying) are excluded and don't count.",
  ladder: SMB_LADDER,
  clinicHubsUrl: "https://www.scalehealth.ca/clinichubs",
} as const;

// ---------------------------------------------------------------- agencies

/** Agency deal (updated Nov 24 2026): standard written 10% discount off the published rate card. */
export const AGENCY = {
  commissionPct: 10,
  line: "Agencies buy at a standard written 10% discount off the published rate card.",
  bonusNote: "Client tests can start self-serve on the $190 USD 7-day look or the $490 USD category reserve.",
} as const;

// ---------------------------------------------------------------- benchmarks

/** Public benchmarks only, each with its source. Ours are labelled modelled. */
export const BENCHMARKS = [
  { metric: "CPM, Meta, Health & Wellness", value: "$20.70 USD", source: "Triple Whale 2025 full year (~35k ad accounts), via influee.co/blog/facebook-ads-benchmarks", url: "https://influee.co/blog/facebook-ads-benchmarks" },
  { metric: "CPM, Meta, all industries", value: "$14.19 USD", source: "Triple Whale 2025 full year, via influee.co", url: "https://influee.co/blog/facebook-ads-benchmarks" },
  { metric: "Cost per lead, Meta, Health & Fitness", value: "$52.98 USD", source: "WordStream / LocaliQ Facebook Ads Benchmarks 2025", url: "https://www.wordstream.com/wp-content/uploads/2025/09/ws-guide-2025-fb-benchmarks.pdf" },
  { metric: "CTR, Meta traffic ads, Health & Fitness", value: "1.63%", source: "WordStream / LocaliQ Facebook Ads Benchmarks 2025", url: "https://www.wordstream.com/wp-content/uploads/2025/09/ws-guide-2025-fb-benchmarks.pdf" },
  { metric: "Engagement, offers on the order-confirmation page", value: "5.6% average positive engagement", source: "Rokt Thanks product page", url: "https://www.rokt.com/products/rokt-thanks" },
] as const;

export function money(amount: number, currency: Currency): string {
  return `$${Math.round(amount).toLocaleString("en-US")} ${currency.toUpperCase()}`;
}

export function priceIn(usd: number, currency: Currency): number {
  return currency === "cad" ? toCad(usd) : usd;
}
