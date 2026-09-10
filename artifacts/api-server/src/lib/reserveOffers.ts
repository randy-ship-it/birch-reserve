export const RESERVE_CURRENCY = "usd" as const;

export const PUBLIC_RESERVE_OFFERS = [
  {
    sku: "reserve-990",
    offerKey: "reserve-990",
    name: "Access Reserve",
    amountCents: 99_000,
    dueTodayUsd: 990,
    offerType: "reservation_credit",
    scope: "First-right planning access; no media delivery until a final insertion order is approved.",
    bestFor: "Brands that want to hold access without committing to a full pilot.",
  },
  {
    sku: "pilot-4900",
    offerKey: "pilot-4900",
    name: "Placement Pilot",
    amountCents: 490_000,
    dueTodayUsd: 4_900,
    offerType: "single_format_pilot",
    scope: "Credit toward one scoped digital or physical placement-format pilot.",
    bestFor: "Brands testing one customer moment before expanding.",
  },
  {
    sku: "network-9900",
    offerKey: "network-9900",
    name: "Network Pilot",
    amountCents: 990_000,
    dueTodayUsd: 9_900,
    offerType: "multi_surface_pilot",
    scope: "Credit toward a coordinated multi-surface network pilot.",
    bestFor: "Institutional buyers planning a broader digital and physical test.",
  },
] as const;

export const DEFAULT_RESERVE_OFFER = PUBLIC_RESERVE_OFFERS[0];

const LEGACY_USD_OFFER = {
  sku: "seat-1900",
  offerKey: "splash-1900",
  name: "Legacy Birch Reserve seat",
  amountCents: 190_000,
  dueTodayUsd: 1_900,
  offerType: "legacy_reservation_credit",
  scope: "Legacy first-right reservation credit.",
  bestFor: "Existing reservations only.",
} as const;

export const LEGACY_CAD_OFFER_KEY = "splash_ad_1900_cad";

export type PublicReserveOffer = (typeof PUBLIC_RESERVE_OFFERS)[number];
export type ReserveOffer = PublicReserveOffer | typeof LEGACY_USD_OFFER;

export const INVENTORY_OFFER_KEYS = [
  ...PUBLIC_RESERVE_OFFERS.map((offer) => offer.offerKey),
  LEGACY_USD_OFFER.offerKey,
  LEGACY_CAD_OFFER_KEY,
] as const;

export function getPublicReserveOfferBySku(value: unknown): PublicReserveOffer | null {
  return (
    PUBLIC_RESERVE_OFFERS.find((offer) => offer.sku === value) ?? null
  );
}

export function getPublicReserveOfferByKey(value: unknown): PublicReserveOffer | null {
  return (
    PUBLIC_RESERVE_OFFERS.find((offer) => offer.offerKey === value) ?? null
  );
}

export function getPayableReserveOffer(
  offerKey: string,
  amountCents: number,
  currency: string,
): ReserveOffer | null {
  if (currency !== RESERVE_CURRENCY) return null;
  const offer =
    getPublicReserveOfferByKey(offerKey) ??
    (offerKey === LEGACY_USD_OFFER.offerKey ? LEGACY_USD_OFFER : null);
  return offer?.amountCents === amountCents ? offer : null;
}

export function isInventoryOfferKey(value: string): boolean {
  return INVENTORY_OFFER_KEYS.includes(value as (typeof INVENTORY_OFFER_KEYS)[number]);
}