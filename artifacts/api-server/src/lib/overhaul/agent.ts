/**
 * Item 9 (Randy 11:55 AM ET): make Birch Reserve a magnet for AI ad buying.
 * Pure builders for the agent catalog, quote, OpenAPI spec and agent card.
 * Every audience number here is modelled from the TAM feed and labelled as such.
 */
import { AGENCY, AREA_LOCK, BRAND_HUBS, INVENTORY, PLACEMENT_LABELS, PUBLISHER_INCENTIVE, CPC_FLOOR_USD, SLOT_LADDER, SURFACES, TAM, areaLockGuaranteedViews, blendedHubCpmUsd, quoteAreaLock, type Currency } from "./model";

import { BLOCK_NOTE, CONTACT, IMPRESSION_BLOCKS, SEAT_CATEGORIES, SEAT_SKUS, blockByKey, seatSku } from "../seats/catalog";
import type { SeatAvailability } from "../seats/availability";

export const AGENT_CATALOG_VERSION = "2026-11-12.seats";
export const SITE = "https://birchreserve.net";
export const HANDOFF_EMAIL = "sales@silverbirchgrowth.com";

export type AgentOfferKey = (typeof SLOT_LADDER)[number]["key"] | "area-lock";

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
    name: "Lock down my area",
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

/** Category seats + impression blocks, with live availability (Friday -> BR ledger -> call to confirm). */
export function seatOffers(seats?: SeatAvailability, seatsCheckout = false) {
  return {
    model: "Eight recovery categories, one brand per category. Lead offers: hold-190 ($190 7-day look) and reserve-490 ($490 named category seat, media credit).",
    availability: seats
      ? { source: seats.source, as_of: seats.as_of, open: seats.open, total: seats.total, confirm_by_phone: seats.confirm_by_phone, categories: seats.categories.map((c) => ({ slug: c.slug, label: c.label, status: c.status })), note: seats.note }
      : { source: "none", open: null, total: SEAT_CATEGORIES.length, confirm_by_phone: true },
    skus: SEAT_SKUS.map((s) => ({
      offer_key: s.sku,
      sku: s.sku,
      name: s.name,
      type: s.sku === "hold-190" ? "category_look_7_day" : "named_category_seat",
      prices: { usd: s.usd, cad: s.cad },
      media_credit: true,
      terms: s.line,
      requires: ["category (slug)", "brand", "email", "agree:true"],
      checkout: { method: "POST", path: "/v1/agent/checkout", body: { offer: s.sku, category: SEAT_CATEGORIES.map((c) => c.slug).join("|"), brand: "string", email: "string", currency: "usd|cad", agree: true } },
      human_page: `${SITE}/buycalc#seats`,
    })),
    impression_blocks: IMPRESSION_BLOCKS.map((b) => ({ offer_key: b.key, name: `${b.name} · ${b.views.toLocaleString("en-US")} views`, surface: b.surfaceLabel, views_estimated: b.views, starter_cpm_usd: b.starterCpmUsd, prices: { usd: b.usd, cad: b.cad }, guaranteed: false, request: { method: "POST", path: "/v1/seats/request", body: { action: "block_request", block: b.key, brand: "string", email: "string" } } })),
    block_note: BLOCK_NOTE,
    waitlist: { method: "POST", path: "/v1/seats/request", body: { action: "waitlist", category: "slug", brand: "string", email: "string" } },
    checkout: seatsCheckout ? "open" : "held",
    contact: { phone: CONTACT.phoneDisplay, email: CONTACT.email },
  };
}

export function agentCatalog(status: { slotsCheckout: boolean; areaLockCheckout: boolean; seatsCheckout?: boolean }, seats?: SeatAvailability) {
  return {
    catalog_version: AGENT_CATALOG_VERSION,
    seller: { name: "Birch Reserve", legal_name: "Silver Birch Growth Inc.", url: SITE, email: HANDOFF_EMAIL, address: "777-2255B Queen St E, Toronto ON M4E 1G3, Canada" },
    what_you_buy: `Display and CPC placements inside co-branded Recovery Brand hubs and health & wellness business hubs, on four placements: ${PLACEMENT_LABELS.join(", ")}.`,
    currencies: ["USD", "CAD"],
    currency_rule: "Canadian buyers pay CAD; everyone else USD. Pass currency explicitly to override.",
    inventory: {
      modelled: true,
      source: TAM.source,
      read_on: TAM.readOn,
      listed_partners: TAM.listedPartners,
      monthly_views_total_modelled: TAM.monthly.viewsTotal,
      surfaces: SURFACES.map((s) => ({ key: s.key, label: s.label, formats: ["display", "cpc"], rate_card_cpm_usd: s.cpmUsd, monthly_views_modelled: s.monthly, description: s.blurb })),
      blended_hub_cpm_usd: Number(blendedHubCpmUsd().toFixed(2)),
      cpc_floor_usd: CPC_FLOOR_USD,
      modelled_ctr_band: [TAM.ctrLo, TAM.ctrHi],
      live_hubs: BRAND_HUBS.map((h) => ({ name: h.name, category: h.category, status: "live inventory" })),
      live_inventory: INVENTORY.line,
      spend_down_months_from_deposit: INVENTORY.liveSpendDownMonths,
      queue: { multiple_of_live: INVENTORY.queueMultiple, by: INVENTORY.queueBy, deposits_accepted: true, note: INVENTORY.queueLine },
    },
    category_seats: seatOffers(seats, status.seatsCheckout ?? false),
    offers: [...slotOffers(), areaLockOffer()],
    checkout_status: {
      category_seats: status.seatsCheckout ? "open" : "held",
      spend_commits: status.slotsCheckout ? "open" : "held",
      area_lock: status.areaLockCheckout ? "open" : "held",
      held_means: `Checkout returns status "held": reserved by inquiry, confirmed within 1 business day by email from ${HANDOFF_EMAIL}. No charge is made.`,
    },
    agency: { commission_pct_of_media_spend: AGENCY.commissionPct, paid_to: "agency of record", bonus_credit: AGENCY.bonusNote },
    publisher_payout: {
      cash_cad: PUBLISHER_INCENTIVE.cashCad,
      ad_credit_cad: PUBLISHER_INCENTIVE.creditCad,
      activate_via: PUBLISHER_INCENTIVE.activationChannels,
      clock: PUBLISHER_INCENTIVE.clockRule,
      exclusions: PUBLISHER_INCENTIVE.selfPurchaseRule,
    },
    endpoints: {
      catalog: "/v1/agent/catalog.json",
      quote: "/v1/agent/quote",
      checkout: "/v1/agent/checkout",
      match: "/v1/match",
      openapi: "/v1/agent/openapi.json",
      agent_card: "/.well-known/agent.json",
      ucp: "/.well-known/ucp",
      llms: "/llms.txt",
      legacy_catalog: "/v1/catalog.json",
      seats_availability: "/v1/seats/availability.json",
      seats_catalog: "/v1/seats/catalog.json",
      seats_request: "/v1/seats/request",
    },
    rules: [
      "Aggregate reporting only. No patient data, no clinical pixels, no open auction.",
      "Modelled figures are labelled modelled. Only the area lock carries a views guarantee (modelled).",
      "Payment is media credit, spent down on live hubs under an insertion order that names the hubs. Unused credit: refund, or extend month by month at the same discount.",
      "Agents must pass agree:true only after showing the buyer the terms and price.",
    ],
  };
}

export type AgentQuoteInput = { offer?: string; currency?: string; postal?: string; term?: string | number };

export function agentQuote(input: AgentQuoteInput) {
  const offer = String(input.offer ?? "").trim();
  const cur = String(input.currency ?? "").toLowerCase();
  const currency: Currency | undefined = cur === "cad" || cur === "usd" ? cur : undefined;
  if (offer === "area-lock") {
    const q = quoteAreaLock(String(input.postal ?? ""), Number(input.term ?? 3), currency);
    if (!q.ok) return { ok: false as const, error: q.error };
    return { ok: true as const, offer: "area-lock", currency: q.currency, amount: q.price, quote: q, checkout: { method: "POST", path: "/v1/agent/checkout" } };
  }
  const seat = seatSku(offer);
  if (seat) {
    const c: Currency = currency ?? "usd";
    return { ok: true as const, offer: seat.sku, currency: c, amount: c === "cad" ? seat.cad : seat.usd, media_credit: c === "cad" ? seat.cad : seat.usd, terms: seat.line, requires_category: true, availability: "/v1/seats/availability.json", checkout: { method: "POST", path: "/v1/agent/checkout" } };
  }
  const block = blockByKey(offer);
  if (block) {
    const c: Currency = currency ?? "usd";
    return { ok: true as const, offer: block.key, currency: c, amount: c === "cad" ? block.cad : block.usd, views_estimated: block.views, guaranteed: false, note: BLOCK_NOTE, request: { method: "POST", path: "/v1/seats/request" } };
  }
  const slot = slotOffers().find((s) => s.offer_key === offer);
  if (!slot) return { ok: false as const, error: `Unknown offer. Use one of: ${[...SEAT_SKUS.map((s) => s.sku), ...IMPRESSION_BLOCKS.map((b) => b.key), ...SLOT_LADDER.map((s) => s.key), "area-lock"].join(", ")}.` };
  const c: Currency = currency ?? "usd";
  return {
    ok: true as const,
    offer: slot.offer_key,
    currency: c,
    amount: slot.prices[c],
    media_credit: slot.media_credit[c],
    bonus_credit_pct: slot.bonus_credit_pct,
    modelled_hub_page_views: slot.modelled_hub_page_views,
    modelled: true,
    checkout: { method: "POST", path: "/v1/agent/checkout" },
  };
}

export function agentCard() {
  return {
    schema_version: "agent-card/0.1",
    name: "Birch Reserve ad buying",
    description: "Buy display and CPC inside co-branded health & wellness hubs. Machine catalog, quotes and Stripe-hosted checkout for AI buying agents.",
    url: SITE,
    provider: { organization: "Silver Birch Growth Inc.", url: SITE, email: HANDOFF_EMAIL },
    documentation: `${SITE}/ai-buyers`,
    openapi: `${SITE}/v1/agent/openapi.json`,
    llms: `${SITE}/llms.txt`,
    ucp: `${SITE}/.well-known/ucp`,
    authentication: { type: "none", note: "Public read endpoints. Checkout hands the buyer a Stripe-hosted page; no delegated payment." },
    capabilities: { streaming: false, payments: "stripe_hosted_checkout_handoff" },
    skills: [
      { id: "browse_inventory", name: "Browse inventory and offers", endpoint: "GET /v1/agent/catalog.json" },
      { id: "seat_availability", name: "Live category seat availability", endpoint: "GET /v1/seats/availability.json" },
      { id: "seat_request", name: "Hold, lock, waitlist or request an impression block", endpoint: "POST /v1/seats/request" },
      { id: "match_audience", name: "Score a brand's audience fit (modelled)", endpoint: "POST /v1/match" },
      { id: "quote", name: "Quote an offer", endpoint: "GET /v1/agent/quote" },
      { id: "checkout", name: "Open Stripe checkout or hold the request", endpoint: "POST /v1/agent/checkout" },
    ],
  };
}

export function agentOpenApi() {
  const offerEnum = [...SEAT_SKUS.map((s) => s.sku), ...IMPRESSION_BLOCKS.map((b) => b.key), ...SLOT_LADDER.map((s) => s.key), "area-lock"];
  const checkoutEnum = [...SEAT_SKUS.map((s) => s.sku), ...SLOT_LADDER.map((s) => s.key), "area-lock"];
  return {
    openapi: "3.1.0",
    info: { title: "Birch Reserve agent buying API", version: AGENT_CATALOG_VERSION, description: "Catalog, quote and checkout for AI buying agents. Audience figures are modelled. Checkout returns a Stripe-hosted URL when open, otherwise status held (saved, no charge).", contact: { email: HANDOFF_EMAIL } },
    servers: [{ url: SITE }],
    paths: {
      "/v1/agent/catalog.json": { get: { operationId: "getCatalog", summary: "Inventory, surfaces, offers and checkout status", responses: { "200": { description: "Catalog" } } } },
      "/v1/agent/quote": {
        get: {
          operationId: "getQuote",
          summary: "Quote one offer",
          parameters: [
            { name: "offer", in: "query", required: true, schema: { type: "string", enum: offerEnum } },
            { name: "currency", in: "query", schema: { type: "string", enum: ["usd", "cad"] } },
            { name: "postal", in: "query", description: "Required for area-lock. Canadian postal code or US ZIP.", schema: { type: "string" } },
            { name: "term", in: "query", description: "Area-lock months, 1-6.", schema: { type: "integer", minimum: 1, maximum: 6 } },
          ],
          responses: { "200": { description: "Quote" }, "400": { description: "Bad input" } },
        },
      },
      "/v1/agent/checkout": {
        post: {
          operationId: "createCheckout",
          summary: "Open Stripe-hosted checkout, or hold the request when checkout is closed",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["offer", "email", "agree"],
                  properties: {
                    offer: { type: "string", enum: checkoutEnum },
                    currency: { type: "string", enum: ["usd", "cad"] },
                    email: { type: "string", format: "email" },
                    brand: { type: "string", description: "Required for spend commits." },
                    business: { type: "string", description: "Required for area-lock." },
                    category: { type: "string", description: "Required for area-lock and for hold-190 / reserve-490 (category slug from /v1/seats/availability.json)." },
                    postal: { type: "string" },
                    term: { type: "integer", minimum: 1, maximum: 6 },
                    website: { type: "string" },
                    agent: { type: "string", description: "Name of the buying agent, for reporting." },
                    agree: { type: "boolean", const: true, description: "Buyer accepted the terms." },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "status open with a Stripe checkout url" }, "202": { description: "status held: saved, no charge, a person follows up" }, "400": { description: "Bad input" } },
        },
      },
      "/v1/seats/availability.json": { get: { operationId: "getSeatAvailability", summary: "Live category seat availability. open is null when it must be confirmed by phone.", responses: { "200": { description: "Availability" } } } },
      "/v1/seats/request": {
        post: {
          operationId: "requestSeat",
          summary: "Hold, lock, waitlist, lock request or impression-block request. Saved to the Birch pipeline and alerted to sales instantly.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["action", "brand", "email"], properties: { action: { type: "string", enum: ["hold", "lock", "waitlist", "lock_request", "block_request"] }, category: { type: "string", enum: SEAT_CATEGORIES.map((c) => c.slug) }, block: { type: "string", enum: IMPRESSION_BLOCKS.map((b) => b.key) }, brand: { type: "string" }, email: { type: "string", format: "email" }, name: { type: "string" }, phone: { type: "string" }, website: { type: "string" }, timing: { type: "string" }, message: { type: "string" }, currency: { type: "string", enum: ["usd", "cad"] } } } } } },
          responses: { "200": { description: "held (reserved by inquiry) or checkout_url when seat checkout is open" }, "400": { description: "Bad input" }, "429": { description: "Rate limited" } },
        },
      },
      "/v1/match": { post: { operationId: "matchAudience", summary: "Modelled audience match score for a URL + blurb", requestBody: { content: { "application/json": { schema: { type: "object", required: ["url"], properties: { url: { type: "string" }, blurb: { type: "string" }, email: { type: "string" } } } } } }, responses: { "200": { description: "Score, 3 reasons, recommended offer" } } } },
    },
  };
}
