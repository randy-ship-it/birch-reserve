/** Per-route head + llms.txt for the overhaul routes (crawlable without JS). */
import { slotOffers, areaLockOffer } from "./agent";
import { AGENCY, AREA_LOCK, BRAND_HUBS, INVENTORY, PLACEMENT_LABELS, PUBLISHER_INCENTIVE, SLOT_LADDER, TAM, areaLockGuaranteedViews } from "./model";

export const OVERHAUL_OG_IMAGE = "https://birchreserve.net/og-birch-reserve-hubs.png";

export type RouteMeta = { title: string; description: string; jsonld?: Record<string, unknown>; /** Per-route share image; defaults to OVERHAUL_OG_IMAGE. */ image?: string };

export const MEDIA_KIT_OG_IMAGE = "https://birchreserve.net/og-media-kit-usd.png";

const ORG = { "@type": "Organization", name: "Birch Reserve", url: "https://birchreserve.net/" };

export const OVERHAUL_ROUTES: Record<string, RouteMeta> = {
  "/advertise/brands": {
    title: "Advertise to brands | Birch Reserve",
    description: "Display space inside private health and wellness hubs. Start with a $190 USD 7-day category look or a $490 USD category reserve, self-serve. Live hubs: Integrity Fitness and DR-HO'S physio.",
    jsonld: { "@context": "https://schema.org", "@graph": buyersOffersJsonLd() },
  },
  "/advertise/local": {
    title: "Local businesses & studios | Birch Reserve",
    description: "Reach hub members near you. Start with a $190 USD 7-day look or a $490 USD category reserve; area locks are premium, by inquiry.",
    jsonld: { "@context": "https://schema.org", "@graph": buyersOffersJsonLd() },
  },
  "/publish/brands": { title: "Publish · Brands | Birch Reserve", description: "Brands with a recovery audience can apply for a co-branded hub. Otherwise, inquire about display or CPC-only opportunities outside hubs." },
  "/publish/studios": { title: "Publish · Studios & retail | Birch Reserve", description: `Activate your hub with pre-built monetizations and our marketplace. Earn $${PUBLISHER_INCENTIVE.cashCad} cash or $${PUBLISHER_INCENTIVE.creditCad}+ in ad credit.` },
  "/match": { title: "Match your audience | Birch Reserve", description: "Enter your website and a short note. See how well your audience matches the Scale Activity launch audience profile, as a clean % with three reasons." },
  "/hubs": { title: "Hubs | Birch Reserve", description: "Live hubs today: Integrity Fitness and DR-HO'S physio. More brand hubs are in queue. Register your email to see audience, placements and modelled views." },
  "/media-kit": {
    title: "Media kit | Birch Reserve",
    image: MEDIA_KIT_OG_IMAGE,
    description: "Prepaid media credit across a growing network of private health and wellness hubs. Start with the small-business package ($190 USD look or $490 USD reserve, self-serve) or inquire about a premium slot from $25K–$50K. Modelled volumes, no guarantees.",
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
    description: "Display space inside private health and wellness hubs. A $190 USD 7-day category look or a $490 USD category reserve, paid by card on a Stripe-hosted page. Live hubs: Integrity Fitness and DR-HO'S physio.",
    jsonld: { "@context": "https://schema.org", "@graph": buyersOffersJsonLd() },
  },
  "/ai-buyers": {
    title: "For media buyers & agencies | Birch Reserve",
    description: "Display space inside private health and wellness hubs. A $190 USD 7-day category look or a $490 USD category reserve, paid by card on a Stripe-hosted page. Live hubs: Integrity Fitness and DR-HO'S physio.",
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
    description: "Agencies, brokers and media resellers: prepay a client test into private health & wellness hubs from $490 USD. Spec sheet, sample IO, UTM and promo-code reporting, 10% of media spend paid in cash to the agency of record.",
    jsonld: { "@context": "https://schema.org", "@type": "Service", name: "Agency test budgets", provider: ORG, areaServed: ["CA", "US"], serviceType: "Retail media / post-purchase advertising" },
  },
};

/** The two public offers (media kit, Nov 2026): USD only, card checkout on the Stripe-hosted /buycalc page. */
export function buyersOffersJsonLd(): Record<string, unknown>[] {
  return [
    { sku: "hold-190", name: "7-day category look", price: 190, description: "Hold your category for 7 days. Converts in full to the $490 USD reserve within 7 days, or refunded. Does not lock in a slot." },
    { sku: "reserve-490", name: "Category reserve", price: 490, description: "Reserve display space across the hub network. Media credit, fully refundable until 14 days before your launch date, usable for 12 months." },
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
      { "@type": "Offer", price: o.prices.cad, priceCurrency: "CAD", availability: "https://schema.org/PreOrder", url: "https://birchreserve.net/advertise/brands", seller: ORG },
    ],
  }));
}

export function areaLockProductJsonLd(): Record<string, unknown> {
  const o = areaLockOffer();
  return {
    "@type": "Product",
    "@id": "https://birchreserve.net/advertise/local#area-lock",
    name: "Birch Reserve area lock",
    sku: "area-lock",
    category: "Local health and wellness advertising",
    description: `Up to ${o.display_share_pct.standard}% of hub display within ${o.radius_km} km for 1-6 months. ${o.guaranteed_hub_page_views_modelled.toLocaleString("en-US")} modelled hub page views. Draft terms.`,
    brand: { "@type": "Brand", name: "Birch Reserve" },
    offers: [
      { "@type": "Offer", price: o.prices.cad, priceCurrency: "CAD", availability: "https://schema.org/PreOrder", url: "https://birchreserve.net/advertise/local", seller: ORG },
      { "@type": "Offer", price: o.prices.usd, priceCurrency: "USD", availability: "https://schema.org/PreOrder", url: "https://birchreserve.net/advertise/local", seller: ORG },
    ],
  };
}

export function llmsTxt(): string {
  return [
    "# Birch Reserve",
    "",
    `> Display space inside private health and wellness hubs, on four placements: ${PLACEMENT_LABELS.join(", ")}. Priced in USD for every buyer.`,
    "",
    "## Offers (same as the media kit)",
    "Prepay your category. Not an open auction.",
    "- hold-190 · $190 USD · 7-day category look · converts in full to the $490 USD reserve within 7 days, or refunded · does not lock in a slot · pay: https://birchreserve.net/buycalc?sku=hold-190",
    "- reserve-490 · $490 USD · category reserve · media credit, fully refundable until 14 days before the launch date on the IO, usable for 12 months · pay: https://birchreserve.net/buycalc?sku=reserve-490",
    "- Premium slots (exclusivity, priority placement, area locks): inquire-only · https://birchreserve.net/media-kit#premium",
    "",
    "## Live hubs",
    "- Integrity Fitness · DR-HO'S physio. More hubs launch over time; placements are curated as each goes live.",
    "",
    "## Pages",
    "- Media kit: https://birchreserve.net/media-kit · PDF: https://birchreserve.net/birch-reserve-one-pager.pdf",
    "- For media buyers & agencies: https://birchreserve.net/buyers",
    "- Match your audience: https://birchreserve.net/match",
    "- Hubs: https://birchreserve.net/hubs · Rates: https://birchreserve.net/rates",
    `- Agencies: https://birchreserve.net/agencies · ${AGENCY.line}`,
    "- Publishers (studios & retail): https://birchreserve.net/publish/studios · Brands with a recovery audience: https://birchreserve.net/publish/brands",
    "",
    "## For AI agents",
    "- Catalog: GET https://birchreserve.net/v1/agent/catalog.json",
    "- Quote: GET https://birchreserve.net/v1/agent/quote?offer=reserve-490",
    "- Checkout: agent checkout is on hold. POST /v1/agent/checkout {offer, email, brand, agree:true} records the request (202 held, no charge). To pay, send the buyer to the offer's buycalc link (Stripe-hosted).",
    "- OpenAPI: https://birchreserve.net/v1/agent/openapi.json · Agent card: https://birchreserve.net/.well-known/agent.json",
    "- Always show the buyer the terms and price before sending agree:true.",
    "",
    "Rules: aggregate reporting only, no patient data, no clinical pixels. Modelled figures are labelled. No impression guarantees.",
    "Seller: Silver Birch Growth Inc. · Toronto, Ontario · sales@silverbirchgrowth.com",
  ].join("\n");
}
