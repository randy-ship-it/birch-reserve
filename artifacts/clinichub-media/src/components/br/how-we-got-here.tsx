/** "How we got here" origin story (Randy t424u, Nov 21 2026). Nameless, qualitative, no numbers as results. Home + media kit, right above the GTM block. */
import { ArrowRight } from "lucide-react";
import { LOOK_HREF } from "@/components/br/pricing";

export const HOW_WE_GOT_HERE = {
  eyebrow: "How we got here",
  steps: [
    "We tested post-checkout and retail-adjacent surfaces and saw strong engagement across categories.",
    "So we asked: what if an organic, service co-branded layer sat next to the product?",
    "We started in recovery, where we already had vertical integration and could curate providers quickly.",
    "That clinic layer became the foundation. Hubs are now turning into inventory that can be monetized immediately, at low or zero incremental cost to the brand.",
    "The same systems and GTM expertise we use to sign and onboard partners are what we now offer as the ad product and the $3,500+ partnership bot setup.",
  ],
  note: "Internal testing that informed the product, not campaign results or current sold performance.",
  cta: "Start with the $190 USD 7-day look",
} as const;

export function HowWeGotHere({ where }: { where: "home" | "media_kit" }) {
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-[#ecfccb]/40 p-4 md:p-5" data-testid={`how-we-got-here-${where}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{HOW_WE_GOT_HERE.eyebrow}</p>
      <ol className="mt-3 grid gap-2 md:grid-cols-5 md:gap-3">
        {HOW_WE_GOT_HERE.steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm md:flex-col md:gap-2">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white">{i + 1}</span>
            <p className="text-[13px] leading-snug text-foreground/80">{s}</p>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={LOOK_HREF} data-testid={`how-we-got-here-cta-${where}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]">
          {HOW_WE_GOT_HERE.cta} <ArrowRight className="size-4" aria-hidden />
        </a>
        <p className="text-[12px] text-foreground/60">{HOW_WE_GOT_HERE.note}</p>
      </div>
    </div>
  );
}
