/**
 * $1,900 starter placement (Randy, Nov 26 2026: keep the price, drop reserve/exclusive/lock framing).
 * Holds a $5K–$50K dedicated package in one category pending the IO; refunded if you are bumped by another advertiser before you have finalized payment.
 * One source for /exclusive and /starter, /terms, llms.txt and the Stripe line item, so they never drift.
 * Geo currency since Nov 21 2026 3:34 PM ET: the same $1,900 in CAD (Canada) or USD (everyone else),
 * charged in the currency the page showed (body.currency).
 */
import type Stripe from "stripe";
import { CHECKOUT_TAGLINE } from "./checkoutCopy";
import { logger } from "./logger";
import { upsertLeadSafeDetailed } from "./leads";
import { queueFridayPush } from "./fridayPush";
import { isTestIdentity } from "./testTraffic";

export { EXCLUSIVE_RESERVE, EXCLUSIVE_RESERVE_NAME, EXCLUSIVE_RESERVE_DESCRIPTION, EXCLUSIVE_RESERVE_TERMS, exclusiveReserveFor } from "./exclusiveReserveTerms";
import { EXCLUSIVE_RESERVE, EXCLUSIVE_RESERVE_DESCRIPTION, exclusiveReserveFor } from "./exclusiveReserveTerms";

export type ReserveRequest = { brand?: unknown; email?: unknown; category?: unknown; agree?: unknown; currency?: unknown };

/** Pure: validate and build Stripe Checkout params. body.currency "usd" charges USD; anything else CAD (the original offer). */
export function buildExclusiveReserveSession(body: ReserveRequest, origin: string, site: "birch" | "scale" = "birch"):
  | { ok: false; error: string }
  | { ok: true; params: Record<string, unknown> } {
  const brand = String(body.brand ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 160);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const category = String(body.category ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 80);
  if (!brand || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Add your brand and a work email." };
  if (body.agree !== true) return { ok: false, error: "Please agree to the placement terms." };
  const offer = exclusiveReserveFor(String(body.currency ?? "").toLowerCase() === "usd" ? "usd" : "cad");
  // Scale mirror checkouts name the product "Scale Health — …" (same amount and currency), so they use inline price_data instead of the Birch-named Stripe Price.
  const envPrice = site === "scale" ? undefined : offer.currency === "cad" ? process.env.STRIPE_PRICE_EXCLUSIVE_1900_CAD?.trim() : process.env.STRIPE_PRICE_EXCLUSIVE_1900_USD?.trim();
  const metadata = {
    kind: EXCLUSIVE_RESERVE.kind,
    sku: offer.sku,
    currency: offer.currency,
    brand,
    category,
    terms_version: EXCLUSIVE_RESERVE.termsVersion,
  };
  return {
    ok: true,
    params: {
      mode: "payment",
      // Charge exactly the currency the page showed: no Stripe Adaptive Pricing re-pricing at checkout.
      adaptive_pricing: { enabled: false },
      customer_email: email,
      customer_creation: "always",
      // Live Price when STRIPE_PRICE_EXCLUSIVE_1900_<CUR> is set (CAD has one); inline price_data in the shown currency otherwise.
      line_items: [envPrice ? { price: envPrice, quantity: 1 } : {
        quantity: 1,
        price_data: {
          currency: offer.currency,
          unit_amount: offer.amountCents,
          product_data: { name: site === "scale" ? `Scale Health — Starter placement ($1,900 ${offer.currency.toUpperCase()})` : offer.name, description: EXCLUSIVE_RESERVE_DESCRIPTION, metadata: { sku: offer.sku } },
        },
      }],
      metadata,
      payment_intent_data: {
        statement_descriptor_suffix: EXCLUSIVE_RESERVE.statementSuffix,
        description: `${CHECKOUT_TAGLINE} Starter placement · ${brand}${category ? ` · ${category}` : ""}`.slice(0, 1000),
        metadata,
      },
      custom_text: { submit: { message: "Card now. Nothing runs until you sign an insertion order. Refundable until 14 days before the IO launch date." } },
      success_url: `${origin}/exclusive?reserve=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/exclusive?reserve=cancelled`,
    },
  };
}

/** Paid reserve → one leads row (Friday push). Never throws, so Stripe always gets its 2xx. */
export async function recordPaidExclusiveReserveSafe(session: Stripe.Checkout.Session): Promise<"recorded" | "ignored" | "error"> {
  try {
    if (session.payment_status !== "paid" || session.metadata?.kind !== EXCLUSIVE_RESERVE.kind) return "ignored";
    const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    const brand = session.metadata?.brand || undefined;
    const isTest = !session.livemode || isTestIdentity({ email: email || null, name: brand ?? null });
    const res = await upsertLeadSafeDetailed({
      id: `reserve:${session.id}`,
      source: "checkout",
      sourceRef: session.id,
      email: email || undefined,
      company: brand,
      need: `Paid Birch Reserve starter placement ($1,900 ${String(session.currency ?? "cad").toUpperCase()})${session.metadata?.category ? ` · ${session.metadata.category}` : ""}`,
      isTest,
      meta: {
        paid: true,
        stripe_session_id: session.id,
        sku: session.metadata?.sku || EXCLUSIVE_RESERVE.sku,
        value: (session.amount_total ?? EXCLUSIVE_RESERVE.amountCents) / 100,
        currency: String(session.currency ?? "cad").toLowerCase(),
        ...(session.metadata?.category ? { category: session.metadata.category } : {}),
      } as never,
    });
    if (!res) return "error";
    if (!isTest) queueFridayPush(res.lead.id);
    return "recorded";
  } catch (error) {
    logger.warn({ stripeSession: session?.id, err: error instanceof Error ? error.message : String(error) }, "Paid exclusive reserve record failed (webhook still 2xx)");
    return "error";
  }
}
