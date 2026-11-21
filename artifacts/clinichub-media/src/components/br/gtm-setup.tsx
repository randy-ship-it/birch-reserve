/**
 * "GTM setup packages" block (Randy t332u, Nov 21 2026): homepage + media kit. Short and visual; detail is collapsed.
 * Copy lives in api-server/src/lib/overhaul/gtmSetup.ts. Incremental: sits beside the pulse / mid-tier blocks.
 */
import { ArrowRight } from "lucide-react";
import { Details } from "@/components/br/details";
import { LOOK_HREF } from "@/components/br/pricing";
import { GTM_SETUP, GTM_SETUP_HREF } from "../../../../api-server/src/lib/overhaul/gtmSetup";

export function GtmSetup({ where }: { where: "home" | "media_kit" | "intake" }) {
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-5 shadow-sm md:p-8" data-testid={`gtm-setup-${where}`} id="gtm-setup">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60" data-currency-fixed data-testid={`gtm-eyebrow-${where}`}>{GTM_SETUP.eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">{GTM_SETUP.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{GTM_SETUP.sub}</p>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {GTM_SETUP.steps.map((s) => (
          <li key={s.n} className="rounded-2xl bg-[#ecfccb]/60 p-4">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white">{s.n}</span>
            <p className="mt-2 font-display text-xl text-[#0b1f3a]">{s.t}</p>
            <p className="mt-1 text-sm text-foreground/70">{s.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 grid gap-3 md:grid-cols-2" data-testid={`gtm-cases-${where}`}>
        {GTM_SETUP.cases.map((c) => (
          <p key={c} className="rounded-2xl border border-[#0b1f3a]/10 bg-[#0b1f3a]/[0.03] p-4 text-sm font-semibold text-[#0b1f3a]">{c}</p>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-foreground/60">{GTM_SETUP.casesNote}</p>
      <p className="mt-3 text-sm text-foreground/75" data-testid={`gtm-separate-${where}`}>{GTM_SETUP.separate}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a href={GTM_SETUP_HREF} data-currency-fixed data-testid={`gtm-cta-${where}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-6 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]">
          {GTM_SETUP.cta} <ArrowRight className="size-4" aria-hidden />
        </a>
        <a href={LOOK_HREF} className="text-sm font-semibold text-foreground/70 underline-offset-2 hover:underline">Or start with the $190 USD 7-day look</a>
      </div>
      <Details label={GTM_SETUP.detailsLabel} testId={`gtm-details-${where}`}>
        <ul className="list-disc space-y-1 pl-5">{GTM_SETUP.details.map((d) => <li key={d} {...(d.includes("$3,500") ? { "data-currency-fixed": "" } : {})}>{d}</li>)}</ul>
      </Details>
    </div>
  );
}
