/** Estimated performance ranges (Randy pt453u, Nov 21 2026). Data in api-server/src/lib/overhaul/proofContent.ts. */
import { PERFORMANCE_RANGES as P, RANGES_LABEL, RANGE_METRICS, RANGE_SCALE_MAX, RANGE_SOURCES, fmtRange } from "../../../../api-server/src/lib/overhaul/proofContent";
import { Details } from "@/components/br/details";

const pct = (n: number) => `${(n / RANGE_SCALE_MAX) * 100}%`;

export function PerformanceRanges({ where }: { where: "home" | "media_kit" }) {
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-4 shadow-sm md:p-6" data-testid={`perf-ranges-${where}`} id={where === "media_kit" ? "performance-ranges" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{P.eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-[#0b1f3a] md:text-3xl">{P.title}</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/70"><span className="inline-block h-2.5 w-5 rounded-full bg-[#0b1f3a]/25" aria-hidden />Range <span className="ml-2 inline-block h-2.5 w-5 rounded-full bg-lime-400" aria-hidden />{P.hwLabel}</span>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-foreground/70">{P.lede}</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {P.rows.map((r) => (
          <li key={r.placement} className="min-w-0 rounded-2xl bg-[#f7faf0] p-4" data-testid={`perf-row-${r.placement.split(" ")[0].toLowerCase()}`}>
            {(() => { const [name, sub] = r.placement.split(/ \((.*)\)$/); return (<>
              <p className="font-display text-lg leading-tight text-[#0b1f3a]">{name}</p>
              <p className="text-[11px] leading-4 text-foreground/55 md:min-h-4">{sub ?? ""}</p>
            </>); })()}
            <div className="mt-2 space-y-3">
              {RANGE_METRICS.map((m) => {
                const b = r[m.key];
                return (
                  <div key={m.key}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]"><span className="text-foreground/60">{m.label}</span><span className="font-bold text-[#0b1f3a]">{fmtRange(b)}</span></div>
                    <div className="relative mt-1 h-3 rounded-full bg-[#0b1f3a]/10" role="img" aria-label={`${m.label} ${fmtRange(b)}; ${P.hwLabel} ${b.hwLo}% to ${b.hwHi}%`}>
                      <span className="absolute inset-y-0 rounded-full bg-[#0b1f3a]/30" style={{ left: pct(b.lo), width: pct(b.hi - b.lo) }} />
                      <span className="absolute inset-y-0.5 rounded-full bg-lime-400" style={{ left: pct(b.hwLo), width: pct(b.hwHi - b.hwLo) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-foreground/50" aria-hidden><span>0%</span><span>Scale 0% to {RANGE_SCALE_MAX}%</span><span>{RANGE_SCALE_MAX}%</span></div>
      <p className="mt-2 rounded-xl bg-amber-100 px-3 py-2 text-[12px] font-semibold leading-snug text-amber-900" data-testid={`perf-ranges-label-${where}`}>{RANGES_LABEL}.</p>
      <p className="mt-2 text-[12px] text-foreground/60">{P.note}</p>
      <Details label="Sources" testId={`perf-ranges-sources-${where}`}>
        <ul className="list-disc space-y-1 pl-5">{RANGE_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener nofollow" className="underline underline-offset-2">{s.label}</a></li>)}</ul>
      </Details>
    </div>
  );
}
