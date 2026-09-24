/**
 * Runtime checkout switch (GET /api/launch/checkout-status, backed by the server's
 * STRIPE_CHECKOUT_DISABLED + Stripe config). While checkout is paused, the homepage
 * Lock the seat / Hold CTAs open the Randy chat callback intake with the seat and
 * category preselected; when checkout is re-enabled they fall back to the normal
 * checkout dialog. Unknown / failed lookups count as paused (checkout is OFF).
 */
import { useEffect, useState } from "react";

export type SeatSku = "hold-190" | "reserve-490";

export function reserveIntakeNeed(sku: SeatSku, category?: string): string {
  const seat = sku === "hold-190" ? "Hold $190 (7-day category hold)" : "Reserve $490 seat";
  const cat = category?.trim().replace(/_/g, " ");
  return (cat ? `${seat} — ${cat}` : seat).slice(0, 300);
}

export function parseCheckoutStatus(data: unknown): boolean {
  return Boolean(data && typeof data === "object" && (data as { checkoutEnabled?: unknown }).checkoutEnabled === true);
}

let cached: Promise<boolean> | null = null;

export function fetchCheckoutEnabled(): Promise<boolean> {
  cached ??= fetch("/api/launch/checkout-status", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then(parseCheckoutStatus)
    .catch(() => false);
  return cached;
}

export function useCheckoutEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    void fetchCheckoutEnabled().then((v) => live && setEnabled(v));
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
