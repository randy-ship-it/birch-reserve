import { HubDemandCard } from "@/components/br/hundred";
import type { ReactNode } from "react";
import { LeadForm } from "@/components/br/lead-form";
import { Cta, Eyebrow, Faq, H1, Section, usePageMeta } from "@/components/br/ui";
import { payoutRegion } from "../../lib/payout-region";
import { payoutAmount, payoutLabel, payoutUsNote } from "../../../../api-server/src/lib/payoutCurrency";
import { PUBLISHER_INCENTIVE } from "../../../../api-server/src/lib/overhaul/model";

const P = PUBLISHER_INCENTIVE;
const R = payoutRegion();
const $cash = payoutAmount(P.cashCad, R);
const $credit = payoutAmount(P.creditCad, R, true);

function Box({ title, children, id, testId }: { title: string; children: ReactNode; id?: string; testId?: string }) {
  return (
    <details id={id} data-testid={testId} className="group border-b border-border py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-xl">
        {title}
        <span className="text-2xl leading-none transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

export default function BrPublishStudios() {
  usePageMeta("Publish · Studios & retail | Birch Reserve", `Activate your hub with our pre-built monetizations and marketplace. Earn ${$cash} cash or ${$credit} in ad credit.`);
  return (
    <div data-testid="br-publish-studios">
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>Studios &amp; retail</Eyebrow>
            <H1>
              Activate your hub. Get <span className="bg-accent px-1">{$cash}</span>.
            </H1>
            <p className="mt-3 text-lg">Or {$credit} in ad credit.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href={P.clinicHubsUrl} testId="cta-clinichubs">Activate your hub</Cta>
            </div>
            <HubDemandCard className="mt-6 max-w-xl" />
          </div>
          {/* BR-83: one ruled offer panel: the two payouts, then the three steps in a line each (was boxed chips). */}
          <div className="border-t-2 border-foreground" data-testid="publisher-offer">
            <div className="grid grid-cols-2 border-b border-foreground/15">
              <div className="py-6 pr-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Cash</p>
                <p className="mt-2 whitespace-nowrap font-display text-4xl leading-none">{$cash}</p>
              </div>
              <div className="border-l border-foreground/15 py-6 pl-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Or ad credit</p>
                <p className="mt-2 whitespace-nowrap font-display text-4xl leading-none">{$credit}</p>
              </div>
            </div>
            <ol className="text-sm">
              {[
                { t: "Set up", d: "Your logo, services and booking link." },
                { t: "Activate", d: "Share your hub with your members." },
                { t: "Get paid", d: `${P.paidDaysAfterFirstTransaction} days after real traffic or transactions.` },
              ].map((s, i) => (
                <li key={s.t} className="grid grid-cols-[2rem_minmax(0,1fr)] items-baseline border-b border-foreground/15 py-3.5">
                  <span className="font-display text-base tabular-nums text-muted-foreground">{i + 1}</span>
                  <span><b className="font-semibold">{s.t}</b> <span className="text-muted-foreground">· {s.d}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>
      <Section tone="soft">
        <div className="border-t border-border">
          <Box title="How it works">
            <ol className="grid gap-4 md:grid-cols-3">
              {[
                { t: "Set up your hub", d: "DIY onboarding at scalehealth.ca/clinichubs: your logo, your services, your booking link." },
                { t: "Activate your audience", d: "Promote your hub by email, text, a link on your website, at checkout and on social media. Your members get care, member offers and the marketplace." },
                { t: "Get paid", d: `Once we see real traffic or transactions from your audience, a ${P.paidDaysAfterFirstTransaction}-day clock starts. Then you get ${$cash} cash, or ${$credit} in ad credit to promote yourself on other hubs.` },
              ].map((s, i) => (
                <li key={s.t} className="border border-foreground/15 bg-white p-4">
                  <span className="font-display text-3xl text-foreground/25">{i + 1}</span>
                  <h3 className="font-display text-lg text-foreground">{s.t}</h3>
                  <p className="mt-1">{s.d}</p>
                </li>
              ))}
            </ol>
          </Box>
          <Box title="Payout table" testId="payout-table-box">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm" data-testid="publisher-ladder">
                <thead>
                  <tr className="border-b-2 border-foreground text-foreground">
                    <th className="py-3">Active customers</th>
                    <th className="py-3">Cash ({payoutLabel(R)})</th>
                    <th className="py-3">Or ad credit ({payoutLabel(R)})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {P.ladder.map((r) => (
                    <tr key={r.customers}>
                      <td className="py-3">{r.customers}+</td>
                      <td className="py-3 font-semibold">{payoutAmount(r.cashCad, R)}</td>
                      <td className="py-3 font-semibold">{payoutAmount(r.creditCad, R)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Box>
          <Box title="Terms and notes">
            <p>An active customer has made a paid order or booking. Refunds reverse the count. Self-purchases (you, your staff or your own accounts) are excluded. Paid {P.paidDaysAfterFirstTransaction} days after we first see real traffic or transactions. Bigger audiences earn more.</p>
          </Box>
          <Box title="Paid in CAD" testId="payout-currency-note">
            <p>{R === "us" ? payoutUsNote() : "Payouts are set and paid in CAD."}</p>
          </Box>
          <Box title="FAQ">
            <Faq
              items={[
                { q: "Do I pay anything?", a: "No. Hub setup is free. You earn from member purchases through the marketplace and from the activation bonus." },
                { q: "Cash or credit?", a: `Your choice: ${$cash} cash, or ${$credit} in ad credit you can use to advertise on other hubs, which goes further.` },
                { q: "When is it paid?", a: `${P.paidDaysAfterFirstTransaction} days after the first unique transaction on your hub, once your customers are active on the hub monetizer.` },
              ]}
            />
          </Box>
          <Box title="Want setup help?" testId="setup-help-box">
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
          </Box>
        </div>
      </Section>
    </div>
  );
}
