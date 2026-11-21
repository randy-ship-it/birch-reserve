/**
 * Street 100 net price (Randy, Nov 21 2026): STREET100 takes $100 USD off a card order, server-validated, and the order's
 * campaign still carries the full media amount (paid + the $100 promo credit that promo.afterOrderCampaign records).
 * Everything is decided on the server from the code row; the browser only sends the code it already holds.
 */
import type Stripe from "stripe";
import { currentPromoCtx } from "./promoContext";
import { findCode, codeProblem, validateCode, validEmail, cleanEmail } from "./promo";
import { MICROS } from "./config";
import { ensureUsdAmountOffCoupon } from "../stripeClient";

let ensureCoupon = ensureUsdAmountOffCoupon;
/** Tests only: stand in for Stripe. */
export function setCouponEnsurerForTests(f?: typeof ensureUsdAmountOffCoupon): void {
  if (process.env.NODE_ENV !== "test") throw new Error("test only");
  ensureCoupon = f ?? ensureUsdAmountOffCoupon;
}

/** The discount label buyers see on the Stripe checkout page and receipt. Never the code itself (Randy, Nov 21 2026: "don't disclose it"). */
export const STREET_COUPON_NAME = "$100 media credit";

export type NetDiscount = { couponId: string; cents: number; code: string };

/** The discount to apply to a checkout of `amountCents` USD for `email`, or null (no code, bad code, used, or order too small). */
export async function streetNetDiscount(o: { email?: string | null; currency: string; amountCents: number; code?: string | null }): Promise<NetDiscount | null> {
  const code = (o.code ?? currentPromoCtx()?.code ?? "").trim();
  if (!code || o.currency !== "usd") return null;
  const c = await findCode(code);
  if (!c || c.codeKey !== "street100" || codeProblem(c) || c.currency !== "usd") return null;
  const cents = Math.round(c.creditMicros / (MICROS / 100));
  if (cents <= 0 || o.amountCents < cents + 5000) return null; // never take an order to (almost) free
  const email = cleanEmail(o.email);
  if (!email || !validEmail(email)) return null;
  const v = await validateCode(code, email);
  if (!v.ok) return null;
  const couponId = await ensureCoupon(`street100-usd-${cents}`, cents, STREET_COUPON_NAME);
  return { couponId, cents, code: c.code };
}

/** Add the discount + audit metadata to a checkout request. Never throws: a failure just means the normal price. */
export async function withStreetNet(req: Stripe.Checkout.SessionCreateParams, amountCents: number, currency: string, email: string | null | undefined, code?: string | null): Promise<Stripe.Checkout.SessionCreateParams> {
  try {
    const d = await streetNetDiscount({ email, currency, amountCents, code });
    if (!d) return req;
    // Stripe rejects discounts together with allow_promotion_codes, even when it is false.
    const { allow_promotion_codes: _drop, ...rest } = req;
    return { ...rest, discounts: [{ coupon: d.couponId }], metadata: { ...(req.metadata ?? {}), promo: d.code, promo_net_cents: String(d.cents) } };
  } catch {
    return req;
  }
}

/** Expected Stripe amount_total for a reservation, allowing the server-set Street 100 net discount carried in metadata. */
export function expectedAmountTotal(session: { metadata?: Record<string, string> | null }, baseCents: number): number {
  const n = Number(session.metadata?.promo_net_cents ?? 0);
  return Number.isInteger(n) && n > 0 && n < baseCents ? baseCents - n : baseCents;
}
