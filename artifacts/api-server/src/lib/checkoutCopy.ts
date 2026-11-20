/**
 * One line for checkout and offer copy (Randy, voice, Nov 19 2026 10:13 PM ET).
 * Pure module: safe for the API and the browser bundle.
 */
export const CHECKOUT_TAGLINE = "Buy Scale Health ads through Birch Reserve." as const;

/**
 * Card statement descriptor suffix for every Birch Checkout Session we create.
 * Stripe joins it to the account's shortened descriptor prefix: "BIRCHRSV* SCALE ADS" (19 of 22 chars).
 * Rules (Stripe, card payments): suffix only, latin letters/digits/spaces, at least one letter, no < > \ ' " *,
 * and prefix + "* " + suffix must be 22 characters or fewer. The full statement_descriptor is not allowed on
 * card PaymentIntents, so we never set it.
 */
export const STATEMENT_DESCRIPTOR_SUFFIX = "SCALE ADS" as const;

/** payment_intent_data fields our Birch checkout sessions always carry. */
export function birchPaymentIntentBrand(detail?: string): { statement_descriptor_suffix: string; description: string } {
  const d = detail?.trim();
  return { statement_descriptor_suffix: STATEMENT_DESCRIPTOR_SUFFIX, description: d ? `${CHECKOUT_TAGLINE} ${d}`.slice(0, 1000) : CHECKOUT_TAGLINE };
}
