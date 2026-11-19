/** /intake: very simple (Randy, Nov 18 2026 10:23 PM ET). Short form on top, a labelled sample of the kit below. */
import { usePageMeta } from "@/components/br/ui";
import { MockBanner } from "@/components/br/intake-kit";
import { IntakeShortForm } from "@/components/br/intake-short-form";
import { SampleKit } from "@/components/br/sample-kit";

export default function BrIntake() {
  usePageMeta("Get your media kit | Birch Reserve, powered by Friday", "Three fields. A two-sided media kit: your revenue opportunity and your exposure fit. Estimates only, reviewed by a person.");
  return (
    <div data-testid="intake-landing">
      <MockBanner />
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)]">
        <div className="container mx-auto max-w-5xl px-4 pb-8 pt-10 md:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Birch Reserve · powered by Friday</p>
          <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Get your media kit.</h1>
          <p className="mt-2 max-w-xl text-base text-muted-foreground">Three fields. We send back your revenue opportunity and where your brand fits across the network.</p>
          <div className="mt-6"><IntakeShortForm /></div>
        </div>
      </section>
      <div className="container mx-auto px-4 pb-14 pt-6"><SampleKit /></div>
    </div>
  );
}
