/**
 * DRAFT volume-bonus tiers for larger category prepayments. NOT for sale: no SKU, no checkout,
 * hidden unless the page is opened with ?draft=bonus. The base prices ($190/$490 USD, $270/$690 CAD)
 * and the single-price hero are unchanged. Bonus is extra display credit, never a price cut.
 * Math and sources: /workspace/cad-shots/bonus-tier-draft.md
 */
import type { ReserveCurrency } from "./reserveOffers";

export type BonusTier = {
  key: string;
  label: string;
  bonusPct: number;
  prepay: Record<ReserveCurrency, number>;
};

/** CAD prepay = USD prepay x 1.40 (the base seat is 690/490 = 1.41), rounded to whole hundreds. */
export const BONUS_TIERS_DRAFT: readonly BonusTier[] = [
  { key: "prepay-3", label: "About 3 category seats", bonusPct: 5, prepay: { usd: 1500, cad: 2100 } },
  { key: "prepay-6", label: "About 6 category seats", bonusPct: 10, prepay: { usd: 3000, cad: 4200 } },
  { key: "prepay-12", label: "About 12 category seats", bonusPct: 15, prepay: { usd: 6000, cad: 8400 } },
] as const;

export function isBonusDraftRequested(query: { draft?: unknown }): boolean {
  return query.draft === "bonus";
}

export function bonusTierRow(tier: BonusTier, currency: ReserveCurrency) {
  const paid = tier.prepay[currency];
  const extra = Math.round((paid * tier.bonusPct) / 100);
  const credit = paid + extra;
  const effectiveDiscountPct = (tier.bonusPct / (100 + tier.bonusPct)) * 100;
  return { paid, extra, credit, effectiveDiscountPct };
}

const money = (n: number, currency: ReserveCurrency) => `$${n.toLocaleString("en-US")} ${currency.toUpperCase()}`;

export function renderBonusTierDraftHtml(currency: ReserveCurrency): string {
  const rows = BONUS_TIERS_DRAFT.map((tier) => {
    const r = bonusTierRow(tier, currency);
    return `<tr><td>${tier.label}</td><td>${money(r.paid, currency)}</td><td>+${tier.bonusPct}%</td><td>${money(r.extra, currency)}</td><td><strong>${money(r.credit, currency)}</strong></td><td>${r.effectiveDiscountPct.toFixed(1)}%</td></tr>`;
  }).join("");
  return `<section id="bonus-tier-draft" data-testid="bonus-tier-draft" style="border:2px dashed #9D4EDD;border-radius:8px;padding:20px;margin:28px 0;background:#faf6ff;color:#0A1D56">
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9D4EDD">Draft · not for sale · for internal review</p>
<h2 style="margin:0 0 8px">Volume prepay bonus (draft)</h2>
<p style="margin:0 0 12px;font-size:14px">Prepay more, get extra display credit. The base price does not change: one category seat is still ${currency === "cad" ? "$690 CAD" : "$490 USD"}. Bonus credit is added on top of the credit you pay for. Same 12-month expiry, same refund rule on the cash you paid.</p>
<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:14px" data-testid="bonus-tier-table"><thead><tr style="text-align:left;border-bottom:1px solid #0A1D5640"><th>Prepay level</th><th>You prepay</th><th>Bonus</th><th>Extra credit</th><th>Total display credit</th><th>Effective discount</th></tr></thead><tbody>${rows}</tbody></table></div>
<p style="margin:12px 0 0;font-size:12px;opacity:.8">Effective discount = bonus ÷ (1 + bonus). Prices shown in ${currency.toUpperCase()}. Draft numbers for review; no checkout is attached. Display credit, not airfare. No impression guarantee.</p>
</section>`;
}
