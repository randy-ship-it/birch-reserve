import { useEffect, useState } from "react";
import { Bot, Braces, CreditCard, Search, Sparkles } from "lucide-react";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Modelled, Section, usePageMeta } from "@/components/br/ui";
import { slotOffers, areaLockOffer } from "../../../../api-server/src/lib/overhaul/agent";
import { areaLockProductJsonLd, slotProductsJsonLd } from "../../../../api-server/src/lib/overhaul/seo";

const STEPS = [
  { icon: Search, title: "Read the catalog", code: "GET /v1/agent/catalog.json", body: "Surfaces, starting-at CPMs, live hubs, every offer with prices in USD and CAD." },
  { icon: Sparkles, title: "Check fit", code: "POST /v1/match", body: "Send the brand's URL and a short note. Get a modelled match %, three reasons and the offer we'd recommend." },
  { icon: Braces, title: "Quote", code: "GET /v1/agent/quote?offer=sponsor-3000", body: "Exact price, media credit, bonus and modelled views. Area locks quote by postal code or ZIP and term." },
  { icon: CreditCard, title: "Check out", code: "POST /v1/agent/checkout", body: "Returns a Stripe-hosted checkout_url for the buyer, or status held: reserved by inquiry, no charge, confirmed within 1 business day." },
];

const ENDPOINTS: Array<[string, string]> = [
  ["/llms.txt", "Plain-text map of the site, offers and endpoints"],
  ["/v1/agent/catalog.json", "Inventory, surfaces, offers, modelled views, checkout status"],
  ["/v1/agent/quote", "Quote one offer (slot-490, sponsor-1500, sponsor-3000, sponsor-6000, area-lock)"],
  ["/v1/agent/checkout", "Stripe-hosted checkout handoff, or held (reserve by inquiry)"],
  ["/v1/agent/openapi.json", "OpenAPI 3.1 spec for the agent endpoints"],
  ["/.well-known/agent.json", "Agent card: skills, endpoints, auth"],
  ["/.well-known/ucp", "Universal Commerce Protocol discovery"],
  ["/v1/match", "Modelled audience match for a URL + blurb"],
];

const EXAMPLE = `curl -s https://birchreserve.net/v1/agent/quote?offer=sponsor-3000&currency=usd

curl -s -X POST https://birchreserve.net/v1/agent/checkout \\
  -H 'content-type: application/json' \\
  -d '{"offer":"sponsor-3000","currency":"usd","brand":"Acme Recovery",
       "email":"buyer@acme.com","agent":"your-agent-name","agree":true}'`;

export default function BrAiBuyers() {
  usePageMeta("For AI buying agents | Birch Reserve", "Machine catalog, quotes and Stripe-hosted checkout for AI ad-buying agents. Display and CPC inside co-branded health & wellness hubs.");
  const [quote, setQuote] = useState<string>("");
  useEffect(() => {
    fetch("/v1/agent/quote?offer=sponsor-3000&currency=usd")
      .then((r) => r.json())
      .then((j) => setQuote(JSON.stringify(j, null, 2)))
      .catch(() => setQuote(""));
  }, []);
  const offers = slotOffers();
  const area = areaLockOffer();
  return (
    <div data-testid="br-ai-buyers">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [...slotProductsJsonLd(), areaLockProductJsonLd()] }} />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>For AI buying agents</Eyebrow>
            <H1>Point your AI buyer here. It can read, quote and check out.</H1>
            <Lede>
              Brands using AI to buy media can send their agent straight to Birch Reserve. Every slot, price and modelled view count is machine-readable, quotes are exact, and checkout hands the buyer a Stripe-hosted page. No forms, no sales call needed to get a number.
            </Lede>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="/v1/agent/catalog.json" testId="ai-catalog">Open the catalog</Cta>
              <Cta href="/llms.txt" variant="ink">llms.txt</Cta>
              <Cta href="/v1/agent/openapi.json" variant="line">OpenAPI</Cta>
            </div>
          </div>
          <div className="border border-foreground/15 bg-foreground p-5 text-background">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-background/60">
              <Bot className="size-4" /> Live quote from this site
            </div>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-accent" data-testid="ai-live-quote">{quote || "Loading /v1/agent/quote …"}</pre>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <Eyebrow>Four calls</Eyebrow>
        <H2>Catalog, fit, quote, checkout.</H2>
        <div className="mt-8 grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="bg-background p-6">
              <s.icon className="size-5" />
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Step {i + 1}</p>
              <p className="mt-1 font-display text-2xl">{s.title}</p>
              <code className="mt-2 block break-all bg-secondary px-2 py-1 font-mono text-xs">{s.code}</code>
              <p className="mt-3 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Offer keys</Eyebrow>
            <H2>What an agent can buy.</H2>
            <div className="mt-6 overflow-x-auto border border-foreground/15 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left">
                  <tr><th className="p-3">offer</th><th className="p-3 text-right">USD</th><th className="p-3 text-right">CAD</th><th className="p-3 text-right">Views <Modelled /></th></tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o.offer_key} className="border-t border-foreground/10">
                      <td className="p-3 font-mono text-xs">{o.offer_key}{o.bonus_credit_pct ? <span className="ml-2 font-sans text-muted-foreground">+{o.bonus_credit_pct}% credit</span> : null}</td>
                      <td className="p-3 text-right">${o.prices.usd.toLocaleString()}</td>
                      <td className="p-3 text-right">${o.prices.cad.toLocaleString()}</td>
                      <td className="p-3 text-right">~{o.modelled_hub_page_views.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-foreground/10">
                    <td className="p-3 font-mono text-xs">area-lock<span className="ml-2 font-sans text-muted-foreground">{area.radius_km} km, 1-6 mo</span></td>
                    <td className="p-3 text-right">${area.prices.usd.toLocaleString()}</td>
                    <td className="p-3 text-right">${area.prices.cad.toLocaleString()}</td>
                    <td className="p-3 text-right">{area.guaranteed_hub_page_views_modelled.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Spend-commit and area-lock views are what the credit buys at the blended starter rate card: modelled illustrative estimates, not guarantees.</p>
          </div>
          <div>
            <Eyebrow>Endpoints</Eyebrow>
            <H2>Everything is public.</H2>
            <ul className="mt-6 divide-y divide-foreground/10 border border-foreground/15 bg-white text-sm">
              {ENDPOINTS.map(([p, d]) => (
                <li key={p} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:justify-between">
                  <a className="font-mono text-xs underline underline-offset-2" href={p}>{p}</a>
                  <span className="text-muted-foreground sm:text-right">{d}</span>
                </li>
              ))}
            </ul>
            <pre className="mt-6 overflow-x-auto bg-foreground p-4 font-mono text-[11px] leading-relaxed text-background">{EXAMPLE}</pre>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <Faq
          items={[
            { q: "Does an agent need an API key?", a: "No. Catalog, quote and match are public. Checkout returns a Stripe-hosted page for the human buyer to pay; we never take delegated card details from an agent." },
            { q: "What does status held mean?", a: "Online payment isn't open for that offer yet. The request is reserved by inquiry with the offer, price and buyer email. No charge is made, and we confirm within 1 business day." },
            { q: "Are the view numbers real?", a: "They are modelled from the Scale Health TAM feed and labelled modelled everywhere. Hubs are listed partners; each buy runs under an insertion order that names the hubs." },
            { q: "What must an agent show the buyer?", a: "The terms and the price before sending agree:true. Payment is media credit drawn down under an insertion order that names the hubs." },
          ]}
        />
      </Section>
    </div>
  );
}
