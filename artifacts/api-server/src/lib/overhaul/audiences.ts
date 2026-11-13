/**
 * Audience insights (Nov 13 2026): what Birch knows about the audiences behind
 * the brand launches going live on Scale Health hubs and Calm Joints.
 * Pure data, shared by the client (relative import) and the API. No Node imports.
 *
 * Every figure carries a basis:
 *  - "measured":  read from first-party analytics (Scale hub admin, 30 days to 2026-11-02),
 *                 shown as shares only, aggregated and de-identified.
 *  - "modelled":  modelled from launch customers via the TAM feed
 *                 (birch-inventory /inventory/api/tam, mirrored at scalehealth.ca/tam,
 *                 snapshot read 2026-11-13). Partner order volumes x typical channel rates. Not audited.
 *  - "estimated": benchmark ranges or editorial judgement, not measured delivery.
 *
 * Copy rules: "20mm+ orders are being onboarded now"; no people, addresses or patient data;
 * cohort-level aggregates only; hand-picked curation in a private member experience.
 */

export type Basis = "measured" | "modelled" | "estimated";

export const BASIS_LABEL: Record<Basis, string> = {
  measured: "Measured",
  modelled: "Modelled from launch customers",
  estimated: "Estimated",
};

export const BASIS_NOTE: Record<Basis, string> = {
  measured: "First-party hub analytics, aggregated and de-identified. Shares only.",
  modelled: "Modelled from launch-partner order volumes and typical channel rates (TAM feed, read 2026-11-13). Not audited, not measured delivery.",
  estimated: "Benchmark range or editorial estimate. Not measured delivery.",
};

export const AUDIENCE_SNAPSHOT = {
  modelledReadOn: "2026-11-13",
  measuredWindow: "30 days to Nov 2, 2026",
  tamSource: "https://scalehealth.ca/tam",
  ordersLine: "20mm+ orders are being onboarded now",
  launchBrands: 8,
  racquetPages: ["Squash", "Tennis", "Pickleball", "Padel"],
  pillars: ["Recovery", "Longevity", "Sleep"],
} as const;

/** Modelled annual orders by audience category (TAM feed snapshot 2026-11-13, rounded). */
export const CATEGORY_DEMAND: Array<{ key: string; label: string; ordersYr: number; age: string; skew: string; mobile: number; intents: string }> = [
  { key: "recovery", label: "Recovery & pain relief", ordersYr: 6_068_909, age: "35-64", skew: "58% women", mobile: 0.72, intents: "Back & joint pain, arthritis, sports injury, muscle recovery" },
  { key: "supplements", label: "Supplements", ordersYr: 4_917_313, age: "25-44", skew: "52% men", mobile: 0.76, intents: "Protein, performance, gut & immunity" },
  { key: "fitness", label: "Fitness, wearables & apparel", ordersYr: 4_859_733, age: "25-44", skew: "52% men", mobile: 0.76, intents: "Performance, protein, sleep" },
  { key: "sports-nutrition", label: "Sports nutrition", ordersYr: 1_623_750, age: "25-44", skew: "52% men", mobile: 0.76, intents: "Protein, performance, hydration" },
  { key: "longevity", label: "Longevity, hormone & rehab programs", ordersYr: 1_485_558, age: "25-54", skew: "62% women", mobile: 0.75, intents: "Rehab programs, hormone care, biomarkers" },
  { key: "sleep", label: "Personal care & sleep", ordersYr: 978_856, age: "25-54", skew: "55% women", mobile: 0.77, intents: "Sleep, self-care, foot comfort" },
  { key: "physio", label: "Physio & provider network", ordersYr: 65_880, age: "25-64", skew: "55% women", mobile: 0.7, intents: "Physio, mobility, gym & studio members" },
];

/** Measured: where early hub sessions come from (located sessions, 30 days to Nov 2). Shares only. */
export const REGION_MIX: Array<{ label: string; pct: number }> = [
  { label: "Quebec", pct: 49 },
  { label: "Ontario", pct: 43 },
  { label: "Country-level / US", pct: 6 },
  { label: "Western Canada", pct: 2 },
];

/** Measured: how attributed hub members arrived (test channels excluded). Shares only. */
export const ARRIVAL_MIX: Array<{ label: string; pct: number }> = [
  { label: "Direct & organic", pct: 62 },
  { label: "Clinic network", pct: 22 },
  { label: "Studios & fitness", pct: 8 },
  { label: "Workplace benefits", pct: 8 },
];

/** Estimated: benchmark click-through bands by moment (TAM feed channel benchmarks). */
export const INTENT_LADDER: Array<{ moment: string; where: string; lo: number; hi: number }> = [
  { moment: "Just bought", where: "Post-purchase and booking confirmation", lo: 0.015, hi: 0.04 },
  { moment: "Coming back", where: "Member dashboard, behind login", lo: 0.003, hi: 0.008 },
  { moment: "Browsing the hub", where: "Hub home, product and services pages", lo: 0.0025, hi: 0.006 },
  { moment: "Open web, for contrast", where: "Standard display on brand sites", lo: 0.0008, hi: 0.002 },
];

export type Segment = {
  key: string;
  name: string;
  pillar?: "Recovery" | "Longevity" | "Sleep";
  isNew?: boolean;
  who: string;
  buys: string;
  feeders: string[];
  profile: string;
  profileBasis: Basis;
  intent: "Very high" | "High" | "Building";
  fits: string;
};

export const SEGMENTS: Segment[] = [
  {
    key: "recovery",
    name: "Recovery buyers",
    pillar: "Recovery",
    who: "Adults managing pain, injury and muscle recovery at home between visits.",
    buys: "Pain-relief devices, topicals, recovery hardware, insoles and braces.",
    feeders: ["DR-HO'S", "Roll Recovery", "Sole"],
    profile: "Core 35-64 · 58% women · ~6MM orders a year",
    profileBasis: "modelled",
    intent: "Very high",
    fits: "Recovery tools, heat and cold, braces, footwear, topicals",
  },
  {
    key: "longevity",
    name: "Longevity & hormonal health",
    pillar: "Longevity",
    who: "Members investing in midlife health, hormones and long-term performance.",
    buys: "Programs, testing, supplements and coaching.",
    feeders: ["Jack Health", "Jill Health"],
    profile: "Core 25-54 · 62% women · ~1.5MM orders a year",
    profileBasis: "modelled",
    intent: "High",
    fits: "Supplements with an NPN, testing, wearables, nutrition",
  },
  {
    key: "sleep",
    name: "Sleep",
    pillar: "Sleep",
    isNew: true,
    who: "Recovery and wellness buyers who already list sleep as a goal. Scale Sleep is being curated now.",
    buys: "Sleep tech, bedding, wind-down and self-care products.",
    feeders: ["Recovery and fitness hubs (sleep is a stated intent)"],
    profile: "Core 25-54 · 55% women · ~1MM orders a year in personal care & sleep",
    profileBasis: "modelled",
    intent: "Building",
    fits: "Sleep devices, mattresses and bedding, sleep-friendly supplements",
  },
  {
    key: "physio",
    name: "Physio patients",
    who: "People in active physio care, booking visits and following home plans.",
    buys: "Clinician-recommended recovery products and follow-up care.",
    feeders: ["Calm Joints", "Clinic hubs"],
    profile: "Core 25-64 · 55% women · physio, mobility, gym and studio members",
    profileBasis: "modelled",
    intent: "Very high",
    fits: "Braces, TENS, heat, mobility tools, recovery footwear",
  },
  {
    key: "racquet",
    name: "Racquet & active sports",
    who: "Squash, tennis, pickleball and padel players and active adults.",
    buys: "Recovery tools, compression, hydration, performance nutrition.",
    feeders: ["Calm Joints racquet pages", "Roll Recovery", "Sole"],
    profile: "Core 25-44 · 52% men · ~6.5MM orders a year across fitness and sports nutrition",
    profileBasis: "modelled",
    intent: "High",
    fits: "Electrolytes, recovery hardware, compression, court footwear",
  },
  {
    key: "md-referral",
    name: "MD-referral cohorts",
    who: "Cohorts reaching care through clinician pathways: weight loss, injury, hormonal and postpartum.",
    buys: "Guided programs, recovery products and follow-up care.",
    feeders: ["Bird & Be (postpartum)", "Jill Health (hormonal)", "DR-HO'S (injury & pain)"],
    profile: "Cohort sizes reported at launch, aggregated only",
    profileBasis: "estimated",
    intent: "High",
    fits: "Pelvic-floor and postpartum care, nutrition, mobility, sleep",
  },
];

export const SOURCES: Array<{ basis: Basis; source: string; what: string }> = [
  { basis: "measured", source: "Scale hub analytics", what: "Sessions by region and how members arrive, 30-day window. Shown as shares." },
  { basis: "measured", source: "Live hub inventory", what: "The launch brands and Calm Joints racquet pages listed on this page." },
  { basis: "modelled", source: "TAM feed (scalehealth.ca/tam)", what: "Orders a year, age band, gender skew, mobile share and stated intents by category, modelled from launch-partner customers." },
  { basis: "estimated", source: "Channel benchmarks", what: "Click-through bands by moment. Ranges, not promises." },
];

export function fmtOrdersShort(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}MM`;
  if (n >= 1_000) return `~${Math.round(n / 1_000)}K`;
  return `~${n}`;
}

export function fmtPctBand(lo: number, hi: number): string {
  const f = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1).replace(/\.?0+$/, "")}%`;
  return `${f(lo)}–${f(hi)}`;
}
