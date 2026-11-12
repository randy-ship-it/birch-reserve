import { isStripeSecretConfigured } from "./stripeClient";
import { checkoutGate } from "./overhaul/checkout";

/** Public https origin for Stripe return URLs, or null when not configured. */
export function configuredPublicAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.PUBLIC_BASE_URL?.trim() || env.SPLASH_AD_PUBLIC_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      return url.protocol === "https:" ? url.origin : null;
    } catch {
      return null;
    }
  }
  const domain = env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  return domain ? `https://${domain}` : null;
}

/** Same rule as GET /api/launch/checkout-status (checkoutEnabled): the $190 / $490 checkout. */
export function isReserveCheckoutConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.STRIPE_CHECKOUT_DISABLED !== "true" && configuredPublicAppUrl(env) && isStripeSecretConfigured());
}

export type SiteCheckoutState = { reserve: boolean; areaLock: boolean; deposits: boolean };

/** Live checkout flags, matching /api/launch/checkout-status and /v1/overhaul/status. */
export function siteCheckoutState(env: NodeJS.ProcessEnv = process.env): SiteCheckoutState {
  return {
    reserve: isReserveCheckoutConfigured(env),
    areaLock: checkoutGate(env, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE").open,
    deposits: checkoutGate(env, "SPONSOR_DEPOSITS_ENABLED", "SPONSOR_DEPOSITS_LIVE").open,
  };
}
