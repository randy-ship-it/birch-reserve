/**
 * Two-lane conversion layer on /intake (Randy t227u, Nov 19 2026 ET).
 * Lane A "Reserve space (card)": 3 fields -> the EXISTING /buycalc card checkout (POST /v1/checkout -> Stripe).
 * Lane B "Big block / agency (IO + cheque)": short form -> existing /v1/leads path + a draft IO / pro-forma PDF.
 *
 * Pure data + helpers shared by the page and its tests. No new prices and no new legal terms: refund lines are the
 * live /terms wording; budget bands come from the media kit (premium $25K–$50K inquire-only, mediaKit.ts).
 * No bank details exist in the repo, so documents say "remit details on signed IO".
 */
import { AGENCY_CASH_PCT } from "./overhaul/mediaKit";

/** Same slugs as BUYCALC_CATEGORIES in routes/publicBuying.ts (the checkout validates them). A test keeps them equal. */
export const TWO_LANE_CATEGORIES = [
  { slug: "pain-relief-topicals", label: "Pain relief / topicals" },
  { slug: "recovery-hardware", label: "Recovery hardware" },
  { slug: "nutrition", label: "Nutrition" },
  { slug: "sleep", label: "Sleep" },
  { slug: "meal-prep", label: "Meal prep" },
  { slug: "womens-health", label: "Women’s health" },
  { slug: "mens-health", label: "Men’s health" },
  { slug: "diagnostics-services", label: "Diagnostics / services" },
] as const;
export type TwoLaneCategory = (typeof TWO_LANE_CATEGORIES)[number]["slug"];

export type CardSku = "hold-190" | "reserve-490";
export const CARD_OFFERS: Record<CardSku, { sku: CardSku; priceUsd: number; label: string; name: string; line: string }> = {
  "hold-190": { sku: "hold-190", priceUsd: 190, label: "$190 USD", name: "7-day look", line: "See your placement first." },
  "reserve-490": { sku: "reserve-490", priceUsd: 490, label: "$490 USD", name: "Reserve", line: "All $490 is media credit." },
};

/** Live /terms wording (routes/publicPages.ts TERMS_HTML), unchanged. */
export const LIVE_TERMS = {
  look: "hold-190 is a 100% credit if the buyer converts within 7 days. Otherwise it is a cash refund. It does not lock a category.",
  reserve:
    "reserve-490 is 100% display credit, fully refundable until 14 days before the launch date written in your insertion order. To cancel, reply to your confirmation email. We refund the full amount to the original card. After that date the credit is not refundable but stays usable for 12 months after payment. A cash refund is also available if no approved surface is named within 60 days of payment.",
  io: "Nothing runs until an insertion order names the surface.",
} as const;

/** Short chips (each is a straight cut of the live terms above). */
export const TERM_CHIPS = [
  "Fully refundable until 14 days before launch",
  "100% media credit",
  "Nothing runs until the IO names the hub",
] as const;

export const QUICK_RESERVE_STORAGE_KEY = "br_quick_reserve";

/** Hand-off to the existing card checkout page. No personal data in the URL (brand/email ride in sessionStorage). */
export function quickReserveHref(sku: CardSku, category: string | null | undefined): string {
  const q = new URLSearchParams({ sku, currency: "usd" });
  if (category && TWO_LANE_CATEGORIES.some((c) => c.slug === category)) q.set("category", category);
  q.set("utm_source", "birchreserve");
  q.set("utm_medium", "intake");
  q.set("utm_campaign", `two-lane-${sku}`);
  return `/buycalc?${q.toString()}#reserve`;
}

/** Exactly the body /buycalc posts to /v1/checkout (allowed keys only). Kept for the parity test with the checkout handler. */
export function quickReserveCheckoutBody(input: { sku: CardSku; email: string; brand: string; category?: string | null; idempotencyKey: string }) {
  const body: Record<string, string> = {
    sku: input.sku,
    email: input.email.trim().toLowerCase(),
    brand: input.brand.trim().slice(0, 160),
    currency: "usd",
    idempotency_key: input.idempotencyKey,
  };
  if (input.category && TWO_LANE_CATEGORIES.some((c) => c.slug === input.category)) body.category = input.category;
  return body;
}

export const AGENCY_TEST = { lowUsd: 1_000, highUsd: 5_000, cashPct: AGENCY_CASH_PCT } as const;

/** Lane B budget bands. Premium $25K–$50K is the live media-kit band that locks one brand per category (/terms). */
export const BLOCK_BANDS = [
  { key: "test_10k", label: "$10K", sub: "Test block", lowUsd: 10_000, highUsd: 10_000 },
  { key: "category_lock", label: "$25K–$50K", sub: "Category Lock (premium)", lowUsd: 25_000, highUsd: 50_000 },
  { key: "network_100k", label: "$100K+", sub: "Network block", lowUsd: 100_000, highUsd: null },
] as const;
export type BlockBand = (typeof BLOCK_BANDS)[number]["key"];

export const PAYMENT_METHODS_LINE = "Payment by cheque, wire or EFT to Silver Birch Growth Inc." as const;
export const REMIT_LINE = "Remit details on signed IO." as const;

export type BlockRequest = {
  band: BlockBand;
  flightStart: string;
  flightEnd: string;
  client: string;
  agency: string;
  email: string;
  name?: string;
};

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
export function bandAmountLabel(band: BlockBand): string {
  const b = BLOCK_BANDS.find((x) => x.key === band)!;
  return b.highUsd === null ? `${fmt(b.lowUsd)}+ USD` : b.highUsd === b.lowUsd ? `${fmt(b.lowUsd)} USD` : `${fmt(b.lowUsd)}–${fmt(b.highUsd)} USD`;
}

/** Agency cash at 10% of media spend, on the band's low end (modelled; the IO sets the real figure). */
export function agencyCashLabel(band: BlockBand): string {
  const b = BLOCK_BANDS.find((x) => x.key === band)!;
  const lo = Math.round((b.lowUsd * AGENCY_CASH_PCT) / 100);
  if (b.highUsd === null) return `${fmt(lo)}+ USD`;
  const hi = Math.round((b.highUsd * AGENCY_CASH_PCT) / 100);
  return lo === hi ? `${fmt(lo)} USD` : `${fmt(lo)}–${fmt(hi)} USD`;
}

/** Draft reference, e.g. BR-IO-20261119-ACME. Not an invoice number. */
export function draftRef(client: string, now: Date = new Date()): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, "");
  const slug = client.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "CLIENT";
  return `BR-IO-${d}-${slug}`;
}

export function validFlight(start: string, end: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  return end >= start;
}

/** Fields for the existing /v1/leads path (kind premium_inquiry = the live inquire-only premium path). */
export function blockLeadPayload(r: BlockRequest, ref: string, path = "/intake") {
  return {
    kind: "premium_inquiry" as const,
    email: r.email.trim(),
    name: r.name?.trim() || undefined,
    company: r.agency.trim() ? `${r.agency.trim()} for ${r.client.trim()}` : r.client.trim(),
    message: `Big block / agency IO request from /intake: ${bandAmountLabel(r.band)}, flight ${r.flightStart} to ${r.flightEnd}. Pay by cheque/wire/EFT on signed IO.`,
    path,
    fields: {
      lane: "big_block",
      band: r.band,
      budget: bandAmountLabel(r.band),
      flight_start: r.flightStart,
      flight_end: r.flightEnd,
      client: r.client.trim(),
      agency: r.agency.trim(),
      draft_ref: ref,
      payment: "cheque_wire_eft",
    },
  };
}

export function agencyTestLeadPayload(input: { email: string; agency: string; client: string }, path = "/intake") {
  return {
    kind: "agency_inquiry" as const,
    email: input.email.trim(),
    company: input.agency.trim() || input.client.trim(),
    message: `Agency client test ($1K–$5K USD) from /intake for ${input.client.trim() || "a client"}. ${AGENCY_CASH_PCT}% of media spend to the agency of record.`,
    path,
    fields: { lane: "agency_test", budget: "$1,000–$5,000 USD", client: input.client.trim(), agency: input.agency.trim() },
  };
}
