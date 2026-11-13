/** Per-route head + llms.txt for the overhaul routes (crawlable without JS). */
import { slotOffers, areaLockOffer } from "./agent";
import { AGENCY, AREA_LOCK, BRAND_HUBS, INVENTORY, PLACEMENT_LABELS, PUBLISHER_INCENTIVE, SLOT_LADDER, TAM, areaLockGuaranteedViews } from "./model";

export const OVERHAUL_OG_IMAGE = "https://birchreserve.net/og-birch-reserve-hubs.png";

export type RouteMeta = { title: string; description: string; jsonld?: Record<string, unknown>; /** Per-route share image; defaults to OVERHAUL_OG_IMAGE. */ image?: string };

export const MEDIA_KIT_OG_IMAGE = "https://birchreserve.net/og-media-kit.png";

const ORG = { "@type": "Organization", name: "Birch Reserve", url: "https://birchreserve.net/" };

export const OVERHAUL_ROUTES: Record<string, RouteMeta> = {
  "/advertise/brands": {
    title: "Brand spend commits | Birch Reserve",
    description: "Lock in spend across co-branded Recovery Brand hubs and health & wellness business hubs. Prepay and get up to 15% bonus credit.",
    jsonld: { "@context": "https://schema.org", "@graph": slotProductsJsonLd() },
  },
  "/advertise/local": {
    title: "Lock down my area | Birch Reserve",
    description: `Hold up to ${AREA_LOCK.standardSharePct}% of hub display within ${AREA_LOCK.radiusKm} km of your postal code for 1-6 months. $${AREA_LOCK.priceCad.toLocaleString("en-US")} CAD / $${AREA_LOCK.priceUsd.toLocaleString("en-US")} USD launch rate until ${AREA_LOCK.launchRateUntil}.`,
    jsonld: { "@context": "https://schema.org", "@graph": [areaLockProductJsonLd()] },
  },
  "/publish/brands": { title: "Publish · Brands | Birch Reserve", description: "Brands with a recovery audience can apply for a co-branded hub. Otherwise, inquire about display or CPC-only opportunities outside hubs." },
  "/publish/studios": { title: "Publish · Studios & retail | Birch Reserve", description: `Activate your hub with pre-built monetizations and our marketplace. Earn $${PUBLISHER_INCENTIVE.cashCad} cash or $${PUBLISHER_INCENTIVE.creditCad}+ in ad credit.` },
  "/match": { title: "Match your audience | Birch Reserve", description: "Enter your website and a short note. See how well your audience matches the Scale Activity launch audience profile, as a clean % with three reasons." },
  "/hubs": { title: "Live brand hubs | Birch Reserve", description: `${BRAND_HUBS.map((h) => h.name).join(", ")}: live inventory. Register your email to see audience, placements and pricing.` },
  "/media-kit": {
    title: "Media kit | Birch Reserve",
    image: MEDIA_KIT_OG_IMAGE,
    description: "Prepaid media credit inside co-branded Scale Health Network hubs. Start with the small-business package ($190 look or $490 seat, self-serve) or inquire about a premium slot from $25K–$50K. Modelled volumes, no guarantees.",
    jsonld: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Birch Reserve media kit",
      url: "https://birchreserve.net/media-kit",
      publisher: ORG,
      mainEntity: { "@type": "Service", name: "Birch Reserve category seats", provider: ORG, areaServed: ["CA", "US"], serviceType: "Prepaid media credit, exclusive category placement in health and wellness hubs" },
    },
  },
  "/buyers": {
    title: "For media buyers | Birch Reserve",
    description: "Machine-readable catalog, quotes and Stripe-hosted checkout for media buyers. Display and CPC inside co-branded health & wellness hubs. Modelled views labelled.",
    jsonld: { "@context": "https://schema.org", "@graph": [...slotProductsJsonLd(), areaLockProductJsonLd(), { "@type": "WebAPI", name: "Birch Reserve buying API", documentation: "https://birchreserve.net/v1/agent/openapi.json", url: "https://birchreserve.net/v1/agent/catalog.json", provider: ORG }] },
  },
  "/ai-buyers": {
    title: "For media buyers | Birch Reserve",
    description: "Machine-readable catalog, quotes and Stripe-hosted checkout for media buyers. Display and CPC inside co-branded health & wellness hubs. Modelled views labelled.",
    jsonld: { "@context": "https://schema.org", "@graph": [...slotProductsJsonLd(), areaLockProductJsonLd(), { "@type": "WebAPI", name: "Birch Reserve buying API", documentation: "https://birchreserve.net/v1/agent/openapi.json", url: "https://birchreserve.net/v1/agent/catalog.json", provider: ORG }] },
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
    title: "For agencies | Birch Reserve",
    description: "Prepay a client test budget into health & wellness hubs. UTM and promo-code reporting. Agency commission available.",
    jsonld: { "@context": "https://schema.org", "@type": "Service", name: "Agency test budgets", provider: ORG, areaServed: ["CA", "US"], serviceType: "Retail media / post-purchase advertising" },
  },
};

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
  const g = areaLockGuaranteedViews();
  return [
    "# Birch Reserve",
    "",
    `> Ad space inside co-branded Recovery Brand hubs (recovery, longevity, food; pets in queue) and health & wellness business hubs (physio, mobility, gyms, studios, clinic hubs). Display and CPC on four placements: ${PLACEMENT_LABELS.join(", ")}.`,
    "",
    `Audience (modelled, ${TAM.source}, read ${TAM.readOn}): ${TAM.ordersLabel} ${TAM.ordersNote}; ${TAM.listedPartners} listed partners.`,
    "",
    "## Advertise",
    `- Brands, spend commits: https://birchreserve.net/advertise/brands · ${SLOT_LADDER.map((t) => `$${t.usd} USD${t.bonusPct ? ` (+${t.bonusPct}% credit)` : ""}`).join(" · ")}. CAD: ${SLOT_LADDER.map((t) => `$${t.cad}`).join(" · ")}.`,
    `- Local businesses & studios, Lock down my area: https://birchreserve.net/advertise/local · $${AREA_LOCK.priceCad} CAD / $${AREA_LOCK.priceUsd} USD (launch rate until ${AREA_LOCK.launchRateUntil}) · up to ${AREA_LOCK.standardSharePct}% of display within ${AREA_LOCK.radiusKm} km (${AREA_LOCK.denseCoreSharePct}% in dense downtown cores) · 1-6 months from display start · credit at ${AREA_LOCK.discountPct}% off rate card · ${g.views.toLocaleString("en-US")} modelled page views across hubs · right to keep pace if traffic grows · ${AREA_LOCK.followOnDiscountPct}% off rate card on follow-on spend up to $${AREA_LOCK.followOnCapUsd.toLocaleString("en-US")} USD per locker over the term · ${AREA_LOCK.unusedCredit}`,
    "- Match your audience (modelled score): https://birchreserve.net/match · POST /v1/match {url, blurb}",
    "",
    "## Publish",
    "- Brands with a recovery audience: co-branded hub by application; otherwise display / CPC-only inquiry: https://birchreserve.net/publish/brands",
    `- Studios & retail: $${PUBLISHER_INCENTIVE.cashCad} cash or $${PUBLISHER_INCENTIVE.creditCad}+ ad credit, for activating your audience (${PUBLISHER_INCENTIVE.activationChannels.join(", ")}); paid ${PUBLISHER_INCENTIVE.paidDaysAfterFirstTransaction} days after we see real traffic or transactions; self-purchases excluded: https://birchreserve.net/publish/studios · activate at ${PUBLISHER_INCENTIVE.clinicHubsUrl}`,
    "",
    "## For media buyers",
    "- Start here: https://birchreserve.net/buyers",
    "- Legacy URL (same page): https://birchreserve.net/ai-buyers",
    "- Catalog (inventory, placements, offers, modelled views, checkout status): GET https://birchreserve.net/v1/agent/catalog.json",
    "- Quote: GET /v1/agent/quote?offer=sponsor-1500&currency=usd · GET /v1/agent/quote?offer=area-lock&postal=M4E1G3&term=3",
    "- Checkout: POST /v1/agent/checkout {offer, currency, email, brand | business+category+postal+term, agree:true}. Returns status open + Stripe-hosted checkout_url, or status held (reserved by inquiry, no charge, confirmed within 1 business day).",
    "- OpenAPI: https://birchreserve.net/v1/agent/openapi.json · Agent card: https://birchreserve.net/.well-known/agent.json · UCP: https://birchreserve.net/.well-known/ucp",
    "- Offer keys: " + [...slotOffers().map((o) => `${o.offer_key} ($${o.prices.usd} USD / $${o.prices.cad} CAD, ~${o.modelled_hub_page_views.toLocaleString("en-US")} modelled views)`), "area-lock"].join(" · "),
    "- Always show the buyer the terms and price before sending agree:true.",
    "",
    "## Agencies",
    `- Prepay a client test budget; UTM + promo-code reporting; ${AGENCY.line} ${AGENCY.bonusNote} https://birchreserve.net/agencies`,
    "",
    "## Live inventory",
    `- ${BRAND_HUBS.map((h) => h.name).join(" · ")}`,
    `- ${INVENTORY.line} ${INVENTORY.queueLine}`,
    "",
    "## Machine endpoints",
    "- Area quote: GET /v1/area/quote?postal=L4C3G5&term=3",
    "- Media kit (one link): https://birchreserve.net/media-kit · Rate card: https://birchreserve.net/kit",
    "- Catalog: /v1/catalog.json · Sitemap: /sitemap.xml",
    "",
    "Rules: aggregate reporting only, no patient data, no clinical pixels. Modelled figures are labelled.",
    "Seller: Silver Birch Growth Inc. · Toronto, Ontario · sales@silverbirchgrowth.com",
  ].join("\n");
}
