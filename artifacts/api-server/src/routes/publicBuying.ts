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
  reserveCheckoutLineItem,
  type PublicReserveOffer,
} from "../lib/reserveOffers";
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
import { recordUcpProxyForwardingShape } from "../lib/logger";
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

function lineItem(offer: PublicReserveOffer): Stripe.Checkout.SessionCreateParams.LineItem {
  return reserveCheckoutLineItem(offer);
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
    currency: "USD",
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

router.post("/v1/ui-events", (req, res) => {
  void handleUiEvent(req, res);
});

router.get("/llms.txt", (_req, res) => {
  res.type("text/plain").send(
    [
      "# Birch Reserve",
      "",
      "Eight category seats inside signed Scale Health hubs. Not an open auction. Not a guaranteed impression buy.",
      "Live proof: https://physio.drhonow.com/dr-ho/portal",
      "Public SKUs:",
      "- hold-190 · $190 USD · 7-day category look · 100% credit if converted to a seat within 7 days, else cash refund · does not consume an 8-seat",
      "- reserve-490 · $490 USD · named category seat in the 8-pool · 100% media credit · insertion order before flight · credit expires 12 months",
      "- custom · Get a call back · multi-hub / exclusive / on-prem Align",
      "Eight seats = eight advertiser categories across hubs, not eight websites.",
      "Categories: pain relief / topicals, recovery hardware, nutrition, sleep, meal prep, women’s health, men’s health, diagnostics / services.",
      "Launching cohort (logos, not reach): DR-HO’S · Kalaya · Jill Health · Jack Health · Integrity Fitness · Bird & Be · NutriProCan · Roll Recovery.",
      `Formats: ${FORMATS.join(", ")}.`,
      "Every published dollar is a 100% media credit. Delivery starts when the insertion order names the hub.",
      "$490 holds a category seat inside signed Scale Health hubs. Live example: physio.drhonow.com/dr-ho/portal. Credit, not a flight.",
      "Quoted public prices are exact, one-time, and USD. Only reserve-490 consumes the eight-seat pool. hold-190 does not.",
      "Exclusions: no PHI, no clinical pixels, no open auction, no impression guarantee.",
      "Seller: Silver Birch Growth Inc. · 777-2255B Queen St E, Toronto ON M4E 1G3 · sales@silverbirchgrowth.com",
      "Draft terms: /terms · Draft privacy: /privacy · Sample insertion order: /sample-io · Kit: /kit",
      `Machine catalog: /v1/catalog.json`,
      `Availability: /v1/availability.json`,
      `Quote: /v1/quote?sku=reserve-490&format=post_checkout&days=30`,
      `Checkout: POST /v1/checkout`,
      `UCP discovery: /.well-known/ucp`,
      "UCP checkout uses Stripe-hosted buyer handoff. Delegated Stripe Agentic Commerce/ACP payment is not advertised.",
      "Poll: GET /v1/orders/:id and /v1/orders/:id/io.json",
      `Human calculator: /buycalc`,
      "Contact: sales@silverbirchgrowth.com",
    ].join("\n"),
  );
});

router.get("/v1/catalog.json", (_req, res) => {
  res.json({
    catalog_version: "2026-09-24",
    currency: "USD",
    default_sku: DEFAULT_RESERVE_OFFER.sku,
    inventory_model: "shared_reserve_pool",
    offers: PUBLIC_RESERVE_OFFERS.map((offer) => ({
      offer_key: offer.offerKey,
      sku: offer.sku,
      name: offer.name,
      offer_type: offer.offerType,
      amount_cents: offer.amountCents,
      due_today: offer.dueTodayUsd,
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
    exclusivity: "category_lock",
    fulfillment: "coordinated_72h",
    reporting: "aggregate_only",
    checkout: "/v1/checkout",
    human: "/buycalc",
  });
});

router.get("/v1/availability.json", async (_req, res): Promise<void> => {
  res.json({
    currency: "USD",
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
});

router.get("/v1/quote", async (req, res): Promise<void> => {
  const format = req.query.format;
  const days = req.query.days;
  const offer = getPublicReserveOfferBySku(req.query.sku);
  if (!offer || !isFormat(format) || !isWindow(days)) {
    res.status(400).json({ error: "A supported SKU, format, and 30, 90, or 180 day window are required." });
    return;
  }
  res.json({
    sku: offer.sku,
    offerKey: offer.offerKey,
    offerName: offer.name,
    offerType: offer.offerType,
    format,
    days: Number(days),
    currency: "USD",
    amountCents: offer.amountCents,
    dueTodayUsd: offer.dueTodayUsd,
    mediaCreditCents: offer.amountCents,
    scope: offer.scope,
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
  ]);
  const offer = getPublicReserveOfferBySku(body.sku);
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
    !validEmail(email) ||
    brand.length < 1 ||
    brand.length > 160 ||
    !validWebsite(website) ||
    (format !== undefined && !isFormat(format)) ||
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
      amountCents: offer?.amountCents ?? 0,
      currency: RESERVE_CURRENCY,
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
      promotedOffer: `Birch Reserve ${offer.name}`,
      status: "seat_held",
      offerKey: offer.offerKey,
      amountCents: offer.amountCents,
      currency: RESERVE_CURRENCY,
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
      amountCents: offer.amountCents,
      currency: RESERVE_CURRENCY,
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
        amountCents: offer.amountCents,
        currency: RESERVE_CURRENCY,
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
      reservation.amountCents !== offer.amountCents ||
      reservation.currency !== RESERVE_CURRENCY;
  if (mismatchedRequest) {
    await sendCheckoutReceipt(res, 409, {
      error: "This idempotency key was used for a different checkout request.",
      checkout_url: null,
      order_id: null,
      reservationId: null,
      amountCents: offer.amountCents,
      currency: RESERVE_CURRENCY,
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
    amountCents: offer.amountCents,
    currency: RESERVE_CURRENCY,
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
    line_items: [lineItem(offer)],
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
  const [row] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, id ?? ""))
    .limit(1);
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
  const [row] = await db.select().from(splashAdReservationsTable).where(eq(splashAdReservationsTable.id, id ?? "")).limit(1);
  const view = row ? orderView(row) : null;
  if (!view) {
    res.status(404).json({ error: "Order not found." });
    return;
  }
  res.json({
    ...view,
    dueTodayUsd: row.amountCents / 100,
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
  const placements = await db
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

router.get("/buycalc", async (req, res): Promise<void> => {
  const availability = await reserveCounts();
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Buy calculator — Birch Reserve</title><meta name="description" content="$490 holds a category seat inside signed Scale Health hubs. Live example: physio.drhonow.com/dr-ho/portal. Credit, not a flight."><meta property="og:description" content="$490 holds a category seat inside signed Scale Health hubs. Live example: physio.drhonow.com/dr-ho/portal. Credit, not a flight.">
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Birch Reserve category seats",
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
        price: String(offer.dueTodayUsd),
        priceCurrency: "USD",
        availability: "https://schema.org/LimitedAvailability",
        url: `/buycalc?sku=${offer.sku}`,
      },
    },
  })),
})}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#f8f6ef;color:#071A39;font:16px/1.55 "IBM Plex Sans",sans-serif}header,main,footer{max-width:1100px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;border-bottom:1px solid #ccd2d8}h1,h2{font-family:Fraunces,serif;font-weight:400}h1{font-size:clamp(2.7rem,7vw,5.8rem);line-height:.95;margin:.5em 0}.accent{background:#C8F55A;padding:.08em .18em}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:36px}.card{border:1px solid #071A39;padding:24px;margin:18px 0}.figures{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#071A39}.figure{background:#fff;padding:18px}.figure strong{display:block;font:600 1.7rem Fraunces,serif}.offer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.offer{border:1px solid #071A39;padding:16px;background:#fff}.offer strong{display:block;font:600 1.35rem Fraunces,serif}.offer small{display:block;margin-top:8px}label{display:block;font-weight:600;margin-top:14px}input,select,button{width:100%;padding:12px;border:1px solid #071A39;background:white;font:inherit}button{margin-top:18px;background:#C8F55A;font-weight:600;cursor:pointer}.fine{font-size:.9rem}#message{padding-top:12px;font-weight:600}@media(max-width:760px){.grid,.figures,.offer-grid{grid-template-columns:1fr}}
</style></head><body><header><strong>BIRCH RESERVE</strong><a href="/v1/catalog.json">Machine catalog</a></header><main>
<p>Reservations are open. Campaigns start when the insertion order names the hub.</p><h1>Eight category seats inside closed recovery hubs.</h1>
<p>Your offer sits after checkout, on a plan, or at a booking — not in a stranger’s feed.</p>
<p><a href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer">See a live hub</a></p>
<div class="figures"><div class="figure">Category seat<strong>$490 USD</strong></div><div class="figure">7-day look<strong>$190 USD</strong></div><div class="figure">Media credit<strong>100%</strong></div></div>
<div class="grid"><section><h2>What the seat includes</h2><p><strong>${availability.seats_open} seats remaining</strong> of ${availability.seats_total}. Availability is rolling and subtracts paid and currently held seats.</p>
<div class="offer-grid">${PUBLIC_RESERVE_OFFERS.map((offer) => `<article class="offer"><small>${offer.offerType.replaceAll("_", " ").toUpperCase()}</small><strong>$${offer.dueTodayUsd.toLocaleString("en-US")} · ${offer.name}</strong><small>${offer.scope}</small></article>`).join("")}</div>
<div class="card"><h2>Your planning choices</h2><p><strong>Format:</strong> post-checkout, recovery plan, scheduled service, member hub, or motion 15s.</p><p><strong>Window:</strong> 30, 90, or 180 days.</p><p><strong>Exclusivity:</strong> category or RON.</p><p><strong>Creative:</strong> static, native, or motion.</p></div>
<h2>Non-negotiable exclusions</h2><ul><li>No PHI</li><li>No clinical pixels</li><li>No open auction</li></ul><p>Reporting is aggregate only. Payment is not considered received until Stripe webhook confirmation.</p></section>
<aside><form id="reserve"><h2>Reserve without a login</h2><label>Offer<select name="sku">${PUBLIC_RESERVE_OFFERS.map((offer) => `<option value="${offer.sku}"${req.query.sku === offer.sku ? " selected" : ""}>$${offer.dueTodayUsd.toLocaleString("en-US")} · ${offer.name}</option>`).join("")}</select></label><label>Brand<input name="brand" required maxlength="160"></label><label>Work email<input name="email" type="email" required></label><label>Website (optional)<input name="website_url" type="url"></label><label>Format<select name="format_pref">${FORMATS.map((f) => `<option value="${f}"${req.query.format === f ? " selected" : ""}>${f.replaceAll("_", " ")}</option>`).join("")}</select></label><label>Window<select id="days"><option>30</option><option>90</option><option>180</option></select></label><label>Exclusivity<select><option>Category</option><option>RON</option></select></label><label>Creative<select><option>Static</option><option>Native</option><option>Motion</option></select></label><label class="fine"><input id="terms" type="checkbox" required style="width:auto;margin-right:8px">I agree to the draft <a href="/terms">terms</a> before any charge. Draft until counsel stamps.</label><button id="submit" type="submit">Lock the seat — $490 USD</button><button id="copy" type="button">Copy quote JSON</button><p class="fine"><a href="tel:+15045046526">Get a call back</a> · <a href="/buycalc?sku=hold-190">Hold a category for 7 days — $190</a></p><p id="message" role="status"></p><noscript><p class="fine">JavaScript is required to submit this no-login reservation. Complete prices and terms remain available above; <a href="mailto:sales@silverbirchgrowth.com">Email sales</a> to reserve manually.</p></noscript></form></aside></div></main>
<footer class="fine">Silver Birch Growth Inc. · 777-2255B Queen St E, Toronto ON M4E 1G3 · <a href="mailto:sales@silverbirchgrowth.com">Email sales</a><p id="selectedSummary"></p></footer>
<script>
const form=document.querySelector("#reserve"),message=document.querySelector("#message"),idempotencyKey=crypto.randomUUID(),offers=${JSON.stringify(Object.fromEntries(PUBLIC_RESERVE_OFFERS.map((offer) => [offer.sku, offer])))};
function selected(){return offers[form.elements.sku.value]}function refresh(){const offer=selected();document.querySelector("#submit").textContent="Continue — $"+offer.dueTodayUsd.toLocaleString("en-US")+" USD";document.querySelector("#selectedSummary").textContent="SKU "+offer.sku+" · Offer "+offer.offerKey+" · Exactly $"+offer.dueTodayUsd.toLocaleString("en-US")+" USD due today and applied as media credit."}form.elements.sku.onchange=refresh;refresh();
async function quote(){const sku=form.elements.sku.value,format=form.elements.format_pref.value,days=document.querySelector("#days").value;const r=await fetch("/v1/quote?sku="+encodeURIComponent(sku)+"&format="+encodeURIComponent(format)+"&days="+days);return r.json()}
document.querySelector("#copy").onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(await quote(),null,2));message.textContent="Quote JSON copied."}catch{message.textContent="Unable to copy automatically. Open the machine catalog link to copy the contract."}};
form.onsubmit=async(e)=>{e.preventDefault();if(!document.querySelector("#terms").checked){message.textContent="Accept the draft terms before any charge.";return}message.textContent="Saving your reservation…";const data=Object.fromEntries(new FormData(form));delete data.terms;data.idempotency_key=idempotencyKey;if(!data.website_url)delete data.website_url;try{const r=await fetch("/v1/checkout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const out=await r.json();if(out.checkout_url){location.assign(out.checkout_url);return}message.textContent=(out.error||"Your hold was saved, but checkout is unavailable.")+(out.order_id?" Order: "+out.order_id:"")}catch{message.textContent="The reservation could not be submitted. No payment was claimed."}};
</script></body></html>`);
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
