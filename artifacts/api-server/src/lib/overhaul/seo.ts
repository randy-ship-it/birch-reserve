import { BUYER_PAGES } from "../buyerAnswers";
import { searchDiscoverySection, whenToUseSection } from "../agentSearchMeta";
import { GTM_SETUP_FACT, GTM_SETUP_URL } from "./gtmSetup";
import { PERF_ONLY_FACT, PERF_ONLY_URL } from "./performanceOnly";
import { GTM_BOT_FACT } from "./gtmBot";
import { STREET_TEAM_LLMS } from "./streetTeam";
import { POSITIONING, POSITIONING_FOLLOW, llmsFasterSection } from "../aiDiscovery";
import { llmsProofSection } from "./proofContent";
import { PACING_ROWS, SPEND_DOWN_LINE, tam2027Text } from "../inventoryPlan";
/** Per-route head + llms.txt for the overhaul routes (crawlable without JS). */
import { slotOffers, areaLockOffer } from "./agent";
import { AGENCY_FAQ, PLAIN_TERMS, faqPageJsonLd } from "./agencyShowcase";
import { MEDIA_BUYER_FAQ } from "./mediaBuyers";
import { AGENCY, AREA_LOCK, BRAND_HUBS, INVENTORY, PLACEMENT_LABELS, PUBLISHER_INCENTIVE, SLOT_LADDER, TAM, areaLockGuaranteedViews } from "./model";
import { ladderLine, liveLine, activatingLine, ladderMarkdown, MORE_LAUNCHING } from "../hubLadder";

export const OVERHAUL_OG_IMAGE = "https://birchreserve.net/og-birch-reserve-hubs.png";

export type RouteMeta = { title: string; description: string; jsonld?: Record<string, unknown>; /** Per-route share image; defaults to OVERHAUL_OG_IMAGE. */ image?: string };

export const MEDIA_KIT_OG_IMAGE = "https://birchreserve.net/og-media-kit-usd.png";

const ORG = { "@type": "Organization", name: "Birch Reserve", url: "https://birchreserve.net/" };

/** Share image for the intake (Nov 19 2026): 1200×630, on brand, no CRM or partner names. */
export const INTAKE_OG_IMAGE = "https://birchreserve.net/og-monetization-kit.png";
const INTAKE_DESC = "One short form for suppliers and hubs. See what your hub could earn and where your products get seen, side by side. Estimates in USD, reviewed by a person.";

export const OVERHAUL_ROUTES: Record<string, RouteMeta> = {
  "/intake": { title: "Get your free Monetization Kit | Birch Reserve", description: INTAKE_DESC, image: INTAKE_OG_IMAGE },
  "/intake/publisher": { title: "Hub · max exposure + earnings · Monetization Kit | Birch Reserve", description: INTAKE_DESC, image: INTAKE_OG_IMAGE },
  "/intake/supplier": { title: "Supplier intake · Your own hub | Birch Reserve", description: "Suppliers: get your own hub on Birch Reserve. No setup fee, no monthly fee, you approve every placement. Goes live once our team approves it.", image: INTAKE_OG_IMAGE },
  "/intake/gtm": { title: "B2B go-to-market | Silver Birch Growth Inc.", description: "B2B go-to-market, powered by Silver Birch Growth Inc. Rare strategic projects only; pointed at portfolio value creation right now.", image: INTAKE_OG_IMAGE },
  "/gtm-bot": { title: "B2B go-to-market | Silver Birch Growth Inc.", description: "B2B go-to-market, powered by Silver Birch Growth Inc. SBG takes on only rare strategic projects and is pointed at portfolio value creation right now.", image: INTAKE_OG_IMAGE },
  "/intake/activate": { title: "Get your ads turned on | Birch Reserve", description: "Share a rough inventory estimate and which ads can run on your hubs. Every ad is reviewed and nothing runs without approval.", image: INTAKE_OG_IMAGE },
  "/intake/street-team": { title: "Street team program inquiry (2027) | Birch Reserve", description: "Tell us your brand, tier and routes for the 2027 street team program. A minimum campaign size applies. Reviewed by a person; nothing is charged.", image: INTAKE_OG_IMAGE },
  "/partners": { title: "Partner with Birch Reserve | Service vendors and inventory partners", description: "Service vendors for ad buying, creative and distribution, and agencies, media houses and newspapers who want to offer our display inventory to their customers. Wholesale terms discussed directly.", image: INTAKE_OG_IMAGE },
  "/street-team": { title: "Street team program, coming 2027 | Birch Reserve", description: "Door-to-door by route: join a running campaign, run your own on specific routes, or door drop. The high-touch version runs today for Calm Joints only. Outside brands from 2027; minimum campaign size applies.", image: INTAKE_OG_IMAGE },
  "/intake/reel": { title: "Watch: how the Scale Health ad system works | Birch Reserve", description: "A short walkthrough: start performance-only as a supplier, activate your own audience with a co-branded hub, then run targeted ads. Recovery is live, more categories are next.", image: "https://birchreserve.net/reel/og-reel.png" },
  "/intake/sponsor": { title: "Supplier + Accelerate · Monetization Kit | Birch Reserve", description: INTAKE_DESC, image: INTAKE_OG_IMAGE },
  "/advertise/brands": {
    title: "Advertise to brands | Birch Reserve",
    description: "Display space inside private health and wellness hubs. Start with a $190 USD 7-day category look or a $490 USD category placement, self-serve. Modelled estimates from listed partners: about 128MM page views a month (estimate).",
    jsonld: { "@context": "https://schema.org", "@graph": [...buyersOffersJsonLd(), ...buyerDiscoveryJsonLd()] },
  },
  "/advertise/local": {
    title: "Local businesses & studios | Birch Reserve",
    description: "Reach hub members near you. Start with a $190 USD 7-day look or a $490 USD category placement; area placements are premium, by inquiry.",
    jsonld: { "@context": "https://schema.org", "@graph": buyersOffersJsonLd() },
  },
  "/publish/brands": { title: "Publish · Brands | Birch Reserve", description: "Brands with a recovery audience can apply for a co-branded hub. Otherwise, inquire about display or CPC-only opportunities outside hubs." },
  "/publish/studios": { title: "Publish · Studios & retail | Birch Reserve", description: `Activate your hub with pre-built monetizations and our marketplace. Earn $${PUBLISHER_INCENTIVE.cashCad} CAD cash or $${PUBLISHER_INCENTIVE.creditCad}+ CAD in ad credit.` },
  "/match": { title: "Match your audience | Birch Reserve", description: "Enter your website and a short note. See how well your audience matches the Scale Activity launch audience profile, as a clean % with three reasons." },
  "/hubs": { title: "Hubs | Birch Reserve", description: liveLine() + " More hubs are activating. Register your email to see audience, placements and modelled views." },
  "/media-kit": {
    title: "Media kit | Birch Reserve",
    image: MEDIA_KIT_OG_IMAGE,
    description: "Prepaid media credit across a growing network of private health and wellness hubs. Start with the small-business package ($190 USD look or $490 USD category placement, self-serve) or inquire about blocks from $25,000 to $1.5M USD. Modelled volumes, no guarantees.",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Birch Reserve media kit",
      url: "https://birchreserve.net/media-kit",
      publisher: ORG,
      mainEntity: { "@type": "Service", name: "Birch Reserve hub network display space", provider: ORG, areaServed: ["CA", "US"], serviceType: "Prepaid media credit for display placements in private health and wellness hubs" },
    },
  },
  "/buyers": {
    title: "For media buyers & agencies | Birch Reserve",
    description: "Display space inside private health and wellness hubs. A $190 USD 7-day category look or a $490 USD category placement, paid by card on a Stripe-hosted page. " + liveLine(),
    jsonld: { "@context": "https://schema.org", "@graph": [...buyersOffersJsonLd(), ...buyerDiscoveryJsonLd()] },
  },
  "/ai-buyers": {
    title: "For media buyers & agencies | Birch Reserve",
    description: "Display space inside private health and wellness hubs. A $190 USD 7-day category look or a $490 USD category placement, paid by card on a Stripe-hosted page. " + liveLine(),
    jsonld: { "@context": "https://schema.org", "@graph": buyersOffersJsonLd() },
  },
  "/rates": {
    title: "Rates | Birch Reserve",
    description: "Starting-at CPM and CPC rates for five hub surfaces, view-block packs, a 100k to 1B view scenario calculator, and rates that step up only once a placement proves out. Illustrative estimates.",
  },
  "/audiences": {
    title: "Audience insights | Birch Reserve",
    description: "What we know about the audiences behind the brand launches on Scale Health hubs and Calm Joints: recovery, longevity, sleep, physio patients, racquet players and MD-referral cohorts. Measured, modelled and estimated figures, labelled.",
    jsonld: { "@context": "https://schema.org", "@type": "WebPage", name: "Birch Reserve audience insights", url: "https://birchreserve.net/audiences", publisher: ORG },
  },
  "/audiences/sample-profile": {
    title: "Sample partner audience profile | Birch Reserve",
    description: "An illustrative, aggregated sample of the anonymized fields a benefits administrator typically already has. Sample ranges only, not a real book of business.",
  },
  "/agencies": {
    title: "For agencies & brokers | Birch Reserve",
    description: "Agencies, brokers and media resellers: published rate card, the standard 15% agency commission off the gross rate card, you set the resale price and handle client disclosure. Direct buyers pay the rate card. We do not undercut agency clients.",
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Service", name: "Agency test budgets", provider: ORG, areaServed: ["CA", "US"], serviceType: "Retail media / post-purchase advertising" },
        // Nov 18 2026: the one FAQPage for /agencies (plain-terms explainer + agency FAQ), crawlable without JS.
        faqPageJsonLd([...PLAIN_TERMS, ...AGENCY_FAQ]),
      ],
    },
  },
  "/media-buyers": {
    title: "For media buyers & performance marketers | Birch Reserve",
    description: "Already running display, retargeting and paid social? Add one first-party health and wellness channel as its own line item: hand-placed placements inside private hubs, tracked with your UTM links and promo codes. Test from $190 USD.",
    jsonld: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Service",
          name: "Birch Reserve first-party health and wellness display",
          provider: ORG,
          areaServed: ["CA", "US"],
          serviceType: "Retail media / post-purchase and member-hub display advertising",
          audience: { "@type": "BusinessAudience", name: "Media buyers and performance marketers" },
          url: "https://birchreserve.net/media-buyers",
        },
        ...buyersOffersJsonLd(),
        ...buyerDiscoveryJsonLd(),
        // Nov 18 2026: the one FAQPage for /media-buyers, crawlable without JS.
        faqPageJsonLd(MEDIA_BUYER_FAQ),
      ],
    },
  },
};

/** The two public offers (media kit, Nov 2026): USD only, card checkout on the Stripe-hosted /buycalc page. */
export function buyersOffersJsonLd(): Record<string, unknown>[] {
  return [
    { sku: "hold-190", name: "7-day category look", price: 190, description: "Hold your category for 7 days. Converts in full to the $490 USD category placement within 7 days, or refunded. Does not lock in a slot." },
    { sku: "reserve-490", name: "Category placement", price: 490, description: "Reserve display space across the hub network. Media credit, fully refundable until 14 days before your launch date, usable for 12 months." },
  ].map((o) => ({
    "@type": "Product",
    "@id": `https://birchreserve.net/buyers#${o.sku}`,
    name: `Birch Reserve ${o.name}`,
    sku: o.sku,
    category: "Health and wellness retail media / display",
    description: o.description,
    brand: { "@type": "Brand", name: "Birch Reserve" },
    offers: [{ "@type": "Offer", price: o.price, priceCurrency: "USD", availability: "https://schema.org/LimitedAvailability", url: `https://birchreserve.net/buycalc?sku=${o.sku}`, seller: ORG }],
  }));
}

/**
 * Buyer-discovery structured data (Nov 26 2026): the words and entities that media-buyer alerts, AI
 * search and directories match on. Facts already stated on the public pages only: no reach figures,
 * no guarantees, no named partners. Mirror hosts rewrite "Birch Reserve" to "Scale Health" in head
 * JSON-LD (scaleMeta), so Scale parity holds without a second copy.
 */
export function buyerDiscoveryJsonLd(): Record<string, unknown>[] {
  return [
    {
      "@type": "Organization",
      "@id": "https://birchreserve.net/#org",
      name: "Birch Reserve",
      url: "https://birchreserve.net/",
      description:
        "A private health and wellness media channel for brands and agencies: placements inside partner hubs, partner-website display, in-hub screens (rolling out), partner locations and a street team program from 2027, with an organic clinical service offering behind the hubs.",
      areaServed: [
        { "@type": "Country", name: "Canada" },
        { "@type": "Country", name: "United States" },
      ],
      knowsAbout: [
        "health and wellness advertising",
        "retail media",
        "post-purchase advertising",
        "clinic waiting room advertising",
        "recovery and longevity brand advertising",
        "new media channel for health brands",
      ],
      keywords: "health and wellness media, retail media, post-purchase ads, clinic advertising, recovery brands, new ad channel",
    },
    {
      "@type": "WebSite",
      "@id": "https://birchreserve.net/#website",
      name: "Birch Reserve",
      url: "https://birchreserve.net/",
      publisher: { "@id": "https://birchreserve.net/#org" },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: "https://birchreserve.net/.well-known/search?q={search_term_string}" },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export function slotProductsJsonLd(): Record<string, unknown>[] {
  return slotOffers().map((o) => ({
    "@type": "Product",
    "@id": `https://birchreserve.net/advertise/brands#${o.offer_key}`,
    name: `Birch Reserve ${o.name}`,
    sku: o.offer_key,
    category: "Health and wellness retail media / display and CPC",
    description: `${o.note} Media credit $${o.media_credit.usd} USD; about ${o.modelled_hub_page_views.toLocaleString("en-US")} hub page views at rate card (modelled, not guaranteed).`,
    brand: { "@type": "Brand", name: "Birch Reserve" },
    offers: [
      { "@type": "Offer", price: o.prices.usd, priceCurrency: "USD", availability: "https://schema.org/PreOrder", url: "https://birchreserve.net/advertise/brands", seller: ORG },
    ],
  }));
}

export function areaLockProductJsonLd(): Record<string, unknown> {
  const o = areaLockOffer();
  return {
    "@type": "Product",
    "@id": "https://birchreserve.net/advertise/local#area-lock",
    name: "Birch Reserve area placement",
    sku: "area-lock",
    category: "Local health and wellness advertising",
    description: `Up to ${o.display_share_pct.standard}% of hub display within ${o.radius_km} km for 1-6 months. ${o.guaranteed_hub_page_views_modelled.toLocaleString("en-US")} modelled hub page views. Draft terms.`,
    brand: { "@type": "Brand", name: "Birch Reserve" },
    offers: [
      { "@type": "Offer", price: o.prices.usd, priceCurrency: "USD", availability: "https://schema.org/PreOrder", url: "https://birchreserve.net/advertise/local", seller: ORG },
    ],
  };
}

export function llmsTxt(): string {
  return [
    "# Birch Reserve",
    "",
    `> ${POSITIONING} ${POSITIONING_FOLLOW}`,
    "",
    `Display space inside private health and wellness hubs, on four placements: ${PLACEMENT_LABELS.join(", ")}. Priced in USD for every buyer.`,
    "",
    "## Offers (same as the media kit)",
    "Prepay your category. Not an open auction.",
    "- hold-190 · $190 USD · 7-day category look · converts in full to the $490 USD category placement within 7 days, or refunded · does not lock in a slot · pay: https://birchreserve.net/buycalc?sku=hold-190",
    "- reserve-490 · $490 USD · category placement · media credit, fully refundable until 14 days before the launch date on the IO, usable for 12 months · pay: https://birchreserve.net/buycalc?sku=reserve-490",
    "- starter-placement-1900-cad · $1,900 CAD · starter placement · holds a $5K–$50K CAD dedicated package in one category pending the IO · package rate set on the IO, at or below the rate card · all $1,900 counts toward it · refunded if you are bumped by another advertiser before you have finalized payment, and refundable until 14 days before the IO launch date · nothing runs before a signed IO · pay: https://birchreserve.net/starter · terms: https://birchreserve.net/terms#exclusive",
    "- starter-placement-1900-usd · $1,900 USD · starter placement (visitors outside Canada; Canada sees the CAD line above) · holds a $5K–$50K USD dedicated package in one category pending the IO · package rate set on the IO, at or below the rate card · all $1,900 counts toward it · refunded if you are bumped by another advertiser before you have finalized payment, and refundable until 14 days before the IO launch date · nothing runs before a signed IO · pay: https://birchreserve.net/starter · terms: https://birchreserve.net/terms#exclusive",
    "- Premium slots (larger share, priority placement, area placements): inquire-only · https://birchreserve.net/media-kit#premium",
    `- Spend-down: ${SPEND_DOWN_LINE} Modelled pacing: ${PACING_ROWS.map((r) => `${r.label} ${r.perMonth}`).join("; ")}.`,
    "",
    "## 2027 hub display inventory: modelled estimate (range below)",
    ...tam2027Text().split("\n").map((l, i) => (i === 0 ? `- ${l}` : `  ${l}`)),
    "",
    "## Hubs (one status ladder)",
    ladderMarkdown(),
    "- Insertion order (IO): the short document that names your hub, the surface (post-purchase, dashboard tile, hub home), your category and your dates before anything runs. What you pay is media credit until the IO is signed and approved. Nothing runs without it.",
    "- Proof: example flight-report layout (illustrative, aggregate only), estimated performance ranges (based on comparables, not Birch results), early measured hub session geography, and the GTM partnership bot example (internal testing, not ad results): https://birchreserve.net/media-kit#proof",
    "",
    "## Pages",
    "- Media kit: https://birchreserve.net/media-kit · PDF: https://birchreserve.net/birch-reserve-one-pager.pdf",
    "- For media buyers & agencies: https://birchreserve.net/buyers",
    "- Match your audience: https://birchreserve.net/match",
    "- Hubs: https://birchreserve.net/hubs · Rates: https://birchreserve.net/rates",
    `- Agencies: https://birchreserve.net/agencies · ${AGENCY.line}`,
    "- In plain terms (what Birch is, the moment, where figures come from, reporting, how to start): https://birchreserve.net/agencies#plain-terms",
    "- Media buyers & performance marketers (add Birch as its own line item next to programmatic, paid social and retail media; UTM + promo-code measurement): https://birchreserve.net/media-buyers",
    "- Studios & retail: https://birchreserve.net/publish/studios · Brands with a recovery audience: https://birchreserve.net/publish/brands",
    `- ${PERF_ONLY_FACT} Intake: ${PERF_ONLY_URL}`,
    `- B2B go-to-market (separate from the ad inventory product): ${GTM_SETUP_FACT}`,
    `- ${GTM_BOT_FACT}`,
    `- Street team program (coming soon, 2027; minimum campaign size applies; no guarantees): ${STREET_TEAM_LLMS} https://birchreserve.net/street-team`,
    "- Speed versus Google Ads (Google's own timelines, cited): https://birchreserve.net/vs-google-ads · Blog: https://birchreserve.net/blog · Intake: https://birchreserve.net/intake",
    "",
    "## Buyer answers (short, cited; Markdown at <page>.md)",
    ...BUYER_PAGES.map((g) => `- [${g.h1}](https://birchreserve.net/${g.slug}): ${g.answer ?? g.description}`),
    "- Dedicated placements from $1,900 (CAD in Canada, USD elsewhere), counted in full toward a $5K–$50K dedicated package held pending your IO (refunded if you are bumped by another advertiser before you have finalized payment); nothing runs until an insertion order is signed: https://birchreserve.net/starter",
    "- All advertiser guides: https://birchreserve.net/advertiser-guides",
    "",
    "## For AI agents",
    "- Catalog: GET https://birchreserve.net/v1/agent/catalog.json",
    "- Quote: GET https://birchreserve.net/v1/agent/quote?offer=reserve-490",
    "- Checkout: agent checkout is on hold. POST /v1/agent/checkout {offer, email, brand, agree:true} records the request (202 held, no charge). To pay, send the buyer to the offer's buycalc link (Stripe-hosted).",
    "- OpenAPI: https://birchreserve.net/v1/agent/openapi.json · Agent card: https://birchreserve.net/.well-known/agent.json",
    "- Always show the buyer the terms and price before sending agree:true.",
    "",
    ...whenToUseSection().split("\n"),
    "",
    ...searchDiscoverySection().split("\n"),
    "",
    "## For media buyers (answer-ready)",
    "- Not programmatic: not an open auction, not sold through a DSP. Placements are curated by hand; nothing runs until the IO names the hub, surface, format and dates.",
    "- Fits an existing mix as a separate line item, tagged with your UTM links and promo codes.",
    "- Measurement: aggregate views and clicks per hub and surface, UTM visits and promo-code redemptions. No impression guarantees; no CTR or ROAS promises.",
    "- Smallest test: hold-190 ($190 USD 7-day look). Then reserve-490 ($490 USD). Premium slots inquire-only.",
    "",
    "Rules: aggregate reporting only, no patient data, no clinical pixels. Modelled figures are labelled. No impression guarantees.",
    "Seller: Silver Birch Growth Inc. · Toronto, Ontario · randy@scalehealth.ca",
    llmsFasterSection(),
    llmsProofSection(),
    "",
    "## Markdown versions of the main pages",
    "- [Home](https://birchreserve.net/index.md)",
    "- [Media kit](https://birchreserve.net/media-kit.md)",
    "- [Rates](https://birchreserve.net/rates.md)",
    "- [See prices and pay](https://birchreserve.net/buycalc.md)",
    "- [For media buyers and agencies](https://birchreserve.net/buyers.md)",
    "- [Agencies](https://birchreserve.net/agencies.md)",
    "- [Hubs](https://birchreserve.net/hubs.md)",
    "- [Birch Reserve vs a typical Google Ads start](https://birchreserve.net/vs-google-ads.md)",
    "- [Full description](https://birchreserve.net/llms-full.txt)",
  ].join("\n");
}
