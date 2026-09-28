export const RESERVE_OFFERS = [
  {
    key: "hold-190",
    name: "7-day category look",
    amountCents: 19_000,
    consumesSeat: false,
    description:
      "Hold your category for 7 days. 100% credit if you convert to the full reserve within 7 days, else refund. Does not take an exclusive category.",
    creditLine: "Media credit, not airfare.",
  },
  {
    key: "reserve-490",
    name: "Exclusive category",
    amountCents: 49_000,
    consumesSeat: true,
    description:
      "Lock your exclusive category. Full $490 is media credit toward your placements (not airfare). Insertion order names the hub before anything runs. Credit expires 12 months.",
    creditLine: "Media credit, not airfare.",
  },
] as const;

export type ReserveOfferKey = (typeof RESERVE_OFFERS)[number]["key"];

export const DEFAULT_RESERVE_OFFER_KEY: ReserveOfferKey = "reserve-490";

export function getReserveOffer(key: ReserveOfferKey) {
  return RESERVE_OFFERS.find((offer) => offer.key === key) ?? RESERVE_OFFERS[0];
}

export function formatReserveAmount(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}
