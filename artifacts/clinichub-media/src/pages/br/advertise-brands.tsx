import { MetaComparison, SurfacesGrid, TamStrip } from "@/components/br/blocks";
import { BrandBanners } from "@/components/br/brand-banners";
import { RateCard } from "@/components/br/rate-card";
import { SlotLadder } from "@/components/br/slot-ladder";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { useCurrency } from "@/lib/currency";
import { SLOT_LADDER } from "../../../../api-server/src/lib/overhaul/model";

const FAQ = [
  { q: "What is a spend commit?", a: "You prepay a deposit that becomes ad credit. The named hubs are live inventory, so we send an insertion order naming the hubs and placements and your credit spends down over 6 months from when it lands. Unused credit can be refunded, or extended month by month at the same rate. 3x more inventory is in queue by year end, and you can put deposits on that too." },
  { q: "How do bigger deposits buy the rate down?", a: "Each tier adds bonus credit: +5% at $1,500 USD, +10% at $3,000 and +15% at $6,000. That is an effective 4.8%, 9.1% and 13.0% off the rate card." },
  { q: "Can I own a category?", a: "Yes. A category lock holds your category across the hubs where it runs. Ask us and we'll quote it against the hubs you want." },
  { q: "How is it reported?", a: "Aggregate only: views, clicks, UTM-tagged visits and promo-code redemptions per hub and surface. No patient data and no clinical pixels." },
];

export default function BrAdvertiseBrands() {
  usePageMeta("Brand spend commits | Birch Reserve", "Lock in spend across co-branded Recovery Brand hubs and health & wellness business hubs. Prepay and get up to 15% bonus credit.");
  const { currency, setCurrency } = useCurrency();
  return (
    <div data-testid="br-advertise-brands">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "OfferCatalog", name: "Birch Reserve brand spend commits", itemListElement: SLOT_LADDER.map((t) => ({ "@type": "Offer", name: t.label, price: t.usd, priceCurrency: "USD", description: t.note })) }} />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>Advertise · Brands</Eyebrow>
            <H1>Lock in spend before the hubs fill.</H1>
            <Lede>Prepay a test budget once. Your credit runs on the co-branded hubs that fit your audience, on the hub home page, in product and services pages and after purchase.</Lede>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="#slots">Choose a deposit</Cta>
              <Cta href="/match" variant="line">Match my audience</Cta>
            </div>
          </div>
          <div className="border border-foreground/15 bg-white p-6">
            <TamStrip compact />
          </div>
        </div>
      </Section>

      <Section tone="soft" id="slots">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Spend commits</Eyebrow>
            <H2>Bigger deposit, better rate.</H2>
          </div>
          <div className="flex border border-foreground/25 text-sm" role="group" aria-label="Currency">
            {(["usd", "cad"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setCurrency(c)} className={`px-4 py-2 font-semibold ${currency === c ? "bg-foreground text-background" : ""}`}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10">
          <SlotLadder currency={currency} audience="brand" />
        </div>
      </Section>

      <Section>
        <Eyebrow>Where it runs</Eyebrow>
        <H2>Four placements, display or CPC.</H2>
        <div className="mt-10">
          <SurfacesGrid />
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>Rate card</Eyebrow>
        <H2>Per hub, per month.</H2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Starting-at rates, the same ones as the <a href="/rates" className="underline underline-offset-2">five-surface rate card</a>. Illustrative estimates, not a quote.</p>
        <div className="mt-8">
          <RateCard currency={currency} />
        </div>
      </Section>

      <Section>
        <BrandBanners title="Hubs your credit can run on" />
      </Section>

      <Section tone="soft">
        <Eyebrow>Versus Meta</Eyebrow>
        <H2>Inside the experience, after checkout.</H2>
        <div className="mt-8">
          <MetaComparison />
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <H2>How spend commits work.</H2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href="/media-kit" variant="line">Marketing kit</Cta>
              <Cta href="/agencies" variant="line">For agencies</Cta>
            </div>
          </div>
          <Faq items={FAQ} />
        </div>
      </Section>
    </div>
  );
}
