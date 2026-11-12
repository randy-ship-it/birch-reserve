/** Pure Stripe Checkout param builders for the overhaul (area lock). Deposits reuse buildDepositSession. */
import { AREA_LOCK, quoteAreaLock, type Currency } from "./model";

export type AreaCheckoutRequest = {
  postal?: string;
  term?: number;
  category?: string;
  business?: string;
  website?: string;
  email?: string;
  currency?: string;
  agree?: boolean;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function buildAreaLockSession(body: AreaCheckoutRequest, origin: string):
  | { ok: false; error: string }
  | { ok: true; amountCents: number; currency: Currency; params: Record<string, unknown> } {
  const business = String(body.business ?? "").trim().slice(0, 160);
  const email = String(body.email ?? "").trim().slice(0, 200);
  const category = String(body.category ?? "").trim().slice(0, 80);
  if (!business || !EMAIL_RE.test(email)) return { ok: false, error: "Add your business name and a work email." };
  if (!category) return { ok: false, error: "Pick your category so we can hold it in your area." };
  if (body.agree !== true) return { ok: false, error: "Please agree to the draft area-lock terms." };
  const currency: Currency | undefined = body.currency === "cad" ? "cad" : body.currency === "usd" ? "usd" : undefined;
  const q = quoteAreaLock(String(body.postal ?? ""), Number(body.term ?? 3), currency);
  if (!q.ok) return { ok: false, error: q.error };
  const amountCents = q.price * 100;
  const metadata = {
    kind: "area_lock",
    postal: q.area.code,
    area: q.area.area,
    country: q.area.country,
    density: q.area.density,
    share_pct: String(q.sharePct),
    radius_km: String(q.radiusKm),
    term_months: String(q.termMonths),
    category,
    business,
    website: String(body.website ?? "").slice(0, 200),
    discount_pct: String(q.discountPct),
    credit_at_rate_card: String(q.creditAtRateCard),
    guaranteed_views_modelled: String(q.guaranteedViews),
    terms_version: AREA_LOCK.termsVersion,
  };
  return {
    ok: true,
    amountCents,
    currency: q.currency,
    params: {
      mode: "payment",
      customer_email: email,
      customer_creation: "always",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: q.currency,
            unit_amount: amountCents,
            product_data: {
              name: `Birch Reserve area lock · ${q.area.area} · ${category}`,
              description: `Exclusive ${category} rights to up to ${q.sharePct}% of hub display within ${q.radiusKm} km of ${q.area.code} for ${q.termMonths} month${q.termMonths === 1 ? "" : "s"} from display start. Includes media credit at ${q.discountPct}% off rate card and ${q.guaranteedViews.toLocaleString("en-US")} modelled hub page views.`,
            },
          },
        },
      ],
      metadata,
      payment_intent_data: { description: `Birch Reserve area lock · ${business} · ${q.area.area}`, metadata },
      success_url: `${origin}/advertise/local?lock=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/advertise/local?lock=cancelled&postal=${encodeURIComponent(q.area.code)}`,
    },
  };
}

/** Gate: flag on, key present, and live keys need the explicit live flag (Randy's go). */
export function checkoutGate(env: NodeJS.ProcessEnv, enabledVar: string, liveVar: string): { open: boolean; reason: string; mode: "test" | "live" | "none" } {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "none";
  if (env[enabledVar] !== "true") return { open: false, reason: `${enabledVar} is off`, mode };
  if (!key) return { open: false, reason: "no Stripe key", mode };
  if (mode === "live" && env[liveVar] !== "true") return { open: false, reason: `${liveVar} is off (live key)`, mode };
  return { open: true, reason: "open", mode };
}
