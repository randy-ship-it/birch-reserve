import { ChannelBenchmarks, MetaHook, PackPicker, ProveItLadder, RateCardV2, ScenarioCalculator, SeatCtas } from "@/components/br/pricing";
import { Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { RATE_SURFACES } from "../../../../api-server/src/lib/overhaul/pricing";

const FAQ = [
  { q: "Are these the prices I'll pay?", a: "They are starting-at planning estimates, not a quote. Your insertion order names the hubs, surfaces and final rate before anything runs." },
  { q: "Why do rates go up later?", a: "New placements open at starter rates. A placement only steps toward the proven range once campaign reporting (views, clicks, UTM visits, promo-code redemptions) shows it performs. Your locked deposit keeps its rate for its term." },
  { q: "What does the $490 category prepay do?", a: "It holds your recovery category (one brand per category) and all $490 is media credit toward any pack. Fully refundable until 14 days before your launch date. The $190 7-day look is 100% credit if you move to a category prepay within 7 days, else refunded." },
  { q: "How big can a buy get?", a: "Self-serve packs run up to $25k at starter rates. Larger or category-exclusive buys go on an insertion order sized to live hub supply. 20mm+ orders are being onboarded across the network." },
];

export default function BrRates() {
  usePageMeta(
    "Rates | Birch Reserve",
    "Starting-at CPM and CPC rates for five hub surfaces, view-block packs, a scenario calculator and how rates rise only once placements are proven. Illustrative estimates.",
  );
  return (
    <div className="w-full overflow-x-hidden" data-testid="br-rates">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "OfferCatalog",
          name: "Birch Reserve starting-at rates (illustrative)",
          itemListElement: RATE_SURFACES.map((s) => ({ "@type": "Offer", name: `${s.label} display`, description: `Starting at $${s.cpmStarter[0]} CPM USD (illustrative estimate)` })),
        }}
      />
      <Section>
        <Eyebrow>Rates</Eyebrow>
        <H1>Starting-at rates for every hub surface.</H1>
        <Lede>Five surfaces, display or CPC. Start at starter rates, see the reporting, and only pay more once a placement proves it works.</Lede>
        <SeatCtas className="mt-8" />
      </Section>
      <Section tone="ink">
        <MetaHook />
      </Section>
      <Section id="rates">
        <Eyebrow>Rate card</Eyebrow>
        <H2>Five surfaces.</H2>
        <div className="mt-8">
          <RateCardV2 />
        </div>
      </Section>
      <Section tone="soft" id="packs">
        <Eyebrow>View blocks</Eyebrow>
        <H2>Build a pack.</H2>
        <div className="mt-8">
          <PackPicker />
        </div>
      </Section>
      <Section id="scenario">
        <Eyebrow>Scenario calculator</Eyebrow>
        <H2>From 100k views to 1B.</H2>
        <Lede>Slide to see what a volume costs at starter rates, the same views on Meta, and where proven placements land.</Lede>
        <div className="mt-8">
          <ScenarioCalculator />
        </div>
      </Section>
      <Section tone="soft">
        <Eyebrow>Prove it, then raise</Eyebrow>
        <H2>You pay starter rates until it works.</H2>
        <div className="mt-8">
          <ProveItLadder />
        </div>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Channel ranges</Eyebrow>
            <H2>How it compares.</H2>
            <div className="mt-8">
              <ChannelBenchmarks />
            </div>
          </div>
          <div>
            <Eyebrow>Questions</Eyebrow>
            <H2>Plain answers.</H2>
            <div className="mt-8">
              <Faq items={FAQ} />
            </div>
          </div>
        </div>
        <SeatCtas className="mt-12" />
      </Section>
    </div>
  );
}
