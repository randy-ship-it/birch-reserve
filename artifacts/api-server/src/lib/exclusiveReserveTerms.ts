/**
 * $1,900 CAD exclusive display reserve terms (Randy, voice, Nov 21 2026 9:59 AM ET).
 * Pure module (API + SPA): /exclusive, /terms, llms.txt and the Stripe line item share it.
 */
import { SPEND_DOWN_LINE } from "./inventoryPlan";

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
  termsVersion: "exclusive-2026-11-21",
} as const;

export const EXCLUSIVE_RESERVE_NAME = "Birch Reserve exclusive display reserve · $1,900 CAD";
export const EXCLUSIVE_RESERVE_DESCRIPTION =
  "Locks a $5K–$50K exclusive display package in your category at 25% below the regular rate. The full $1,900 counts toward that package. Nothing runs until you sign an insertion order (IO). Refundable until 14 days before the IO launch date.";

export const EXCLUSIVE_RESERVE_TERMS: readonly string[] = [
  "The exclusive display reserve is $1,900 CAD, charged in CAD by card. It is the one public offer priced in CAD.",
  "It locks your right to one exclusive display package in your category, sized $5,000 to $50,000 CAD on the insertion order, at 25% below the regular rate for that package. The full $1,900 counts toward the package.",
  "Exclusivity starts when you sign the IO, which names the hub, placement and dates. Nothing runs before then. If the category is already committed to another brand before your IO is signed, we refund the $1,900 in full.",
  "Fully refundable until 14 days before the launch date in your IO. A cash refund is also available if no approved surface is named within 60 days of payment. To cancel, reply to your confirmation email and we refund the original card.",
  `${SPEND_DOWN_LINE}`,
  "A paid $190 look or $490 reserve from the 30 days before counts in full toward the package on the IO.",
  "No impression guarantees. Any view figure is a modelled planning estimate. Reporting is aggregate only. No patient data, no clinical pixels.",
];

