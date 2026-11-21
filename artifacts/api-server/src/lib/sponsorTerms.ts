/**
 * Sponsorship pack terms + Checkout line items (Randy, Nov 20 2026 9:47 AM ET, audit #6).
 * One source for /terms (server + SPA), /sponsor and the Stripe line item, so they never drift.
 * Plain words only: no seat / pool / sweepstakes wording on anything a buyer sees.
 */
import { DEPOSIT_TIERS, type DepositTier } from "./sponsorKit";

export const SPONSOR_TERMS_VERSION = "sponsor-2026-11-20";

export const CARRY_OVER_CLAUSE =
  "A paid $190 look or $490 reserve counts in full toward any sponsorship pack bought within 30 days of that payment.";

export const SPONSOR_PACK_TERMS: readonly string[] = [
  `Sponsorship packs are ${DEPOSIT_TIERS.map((t) => `$${t.usd.toLocaleString("en-US")}`).join(", ").replace(/, ([^,]*)$/, " or $1")} USD (${DEPOSIT_TIERS.map((t) => `$${t.cad.toLocaleString("en-US")}`).join(", ").replace(/, ([^,]*)$/, " or $1")} CAD in Canada), charged in the currency shown, paid by card now. Nothing runs until an insertion order (IO) names the hub, placement and dates.`,
  "A pack is fully refundable until 14 days before the launch date in your IO. To cancel, reply to your confirmation email and we refund the original card.",
  `Bonus credit (${DEPOSIT_TIERS.map((t) => `+${t.bonusPct}%`).join(", ").replace(/, ([^,]*)$/, " or $1")}) is media credit only. It has no cash value and is not refunded.`,
  "No impression guarantees. Any view figure is a modelled planning estimate, not a delivery promise.",
  "Reporting is aggregate only. No patient data, no clinical pixels.",
];

const usd = (n: number, cur: "usd" | "cad" = "usd") => `$${n.toLocaleString("en-US")} ${cur.toUpperCase()}`;

/** Stripe Checkout line item for a pack (inline price_data; no Stripe Price objects are created). */
export function packLineItem(t: Pick<DepositTier, "usd" | "bonusPct">, cur: "usd" | "cad" = "usd"): { name: string; description: string } {
  // t.usd carries the charged amount (the CAD table amount for a CAD checkout).
  const credit = Math.round(t.usd * (1 + t.bonusPct / 100));
  return {
    name: `Birch Reserve sponsorship pack · ${usd(t.usd, cur)}`,
    description: `Prepaid media credit: ${usd(t.usd, cur)} plus ${t.bonusPct}% bonus media credit (${usd(credit, cur)} total). Runs only under a signed insertion order. Refundable until 14 days before the IO launch date.`,
  };
}

/** Custom amount (no bonus). */
export function customLineItem(amountUsd: number, cur: "usd" | "cad" = "usd"): { name: string; description: string } {
  return {
    name: `Birch Reserve media credit · ${usd(amountUsd, cur)}`,
    description: "Prepaid media credit. Runs only under a signed insertion order. Refundable until 14 days before the IO launch date.",
  };
}
