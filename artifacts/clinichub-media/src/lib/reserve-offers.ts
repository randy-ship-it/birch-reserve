export const RESERVE_OFFERS = [
  {
    key: "hold-190",
    name: "7-day category look",
    amountCents: 19_000,
    consumesSeat: false,
    description:
      "7-day category look. 100% credit if converted to a seat within 7 days, else cash refund. Does not consume an 8-seat.",
    creditLine: "Credit, not a flight.",
  },
  {
    key: "reserve-490",
    name: "Category seat",
    amountCents: 49_000,
    consumesSeat: true,
    description:
      "Named category seat in the 8-pool. 100% media credit. IO before flight. Credit expires 12 months.",
    creditLine: "Credit, not a flight.",
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