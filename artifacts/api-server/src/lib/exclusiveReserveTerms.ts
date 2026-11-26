/**
 * $1,900 CAD exclusive display reserve terms (Randy, voice, Nov 21 2026 9:59 AM ET).
 * Pure module (API + SPA): /exclusive, /terms, llms.txt and the Stripe line item share it.
 */
import { SPEND_DOWN_LINE } from "./inventoryPlan";

export type ReserveCur = "usd" | "cad";

export const EXCLUSIVE_RESERVE = {
  sku: "exclusive-reserve-1900-cad",
  kind: "exclusive_reserve",
  amountCents: 190_000,
  currency: "cad",
  label: "$1,900 CAD",
  packageRange: "$5K–$50K",
  discountPct: 25,
  /** Card statement: account prefix + suffix ("BIRCHRSV* RESERVE"). Prefix + "* " + suffix must be ≤ 22 chars. */
  statementSuffix: "RESERVE",
  termsVersion: "exclusive-2026-11-21b",
} as const;

/**
 * Geo currency (Randy, Nov 21 2026 3:34 PM ET: "it is based on where you are coming from").
 * Same $1,900 number in both currencies (there is no USD/CAD table for this offer): CAD for Canada,
 * USD everywhere else, and the visitor can switch. Stripe charges the currency the page showed.
 */
export function exclusiveReserveFor(currency: ReserveCur) {
  const cur = currency === "usd" ? "usd" : "cad";
  const C = cur.toUpperCase();
  return {
    ...EXCLUSIVE_RESERVE,
    sku: `exclusive-reserve-1900-${cur}` as const,
    currency: cur,
    label: `$1,900 ${C}`,
    packageLabel: `${EXCLUSIVE_RESERVE.packageRange} ${C}`,
    name: `Birch Reserve exclusive display reserve · $1,900 ${C}`,
  };
}

export const EXCLUSIVE_RESERVE_NAME = "Birch Reserve exclusive display reserve · $1,900 CAD";
export const EXCLUSIVE_RESERVE_DESCRIPTION =
  "Holds a $5K–$50K exclusive display package in your category while we write your insertion order (IO). The full $1,900 counts toward that package. Nothing runs until you sign the IO. Refunded in full if another brand commits to the category first, and refundable until 14 days before the IO launch date.";

/** One factual rate line for every surface (replaces the "25% below the regular rate" claim: no firm published reference price). */
export const EXCLUSIVE_RATE_LINE = "The package rate is set on your IO, at or below the published rate card.";

export const EXCLUSIVE_RESERVE_TERMS: readonly string[] = [
  "The exclusive display reserve is $1,900, charged by card in the currency shown when you pay: CAD for visitors in Canada, USD everywhere else. You can switch currency on the page before you pay; you are charged in the currency you saw.",
  "It holds one exclusive display package in your category while we write your insertion order, sized $5,000 to $50,000 on the IO in the same currency as your reserve. The package rate is set on the IO, at or below the published rate card. The full $1,900 counts toward the package. Larger premium slots ($25K–$50K) are by inquiry.",
  "The hold is pending your IO: the category becomes exclusive to you when you sign the IO, which names the hub, placement and dates. Nothing runs before then. If the category is committed to another brand before your IO is signed, we refund the $1,900 in full.",
  "Fully refundable until 14 days before the launch date in your IO. A cash refund is also available if no approved surface is named within 60 days of payment. To cancel, reply to your confirmation email and we refund the original card.",
  `${SPEND_DOWN_LINE}`,
  "A paid $190 look or $490 reserve (or the CAD equivalent) from the 30 days before counts in full toward the package on the IO.",
  "No impression guarantees. Any view figure is a modelled planning estimate. Reporting is aggregate only. No patient data, no clinical pixels.",
];
