export const RESERVE_OFFERS = [
  {
    key: "reserve-990",
    name: "Access Reserve",
    amountCents: 99_000,
    description: "First-right planning access before a final insertion order.",
  },
  {
    key: "pilot-4900",
    name: "Placement Pilot",
    amountCents: 490_000,
    description: "Credit toward one scoped digital or physical placement-format pilot.",
  },
  {
    key: "network-9900",
    name: "Network Pilot",
    amountCents: 990_000,
    description: "Credit toward a coordinated multi-surface network pilot.",
  },
] as const;

export type ReserveOfferKey = (typeof RESERVE_OFFERS)[number]["key"];

export const DEFAULT_RESERVE_OFFER_KEY: ReserveOfferKey = "reserve-990";

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