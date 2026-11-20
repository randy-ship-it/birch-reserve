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
 * Copy rules (Randy, Nov 16 2026): no order or partner counts in public copy; no people, addresses or patient data;
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
  ordersLine: "more brand launches are being onboarded now",
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
  /** Nov 19 2026: key into MARKET_CONTEXT shown on the segment card as cited, population-level context (never Birch reach). */
  marketKey?: string;
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
    marketKey: "chronic-pain",
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
    marketKey: "age-65-ca",
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
    marketKey: "sleep-65-ca",
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
    marketKey: "chronic-pain",
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
    marketKey: "pickleball-ca",
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
    marketKey: "postpartum-ca",
  },
];

/**
 * Market context (daily scan, Nov 16 2026): third-party public research behind each audience pillar.
 * Population-level figures from the cited source, NOT Birch audience sizes, reach or delivery.
 * Every entry is a direct restatement of the linked source. Labelled "estimated" in the UI.
 */
export const MARKET_CONTEXT: Array<{ key: string; pillar: string; stat: string; line: string; source: string; url: string; year: string }> = [
  {
    key: "chronic-pain",
    pillar: "Recovery & physio",
    stat: "About 1 in 5",
    line: "Canadians live with chronic pain (about 7.6 million people), one of the most common reasons for seeking health care.",
    source: "Health Canada, Canadian Pain Task Force / Best Brains Exchange report",
    url: "https://www.canada.ca/en/health-canada/services/publications/healthy-living/best-brains-exchange-report-2023.html",
    year: "2023",
  },
  {
    key: "sleep",
    pillar: "Sleep",
    stat: "25%",
    line: "of Canadian adults reported trouble going to sleep or staying asleep most or all of the time; half reported it at least sometimes.",
    source: "Statistics Canada, Health Reports (Canadian Health Measures Survey 2014–2015)",
    url: "https://www150.statcan.gc.ca/n1/pub/82-003-x/2022003/article/00001-eng.htm",
    year: "2022",
  },
  {
    key: "sleep-women",
    pillar: "Sleep",
    stat: "55% vs 43%",
    line: "of women vs men aged 18 to 64 reported trouble going to sleep or staying asleep at least sometimes.",
    source: "Statistics Canada, Health Reports (Canadian Health Measures Survey 2007–2013)",
    url: "https://www150.statcan.gc.ca/n1/pub/82-003-x/2017009/article/54857-eng.pdf",
    year: "2017",
  },
  {
    key: "nhp-canada",
    pillar: "Supplements & longevity",
    stat: "73%",
    line: "of Canadian adults used natural health products, including vitamins and minerals, in the past 12 months; 57% of users take them daily, and use is slightly higher among women.",
    source: "Health Canada public opinion research (EKOS, n=2,575, December 2023)",
    url: "https://publications.gc.ca/collections/collection_2024/sc-hc/H14-599-2024-eng.pdf",
    year: "2024",
  },
  {
    key: "supplements-us",
    pillar: "Supplements & longevity",
    stat: "75%",
    line: "of American adults use dietary supplements.",
    source: "Council for Responsible Nutrition, 2024 Consumer Survey on Dietary Supplements (via NutraIngredients)",
    url: "https://www.nutraingredients.com/Article/2024/11/07/2024-CRN-Consumer-Survey-75-of-Americans-use-supplements/",
    year: "2024",
  },
  // Nov 17 2026 daily scan: queued categories (Food & nutrition, Pets). Same rules: cited, dated, population-level.
  {
    key: "fruit-veg",
    pillar: "Food & nutrition",
    stat: "21.6%",
    line: "of Canadian adults ate fruit and vegetables five or more times a day in 2023 (women 25.8%, men 17.3%).",
    source: "Statistics Canada, Health of Canadians 2024 (Canadian Community Health Survey 2023)",
    url: "https://www150.statcan.gc.ca/n1/pub/82-570-x/2024001/section3-eng.htm",
    year: "2025",
  },
  {
    key: "pets-ca",
    pillar: "Pets (in queue)",
    stat: "39.5% / 38.1%",
    line: "of Canadian households own at least one cat (about 6.2 million households) or at least one dog (about 6.0 million), 2025 estimates.",
    source: "Agriculture and Agri-Food Canada, Sector Trend Analysis: pet food trends in Canada (Euromonitor data)",
    url: "https://agriculture.canada.ca/en/international-trade/reports-and-guides/sector-trend-analysis-pet-food-trends-canada-0",
    year: "2026",
  },
  {
    key: "pets-us",
    pillar: "Pets (in queue)",
    stat: "94 million",
    line: "US households owned at least one pet in 2024, up from 82 million in 2023.",
    source: "American Pet Products Association, 2025 State of the Industry Report (via PetfoodIndustry)",
    url: "https://www.petfoodindustry.com/pet-food-market/market-trends-and-reports/news/15741428/report-pet-ownership-expands-as-gen-z-shifts-trends",
    year: "2025",
  },
  // Nov 18 2026 daily scan: Longevity and Medi/Spa. Same rules: cited, dated, population-level, never Birch reach.
  {
    key: "age-65-ca",
    pillar: "Longevity",
    stat: "20.0%",
    line: "of people in Canada were aged 65 and older on July 1, 2026, about 1 in 5 and up 0.6 points in a year.",
    source: "Statistics Canada, The Daily: Canada's population estimates, age and gender (Table 17-10-0005-01)",
    url: "https://www150.statcan.gc.ca/n1/daily-quotidien/260923/dq260923a-eng.htm",
    year: "2026",
  },
  {
    key: "spa-visits-us",
    pillar: "Medi/Spa (in queue)",
    stat: "191 million",
    line: "spa visits in the US in 2025, up 1.8%, at an average of $123.10 USD in revenue per visit.",
    source: "International SPA Association, 2026 ISPA U.S. Spa Industry Study \u201cBig Five\u201d (conducted by PwC)",
    url: "https://experienceispa.com/press-releases/powered-by-the-industry-it-serves-ispas-2026-big-five-statistics-show-steady-gains-and-enduring-strength/",
    year: "2026",
  },
  // Nov 19 2026 daily scan: Sleep (65+, screens before bed) and Medi/Spa (med spa patients). Same rules: cited, dated, population-level.
  {
    key: "sleep-65-ca",
    pillar: "Sleep",
    stat: "55%",
    line: "of Canadian adults aged 65 and older met the 7 to 8 hour sleep recommendation in 2020 (vs 77% of adults 18 to 64); 29% slept longer and 15% slept less.",
    source: "Statistics Canada, Health Reports: Sleep behaviours among Canadian adults (Canadian Community Health Survey 2020)",
    url: "https://www150.statcan.gc.ca/n1/pub/82-003-x/2022003/article/00001-eng.htm",
    year: "2022",
  },
  {
    key: "screens-before-sleep",
    pillar: "Sleep",
    stat: "68% / 60%",
    line: "of Canadian adults aged 18 to 64 and 65 and older used an electronic device in the 30 minutes before falling asleep.",
    source: "Statistics Canada, The Daily: Health Reports, March 2022",
    url: "https://www150.statcan.gc.ca/n1/daily-quotidien/220316/dq220316d-eng.htm",
    year: "2022",
  },
  {
    key: "medspa-us",
    pillar: "Medi/Spa (in queue)",
    stat: "73%",
    line: "of US medical spa patients were repeat patients in 2023 (up from 65%), spending an average of $527 USD per visit across 10,488 med spas.",
    source: "American Med Spa Association, 2024 Medical Spa State of the Industry Executive Summary",
    url: "https://www.americanmedspa.org/news/2024-medical-spa-state-of-the-industry-executive-report-recap/",
    year: "2024",
  },
  // Nov 20 2026 daily scan: Racquet (pickleball participation), Fitness (activity guideline), MD-referral (postpartum). Same rules: cited, dated, population-level.
  {
    key: "pickleball-ca",
    pillar: "Racquet & active sports",
    stat: "1.8 million",
    line: "Canadians play pickleball (est. 2026), up 14% in a year; 48% play for health and fitness.",
    source: "Pickleball Canada, Pickleball in Canada 2026 Survey (Canadian research firm, 2,000 households)",
    url: "https://pickleballcanada.org/pickleball-in-canada-2026-survey/",
    year: "2026",
  },
  {
    key: "active-adults-ca",
    pillar: "Fitness",
    stat: "46%",
    line: "of Canadian adults (18 to 79) met the 150 minutes a week activity guideline in 2022 to 2024 (53% of men, 39% of women), measured by accelerometer.",
    source: "Statistics Canada, The Daily: Canadian Health Measures Survey, cycle 7 (2022 to 2024)",
    url: "https://www150.statcan.gc.ca/n1/daily-quotidien/251017/dq251017b-eng.htm",
    year: "2025",
  },
  {
    key: "postpartum-ca",
    pillar: "MD-referral (postpartum)",
    stat: "53% to 79%",
    line: "of women in Canada have some form of laceration in a vaginal birth; 3.4% of all who gave birth called urinary incontinence \u201ca great deal of a problem\u201d in the first 3 months.",
    source: "Public Health Agency of Canada, Postpartum Health in Canada infographic (Family-Centred Maternity and Newborn Care guidelines)",
    url: "https://www.canada.ca/en/public-health/services/publications/healthy-living/infographic-postpartum-health-canada.html",
    year: "2024",
  },
];

export const SOURCES: Array<{ basis: Basis; source: string; what: string }> = [
  { basis: "measured", source: "Scale hub analytics", what: "Sessions by region and how members arrive, 30-day window. Shown as shares." },
  { basis: "measured", source: "Live hub inventory", what: "The launch brands and Calm Joints racquet pages listed on this page." },
  { basis: "modelled", source: "TAM feed (scalehealth.ca/tam)", what: "Orders a year, age band, gender skew, mobile share and stated intents by category, modelled from launch-partner customers." },
  { basis: "estimated", source: "Channel benchmarks", what: "Click-through bands by moment. Ranges, not promises." },
  { basis: "estimated", source: "Public research (Health Canada, Statistics Canada, PHAC, CRN, AAFC, APPA, ISPA, AmSpa, Pickleball Canada)", what: "Population-level market context per pillar, linked to each source. Not Birch audience sizes or delivery." },
];

/** Nov 19 2026: the cited market-context line for a segment card, if any. */
export function segmentContext(s: Pick<Segment, "marketKey">) {
  return s.marketKey ? MARKET_CONTEXT.find((m) => m.key === s.marketKey) : undefined;
}

/** Nov 19 2026: /match?audience=<segment key> prefill. Unknown keys return null (no prefill). */
export function matchPrefill(key: string | null | undefined): { key: string; name: string; blurb: string } | null {
  const s = SEGMENTS.find((x) => x.key === key);
  if (!s) return null;
  return { key: s.key, name: s.name, blurb: `Customers like your "${s.name}" audience. We sell: ` };
}

export function fmtOrdersShort(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}MM`;
  if (n >= 1_000) return `~${Math.round(n / 1_000)}K`;
  return `~${n}`;
}

export function fmtPctBand(lo: number, hi: number): string {
  const f = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1).replace(/\.?0+$/, "")}%`;
  return `${f(lo)}–${f(hi)}`;
}
