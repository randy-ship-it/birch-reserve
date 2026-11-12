export const RESERVE_CURRENCY = "usd" as const;

/** Currencies a public buyer can pay in. USD is the default for everyone not in Canada. */
export const RESERVE_CURRENCIES = ["usd", "cad"] as const;
export type ReserveCurrency = (typeof RESERVE_CURRENCIES)[number];

export function parseReserveCurrency(value: unknown): ReserveCurrency | null {
  if (typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  return (RESERVE_CURRENCIES as readonly string[]).includes(lower)
    ? (lower as ReserveCurrency)
    : null;
}

/**
 * Local CAD prices for the two public SKUs, in cents. These are rounded local
 * prices (nearest $10), not a live FX conversion, so the page, the Stripe page
 * and the ledger always show the same number.
 * Basis: Bank of Canada FXUSDCAD 1.3993 on 2026-10-23 -> $190 = C$265.87,
 * $490 = C$685.66, rounded to C$270 and C$690.
 */
export const PUBLIC_CAD_AMOUNT_CENTS = {
  "hold-190": 27_000,
  "reserve-490": 69_000,
} as const satisfies Record<string, number>;

export function offerAmountCents(
  offer: { sku: string; amountCents: number },
  currency: ReserveCurrency,
): number {
  if (currency === "cad") {
    const cad = (PUBLIC_CAD_AMOUNT_CENTS as Record<string, number>)[offer.sku];
    if (cad === undefined) {
      throw new Error(`No CAD price for ${offer.sku}.`);
    }
    return cad;
  }
  return offer.amountCents;
}

/** Offer scope text with its dollar figure in the buyer's currency. */
export function offerScope(
  offer: { sku: string; amountCents: number; scope: string },
  currency: ReserveCurrency,
): string {
  if (currency === RESERVE_CURRENCY) return offer.scope;
  const usd = `$${offer.amountCents / 100}`;
  const local = `$${offerAmountCents(offer, currency) / 100} ${currency.toUpperCase()}`;
  return offer.scope.split(usd).join(local);
}

/**
 * Rewrite static USD price copy into CAD. "$490 USD" and bare "$490" become the
 * CAD seat price, "$190 USD" and bare "$190" become the CAD look price.
 * Use on server-rendered pages after the template is built; never on money
 * that is not one of the two public SKUs.
 */
export function localizeReservePriceCopy(
  html: string,
  currency: ReserveCurrency,
): string {
  if (currency === RESERVE_CURRENCY) return html;
  let out = html;
  for (const offer of PUBLIC_RESERVE_OFFERS) {
    const usd = `$${offer.amountCents / 100}`;
    const local = offerPriceLabel(offer, currency);
    out = out.split(`${usd} USD`).join(local);
    out = out.replace(new RegExp(`\\${usd}(?![0-9,.])`, "g"), local);
  }
  return out;
}

/** "$190 USD" / "$270 CAD" — the exact label shown to the buyer. */
export function offerPriceLabel(
  offer: { sku: string; amountCents: number },
  currency: ReserveCurrency,
): string {
  const cents = offerAmountCents(offer, currency);
  const whole = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
  return `$${whole} ${currency.toUpperCase()}`;
}

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

/** Campaign deposit is fully refundable until this many days before the launch date written in the insertion order. */
export const PREPAY_REFUND_CUTOFF_DAYS = 14;

export const PUBLIC_RESERVE_OFFERS = [
  {
    sku: "hold-190",
    offerKey: "hold-190",
    name: "7-day category look",
    amountCents: 19_000,
    dueTodayUsd: 190,
    offerType: "category_look",
    scope:
      "Hold your category for 7 days. 100% credit if you convert to the full reserve within 7 days, else refund. Does not lock in a slot.",
    bestFor: "Brands that want a short look at one category before locking in a slot.",
    consumesSeat: false,
    published: true,
  },
  {
    sku: "reserve-490",
    offerKey: "reserve-490",
    name: "Category prepay",
    amountCents: 49_000,
    dueTodayUsd: 490,
    offerType: "category_seat",
    scope:
      "Prepay your category. All $490 becomes display credit in your category (not airfare). Fully refundable until 14 days before your launch date. The insertion order names the hub before anything runs. Credit expires 12 months.",
    bestFor: "Brands prepaying one category slot across listed hubs.",
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
  if (currency === "cad") {
    return (
      PUBLIC_RESERVE_OFFERS.find(
        (offer) =>
          offer.offerKey === offerKey &&
          PUBLIC_CAD_AMOUNT_CENTS[offer.sku] === amountCents,
      ) ?? null
    );
  }
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

/** Optional CAD Price IDs. When unset, CAD checkout uses inline price_data in cad. */
const STRIPE_CAD_PRICE_ENV_BY_SKU: Record<string, string> = {
  "hold-190": "STRIPE_PRICE_HOLD_190_CAD",
  "reserve-490": "STRIPE_PRICE_RESERVE_490_CAD",
};

export function stripePriceIdForSku(
  sku: string,
  currency: ReserveCurrency = RESERVE_CURRENCY,
): string | null {
  const envName = (currency === "cad"
    ? STRIPE_CAD_PRICE_ENV_BY_SKU
    : STRIPE_PRICE_ENV_BY_SKU)[sku];
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

export function reserveCheckoutLineItem(
  offer: CheckoutLineOffer,
  currency: ReserveCurrency = RESERVE_CURRENCY,
):
  | { price: string; quantity: 1 }
  | {
      price_data: {
        currency: ReserveCurrency;
        unit_amount: number;
        product_data: {
          name: string;
          description: string;
          metadata: { sku: string; offerKey: string; offerType: string };
        };
      };
      quantity: 1;
    } {
  const price = stripePriceIdForSku(offer.sku, currency);
  if (price) return { price, quantity: 1 };
  return {
    price_data: {
      currency,
      unit_amount: offerAmountCents(offer, currency),
      product_data: {
        name: `Birch Reserve — ${offer.name}`,
        description: offerScope(offer, currency),
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
