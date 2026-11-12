/**
 * Seat checkout session builder ($190 hold-190 / $490 reserve-490). Pure: returns
 * Stripe Checkout params; the route creates the session only when the gate is open.
 * Gate: SEATS_ENABLED=true, a Stripe key, and SEATS_LIVE=true for a live key
 * (same pattern as AREA_LOCK_ENABLED / AREA_LOCK_LIVE).
 */
import { checkoutGate } from "../overhaul/checkout";
import { categoryBySlug, seatSku, SEATS_VERSION } from "./catalog";

export type SeatCheckoutInput = {
  sku?: unknown;
  category?: unknown;
  brand?: unknown;
  email?: unknown;
  website?: unknown;
  currency?: unknown;
  test?: boolean;
  leadId?: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function seatsGate(env: NodeJS.ProcessEnv = process.env) {
  return checkoutGate(env, "SEATS_ENABLED", "SEATS_LIVE");
}

export function buildSeatSession(input: SeatCheckoutInput, origin: string):
  | { ok: false; error: string }
  | { ok: true; amountCents: number; currency: "usd" | "cad"; params: Record<string, unknown> } {
  const offer = seatSku(input.sku);
  if (!offer) return { ok: false, error: "Pick the $190 7-day look or the $490 category seat." };
  const cat = categoryBySlug(input.category);
  if (!cat) return { ok: false, error: "Pick your category." };
  const brand = s(input.brand, 160);
  const email = s(input.email, 200);
  if (!brand || !EMAIL_RE.test(email)) return { ok: false, error: "Add your brand and a work email." };
  const currency = s(input.currency, 3).toLowerCase() === "cad" ? "cad" : "usd";
  const amountCents = (currency === "cad" ? offer.cad : offer.usd) * 100;
  const metadata = {
    kind: "category_seat",
    sku: offer.sku,
    offer_key: offer.sku,
    category: cat.slug,
    category_label: cat.label,
    brand,
    website: s(input.website, 200),
    seats_version: SEATS_VERSION,
    is_test: input.test ? "true" : "false",
    // Friday externalId of the request; the paid webhook re-POSTs with the same id.
    ...(input.leadId ? { intake_external_id: s(input.leadId, 120) } : {}),
  };
  return {
    ok: true,
    amountCents,
    currency,
    params: {
      mode: "payment",
      customer_email: email,
      customer_creation: "always",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: `Birch Reserve ${offer.name} · ${cat.label}`,
              description: `${offer.line} Category: ${cat.label}. Aggregate reporting only. No impression guarantee.`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { description: `Birch Reserve ${offer.sku} · ${brand} · ${cat.label}`, metadata },
      success_url: `${origin}/buycalc?seat=success&sku=${offer.sku}&session_id={CHECKOUT_SESSION_ID}#seats`,
      cancel_url: `${origin}/buycalc?seat=cancelled&sku=${offer.sku}#seats`,
    },
  };
}
