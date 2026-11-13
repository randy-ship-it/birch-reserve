import { ConveyorHero } from "@/components/br/conveyor";
import { BrandBanners } from "@/components/br/brand-banners";
import { FourPaths, MetaComparison, PositioningBand, SurfacesGrid, TamStrip } from "@/components/br/blocks";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { QuickBuy } from "@/components/br/quick-buy";
import { MetaHook, PackPicker, ProveItLadder, RateCardV2 } from "@/components/br/pricing";
import { AGENCY, AREA_LOCK, INVENTORY, PUBLISHER_INCENTIVE, areaLockGuaranteedViews } from "../../../../api-server/src/lib/overhaul/model";

const FAQ = [
  { q: "Where exactly do the ads run?", a: "Only inside co-branded hubs from Recovery Brands (recovery, longevity and food today; pets in queue) and inside health and wellness business hubs such as physio, gym, studio and clinic hubs. Each hub has four placements: post-purchase, the hub home page, product and services pages, and the member dashboard behind login." },
  { q: "Is the inventory live?", a: `Yes. ${INVENTORY.line} ${INVENTORY.queueLine}` },
  { q: "Is this display or cost-per-click?", a: "Both. Every placement can be bought as display (priced per thousand views) or CPC (priced per click). Deposits and area locks draw down against either." },
  { q: "Are the audience numbers measured?", a: "Not yet. Audience and view numbers are modelled from the TAM feed at scalehealth.ca/tam: 20MM+ orders being onboarded across 42 listed partners. We don't publish a network views figure; your insertion order sizes views against live hub supply. Reporting on your campaign is measured with UTM links and promo codes." },
  { q: "Can a local business or studio buy?", a: `Yes. Lock down your area holds up to ${AREA_LOCK.standardSharePct}% of hub display within ${AREA_LOCK.radiusKm} km of your postal code (${AREA_LOCK.denseCoreSharePct}% in dense downtown cores) for 1 to 6 months from when displays start.` },
  { q: "How do I become a publisher?", a: `Studios and retailers activate a hub at scalehealth.ca/clinichubs and earn $${PUBLISHER_INCENTIVE.cashCad} cash or $${PUBLISHER_INCENTIVE.creditCad}+ in ad credit once they activate their audience (email, text, a link on their site, at checkout, social). It is paid ${PUBLISHER_INCENTIVE.paidDaysAfterFirstTransaction} days after we see real traffic or transactions; self-purchases are excluded. Brands with a recovery audience can apply for a co-branded hub.` },
  { q: "Do agencies get anything?", a: `Yes. Agencies can prepay a client test budget, get UTM and promo-code reporting, and the agency of record earns ${AGENCY.commissionPct}% of media spend.` },
];

export default function BrHome() {
  usePageMeta("Birch Reserve | Ads inside co-branded health & wellness hubs", "Advertise inside co-branded Recovery Brand hubs and health & wellness business hubs: post-purchase, hub home, product and services pages, and the member dashboard. Lock in spend, lock down your area, or publish your own hub.");
  const g = areaLockGuaranteedViews();
  return (
    <div className="w-full overflow-x-hidden" data-testid="br-home">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Birch Reserve",
          url: "https://birchreserve.net/",
          logo: "https://birchreserve.net/logo.svg",
          parentOrganization: { "@type": "Organization", name: "Silver Birch Growth Inc." },
          email: "sales@silverbirchgrowth.com",
          description: "Ad space inside co-branded Recovery Brand hubs and health & wellness business hubs. Display and CPC on post-purchase, hub home, product and services, and member dashboard pages.",
          address: { "@type": "PostalAddress", streetAddress: "777-2255B Queen St E", addressLocality: "Toronto", addressRegion: "ON", postalCode: "M4E 1G3", addressCountry: "CA" },
        }}
      />
      <section className="border-b border-border/70">
        <div className="container mx-auto px-6 pb-12 pt-12 md:pt-16">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <Eyebrow>Ads inside health &amp; wellness hubs</Eyebrow>
              <H1>
                Every new hub is new ad space. <em className="text-foreground/70">Reserve yours.</em>
              </H1>
            </div>
            <div>
              <Lede>
                Co-branded Recovery Brand hubs and health &amp; wellness business hubs keep coming online. Each one opens display and CPC slots right after purchase, on its home page, inside its product and services pages, and on the member dashboard behind login.
              </Lede>
              <div className="mt-6 flex flex-wrap gap-3">
                <Cta href="#quick-buy" testId="hero-buy">Buy ad space now</Cta>
                <Cta href="/match" variant="ink" testId="hero-match">Match your audience</Cta>
                <Cta href="/advertise/local" variant="line" testId="hero-lock">Lock down my area</Cta>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Brands: <a className="underline underline-offset-2" href="/advertise/brands">lock in spend</a> · Agencies: <a className="underline underline-offset-2" href="/agencies">prepay a client test</a> · <a className="underline underline-offset-2" href="#rates">See rates</a>
              </p>
            </div>
          </div>
          <ConveyorHero className="mt-10" />
        </div>
      </section>

      <Section tone="soft" id="quick-buy">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Self-serve</Eyebrow>
            <H2>Buy ad space in three taps.</H2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">Pick a placement, pick your start, see the modelled views and CPM, then pay by card on the secure checkout. No login.</p>
        </div>
        <QuickBuy />
      </Section>

      <Section tone="ink">
        <MetaHook />
      </Section>

      <Section id="rates">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Rate card</Eyebrow>
            <H2>Five surfaces. Starting-at rates.</H2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">New placements open at starter rates. They only move up once your reporting proves they work.</p>
        </div>
        <RateCardV2 />
      </Section>

      <Section tone="soft" id="packs">
        <Eyebrow>View blocks</Eyebrow>
        <H2>Build a pack in 10 seconds.</H2>
        <Lede>Pick surfaces and a block size. Bundles get a modest discount. Start self-serve with a category prepay, or take it to an IO for large or exclusive deals.</Lede>
        <div className="mt-10">
          <PackPicker />
        </div>
        <p className="mt-6 text-sm">
          <a href="/rates#scenario" className="font-semibold underline underline-offset-4">Run a 100k to 1B view scenario</a>
        </p>
      </Section>

      <Section>
        <Eyebrow>Prove it, then raise</Eyebrow>
        <H2>You pay starter rates until it works.</H2>
        <div className="mt-10">
          <ProveItLadder />
        </div>
      </Section>

      <Section>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Pick your path</Eyebrow>
            <H2>Advertise or publish.</H2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">Two ways to buy, two ways to earn. Each path is one page with the price, the terms and a button.</p>
        </div>
        <FourPaths />
      </Section>

      <Section tone="ink">
        <PositioningBand />
      </Section>

      <Section>
        <Eyebrow>Where your ad shows</Eyebrow>
        <H2>Four placements in every hub.</H2>
        <Lede>Display or CPC, on the pages where members buy, browse, book and log back in.</Lede>
        <div className="mt-10">
          <SurfacesGrid />
        </div>
      </Section>

      <Section tone="soft">
        <BrandBanners />
        <div className="mt-8 text-center">
          <Cta href="/hubs" variant="line" testId="home-hubs-gate">See hub details (email)</Cta>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <Eyebrow>Lock down my area</Eyebrow>
            <H2>Own your 5 km.</H2>
            <Lede>
              One deposit, ${AREA_LOCK.priceCad.toLocaleString()} CAD or ${AREA_LOCK.priceUsd.toLocaleString()} USD (launch rate until {AREA_LOCK.launchRateUntil}), holds up to {AREA_LOCK.standardSharePct}% of hub display around your postal code ({AREA_LOCK.denseCoreSharePct}% in busy downtown cores) for 1 to 6 months. It buys media at {AREA_LOCK.discountPct}% off the rate card and about {g.views.toLocaleString()} page views across hubs at starter rates (modelled, illustrative estimate), and unlocks {AREA_LOCK.followOnDiscountPct}% off follow-on spend up to ${AREA_LOCK.followOnCapUsd.toLocaleString()} USD.
            </Lede>
            <div className="mt-8">
              <Cta href="/advertise/local">Check my postal code</Cta>
            </div>
          </div>
          <div className="border border-foreground/15 bg-white p-6 md:p-8">
            <TamStrip compact />
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>Versus public social</Eyebrow>
        <H2>Members who already trust the brand.</H2>
        <Lede>Your ad sits inside an experience people chose, and after checkout, instead of in a feed.</Lede>
        <div className="mt-10">
          <MetaComparison />
        </div>
      </Section>

      <Section tone="ink">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center" data-testid="home-ai-buyers">
          <div>
            <Eyebrow className="text-accent">For AI buying agents</Eyebrow>
            <H2 className="text-background">Buying media with AI? Send your agent here.</H2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-background/75">
              Every slot, price and modelled view count is machine-readable. Agents can read the catalog, quote any offer and hand the buyer a Stripe-hosted checkout, with no forms in the way.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href="/ai-buyers">How agents buy</Cta>
              <Cta href="/llms.txt" variant="line" className="border-background/40 text-background">llms.txt</Cta>
            </div>
          </div>
          <pre className="overflow-x-auto border border-background/20 p-4 font-mono text-[12px] leading-relaxed text-accent">{`GET  /v1/agent/catalog.json
GET  /v1/agent/quote?offer=sponsor-3000
POST /v1/agent/checkout
GET  /v1/agent/openapi.json
GET  /.well-known/agent.json`}</pre>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Eyebrow>Questions</Eyebrow>
            <H2>Plain answers.</H2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="/media-kit" variant="line">Read the marketing kit</Cta>
            </div>
          </div>
          <Faq items={FAQ} />
        </div>
      </Section>
    </div>
  );
}
