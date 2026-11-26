import { useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { isScaleSkin, skinText } from "@/lib/siteSkin";
import { LeadForm } from "@/components/br/lead-form";
import { KitEntry } from "@/components/br/pilot-path";
import { SeeYourAd } from "@/components/br/see-your-ad";
import { INVENTORY } from "../../../../api-server/src/lib/overhaul/model";
import { AgencyDiscountExample, AgencyRateCardModel, BlockLadder, BuyPaths, ExclusivePerks, GoalPlanner, InventoryCanister, InventorySpec, IoProcess, PlainTerms } from "@/components/br/agency-showcase";
import { AGENCY_FAQ } from "../../../../api-server/src/lib/overhaul/agencyShowcase";
import { RESERVE_HREF, lookHref } from "@/components/br/pricing";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";

/**
 * /agencies (Randy, Nov 24 2026; Nov 25: industry-standard 15% agency commission off gross + committed-block tiers):
 * agencies set their own resale price, agencies handle their own client disclosure, direct buyers
 * pay the rate card, no undercutting of agency clients. No call CTA. No services or GTM promise.
 */

/** What an agency or broker can forward to a client today. Existing public pages only. */
const FORWARD_KIT = [
  { href: "/media-kit", t: "Media kit", d: "The published rate card, placements and terms." },
  { href: "/sample-io", t: "Sample IO", d: "What your client signs before anything runs." },
  { href: "/audiences", t: "Audience insights", d: "Who the hubs reach. Measured, modelled and estimated figures, labelled." },
  { href: "/terms", t: "Terms", d: "Credit, refunds and cancellation in writing." },
  { href: "/media-buyers", t: "For media buyers", d: "How Birch fits next to programmatic, paid social and retail media." },
];

/** Why an agency would use Birch. Tight, no counts, no share splits. */
const AGENCY_BENEFITS = [
  { t: "Win wallet share", d: "A new distribution channel your clients can shift spend to." },
  { t: "High-margin placements", d: "Priced under market." },
  { t: "Dedicated placements", d: "Competitors can't tap it, so you can win new clients." },
  { t: "Trusted Birch referral partner", d: "Customer flow both ways." },
  { t: "High-value customers", d: "For your clients, at below-market CAC." },
] as const;

/** One expandable detail row. Native <details>, so it works without JS; opens itself when the URL hash names it. */
function Fold({ id, title, sub, children }: { id: string; title: string; sub: string; children: ReactNode }) {
  return (
    <details id={id} className="group scroll-mt-24 border-b border-[#0b1f3a]/15" data-testid={`fold-${id}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-display text-xl leading-tight text-[#0b1f3a] md:text-2xl">{title}</span>
          <span className="mt-0.5 block text-[13px] text-foreground/60">{sub}</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-[#0b1f3a] transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-8 pt-2">{children}</div>
    </details>
  );
}

export default function BrAgencies() {
  usePageMeta(
    "For agencies & brokers | Birch Reserve",
    "Published rate card. Agencies earn the standard 15% agency commission off the gross rate card, with committed-spend tiers on top. Agencies set their own resale price and handle their own client disclosure. We do not undercut agency clients.",
  );
  // Deep links (/agencies#plain-terms) open the fold they name before the layout scrolls to it.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (el instanceof HTMLDetailsElement) el.open = true;
  }, []);
  const forwardUrl = isScaleSkin() ? "scalehealth.ca/intake/_m/agencies#plain-terms" : "birchreserve.net/agencies#plain-terms";
  return (
    <div data-testid="br-agencies">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Service", name: "Birch Reserve agency placements", provider: { "@type": "Organization", name: "Birch Reserve" }, areaServed: ["CA", "US"], serviceType: "Retail media / post-purchase advertising", url: "https://birchreserve.net/agencies" }} />
      <Section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_60%)]">
        <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="max-w-3xl">
            <Eyebrow>For agencies &amp; media buyers</Eyebrow>
            <H1>Reach health and wellness customers right after they buy.</H1>
            <Lede>
              Display in post-purchase moments and inside health and wellness member hubs: the post-purchase page, the hub home, product and booking pages, and the member dashboard. First-party, brand-safe, tracked on your UTMs. Agencies earn the standard 15% commission off a public rate card. We do not undercut an agency&apos;s client.
            </Lede>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Cta href="#talk" testId="agency-cta-io">Book a starter block</Cta>
              <a href="#model" className="text-sm font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="agency-cta-model">See the rate card</a>
              <a href={RESERVE_HREF} className="text-sm text-[#0b1f3a]/70 underline underline-offset-4" data-testid="agency-cta-reserve">Or a category placement · $490 USD</a>
            </div>
          </div>
          <ul className="border-t border-[#0b1f3a]/15 lg:mt-2" data-testid="agency-benefits" aria-label={skinText("Why agencies use Birch")}>
            {AGENCY_BENEFITS.map((b) => (
              <li key={b.t} className="border-b border-[#0b1f3a]/15 py-4">
                <p className="font-display text-xl leading-tight text-[#0b1f3a]">{skinText(b.t)}</p>
                <p className="mt-1 text-[13px] leading-snug text-foreground/60">{b.d}</p>
              </li>
            ))}
          </ul>
        </div>
        <dl className="mt-12 grid gap-px border border-[#0b1f3a]/15 bg-[#0b1f3a]/15 sm:grid-cols-2 lg:grid-cols-4" data-testid="agency-proof">
          {[
            { k: "Where ads run", d: "Post-purchase, hub home, product and booking pages, member dashboard." },
            { k: "Live hubs", d: INVENTORY.line },
            { k: "Measurement", d: "Your UTM links and promo codes. Views and clicks per hub and surface, aggregate only." },
            { k: "Brand safety", d: "Post-purchase pages and member hubs. No open web. Nothing runs before you approve the IO." },
          ].map((p) => (
            <div key={p.k} className="bg-background p-5">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/55">{p.k}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-foreground/80">{p.d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="see-it">
        <div className="max-w-3xl">
          <Eyebrow>Sample placement</Eyebrow>
          <H2>See a client&apos;s ad on a live hub.</H2>
          <p className="mt-3 text-sm text-muted-foreground">Type the client&apos;s brand or drop in a logo. Illustrative mock on a real hub page; nothing is uploaded.</p>
        </div>
        <div className="mt-8">
          <SeeYourAd testId="agency-see-your-ad" />
        </div>
      </Section>

      <Section tone="soft" id="model">
        <div className="max-w-3xl">
          <Eyebrow>How buying works</Eyebrow>
          <H2>One rate card. The standard 15% for&nbsp;agencies.</H2>
          <p className="mt-3 text-sm text-muted-foreground">One inventory. Direct buyers, agencies and partners each draw from the same tank.</p>
        </div>
        <div className="mt-8">
          <InventoryCanister />
        </div>
        <div className="mt-8 space-y-6">
          <AgencyRateCardModel />
          <ExclusivePerks />
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Nothing runs until the insertion order names the hub, placement and flight dates. Full terms on <a className="underline underline-offset-2" href="/terms">/terms</a>.</p>
      </Section>

      <Section id="blocks" className="scroll-mt-24">
        <div className="max-w-3xl">
          <Eyebrow>Committing inventory blocks</Eyebrow>
          <H2>Start with one client. Scale to upfront blocks.</H2>
          <p className="mt-3 text-sm text-muted-foreground">A small first commitment that proves the placement, then larger blocks booked ahead at a better tier. Fixed flight dates, a standard cancellation window and makegoods on every block.</p>
        </div>
        <div className="mt-8">
          <BlockLadder />
        </div>
      </Section>

      <Section id="details">
        <Eyebrow>The details</Eyebrow>
        <H2>Everything a client will ask. Folded.</H2>
        <div className="mt-6 border-t border-[#0b1f3a]/15">
          <Fold id="two-ways-to-buy" title="Card or insertion order" sub="Self-serve from $190 USD, or a managed $1K–$5K USD client test">
            <BuyPaths reserveHref={RESERVE_HREF} lookHref={lookHref("agencies_paths_look")} />
          </Fold>
          <Fold id="payouts" title="The 15% commission, worked out" sub="An illustrative $10,000 USD example off the gross rate card">
            <AgencyDiscountExample />
          </Fold>
          <Fold id="spec-sheet" title="Spec sheet" sub="Four placements, public starting rates">
            <InventorySpec />
          </Fold>
          <Fold id="brief-to-live" title="From brief to live" sub="Six steps. Nothing runs before the IO.">
            <IoProcess />
          </Fold>
          <Fold id="plain-terms" title="In plain terms" sub="Five answers to forward to a client">
            <p className="mb-4 text-sm text-muted-foreground">
              {skinText("What Birch Reserve is, the moment it reaches, where the figures come from, what gets reported and how a test starts. Forward as is:")}{" "}
              <a href="/agencies#plain-terms" className="break-all underline underline-offset-2" data-testid="plain-terms-link">{forwardUrl}</a>
            </p>
            <PlainTerms />
          </Fold>
          <Fold id="plan-by-goal" title="Plan by goal" sub="Match a client brief to the placement that fits">
            <GoalPlanner />
            <p className="mt-4 text-sm text-muted-foreground" data-testid="agency-media-buyers-link">
              Client already runs display, retargeting or paid social? <a className="underline underline-offset-2" href="/media-buyers#display-mix">{skinText("See how Birch sits next to that mix")}</a>.
            </p>
          </Fold>
          <Fold id="forward-kit" title="Forward-ready kit" sub="Media kit, sample IO, audiences, terms">
            <ul className="divide-y divide-border border-y border-border" data-testid="agency-forward-kit">
              {FORWARD_KIT.map((f) => (
                <li key={f.href}>
                  <a href={f.href} className="flex flex-col gap-1 py-4 hover:underline sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <span className="font-display text-xl">{f.t}</span>
                    <span className="text-sm text-muted-foreground sm:text-right">{skinText(f.d)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Fold>
        </div>
      </Section>

      <Section tone="soft" id="talk" className="scroll-mt-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <H2>Book a starter block for a client.</H2>
            <p className="mt-4 text-sm text-muted-foreground">Starter blocks, upfront blocks and partner access all come here. We reply in writing within one business day with hub fit, flight dates and a draft insertion order.</p>
          </div>
          <LeadForm
            kind="agency_inquiry"
            testId="form-agency"
            submitLabel="Send"
            done={<p>Thanks. We&apos;ll reply in writing with hub fit and a draft insertion order.</p>}
            fields={[
              { name: "email", label: "Work email", type: "email", required: true },
              { name: "company", label: "Agency", required: true },
              { name: "test_budget", label: "What are you after?", type: "select", options: ["Starter block ($1K–$5K USD)", "Upfront block ($25,000–$1.5M USD)", "Partner access", "Not sure yet"] },
            ]}
          />
        </div>
      </Section>
      <Section>
        {/* FAQPage JSON-LD for /agencies is emitted once, server-side (seo.ts), with the plain-terms answers. */}
        <Faq items={AGENCY_FAQ.map((f) => ({ q: skinText(f.q), a: skinText(f.a) }))} schema={false} />
      </Section>
      {/* The free-kit strip stays on every buyer page, moved to the end so the hero keeps one CTA. */}
      <KitEntry from="agencies" />
    </div>
  );
}
