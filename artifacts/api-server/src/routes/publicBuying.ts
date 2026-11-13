import { llmsTxt } from "../lib/overhaul/seo";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  databaseForClient,
  db,
  marketplacePlacementsTable,
  pool,
  splashAdReservationsTable,
  ucpAgentCheckoutIdempotencyTable,
  ucpAgentIdentityRotationsTable,
  ucpCheckoutIdempotencyAliasesTable,
  type WorkspaceDatabase,
} from "@workspace/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import type Stripe from "stripe";
import {
  cancelSplashReservation,
  claimSplashReserveSeat,
  getSplashSeatCounts,
  markSplashReservationPaidFromSession,
  SPLASH_RESERVE_HOLD_TTL_MS,
  stripeSessionMatchesReservation,
  type UcpLegacyPublicIdempotencyCandidate,
} from "../lib/splashReservationLifecycle";
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  isStripeSecretConfigured,
  retrieveStripeCheckoutSession,
} from "../lib/stripeClient";
import {
  CATALOG_LEGACY_OFFERS,
  DEFAULT_RESERVE_OFFER,
  getPayableReserveOffer,
  getPublicReserveOfferBySku,
  PUBLIC_RESERVE_OFFERS,
  RESERVE_CURRENCY,
  RESERVE_CURRENCIES,
  localizeReservePriceCopy,
  offerAmountCents,
  offerPriceLabel,
  offerScope,
  parseReserveCurrency,
  reserveCheckoutLineItem,
  type PublicReserveOffer,
  type ReserveCurrency,
} from "../lib/reserveOffers";
import { currencyCookieHeader, decideCurrency } from "../lib/currency";
import { isBonusDraftRequested, renderBonusTierDraftHtml } from "../lib/bonusTierDraft";
import {
  admitUcpProfileResolution,
  authenticateUcpAgentRequest,
  negotiateUcpAgent,
  verifyUcpIdentityContinuity,
} from "../lib/ucpNegotiation";
import {
  isUcpRequestId,
  UCP_CHECKOUT_CAPABILITY,
  UCP_CHECKOUT_SCHEMA_URL,
  UCP_CHECKOUT_SPEC_URL,
  UCP_OVERVIEW_SPEC_URL,
  UCP_SHOPPING_REST_SCHEMA_URL,
  UCP_SHOPPING_SERVICE,
  UCP_VERSION,
} from "../lib/ucpProtocol";
import {
  claimUcpAgentRequestProof,
  hasUcpAgentRequestProofBacklogWarning,
  scheduleExpiredUcpAgentRequestProofCleanup,
  UCP_PROOF_EXPIRED_BACKLOG_WARNING_THRESHOLD,
} from "../lib/ucpRequestProofs";
import {
  deliverReservationAlert,
  syncReservationUpdateToPipeline,
  syncReservationToPipeline,
} from "./splashAdReservations";
import { logger, recordUcpProxyForwardingShape } from "../lib/logger";
import { publicSeoTags } from "../lib/publicSeo";
import { PREPAY_REFUND_CUTOFF_DAYS } from "../lib/reserveOffers";
import { handleUiEvent } from "../lib/uiEvents";

const router: IRouter = Router();

const FORMATS = [
  "post_checkout",
  "recovery_plan",
  "scheduled_service",
  "member_hub",
  "motion_15s",
] as const;
const WINDOWS = [30, 90, 180] as const;
const EXCLUSIONS = ["no_phi", "no_clinical_pixels", "no_open_auction"] as const;

type CheckoutReceipt = {
  error?: string;
  checkout_url: string | null;
  order_id: string | null;
  reservationId: string | null;
  amountCents: number;
  currency: string;
};

function publicUrl(): string | null {
  const configured =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.SPLASH_AD_PUBLIC_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      return url.protocol === "https:" ? url.origin : null;
    } catch {
      return null;
    }
  }
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  return domain ? `https://${domain}` : null;
}

function checkoutConfigured(): boolean {
  return (
    process.env.STRIPE_CHECKOUT_DISABLED !== "true" &&
    publicUrl() !== null &&
    isStripeSecretConfigured()
  );
}

function isFormat(value: unknown): value is (typeof FORMATS)[number] {
  return typeof value === "string" && FORMATS.includes(value as never);
}

function isWindow(value: unknown): value is (typeof WINDOWS)[number] {
  const number = Number(value);
  return WINDOWS.includes(number as never);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validWebsite(value: string | undefined): boolean {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function lineItem(
  offer: PublicReserveOffer,
  currency: ReserveCurrency = RESERVE_CURRENCY,
): Stripe.Checkout.SessionCreateParams.LineItem {
  return reserveCheckoutLineItem(offer, currency);
}

function mappedStatus(row: typeof splashAdReservationsTable.$inferSelect):
  | "reserved"
  | "paid"
  | "creative_in"
  | "live"
  | "completed"
  | "recycled" {
  if (row.status === "completed") return "completed";
  if (row.status === "live") return "live";
  if (["recycled", "rejected", "expired"].includes(row.status)) return "recycled";
  if (row.paymentStatus === "paid" && row.creativeStatus !== "awaiting_upload" && row.creativeStatus !== "locked") {
    return "creative_in";
  }
  if (row.paymentStatus === "paid" || row.status === "paid") return "paid";
  return "reserved";
}

function orderView(row: typeof splashAdReservationsTable.$inferSelect) {
  const offer = getPayableReserveOffer(
    row.offerKey,
    row.amountCents,
    row.currency,
  );
  if (!offer) return null;
  return {
    order_id: row.id,
    reservationId: row.id,
    sku: offer.sku,
    offer_key: row.offerKey,
    offer_name: offer.name,
    offer_type: offer.offerType,
    status: mappedStatus(row),
    brand: row.brandName ?? "",
    format: isFormat(row.adInterest) ? row.adInterest : null,
    amountCents: row.amountCents,
    currency: row.currency,
    payment_status: row.paymentStatus === "paid" ? "paid" : "not_paid",
    paid_at: row.paidAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

function ucpMetadata() {
  return {
    version: UCP_VERSION,
    status: "success",
    capabilities: {
      [UCP_CHECKOUT_CAPABILITY]: [{ version: UCP_VERSION }],
    },
    payment_handlers: {},
  };
}

function ucpScopedIdempotencyKey(
  agentIdentityHash: string,
  idempotencyKey: string,
): string {
  return `ucp:${createHash("sha256")
    .update(`${agentIdentityHash}\n${idempotencyKey}`)
    .digest("hex")}`;
}

function canonicalUcpCheckoutId(value: string | undefined): string | null {
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value.toLowerCase();
}

type UcpLockClient = Parameters<typeof databaseForClient>[0];
function withUcpAdvisoryLock<T>(
  lockKey: string,
  operation: (database: WorkspaceDatabase) => Promise<T>,
): Promise<T> {
  return withUcpAdvisoryLocks([lockKey], operation);
}

function withUcpCheckoutAdvisoryLock<T>(
  checkoutId: string,
  operation: (database: WorkspaceDatabase) => Promise<T>,
): Promise<T> {
  return withUcpAdvisoryLock(checkoutId, operation);
}

function withUcpIdempotencyAdvisoryLock<T>(
  scopedIdempotencyKey: string,
  operation: (database: WorkspaceDatabase) => Promise<T>,
): Promise<T> {
  return withUcpAdvisoryLock(
    `ucp-idempotency:${scopedIdempotencyKey}`,
    operation,
  );
}

function withUcpCheckoutAndIdempotencyAdvisoryLock<T>(
  checkoutId: string,
  scopedIdempotencyKey: string,
  operation: (database: WorkspaceDatabase) => Promise<T>,
): Promise<T> {
  return withUcpAdvisoryLocks(
    [checkoutId, `ucp-idempotency:${scopedIdempotencyKey}`],
    operation,
  );
}
async function ensureUcpIdempotencyMapping(
  database: WorkspaceDatabase,
  input: {
    scopedIdempotencyKey: string;
    canonicalIdempotencyKey: string;
    reservationId: string;
    agentIdentityHash: string;
  },
): Promise<boolean> {
  await database
    .insert(ucpCheckoutIdempotencyAliasesTable)
    .values({
      idempotencyKey: input.scopedIdempotencyKey,
      canonicalIdempotencyKey: input.canonicalIdempotencyKey,
      reservationId: input.reservationId,
      agentIdentityHash: input.agentIdentityHash,
    })
    .onConflictDoNothing();
  const [mapping] = await database
    .select()
    .from(ucpCheckoutIdempotencyAliasesTable)
    .where(
      eq(
        ucpCheckoutIdempotencyAliasesTable.idempotencyKey,
        input.scopedIdempotencyKey,
      ),
    )
    .limit(1);
  return (
    mapping?.canonicalIdempotencyKey === input.canonicalIdempotencyKey &&
    mapping.reservationId === input.reservationId &&
    mapping.agentIdentityHash === input.agentIdentityHash
  );
}
export function buildUcpCheckoutView(
  row: typeof splashAdReservationsTable.$inferSelect,
) {
  const offer = getPayableReserveOffer(
    row.offerKey,
    row.amountCents,
    row.currency,
  );
  if (!offer || row.source !== "birch_reserve_v1_checkout") return null;
  const baseUrl = publicUrl();
  if (!baseUrl) return null;
  const status =
    row.paymentStatus === "paid"
      ? "completed"
      : ["recycled", "rejected", "expired"].includes(row.status)
        ? "canceled"
        : row.stripeCheckoutUrl
          ? "requires_escalation"
          : "incomplete";
  const total = { type: "total", amount: row.amountCents };
  const holdStartedAt = row.inventoryHeldAt ?? row.createdAt;
  return {
    ucp: ucpMetadata(),
    id: row.id,
    status,
    currency: row.currency.toUpperCase(),
    line_items: [
      {
        id: `li_${row.id}`,
        item: {
          id: offer.sku,
          title: `Birch Reserve — ${offer.name}`,
          price: row.amountCents,
        },
        quantity: 1,
        totals: [
          { type: "subtotal", amount: row.amountCents },
          total,
        ],
      },
    ],
    totals: [
      { type: "subtotal", amount: row.amountCents },
      total,
    ],
    ...(!["completed", "canceled"].includes(status)
      ? {
          expires_at: new Date(
            holdStartedAt.getTime() + SPLASH_RESERVE_HOLD_TTL_MS,
          ).toISOString(),
        }
      : {}),
    links: [
      {
        type: "faq",
        url: `${baseUrl}/buycalc?sku=${encodeURIComponent(offer.sku)}`,
        title: "Birch Reserve offer details",
      },
    ],
    ...(status === "requires_escalation"
      ? {
          continue_url: row.stripeCheckoutUrl,
          messages: [
            {
              type: "error",
              code: "buyer_input_required",
              content:
                "Continue to Stripe-hosted Checkout for buyer review and payment.",
              severity: "requires_buyer_input",
            },
          ],
        }
      : {}),
    ...(status === "completed"
      ? {
          order: {
            id: row.id,
            label: `Birch Reserve ${offer.name}`,
            permalink_url: `${baseUrl}/v1/orders/${row.id}`,
          },
        }
      : {}),
  };
}

async function sendCheckoutReceipt(
  res: Response,
  status: number,
  receipt: CheckoutReceipt,
  database: WorkspaceDatabase = db,
): Promise<void> {
  if (res.locals.ucpCheckout !== true) {
    res.status(status).json(receipt);
    return;
  }
  if (!receipt.order_id) {
    res.status(status).json({
      ucp: { version: UCP_VERSION, status: "error" },
      messages: [
        {
          type: "error",
          code: "unavailable",
          content: receipt.error ?? "Checkout is unavailable.",
          severity: "unrecoverable",
        },
      ],
    });
    return;
  }
  const authorizedAgentIdentityHashes = Array.isArray(
    res.locals.ucpAuthorizedAgentIdentityHashes,
  )
    ? (res.locals.ucpAuthorizedAgentIdentityHashes as string[])
    : typeof res.locals.ucpAgentIdentityHash === "string"
      ? [res.locals.ucpAgentIdentityHash]
      : [];
  const [row] = await database
    .select()
    .from(splashAdReservationsTable)
    .where(
      typeof res.locals.ucpAgentIdentityHash === "string"
        ? and(
            eq(splashAdReservationsTable.id, receipt.order_id),
            inArray(
              splashAdReservationsTable.ucpAgentIdentityHash,
              authorizedAgentIdentityHashes,
            ),
          )
        : eq(splashAdReservationsTable.id, receipt.order_id),
    )
    .limit(1);
  const view = row ? buildUcpCheckoutView(row) : null;
  if (!view) {
    if (typeof res.locals.ucpAgentIdentityHash === "string") {
      sendUcpCheckoutNotFound(res);
      return;
    }
    res.status(500).json({
      ucp: { version: UCP_VERSION, status: "error" },
      messages: [
        {
          type: "error",
          code: "unavailable",
          content: "The checkout session could not be represented.",
          severity: "unrecoverable",
        },
      ],
    });
    return;
  }
  res.status(status === 200 ? 201 : status).json({
    ...view,
    ...(receipt.error
      ? {
          messages: [
            ...("messages" in view && Array.isArray(view.messages)
              ? view.messages
              : []),
            {
              type: "error",
              code: "requires_buyer_input",
              content: receipt.error,
              severity: "recoverable",
            },
          ],
        }
      : {}),
  });
}

async function reserveCounts() {
  return getSplashSeatCounts();
}

const PUBLIC_BRAND_DESCRIPTION =
  "Prepay your category's display space across listed Scale Health hubs. One brand per category, no bidding. Fully refundable until 14 days before launch. Live hub: physio.drhonow.com. Your payment is display credit, not airfare.";

/** The eight site category slugs (same as Friday's seat feed and /kit). One brand per category. */
export const BUYCALC_CATEGORIES = [
  { slug: "pain-relief-topicals", label: "Pain relief / topicals" },
  { slug: "recovery-hardware", label: "Recovery hardware" },
  { slug: "nutrition", label: "Nutrition" },
  { slug: "sleep", label: "Sleep" },
  { slug: "meal-prep", label: "Meal prep" },
  { slug: "womens-health", label: "Women’s health" },
  { slug: "mens-health", label: "Men’s health" },
  { slug: "diagnostics-services", label: "Diagnostics / services" },
] as const;

// Registered on the API service (ahead of the static SPA rewrite) so Autoscale
// answers /oatmeal with a real 301 instead of index.html.
router.get("/oatmeal", (req, res) => {
  const query = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  res.redirect(301, `/buycalc${query}`);
});

// Same pattern as /oatmeal: Autoscale must answer /advertise with a real 301
// instead of the SPA index.html.
router.get("/advertise", (req, res) => {
  const query = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  res.redirect(301, `/buycalc${query}`);
});

// No separate ad-examples document. The home page already holds that section.
router.get("/ad-examples", (req, res) => {
  const query = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";
  res.redirect(301, `/${query}`);
});

router.post("/v1/ui-events", (req, res) => {
  void handleUiEvent(req, res);
});

router.get("/llms.txt", (_req, res) => {
  // Overhaul (Nov 12 2026): one plain-text map of the four paths, prices and machine endpoints.
  res.type("text/plain").send(
    [
      llmsTxt(),
      "",
      "## Legacy machine checkout (category seat)",
      "Prepay your category. Not an open auction.",
      "- hold-190 · $190 USD ($270 CAD for Canadian buyers) · 7-day category look · does not lock in a slot",
      "- reserve-490 · $490 USD ($690 CAD for Canadian buyers) · prepay your category · 100% display credit · fully refundable until 14 days before your launch date",
      `Machine catalog: /v1/catalog.json`,
      `Availability: /v1/availability.json`,
      `Quote: /v1/quote?sku=reserve-490&format=post_checkout&days=30`,
      `Checkout: POST /v1/checkout`,
      `UCP discovery: /.well-known/ucp`,
      `Formats: ${FORMATS.join(", ")}.`,
      `Human calculator: /buycalc`,
      "Contact: sales@silverbirchgrowth.com",
    ].join("\n"),
  );
});

router.get("/v1/catalog.json", (_req, res) => {
  res.json({
    catalog_version: "2026-09-24",
    currency: "USD",
    currencies: RESERVE_CURRENCIES.map((c) => c.toUpperCase()),
    currency_note: "amount_cents and due_today are USD. See prices for CAD. Pass currency=cad to /v1/quote and /v1/checkout to pay in CAD.",
    default_sku: DEFAULT_RESERVE_OFFER.sku,
    inventory_model: "shared_reserve_pool",
    offers: PUBLIC_RESERVE_OFFERS.map((offer) => ({
      offer_key: offer.offerKey,
      sku: offer.sku,
      name: offer.name,
      offer_type: offer.offerType,
      amount_cents: offer.amountCents,
      due_today: offer.dueTodayUsd,
      prices: priceTable(offer),
      media_credit_cents: offer.amountCents,
      scope: offer.scope,
      best_for: offer.bestFor,
      requires_insertion_order: true,
      guarantees_impressions: false,
      consumes_seat: offer.consumesSeat,
    })),
    legacy_offers: CATALOG_LEGACY_OFFERS.map((offer) => ({
      offer_key: offer.offerKey,
      sku: offer.sku,
      name: offer.name,
      published: false,
      amount_cents: offer.amountCents,
      due_today: offer.dueTodayUsd,
      note: "Unpublished legacy SKU. Existing Stripe Checkout sessions still match. Not offered for new public checkout.",
    })),
    discount_vs_published: 0.25,
    formats: FORMATS,
    category_slot: "early_slot",
    fulfillment: "coordinated_72h",
    reporting: "aggregate_only",
    checkout: "/v1/checkout",
    human: "/buycalc",
  });
});

/** Exact due-today price in every payable currency for one public SKU. */
function priceTable(offer: PublicReserveOffer) {
  return Object.fromEntries(
    RESERVE_CURRENCIES.map((c) => [
      c.toUpperCase(),
      {
        amount_cents: offerAmountCents(offer, c),
        due_today: offerAmountCents(offer, c) / 100,
        label: offerPriceLabel(offer, c),
      },
    ]),
  );
}

async function sendAvailabilityJson(
  req: Request,
  res: Response,
): Promise<void> {
  const decision = decideCurrency(req);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, x-vercel-ip-country");
  res.json({
    currency: decision.currency.toUpperCase(),
    currency_source: decision.source,
    currencies: RESERVE_CURRENCIES.map((c) => c.toUpperCase()),
    prices: Object.fromEntries(
      PUBLIC_RESERVE_OFFERS.map((offer) => [offer.sku, priceTable(offer)]),
    ),
    default_sku: DEFAULT_RESERVE_OFFER.sku,
    skus: PUBLIC_RESERVE_OFFERS.map((offer) => offer.sku),
    inventory_model: "shared_reserve_pool",
    ...(await reserveCounts()),
    window: "rolling",
    formats: FORMATS,
    formats_live: FORMATS,
    next_window: "rolling_30_90_180",
    checkout: "/v1/checkout",
    last_updated: new Date().toISOString(),
  });
}

// Public alias so /availability.json is JSON (not the SPA shell). Same payload as /v1.
router.get("/availability.json", async (req, res): Promise<void> => {
  await sendAvailabilityJson(req, res);
});

router.get("/v1/availability.json", async (req, res): Promise<void> => {
  await sendAvailabilityJson(req, res);
});

// Which currency this visitor sees. The site calls this once on load.
// Order: ?currency, then the br_currency cookie, then Canada -> CAD, else USD.
router.get("/api/currency", (req, res): void => {
  const decision = decideCurrency(req);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, x-vercel-ip-country");
  res.json({
    currency: decision.currency,
    country: decision.country,
    source: decision.source,
    prices: Object.fromEntries(
      PUBLIC_RESERVE_OFFERS.map((offer) => [
        offer.sku,
        Object.fromEntries(
          RESERVE_CURRENCIES.map((c) => [
            c,
            {
              amountCents: offerAmountCents(offer, c),
              dueToday: offerAmountCents(offer, c) / 100,
              label: offerPriceLabel(offer, c),
            },
          ]),
        ),
      ]),
    ),
  });
});

router.get("/v1/quote", async (req, res): Promise<void> => {
  const format = req.query.format;
  const days = req.query.days;
  const offer = getPublicReserveOfferBySku(req.query.sku);
  const quoteCurrency =
    req.query.currency === undefined
      ? decideCurrency(req).currency
      : parseReserveCurrency(req.query.currency);
  if (!offer || !isFormat(format) || !isWindow(days) || quoteCurrency === null) {
    res.status(400).json({ error: "A supported SKU, format, 30, 90, or 180 day window, and usd or cad currency are required." });
    return;
  }
  const quoteAmountCents = offerAmountCents(offer, quoteCurrency);
  res.json({
    sku: offer.sku,
    offerKey: offer.offerKey,
    offerName: offer.name,
    offerType: offer.offerType,
    format,
    days: Number(days),
    currency: quoteCurrency.toUpperCase(),
    amountCents: quoteAmountCents,
    dueTodayUsd: offer.dueTodayUsd,
    dueToday: quoteAmountCents / 100,
    mediaCreditCents: quoteAmountCents,
    scope: offerScope(offer, quoteCurrency),
    discount: 0.25,
    categoryLock: true,
    coordinated72h: true,
    aggregateOnly: true,
    requiresInsertionOrder: true,
    guaranteesImpressions: false,
    exclusions: EXCLUSIONS,
    checkoutPath: "/v1/checkout",
  });
});

async function handleMachineCheckout(
  req: Request,
  res: Response,
  database: WorkspaceDatabase = db,
): Promise<void> {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    await sendCheckoutReceipt(res, 400, {
      error: "Invalid checkout request.",
      checkout_url: null,
      order_id: null,
      reservationId: null,
      amountCents: 0,
      currency: RESERVE_CURRENCY,
    }, database);
    return;
  }
  const body = req.body as Record<string, unknown>;
  const allowedKeys = new Set([
    "sku",
    "email",
    "brand",
    "website_url",
    "format_pref",
    "idempotency_key",
    "currency",
    "category",
  ]);
  const offer = getPublicReserveOfferBySku(body.sku);
  // Optional category slug from the /buycalc form. It rides on the promoted offer name.
  const category =
    body.category === undefined
      ? undefined
      : BUYCALC_CATEGORIES.find((c) => c.slug === body.category);
  // Omitted currency: geo default (x-vercel-ip-country CA -> CAD, else USD). An explicit
  // currency always wins; an unsupported explicit value still falls back to USD (and is
  // rejected below as invalid input).
  const requestedCurrency =
    body.currency === undefined ? decideCurrency(req).currency : parseReserveCurrency(body.currency);
  const currency: ReserveCurrency = requestedCurrency ?? RESERVE_CURRENCY;
  const amountCents = offer ? offerAmountCents(offer, currency) : 0;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const website = typeof body.website_url === "string" ? body.website_url.trim() : undefined;
  const format = body.format_pref;
  const idempotencyKey =
    typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  const ucpAgentIdentityHash =
    typeof res.locals.ucpAgentIdentityHash === "string"
      ? res.locals.ucpAgentIdentityHash
      : null;
  if (
    !offer ||
    requestedCurrency === null ||
    !validEmail(email) ||
    brand.length < 1 ||
    brand.length > 160 ||
    !validWebsite(website) ||
    (format !== undefined && !isFormat(format)) ||
    (body.category !== undefined && !category) ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 200 ||
    (!ucpAgentIdentityHash && idempotencyKey.toLowerCase().startsWith("ucp:")) ||
    Object.keys(body).some((key) => !allowedKeys.has(key))
  ) {
    await sendCheckoutReceipt(res, 400, {
      error: "Invalid checkout request.",
      checkout_url: null,
      order_id: null,
      reservationId: null,
      amountCents,
      currency,
    }, database);
    return;
  }

  const authorizedAgentIdentityHashes = Array.isArray(
    res.locals.ucpAuthorizedAgentIdentityHashes,
  )
    ? (res.locals.ucpAuthorizedAgentIdentityHashes as string[])
    : ucpAgentIdentityHash
      ? [ucpAgentIdentityHash]
      : [];
  const idempotencyKeyHash =
    typeof res.locals.ucpIdempotencyKeyHash === "string"
      ? res.locals.ucpIdempotencyKeyHash
      : null;
  const legacyPublicIdempotencyKeys = Array.isArray(
    res.locals.ucpLegacyPublicIdempotencyKeys,
  )
    ? (res.locals
        .ucpLegacyPublicIdempotencyKeys as UcpLegacyPublicIdempotencyCandidate[])
    : [];
  const claim = await claimSplashReserveSeat({
      brandName: brand,
      email,
      websiteUrl: website || null,
      adInterest: isFormat(format) ? format : "post_checkout",
      promotedOffer: `Birch Reserve ${offer.name}${category ? ` · ${category.label}` : ""}`,
      status: "seat_held",
      offerKey: offer.offerKey,
      amountCents,
      currency,
      source: "birch_reserve_v1_checkout",
      followUpBy: new Date(),
      sheetSyncStatus: "pending",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      publicIdempotencyKey: idempotencyKey,
      publicRequestFingerprint:
        typeof res.locals.ucpRequestFingerprint === "string"
          ? res.locals.ucpRequestFingerprint
          : null,
      ucpAgentIdentityHash:
        typeof res.locals.ucpAgentIdentityHash === "string"
          ? res.locals.ucpAgentIdentityHash
          : null,
      ucpAgentProfileUrl:
        typeof res.locals.ucpAgentProfileUrl === "string"
          ? res.locals.ucpAgentProfileUrl
          : null,
      ucpAgentPublicKey:
        res.locals.ucpAgentPublicKey &&
        typeof res.locals.ucpAgentPublicKey === "object"
          ? (res.locals.ucpAgentPublicKey as Record<string, unknown>)
          : null,
    },
    database,
    ucpAgentIdentityHash && idempotencyKeyHash
      ? {
          agentIdentityHash: ucpAgentIdentityHash,
          authorizedAgentIdentityHashes,
          idempotencyKeyHash,
          legacyPublicIdempotencyKeys,
        }
      : undefined,
  );
  let reservation = claim.reservation;
  if (!reservation) {
    await sendCheckoutReceipt(res, 409, {
      error: "Birch Reserve is sold out. No reservation was created.",
      checkout_url: null,
      order_id: null,
      reservationId: null,
      amountCents,
      currency,
    }, database);
    return;
  }
  if (
    !claim.created &&
    reservation.ucpAgentIdentityHash !== null &&
    !authorizedAgentIdentityHashes.includes(
      reservation.ucpAgentIdentityHash,
    )
  ) {
    if (ucpAgentIdentityHash) {
      sendUcpCheckoutNotFound(res);
    } else {
      await sendCheckoutReceipt(res, 409, {
        error: "This idempotency key is unavailable.",
        checkout_url: null,
        order_id: null,
        reservationId: null,
        amountCents,
        currency,
      }, database);
    }
    return;
  }
  if (
    !claim.created &&
    ucpAgentIdentityHash &&
    reservation.ucpAgentIdentityHash === null
  ) {
    const ucpAgentProfileUrl =
      typeof res.locals.ucpAgentProfileUrl === "string"
        ? res.locals.ucpAgentProfileUrl
        : null;
    const ucpAgentPublicKey =
      res.locals.ucpAgentPublicKey &&
      typeof res.locals.ucpAgentPublicKey === "object"
        ? (res.locals.ucpAgentPublicKey as Record<string, unknown>)
        : null;
    const [boundReservation] = await database
      .update(splashAdReservationsTable)
      .set({
        ucpAgentIdentityHash,
        ucpAgentProfileUrl,
        ucpAgentPublicKey,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, reservation.id),
          eq(
            splashAdReservationsTable.publicIdempotencyKey,
            idempotencyKey,
          ),
          isNull(splashAdReservationsTable.ucpAgentIdentityHash),
        ),
      )
      .returning();
    if (boundReservation) reservation = boundReservation;
  }
  const scopedUcpIdempotencyKey =
    typeof res.locals.ucpScopedIdempotencyKey === "string"
      ? res.locals.ucpScopedIdempotencyKey
      : null;
  if (
    ucpAgentIdentityHash &&
    scopedUcpIdempotencyKey &&
    reservation.publicIdempotencyKey &&
    !(await ensureUcpIdempotencyMapping(database, {
      scopedIdempotencyKey: scopedUcpIdempotencyKey,
      canonicalIdempotencyKey: reservation.publicIdempotencyKey,
      reservationId: reservation.id,
      agentIdentityHash: ucpAgentIdentityHash,
    }))
  ) {
    sendUcpCheckoutNotFound(res);
    return;
  }
  const ucpRequestFingerprint =
    typeof res.locals.ucpRequestFingerprint === "string"
      ? res.locals.ucpRequestFingerprint
      : null;
  const mismatchedRequest = ucpRequestFingerprint
    ? reservation.publicRequestFingerprint !== ucpRequestFingerprint
    : reservation.email !== email ||
      reservation.brandName !== brand ||
      reservation.websiteUrl !== (website || null) ||
      reservation.adInterest !== (isFormat(format) ? format : "post_checkout") ||
      reservation.offerKey !== offer.offerKey ||
      reservation.amountCents !== amountCents ||
      reservation.currency !== currency;
  if (mismatchedRequest) {
    await sendCheckoutReceipt(res, 409, {
      error: "This idempotency key was used for a different checkout request.",
      checkout_url: null,
      order_id: null,
      reservationId: null,
      amountCents,
      currency,
    }, database);
    return;
  }

  if (claim.created) {
    if (process.env.SPLASH_RESERVE_ALERTS_DISABLED !== "true") {
      void deliverReservationAlert(reservation, {
        onError: (alertDeliveryError) =>
          req.log.warn({ reservationId: reservation.id, alertDeliveryError }, "Saved v1 checkout hold but Slack delivery failed"),
      });
    }
    void syncReservationToPipeline(reservation, {
      onError: (sheetSyncError) =>
        req.log.warn({ reservationId: reservation.id, sheetSyncError }, "Saved v1 checkout hold but pipeline sync failed"),
    });
  }

  const receipt = {
    checkout_url: null,
    order_id: reservation.id,
    reservationId: reservation.id,
    amountCents,
    currency,
  };
  if (reservation.paymentStatus === "paid") {
    await sendCheckoutReceipt(res, 200, receipt, database);
    return;
  }
  if (reservation.stripeCheckoutUrl && reservation.paymentStatus === "checkout_created") {
    await sendCheckoutReceipt(res, 200, {
      ...receipt,
      checkout_url: reservation.stripeCheckoutUrl,
    }, database);
    return;
  }
  if (!checkoutConfigured()) {
    await sendCheckoutReceipt(res, 503, {
      error: "Reservation saved, but secure payment is not configured.",
      ...receipt,
    }, database);
    return;
  }
  if (reservation.paymentStatus === "checkout_creating") {
    await sendCheckoutReceipt(res, 409, {
      error: "Reservation saved; secure checkout is being prepared.",
      ...receipt,
    }, database);
    return;
  }

  const nextAttempt = reservation.checkoutAttempt + 1;
  const baseUrl = publicUrl();
  if (!baseUrl) {
    await sendCheckoutReceipt(res, 503, {
      error: "Secure payment is not configured.",
      ...receipt,
    }, database);
    return;
  }
  const checkoutRequest: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    client_reference_id: reservation.id,
    customer_email:
      res.locals.ucpAnonymousBuyer === true ? undefined : reservation.email,
    line_items: [lineItem(offer, currency)],
    metadata: {
      reservationId: reservation.id,
      offerKey: offer.offerKey,
      sku: offer.sku,
      checkoutAttempt: String(nextAttempt),
    },
    payment_intent_data: {
      metadata: {
        reservationId: reservation.id,
        offerKey: offer.offerKey,
        sku: offer.sku,
        checkoutAttempt: String(nextAttempt),
      },
    },
    success_url: `${baseUrl}/success?order=${reservation.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/buycalc?checkout=cancelled`,
    allow_promotion_codes: false,
  };
  const checkoutIdempotencyKey = `birch-reserve-v1:${reservation.id}:${nextAttempt}`;
  const checkoutAttemptStartedAt = new Date();
  const [claimed] = await database
    .update(splashAdReservationsTable)
    .set({
      status: "payment_pending",
      paymentStatus: "checkout_creating",
      checkoutAttempt: nextAttempt,
      checkoutRequest,
      checkoutIdempotencyKey,
      checkoutAttemptStartedAt,
      checkoutRecoveryError: null,
      stripeCheckoutSessionId: null,
      stripeCheckoutUrl: null,
    })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservation.id),
        eq(splashAdReservationsTable.status, "seat_held"),
        inArray(splashAdReservationsTable.paymentStatus, ["unpaid", "failed"]),
        eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
        ...(ucpAgentIdentityHash
          ? [
              inArray(
                splashAdReservationsTable.ucpAgentIdentityHash,
                authorizedAgentIdentityHashes,
              ),
            ]
          : []),
      ),
    )
    .returning();
  if (!claimed) {
    await sendCheckoutReceipt(res, 409, {
      error: "Reservation state changed; retry with the same idempotency key.",
      ...receipt,
    }, database);
    return;
  }

  let createdSession: Stripe.Checkout.Session | undefined;
  let checkoutAttached = false;
  try {
    const session = await createStripeCheckoutSession(
      checkoutRequest,
      checkoutIdempotencyKey,
    );
    createdSession = session;
    if (
      !session.url ||
      !stripeSessionMatchesReservation(session, claimed)
    ) {
      throw new Error("Stripe returned a checkout session that does not match the selected offer.");
    }
    const [attached] = await database
      .update(splashAdReservationsTable)
      .set({
        paymentStatus: "checkout_created",
        stripeCheckoutSessionId: session.id,
        stripeCheckoutUrl: session.url,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, claimed.id),
          eq(splashAdReservationsTable.status, "payment_pending"),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          eq(splashAdReservationsTable.checkoutAttempt, nextAttempt),
          ...(ucpAgentIdentityHash
            ? [
                inArray(
                  splashAdReservationsTable.ucpAgentIdentityHash,
                  authorizedAgentIdentityHashes,
                ),
              ]
            : []),
        ),
      )
      .returning();
    if (!attached) throw new Error("Unable to attach Stripe checkout to its reservation.");
    checkoutAttached = true;
    await sendCheckoutReceipt(
      res,
      200,
      { ...receipt, checkout_url: session.url },
      database,
    );
  } catch (error) {
    req.log.error({ err: error, reservationId: claimed.id }, "v1 checkout unavailable; hold remains saved");
    if (createdSession && !checkoutAttached) {
      let expired = false;
      try {
        await expireStripeCheckoutSession(createdSession.id);
        expired = true;
      } catch (expireError) {
        req.log.warn(
          { err: expireError, reservationId: claimed.id, sessionId: createdSession.id },
          "Unable to expire unattached v1 checkout session",
        );
      }
      await database
        .update(splashAdReservationsTable)
        .set(
          expired
            ? {
                status: "seat_held",
                paymentStatus: "failed",
                stripeCheckoutSessionId: null,
                stripeCheckoutUrl: null,
              }
            : {
                paymentStatus: "checkout_created",
                stripeCheckoutSessionId: createdSession.id,
                stripeCheckoutUrl: createdSession.url,
              },
        )
        .where(
          and(
            eq(splashAdReservationsTable.id, claimed.id),
            eq(splashAdReservationsTable.status, "payment_pending"),
            eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            eq(splashAdReservationsTable.checkoutAttempt, nextAttempt),
            ...(ucpAgentIdentityHash
              ? [
                  inArray(
                    splashAdReservationsTable.ucpAgentIdentityHash,
                    authorizedAgentIdentityHashes,
                  ),
                ]
              : []),
          ),
        );
    } else if (!checkoutAttached) {
      await database
        .update(splashAdReservationsTable)
        .set({ lifecycleReason: "checkout_reconciliation_required" })
        .where(
          and(
            eq(splashAdReservationsTable.id, claimed.id),
            eq(splashAdReservationsTable.status, "payment_pending"),
            eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            eq(splashAdReservationsTable.checkoutAttempt, nextAttempt),
            ...(ucpAgentIdentityHash
              ? [
                  inArray(
                    splashAdReservationsTable.ucpAgentIdentityHash,
                    authorizedAgentIdentityHashes,
                  ),
                ]
              : []),
          ),
        );
    }
    await sendCheckoutReceipt(res, 503, {
      error: "Reservation saved, but secure checkout is unavailable.",
      ...receipt,
    }, database);
  }
}

router.post("/v1/checkout", (req, res) => handleMachineCheckout(req, res));

export function buildUcpBusinessProfile(baseUrl: string) {
  return {
    ucp: {
      version: UCP_VERSION,
      services: {
        [UCP_SHOPPING_SERVICE]: [
          {
            version: UCP_VERSION,
            spec: UCP_OVERVIEW_SPEC_URL,
            transport: "rest",
            schema: UCP_SHOPPING_REST_SCHEMA_URL,
            endpoint: `${baseUrl}/ucp/v1`,
          },
        ],
      },
      capabilities: {
        [UCP_CHECKOUT_CAPABILITY]: [
          {
            version: UCP_VERSION,
            spec: UCP_CHECKOUT_SPEC_URL,
            schema: UCP_CHECKOUT_SCHEMA_URL,
          },
        ],
      },
      payment_handlers: {},
    },
  };
}

router.get("/.well-known/ucp", (_req, res) => {
  const baseUrl = publicUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "UCP discovery is not configured." });
    return;
  }
  res.set("Cache-Control", "public, max-age=300");
  res.json(buildUcpBusinessProfile(baseUrl));
});

router.use(
  "/ucp/v1",
  async (req, res, next: NextFunction): Promise<void> => {
    recordUcpProxyForwardingShape(req.log, req.get("x-forwarded-for"));
    if (
      !(await admitUcpProfileResolution(
        req.get("ucp-agent"),
        req.ip || req.socket.remoteAddress || "unknown",
      ))
    ) {
      res.set("Retry-After", "1").status(429).json({
        ucp: { version: UCP_VERSION, status: "error" },
        messages: [
          {
            type: "error",
            code: "rate_limited",
            content: "Too many new agent profiles. Retry shortly.",
            severity: "recoverable",
          },
        ],
      });
      return;
    }
    const negotiation = await negotiateUcpAgent(req.get("ucp-agent"));
    if (negotiation.ok) {
    const rawBody = (
      req as Request & {
        ucpRawBody?: Buffer;
      }
    ).ucpRawBody;
      const authentication = authenticateUcpAgentRequest({
        method: req.method,
        target: req.originalUrl,
        profileUrl: negotiation.profileUrl,
        keyId: negotiation.keyId,
        publicKeyJwk: negotiation.publicKeyJwk,
        timestampHeader: req.get("ucp-agent-timestamp"),
        signatureHeader: req.get("ucp-agent-signature"),
        nonceHeader: req.get("ucp-agent-nonce"),
        idempotencyKey: req.get("idempotency-key"),
        body: rawBody,
      });
      if (!authentication.ok) {
        sendUcpCheckoutNotFound(res);
        return;
      }
      if (!isUcpRequestId(req.get("request-id"))) {
        res.status(400).json({
          ucp: { version: UCP_VERSION, status: "error" },
          messages: [
            {
              type: "error",
              code: "invalid_header",
              content: "Request-Id must be a UUID.",
              severity: "unrecoverable",
            },
          ],
        });
        return;
      }
      let claimedProof = false;
      try {
        claimedProof = await claimUcpAgentRequestProof({
          agentIdentityHash: negotiation.agentIdentityHash,
          nonceHash: authentication.nonceHash,
          expiresAt: authentication.validUntil,
        });
      } catch (error) {
        req.log.warn(
          { err: error },
          "Unable to durably claim UCP agent request proof",
        );
        res.status(503).json({
          ucp: { version: UCP_VERSION, status: "error" },
          messages: [
            {
              type: "error",
              code: "unavailable",
              content: "Agent authentication is temporarily unavailable.",
              severity: "recoverable",
            },
          ],
        });
        return;
      }
      if (!claimedProof) {
        sendUcpCheckoutNotFound(res);
        return;
      }
      void scheduleExpiredUcpAgentRequestProofCleanup()
        ?.then((maintenance) => {
          req.log.info(
            {
              deletedRows: maintenance.deletedRows,
              ...(maintenance.backlog ?? {}),
            },
            "UCP agent request proof cleanup completed",
          );
          if (maintenance.backlogMeasurementError) {
            req.log.warn(
              { err: maintenance.backlogMeasurementError },
              "Unable to measure UCP agent request proof backlog",
            );
          } else if (
            maintenance.backlog &&
            hasUcpAgentRequestProofBacklogWarning(maintenance.backlog)
          ) {
            req.log.warn(
              {
                ...maintenance.backlog,
                deletedRows: maintenance.deletedRows,
                warningThreshold:
                  UCP_PROOF_EXPIRED_BACKLOG_WARNING_THRESHOLD,
                cleanupBatchSize: UCP_PROOF_EXPIRED_BACKLOG_WARNING_THRESHOLD,
                troubleshooting:
                  "Expired proofs remain after bounded cleanup. Check cleanup failures and worker traffic; sustained growth means cleanup capacity is below proof expiry volume.",
              },
              "Expired UCP agent request proof backlog exceeds cleanup capacity",
            );
          }
        })
        .catch((error) => {
          req.log.warn(
            { err: error, deletedRows: 0 },
            "Unable to clean up expired UCP agent request proofs",
          );
        });
      res.locals.ucpAgentProfileUrl = negotiation.profileUrl;
      res.locals.ucpAgentIdentityHash = negotiation.agentIdentityHash;
      res.locals.ucpAuthorizedAgentIdentityHashes =
        negotiation.authorizedAgentIdentityHashes;
      res.locals.ucpAgentPublicKey = negotiation.identityPublicKey;
      next();
      return;
    }
    res.status(negotiation.status).json({
      ucp: { version: UCP_VERSION, status: "error" },
      messages: [
        {
          type: "error",
          code: negotiation.code,
          content: negotiation.content,
          severity: "unrecoverable",
        },
      ],
    });
  },
);

router.post(
  "/ucp/v1/checkout-sessions",
  async (req, res): Promise<void> => {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : null;
    const lines = Array.isArray(body?.line_items) ? body.line_items : [];
    const line =
      lines.length === 1 &&
      lines[0] &&
      typeof lines[0] === "object" &&
      !Array.isArray(lines[0])
        ? (lines[0] as Record<string, unknown>)
        : null;
    const item =
      line?.item && typeof line.item === "object" && !Array.isArray(line.item)
        ? (line.item as Record<string, unknown>)
        : null;
    const buyer =
      body?.buyer && typeof body.buyer === "object" && !Array.isArray(body.buyer)
        ? (body.buyer as Record<string, unknown>)
        : null;
    const context =
      body?.context && typeof body.context === "object" && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : null;
    const suppliedIdempotencyKey = req.get("idempotency-key")?.trim() ?? "";
    const idempotencyKey =
      suppliedIdempotencyKey ||
      (typeof body?.idempotency_key === "string"
        ? body.idempotency_key.trim()
        : "") ||
      randomUUID();
    const agentIdentityHash = String(res.locals.ucpAgentIdentityHash);

    const agentProfileUrl = String(res.locals.ucpAgentProfileUrl);
    const authorizedIdentityHashes = Array.isArray(
      res.locals.ucpAuthorizedAgentIdentityHashes,
    )
      ? (res.locals.ucpAuthorizedAgentIdentityHashes as string[])
      : [agentIdentityHash];
    const legacyPublicIdempotencyKeys: UcpLegacyPublicIdempotencyCandidate[] =
      [
        {
          agentIdentityHash,
          publicIdempotencyKey: ucpScopedIdempotencyKey(
            agentProfileUrl,
            idempotencyKey,
          ),
          storedAgentIdentityHash: createHash("sha256")
            .update(agentProfileUrl)
            .digest("hex"),
          legacyProfileUrl: agentProfileUrl,
        },
        ...authorizedIdentityHashes.map((identityHash) => ({
          agentIdentityHash: identityHash,
          publicIdempotencyKey: ucpScopedIdempotencyKey(
            identityHash,
            idempotencyKey,
          ),
        })),
      ];
    const scopedIdempotencyKey = ucpScopedIdempotencyKey(
      agentIdentityHash,
      idempotencyKey,
    );
    const rawBody = (
      req as Request & {
        ucpRawBody?: Buffer;
      }
    ).ucpRawBody;
    const requestFingerprint = createHash("sha256")
      .update(rawBody ?? Buffer.from(JSON.stringify(body)))
      .digest("hex");
    const buyerName = [buyer?.first_name, buyer?.last_name]
      .filter(
        (part): part is string =>
          typeof part === "string" && part.trim().length > 0,
      )
      .join(" ")
      .trim();
    const brand =
      typeof context?.brand === "string" && context.brand.trim()
        ? context.brand
        : buyerName || "UCP buyer";
    const email = typeof buyer?.email === "string" ? buyer.email : "";
    const anonymousEmail = `ucp-${createHash("sha256")
      .update(idempotencyKey)
      .digest("hex")
      .slice(0, 24)}@buyer.invalid`;
    if (
      !body ||
      !line ||
      !item ||
      line.quantity !== 1 ||
      !getPublicReserveOfferBySku(item.id) ||
      (suppliedIdempotencyKey.length > 0 &&
        (suppliedIdempotencyKey.length < 22 ||
          suppliedIdempotencyKey.length > 200))
    ) {
      res.status(400).json({
        ucp: { version: UCP_VERSION, status: "error" },
        messages: [
          {
            type: "error",
            code: "invalid",
            content: "Exactly one canonical Birch Reserve SKU with quantity one is required.",
            severity: "recoverable",
          },
        ],
      });
      return;
    }
    res.set("Idempotency-Key", idempotencyKey);
    res.locals.ucpCheckout = true;
    res.locals.ucpAnonymousBuyer = email.length === 0;
    res.locals.ucpRequestFingerprint = requestFingerprint;
    res.locals.ucpIdempotencyKeyHash = createHash("sha256")
      .update(idempotencyKey)
      .digest("hex");
    res.locals.ucpLegacyPublicIdempotencyKeys =
      legacyPublicIdempotencyKeys;
    const machineCheckoutBody = {
      sku: item.id,
      email: email || anonymousEmail,
      brand,
      ...(typeof context?.website_url === "string"
        ? { website_url: context.website_url }
        : {}),
      ...(typeof context?.format_pref === "string"
        ? { format_pref: context.format_pref }
        : {}),
    };
    try {
      await withUcpIdempotencyAdvisoryLock(
        scopedIdempotencyKey,
        async (database) => {
          const [idempotencyAlias] = await database
            .select({
              canonicalIdempotencyKey:
                ucpCheckoutIdempotencyAliasesTable.canonicalIdempotencyKey,
            })
            .from(ucpCheckoutIdempotencyAliasesTable)
            .where(
              and(
                eq(
                  ucpCheckoutIdempotencyAliasesTable.idempotencyKey,
                  scopedIdempotencyKey,
                ),
                eq(
                  ucpCheckoutIdempotencyAliasesTable.agentIdentityHash,
                  agentIdentityHash,
                ),
              ),
            )
            .limit(1);
          res.locals.ucpScopedIdempotencyKey = scopedIdempotencyKey;
          req.body = {
            ...machineCheckoutBody,
            idempotency_key:
              idempotencyAlias?.canonicalIdempotencyKey ??
              scopedIdempotencyKey,
          };
          await handleMachineCheckout(req, res, database);
        },
      );
    } catch (error) {
      req.log.warn(
        { err: error },
        "UCP checkout idempotency lock was unavailable",
      );
      if (!res.headersSent) {
        res.status(503).json({
          ucp: { version: UCP_VERSION, status: "error" },
          messages: [
            {
              type: "error",
              code: "unavailable",
              content: "Checkout is temporarily unavailable.",
              severity: "recoverable",
            },
          ],
        });
      }
    }
  },
);

router.get("/ucp/v1/checkout-sessions/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = canonicalUcpCheckoutId(rawId);
  const agentIdentityHash = String(res.locals.ucpAgentIdentityHash);
  const authorizedIdentityHashes = Array.isArray(
    res.locals.ucpAuthorizedAgentIdentityHashes,
  )
    ? (res.locals.ucpAuthorizedAgentIdentityHashes as string[])
    : [agentIdentityHash];
  const [row] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(
      and(
        eq(splashAdReservationsTable.id, id ?? ""),
        inArray(
          splashAdReservationsTable.ucpAgentIdentityHash,
          authorizedIdentityHashes,
        ),
      ),
    )
    .limit(1);
  const view = row ? buildUcpCheckoutView(row) : null;
  if (!view) {
    sendUcpCheckoutNotFound(res);
    return;
  }
  res.json(view);
});

function sendUcpCheckoutNotFound(res: Response): void {
  res.status(404).json({
    ucp: { version: UCP_VERSION, status: "error" },
    messages: [
      {
        type: "error",
        code: "not_found",
        content: "Checkout session not found.",
        severity: "unrecoverable",
      },
    ],
  });
}

router.post(
  "/ucp/v1/checkout-sessions/:id/identity-rotations",
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = canonicalUcpCheckoutId(rawId);
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : null;
    const previousProfileUrl =
      typeof body?.previous_profile === "string"
        ? body.previous_profile.trim()
        : "";
    const idempotencyKey =
      typeof body?.idempotency_key === "string"
        ? body.idempotency_key.trim()
        : "";
    const replacementProfileUrl = String(res.locals.ucpAgentProfileUrl);
    const replacementIdentityHash = String(res.locals.ucpAgentIdentityHash);
    const replacementPublicKey =
      res.locals.ucpAgentPublicKey &&
      typeof res.locals.ucpAgentPublicKey === "object"
        ? (res.locals.ucpAgentPublicKey as Record<string, unknown>)
        : null;
    if (
      !id ||
      !previousProfileUrl ||
      previousProfileUrl === replacementProfileUrl ||
      idempotencyKey.length < 22 ||
      idempotencyKey.length > 200 ||
      !replacementPublicKey ||
      Object.keys(body ?? {}).some(
        (key) => !["previous_profile", "idempotency_key"].includes(key),
      )
    ) {
      sendUcpCheckoutNotFound(res);
      return;
    }

    const [checkout] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(
        and(
          eq(splashAdReservationsTable.id, id),
          eq(
            splashAdReservationsTable.ucpAgentProfileUrl,
            previousProfileUrl,
          ),
          inArray(splashAdReservationsTable.status, [
            "seat_held",
            "payment_pending",
          ]),
          inArray(splashAdReservationsTable.paymentStatus, [
            "unpaid",
            "failed",
            "checkout_created",
          ]),
        ),
      )
      .limit(1);
    const continuity = checkout
      ? verifyUcpIdentityContinuity({
          authorization: req.get("ucp-identity-continuity"),
          checkoutId: id,
          previousProfileUrl,
          replacementProfileUrl,
          previousPublicKey: checkout.ucpAgentPublicKey,
        })
      : null;
    if (!checkout || !continuity || !checkout.ucpAgentIdentityHash) {
      sendUcpCheckoutNotFound(res);
      return;
    }
    const previousIdentityHash = checkout.ucpAgentIdentityHash;
    const previousScopedIdempotencyKey = ucpScopedIdempotencyKey(
      previousIdentityHash,
      idempotencyKey,
    );
    const [previousAlias] =
      checkout.publicIdempotencyKey === previousScopedIdempotencyKey
        ? [true]
        : await db
            .select({ exists: ucpCheckoutIdempotencyAliasesTable.idempotencyKey })
            .from(ucpCheckoutIdempotencyAliasesTable)
            .where(
              and(
                eq(
                  ucpCheckoutIdempotencyAliasesTable.idempotencyKey,
                  previousScopedIdempotencyKey,
                ),
                eq(
                  ucpCheckoutIdempotencyAliasesTable.reservationId,
                  checkout.id,
                ),
                eq(
                  ucpCheckoutIdempotencyAliasesTable.agentIdentityHash,
                  previousIdentityHash,
                ),
              ),
            )
            .limit(1);
    const canonicalIdempotencyKey = checkout.publicIdempotencyKey;
    if (!previousAlias || !canonicalIdempotencyKey) {
      sendUcpCheckoutNotFound(res);
      return;
    }
    const replacementScopedIdempotencyKey = ucpScopedIdempotencyKey(
      replacementIdentityHash,
      idempotencyKey,
    );
    const idempotencyKeyHash = createHash("sha256")
      .update(idempotencyKey)
      .digest("hex");

    try {
      const rotated = await withUcpCheckoutAndIdempotencyAdvisoryLock(
        id,
        replacementScopedIdempotencyKey,
        (database) =>
          database.transaction(async (tx) => {
              const [canonicalCollision] = await tx
                .select({
                  id: splashAdReservationsTable.id,
                })
                .from(splashAdReservationsTable)
                .where(
                  eq(
                    splashAdReservationsTable.publicIdempotencyKey,
                    replacementScopedIdempotencyKey,
                  ),
                )
                .limit(1);
              const [aliasCollision] = await tx
                .select()
                .from(ucpCheckoutIdempotencyAliasesTable)
                .where(
                  eq(
                    ucpCheckoutIdempotencyAliasesTable.idempotencyKey,
                    replacementScopedIdempotencyKey,
                  ),
                )
                .limit(1);
              const [signingKeyCollision] = await tx
                .select({
                  reservationId:
                    ucpAgentCheckoutIdempotencyTable.reservationId,
                })
                .from(ucpAgentCheckoutIdempotencyTable)
                .where(
                  and(
                    eq(
                      ucpAgentCheckoutIdempotencyTable.agentIdentityHash,
                      replacementIdentityHash,
                    ),
                    eq(
                      ucpAgentCheckoutIdempotencyTable.idempotencyKeyHash,
                      idempotencyKeyHash,
                    ),
                  ),
                )
                .limit(1);
              if (
                (canonicalCollision && canonicalCollision.id !== id) ||
                (aliasCollision &&
                  (aliasCollision.canonicalIdempotencyKey !==
                    canonicalIdempotencyKey ||
                    aliasCollision.reservationId !== id ||
                    aliasCollision.agentIdentityHash !==
                      replacementIdentityHash)) ||
                (signingKeyCollision &&
                  signingKeyCollision.reservationId !== id)
              ) {
                throw new Error(
                  "The replacement idempotency key belongs to another checkout.",
                );
              }
              const [updated] = await tx
                .update(splashAdReservationsTable)
                .set({
                  ucpAgentProfileUrl: replacementProfileUrl,
                  ucpAgentIdentityHash: replacementIdentityHash,
                  ucpAgentPublicKey: replacementPublicKey,
                })
                .where(
                  and(
                    eq(splashAdReservationsTable.id, id),
                    eq(
                      splashAdReservationsTable.ucpAgentProfileUrl,
                      previousProfileUrl,
                    ),
                    eq(
                      splashAdReservationsTable.ucpAgentIdentityHash,
                      previousIdentityHash,
                    ),
                    inArray(splashAdReservationsTable.status, [
                      "seat_held",
                      "payment_pending",
                    ]),
                    inArray(splashAdReservationsTable.paymentStatus, [
                      "unpaid",
                      "failed",
                      "checkout_created",
                    ]),
                  ),
                )
                .returning();
              if (!updated) {
                throw new Error(
                  "UCP checkout identity changed before rotation.",
                );
              }
              await tx.insert(ucpAgentIdentityRotationsTable).values({
                reservationId: id,
                previousProfileUrl,
                previousIdentityHash,
                previousPublicKeyThumbprint:
                  continuity.previousPublicKeyThumbprint,
                replacementProfileUrl,
                replacementIdentityHash,
                authorizationIdHash: createHash("sha256")
                  .update(continuity.authorizationId)
                  .digest("hex"),
                authorizationProofHash: continuity.authorizationProofHash,
                authorizedAt: continuity.authorizedAt,
              });
              await tx
                .insert(ucpCheckoutIdempotencyAliasesTable)
                .values({
                  idempotencyKey: replacementScopedIdempotencyKey,
                  canonicalIdempotencyKey,
                  reservationId: id,
                  agentIdentityHash: replacementIdentityHash,
                })
                .onConflictDoNothing();
              const [replacementAlias] = await tx
                .select()
                .from(ucpCheckoutIdempotencyAliasesTable)
                .where(
                  eq(
                    ucpCheckoutIdempotencyAliasesTable.idempotencyKey,
                    replacementScopedIdempotencyKey,
                  ),
                )
                .limit(1);
              if (
                !replacementAlias ||
                replacementAlias.canonicalIdempotencyKey !==
                  canonicalIdempotencyKey ||
                replacementAlias.reservationId !== id ||
                replacementAlias.agentIdentityHash !==
                  replacementIdentityHash
              ) {
                throw new Error(
                  "The replacement idempotency key belongs to another checkout.",
                );
              }
              await tx
                .insert(ucpAgentCheckoutIdempotencyTable)
                .values({
                  agentIdentityHash: replacementIdentityHash,
                  idempotencyKeyHash,
                  reservationId: id,
                })
                .onConflictDoNothing();
              const [replacementSigningKeyMapping] = await tx
                .select({
                  reservationId:
                    ucpAgentCheckoutIdempotencyTable.reservationId,
                })
                .from(ucpAgentCheckoutIdempotencyTable)
                .where(
                  and(
                    eq(
                      ucpAgentCheckoutIdempotencyTable.agentIdentityHash,
                      replacementIdentityHash,
                    ),
                    eq(
                      ucpAgentCheckoutIdempotencyTable.idempotencyKeyHash,
                      idempotencyKeyHash,
                    ),
                  ),
                )
                .limit(1);
              if (replacementSigningKeyMapping?.reservationId !== id) {
                throw new Error(
                  "The replacement idempotency key belongs to another checkout.",
                );
              }
            return updated;
          }),
      );
      res.json(buildUcpCheckoutView(rotated));
    } catch (error) {
      req.log.warn(
        { err: error, checkoutId: id },
        "UCP identity rotation was rejected",
      );
      sendUcpCheckoutNotFound(res);
    }
  },
);

function rejectDelegatedUcpCheckout(_req: Request, res: Response): void {
  res.status(405).json({
    ucp: { version: UCP_VERSION, status: "error" },
    messages: [
      {
        type: "error",
        code: "unsupported",
        content:
          "This opt-in UCP layer supports hosted buyer handoff only. Agent-side update, completion, delegated payment, and Stripe ACP charging are not enabled.",
        severity: "unrecoverable",
      },
    ],
  });
}

router.put("/ucp/v1/checkout-sessions/:id", rejectDelegatedUcpCheckout);
router.post(
  "/ucp/v1/checkout-sessions/:id/complete",
  rejectDelegatedUcpCheckout,
);
router.post(
  "/ucp/v1/checkout-sessions/:id/cancel",
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = canonicalUcpCheckoutId(rawId);
    const agentIdentityHash = String(res.locals.ucpAgentIdentityHash);
    const authorizedIdentityHashes = Array.isArray(
      res.locals.ucpAuthorizedAgentIdentityHashes,
    )
      ? (res.locals.ucpAuthorizedAgentIdentityHashes as string[])
      : [agentIdentityHash];
    if (!id) {
      sendUcpCheckoutNotFound(res);
      return;
    }
    try {
      await withUcpCheckoutAdvisoryLock(id, async (database) => {
        const [ownedCheckout] = await database
          .select({ id: splashAdReservationsTable.id })
          .from(splashAdReservationsTable)
          .where(
            and(
              eq(splashAdReservationsTable.id, id),
              inArray(
                splashAdReservationsTable.ucpAgentIdentityHash,
                authorizedIdentityHashes,
              ),
            ),
          )
          .limit(1);
        if (!ownedCheckout) {
          sendUcpCheckoutNotFound(res);
          return;
        }
        const result = await cancelSplashReservation(id, { database });
        if (result.kind === "not_found" || result.kind === "not_eligible") {
          sendUcpCheckoutNotFound(res);
          return;
        }
        if (result.kind === "conflict") {
          res.status(409).json({
            ucp: { version: UCP_VERSION, status: "error" },
            messages: [
              {
                type: "error",
                code: "conflict",
                content:
                  "Checkout cancellation could not be safely completed because its payment state changed.",
                severity: "recoverable",
              },
            ],
          });
          return;
        }
        if (result.kind === "canceled") {
          void syncReservationUpdateToPipeline(result.reservation, {
            onError: (sheetSyncError) =>
              req.log.warn(
                { reservationId: result.reservation.id, sheetSyncError },
                "UCP checkout canceled but pipeline update failed",
              ),
          }).catch((error) => {
            req.log.error(
              { err: error, reservationId: result.reservation.id },
              "Unable to record UCP cancellation pipeline state",
            );
          });
        }
        const view = buildUcpCheckoutView(result.reservation);
        if (!view) {
          sendUcpCheckoutNotFound(res);
          return;
        }
        res.json(view);
      });
    } catch (error) {
      req.log.error(
        { err: error, reservationId: id },
        "Unable to cancel UCP checkout",
      );
      res.status(503).json({
        ucp: { version: UCP_VERSION, status: "error" },
        messages: [
          {
            type: "error",
            code: "service_unavailable",
            content: "Checkout cancellation is temporarily unavailable.",
            severity: "recoverable",
          },
        ],
      });
    }
  },
);

router.get("/v1/orders/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  let row: typeof splashAdReservationsTable.$inferSelect | undefined;
  try {
    [row] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, id ?? ""))
      .limit(1);
  } catch (error) {
    logger.warn({ err: error }, "Order lookup unavailable");
    res.status(503).json({ error: "Order lookup unavailable." });
    return;
  }
  const view = row ? orderView(row) : null;
  if (!view) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  res.json(view);
});

router.post("/v1/orders/:id/confirm", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const sessionId =
    typeof req.body?.session_id === "string" ? req.body.session_id.trim() : "";
  if (sessionId.length < 8 || sessionId.length > 255) {
    res.status(400).json({ error: "Invalid checkout session." });
    return;
  }
  let [row] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, id ?? ""))
    .limit(1);
  if (
    !row ||
    !getPayableReserveOffer(row.offerKey, row.amountCents, row.currency)
  ) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  if (row.stripeCheckoutSessionId !== sessionId) {
    res.status(409).json({ error: "Checkout session does not belong to this order." });
    return;
  }

  try {
    const session = await retrieveStripeCheckoutSession(sessionId);
    if (session.id !== sessionId || !stripeSessionMatchesReservation(session, row)) {
      res.status(409).json({ error: "Checkout session does not belong to this order." });
      return;
    }
    if (session.payment_status === "paid") {
      await markSplashReservationPaidFromSession(session);
      [row] = await db
        .select()
        .from(splashAdReservationsTable)
        .where(eq(splashAdReservationsTable.id, id ?? ""))
        .limit(1);
    }
  } catch (error) {
    req.log.warn(
      { err: error, reservationId: row.id, sessionId },
      "Unable to reconcile returning v1 checkout",
    );
  }
  if (!row) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  res.json(orderView(row));
});

router.get("/v1/orders/:id/io.json", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  let row: typeof splashAdReservationsTable.$inferSelect | undefined;
  try {
    [row] = await db.select().from(splashAdReservationsTable).where(eq(splashAdReservationsTable.id, id ?? "")).limit(1);
  } catch (error) {
    logger.warn({ err: error }, "Order lookup unavailable");
    res.status(503).json({ error: "Order lookup unavailable." });
    return;
  }
  const view = row ? orderView(row) : null;
  if (!view) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  res.json({
    ...view,
    dueTodayUsd: row.currency === RESERVE_CURRENCY ? row.amountCents / 100 : undefined,
    dueToday: row.amountCents / 100,
    mediaCreditCents: row.amountCents,
    discount: 0.25,
    categoryLock: true,
    coordinated72h: true,
    aggregateOnly: true,
    requiresInsertionOrder: true,
    guaranteesImpressions: false,
    exclusions: EXCLUSIONS,
  });
});

router.get("/v1/placements", async (req, res): Promise<void> => {
  if (req.query.status !== "open" || (req.query.format !== undefined && !isFormat(req.query.format))) {
    res.status(400).json({ error: "status=open and a supported format are required." });
    return;
  }
  let placements: Array<{ id: string }> = [];
  try {
    placements = await db
      .select({
        id: marketplacePlacementsTable.id,
      })
      .from(marketplacePlacementsTable)
      .where(
        and(
          eq(marketplacePlacementsTable.status, "approved"),
          eq(marketplacePlacementsTable.currency, RESERVE_CURRENCY),
        ),
      );
  } catch (error) {
    logger.warn({ err: error }, "Public placements fell back to static ids");
  }
  const requested = isFormat(req.query.format) ? [req.query.format] : [...FORMATS];
  res.json(
    requested.map((format, index) => ({
      id: placements[index]?.id ?? `birch-reserve-${format}`,
      format,
      status: "open",
      window: "rolling_30_90_180",
      reserve_url: `/buycalc?format=${encodeURIComponent(format)}`,
    })),
  );
});

router.get("/openapi.yaml", async (_req, res): Promise<void> => {
  const candidates = [
    resolve(process.cwd(), "lib/api-spec/openapi.yaml"),
    resolve(process.cwd(), "../../lib/api-spec/openapi.yaml"),
    new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url),
    new URL("../../../lib/api-spec/openapi.yaml", import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      res.type("application/yaml").send(await readFile(candidate, "utf8"));
      return;
    } catch {
      // Source and bundled layouts have different relative depths.
    }
  }
  res.status(500).type("text/plain").send("OpenAPI contract is unavailable.");
});


/**
 * /buycalc is the one public buy page (server-rendered for browsers, crawlers and
 * no-JS visitors alike; the SPA links here for checkout). Randy, Nov 12 2026: keep
 * it short. One hero line, two offers, one "what you get" list, one live proof line,
 * one benchmark line, the eight category cards, one form, phone and email.
 * Agents use /v1/catalog.json and /v1/quote, not the human form.
 */
const BUYCALC_FORMAT_LABELS: Record<(typeof FORMATS)[number], string> = {
  post_checkout: "After checkout",
  recovery_plan: "Recovery plan",
  scheduled_service: "Scheduled service",
  member_hub: "Member hub",
  motion_15s: "Motion 15s",
};

const BUYCALC_CSS = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f8f6ef;color:#071A39;font:16px/1.55 "IBM Plex Sans",system-ui,sans-serif;-webkit-text-size-adjust:100%}a{color:inherit}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.top{border-bottom:1px solid #d5d9df;background:#f8f6ef}.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}.logo{font-weight:600;letter-spacing:.14em;text-decoration:none;font-size:14px}.top nav{display:flex;align-items:center;gap:14px;font-size:14px}.top nav a.tl{text-decoration:none;opacity:.8}.currency-toggle a{padding:4px 9px;border:1px solid #071A39;text-decoration:none;font-size:13px}.currency-toggle a[aria-pressed=true]{background:#071A39;color:#fff}.currency-toggle span{opacity:.7;margin-right:2px}
.hero{background:#071A39;color:#f8f6ef;padding:56px 0 48px}.eyebrow{font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#C8F55A;margin:0 0 14px}h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:400;letter-spacing:-.01em;margin:0}.hero h1{font-size:clamp(2.1rem,6vw,3.9rem);line-height:1.04;max-width:820px}.hero .lede{font-size:clamp(1.02rem,2.2vw,1.2rem);max-width:640px;opacity:.82;margin:18px 0 28px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;font-weight:600;text-decoration:none;border:2px solid #C8F55A;background:#C8F55A;color:#071A39;cursor:pointer;font:600 16px "IBM Plex Sans",system-ui,sans-serif}.btn.line{background:transparent;color:inherit;border-color:currentColor}.ctas{display:flex;flex-wrap:wrap;gap:12px}
section.band{padding:52px 0}section.band+section.band{border-top:1px solid #d5d9df}.kicker{font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;opacity:.65;margin:0 0 10px}h2{font-size:clamp(1.7rem,4vw,2.5rem);line-height:1.1;margin-bottom:22px}
.offers{display:grid;grid-template-columns:1fr 1fr;gap:16px}.offer{background:#fff;border:1px solid #071A39;padding:24px;display:flex;flex-direction:column;gap:10px;position:relative}.offer.is-selected{box-shadow:6px 6px 0 #C8F55A}.offer small{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;opacity:.7}.offer .price{font:400 2.6rem/1 Fraunces,Georgia,serif}.offer .name{font-weight:600;font-size:1.05rem}.offer p{margin:0;font-size:15px;opacity:.85}.offer .btn{margin-top:auto}.offer .badge{position:absolute;top:14px;right:14px;background:#C8F55A;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:0 36px;padding:0;margin:0;list-style:none}.facts li{padding:12px 0 12px 28px;border-bottom:1px solid #d5d9df;position:relative}.facts li:before{content:"";position:absolute;left:0;top:19px;width:12px;height:12px;background:#C8F55A;border:1px solid #071A39}
.proof{display:grid;gap:12px;margin-top:28px}.proof p{margin:0;padding:16px 18px;background:#fff;border-left:4px solid #C8F55A;font-size:15px}.proof .tag{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;border:1px solid currentColor;padding:1px 6px;margin-right:8px;vertical-align:1px}
.open-count{font-size:15px;margin:-8px 0 18px}.open-count strong{background:#C8F55A;padding:1px 6px}
.cat-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:0;padding:0;list-style:none}.cat-strip li{background:#fff;border:1px solid #071A39}.cat-strip a,.cat-strip span{display:flex;flex-direction:column;justify-content:space-between;gap:10px;min-height:96px;padding:14px;text-decoration:none;font-weight:600;font-size:15px}.cat-strip em{font-style:normal;font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}.cat-strip a em{color:#3b6b00}.cat-strip a:hover,.cat-strip a:focus-visible{background:#071A39;color:#fff}.cat-strip a:hover em,.cat-strip a:focus-visible em{color:#C8F55A}.cat-strip span em{opacity:.6}
.buy{display:grid;grid-template-columns:1.1fr .9fr;gap:36px;align-items:start}form#reserve{background:#fff;border:1px solid #071A39;padding:24px}form label{display:block;font-weight:600;font-size:14px;margin:14px 0 6px}form input,form select{width:100%;min-height:48px;padding:10px 12px;border:1px solid #071A39;background:#fff;font:16px "IBM Plex Sans",system-ui,sans-serif;color:#071A39;border-radius:0}form .check{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:14px}form .check input{width:20px;min-height:20px;margin-top:2px;flex:none}form .btn{width:100%;margin-top:18px}.fine{font-size:13px;opacity:.75}#message{font-weight:600;margin:14px 0 0;min-height:1em}.row2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
.talk{background:#071A39;color:#f8f6ef;padding:24px}.talk h3{font-size:1.5rem;margin-bottom:10px}.talk p{margin:0 0 16px;opacity:.82}.talk .btn{width:100%;margin-top:10px}
footer{padding:28px 0 40px;font-size:13px;opacity:.75}footer p{margin:6px 0}
@media(max-width:820px){.offers,.facts,.buy{grid-template-columns:1fr}.cat-strip{grid-template-columns:1fr 1fr}.hero{padding:40px 0 36px}section.band{padding:40px 0}.top nav a.tl{display:none}.ctas .btn{flex:1 1 100%}}
@media(max-width:380px){.row2{grid-template-columns:1fr}}`;

function buycalcSelectedOffer(sku: unknown) {
  return PUBLIC_RESERVE_OFFERS.find((offer) => offer.sku === sku) ?? DEFAULT_RESERVE_OFFER;
}

function buycalcCategorySlug(value: unknown): string | null {
  return typeof value === "string" && BUYCALC_CATEGORIES.some((c) => c.slug === value) ? value : null;
}

export function renderBuycalcHtml(input: {
  seatsOpen: number;
  seatsTotal: number;
  sku?: unknown;
  format?: unknown;
  category?: unknown;
  currency?: ReserveCurrency;
  draftBonus?: boolean;
  checkoutLive?: boolean;
}): string {
  const currency: ReserveCurrency = input.currency ?? RESERVE_CURRENCY;
  const html = renderBuycalcHtmlUsd(input, currency);
  const localized = localizeReservePriceCopy(html, currency);
  // Draft bonus tiers are added after localizing so their explicit amounts are never rewritten.
  if (!input.draftBonus) return localized.replace("<!--BONUS_TIER_DRAFT-->", "");
  const section = renderBonusTierDraftHtml(currency);
  return localized
    .replace("<!--BONUS_TIER_DRAFT-->", () => section)
    .replace('<meta charset="utf-8">', () => '<meta charset="utf-8"><meta name="robots" content="noindex">');
}

function currencyToggleHtml(
  currency: ReserveCurrency,
  query: { sku?: unknown; format?: unknown; category?: unknown },
): string {
  const link = (target: ReserveCurrency) => {
    const params = new URLSearchParams();
    if (typeof query.sku === "string") params.set("sku", query.sku);
    if (typeof query.format === "string") params.set("format", query.format);
    const category = buycalcCategorySlug(query.category);
    if (category) params.set("category", category);
    params.set("currency", target);
    const active = target === currency;
    return `<a href="/buycalc?${params.toString()}#reserve" data-currency="${target}" rel="nofollow" aria-pressed="${active}">${target.toUpperCase()}</a>`;
  };
  return `<span class="currency-toggle" data-testid="currency-toggle" role="group" aria-label="Currency"><span>Prices in</span> ${link("usd")} ${link("cad")}</span>`;
}

function renderBuycalcHtmlUsd(input: {
  seatsOpen: number;
  seatsTotal: number;
  sku?: unknown;
  format?: unknown;
  category?: unknown;
  checkoutLive?: boolean;
}, currency: ReserveCurrency): string {
  const selected = buycalcSelectedOffer(input.sku);
  const category = buycalcCategorySlug(input.category);
  const checkoutLive = input.checkoutLive === true;
  const look = PUBLIC_RESERVE_OFFERS.find((offer) => offer.sku === "hold-190") ?? PUBLIC_RESERVE_OFFERS[0];
  const seat = PUBLIC_RESERVE_OFFERS.find((offer) => offer.sku === "reserve-490") ?? DEFAULT_RESERVE_OFFER;
  const price = (offer: (typeof PUBLIC_RESERVE_OFFERS)[number]) => offerPriceLabel(offer, currency);
  const offerCard = (offer: (typeof PUBLIC_RESERVE_OFFERS)[number], body: { eyebrow: string; name: string; lines: string[]; cta: string }) => {
    const isSelected = offer.sku === selected.sku;
    return `<article class="offer${isSelected ? " is-selected" : ""}" data-sku="${offer.sku}">${isSelected ? `<span class="badge">Selected</span>` : ""}<small>${body.eyebrow}</small><div class="price">${price(offer)}</div><div class="name">${body.name}</div>${body.lines.map((line) => `<p>${line}</p>`).join("")}<a class="btn${offer.sku === "reserve-490" ? "" : " line"}" href="/buycalc?sku=${offer.sku}${category ? `&amp;category=${category}` : ""}#reserve" data-pick-sku="${offer.sku}">${body.cta}</a></article>`;
  };
  const poolOpen = input.seatsOpen > 0;
  const categoryCells = BUYCALC_CATEGORIES.map((c) =>
    poolOpen
      ? `<li data-slug="${c.slug}"><a href="/buycalc?sku=${selected.sku}&amp;category=${c.slug}#reserve" data-pick-category="${c.slug}">${c.label}<em>Open · pick</em></a></li>`
      : `<li data-slug="${c.slug}"><span>${c.label}<em>Waitlist</em></span></li>`,
  ).join("");
  const submitLabel = checkoutLive
    ? `Continue to secure checkout · ${price(selected)}`
    : `Reserve my seat · no charge today`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prepay your category — Birch Reserve</title><meta name="description" content="${PUBLIC_BRAND_DESCRIPTION}"><meta property="og:title" content="Birch Reserve | The $490 seat is the named category"><meta property="og:description" content="${PUBLIC_BRAND_DESCRIPTION}"><meta name="twitter:title" content="Birch Reserve | The $490 seat is the named category"><meta name="twitter:description" content="${PUBLIC_BRAND_DESCRIPTION}">${publicSeoTags("/buycalc")}
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="alternate" type="application/json" href="/v1/catalog.json" title="Birch Reserve machine catalog">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Birch Reserve brand category slots",
  itemListElement: PUBLIC_RESERVE_OFFERS.map((offer, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "Product",
      name: `Birch Reserve ${offer.name}`,
      sku: offer.sku,
      category: "Private health and wellness media inventory",
      offers: {
        "@type": "Offer",
        price: String(offerAmountCents(offer, currency) / 100),
        priceCurrency: currency.toUpperCase(),
        availability: "https://schema.org/LimitedAvailability",
        url: `/buycalc?sku=${offer.sku}`,
      },
    },
  })),
})}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${BUYCALC_CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="logo" href="/">BIRCH RESERVE</a><nav aria-label="Buy page"><a class="tl" href="/rates">Rates</a><a class="tl" href="/kit">Creative brief</a>${currencyToggleHtml(currency, { sku: input.sku, format: input.format, category })}</nav></div></header>
<main>
<section class="hero"><div class="wrap"><p class="eyebrow">Birch Reserve · Prepaid category seats</p><h1>Prepay your category's display space. One brand. No bidding.</h1>
<p class="lede">Your offer sits inside listed recovery hubs, right after a customer books or buys. All of it is media credit, fully refundable until ${PREPAY_REFUND_CUTOFF_DAYS} days before your launch date.</p>
<div class="ctas"><a class="btn" href="/buycalc?sku=reserve-490#reserve" data-pick-sku="reserve-490">Reserve my category · ${price(seat)}</a><a class="btn line" href="/buycalc?sku=hold-190#reserve" data-pick-sku="hold-190">7-day look · ${price(look)}</a></div></div></section>

<section class="band" id="offers"><div class="wrap"><p class="kicker">Two ways in</p><h2>Pick your start.</h2>
<div class="offers">${offerCard(look, { eyebrow: "7-day look", name: look.name, lines: ["Hold your category for 7 days while you decide.", "Converts in full to the seat within 7 days, otherwise refunded. Does not lock the seat."], cta: `Start the 7-day look · ${price(look)}` })}${offerCard(seat, { eyebrow: "Named category seat", name: "Your category, one brand", lines: [`All ${price(seat)} becomes display credit in your category. Credit lasts 12 months.`, "No other brand takes your category while the seat is yours."], cta: `Reserve my category · ${price(seat)}` })}</div>
<!--BONUS_TIER_DRAFT-->
</div></section>

<section class="band" id="included"><div class="wrap"><p class="kicker">What you get</p><h2>Plain terms.</h2>
<ul class="facts"><li>One brand per category. No auction, no shared seat.</li><li>100% of what you pay is media credit in your category.</li><li>Fully refundable until ${PREPAY_REFUND_CUTOFF_DAYS} days before your launch date.</li><li>The insertion order names the hub and the category before anything runs.</li><li>Aggregate reporting only. No PHI, no clinical pixels.</li><li>No impression guarantee, and no reach or click forecast.</li></ul>
<div class="proof"><p><span class="tag">Live placement</span><a href="https://physio.drhonow.com" target="_blank" rel="noopener">physio.drhonow.com</a>, a listed physio hub. Your card sits at the booking and the plan, in your category. Illustrative until your insertion order names the hub.</p>
<p><span class="tag">Public benchmark</span>Not a Birch result: Meta health and wellness ads, median CPM $21.80 and median $40.53 per customer (Triple Whale, Meta Ads Benchmarks, Aug 17, 2026, USD).</p></div>
</div></section>

<section class="band" id="categories"><div class="wrap"><p class="kicker">Categories</p><h2>Eight categories. One brand each.</h2>
<p class="open-count"><strong>${input.seatsOpen} of ${input.seatsTotal} open</strong> · Availability is rolling and subtracts paid and currently held seats.</p>
<ul class="cat-strip" data-source="/availability.json" data-seats-open="${input.seatsOpen}">${categoryCells}</ul>
</div></section>

<section class="band" id="buy"><div class="wrap"><div class="buy">
<form id="reserve" novalidate><p class="kicker">Reserve without a login</p><h2 style="margin-bottom:6px">Lock it in.</h2>
<label for="f-sku">Offer</label><select id="f-sku" name="sku">${PUBLIC_RESERVE_OFFERS.map((offer) => `<option value="${offer.sku}"${offer.sku === selected.sku ? " selected" : ""}>${price(offer)} · ${offer.sku === "reserve-490" ? "Named category seat" : offer.name}</option>`).join("")}</select>
<label for="f-cat">Category</label><select id="f-cat" name="category"><option value="">Not sure yet</option>${BUYCALC_CATEGORIES.map((c) => `<option value="${c.slug}"${c.slug === category ? " selected" : ""}>${c.label}</option>`).join("")}</select>
<label for="f-brand">Brand</label><input id="f-brand" name="brand" required maxlength="160" autocomplete="organization">
<label for="f-email">Work email</label><input id="f-email" name="email" type="email" required autocomplete="email">
<div class="row2"><div><label for="f-web">Website <span class="fine">(optional)</span></label><input id="f-web" name="website_url" type="url" inputmode="url" placeholder="https://"></div><div><label for="f-format">Where it shows</label><select id="f-format" name="format_pref">${FORMATS.map((f) => `<option value="${f}"${input.format === f ? " selected" : ""}>${BUYCALC_FORMAT_LABELS[f]}</option>`).join("")}</select></div></div>
<label class="check"><input id="terms" type="checkbox" required><span>I agree to the draft <a href="/terms">terms</a> before any charge.</span></label>
<button id="submit" class="btn" type="submit">${submitLabel}</button>
<p class="fine" id="checkout-note">${checkoutLive ? "Secure card checkout by Stripe. Payment counts once Stripe confirms it." : "Card checkout is not open yet. Submitting saves your seat request and alerts our sales team. No card is charged."}</p>
<p id="message" role="status" aria-live="polite"></p>
<noscript><p class="fine">This form needs JavaScript. To reserve without it, <a href="mailto:sales@silverbirchgrowth.com?subject=Birch%20Reserve%20seat">email sales@silverbirchgrowth.com</a> or call <a href="tel:+16479316278">(647) 931-6278</a>.</p></noscript>
</form>
<aside class="talk"><h3>Rather talk first?</h3><p>We'll walk you through the hubs, your category and the brief.</p><a class="btn" href="tel:+16479316278">Call (647) 931-6278</a><a class="btn line" href="mailto:sales@silverbirchgrowth.com?subject=Birch%20Reserve%20seat">sales@silverbirchgrowth.com</a><a class="btn line" href="/kit">See the creative brief</a></aside>
</div></div></section>
</main>
<footer><div class="wrap"><p>One brand per category · No PHI · No clinical pixels · No impression guarantee · Aggregate reporting only</p><p>Silver Birch Growth Inc. · 777-2255B Queen St E, Toronto ON M4E 1G3 · <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a> · <a href="tel:+16479316278">(647) 931-6278</a></p><p>For AI buyers: <a href="/v1/catalog.json">/v1/catalog.json</a> · <a href="/v1/quote?sku=reserve-490&amp;format=post_checkout&amp;days=30">/v1/quote</a> · <a href="/llms.txt">/llms.txt</a></p></div></footer>
<script>
(function(){var form=document.getElementById("reserve"),message=document.getElementById("message"),submit=document.getElementById("submit"),idempotencyKey=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2),currency=${JSON.stringify(currency)},live=${checkoutLive ? "true" : "false"},labels=${JSON.stringify(Object.fromEntries(PUBLIC_RESERVE_OFFERS.map((offer) => [offer.sku, price(offer)])))};
function refresh(){if(live)submit.textContent="Continue to secure checkout · "+labels[form.elements.sku.value];document.querySelectorAll(".offer").forEach(function(el){var on=el.getAttribute("data-sku")===form.elements.sku.value;el.classList.toggle("is-selected",on);var b=el.querySelector(".badge");if(on&&!b){b=document.createElement("span");b.className="badge";b.textContent="Selected";el.prepend(b)}else if(!on&&b){b.remove()}})}
form.elements.sku.addEventListener("change",refresh);
function go(){document.getElementById("buy").scrollIntoView({behavior:"smooth",block:"start"});setTimeout(function(){document.getElementById("f-brand").focus({preventScroll:true})},400)}
document.querySelectorAll("[data-pick-sku]").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();form.elements.sku.value=a.getAttribute("data-pick-sku");refresh();go()})});
document.querySelectorAll("[data-pick-category]").forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();form.elements.category.value=a.getAttribute("data-pick-category");go()})});
form.addEventListener("submit",async function(e){e.preventDefault();if(!form.reportValidity())return;if(!document.getElementById("terms").checked){message.textContent="Please accept the draft terms first.";return}submit.disabled=true;message.textContent="Saving your request…";var data=Object.fromEntries(new FormData(form));data.idempotency_key=idempotencyKey;data.currency=currency;if(!data.website_url)delete data.website_url;if(!data.category)delete data.category;try{var r=await fetch("/v1/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});var out=await r.json();if(out.checkout_url){location.assign(out.checkout_url);return}if(out.order_id){message.textContent="Saved. Your seat request is in (ref "+out.order_id+"). No card was charged. Our sales team will reach you at "+data.email+", or call (647) 931-6278.";form.querySelectorAll("input,select,button").forEach(function(el){el.disabled=true});return}message.textContent=out.error||"We could not save that. Please call (647) 931-6278 or email sales@silverbirchgrowth.com.";submit.disabled=false}catch(err){message.textContent="We could not submit that. No payment was taken. Please call (647) 931-6278 or email sales@silverbirchgrowth.com.";submit.disabled=false}});
refresh();if(location.hash==="#reserve"&&/[?&]format=/.test(location.search)){setTimeout(function(){document.getElementById("f-brand").focus({preventScroll:true})},350)}})();
</script></body></html>`;
}

router.get("/buycalc", async (req, res): Promise<void> => {
  const availability = await reserveCounts();
  const decision = decideCurrency(req);
  // A visible choice (?currency=) is remembered so nobody is stuck.
  if (decision.source === "query") {
    res.append("Set-Cookie", currencyCookieHeader(decision.currency));
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, x-vercel-ip-country");
  res.type("html").send(
    renderBuycalcHtml({
      currency: decision.currency,
      seatsOpen: availability.seats_open,
      seatsTotal: availability.seats_total,
      sku: req.query.sku,
      format: req.query.format,
      category: req.query.category,
      draftBonus: isBonusDraftRequested(req.query),
      checkoutLive: checkoutConfigured(),
    }),
  );
});

export default router;

async function connectUcpLockClient(deadline: number): Promise<UcpLockClient> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw new Error("UCP operation lock timed out.");
  }

  const connection = pool.connect();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      connection,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("UCP operation lock timed out.")),
          remainingMs,
        );
      }),
    ]);
  } catch (error) {
    void connection.then(
      (client) => client.release(),
      () => undefined,
    );
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function withUcpAdvisoryLocks<T>(
  lockKeys: string[],
  operation: (database: WorkspaceDatabase) => Promise<T>,
): Promise<T> {
  const deadline = Date.now() + 5_000;
  const orderedLockKeys = [...new Set(lockKeys)].sort();
  if (orderedLockKeys.length === 0) {
    throw new Error("At least one UCP operation lock is required.");
  }

  while (true) {
    const client = await connectUcpLockClient(deadline);
    const acquiredLockKeys: string[] = [];
    try {
      for (const lockKey of orderedLockKeys) {
        const result = await client.query<{ acquired: boolean }>(
          "select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired",
          [lockKey],
        );
        if (result.rows[0]?.acquired !== true) break;
        acquiredLockKeys.push(lockKey);
      }
      if (acquiredLockKeys.length === orderedLockKeys.length) {
        return await operation(databaseForClient(client));
      }
    } finally {
      let releaseError: Error | undefined;
      for (const lockKey of acquiredLockKeys.reverse()) {
        try {
          await client.query(
            "select pg_advisory_unlock(hashtextextended($1, 0))",
            [lockKey],
          );
        } catch (error) {
          releaseError ??=
            error instanceof Error
              ? error
              : new Error("Unable to release advisory lock.");
        }
      }
      client.release(releaseError);
    }
    if (Date.now() >= deadline) {
      throw new Error("UCP operation lock timed out.");
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))),
    );
  }
}
