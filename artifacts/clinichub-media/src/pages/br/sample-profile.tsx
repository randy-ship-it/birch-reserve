import { SampleBenefitsProfile } from "@/components/br/sample-benefits-profile";
import { Cta, Eyebrow, H1, Lede, Section, usePageMeta } from "@/components/br/ui";
import { LOOK_HREF, SeatCtas } from "@/components/br/pricing";

export default function BrSampleProfile() {
  usePageMeta(
    "Sample partner audience profile | Birch Reserve",
    "An illustrative, aggregated sample of the anonymized fields a benefits administrator typically already has. Sample ranges only, not a real book of business.",
  );
  return (
    <div data-testid="br-sample-profile">
      <Section>
        <Eyebrow>Partner audience profile</Eyebrow>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <H1 className="!mt-0">What a benefits partner can show us, in aggregate.</H1>
        </div>
        <Lede>
          This page is a sample, illustrative example of the kind of cohort-level picture we can work from. It is not a live partner's data.
        </Lede>
        <p className="mt-4 text-sm">
          <a href="/audiences" className="underline underline-offset-4">Back to Audience insights</a>
        </p>
      </Section>
      <Section tone="soft">
        <SampleBenefitsProfile standalone />
      </Section>
      <Section>
        <SeatCtas />
        <div className="mt-4">
          <Cta href={LOOK_HREF} variant="line">Start with a $190 look</Cta>
        </div>
      </Section>
    </div>
  );
}
