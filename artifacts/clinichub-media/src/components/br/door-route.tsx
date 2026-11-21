/** Street-team door section. Copy and census figures: api-server/src/lib/doorRoute.ts. */
import { ArrowRight } from "lucide-react";
import { DOOR_DETAIL_ROWS, DOOR_HEADLINE, DOOR_ROUTE } from "../../../../api-server/src/lib/doorRoute";
import { SALES_PHONE_DISPLAY, SALES_PHONE_HREF } from "../../../../api-server/src/lib/buyerComfort";

export function DoorRoute({ requestHref = "#request", testId = "door-route", large = false }: { requestHref?: string; testId?: string; large?: boolean }) {
  const d = DOOR_ROUTE;
  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-12" data-testid={testId}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C8F55A]">{d.kicker}</p>
        <h2 className={`mt-3 font-display leading-tight tracking-tight ${large ? "text-3xl md:text-5xl" : "text-[1.75rem] md:text-4xl"}`}>{d.title}</h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-background/80">{d.body}</p>
        <div className="mt-5 border-l-2 border-[#C8F55A] pl-4" data-testid="door-goal">
          <p className="font-semibold">{d.goal}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-background/65">
            <span className="border border-background/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background/75">Modelled</span>
            {d.goalNote}
          </p>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-start">
          <a href={requestHref} className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap bg-[#C8F55A] px-6 text-sm font-semibold text-[#071A39] transition-colors hover:bg-background" data-testid="door-inquire">
            {d.inquire} <ArrowRight className="size-4" aria-hidden />
          </a>
          <a href={SALES_PHONE_HREF} className="inline-flex h-12 items-center justify-center whitespace-nowrap border border-background/40 px-6 text-sm font-semibold transition-colors hover:border-background" data-testid="door-call">
            Request a call back · {SALES_PHONE_DISPLAY}
          </a>
        </div>
        <p className="mt-3 text-xs text-background/60">{d.inquireNote}</p>
      </div>

      <div className="min-w-0">
        <figure className="overflow-hidden border border-background/20">
          <picture>
            <source srcSet={d.mapWebp} type="image/webp" />
            <img src={d.mapJpg} alt={d.mapAlt} width={d.mapWidth} height={d.mapHeight} loading="eager" decoding="async" className="block h-auto w-full" data-testid="door-map" />
          </picture>
          <figcaption className="border-t border-background/20 px-4 py-2.5 text-xs text-background/65">{d.mapCaption}</figcaption>
        </figure>

        <details className="group mt-6 border border-background/20" data-testid="door-census">
          <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden" data-testid="door-census-summary">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-background/60">
                {d.censusTitle} <span className="whitespace-nowrap text-[#C8F55A]">· {d.censusQualifier}</span>
              </p>
              <span className="inline-flex flex-none items-center gap-1 text-xs font-semibold text-background/75 group-hover:text-background">
                {d.censusToggle}
                <span aria-hidden className="inline-block text-base leading-none transition-transform group-open:rotate-45">+</span>
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-3 sm:grid-cols-[0.95fr_1.5fr_0.9fr_1fr] sm:divide-x sm:divide-background/15" data-testid="door-headline">
              {DOOR_HEADLINE.map((s) => (
                <div key={s.label} className="min-w-0 px-1.5 first:pl-0 last:pr-0 sm:px-3 max-sm:odd:pl-0">
                  <dd className="whitespace-nowrap font-display text-base leading-none tracking-tight sm:text-xl">{s.value}</dd>
                  <dt className="mt-1.5 text-[10px] leading-tight text-background/65 sm:text-xs">{s.label}</dt>
                </div>
              ))}
            </dl>
          </summary>
          <div className="border-t border-background/15 p-4 text-sm" data-testid="door-census-detail">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/60">{d.censusExpandedTitle}</p>
            <table className="mt-3 w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="text-background/55">
                  <th className="py-1.5 pr-2 font-medium">Measure</th>
                  <th className="py-1.5 pr-2 font-medium">est. 2026</th>
                  <th className="py-1.5 font-medium">2021 Census</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-background/10">
                {DOOR_DETAIL_ROWS.map((r) => (
                  <tr key={r.label}>
                    <td className="py-2 pr-2 text-background/80">{r.label}</td>
                    <td className="py-2 pr-2 font-semibold">{r.est}</td>
                    <td className="py-2 text-background/70">{r.census}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-background/60" data-testid="door-method">{d.censusMethod}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-background/55" data-testid="door-source">
              {d.sourceLead}{" "}
              <a href={d.sourceHref} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-background">{d.sourceLabel}</a>{" "}
              {d.sourceMid}{" "}
              <a href={d.cpiHref} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-background">{d.cpiLabel}</a>. {d.sourceTail}
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
