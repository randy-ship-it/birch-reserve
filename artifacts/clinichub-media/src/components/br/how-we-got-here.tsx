/** "How we got here" origin story (Randy t424u, Nov 21 2026). Nameless, qualitative, no numbers as results. Home + media kit, right above the GTM block. */
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { LOOK_HREF, lookHref} from "@/components/br/pricing";

import { HOW_WE_GOT_HERE } from "../../../../api-server/src/lib/overhaul/proofContent";
export { HOW_WE_GOT_HERE };

const VISIBLE_MOBILE = 4;

export function HowWeGotHere({ where }: { where: "home" | "media_kit" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-[#ecfccb]/40 p-4 md:p-5" data-testid={`how-we-got-here-${where}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{HOW_WE_GOT_HERE.eyebrow}</p>
      <ol className="relative mt-3 space-y-1.5 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-[#0b1f3a]/20">
        {HOW_WE_GOT_HERE.steps.map((s, i) => (
          <li key={i} className={`relative items-start gap-3 ${i >= VISIBLE_MOBILE && !open ? "hidden md:flex" : "flex"}`}>
            <span className="z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white">{i + 1}</span>
            <p className="min-w-0 flex-1 rounded-xl bg-white px-3 py-1.5 text-[13px] leading-snug text-foreground/80 shadow-sm">{s}</p>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid={`how-we-got-here-more-${where}`} className="mt-2 text-sm font-semibold text-[#0b1f3a] underline underline-offset-2 md:hidden">
        {open ? HOW_WE_GOT_HERE.less : HOW_WE_GOT_HERE.more}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={lookHref("how_we_got_here_look")} data-testid={`how-we-got-here-cta-${where}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]">
          {HOW_WE_GOT_HERE.cta} <ArrowRight className="size-4" aria-hidden />
        </a>
        <p className="text-[12px] text-foreground/60">{HOW_WE_GOT_HERE.note}</p>
      </div>
    </div>
  );
}
