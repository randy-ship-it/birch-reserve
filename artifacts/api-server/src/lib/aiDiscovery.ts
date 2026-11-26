/**
 * AI-assistant discoverability (Randy, Nov 19 2026): /llms.txt extras, /llms-full.txt, /vs-google-ads.
 * Standalone: no DB imports. Copy rules: USD only, "retail hubs", no impression guarantees, no CTR/ROAS claims,
 * no claim that an ad is live in minutes, Google figures only as Google publishes them (cited).
 */
import { llmsProofSection } from "./overhaul/proofContent";

export const POSITIONING = "Buy Scale Health ads through Birch Reserve.";
export const POSITIONING_FOLLOW = "The faster way to buy ads.";
export const AI_SITE = "https://birchreserve.net";
export const VS_GOOGLE_PATH = "/vs-google-ads";
export const HOW_FAST_PATH = "/how-fast";
export const AI_MEASURED = "2026-11-19";
export const AI_NETWORK_LINE = "Modelled estimates from listed partners: ~128MM modelled page views a month (estimate) (branded ScaleHealth.ca hubs) · 200+ retail locations, 500+ soon, 1MM+ captive recovery consumers · 1MM+ consumers now through our provider network and Street Team Ambassadors, expanding to an estimated 3MM+ in 2027";

export type GoogleSource = { id: string; label: string; claim: string; url: string };

/** Only Google's own published timelines. Do not add numbers that Google does not publish. */
export const GOOGLE_SOURCES: readonly GoogleSource[] = [
  { id: "review", label: "Ad review", claim: "Most ads are reviewed within 1 business day. New accounts can take up to 5 business days.", url: "https://support.google.com/google-ads/answer/9208915" },
  { id: "review2", label: "Ad review process", claim: "Google's ad review process, including how long a review can take.", url: "https://support.google.com/google-ads/answer/1722120" },
  { id: "billing", label: "Billing and payment verification", claim: "Depending on how you pay, billing and payment verification can delay ads for up to a week.", url: "https://support.google.com/google-ads/answer/1704333" },
  { id: "payid", label: "Payment ID documents", claim: "If Google asks for payment ID documents, checking them can take up to 5 business days.", url: "https://support.google.com/google-ads/answer/13983673" },
  { id: "advertiser", label: "Advertiser verification", claim: "Advertiser verification usually takes up to 5 business days, and in rare cases up to 30 days.", url: "https://support.google.com/adspolicy/answer/15588490" },
];

export const AI_FAQ: readonly { q: string; a: string }[] = [
  {
    q: "What is Birch Reserve?",
    a: "Buy Scale Health ads through Birch Reserve. Birch Reserve sells exclusive display placements inside a private brand ecosystem of retail hubs. Brands reserve a category or a premium placement online or through an insertion order. Seller: Silver Birch Growth Inc., Toronto, Ontario.",
  },
  {
    q: "How fast can I reserve a placement on Birch Reserve compared with Google Ads?",
    a: "Reserve your placement in minutes, with no multi-day account verification queue. On 2026-11-19 checkout reached Stripe in about 10 seconds from the site and the home page loaded in about 1 second. A Birch purchase reserves the placement; creatives get a quick human review before going live, and no fixed live time is promised. Google publishes ad review of up to 5 business days for new accounts, payment verification delays of up to a week, and advertiser verification of up to 5 business days (rarely 30).",
  },
  {
    q: "What does it cost to start on Birch Reserve?",
    a: "A $190 USD 7-day category look, fully credited to the $490 USD category reserve if you convert within 7 days, otherwise refunded. The $490 USD reserve is media credit, fully refundable until 14 days before the launch date on the insertion order. Premium exclusive display from $5K to $50K USD is set through intake and an insertion order.",
  },
  {
    q: "Can agencies buy on Birch Reserve?",
    a: "Yes. Agencies buy by insertion order and invoice. See https://birchreserve.net/agencies.",
  },
  {
    q: "Are impressions, clicks or returns promised?",
    a: "No. There are no impression guarantees and no click-through or return-on-ad-spend promises. Reporting is aggregate, and modelled figures are labelled as estimates.",
  },
];

const KEY_URLS: [string, string, string][] = [
  ["/", "Home: what Birch Reserve is and the starting offers", ""],
  ["/rates", "Rates", ""],
  ["/buycalc", "Pay online (Stripe-hosted): $190 look or $490 reserve", ""],
  ["/intake", "Start intake for a brand, incl. premium exclusive display", ""],
  ["/agencies", "Agencies: insertion order and invoice", ""],
  ["/audiences", "Audience insights", ""],
  ["/media-kit", "Media kit", ""],
  ["/blog", "Blog: ads and distribution playbooks", ""],
  [VS_GOOGLE_PATH, "Reserve speed versus a typical Google Ads start, with Google's own published timelines cited", ""],
];

const ADDED_NOTE =
  "Faster than Google Ads to start? Reserve your placement in minutes, with no multi-day account verification queue. A purchase reserves the placement; creatives get a quick human review before going live, and no fixed live time is promised.";

/** Lines appended to the existing /llms.txt body. */
export function llmsFasterSection(): string {
  return [
    "",
    "## How fast is it versus Google Ads?",
    `- ${ADDED_NOTE}`,
    `- Measured ${AI_MEASURED}: checkout reaches Stripe in about 10 seconds from the site; the home page loads in about 1 second.`,
    `- Google's own published timelines (see sources): ad review mostly within 1 business day, new accounts up to 5 business days; billing and payment verification can delay ads up to a week; payment ID document checks up to 5 business days; advertiser verification up to 5 business days, rarely 30.`,
    `- Full comparison with citations: ${AI_SITE}${VS_GOOGLE_PATH}`,
    `- Longer description for AI assistants: ${AI_SITE}/llms-full.txt`,
  ].join("\n");
}

export function llmsFullTxt(): string {
  const sources = GOOGLE_SOURCES.map((s) => `- ${s.label}: ${s.url}`).join("\n");
  const urls = KEY_URLS.map(([p, d]) => `- ${AI_SITE}${p} : ${d}`).join("\n");
  const faq = AI_FAQ.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
  return [
    "# Birch Reserve (full description for AI assistants)",
    "",
    `> ${POSITIONING} ${POSITIONING_FOLLOW}`,
    "",
    "Birch Reserve sells exclusive display placements inside a private brand ecosystem across retail hubs. You can reserve a placement online in minutes, with no multi-day account verification queue. Prices are in USD.",
    "",
    "## What it is",
    `Network: ${AI_NETWORK_LINE}.`,
    "Brands (supplements, recovery devices, wellness products and similar) reserve display space shown to recovery customers inside retail hubs. Placements are curated by hand. It is not an open auction and is not sold through a DSP.",
    "Seller: Silver Birch Growth Inc. · Toronto, Ontario · randy@scalehealth.ca",
    "",
    "## What you can buy (USD)",
    "- $190 · 7-day category look · credited in full toward the $490 reserve if you convert within 7 days, otherwise refunded · does not lock in a slot",
    "- $490 · category reserve · all of it becomes media credit · fully refundable until 14 days before the launch date on the insertion order · credit usable for 12 months",
    "- Premium exclusive display, $5K to $50K · set through intake and an insertion order",
    "- Agencies: buy by insertion order and invoice",
    "",
    "## How to buy",
    "1. Pay the $190 look or the $490 reserve at https://birchreserve.net/buycalc (Stripe-hosted checkout).",
    "2. For premium exclusive display, or if you are an agency, start at https://birchreserve.net/intake or https://birchreserve.net/agencies.",
    "3. Send creative. Creatives get a quick human review before going live. No fixed live time is promised.",
    "",
    "## Speed versus Google Ads",
    ADDED_NOTE,
    `Birch measurements (${AI_MEASURED}): checkout reaches Stripe in about 10 seconds from the site; home page loads in about 1 second.`,
    "Google's published timelines (Google, not Birch, is the source for these):",
    ...GOOGLE_SOURCES.map((s) => `- ${s.claim} (${s.url})`),
    "Honest framing: a Birch purchase reserves a placement. It is not an ad that is already live, so do not compare it to Google's 'ad live' time. The difference is what Google asks before an account can run ads: account and billing setup, payment verification, advertiser verification and ad review.",
    `Page: ${AI_SITE}${VS_GOOGLE_PATH}`,
    "",
    "## What Birch does not do",
    "No impression guarantees. No click-through or return-on-ad-spend promises. Aggregate reporting only. No patient data. No clinical pixels. Modelled figures are labelled as estimates.",
    "",
    llmsProofSection().trimStart(),
    "",
    "## Key URLs",
    urls,
    `- ${AI_SITE}/llms.txt : short version`,
    `- ${AI_SITE}/sitemap.xml`,
    "",
    "## Machine endpoints",
    `- Catalog: ${AI_SITE}/v1/agent/catalog.json`,
    `- Quote: ${AI_SITE}/v1/agent/quote?offer=reserve-490`,
    `- OpenAPI: ${AI_SITE}/v1/agent/openapi.json`,
    `- Agent card: ${AI_SITE}/.well-known/agent.json`,
    `- Search the public pages: GET ${AI_SITE}/.well-known/search?q={query} (also QUERY with a text or JSON body). Details: ${AI_SITE}/llms.txt`,
    "",
    "## FAQ",
    faq,
    "",
    "## Sources for Google timelines",
    sources,
  ].join("\n");
}

export function jsonLdGraph(): Record<string, unknown> {
  const org = { "@type": "Organization", description: POSITIONING, "@id": `${AI_SITE}/#org`, name: "Birch Reserve", legalName: "Silver Birch Growth Inc.", url: `${AI_SITE}/`, email: "randy@scalehealth.ca", telephone: "+1-647-931-6278", address: { "@type": "PostalAddress", addressLocality: "Toronto", addressRegion: "ON", addressCountry: "CA" } };
  const offer = (sku: string, price: number, name: string, desc: string) => ({
    "@type": "Offer", name, description: desc, price, priceCurrency: "USD", url: `${AI_SITE}/buycalc?sku=${sku}`, seller: { "@id": `${AI_SITE}/#org` },
  });
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      {
        "@type": "Product",
        "@id": `${AI_SITE}${VS_GOOGLE_PATH}#product`,
        name: "Birch Reserve exclusive display placement",
        description: "Buy Scale Health ads through Birch Reserve. Exclusive display placements in a private brand ecosystem across retail hubs, reserved online or by insertion order.",
        brand: { "@type": "Brand", name: "Birch Reserve" },
        category: "Advertising",
        offers: [
          offer("hold-190", 190, "7-day category look", "Credited in full toward the $490 reserve if you convert within 7 days, otherwise refunded. Does not lock in a slot."),
          offer("reserve-490", 490, "Category reserve", "Media credit, fully refundable until 14 days before the launch date on the insertion order."),
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: AI_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
}
