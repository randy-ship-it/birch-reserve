import { ladderLine, liveLine } from "../../../../api-server/src/lib/hubLadder";
import { MetaComparison, SurfacesGrid, TamStrip } from "@/components/br/blocks";
import { BrandBanners } from "@/components/br/brand-banners";
import { RateCard } from "@/components/br/rate-card";
import { StarterOffers } from "@/components/br/starter-offers";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";

const FAQ = [
  { q: "What do I buy?", a: "Start with a $190 USD 7-day category look or a $490 USD category reserve. Your payment is media credit. We send an insertion order naming the hub and placements, and nothing runs until you approve it." },
  { q: "Which hubs are live?", a: `${ladderLine()} Placements are curated as each one goes live.` },
  { q: "Can I own a category?", a: "Premium slots add exclusivity and priority placement, by inquiry only. See the media kit or ask us and we'll quote it against the hubs you want." },
  { q: "How is it reported?", a: "Aggregate only: views, clicks, UTM-tagged visits and promo-code redemptions per hub and surface. No patient data and no clinical pixels." },
];

export default function BrAdvertiseBrands() {
  usePageMeta("Advertise to brands | Birch Reserve", "Display space inside private health and wellness hubs. Start with a $190 USD 7-day category look or a $490 USD category reserve, self-serve. " + liveLine());
  return (
    <div data-testid="br-advertise-brands">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "OfferCatalog", name: "Birch Reserve self-serve offers", itemListElement: [{ "@type": "Offer", name: "7-day category look", sku: "hold-190", price: 190, priceCurrency: "USD", url: "https://birchreserve.net/buycalc?sku=hold-190" }, { "@type": "Offer", name: "Category reserve", sku: "reserve-490", price: 490, priceCurrency: "USD", url: "https://birchreserve.net/buycalc?sku=reserve-490" }] }} />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>Advertise · Brands</Eyebrow>
            <H1>Put your brand inside private health and wellness hubs.</H1>
            <Lede>Your ad runs on the pages members use right after they buy or book, and when they log back in. {liveLine()} More hubs are launching. Start for $190 USD or $490 USD.</Lede>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="#slots">See the two offers</Cta>
              <Cta href="/match" variant="line">Match my audience</Cta>
            </div>
          </div>
          <div className="border border-foreground/15 bg-white p-6">
            <TamStrip compact />
          </div>
        </div>
      </Section>

      <Section tone="soft" id="slots">
        <Eyebrow>Start self-serve</Eyebrow>
        <H2>Two ways to start. Both USD.</H2>
        <div className="mt-10">
          <StarterOffers testId="brands-offers" />
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
          <RateCard currency="usd" />
        </div>
      </Section>

      <Section>
        <BrandBanners title="Brand hubs listed with Scale (live and activating)" />
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
            <H2>How it works.</H2>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href="/media-kit" variant="line">Media kit</Cta>
              <Cta href="/agencies" variant="line">For agencies</Cta>
              <Cta href="/advertiser-guides" variant="line">Advertiser guides</Cta>
            </div>
          </div>
          <Faq items={FAQ} />
        </div>
      </Section>
    </div>
  );
}
