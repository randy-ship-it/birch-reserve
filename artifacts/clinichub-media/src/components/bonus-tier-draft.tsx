import { useCurrency, type Currency } from "@/lib/currency";

// DRAFT volume-bonus tiers. Shown only with ?draft=bonus; no checkout is attached and the base price is unchanged.
// Same table as api-server/src/lib/bonusTierDraft.ts. Math and sources: bonus-tier-draft.md.
const TIERS = [
  { key: "prepay-3", label: "About 3 category seats", bonusPct: 5, prepay: { usd: 1500, cad: 2100 } },
  { key: "prepay-6", label: "About 6 category seats", bonusPct: 10, prepay: { usd: 3000, cad: 4200 } },
  { key: "prepay-12", label: "About 12 category seats", bonusPct: 15, prepay: { usd: 6000, cad: 8400 } },
] as const;

const money = (n: number, c: Currency) => `$${n.toLocaleString("en-US")} ${c.toUpperCase()}`;

export function isBonusDraftRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("draft") === "bonus";
}

export function BonusTierDraft() {
  const { currency } = useCurrency();
  return (
    <section id="bonus-tier-draft" data-testid="bonus-tier-draft" className="rounded-lg border-2 border-dashed border-[#9D4EDD] bg-[#faf6ff] p-5 text-[#0A1D56] md:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9D4EDD]">Draft · not for sale · for internal review</p>
      <h2 className="mt-1 text-2xl font-bold">Volume prepay bonus (draft)</h2>
      <p className="mt-2 text-sm">Prepay more, get extra display credit. The base price does not change: one category seat is still {currency === "cad" ? "$690 CAD" : "$490 USD"}. Bonus credit is added on top of the credit you pay for. Same 12-month expiry, same refund rule on the cash you paid.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm" data-testid="bonus-tier-table">
          <thead><tr className="border-b border-[#0A1D56]/25"><th className="py-2 pr-3">Prepay level</th><th className="pr-3">You prepay</th><th className="pr-3">Bonus</th><th className="pr-3">Extra credit</th><th className="pr-3">Total display credit</th><th>Effective discount</th></tr></thead>
          <tbody>
            {TIERS.map((t) => {
              const paid = t.prepay[currency];
              const extra = Math.round((paid * t.bonusPct) / 100);
              return (
                <tr key={t.key} className="border-b border-[#0A1D56]/10">
                  <td className="py-2 pr-3">{t.label}</td><td className="pr-3">{money(paid, currency)}</td><td className="pr-3">+{t.bonusPct}%</td>
                  <td className="pr-3">{money(extra, currency)}</td><td className="pr-3 font-semibold">{money(paid + extra, currency)}</td>
                  <td>{((t.bonusPct / (100 + t.bonusPct)) * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs opacity-80">Effective discount = bonus ÷ (1 + bonus). Prices shown in {currency.toUpperCase()}. Draft numbers for review; no checkout is attached. Display credit, not airfare. No impression guarantee.</p>
    </section>
  );
}
