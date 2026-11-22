/**
 * "What your flight report shows" (Randy t450u, Nov 21 2026): compact sample aggregate report card, home (near the
 * packs) and media kit. Round, obviously illustrative numbers, watermarked. Data lives in
 * api-server/src/lib/overhaul/proofContent.ts so the no-JS HTML and llms.txt say the same thing.
 */
import { ArrowRight } from "lucide-react";
import { FLIGHT_REPORT_EXAMPLE as R, FLIGHT_REPORT_HREF } from "../../../../api-server/src/lib/overhaul/proofContent";

export function FlightReportExample({ where }: { where: "home" | "media_kit" }) {
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-4 shadow-sm md:p-6" data-testid={`flight-report-${where}`} id={where === "media_kit" ? "flight-report" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{R.eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-[#0b1f3a] md:text-3xl">{R.title}</h2>
        </div>
        <span className="max-w-full rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900" data-testid={`flight-report-watermark-${where}`}>{R.watermark}</span>
      </div>
      <p className="mt-2 max-w-2xl text-sm font-semibold text-[#0b1f3a]" data-testid={`flight-report-soon-${where}`}>{R.soon}</p>
      <p className="mt-1 max-w-2xl text-sm text-foreground/70">{R.lede}</p>
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-dashed border-[#0b1f3a]/25 bg-[#f7faf0] p-3 md:p-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"><span className="-rotate-12 select-none whitespace-nowrap text-3xl font-black uppercase tracking-widest text-[#0b1f3a]/[0.06] md:text-5xl">Example</span></div>
        <dl className="relative grid grid-cols-2 gap-2 md:grid-cols-4">
          {R.stats.map((s) => (
            <div key={s.k} className="min-w-0 rounded-xl bg-white p-3 shadow-sm">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">{s.k}</dt>
              <dd className="mt-0.5 font-display text-xl leading-tight text-[#0b1f3a] md:text-2xl">{s.v}</dd>
            </div>
          ))}
        </dl>
        <div className="relative mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">{R.pacing.label} · {R.pacing.pct}%</p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#0b1f3a]/10" role="img" aria-label={`${R.pacing.pct} percent of credit used`}><div className="h-full rounded-full bg-lime-400" style={{ width: `${R.pacing.pct}%` }} /></div>
            <p className="mt-2 text-[12px] text-foreground/70">{R.pacing.note}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">Views by surface</p>
            <ul className="mt-2 space-y-1.5">
              {R.surfaces.map((s) => (
                <li key={s.k} className="flex items-center gap-2 text-[12px] text-foreground/80">
                  <span className="w-28 shrink-0 truncate md:w-40" title={s.k}>{s.k}</span>
                  <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#0b1f3a]/10"><span className="block h-full rounded-full bg-[#0b1f3a]" style={{ width: `${s.pct}%` }} /></span>
                  <span className="w-9 shrink-0 text-right font-semibold">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={FLIGHT_REPORT_HREF} data-testid={`flight-report-dashboard-${where}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]">
          {R.cta} <ArrowRight className="size-4" aria-hidden />
        </a>
        <p className="w-full min-w-0 text-[12px] text-foreground/60 md:w-auto md:flex-1">{R.note}</p>
      </div>
    </div>
  );
}
