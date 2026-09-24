export const RESERVE_CURRENCY = "usd" as const;

type ReserveOfferShape = {
  sku: string;
  offerKey: string;
  name: string;
  amountCents: number;
  dueTodayUsd: number;
  offerType: string;
  scope: string;
  bestFor: string;
  consumesSeat: boolean;
  published: boolean;
};

export const PUBLIC_RESERVE_OFFERS = [
  {
    sku: "hold-190",
    offerKey: "hold-190",
    name: "7-day category look",
    amountCents: 19_000,
    dueTodayUsd: 190,
    offerType: "category_look",
    scope:
      "7-day category look. 100% credit if converted to a seat within 7 days, else cash refund. Does not consume an 8-seat.",
    bestFor: "Brands that want a short look at one category before locking a seat.",
    consumesSeat: false,
    published: true,
  },
  {
    sku: "reserve-490",
    offerKey: "reserve-490",
    name: "Category seat",
    amountCents: 49_000,
    dueTodayUsd: 490,
    offerType: "category_seat",
    scope:
      "Named category seat in the 8-pool. 100% media credit. Insertion order before flight. Credit expires 12 months.",
    bestFor: "Brands locking one exclusive category across signed hubs.",
    consumesSeat: true,
    published: true,
  },
] as const satisfies readonly ReserveOfferShape[];

export const DEFAULT_RESERVE_OFFER =
  PUBLIC_RESERVE_OFFERS.find((offer) => offer.sku === "reserve-490") ??
  PUBLIC_RESERVE_OFFERS[0];

const UNPUBLISHED_LEGACY_OFFERS = [
  {
    sku: "reserve-899",
    offerKey: "reserve-899",
    name: "Legacy category reserve",
    amountCents: 89_900,
    dueTodayUsd: 899,
    offerType: "legacy_reservation_credit",
    scope:
      "Unpublished legacy SKU. Existing Stripe Checkout sessions still match. Not offered on public pages.",
    bestFor: "Existing reservations only.",
    consumesSeat: true,
    published: false,
  },
  {
    sku: "reserve-990",
    offerKey: "reserve-990",
    name: "Legacy Access Reserve",
    amountCents: 99_000,
    dueTodayUsd: 990,
    offerType: "legacy_reservation_credit",
    scope: "Unpublished previous public SKU. Existing reservations remain payable.",
    bestFor: "Existing reservations only.",
    consumesSeat: true,
    published: false,
  },
  {
    sku: "pilot-4900",
    offerKey: "pilot-4900",
    name: "Legacy Placement Pilot",
    amountCents: 490_000,
    dueTodayUsd: 4_900,
    offerType: "legacy_reservation_credit",
    scope: "Unpublished previous public SKU. Existing reservations remain payable.",
    bestFor: "Existing reservations only.",
    consumesSeat: true,
    published: false,
  },
  {
    sku: "network-9900",
    offerKey: "network-9900",
    name: "Legacy Network Pilot",
    amountCents: 990_000,
    dueTodayUsd: 9_900,
    offerType: "legacy_reservation_credit",
    scope: "Unpublished previous public SKU. Existing reservations remain payable.",
    bestFor: "Existing reservations only.",
    consumesSeat: true,
    published: false,
  },
  {
    sku: "seat-1900",
    offerKey: "splash-1900",
    name: "Legacy Birch Reserve seat",
    amountCents: 190_000,
    dueTodayUsd: 1_900,
    offerType: "legacy_reservation_credit",
    scope: "Legacy first-right reservation credit.",
    bestFor: "Existing reservations only.",
    consumesSeat: true,
    published: false,
  },
] as const satisfies readonly ReserveOfferShape[];

/** Shown in the machine catalog, never as a public hero or new checkout SKU. */
export const CATALOG_LEGACY_OFFERS = UNPUBLISHED_LEGACY_OFFERS.filter(
  (offer) => offer.sku === "reserve-899",
);

export const LEGACY_CAD_OFFER_KEY = "splash_ad_1900_cad";

export type PublicReserveOffer = (typeof PUBLIC_RESERVE_OFFERS)[number];
export type ReserveOffer = PublicReserveOffer | (typeof UNPUBLISHED_LEGACY_OFFERS)[number];

const PAYABLE_USD_OFFERS = [
  ...PUBLIC_RESERVE_OFFERS,
  ...UNPUBLISHED_LEGACY_OFFERS,
] as const;

export const SEAT_OFFER_KEYS = [
  ...PAYABLE_USD_OFFERS.filter((offer) => offer.consumesSeat).map(
    (offer) => offer.offerKey,
  ),
  LEGACY_CAD_OFFER_KEY,
] as const;

export const LIFECYCLE_OFFER_KEYS = [
  ...PAYABLE_USD_OFFERS.map((offer) => offer.offerKey),
  LEGACY_CAD_OFFER_KEY,
] as const;

/** Seat-consuming keys. Hold-190 is payable but excluded so it does not eat an 8-seat. */
export const INVENTORY_OFFER_KEYS = SEAT_OFFER_KEYS;

export function getPublicReserveOfferBySku(value: unknown): PublicReserveOffer | null {
  return PUBLIC_RESERVE_OFFERS.find((offer) => offer.sku === value) ?? null;
}

export function getPublicReserveOfferByKey(value: unknown): PublicReserveOffer | null {
  return PUBLIC_RESERVE_OFFERS.find((offer) => offer.offerKey === value) ?? null;
}

export function getPayableReserveOffer(
  offerKey: string,
  amountCents: number,
  currency: string,
): ReserveOffer | null {
  if (currency !== RESERVE_CURRENCY) return null;
  return (
    PAYABLE_USD_OFFERS.find(
      (offer) => offer.offerKey === offerKey && offer.amountCents === amountCents,
    ) ?? null
  );
}

export function consumesInventorySeat(offerKey: string): boolean {
  return offerKey !== "hold-190";
}

export function isPayableOfferKey(value: string): boolean {
  return LIFECYCLE_OFFER_KEYS.includes(value as (typeof LIFECYCLE_OFFER_KEYS)[number]);
}

export function isInventoryOfferKey(value: string): boolean {
  return isPayableOfferKey(value);
}

/** Env names only. Live Price IDs stay in host secrets and are never committed. */
const STRIPE_PRICE_ENV_BY_SKU: Record<string, string> = {
  "hold-190": "STRIPE_PRICE_HOLD_190",
  "reserve-490": "STRIPE_PRICE_RESERVE_490",
  "reserve-899": "STRIPE_PRICE_RESERVE_899",
};

export function stripePriceIdForSku(sku: string): string | null {
  const envName = STRIPE_PRICE_ENV_BY_SKU[sku];
  if (!envName) return null;
  const value = process.env[envName]?.trim();
  return value ? value : null;
}

type CheckoutLineOffer = {
  sku: string;
  offerKey: string;
  name: string;
  amountCents: number;
  offerType: string;
  scope: string;
};

export function reserveCheckoutLineItem(offer: CheckoutLineOffer):
  | { price: string; quantity: 1 }
  | {
      price_data: {
        currency: typeof RESERVE_CURRENCY;
        unit_amount: number;
        product_data: {
          name: string;
          description: string;
          metadata: { sku: string; offerKey: string; offerType: string };
        };
      };
      quantity: 1;
    } {
  const price = stripePriceIdForSku(offer.sku);
  if (price) return { price, quantity: 1 };
  return {
    price_data: {
      currency: RESERVE_CURRENCY,
      unit_amount: offer.amountCents,
      product_data: {
        name: `Birch Reserve — ${offer.name}`,
        description: offer.scope,
        metadata: {
          sku: offer.sku,
          offerKey: offer.offerKey,
          offerType: offer.offerType,
        },
      },
    },
    quantity: 1,
  };
}
