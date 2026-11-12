import { CheckCircle2 } from "lucide-react";
import { LeadForm } from "@/components/br/lead-form";
import { Cta, Eyebrow, Faq, H1, H2, Lede, Section, usePageMeta } from "@/components/br/ui";
import { PUBLISHER_INCENTIVE } from "../../../../api-server/src/lib/overhaul/model";

const P = PUBLISHER_INCENTIVE;

export default function BrPublishStudios() {
  usePageMeta("Publish · Studios & retail | Birch Reserve", `Activate your hub with our pre-built monetizations and marketplace. Earn $${P.cashCad} cash or $${P.creditCad}+ in ad credit.`);
  return (
    <div data-testid="br-publish-studios">
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>Publish · Studios &amp; retail</Eyebrow>
            <H1>
              Activate your hub. Get <span className="bg-accent px-1">${P.cashCad}</span>.
            </H1>
            <Lede>Studios, gyms, clinics and wellness retailers: set up your hub yourself with our pre-built monetizations and our marketplace plugged in. Payouts start when your customers use it.</Lede>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href={P.clinicHubsUrl} testId="cta-clinichubs">Activate at scalehealth.ca/clinichubs</Cta>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Opens scalehealth.ca/clinichubs, where hubs are set up.</p>
          </div>
          <div className="border-2 border-foreground bg-white p-6 md:p-8" data-testid="publisher-offer">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Your activation bonus</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-secondary/60 p-4">
                <p className="font-display text-5xl">${P.cashCad}</p>
                <p className="mt-1 text-sm">cash, CAD</p>
              </div>
              <div className="bg-accent/50 p-4">
                <p className="font-display text-5xl">${P.creditCad}+</p>
                <p className="mt-1 text-sm">in ad credit instead</p>
              </div>
            </div>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "Activate your audience: invite your customers to your hub",
                "Activate customers on the hub monetizer (our marketplace)",
                `Paid ${P.paidDaysAfterFirstTransaction} days after your first unique transaction`,
                "Bigger audiences earn more (see the ladder)",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
      <Section tone="soft">
        <Eyebrow>How it works</Eyebrow>
        <H2>Three steps.</H2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { t: "Set up your hub", d: "DIY onboarding at scalehealth.ca/clinichubs: your logo, your services, your booking link." },
            { t: "Activate your customers", d: "Share your hub with your members. They get care, member offers and the marketplace." },
            { t: "Get paid", d: `After your first unique transaction we start a ${P.paidDaysAfterFirstTransaction}-day clock. Then you get $${P.cashCad} cash, or $${P.creditCad}+ in ad credit to promote yourself on other hubs.` },
          ].map((s, i) => (
            <li key={s.t} className="border border-foreground/15 bg-white p-6">
              <span className="font-display text-5xl text-foreground/25">{i + 1}</span>
              <h3 className="mt-2 font-display text-2xl">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm" data-testid="publisher-ladder">
            <thead>
              <tr className="border-b-2 border-foreground">
                <th className="py-3">Active customers on your hub</th>
                <th className="py-3">Cash (CAD)</th>
                <th className="py-3">Or ad credit (CAD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {P.ladder.map((r) => (
                <tr key={r.customers}>
                  <td className="py-3">{r.customers}+</td>
                  <td className="py-3 font-semibold">${r.cashCad.toLocaleString()}</td>
                  <td className="py-3 font-semibold">${r.creditCad.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted-foreground">Draft terms: an active customer has made a paid order or booking. Refunds reverse the count. Paid {P.paidDaysAfterFirstTransaction} days after the first unique transaction. Final terms are being confirmed.</p>
        </div>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <H2>Want help setting up?</H2>
            <p className="mt-4 text-sm text-muted-foreground">Leave your details and we'll walk you through it.</p>
          </div>
          <LeadForm
            kind="publisher_studio"
            testId="form-studio"
            submitLabel="Get setup help"
            done={<p>Thanks. We'll reach out to help you activate. You can also start now at scalehealth.ca/clinichubs.</p>}
            fields={[
              { name: "company", label: "Business", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "website", label: "Website", type: "url" },
              { name: "type", label: "Type", type: "select", required: true, options: ["Studio", "Gym", "Physio / clinic", "Wellness retail", "Online coach / digital", "Other"] },
              { name: "members", label: "Active customers / members", type: "select", options: ["Under 100", "100–500", "500–2,000", "Over 2,000"] },
              { name: "postal", label: "Postal code / ZIP" },
            ]}
          />
        </div>
      </Section>
      <Section tone="soft">
        <Faq
          items={[
            { q: "Do I pay anything?", a: "No. Hub setup is free. You earn from member purchases through the marketplace and from the activation bonus." },
            { q: "Cash or credit?", a: `Your choice: $${P.cashCad} cash, or $${P.creditCad}+ in ad credit you can use to advertise on other hubs, which goes further.` },
            { q: "When is it paid?", a: `${P.paidDaysAfterFirstTransaction} days after the first unique transaction on your hub, once your customers are active on the hub monetizer.` },
          ]}
        />
      </Section>
    </div>
  );
}
