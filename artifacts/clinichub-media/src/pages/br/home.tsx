import { ConveyorHero } from "@/components/br/conveyor";
import { BrandBanners } from "@/components/br/brand-banners";
import { FourPaths, MetaComparison, PositioningBand, SurfacesGrid } from "@/components/br/blocks";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { UPGRADE_PATH_LINE } from "../../../../api-server/src/lib/overhaul/mediaKit";
import { MediaKitPdfLink, ProofStrip, SalesContact, TRUST_FAQ, TrustBand, TrustFaq } from "@/components/br/trust";
import { QuickBuy } from "@/components/br/quick-buy";
import { ModellingNote } from "@/components/br/buyer-comfort";
import { DoorRoute } from "@/components/br/door-route";
import { CategoryRequestForm, FaceBeforeFlight, FounderNote, PrimeHero, SALES_EMAIL, SALES_PHONE_DISPLAY, SALES_PHONE_HREF, priceLabels, useAvailability } from "@/components/br/prime-hero";
import { AgencyHero, AgencyPayouts, InsiderGrid, InventorySpec, IoProcess } from "@/components/br/agency-showcase";
import { AGENCY_SHARE } from "../../../../api-server/src/lib/overhaul/agencyShowcase";
import { LOOK_HREF, RESERVE_HREF, MetaHook, PackPicker, ProveItLadder, RateCardV2 } from "@/components/br/pricing";
import { INVENTORY, PUBLISHER_INCENTIVE } from "../../../../api-server/src/lib/overhaul/model";

const FAQ = [
  { q: "Where exactly do the ads run?", a: "Only inside co-branded hubs from Recovery Brands (recovery, longevity and food today; pets in queue) and inside health and wellness business hubs such as physio, gym, studio and clinic hubs. Each hub has four placements: post-purchase, the hub home page, product and services pages, and the member dashboard behind login." },
  { q: "Which hubs are live?", a: `${INVENTORY.line} ${INVENTORY.queueLine}` },
  { q: "Is this display or cost-per-click?", a: "Both. Every placement can be bought as display (priced per thousand views) or CPC (priced per click). Deposits and area locks draw down against either." },
  { q: "Are the audience numbers measured?", a: "Not yet. Any audience or view figure on this site is a modelled estimate, not measured delivery. We don't publish a network views figure; your insertion order sizes views against live hub supply. Reporting on your campaign is measured with UTM links and promo codes." },
  { q: "Can a local business or studio buy?", a: "Yes. Start with the same $190 USD 7-day look or $490 USD reserve. Locking your area (a share of hub display near your postal code) is a premium option, by inquiry." },
  { q: "How do I become a publisher?", a: `Studios and retailers activate a hub at scalehealth.ca/clinichubs and earn $${PUBLISHER_INCENTIVE.cashCad} cash or $${PUBLISHER_INCENTIVE.creditCad}+ in ad credit once they activate their audience (email, text, a link on their site, at checkout, social). It is paid ${PUBLISHER_INCENTIVE.paidDaysAfterFirstTransaction} days after we see real traffic or transactions; self-purchases are excluded. Brands with a recovery audience can apply for a co-branded hub.` },
  { q: "Do agencies get anything?", a: `Yes. ${AGENCY_SHARE.line} Agencies can also prepay a client test budget and get UTM and promo-code reporting per hub and surface.` },
];

export default function BrHome() {
  usePageMeta("Birch Reserve | Display space across private health & wellness hubs", "Reserve a share of display space across a growing network of private, members-only health and wellness hubs. $490 USD to reserve or a $190 USD 7-day look. Media credit until IO, aggregate reporting, no impression guarantees.");
  const price = priceLabels(useAvailability());
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
          address: { "@type": "PostalAddress", addressLocality: "Toronto", addressRegion: "ON", addressCountry: "CA" },
        }}
      />
      <PrimeHero />

      <section id="placements" className="scroll-mt-20 border-b border-border/70 bg-background lg:hidden" data-testid="home-placements-mobile">
        <div className="container mx-auto px-5 py-8">
          <ConveyorHero />
        </div>
      </section>

      <Section id="proof-live">
        <FaceBeforeFlight />
      </Section>

      <Section id="request" tone="soft">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <CategoryRequestForm path="/" />
          <div className="space-y-4">
            <div className="border border-foreground bg-foreground p-5 text-background md:p-6" data-testid="home-contact">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/60">Talk to sales</p>
              <a href={SALES_PHONE_HREF} className="mt-2 block font-display text-3xl underline-offset-4 hover:underline">{SALES_PHONE_DISPLAY}</a>
              <a href={`mailto:${SALES_EMAIL}?subject=Birch%20Reserve%20seat`} className="mt-1 block text-base underline-offset-4 hover:underline">{SALES_EMAIL}</a>
              <p className="mt-3 text-sm text-background/70">Prefer a one-pager? <a href="/media-kit" className="font-semibold text-accent underline underline-offset-4">Read the media kit</a>.</p>
            </div>
            <FounderNote />
          </div>
        </div>
      </Section>

      <Section id="packages">
        <Eyebrow>Two packages</Eyebrow>
        <H2>Start with a reserve. Then go premium.</H2>
        <p className="mt-4 max-w-2xl text-muted-foreground" data-testid="home-upgrade">{UPGRADE_PATH_LINE} The small-business package is the easy way to start. Premium slots are the main event.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2" data-testid="home-packages">
          <article className="flex flex-col border border-foreground/20 bg-white p-5 md:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Small business package</p>
            <h3 className="mt-1 font-display text-2xl">{price.look} look · {price.seat} reserve</h3>
            <p className="mt-3 text-sm text-foreground/80">Self-serve card checkout. A share of display space across the hub network, with placements curated as hubs launch. 100% media credit until the IO, usable 12 months; fully refundable until 14 days before launch. The {price.look} look converts in full to the reserve within 7 days, or is refunded.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Cta href={RESERVE_HREF} testId="home-cta-seat">Reserve your space — {price.seat}</Cta>
              <Cta href={LOOK_HREF} variant="line" testId="home-cta-look">Take a 7-day look — {price.look}</Cta>
            </div>
          </article>
          <article className="flex flex-col border-2 border-foreground bg-foreground p-5 text-background md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-background/60">Premium slots · the main event</p>
              <span className="border border-[#C8F55A] bg-[#C8F55A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#071A39]">Inquire only</span>
            </div>
            <h3 className="mt-1 font-display text-2xl">From $25K, $25K–$50K</h3>
            <p className="mt-3 text-sm text-background/80">Exclusivity, a larger display share and priority placement. No card purchase — we write the insertion order.</p>
            <div className="mt-6">
              <Cta href="/media-kit#premium" variant="lime" testId="home-cta-premium">Inquire about a premium slot</Cta>
            </div>
          </article>
        </div>
      </Section>

      <AgencyHero />

      <Section id="proof" tone="soft">
        <Eyebrow>What we can show today</Eyebrow>
        <H2>Measured proof from the live hubs.</H2>
        <p className="mt-4 max-w-2xl text-muted-foreground">Launch brand logos already listed on partner hubs, plus first-party session shares. Every figure is tagged Measured. No case study yet, so we are not inventing one.</p>
        <div className="mt-8">
          <ProofStrip />
        </div>
      </Section>

      <Section id="doors" tone="ink">
        <DoorRoute requestHref="#request" testId="home-doors" large />
      </Section>

      <Section id="inventory">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Inventory &amp; placements</Eyebrow>
            <H2>The spec sheet.</H2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">Four placements in every hub, each sold as display or CPC. Starting rates are public; the IO names the hub and surface.</p>
        </div>
        <InventorySpec />
      </Section>

      <Section tone="soft" id="quick-buy">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Self-serve</Eyebrow>
            <H2>Buy ad space in three taps.</H2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">Pick a placement, pick your start, see the modelled views and CPM, then pay by card on the secure checkout. No login.</p>
        </div>
        <QuickBuy />
        <ModellingNote className="mt-4" />
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
        <ModellingNote className="mt-4" />
      </Section>

      <Section tone="soft" id="insider">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Audience · measurement · brand safety</Eyebrow>
            <H2>What a media buyer checks first.</H2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">Who you reach, how it is reported, and what keeps the environment clean.</p>
        </div>
        <InsiderGrid />
      </Section>

      <Section id="io">
        <Eyebrow>Insertion process</Eyebrow>
        <H2>Brief to flight in six steps.</H2>
        <Lede>Nothing runs until an insertion order names the hub and surface.</Lede>
        <div className="mt-10">
          <IoProcess />
        </div>
      </Section>

      <Section tone="soft" id="agency-payouts">
        <Eyebrow>How agency payouts work</Eyebrow>
        <H2>Your cut of every client you place.</H2>
        <div className="mt-10">
          <AgencyPayouts />
        </div>
      </Section>

      <Section tone="ink">
        <MetaHook />
      </Section>

      <Section tone="soft" id="packs">
        <Eyebrow>View blocks</Eyebrow>
        <H2>Build a pack in 10 seconds.</H2>
        <Lede>Pick surfaces and a block size. Bundles get a modest discount. Start self-serve with a reserve, or take it to an IO for large or exclusive deals.</Lede>
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

      <Section id="placements-detail">
        <div className="hidden lg:block">
          <Eyebrow>Where your ad shows</Eyebrow>
          <H2>Four placements in every hub.</H2>
          <Lede>Display or CPC, on the pages where members buy, browse, book and log back in.</Lede>
          <ConveyorHero className="mt-10" />
        </div>
        <div className="mt-10 max-lg:mt-0">
          <SurfacesGrid />
        </div>
      </Section>

      <Section tone="soft">
        <BrandBanners />
        <div className="mt-8 text-center">
          <Cta href="/hubs" variant="line" testId="home-hubs-gate">See hub details (email)</Cta>
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
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center" data-testid="home-buyers">
          <div>
            <Eyebrow className="text-accent">For media buyers &amp; agencies</Eyebrow>
            <H2 className="text-background">Two offers, priced in USD.</H2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-background/75">
              A $190 USD 7-day category look or a $490 USD category reserve, paid by card on a Stripe-hosted page. Agencies earn 10% of media spend in cash.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href="/buyers">For media buyers</Cta>
              <Cta href="/media-kit" variant="line" className="border-background/40 text-background">See the media kit</Cta>
            </div>
          </div>
        </div>
      </Section>

      <TrustBand />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Eyebrow>Questions</Eyebrow>
            <H2>Plain answers.</H2>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="/media-kit" variant="line">Read the media kit</Cta>
              <MediaKitPdfLink variant="line" testId="home-media-kit-pdf" />
            </div>
            <div className="mt-8 border border-foreground/15 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Talk to the founder</p>
              <div className="mt-3">
                <SalesContact />
              </div>
            </div>
          </div>
          <div className="space-y-8">
            {/* Nov 18 2026: one FAQPage for the page (was two: trust + home), so search engines read it cleanly. */}
            <TrustFaq schema={false} />
            <Faq items={FAQ} schema={false} />
            <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [...TRUST_FAQ, ...FAQ].map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })) }} />
          </div>
        </div>
      </Section>
    </div>
  );
}
