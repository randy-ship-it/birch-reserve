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
  row("exclusive-1900", "Exclusive display locked by the $1,900 CAD reserve", 5000, 50000, "CAD", "25% below the regular rate, set on the IO"),
];

/** The exclusive package locked by the $1,900 reserve, paced in the visitor's currency. */
export function exclusivePacing(currency: "usd" | "cad"): PacingRow {
  return row("exclusive-1900", `Exclusive display locked by the $1,900 ${currency.toUpperCase()} reserve`, 5000, 50000, currency === "usd" ? "USD" : "CAD", "25% below the regular rate, set on the IO");
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

/**
 * Randy t422u (Nov 21 2026), explicit override of the no-forecast rule for THIS figure only: 2027 inventory is pegged at an
 * expected $50MM+. It is an expectation, always labelled as an estimate. Today's contract-based range is "available to spend now".
 */
export const EXPECTED_2027 = {
  headline: "$50MM+",
  headlineUsd: "$50MM+ USD",
  label: "Expected 2027 ad inventory",
  note: "Estimate, not a guarantee.",
  conservative: "Conservative: new hubs are launching that aren't counted yet.",
  pipeline: "Retail hubs could reach 500+ locations. Street teams reach homes door to door and sample on site.",
  availableNow: "Available to spend now",
} as const;

export const TAM_2027 = {
  label: "Based on signed partnership contracts, not a commitment",
  cases: [tamCase("low", "Low case: 120 hubs", 120), tamCase("base", "Base case: 300 hubs", 300)] as const,
  basis: [
    `~${(HUB_VIEWS_MONTHLY / 1_000_000).toFixed(2)}MM hub-placement views a month across ${TAM.listedPartners} listed partners (TAM feed, part of ~128MM total modelled views). This pricing inventory is separate from the audience channels (700MM+ captive page views activating).`,
    `≈ ${VIEWS_PER_HUB_MONTHLY.toLocaleString("en-US")} modelled views per hub a month.`,
    `× 12 months × hubs × $${BLENDED_STARTER_CPM.toFixed(2)} blended starter CPM (rate card).`,
    "Hubs live today: DR-HO'S physio (June) and SOLE (October). Queued categories: Longevity, Sleep, Food & Nutrition, Medi/Spa, Pets.",
    "Partner websites and email (the rest of the ~128MM) are not counted. Starter rates only; no impression guarantee.",
  ],
} as const;

const money = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
const views = (n: number) => `${Math.round(n / 1_000_000)}MM`;

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
    `${EXPECTED_2027.label}: expected ${EXPECTED_2027.headlineUsd} a year in hub display. ${EXPECTED_2027.note} ${EXPECTED_2027.pipeline} It is an expectation, not a promise.`,
    `${EXPECTED_2027.availableNow}: ${tam2027Headline()} a year (${tam2027Views()}). ${TAM_2027.label}. ${EXPECTED_2027.conservative}`,
    `- ${lo.label}: ${lo.hubs} hubs × ${VIEWS_PER_HUB_MONTHLY.toLocaleString("en-US")} views/hub/mo × 12 × $${BLENDED_STARTER_CPM.toFixed(2)} CPM = ${money(lo.usdYear)}.`,
    `- ${base.label}: ${base.hubs} hubs × same = ${money(base.usdYear)}.`,
    ...TAM_2027.basis.map((b) => `- ${b}`),
  ].join("\n");
}
