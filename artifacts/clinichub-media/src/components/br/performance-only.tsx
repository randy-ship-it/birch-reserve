/** "Performance only" card (Randy voice, Nov 21 2026): short and visual, detail collapsed. Copy: api-server/src/lib/overhaul/performanceOnly.ts. */
import { ArrowRight, Code2, ShoppingBag, Receipt, UserRound, Zap } from "lucide-react";
import { Details } from "@/components/br/details";
import { PERFORMANCE_ONLY as P, PERF_ONLY_HREF } from "../../../../api-server/src/lib/overhaul/performanceOnly";

const ICONS = [ShoppingBag, Receipt, UserRound, Zap];

export function PerformanceOnly({ where }: { where: "home" | "media_kit" }) {
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-5 shadow-sm md:p-8" data-testid={`perf-only-${where}`} id="performance-only">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{P.eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl" data-testid={`perf-only-title-${where}`}>{P.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{P.sub}</p>
      <div className="mt-5 rounded-2xl bg-[#0b1f3a] p-4 text-white md:p-5" aria-label="Where our code goes">
        <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-lime-300"><Code2 className="size-4" aria-hidden />Our drop-in code goes here</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {P.spots.map((s, i) => { const Icon = ICONS[i]!; return (
            <li key={s} className="flex min-w-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold"><Icon className="size-4 shrink-0 text-lime-300" aria-hidden /><span className="min-w-0">{s}</span></li>
          ); })}
        </ul>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {P.steps.map((s) => (
          <li key={s.n} className="rounded-2xl bg-[#ecfccb]/60 p-4">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white">{s.n}</span>
            <p className="mt-2 font-display text-xl text-[#0b1f3a]">{s.t}</p>
            <p className="mt-1 text-sm text-foreground/70">{s.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {P.compare.map((c, i) => (
          <p key={c.k} className={`rounded-2xl border p-4 text-sm ${i === 1 ? "border-lime-400 bg-lime-50" : "border-[#0b1f3a]/10 bg-[#0b1f3a]/[0.03]"}`}><span className="block font-bold text-[#0b1f3a]">{c.k}</span><span className="text-foreground/70">{c.v}</span></p>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-foreground/60">{P.ranges}</p>
      <div className="mt-4">
        <a href={PERF_ONLY_HREF} data-testid={`perf-only-cta-${where}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-6 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]">{P.cta} <ArrowRight className="size-4" aria-hidden /></a>
      </div>
      <Details label={P.detailsLabel} testId={`perf-only-details-${where}`}>
        <ul className="list-disc space-y-1 pl-5">{P.details.map((d) => <li key={d}>{d}</li>)}</ul>
      </Details>
    </div>
  );
}
