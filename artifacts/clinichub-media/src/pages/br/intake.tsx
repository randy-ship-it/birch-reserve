/** /intake: very simple (Randy, Nov 18 2026 10:23 PM ET). Short form on top, a labelled sample of the kit below. */
import { usePageMeta } from "@/components/br/ui";
import { MockBanner } from "@/components/br/intake-kit";
import { IntakeShortForm } from "@/components/br/intake-short-form";
import { SampleKit } from "@/components/br/sample-kit";
import { CtaBand, SampleLeadStatus } from "@/components/br/intake-sell";
import { ActivationRange, ExposureCard } from "@/components/br/intake-geo";
import { mockExposure, publisherActivation } from "../../../../api-server/src/lib/kitCalc/activation";

/** Sample-only inputs (example values, not a real brand or hub). */
const SAMPLE_EXPOSURE = { ...mockExposure({ sells_in: ["CA", "US"], ships_to: ["CA", "US"], regions: ["BC"] }), basis: "Sample: network figures / targets × example activation shares (1%–5%)" };
const SAMPLE_PUB = publisherActivation({ on: { post_purchase: true, home: true }, mode: "cpm", sizeX: 1, conversionPct: 0, valuePerConversionUsd: 0 });

export default function BrIntake() {
  usePageMeta("Get your media kit | Birch Reserve, powered by Friday", "Three fields. A two-sided media kit: your revenue opportunity and your exposure fit. Estimates only, reviewed by a person.");
  return (
    <div data-testid="intake-landing">
      <MockBanner />
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)]">
        <div className="container mx-auto max-w-5xl px-4 pb-8 pt-10 md:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Birch Reserve · powered by Friday</p>
          <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Get your media kit.</h1>
          <p className="mt-2 max-w-xl text-base text-muted-foreground">Pick your side. Advertisers get a two-sided kit: revenue opportunity and where the brand fits across the network. Publishers get what their hub could earn.</p>
          <div className="mt-6"><IntakeShortForm /></div>
        </div>
      </section>
      <div className="container mx-auto px-4 pb-10 pt-6">
        <SampleKit />
        <div className="mt-6 grid gap-4 lg:grid-cols-2" data-testid="sample-activation">
          <ExposureCard exposure={SAMPLE_EXPOSURE} source="sample" sync={false} testId="sample-exposure" />
          <ActivationRange kind="publisher" block={SAMPLE_PUB} source="sample" testId="sample-activation-publisher" />
        </div>
        <div className="mt-4 max-w-2xl"><SampleLeadStatus /></div>
      </div>
      <CtaBand side="advertiser" where="intake" />
    </div>
  );
}
