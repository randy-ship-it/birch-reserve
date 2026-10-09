import { useEffect, useState } from "react";

// Reserve List surfaces shared with scalehealth.ca/tam. Every number comes from the same public feed
// (birchreserve.net/inventory/api/tam, served by birch-inventory) so the two sites never diverge.
// Email capture posts to the same backend as /inventory and scalehealth.ca (Friday + Birch log, daily digest).
export const TAM_FEED = "/inventory/api/tam";
export const SUBSCRIBE_URL = "/inventory/api/subscribe";
export const SCALE_TAM_URL = "https://www.scalehealth.ca/tam?utm_source=birchreserve&utm_medium=referral&utm_campaign=reserve-list";
// Request access / brand onboarding slot: one href for every "Request access" CTA on birchreserve.net.
// It opens the request form on /inventory; swap this when the brand onboarding questionnaire ships.
// Reserve List onboarding questionnaire (birch-inventory, same page as scalehealth.ca/brands/onboard).
export const ONBOARD_HREF = "/inventory/onboard";
export const REQUEST_ACCESS_HREF = "/inventory#request-access";

type Cat = { category: string; pv_total: number; ctr_lo: number; ctr_hi: number; orders_yr: number };
export type TamFeed = {
  totals: Cat & { categories: number };
  categories: Cat[];
  assumptions?: Record<string, number | string>;
  pipeline: { live_orders: number; y2027_orders: number; labels: Record<string, string> };
};
export const FALLBACK_LABELS: Record<string, string> = {};

export function useTamFeed() {
  const [feed, setFeed] = useState<TamFeed | null>(null);
  useEffect(() => {
    let on = true;
    fetch(TAM_FEED, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (on && j && Array.isArray(j.categories) && j.pipeline?.labels) setFeed(j); })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  const labels = { ...FALLBACK_LABELS, ...(feed?.pipeline?.labels || {}) };
  return { feed, labels };
}

