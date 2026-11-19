import { KitCta } from "@/components/br/kit-cta";
import { ShareBar } from "@/components/br/share-bar";
import { useState } from "react";
import { Lock, MapPin, Timer, ArrowRight } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { ActivationRange, DEFAULT_MARKET, MarketPicker, pickActivation } from "@/components/br/intake-geo";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";

import { ChannelTiles, ContactSubmit, EstimateTag, InfoPop, MockBanner, RoleTabs, basePayload } from "@/components/br/intake-kit";
import type { IntakeRef } from "@/lib/fridayBrandIntake";
import { SPONSOR_OFFERS, SUPPLIER_CATEGORIES, HUB_RATE_RANGE } from "../../../../api-server/src/lib/overhaul/brandIntake";

const ICON = { "hold-190": Timer, "reserve-490": Lock, "area-lock": MapPin } as const;

export default function BrIntakeSponsor() {
  usePageMeta("Sponsor: lock a category or an area | Birch Reserve", "Start with the $190 USD 7-day look, the $490 USD category reserve or the $3,500 USD area lock launch price.");
  const [cat, setCat] = useState(SUPPLIER_CATEGORIES[0]!.key);
  const [ref, setRef] = useState<IntakeRef | null>(null);
  const [market, setMarket] = useState<Market>(DEFAULT_MARKET);
  const payload = { ...basePayload("sponsor"), sponsor: { interest: [], category: cat }, ...(market.sells_in.length ? { market } : {}) };
  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#fef9c3_0%,_transparent_55%)]">
      <MockBanner />
      <RoleTabs active="sponsor" />
      <header className="container mx-auto px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">For sponsors</p>
        <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Lock your category. Or your area.</h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">Three published prices. Pay on the same secure Stripe page as always. Nothing runs before you approve an insertion order.</p>
        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <KitCta placement="hero_role_sponsor" size="md" sub="One form for hub + supplier. Website + email to start." />
          <ShareBar testId="share-bar-role" />
        </div>
      </header>
      <section className="container mx-auto px-4 pb-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm" data-testid="sponsor-category-chips">
          <span className="px-2 text-xs font-bold uppercase tracking-wider text-foreground/60">Category</span>
          {SUPPLIER_CATEGORIES.map((c) => (
            <button key={c.key} type="button" onClick={() => setCat(c.key)} aria-pressed={cat === c.key} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${cat === c.key ? "bg-foreground text-background" : "bg-foreground/[0.06] hover:bg-foreground/10"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </section>
      <section className="container mx-auto grid gap-4 px-4 pb-8 md:grid-cols-3">
        {SPONSOR_OFFERS.map((o) => {
          const I = ICON[o.key];
          const hero = o.key === "reserve-490";
          return (
            <article key={o.key} data-testid={`sponsor-offer-${o.key}`} className={`relative flex flex-col overflow-hidden rounded-3xl p-6 shadow-lg ${hero ? "bg-[#0b1f3a] text-white ring-4 ring-lime-300" : "bg-white"}`}>
              <div className="flex items-center gap-2">
                <I className={`size-6 ${hero ? "text-lime-200" : ""}`} aria-hidden />
                <h2 className="font-bold">{o.name}</h2>
                {"launchPrice" in o && o.launchPrice ? <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">Launch price</span> : null}
              </div>
              <p className={`mt-4 font-display text-5xl ${hero ? "text-lime-200" : ""}`}>{o.priceLabel}</p>
              <p className={`mt-2 flex-1 text-sm ${hero ? "text-white/80" : "text-muted-foreground"}`}>{o.kind === "category" ? `${SUPPLIER_CATEGORIES.find((c) => c.key === cat)!.label}: ` : ""}{o.line}</p>
              <a href={o.href} data-testid={`sponsor-cta-${o.key}`} className={`mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition ${hero ? "bg-lime-300 text-[#0b1f3a] hover:bg-white" : "bg-foreground text-background hover:bg-accent hover:text-accent-foreground"}`}>
                {o.key === "area-lock" ? "Lock an area" : o.key === "hold-190" ? "Start the 7-day look" : "Lock this category"} <ArrowRight className="size-4" aria-hidden />
              </a>
            </article>
          );
        })}
      </section>
      <section className="container mx-auto px-4 pb-10">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-foreground/10 bg-white p-4 text-sm">
          <EstimateTag /> Hub rates after launch: CPM ${HUB_RATE_RANGE.cpm[0]}–${HUB_RATE_RANGE.cpm[1]} · CPC ${HUB_RATE_RANGE.cpc[0].toFixed(2)}–${HUB_RATE_RANGE.cpc[1].toFixed(2)} USD
          <span className="ml-auto"><InfoPop title="Terms in short" testId="sponsor-terms-pop">
            <p>The $190 USD look converts in full to the $490 USD reserve within 7 days, or is refunded. It does not lock in a slot.</p>
            <p>The $490 USD reserve is media credit, fully refundable until 14 days before the launch date on the IO, usable for 12 months.</p>
            <p>The area lock is shown at its launch price. Full terms are on /advertise/local and /terms. Media is prepaid and runs only on an approved insertion order.</p>
            <p>{HUB_RATE_RANGE.source}</p>
          </InfoPop></span>
        </div>
      </section>
      <section className="container mx-auto px-4 pb-8"><ContactSubmit role="sponsor" payload={payload} draft={ref} setRef={setRef} label="Send lock interest" /></section>
      <section className="container mx-auto max-w-xl px-4 pt-6"><MarketPicker value={market} onChange={setMarket} /></section>
      <ChannelTiles market={market} />
    </div>
  );
}
