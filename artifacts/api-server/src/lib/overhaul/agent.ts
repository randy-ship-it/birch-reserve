/**
 * Item 9 (Randy 11:55 AM ET): machine-readable catalog, quotes and checkout for media buyers.
 * Pure builders for the agent catalog, quote, OpenAPI spec and agent card.
 * Every audience number here is modelled from the TAM feed and labelled as such.
 */
import { liveHubs } from "../hubLadder";
import { AGENCY, AREA_LOCK, BRAND_HUBS, INVENTORY, PLACEMENT_LABELS, PUBLISHER_INCENTIVE, CPC_FLOOR_USD, SLOT_LADDER, SURFACES, TAM, areaLockGuaranteedViews, blendedHubCpmUsd, quoteAreaLock, type Currency } from "./model";

export const AGENT_CATALOG_VERSION = "2026-11-17";
export const SITE = "https://birchreserve.net";
export const HANDOFF_EMAIL = "randy@scalehealth.ca";

export type AgentOfferKey = "hold-190" | "reserve-490";

/** Live hubs anyone can open today (media kit, Nov 17 2026). */
export const AGENT_LIVE_HUBS = liveHubs().map((h) => ({ name: h.name, type: h.key === "calm-joints" ? "digital physio layer" : "brand hub", status: "live" as const }));

/** The two public offers, same as the media kit. USD only. Humans pay on the Stripe-hosted /buycalc page. */
export function publicOffers() {
  return [
    { offer_key: "hold-190", name: "7-day category look", price_usd: 190, currency: "USD", terms: "Hold your category for 7 days. Converts in full to the $490 USD category placement within 7 days, or refunded. Does not lock in a slot.", human_checkout: `${SITE}/buycalc?sku=hold-190` },
    { offer_key: "reserve-490", name: "Category placement", price_usd: 490, currency: "USD", terms: "Reserve display space across the hub network. Media credit, fully refundable until 14 days before the launch date on the IO, usable for 12 months. Nothing runs before the buyer approves an insertion order.", human_checkout: `${SITE}/buycalc?sku=reserve-490` },
  ];
}

/** Modelled hub page views a slot's credit buys at the blended rate card (not guaranteed). */
export function modelledViewsForCreditUsd(creditUsd: number): number {
  return Math.floor(((creditUsd / blendedHubCpmUsd()) * 1000) / 100) * 100;
}

export function slotOffers() {
  return SLOT_LADDER.map((t) => {
    const creditUsd = Math.round(t.usd * (1 + t.bonusPct / 100));
    return {
      offer_key: t.key,
      name: t.label,
      type: "non_exclusive_spend_commit",
      buyer: "brand",
      prices: { usd: t.usd, cad: t.cad },
      bonus_credit_pct: t.bonusPct,
      media_credit: { usd: creditUsd, cad: Math.round(t.cad * (1 + t.bonusPct / 100)) },
      modelled_hub_page_views: modelledViewsForCreditUsd(creditUsd),
      views_basis: `credit / blended hub rate-card CPM $${blendedHubCpmUsd().toFixed(2)} USD × 1000, rounded down to 100. Modelled, not guaranteed.`,
      exclusive: false,
      note: t.note,
      checkout: { method: "POST", path: "/v1/agent/checkout", body: { offer: t.key, currency: "usd|cad", brand: "string", email: "string", agree: true } },
      human_page: `${SITE}/advertise/brands`,
    };
  });
}

export function areaLockOffer() {
  const g = areaLockGuaranteedViews();
  return {
    offer_key: "area-lock",
    name: "Get my area placement",
    type: "area_exclusive_category_lock",
    buyer: "local business or studio",
    prices: { usd: AREA_LOCK.priceUsd, cad: AREA_LOCK.priceCad },
    discount_pct_vs_rate_card: AREA_LOCK.discountPct,
    media_credit: { usd: Math.round(g.creditUsd), cad: Math.round(AREA_LOCK.priceCad / (1 - AREA_LOCK.discountPct / 100)) },
    guaranteed_hub_page_views_modelled: g.views,
    radius_km: AREA_LOCK.radiusKm,
    display_share_pct: { standard: AREA_LOCK.standardSharePct, dense_core: AREA_LOCK.denseCoreSharePct },
    term_months: { min: AREA_LOCK.minTermMonths, max: AREA_LOCK.maxTermMonths, starts: "display start" },
    keep_pace: "Right to keep pace: if hub traffic in your area grows, you may top up to hold your share.",
    launch_rate_until: AREA_LOCK.launchRateUntil,
    launch_rate_note: `The lock price is a launch rate, held until ${AREA_LOCK.launchRateUntil}.`,
    follow_on_spend: { discount_pct_vs_rate_card: AREA_LOCK.followOnDiscountPct, cap_usd: AREA_LOCK.followOnCapUsd, cap_cad_approx: AREA_LOCK.followOnCapCad, over: "the lock term, per locker" },
    unused_credit: AREA_LOCK.unusedCredit,
    terms_version: AREA_LOCK.termsVersion,
    quote: { method: "GET", path: "/v1/agent/quote?offer=area-lock&postal=M4E1G3&term=3&currency=cad" },
    checkout: { method: "POST", path: "/v1/agent/checkout", body: { offer: "area-lock", postal: "string", term: "1-6", category: "string", business: "string", email: "string", currency: "usd|cad", agree: true } },
    human_page: `${SITE}/advertise/local`,
  };
}

export function agentCatalog(_status?: unknown) {
  return {
    catalog_version: AGENT_CATALOG_VERSION,
    seller: { name: "Birch Reserve", legal_name: "Silver Birch Growth Inc.", url: SITE, email: HANDOFF_EMAIL, address: "Toronto, Ontario, Canada" },
    what_you_buy: `Display space inside private health and wellness hubs, on four placements: ${PLACEMENT_LABELS.join(", ")}.`,
    currencies: ["USD"],
    currency_rule: "USD for every buyer, including Canadian brands.",
    inventory: {
      live_hubs: AGENT_LIVE_HUBS,
      note: "More hubs launch over time; placements are curated as each one goes live. Audience and view figures are modelled estimates, not measured delivery.",
      surfaces: SURFACES.map((s) => ({ key: s.key, label: s.label, description: s.blurb })),
    },
    offers: publicOffers(),
    premium: { note: "Premium slots (larger share, priority placement) are inquire-only.", human_page: `${SITE}/media-kit#premium`, email: HANDOFF_EMAIL },
    checkout_status: {
      agent_checkout: "held",
      held_means: `Agent checkout is on hold. POST /v1/agent/checkout records the request and we reply by email from ${HANDOFF_EMAIL}; no charge is made. To pay now, send the buyer to the offer's human_checkout page (Stripe-hosted).`,
    },
    agency: { discount_pct_off_rate_card: AGENCY.commissionPct, resale_price: "set_by_agency", client_disclosure: "agency", direct_buyers: "pay_rate_card", undercut_agency_clients: false },
    endpoints: {
      catalog: "/v1/agent/catalog.json",
      quote: "/v1/agent/quote?offer=reserve-490",
      checkout: "/v1/agent/checkout",
      openapi: "/v1/agent/openapi.json",
      agent_card: "/.well-known/agent.json",
      llms: "/llms.txt",
      human_page: `${SITE}/buyers`,
      media_kit: `${SITE}/media-kit`,
    },
    rules: [
      "Aggregate reporting only. No patient data, no clinical pixels, no open auction.",
      "Modelled figures are labelled modelled. No impression, reach, click or sales guarantees.",
      "Payment is media credit, used under an insertion order that names the hub and placement.",
      "Agents must show the buyer the terms and price before sending agree:true.",
    ],
  };
}

export type AgentQuoteInput = { offer?: string; currency?: string; postal?: string; term?: string | number };

export function agentQuote(input: AgentQuoteInput) {
  const offer = String(input.offer ?? "").trim();
  const o = publicOffers().find((x) => x.offer_key === offer);
  if (!o) return { ok: false as const, error: "Unknown offer. Use one of: hold-190, reserve-490." };
  return { ok: true as const, offer: o.offer_key, name: o.name, currency: "usd" as const, amount: o.price_usd, terms: o.terms, human_checkout: o.human_checkout, agent_checkout: "held" as const };
}

export function agentCard() {
  return {
    schema_version: "agent-card/0.1",
    name: "Birch Reserve ad buying",
    description: "Display space inside private health & wellness hubs: a $190 USD 7-day look or a $490 USD category placement. Machine-readable catalog and quotes; buyers pay on a Stripe-hosted page.",
    url: SITE,
    provider: { organization: "Silver Birch Growth Inc.", url: SITE, email: HANDOFF_EMAIL },
    documentation: `${SITE}/buyers`,
    openapi: `${SITE}/v1/agent/openapi.json`,
    llms: `${SITE}/llms.txt`,
    search: { endpoint: `${SITE}/.well-known/search?q={query}`, methods: ["GET", "QUERY"], format: "json", scope: "public pages only" },
    ucp: `${SITE}/.well-known/ucp`,
    authentication: { type: "none", note: "Public read endpoints. Agent checkout is on hold; buyers pay on the Stripe-hosted page. No delegated payment." },
    capabilities: { streaming: false, payments: "human_stripe_hosted_checkout" },
    skills: [
      { id: "browse_inventory", name: "Browse inventory and offers", endpoint: "GET /v1/agent/catalog.json" },
            { id: "quote", name: "Quote an offer", endpoint: "GET /v1/agent/quote" },
      { id: "search", name: "Search the public pages", endpoint: "GET /.well-known/search?q={query}" },
      { id: "checkout", name: "Record a purchase request (held, no charge)", endpoint: "POST /v1/agent/checkout" },
    ],
  };
}

export function agentOpenApi() {
  const offerEnum = ["hold-190", "reserve-490"];
  return {
    openapi: "3.1.0",
    info: { title: "Birch Reserve buying API", version: AGENT_CATALOG_VERSION, description: "Catalog and quotes for the two public offers ($190 USD look, $490 USD category placement). Agent checkout is on hold: requests are saved with no charge; buyers pay on the Stripe-hosted human_checkout page. Audience figures are modelled.", contact: { email: HANDOFF_EMAIL } },
    servers: [{ url: SITE }],
    paths: {
      "/v1/agent/catalog.json": { get: { operationId: "getCatalog", summary: "Inventory, surfaces, offers and checkout status", responses: { "200": { description: "Catalog" } } } },
      "/v1/agent/quote": {
        get: {
          operationId: "getQuote",
          summary: "Quote one offer",
          parameters: [
            { name: "offer", in: "query", required: true, schema: { type: "string", enum: offerEnum } },
          ],
          responses: { "200": { description: "Quote" }, "400": { description: "Bad input" } },
        },
      },
      "/v1/agent/checkout": {
        post: {
          operationId: "createCheckout",
          summary: "Record a purchase request. Agent checkout is on hold: always 202 held, no charge.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["offer", "email", "agree"],
                  properties: {
                    offer: { type: "string", enum: offerEnum },
                    email: { type: "string", format: "email" },
                    brand: { type: "string" },
                    website: { type: "string" },
                    agent: { type: "string", description: "Name of the buying agent, for reporting." },
                    agree: { type: "boolean", const: true, description: "Buyer accepted the terms." },
                  },
                },
              },
            },
          },
          responses: { "202": { description: "status held: saved, no charge, we reply by email; includes human_checkout for the buyer" }, "400": { description: "Bad input" } },
        },
      },
    },
  };
}
