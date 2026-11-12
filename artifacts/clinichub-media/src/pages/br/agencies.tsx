import { CheckCircle2 } from "lucide-react";
import { LeadForm } from "@/components/br/lead-form";
import { TamStrip } from "@/components/br/blocks";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { SLOT_LADDER } from "../../../../api-server/src/lib/overhaul/model";

export default function BrAgencies() {
  usePageMeta("For agencies | Birch Reserve", "Prepay a client test budget into health & wellness hubs. UTM and promo-code reporting. 10% agency commission.");
  return (
    <div data-testid="br-agencies">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: "Birch Reserve agency test budgets", provider: { "@type": "Organization", name: "Birch Reserve" }, areaServed: ["CA", "US"], serviceType: "Retail media / post-purchase advertising", url: "https://birchreserve.net/agencies" }} />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>For agencies</Eyebrow>
            <H1>Park a client test budget where health buyers already are.</H1>
            <Lede>Prepay once for one or more clients. The credit runs inside co-branded Recovery Brand hubs and health &amp; wellness business hubs as the right hubs launch, and every placement is tracked with UTM links and promo codes.</Lede>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="#talk">Talk to us</Cta>
              <Cta href="/media-kit" variant="line">Marketing kit</Cta>
            </div>
          </div>
          <div className="border border-foreground/15 bg-white p-6">
            <ul className="space-y-3 text-sm">
              {[
                "Prepay a client test budget, any amount from $490 USD; tiers add up to 15% bonus credit",
                "Credit spends down on live hubs under an insertion order naming the hubs; unused credit can be refunded or extended",
                "Reporting per hub and surface: views, clicks, UTM visits, promo-code redemptions",
                "Agency commission: 10% of media spend, paid to the agency of record",
                "Display and CPC on post-purchase, hub home, product / services and member dashboard pages",
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
        <TamStrip />
      </Section>
      <Section>
        <Eyebrow>Test budget tiers</Eyebrow>
        <H2>Same ladder as brands.</H2>
        <div className="mt-8 grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-4">
          {SLOT_LADDER.map((t) => (
            <div key={t.key} className="bg-background p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">{t.label}</p>
              <p className="mt-2 font-display text-4xl">${t.usd.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">USD · ${t.cad.toLocaleString()} CAD</p>
              <p className="mt-3 text-sm">{t.bonusPct ? `+${t.bonusPct}% bonus credit` : "Rate card"}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section tone="soft" id="talk">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <H2>Tell us about your clients.</H2>
            <p className="mt-4 text-sm text-muted-foreground">We'll reply with hub fit and a draft insertion order.</p>
          </div>
          <LeadForm
            kind="agency_inquiry"
            testId="form-agency"
            submitLabel="Send"
            done={<p>Thanks. We'll reply with hub fit and a draft insertion order.</p>}
            fields={[
              { name: "company", label: "Agency", required: true },
              { name: "name", label: "Your name", required: true },
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "website", label: "Agency website", type: "url" },
              { name: "client_categories", label: "Client categories", type: "select", options: ["Health & wellness DTC", "Supplements / nutrition", "Fitness / recovery", "Food / beverage", "Pets", "Mixed"] },
              { name: "test_budget", label: "Test budget per client", type: "select", options: ["Under $1,500", "$1,500–$3,000", "$3,000–$6,000", "Over $6,000"] },
              { name: "message", label: "Notes", type: "textarea" },
            ]}
          />
        </div>
      </Section>
      <Section>
        <Faq
          items={[
            { q: "Can we prepay for several clients?", a: "Yes. One prepay can be split across clients; each client gets its own insertion order and reporting." },
            { q: "Is there a commission?", a: "Yes: 10% of media spend, paid to the agency of record. Agency prepay also earns the same bonus credit tiers as brands (+5% from $1,500, +10% from $3,000, +15% from $6,000 USD)." },
            { q: "How is performance tracked?", a: "Every placement carries your UTM parameters and, if you want, a promo code. We report views and clicks per hub and surface. Aggregate only." },
            { q: "Can our bots read this site?", a: "Yes: see /llms.txt, /sitemap.xml and the structured data on each page." },
          ]}
        />
      </Section>
    </div>
  );
}
