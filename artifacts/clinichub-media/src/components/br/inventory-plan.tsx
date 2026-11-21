/**
 * Spend-down pacing + 2027 modelled inventory + the $1,900 CAD exclusive reserve card
 * (Randy, voice, Nov 21 2026 9:59 AM ET). Numbers come from api-server/src/lib/inventoryPlan.ts only.
 * Short on the page, math in expanders. Every figure labelled modelled; no impression guarantee, no CTR/ROAS.
 */
import { ArrowRight } from "lucide-react";
import { Details } from "@/components/br/details";
import { PACING_ROWS, SPEND_DOWN_LINE, TAM_2027, VIEWS_PER_HUB_MONTHLY, BLENDED_STARTER_CPM, tam2027Headline, tam2027Views } from "../../../../api-server/src/lib/inventoryPlan";
import { EXCLUSIVE_RESERVE } from "../../../../api-server/src/lib/exclusiveReserveTerms";

const chip = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider";

export function SpendDown({ dark = false, testId = "spend-down" }: { dark?: boolean; testId?: string }) {
  const th = `px-2 py-1.5 text-left font-semibold ${dark ? "text-white/80" : "text-[#0b1f3a]"}`;
  const td = "px-2 py-1.5 align-top tabular-nums";
  return (
    <div data-testid={testId}>
      <p className={`text-[13px] ${dark ? "text-white/80" : "text-foreground/75"}`} data-testid={`${testId}-line`}>
        <span className={`${chip} mr-1.5 ${dark ? "bg-white/10 text-lime-200" : "border border-[#F1D58F] bg-[#FFF4DB] text-[#8A5A00]"}`}>Modelled</span>
        {SPEND_DOWN_LINE}
      </p>
      <Details dark={dark} label="Monthly pacing over 6 months" testId={`${testId}-details`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-[12px]">
            <thead><tr><th className={th}>Item</th><th className={th}>Credit</th><th className={th}>Over 6 months</th><th className={th}>Modelled views</th></tr></thead>
            <tbody>
              {PACING_ROWS.map((r) => (
                <tr key={r.key} className={dark ? "border-t border-white/10" : "border-t border-[#0b1f3a]/10"} data-testid={`pace-${r.key}`}>
                  <td className={td}>{r.label}{r.note ? <span className="block opacity-70">{r.note}</span> : null}</td>
                  <td className={td}>{r.credit}</td>
                  <td className={td}>{r.perMonth}</td>
                  <td className={td}>{r.viewsPerMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Straight-line over 6 months at the ${BLENDED_STARTER_CPM.toFixed(2)} USD blended starter CPM from the rate card. Spend faster if you like; the IO sets pacing. Modelled, not a delivery promise. No impression guarantee. Reporting is aggregate only.</p>
      </Details>
    </div>
  );
}

export function Tam2027({ compact = false, dark = false, testId = "tam-2027" }: { compact?: boolean; dark?: boolean; testId?: string }) {
  const [lo, base] = TAM_2027.cases;
  const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
  return (
    <div className={compact ? "" : `rounded-2xl p-5 ${dark ? "bg-white/[0.06] ring-1 ring-white/15 text-white" : "border border-[#0b1f3a]/10 bg-white shadow-sm"}`} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${dark ? "text-lime-300" : "text-[#0b1f3a]/70"}`}>2027 ad inventory, based on signed partnership contracts</span>
        <span className={`${chip} ${dark ? "bg-white/10 text-lime-200" : "border border-[#F1D58F] bg-[#FFF4DB] text-[#8A5A00]"}`}>Signed contracts</span>
      </div>
      <p className={`mt-2 font-display leading-none tabular-nums ${compact ? "text-[1.9rem] md:text-[2.4rem]" : "text-4xl md:text-5xl"}`} data-testid={`${testId}-figure`}>{tam2027Headline()}</p>
      <p className={`mt-1.5 text-[12px] md:text-sm ${dark ? "text-white/70" : "text-foreground/70"}`}>a year in hub display, growing with the network. {TAM_2027.label}.</p>
      <Details dark={dark} label="How we get there" testId={`${testId}-math`}>
        <p><b>{lo.label}:</b> {lo.hubs} hubs × {VIEWS_PER_HUB_MONTHLY.toLocaleString("en-US")} views/hub/mo × 12 × ${BLENDED_STARTER_CPM.toFixed(2)} CPM ÷ 1,000 = {money(lo.usdYear)}.</p>
        <p><b>{base.label}:</b> {base.hubs} hubs × the same = {money(base.usdYear)}.</p>
        <p>Range: {tam2027Views()} a year.</p>
        {TAM_2027.basis.map((b) => <p key={b}>{b}</p>)}
      </Details>
    </div>
  );
}

export function ExclusiveReserveCard({ where, dark = true }: { where: string; dark?: boolean }) {
  const href = `https://birchreserve.net/exclusive?utm_source=birchreserve&utm_medium=next-step&utm_campaign=${encodeURIComponent(`${where}-exclusive-1900`)}`;
  return (
    <article className={`flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between md:gap-4 ${dark ? "bg-white/[0.06] ring-1 ring-lime-300/60" : "border border-[#0b1f3a]/15 bg-white shadow-sm"}`} data-testid="exclusive-reserve-card">
      <div>
        <p className={`text-[11px] font-bold uppercase tracking-wider ${dark ? "text-white/60" : "text-[#0b1f3a]/60"}`}>Exclusive display reserve · one brand per category</p>
        <p className="mt-1 font-display text-2xl leading-none">{EXCLUSIVE_RESERVE.label}</p>
        <p className={`mt-1 text-[13px] ${dark ? "text-white/75" : "text-foreground/75"}`}>Locks a {EXCLUSIVE_RESERVE.packageRange} CAD exclusive package at {EXCLUSIVE_RESERVE.discountPct}% below the regular rate. All $1,900 counts toward it. IO before anything runs.</p>
      </div>
      <a href={href} className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold ${dark ? "bg-lime-300 text-[#0b1f3a] hover:bg-white" : "bg-[#0b1f3a] text-white"}`} data-testid="exclusive-reserve-cta">
        Reserve $1,900 CAD <ArrowRight className="size-4" />
      </a>
    </article>
  );
}
