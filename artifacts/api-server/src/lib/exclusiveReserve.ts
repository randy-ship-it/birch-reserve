/**
 * $1,900 CAD exclusive display reserve (Randy, voice, Nov 21 2026 9:59 AM ET).
 * Locks a $5K–$50K exclusive display package in one category at 25% below the regular rate.
 * One source for /exclusive, /terms, llms.txt and the Stripe line item, so they never drift.
 * CAD only for this one offer; every other public checkout stays USD.
 */
import type Stripe from "stripe";
import { CHECKOUT_TAGLINE } from "./checkoutCopy";
import { logger } from "./logger";
import { upsertLeadSafeDetailed } from "./leads";
import { queueFridayPush } from "./fridayPush";
import { isTestIdentity } from "./testTraffic";

export { EXCLUSIVE_RESERVE, EXCLUSIVE_RESERVE_NAME, EXCLUSIVE_RESERVE_DESCRIPTION, EXCLUSIVE_RESERVE_TERMS } from "./exclusiveReserveTerms";
import { EXCLUSIVE_RESERVE, EXCLUSIVE_RESERVE_NAME, EXCLUSIVE_RESERVE_DESCRIPTION } from "./exclusiveReserveTerms";

export type ReserveRequest = { brand?: unknown; email?: unknown; category?: unknown; agree?: unknown };

/** Pure: validate and build Stripe Checkout params (inline price_data in CAD). */
export function buildExclusiveReserveSession(body: ReserveRequest, origin: string):
  | { ok: false; error: string }
  | { ok: true; params: Record<string, unknown> } {
  const brand = String(body.brand ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 160);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const category = String(body.category ?? "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 80);
  if (!brand || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Add your brand and a work email." };
  if (body.agree !== true) return { ok: false, error: "Please agree to the reserve terms." };
  const metadata = {
    kind: EXCLUSIVE_RESERVE.kind,
    sku: EXCLUSIVE_RESERVE.sku,
    brand,
    category,
    terms_version: EXCLUSIVE_RESERVE.termsVersion,
  };
  return {
    ok: true,
    params: {
      mode: "payment",
      customer_email: email,
      customer_creation: "always",
      // Live Price (Stripe product "Exclusive display reserve ($1,900 CAD)") when STRIPE_PRICE_EXCLUSIVE_1900_CAD is set; inline CAD price_data otherwise.
      line_items: [process.env.STRIPE_PRICE_EXCLUSIVE_1900_CAD?.trim() ? { price: process.env.STRIPE_PRICE_EXCLUSIVE_1900_CAD.trim(), quantity: 1 } : {
        quantity: 1,
        price_data: {
          currency: EXCLUSIVE_RESERVE.currency,
          unit_amount: EXCLUSIVE_RESERVE.amountCents,
          product_data: { name: EXCLUSIVE_RESERVE_NAME, description: EXCLUSIVE_RESERVE_DESCRIPTION, metadata: { sku: EXCLUSIVE_RESERVE.sku } },
        },
      }],
      metadata,
      payment_intent_data: {
        statement_descriptor_suffix: EXCLUSIVE_RESERVE.statementSuffix,
        description: `${CHECKOUT_TAGLINE} Exclusive display reserve · ${brand}${category ? ` · ${category}` : ""}`.slice(0, 1000),
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
      need: `Paid Birch Reserve exclusive display reserve ($1,900 CAD)${session.metadata?.category ? ` · ${session.metadata.category}` : ""}`,
      isTest,
      meta: {
        paid: true,
        stripe_session_id: session.id,
        sku: EXCLUSIVE_RESERVE.sku,
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
