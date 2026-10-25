import { priceFor } from "./currency";

export const RESERVE_OFFERS = [
  {
    key: "hold-190",
    name: "7-day look",
    amountCents: 19_000,
    consumesSeat: false,
    description:
      "A 7-day look at the inventory. 100% credit if you move to an early placement within 7 days, else refund.",
    creditLine: "Media credit, not airfare.",
  },
  {
    key: "reserve-490",
    name: "Early placement",
    amountCents: 49_000,
    consumesSeat: true,
    description:
      "Prepay your category. All $490 becomes display credit in your category (not airfare). Fully refundable until 14 days before your launch date. The insertion order names the hub before anything runs. Credit expires 12 months.",
    creditLine: "Media credit, not airfare.",
  },
] as const;

export type ReserveOfferKey = (typeof RESERVE_OFFERS)[number]["key"];

export const DEFAULT_RESERVE_OFFER_KEY: ReserveOfferKey = "reserve-490";

/** Amount in cents for an offer in the visitor's currency (matches the server's table). */
export function reserveOfferAmountCents(key: ReserveOfferKey, currency: "usd" | "cad"): number {
  return priceFor(key, currency) * 100;
}

export function getReserveOffer(key: ReserveOfferKey) {
  return RESERVE_OFFERS.find((offer) => offer.key === key) ?? RESERVE_OFFERS[0];
}

export function formatReserveAmount(amountCents: number, currency = "USD") {
  // en-CA renders CAD as "$270" (en-US would print "CA$270"). The caller adds the code.
  return new Intl.NumberFormat(currency.toUpperCase() === "CAD" ? "en-CA" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}
