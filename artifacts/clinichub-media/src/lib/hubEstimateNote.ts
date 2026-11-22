/** Hub calculator answers carried into the intake lead notes (tagged "Hub estimate inputs"). Session-only, no PII. */
const K = "br_hub_estimate_v1";
export type HubEstimateSaved = { orders: number; visitors: number; newsletterList: number; locations: number | null; cart: number; level: string; likelyMonthlyUsd: number; lowUsd: number; highUsd: number; currency: string };
export function saveHubEstimate(v: HubEstimateSaved) {
  try { sessionStorage.setItem(K, JSON.stringify(v)); } catch { /* storage blocked */ }
}
export function hubEstimateNote(): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(K) || "null") as HubEstimateSaved | null;
    if (!v || !(v.orders > 0 || v.visitors > 0)) return null;
    const r = (n: number) => Math.round(n).toLocaleString("en-US");
    return `Hub estimate inputs: ${r(v.orders)} orders/mo; ${r(v.visitors)} website visitors/mo; newsletter list ${v.newsletterList ? r(v.newsletterList) : "none"}; locations ${v.locations ?? "not given"}; avg order value $${r(v.cart)} ${v.currency.toUpperCase()}; performance ${v.level}. Estimate (model USD): $${r(v.likelyMonthlyUsd)}/mo likely ($${r(v.lowUsd)}-$${r(v.highUsd)}). Viewed in ${v.currency.toUpperCase()}.`.slice(0, 480);
  } catch { return null; }
}
