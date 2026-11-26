import { Check } from "lucide-react";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { MediaKitPdfLink } from "@/components/br/trust";
import { LOOK_HREF, RESERVE_HREF, lookHref} from "@/components/br/pricing";
import { AvailabilityStrip, NETWORK_HUBS, priceLabels, useAvailability } from "@/components/br/prime-hero";
import { buyersOffersJsonLd } from "../../../../api-server/src/lib/overhaul/seo";

/**
 * /buyers (and legacy /ai-buyers): for human media buyers and agencies first
 * (Randy, Nov 17 2026). Same offer as the media kit: a $190 USD 7-day look or a
 * $490 USD category reserve, paid on a Stripe-hosted page. USD only.
 * Agent/API material is a small secondary section at the bottom.
 */

const PLACEMENTS = [
  { t: "Post-purchase", d: "The thank-you page right after an order or booking. Highest intent." },
  { t: "Member dashboard", d: "The logged-in home where members track orders and plans." },
  { t: "Hub home", d: "Banner and tiles on the co-branded hub home page." },
  { t: "Product & services pages", d: "Inside product, service and booking pages." },
  { t: "In-hub screens", d: "Screens inside partner locations. Rolling out. Reserve by inquiry." },
];

const AGENT_LINKS: Array<[string, string, string]> = [
  ["llms.txt", "/llms.txt", "Plain-text map of the site and the two offers"],
  ["Agent catalog", "/v1/agent/catalog.json", "Placements, live hubs and the two offers, in USD"],
  ["OpenAPI spec", "/v1/agent/openapi.json", "OpenAPI 3.1 for the catalog and quote endpoints"],
  ["Agent card", "/.well-known/agent.json", "Skills, endpoints and auth (none needed to read)"],
];

export default function BrAiBuyers() {
  usePageMeta(
    "For media buyers & agencies | Birch Reserve",
    "Display space inside private health and wellness hubs. A $190 USD 7-day category look or a $490 USD category reserve, paid by card on a Stripe-hosted page. Live today: DR-HO'S physio, SOLE, Integrity Fitness and Calm Joints.",
  );
  const price = priceLabels(useAvailability());
  const hubs = NETWORK_HUBS.join(" and ");
  return (
    <div data-testid="br-buyers">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": buyersOffersJsonLd() }} />

      {/* Hero */}
      <Section>
        <Eyebrow>For media buyers &amp; agencies</Eyebrow>
        <H1>Put your brand where people are already buying care.</H1>
        <Lede>
          Birch Reserve sells display space inside private health and wellness hubs: the pages members use right after they buy or book, and when they log back in. Live today: {hubs}, with more hubs launching. Start self-serve for {price.look} or {price.seat}, priced in USD.
        </Lede>
        <div className="mt-6">
          <AvailabilityStrip />
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Cta href="/media-kit" variant="lime" testId="buyers-media-kit" className="w-full sm:w-auto">See the media kit</Cta>
          <Cta href="/match" variant="ink" testId="buyers-match" className="w-full sm:w-auto">Match your audience</Cta>
          <MediaKitPdfLink variant="line" testId="buyers-pdf" className="w-full sm:w-auto" />
        </div>
      </Section>

      {/* Offer */}
      <Section tone="soft" id="offer">
        <Eyebrow>The offer</Eyebrow>
        <H2>Two ways to start. Both USD, both self-serve.</H2>
        <div className="mt-8 grid gap-4 md:grid-cols-2" data-testid="buyers-offers">
          <article className="flex flex-col border border-foreground/20 bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">7-day category look</p>
            <p className="mt-2 font-display text-5xl leading-none">{price.look}</p>
            <p className="mt-4 text-sm text-foreground/80">Hold your category for 7 days. It converts in full to the {price.seat} reserve within 7 days, or it's refunded. It does not lock in a slot.</p>
            <div className="mt-6 sm:mt-auto sm:pt-6">
              <Cta href={lookHref("ai_buyers_look")} variant="ink" testId="buyers-look" className="w-full sm:w-auto">Take a 7-day look — {price.look}</Cta>
            </div>
          </article>
          <article className="flex flex-col border-2 border-foreground bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Category reserve</p>
            <p className="mt-2 font-display text-5xl leading-none">{price.seat}</p>
            <p className="mt-4 text-sm text-foreground/80">Reserve your space across the hub network. Your payment is media credit, fully refundable until 14 days before your launch date and usable for 12 months.</p>
            <div className="mt-6 sm:mt-auto sm:pt-6">
              <Cta href={RESERVE_HREF} variant="lime" testId="buyers-reserve" className="w-full sm:w-auto">Reserve your space — {price.seat}</Cta>
            </div>
          </article>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Pay by card on a Stripe-hosted page, no login. Nothing runs until you approve an insertion order naming the hub and placement. Premium slots are inquire-only; see the <a className="underline underline-offset-2" href="/media-kit#premium">media kit</a>.</p>
      </Section>

      {/* Where it shows */}
      <Section>
        <Eyebrow>Where your ad shows</Eyebrow>
        <H2>Four placements in every hub.</H2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="buyers-placements">
          {PLACEMENTS.map((p) => (
            <li key={p.t} className="border border-foreground/15 bg-white p-5">
              <p className="font-display text-xl">{p.t}</p>
              <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">See the live hubs on the <a className="underline underline-offset-2" href="/hubs">hubs page</a>.</p>
      </Section>

      {/* Match + agencies */}
      <Section tone="soft">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Check the fit first</Eyebrow>
            <H2>Match your audience.</H2>
            <p className="mt-4 text-foreground/80">Enter your website and a short note about your customer. You get a match score with three reasons, so you know whether the hubs fit before you spend.</p>
            <div className="mt-6"><Cta href="/match" variant="ink" testId="buyers-match-2" className="w-full sm:w-auto">Match your audience</Cta></div>
          </div>
          <div>
            <Eyebrow>Agencies</Eyebrow>
            <H2>Place a client at the standard 15% agency commission.</H2>
            <ul className="mt-4 space-y-2 text-sm">
              {["Agencies earn the standard 15% agency commission off the gross rate card.", "Aggregate UTM reporting only. No personal data is shared.", "Modelled volumes, labelled as estimates. No impression guarantees."].map((r) => (
                <li key={r} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{r}</span></li>
              ))}
            </ul>
            <div className="mt-6"><Cta href="/agencies" variant="line" testId="buyers-agencies" className="w-full sm:w-auto">Agency details</Cta></div>
          </div>
        </div>
      </Section>

      <Section>
        <Faq
          items={[
            { q: "What currency do you charge in?", a: "USD for every buyer, including Canadian brands: $190 USD for the 7-day look and $490 USD for the category reserve." },
            { q: "Which hubs are live?", a: `${hubs}. More hubs launch over time, and placements are curated as each one goes live.` },
            { q: "Are the view numbers real?", a: "Volumes in the media kit are modelled estimates, labelled as such. There are no impression, reach, click or sales guarantees." },
            { q: "What happens after I pay?", a: "Your payment is media credit. We send an insertion order naming the hub and placement, and nothing runs until you approve it." },
          ]}
        />
      </Section>

      {/* Secondary: AI agents */}
      <Section tone="soft" id="ai-agents">
        <div className="max-w-3xl" data-testid="buyers-ai-agents">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">For AI agents</p>
          <p className="mt-2 text-sm text-foreground/80">
            Buying agents can read the same two offers ($190 USD look, $490 USD reserve) and the live hubs in machine-readable form. Agent checkout is on hold: a request sent to the checkout endpoint is recorded and answered by email, with no charge. To pay, send the buyer to the media kit and the Stripe-hosted page.
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {AGENT_LINKS.map(([label, href, d]) => (
              <li key={href}><a className="underline underline-offset-2" href={href}>{label}</a> <span className="text-muted-foreground">— {d}</span></li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}
