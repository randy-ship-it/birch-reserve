/**
 * "Track record" proof strip (Randy, voice, Nov 21 2026 5:59 PM ET). Sits under "How we got here" on the home page and
 * the media kit (the Scale mirror media kit renders the same component in the Scale skin). Copy and sources live in
 * api-server/src/lib/overhaul/trackRecord.ts. Short and visual: one stat + one line per card, detail collapsed.
 */
import { ArrowRight, ChevronDown } from "lucide-react";
import { LOOK_HREF } from "@/components/br/pricing";
import { trackCta } from "@/lib/track-cta";
import { useCurrency, usePriceText } from "@/lib/currency";
import { skinText } from "@/lib/siteSkin";
import { fmtUsd } from "../../../../api-server/src/lib/overhaul/pricing";
import { DEPOSIT_TIERS } from "../../../../api-server/src/lib/sponsorKit";
import { TRACK_RECORD } from "../../../../api-server/src/lib/overhaul/trackRecord";

export function TrackRecord({ where }: { where: "home" | "media_kit" }) {
  const t = usePriceText();
  const cur = useCurrency().currency;
  const pack = DEPOSIT_TIERS.find((d) => d.key === TRACK_RECORD.packKey)!;
  const packPrice = cur === "cad" ? pack.cad : pack.usd;
  const packHref = `/sponsor?pack=${pack.key}&utm_source=birchreserve&utm_medium=track-record&utm_campaign=${where}-${pack.key}#prepay`;
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-4 shadow-sm md:p-5" data-testid={`track-record-${where}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60">{TRACK_RECORD.eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-[#0b1f3a] md:text-3xl">{TRACK_RECORD.title}</h2>
        </div>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid={`track-record-cards-${where}`}>
        {TRACK_RECORD.cards.map((c) => (
          <li key={c.key} className="flex min-w-0 flex-col rounded-2xl bg-[#0b1f3a] p-4 text-white" data-testid={`track-record-card-${c.key}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-lime-300">{c.tag}</p>
            <p className="mt-1 font-display text-4xl leading-none">{c.stat}</p>
            <p className="mt-2 text-[13px] font-semibold leading-snug text-white/90">{c.outcome}</p>
            <details className="group mt-auto pt-2 text-[12px] leading-relaxed text-white/70">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-semibold text-lime-200 underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-3.5 transition group-open:rotate-180" aria-hidden />{TRACK_RECORD.more}
              </summary>
              <p className="mt-1.5">{c.detail}</p>
            </details>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={LOOK_HREF}
          onClick={() => trackCta("cta_hold_190", { offer: "hold-190" })}
          data-testid={`track-record-look-${where}`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white transition hover:bg-lime-300 hover:text-[#0b1f3a]"
        >
          {t(TRACK_RECORD.lookCta)} <ArrowRight className="size-4" aria-hidden />
        </a>
        <a
          href={packHref}
          data-testid={`track-record-pack-${where}`}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-[#0b1f3a] ring-1 ring-[#0b1f3a]/30 transition hover:bg-lime-300"
        >
          Or prepay the {pack.label.toLowerCase()} pack · {fmtUsd(packPrice)} {cur.toUpperCase()}
        </a>
      </div>
      <p className="mt-2 text-[12px] text-foreground/60" data-testid={`track-record-note-${where}`}>{skinText(TRACK_RECORD.note)}</p>
    </div>
  );
}
