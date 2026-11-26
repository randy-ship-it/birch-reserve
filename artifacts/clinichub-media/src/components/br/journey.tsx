/**
 * The buyer journey, one ladder on both sites (Randy, voice, Nov 26 2026 1:11 PM ET: "you inquire for bigger slots or
 * for making offers on mid inventory is kind of the journey"; the old flow was "just confusing").
 *   1. Buy small slots now (self-serve: the existing 7-day look + reserve checkout, existing prices only).
 *   2. Make an offer on mid-size inventory (same request endpoint, intent "offer").
 *   3. Inquire for bigger slots (premium, inquire-only, from the published premium band).
 * Minimal words. Nothing is charged here; the buy buttons open the existing checkout page.
 */
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, HandCoins, MessageSquare, ShoppingCart } from "lucide-react";
import { RESERVE_HREF, lookHref } from "@/components/br/pricing";
import { CategoryRequestForm, priceLabels, useAvailability, type RequestIntent } from "@/components/br/prime-hero";
import { trackCta } from "@/lib/track-cta";
import { trackAttn } from "@/lib/attention";
import { PATHS, VERTICALS, VERTICALS_NOTE } from "@/components/br/supplier-mode";
import { MEDIA_KIT_OFFERS } from "../../../../api-server/src/lib/overhaul/mediaKit";

const k = (n: number) => `$${n / 1000}K`;

export function BuyJourney({ where, title = "Buy small. Offer mid. Inquire big.", testId = "buy-journey", className = "" }: { where: string; title?: string | null; testId?: string; className?: string }) {
  const price = priceLabels(useAvailability());
  const [open, setOpen] = useState<Exclude<RequestIntent, "ask"> | null>(null);
  useEffect(() => {
    const h = window.location.hash;
    if (h === "#offer") setOpen("offer");
    if (h === "#inquire") setOpen("inquire");
  }, []);
  const pick = (i: "offer" | "inquire") => {
    setOpen((cur) => (cur === i ? null : i));
    trackAttn(`journey.${i}`);
    setTimeout(() => document.getElementById(`${testId}-form`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  };
  const card = "flex min-w-0 flex-col rounded-2xl p-4 md:p-5";
  const step = "text-[11px] font-bold uppercase tracking-[0.18em]";
  const btn = "inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition";
  return (
    <section data-testid={testId} className={className}>
      {title ? <h2 className="mb-3 font-display text-2xl leading-tight text-[#0b1f3a] md:text-3xl" data-testid={`${testId}-title`}>{title}</h2> : null}
      <ol className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-1">
        <li className={`${card} bg-lime-200 text-[#0b1f3a]`} data-testid={`${testId}-buy`}>
          <span className={step}><ShoppingCart className="mr-1 inline size-3.5" aria-hidden />1 · Small slots</span>
          <span className="mt-1 font-display text-2xl leading-none md:text-3xl">Buy now</span>
          <span className="mt-1 text-[13px] opacity-80">{price.look} look · {price.seat} reserve</span>
          <span className="mt-auto flex flex-wrap gap-2 pt-3">
            <a href={lookHref(`journey_${where}`)} onClick={() => trackCta("cta_hold_190", { offer: "hold-190" })} className={`${btn} bg-[#0b1f3a] text-white hover:bg-white hover:text-[#0b1f3a]`} data-testid={`${testId}-buy-look`}>7-day look <ArrowRight className="size-4" aria-hidden /></a>
            <a href={RESERVE_HREF} onClick={() => trackCta("cta_reserve_490", { offer: "reserve-490" })} className={`${btn} bg-white text-[#0b1f3a] ring-1 ring-[#0b1f3a]/20 hover:ring-[#0b1f3a]`} data-testid={`${testId}-buy-reserve`}>Reserve</a>
          </span>
        </li>
        <li aria-hidden className="hidden items-center text-foreground/30 md:flex"><ChevronRight className="size-6" /></li>
        <li className={`${card} bg-white text-[#0b1f3a] ring-1 ring-foreground/15`} data-testid={`${testId}-offer`}>
          <span className={step}><HandCoins className="mr-1 inline size-3.5" aria-hidden />2 · Mid-size</span>
          <span className="mt-1 font-display text-2xl leading-none md:text-3xl">Make an offer</span>
          <span className="mt-1 text-[13px] opacity-70">Name your budget.</span>
          <span className="mt-auto pt-3"><button type="button" aria-expanded={open === "offer"} onClick={() => pick("offer")} className={`${btn} bg-[#0b1f3a] text-white hover:bg-lime-300 hover:text-[#0b1f3a]`} data-testid={`${testId}-offer-btn`}>Make an offer <ArrowRight className="size-4" aria-hidden /></button></span>
        </li>
        <li aria-hidden className="hidden items-center text-foreground/30 md:flex"><ChevronRight className="size-6" /></li>
        <li className={`${card} bg-[#0b1f3a] text-white`} data-testid={`${testId}-inquire`}>
          <span className={step}><MessageSquare className="mr-1 inline size-3.5" aria-hidden />3 · Bigger slots</span>
          <span className="mt-1 font-display text-2xl leading-none md:text-3xl">Inquire</span>
          <span className="mt-1 text-[13px] opacity-75" data-currency-fixed>From {k(MEDIA_KIT_OFFERS.premium.spendLo)} USD.</span>
          <span className="mt-auto pt-3"><button type="button" aria-expanded={open === "inquire"} onClick={() => pick("inquire")} className={`${btn} bg-lime-300 text-[#0b1f3a] hover:bg-white`} data-testid={`${testId}-inquire-btn`}>Inquire <ArrowRight className="size-4" aria-hidden /></button></span>
        </li>
      </ol>
      <p className="mt-2 text-[12px] text-foreground/55">Card checkout for small slots. Every dollar is media credit. You approve every placement.</p>
      {open ? <div id={`${testId}-form`} className="mt-4 max-w-2xl scroll-mt-20" data-testid={`${testId}-form`}><CategoryRequestForm key={open} intent={open} path={`/${where}#${open}`} /></div> : null}
    </section>
  );
}

/** Four ways in + categories (media kits, Nov 26 2026). Each card opens the supplier intake with that path ticked. */
export function FourPaths({ testId = "four-paths", className = "" }: { testId?: string; className?: string }) {
  return (
    <section data-testid={testId} className={className}>
      <h2 className="font-display text-2xl leading-tight text-[#0b1f3a] md:text-3xl">Four ways in. Pick some or all.</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {PATHS.map((x) => (
          <li key={x.k} className="flex">
            <a href={`/intake/supplier?paths=${x.k}`} className="group flex min-w-0 flex-1 flex-col rounded-2xl bg-white p-3 ring-1 ring-foreground/15 transition hover:ring-[#0b1f3a] md:p-4" data-testid={`${testId}-${x.k}`}>
              <x.icon className="size-5 text-[#0b1f3a]" aria-hidden />
              <span className="mt-2 text-base font-bold leading-tight text-[#0b1f3a]">{x.t}</span>
              <span className="mt-1 text-[12px] leading-snug text-foreground/65">{x.s}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[12px] font-bold text-[#0b1f3a]">{x.tag} <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden /></span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-1.5" data-testid={`${testId}-categories`}>
        {VERTICALS.map((v) => <span key={v.k} className="rounded-full bg-[#0b1f3a] px-3 py-1 text-xs font-bold text-white">{v.label}</span>)}
        <span className="text-[12px] text-foreground/55">{VERTICALS_NOTE}</span>
      </div>
    </section>
  );
}
