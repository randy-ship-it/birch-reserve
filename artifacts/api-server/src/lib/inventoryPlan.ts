/**
 * Spend-down pacing + 2027 modelled inventory (Randy, voice, Nov 21 2026 9:59 AM ET).
 * Pure module: imported by the API (llms.txt, /exclusive) and the SPA (home, media kit, rates, audiences).
 *
 * Every figure here comes from numbers already on the site:
 *   - TAM feed (scalehealth.ca/tam, read 2026-11-12): ~128MM modelled monthly views, 42 listed partners,
 *     of which ~4.18MM a month are on the four hub placements (post-purchase, hub home, product/services, dashboard).
 *   - Pricing model only: 120 and 300 hubs are modelling assumptions, not the audience claim (see AUDIENCE_CHANNELS).
 *   - Starter (starting-at) CPMs from the rate card, blended by modelled views.
 * No impression guarantee, no CTR or ROAS. Modelled, not a commitment.
 */
import { SURFACES, TAM, blendedHubCpmUsd } from "./overhaul/model";
import { ladderLine, liveLine, activatingLine, ladderMarkdown, MORE_LAUNCHING } from "./hubLadder";

/** Flexible spend-down window: up to 6 months once the IO starts, or faster. */
export const SPEND_DOWN_MAX_MONTHS = 6;

export const SPEND_DOWN_LINE =
  "Spend it down over a flexible window of up to 6 months once your IO starts, or faster. Credit still stays valid for 12 months from payment.";

/** /terms wording: pacing window for every credit (reserves, packs, agency tests, exclusive packages). */
export const SPEND_DOWN_TERM =
  "Once an insertion order starts, prepaid credit can be paced over a flexible window of up to 6 months, or faster. The IO sets the pacing. This does not shorten any credit's validity (12 months from payment for the $490 reserve) or change any refund window. Any monthly figure we show is a modelled illustration, not a delivery promise.";

/** Blended starter CPM (USD), rounded to the cent. */
export const BLENDED_STARTER_CPM = Math.round(blendedHubCpmUsd() * 100) / 100;

export type PacingRow = { key: string; label: string; credit: string; perMonth: string; viewsPerMonth: string; note?: string };

const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const kViews = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : `${Math.round(n / 1000).toLocaleString("en-US")}k`);

function row(key: string, label: string, lo: number, hi: number | null, cur: "USD" | "CAD", note?: string): PacingRow {
  const m = SPEND_DOWN_MAX_MONTHS;
  const cpm = BLENDED_STARTER_CPM;
  // CAD credit is paced in CAD; modelled views use the CAD→USD ladder (1.4) so CPM stays in USD.
  const toUsd = (n: number) => (cur === "CAD" ? n / 1.4 : n);
  const range = (a: number, b: number | null, f: (n: number) => string) => (b === null ? f(a) : `${f(a)}–${f(b)}`);
  return {
    key,
    label,
    credit: `${range(lo, hi, usd0)} ${cur}`,
    perMonth: `${range(lo / m, hi === null ? null : hi / m, usd0)} ${cur}/mo`,
    viewsPerMonth: `~${range((toUsd(lo) / m / cpm) * 1000, hi === null ? null : (toUsd(hi) / m / cpm) * 1000, kViews)} views/mo`,
    ...(note ? { note } : {}),
  };
}

/** Illustrative 6-month pacing for every buyable item. Modelled at the blended starter CPM. */
export const PACING_ROWS: readonly PacingRow[] = [
  row("reserve-490", "$490 reserve", 490, null, "USD"),
  row("pack-1500", "Starter sponsor ($1,575 credit)", 1575, null, "USD"),
  row("pack-3000", "Partner sponsor ($3,300 credit)", 3300, null, "USD"),
  row("pack-6000", "Network sponsor ($6,900 credit)", 6900, null, "USD"),
  row("agency-test", "Agency client test", 1000, 5000, "USD"),
  row("exclusive-1900", "Dedicated placement held by the $1,900 CAD starter", 5000, 50000, "CAD", "Rate set on the IO, at or below the rate card"),
];

/** The dedicated package held by the $1,900 starter placement, paced in the visitor's currency. */
export function exclusivePacing(currency: "usd" | "cad"): PacingRow {
  return row("exclusive-1900", `Dedicated placement held by the $1,900 ${currency.toUpperCase()} starter`, 5000, 50000, currency === "usd" ? "USD" : "CAD", "Rate set on the IO, at or below the rate card");
}

/* ------------------------------------------------------------------ 2027 */
/** Modelled hub-placement views a month across the 42 listed partners (feed snapshot). */
export const HUB_VIEWS_MONTHLY = SURFACES.reduce((a, s) => a + s.monthly, 0);
/** Modelled hub views per hub per month: hub-placement views ÷ listed partners. */
export const VIEWS_PER_HUB_MONTHLY = Math.round(HUB_VIEWS_MONTHLY / TAM.listedPartners);

export type Tam2027Case = { key: "low" | "base"; label: string; hubs: number; viewsYear: number; usdYear: number };

function tamCase(key: "low" | "base", label: string, hubs: number): Tam2027Case {
  const viewsYear = hubs * VIEWS_PER_HUB_MONTHLY * 12;
  return { key, label, hubs, viewsYear, usdYear: (viewsYear / 1000) * BLENDED_STARTER_CPM };
}

export const TAM_2027 = {
  label: "Modelled estimates from listed partners, not a commitment",
  cases: [tamCase("low", "Low case: 120 hubs", 120), tamCase("base", "Base case: 300 hubs", 300)] as const,
  basis: [
    `~${(HUB_VIEWS_MONTHLY / 1_000_000).toFixed(2)}MM hub-placement views a month across ${TAM.listedPartners} listed partners (TAM feed). That is the slice sold here, out of about 128MM total modelled page views a month (estimate).`,
    `≈ ${VIEWS_PER_HUB_MONTHLY.toLocaleString("en-US")} modelled views per hub a month.`,
    `× 12 months × hubs × $${BLENDED_STARTER_CPM.toFixed(2)} blended starter CPM (rate card).`,
    `${ladderLine()} Queued categories: Longevity, Sleep, Food & Nutrition, Medi/Spa, Pets.`,
    "Partner websites and email (the rest of the ~128MM) are not counted. Starter rates only; no impression guarantee.",
  ],
} as const;

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
const views = (n: number) => `${Math.round(n / 1_000_000)}MM`;

/**
 * 2027 hub display inventory: ONE modelled estimate that matches the printed math (Randy, Nov 26 2026: the old "$50MM+"
 * headline exceeded the math and is removed). Range = TAM_2027 low and base cases. Always labelled an estimate.
 */
export const EXPECTED_2027 = {
  get headline(): string {
    const [lo, base] = TAM_2027.cases;
    return `${money(lo.usdYear)}–${money(base.usdYear)}`;
  },
  get headlineUsd(): string {
    return `${this.headline} USD`;
  },
  label: "Estimated 2027 hub display inventory",
  note: "Modelled estimate, not a guarantee.",
  conservative: "Hubs launching later are not counted.",
  pipeline: "Retail hubs could reach 500+ locations. Street teams reach homes door to door and sample on site.",
  availableNow: "Modelled scenarios",
} as const;

export function tam2027Headline(): string {
  const [lo, base] = TAM_2027.cases;
  return `${money(lo.usdYear)}–${money(base.usdYear)} USD`;
}

export function tam2027Views(): string {
  const [lo, base] = TAM_2027.cases;
  return `${views(lo.viewsYear)}–${views(base.viewsYear)} hub views`;
}

/** One plain-text block for llms.txt and the chat. */
export function tam2027Text(): string {
  const [lo, base] = TAM_2027.cases;
  return [
    `${EXPECTED_2027.label}: ${tam2027Headline()} a year (${tam2027Views()}). ${EXPECTED_2027.note} ${TAM_2027.label}. It assumes ${lo.hubs} to ${base.hubs} hubs, which are modelling assumptions. ${EXPECTED_2027.conservative} ${EXPECTED_2027.pipeline}`,
    `- ${lo.label}: ${lo.hubs} hubs × ${VIEWS_PER_HUB_MONTHLY.toLocaleString("en-US")} views/hub/mo × 12 × $${BLENDED_STARTER_CPM.toFixed(2)} CPM = ${money(lo.usdYear)}.`,
    `- ${base.label}: ${base.hubs} hubs × same = ${money(base.usdYear)}.`,
    ...TAM_2027.basis.map((b) => `- ${b}`),
  ].join("\n");
}
