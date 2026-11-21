/** Compact home teaser for the GTM bot (Randy t415u). Separate from the locked GTM setup packages block. */
import { ArrowRight } from "lucide-react";
import { GTM_BOT, GTM_BOT_HREF } from "../../../../api-server/src/lib/overhaul/gtmBot";

export function GtmBotTeaser() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-[#0b1f3a] p-5 text-white shadow-sm md:flex-row md:items-center md:justify-between md:p-8" data-testid="gtm-bot-teaser">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-300">{GTM_BOT.eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl leading-tight md:text-4xl">{GTM_BOT.teaserTitle}</h2>
        <p className="mt-2 text-sm text-white/80 md:text-base">{GTM_BOT.teaserBody}</p>
      </div>
      <a href={GTM_BOT_HREF} data-testid="gtm-bot-teaser-cta" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a] transition hover:bg-white md:self-auto">
        {GTM_BOT.teaserCta} <ArrowRight className="size-4" aria-hidden />
      </a>
    </div>
  );
}
