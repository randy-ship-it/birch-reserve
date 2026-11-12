/**
 * Birch Reserve public rate card v2 (Nov 12 2026). Pure module shared by the
 * client (relative import) and tests. No Node imports.
 *
 * Every number here is an ILLUSTRATIVE 2026 planning estimate from the
 * "birch-reserve-ad-pricing-model" planning doc (educated benchmark ranges,
 * not sold rates and not measured delivery). Copy must label them that way.
 *
 * Starter = the rate a new placement opens at (fill rate).
 * Proven  = where a placement can go once its reporting proves performance.
 * The category-seat spine (hold $190 / reserve $490 as media credit) and the
 * Stripe checkout are unchanged; these blocks quote on top of it.
 */

export type Range = readonly [number, number];

export type RateSurface = {
  key: "landing" | "dashboard" | "products" | "services" | "post_purchase";
  label: string;
  short: string;
  where: string;
  cpmStarter: Range;
  cpmProven: Range;
  cpcStarter: Range;
  cpcProven: Range;
};

export const RATE_SURFACES: readonly RateSurface[] = [
  { key: "landing", label: "Hub landing page (pre-login)", short: "Landing", where: "Top-of-hub banner and native tiles on the co-branded hub home.", cpmStarter: [4, 8], cpmProven: [12, 20], cpcStarter: [0.4, 0.8], cpcProven: [0.8, 1.5] },
  { key: "dashboard", label: "Member dashboard (post-login)", short: "Dashboard", where: "Logged-in members tracking orders, plans and bookings.", cpmStarter: [10, 18], cpmProven: [25, 45], cpcStarter: [0.8, 1.4], cpcProven: [1.5, 3.0] },
  { key: "products", label: "Product pages", short: "Products", where: "Inside product pages while members shop recovery gear.", cpmStarter: [12, 22], cpmProven: [35, 60], cpcStarter: [0.7, 1.4], cpcProven: [1.8, 4.0] },
  { key: "services", label: "Services & booking pages", short: "Services", where: "On service and booking pages, right before an appointment is made.", cpmStarter: [15, 25], cpmProven: [40, 70], cpcStarter: [0.9, 1.8], cpcProven: [2.5, 5.0] },
  { key: "post_purchase", label: "Post-purchase", short: "Post-purchase", where: "Thank-you and booking-confirmation pages, right after a paid order.", cpmStarter: [18, 30], cpmProven: [50, 90], cpcStarter: [1.2, 2.5], cpcProven: [3.0, 6.5] },
] as const;

const starterLow = (k: RateSurface["key"]) => RATE_SURFACES.find((s) => s.key === k)!.cpmStarter[0];

/**
 * Starter (starting-at) display CPM for the four hub placements used by the
 * per-hub rate card, /kit, /sponsor and area-lock sizing (Nov 12 2026: one
 * consistent price set). Product / services uses the product-page starter rate.
 */
export const HUB_PLACEMENT_STARTER_CPM = {
  post_purchase: starterLow("post_purchase"),
  hub_home: starterLow("landing"),
  product_services: starterLow("products"),
  member_dashboard: starterLow("dashboard"),
} as const;

/** Blended CPM planning anchors (USD). */
export const BLENDED = { starterCpm: 12, provenCpm: [40, 80] as Range } as const;

/** Public 2026 benchmark ranges (health / wellness / recovery, USD) from the Nov 12 pricing model, used only for comparison. */
export const CHANNEL_BENCHMARKS = [
  { key: "meta", label: "Meta, health & wellness", cpm: [12, 25] as Range, cpc: [0.6, 2.6] as Range },
  { key: "google_display", label: "Google Display", cpm: [3, 10] as Range, cpc: [0.7, 1.5] as Range },
  { key: "google", label: "Google search, health", cpm: null, cpc: [1.6, 6] as Range, cpcPlus: true },
  { key: "retail", label: "Retail media display", cpm: [6, 22] as Range, cpc: null },
  { key: "sponsored", label: "Retail sponsored products", cpm: null, cpc: [0.65, 1.6] as Range },
  { key: "open", label: "Open programmatic", cpm: [2, 8] as Range, cpc: [0.5, 1.2] as Range },
] as const;

export const META_CPM: Range = [12, 25];

/** View blocks sold per surface. */
export const VIEW_BLOCKS = [100_000, 250_000, 1_000_000] as const;
export type ViewBlock = (typeof VIEW_BLOCKS)[number];

/** Multi-surface bundle discount (modest by design). */
export function bundleDiscountPct(surfaceCount: number): number {
  if (surfaceCount >= 4) return 12;
  if (surfaceCount === 3) return 8;
  if (surfaceCount === 2) return 5;
  return 0;
}

/** Self-serve block pricing ceiling; anything above routes to an insertion order. */
export const SELF_SERVE_MAX_USD = 25_000;

export type PackQuote = {
  surfaces: RateSurface["key"][];
  block: number;
  views: number;
  listUsd: number;
  discountPct: number;
  startingUsd: number;
  effectiveCpm: number;
  provenUsd: Range;
  metaUsd: Range;
  needsIo: boolean;
};

/** "Starting at" price for one view block on each chosen surface (starter low CPM, less bundle discount). */
export function quotePack(keys: RateSurface["key"][], block: number): PackQuote {
  const chosen = RATE_SURFACES.filter((s) => keys.includes(s.key));
  const list = chosen.reduce((a, s) => a + (block / 1000) * s.cpmStarter[0], 0);
  const discountPct = bundleDiscountPct(chosen.length);
  const starting = Math.round(list * (1 - discountPct / 100));
  const views = block * chosen.length;
  const provenLo = chosen.reduce((a, s) => a + (block / 1000) * s.cpmProven[0], 0);
  const provenHi = chosen.reduce((a, s) => a + (block / 1000) * s.cpmProven[1], 0);
  return {
    surfaces: chosen.map((s) => s.key),
    block,
    views,
    listUsd: Math.round(list),
    discountPct,
    startingUsd: starting,
    effectiveCpm: views ? Math.round((starting / views) * 1000 * 100) / 100 : 0,
    provenUsd: [Math.round(provenLo), Math.round(provenHi)],
    metaUsd: [Math.round((views / 1000) * META_CPM[0]), Math.round((views / 1000) * META_CPM[1])],
    needsIo: starting > SELF_SERVE_MAX_USD,
  };
}

export type Scenario = { views: number; starterUsd: number; provenUsd: Range; metaUsd: Range };

/** Linear illustration: views × blended CPM. 100k ≈ $1.2k starter / $4-8k proven. */
export function scenario(views: number): Scenario {
  const k = Math.max(0, views) / 1000;
  return {
    views,
    starterUsd: Math.round(k * BLENDED.starterCpm),
    provenUsd: [Math.round(k * BLENDED.provenCpm[0]), Math.round(k * BLENDED.provenCpm[1])],
    metaUsd: [Math.round(k * META_CPM[0]), Math.round(k * META_CPM[1])],
  };
}

/** Scenario slider stops (log-ish), 100k to 1B views. */
export const SCENARIO_STOPS = [100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000] as const;

export function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000).toLocaleString("en-US")}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function fmtViews(n: number): string {
  if (n >= 1_000_000_000) return `${n / 1_000_000_000}B`;
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  return `${n / 1000}k`;
}

export function fmtRange(r: Range, decimals = 0): string {
  const f = (x: number) => (decimals ? x.toFixed(decimals) : String(x));
  return `$${f(r[0])}–${f(r[1])}`;
}

export const ESTIMATE_NOTE =
  "Illustrative 2026 planning estimates based on public channel ranges. Not sold rates, not a quote and not measured delivery. Your insertion order sets the final rate.";
