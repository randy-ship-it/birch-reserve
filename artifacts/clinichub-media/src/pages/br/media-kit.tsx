import { Printer } from "lucide-react";
import { MetaComparison, SurfacesGrid, TamStrip } from "@/components/br/blocks";
import { RateCard } from "@/components/br/rate-card";
import { Cta, Eyebrow, H1, H2, Lede, Section, usePageMeta } from "@/components/br/ui";
import { useCurrency } from "@/lib/currency";
import { AREA_LOCK, PUBLISHER_INCENTIVE, SLOT_LADDER, areaLockGuaranteedViews } from "../../../../api-server/src/lib/overhaul/model";

export default function BrMediaKit() {
  usePageMeta("Marketing kit | Birch Reserve", "One page: where ads run, who sees them, what it costs, and how to buy. Brands, local businesses, studios and agencies.");
  const { currency, setCurrency } = useCurrency();
  const g = areaLockGuaranteedViews();
  const price = (usd: number, cad: number) => `$${(currency === "cad" ? cad : usd).toLocaleString()} ${currency.toUpperCase()}`;
  return (
    <div className="kit-page" data-testid="br-media-kit">
      <Section>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Eyebrow>Marketing kit · Nov 2026</Eyebrow>
            <H1>Birch Reserve in one page.</H1>
            <Lede>Ads inside co-branded Recovery Brand hubs and health &amp; wellness business hubs. Display or CPC, on four placements: post-purchase, hub home, product and services pages, and the member dashboard behind login. The named hubs are live inventory now.</Lede>
          </div>
          <div className="flex gap-2 print:hidden">
            <div className="flex border border-foreground/25 text-sm" role="group" aria-label="Currency">
              {(["usd", "cad"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)} className={`px-3 py-2 font-semibold ${currency === c ? "bg-foreground text-background" : ""}`}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 border border-foreground/25 px-3 py-2 text-sm font-semibold">
              <Printer className="size-4" /> Print / PDF
            </button>
          </div>
        </div>
        <div className="mt-10">
          <TamStrip />
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>1 · Explainer</Eyebrow>
        <H2>How it works in 30 seconds.</H2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            { t: "Hubs launch", d: "Recovery brands and health & wellness businesses open co-branded hubs for their customers and members." },
            { t: "Slots open", d: "Each hub adds display and CPC slots on its home page, product and services pages, and post-purchase page." },
            { t: "You prepay", d: "Brands lock in spend; local businesses lock their 5 km area. Bigger deposits buy the rate down." },
            { t: "We report", d: "Your credit draws down only when your ad runs, with UTM links and promo codes on every placement." },
          ].map((s, i) => (
            <li key={s.t} className="border border-foreground/15 bg-white p-5">
              <span className="font-display text-4xl text-foreground/25">{i + 1}</span>
              <p className="mt-1 font-display text-xl">{s.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <Eyebrow>2 · Surfaces</Eyebrow>
        <H2>Where ads show.</H2>
        <div className="mt-8">
          <SurfacesGrid />
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>3 · Ways to buy</Eyebrow>
        <H2>Pick the one that fits.</H2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="border-2 border-foreground bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Local businesses &amp; studios</p>
            <p className="mt-2 font-display text-2xl">Lock down my area</p>
            <p className="mt-2 font-display text-4xl">{price(AREA_LOCK.priceUsd, AREA_LOCK.priceCad)}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li>· Up to {AREA_LOCK.standardSharePct}% of display within {AREA_LOCK.radiusKm} km ({AREA_LOCK.denseCoreSharePct}% downtown)</li>
              <li>· 1 to 6 months from display start</li>
              <li>· Credit at {AREA_LOCK.discountPct}% off rate card</li>
              <li>· {g.views.toLocaleString()} page views across hubs (modelled)</li>
              <li>· Right to keep pace if traffic grows</li>
            </ul>
            <div className="mt-5 print:hidden">
              <Cta href="/advertise/local">Check my postal code</Cta>
            </div>
          </div>
          <div className="border border-foreground/20 bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Brands</p>
            <p className="mt-2 font-display text-2xl">Spend commits</p>
            <ul className="mt-4 space-y-2 text-sm">
              {SLOT_LADDER.map((t) => (
                <li key={t.key} className="flex justify-between gap-3 border-b border-border pb-2">
                  <span>{t.label}</span>
                  <span className="font-semibold">
                    {price(t.usd, t.cad)}
                    {t.bonusPct ? ` · +${t.bonusPct}%` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 print:hidden">
              <Cta href="/advertise/brands" variant="ink">Choose a deposit</Cta>
            </div>
          </div>
          <div className="border border-foreground/20 bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Publishers</p>
            <p className="mt-2 font-display text-2xl">Earn from your hub</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Studios &amp; retail: ${PUBLISHER_INCENTIVE.cashCad} cash or ${PUBLISHER_INCENTIVE.creditCad}+ ad credit, paid {PUBLISHER_INCENTIVE.paidDaysAfterFirstTransaction} days after your first unique transaction. Brands with a recovery audience: co-branded hub by application.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              <Cta href="/publish/studios" variant="line">Studios</Cta>
              <Cta href="/publish/brands" variant="line">Brands</Cta>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <Eyebrow>4 · Rate card</Eyebrow>
        <H2>Per hub, per month.</H2>
        <div className="mt-8">
          <RateCard currency={currency} />
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>5 · Versus Meta</Eyebrow>
        <div className="mt-4">
          <MetaComparison />
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <Eyebrow>6 · What to send</Eyebrow>
            <ul className="mt-3 space-y-2 text-sm">
              <li>· Square still (1080×1080) and 1200×300 banner; optional 15-second silent motion</li>
              <li>· Destination URL with UTM, and a promo code if you have one</li>
              <li>· Your category and one contact email</li>
            </ul>
          </div>
          <div>
            <Eyebrow>7 · Rules</Eyebrow>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>· Aggregate reporting only. No patient data, no clinical pixels.</li>
              <li>· Audience and view figures are modelled from scalehealth.ca/tam until campaigns report.</li>
              <li>· Every buy runs under an insertion order that names the hubs.</li>
              <li>· Contact: <a className="underline" href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a></li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
