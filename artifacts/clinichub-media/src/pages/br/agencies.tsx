import { StartSmall } from "@/components/br/start-small";
import { KitEntry } from "@/components/br/pilot-path";
import { CheckCircle2 } from "lucide-react";
import { LeadForm } from "@/components/br/lead-form";
import { AgencyPayouts, GoalPlanner, InventorySpec, IoProcess, PlainTerms } from "@/components/br/agency-showcase";
import { AGENCY_FAQ } from "../../../../api-server/src/lib/overhaul/agencyShowcase";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { StarterOffers } from "@/components/br/starter-offers";

/**
 * Why lock a client test now (Nov 16 2026 daily scan). Honest urgency only: every line restates terms
 * already published on /rates, /media-kit and /terms. No invented deadline, no seat counts.
 */
const WHY_NOW = [
  { k: "Starter rates", t: "Rates step up only once reporting proves a placement.", d: "New placements open at starter rates. A placement's rate can step up only after campaign reporting shows it performs. Prepaid credit keeps its rate for its term." },
  { k: "Curated placements", t: "Placed by hand, hub by hub.", d: "Placements across the hub network are placed by hand on each hub. No bidding, no auction." },
  { k: "Low risk", t: "Refundable until 14 days before launch.", d: "The $490 USD reserve is 100% media credit and fully refundable until 14 days before the launch date on your insertion order. Nothing runs until the IO names the hub and surface." },
];

/** What an agency or broker can forward to a client today. Existing public pages only. */
const FORWARD_KIT = [
  { href: "/media-kit", t: "Media kit", d: "One link: offer, placements, rates." },
  { href: "/sample-io", t: "Sample IO", d: "What your client signs before anything runs." },
  { href: "/audiences", t: "Audience insights", d: "Who the hubs reach. Measured, modelled and estimated figures, labelled." },
  { href: "/terms", t: "Terms", d: "Credit, refunds and cancellation in writing." },
  { href: "/media-buyers", t: "For media buyers", d: "How Birch fits next to programmatic, paid social and retail media." },
];

export default function BrAgencies() {
  usePageMeta("For agencies & brokers | Birch Reserve", "Agencies, brokers and media resellers: prepay a client test into private health & wellness hubs from $490 USD. Spec sheet, sample IO, UTM and promo-code reporting, 10% of media spend paid in cash to the agency of record.");
  return (
    <div data-testid="br-agencies">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: "Birch Reserve agency test budgets", provider: { "@type": "Organization", name: "Birch Reserve" }, areaServed: ["CA", "US"], serviceType: "Retail media / post-purchase advertising", url: "https://birchreserve.net/agencies" }} />
      <KitEntry from="agencies" />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>For agencies, brokers &amp; media resellers</Eyebrow>
            <H1>Park a client test budget where health buyers already are.</H1>
            <Lede>Prepay once for one or more clients. The credit runs inside co-branded Recovery Brand hubs and health &amp; wellness business hubs as the right hubs launch, and every placement is tracked with UTM links and promo codes.</Lede>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="#talk" testId="agency-cta-io">Request a draft IO</Cta>
              <Cta href={RESERVE_HREF} variant="ink" testId="agency-cta-reserve">Reserve for a client · $490 USD</Cta>
              <Cta href="/media-kit" variant="line">Media kit</Cta>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Small test? Start with the <a className="underline underline-offset-2" href={LOOK_HREF}>$190 USD 7-day look</a>. It converts in full to the reserve within 7 days, or is refunded.
            </p>
          </div>
          <div className="border border-foreground/15 bg-white p-6">
            <ul className="space-y-3 text-sm">
              {[
                "Prepay a client test budget, any amount from $490 USD; tiers add up to 15% bonus credit",
                "Credit spends down on live hubs under an insertion order naming the hubs; unused credit can be refunded or extended",
                "Reporting per hub and surface: views, clicks, UTM visits, promo-code redemptions",
                "Agency commission: 10% of media spend, paid in cash to the agency of record",
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
      <Section tone="soft" id="client-test">
        <Eyebrow>Client tests</Eyebrow>
        <H2>Test a client from $1K–$5K. Fully refundable deposit.</H2>
        <p className="mt-4 max-w-2xl text-muted-foreground">One IO per client. The agency of record earns 10% of media spend in cash. Smaller clients can start at $190.</p>
        <StartSmall page="agencies" highlight="agency" id="start-small-tiers" heading={false} />
      </Section>

      <Section tone="soft" id="plain-terms">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Eyebrow>In plain terms</Eyebrow>
            <H2>Explain it to a client in five answers.</H2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              What Birch Reserve is, the moment it reaches, where the figures come from, what gets reported and how a test starts. Forward this section as is:{" "}
              <a href="/agencies#plain-terms" className="break-all underline underline-offset-2" data-testid="plain-terms-link">birchreserve.net/agencies#plain-terms</a>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Cta href="#talk" testId="plain-cta-io">Request a draft IO</Cta>
              <Cta href="/media-kit" variant="line">Media kit</Cta>
            </div>
          </div>
          <PlainTerms />
        </div>
      </Section>
      <Section id="plan-by-goal">
        <Eyebrow>Plan by goal</Eyebrow>
        <H2>Drop it into the media plan you already have.</H2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Match your client's brief to the hub placement that fits it, then send us the brief. We reply with hub fit and a draft insertion order.</p>
        <div className="mt-8">
          <GoalPlanner />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Cta href="#talk" testId="goal-cta-io">Send the brief · get a draft IO</Cta>
          <Cta href={RESERVE_HREF} variant="line" testId="goal-cta-reserve">Reserve for a client · $490 USD</Cta>
        </div>
        <p className="mt-4 text-sm text-muted-foreground" data-testid="agency-media-buyers-link">
          Client already runs display, retargeting or paid social? <a className="underline underline-offset-2" href="/media-buyers#display-mix">See how Birch sits next to that mix</a>.
        </p>
      </Section>
      <Section tone="soft">
        <div data-testid="agency-why-now">
          <Eyebrow>Why lock a client test now</Eyebrow>
          <H2>Starter rates, set per placement.</H2>
          <div className="mt-8 grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-3">
            {WHY_NOW.map((w) => (
              <div key={w.k} className="bg-background p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">{w.k}</p>
                <h3 className="mt-2 font-display text-2xl leading-tight">{w.t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{w.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Aggregate reporting only. Any view figure is a modelled estimate, not measured delivery or a guarantee.</p>
        </div>
      </Section>
      <Section>
        <Eyebrow>Client test budgets</Eyebrow>
        <H2>Same two offers as brands. Both USD.</H2>
        <div className="mt-8">
          <StarterOffers testId="agency-offers" />
        </div>
      </Section>
      <Section tone="soft">
        <Eyebrow>Spec sheet</Eyebrow>
        <H2>Four placements. Public starting rates.</H2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Forward this to your client or planner. The IO names the hub, surface, format and dates.</p>
        <div className="mt-8">
          <InventorySpec />
        </div>
      </Section>
      <Section>
        <Eyebrow>From brief to live</Eyebrow>
        <H2>Six steps. Nothing runs before the IO.</H2>
        <div className="mt-8">
          <IoProcess />
        </div>
      </Section>
      <Section tone="soft">
        <Eyebrow>Agency of record</Eyebrow>
        <H2>Your cut of every client you place.</H2>
        <div className="mt-8">
          <AgencyPayouts />
        </div>
      </Section>
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]" data-testid="agency-brokers">
          <div>
            <Eyebrow>Brokers &amp; media resellers</Eyebrow>
            <H2>Bring several brands. One form.</H2>
            <p className="mt-4 text-sm leading-relaxed text-foreground/80">
              Represent more than one brand? List them in one inquiry. Each client gets its own insertion order and its own reporting. When you are the agency of record on the IO, the same terms apply: 10% of media spend, paid in cash.
            </p>
            <div className="mt-6">
              <Cta href="#talk" variant="ink" testId="agency-broker-cta">List your clients</Cta>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Forward-ready kit</p>
            <ul className="mt-3 divide-y divide-border border-y border-border" data-testid="agency-forward-kit">
              {FORWARD_KIT.map((f) => (
                <li key={f.href}>
                  <a href={f.href} className="flex items-baseline justify-between gap-4 py-4 hover:underline">
                    <span className="font-display text-xl">{f.t}</span>
                    <span className="text-right text-sm text-muted-foreground">{f.d}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
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
              { name: "test_budget", label: "Test budget per client", type: "select", options: ["$190 USD 7-day look", "$490 USD reserve", "Premium slot (inquiry)", "Not sure yet"] },
              { name: "message", label: "Notes", type: "textarea" },
            ]}
          />
        </div>
      </Section>
      <Section>
        {/* FAQPage JSON-LD for /agencies is emitted once, server-side (seo.ts), with the plain-terms answers. */}
        <Faq items={AGENCY_FAQ} schema={false} />
      </Section>
    </div>
  );
}
