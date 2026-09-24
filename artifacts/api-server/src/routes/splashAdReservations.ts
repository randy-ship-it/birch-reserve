import { randomBytes, timingSafeEqual } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  db,
  advertiserIntakesTable,
  splashAdReservationsTable,
  type SplashAdReservation,
} from "@workspace/db";
import {
  CreateSplashAdCheckoutBody,
  CreateSplashAdCheckoutResponse,
  CreateSplashAdReservationBody,
  CreateSplashAdReservationResponse,
  GetSplashAdReservationStatusQueryParams,
  GetSplashAdReservationStatusResponse,
  ReviewSplashAdReservationBody,
  ReviewSplashAdReservationHeader,
  ReviewSplashAdReservationParams,
  ReviewSplashAdReservationResponse,
  RecordSplashAdCreativeReceiptBody,
  RecordSplashAdCreativeReceiptParams,
  RecordSplashAdCreativeReceiptResponse,
} from "@workspace/api-zod";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import type Stripe from "stripe";
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  getStripeClient,
  isDefinitelyUncreatedStripeCheckoutError,
  isStripeSecretConfigured,
  retrieveStripeCheckoutSession,
} from "../lib/stripeClient";
import {
  approveSplashReservationWithCapacity,
  claimSplashReserveSeat,
  markSplashReservationFailedFromPaymentIntent,
  markSplashReservationPaidFromSession,
  markSplashReservationPaidFromPaymentIntent,
  recordSplashCreativeReceipt,
} from "../lib/splashReservationLifecycle";
import {
  getPayableReserveOffer,
  getPublicReserveOfferByKey,
  isPayableOfferKey,
  RESERVE_CURRENCY,
  reserveCheckoutLineItem,
  type ReserveOffer,
} from "../lib/reserveOffers";
import {
  getAuthorizedSalesStaff,
  requireSalesStaff,
} from "../lib/salesStaffAccess";
import { hasValidQaHeader } from "../lib/testTraffic";
import { attributionFrom } from "../lib/publicGuards";
import { markSplashReservationTestIfQa } from "../lib/splashTestTraffic";

const router: IRouter = Router();

type GoogleSheetsProxy = (
  path: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<Response>;

type SlackProxy = (
  path: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<Response>;
function headerValue(req: Request, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function adminSecretMatches(value: string): boolean {
  const expected = process.env.SPLASH_AD_ADMIN_SECRET ?? process.env.SESSION_SECRET;
  if (!expected) return false;

  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function createActivationToken(): string {
  return randomBytes(32).toString("base64url");
}

function configuredPublicAppUrl(): string | null {
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

function isStripePaymentConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_CHECKOUT_DISABLED !== "true" &&
      configuredPublicAppUrl() &&
      isStripeSecretConfigured(),
  );
}

function isReserveCheckoutConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_CHECKOUT_DISABLED !== "true" &&
      configuredPublicAppUrl() &&
      isStripeSecretConfigured(),
  );
}

function isPaidOfferKey(value: string): boolean {
  return isPayableOfferKey(value);
}

function isCheckoutAvailable(reservation: SplashAdReservation): boolean {
  return (
    (reservation.status === "approved" ||
      reservation.status === "payment_pending") &&
    ["unpaid", "failed", "checkout_created"].includes(reservation.paymentStatus) &&
    Boolean(reservation.activationToken) &&
    Boolean(
      getPayableReserveOffer(
        reservation.offerKey,
        reservation.amountCents,
        reservation.currency,
      ),
    ) &&
    isStripePaymentConfigured()
  );
}

function privateStatusView(reservation: SplashAdReservation) {
  const offer = getPayableReserveOffer(
    reservation.offerKey,
    reservation.amountCents,
    reservation.currency,
  );
  return {
    reservationId: reservation.id,
    status: reservation.status,
    paymentStatus: reservation.paymentStatus,
    creativeStatus: reservation.creativeStatus,
    amountCents: reservation.amountCents,
    currency: reservation.currency,
    offer: reservation.offerKey,
    offerName: offer?.name ?? "Historical reserve",
    checkoutAvailable: isCheckoutAvailable(reservation),
    createdAt: reservation.createdAt,
  };
}

function staffRecoveryView(reservation: SplashAdReservation) {
  return {
    reservationId: reservation.id,
    paymentStatus: reservation.paymentStatus,
    checkoutAttempt: reservation.checkoutAttempt,
    reconciliationRequired:
      reservation.paymentStatus === "checkout_creating" &&
      reservation.lifecycleReason === "checkout_reconciliation_required",
    recoveryError: reservation.checkoutRecoveryError,
    recoveryAttemptedAt: reservation.checkoutRecoveryAttemptedAt,
  };
}

function stripeConfigurationError(error: unknown): boolean {
  return error instanceof Error && error.message === "Stripe is not connected.";
}

function pipelineRow(reservation: SplashAdReservation): string[][] {
  return [
    [
      reservation.createdAt.toISOString(),
      reservation.id,
      reservation.status,
      reservation.email,
      reservation.adInterest,
      reservation.brandName ?? "",
      reservation.promotedOffer ?? "Exclusive high-value display reserve",
      reservation.websiteUrl ?? "",
      reservation.source,
      reservation.createdAt.toISOString(),
      "synced",
      reservation.lifecycleReason ?? "",
    ],
  ];
}

export async function appendReservationToPipeline(
  reservation: SplashAdReservation,
  proxyOverride?: GoogleSheetsProxy,
): Promise<"synced" | "disabled" | "not_configured"> {
  if (
    !proxyOverride &&
    process.env.SPLASH_PIPELINE_SYNC_DISABLED === "true"
  ) {
    return "disabled";
  }

  const spreadsheetId = process.env.SPLASH_PIPELINE_SPREADSHEET_ID;
  if (!spreadsheetId && !proxyOverride) {
    return "not_configured";
  }
  const targetSpreadsheetId = spreadsheetId ?? "test-spreadsheet";

  const proxy =
    proxyOverride ??
    ((path, options) => {
      const connectors = new ReplitConnectors();
      return connectors.proxy("google-sheet", path, options);
    });
   const range = encodeURIComponent("Reservations!A:L");
  const response = await proxy(
    `/v4/spreadsheets/${targetSpreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: pipelineRow(reservation),
      }),
    },
  );

  if (!response.ok) {
    const responseBody = (await response.text()).slice(0, 500);
    throw new Error(
      `Google Sheets append failed (${response.status}): ${responseBody}`,
    );
  }

  return "synced";
}

class PipelineReservationNotFoundError extends Error {}

export async function updateReservationInPipeline(
  reservation: SplashAdReservation,
  proxyOverride?: GoogleSheetsProxy,
): Promise<"synced" | "disabled" | "not_configured"> {
  if (
    !proxyOverride &&
    process.env.SPLASH_PIPELINE_SYNC_DISABLED === "true"
  ) {
    return "disabled";
  }

  const spreadsheetId = process.env.SPLASH_PIPELINE_SPREADSHEET_ID;
  if (!spreadsheetId && !proxyOverride) {
    return "not_configured";
  }
  const targetSpreadsheetId = spreadsheetId ?? "test-spreadsheet";
  const proxy =
    proxyOverride ??
    ((path, options) => {
      const connectors = new ReplitConnectors();
      return connectors.proxy("google-sheet", path, options);
    });
  const idRange = encodeURIComponent("Reservations!B:B");
  const lookupResponse = await proxy(
    `/v4/spreadsheets/${targetSpreadsheetId}/values/${idRange}`,
  );
  if (!lookupResponse.ok) {
    const responseBody = (await lookupResponse.text()).slice(0, 500);
    throw new Error(
      `Google Sheets lookup failed (${lookupResponse.status}): ${responseBody}`,
    );
  }
  const lookup = (await lookupResponse.json()) as { values?: unknown[][] };
  const rowIndex =
    lookup.values?.findIndex((row) => row[0] === reservation.id) ?? -1;
  if (rowIndex < 0) {
    throw new PipelineReservationNotFoundError(
      "Google Sheets reservation row was not found.",
    );
  }

  const rowNumber = rowIndex + 1;
  const updateRange = encodeURIComponent(
    `Reservations!A${rowNumber}:L${rowNumber}`,
  );
  const response = await proxy(
    `/v4/spreadsheets/${targetSpreadsheetId}/values/${updateRange}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: pipelineRow(reservation),
      }),
    },
  );
  if (!response.ok) {
    const responseBody = (await response.text()).slice(0, 500);
    throw new Error(
      `Google Sheets update failed (${response.status}): ${responseBody}`,
    );
  }
  return "synced";
}

let reservationPipelineAppender = appendReservationToPipeline;
let reservationPipelineUpdater = updateReservationInPipeline;

export function setReservationPipelineAppenderForTests(
  appender?: typeof appendReservationToPipeline,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Reservation pipeline appender overrides are test-only.");
  }
  reservationPipelineAppender = appender ?? appendReservationToPipeline;
}

export function setReservationPipelineUpdaterForTests(
  updater?: typeof updateReservationInPipeline,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Reservation pipeline updater overrides are test-only.");
  }
  reservationPipelineUpdater = updater ?? updateReservationInPipeline;
}

type PipelineSyncStatus = "synced" | "disabled" | "not_configured" | "failed";

function pipelineFingerprint(reservation: SplashAdReservation): string {
  return JSON.stringify([
    reservation.status,
    reservation.email,
    reservation.adInterest,
    reservation.brandName,
    reservation.promotedOffer,
    reservation.websiteUrl,
    reservation.source,
    reservation.lifecycleReason,
  ]);
}

async function syncCurrentReservationToPipeline(
  reservationId: string,
  mode: "append" | "update",
  options?: {
    append?: typeof appendReservationToPipeline;
    onError?: (message: string) => void;
  },
): Promise<PipelineSyncStatus> {
  let syncError: string | null = null;
  const result = await db.transaction(async (tx): Promise<PipelineSyncStatus> => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"splash_pipeline:" + reservationId}, 0))`,
    );
    const [current] = await tx
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservationId))
      .limit(1);
    if (!current) return "failed";

    try {
      const append = options?.append ?? reservationPipelineAppender;
      let written = current;
      let sheetSyncStatus: Exclude<PipelineSyncStatus, "failed">;
      if (mode === "append") {
        sheetSyncStatus = await append(written);
      } else {
        try {
          sheetSyncStatus = await reservationPipelineUpdater(written);
        } catch (error) {
          if (!(error instanceof PipelineReservationNotFoundError)) throw error;
          sheetSyncStatus = await append(written);
        }
      }

      if (sheetSyncStatus === "synced") {
        for (let correction = 0; correction < 3; correction += 1) {
          const [latest] = await tx
            .select()
            .from(splashAdReservationsTable)
            .where(eq(splashAdReservationsTable.id, reservationId))
            .limit(1);
          if (!latest) break;
          if (pipelineFingerprint(latest) === pipelineFingerprint(written)) {
            break;
          }
          sheetSyncStatus = await reservationPipelineUpdater(latest);
          written = latest;
        }
        const [latest] = await tx
          .select()
          .from(splashAdReservationsTable)
          .where(eq(splashAdReservationsTable.id, reservationId))
          .limit(1);
        if (
          latest &&
          pipelineFingerprint(latest) !== pipelineFingerprint(written)
        ) {
          throw new Error(
            "Reservation changed repeatedly while its pipeline row was syncing.",
          );
        }
      }

      await tx
        .update(splashAdReservationsTable)
        .set({ sheetSyncStatus, sheetSyncError: null })
        .where(eq(splashAdReservationsTable.id, reservationId));
      return sheetSyncStatus;
    } catch (error) {
      syncError =
        error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      await tx
        .update(splashAdReservationsTable)
        .set({ sheetSyncStatus: "failed", sheetSyncError: syncError })
        .where(eq(splashAdReservationsTable.id, reservationId));
      return "failed";
    }
  });
  if (syncError) {
    options?.onError?.(syncError);
  }
  return result;
}

export async function syncReservationUpdateToPipeline(
  reservation: SplashAdReservation,
  options?: {
    onError?: (message: string) => void;
  },
): Promise<PipelineSyncStatus> {
  return syncCurrentReservationToPipeline(reservation.id, "update", options);
}

export async function syncReservationToPipeline(
  reservation: SplashAdReservation,
  options?: {
    append?: typeof appendReservationToPipeline;
    onError?: (message: string) => void;
  },
): Promise<PipelineSyncStatus> {
  return syncCurrentReservationToPipeline(reservation.id, "append", options);
}

function reserveAlertText(reservation: SplashAdReservation): string {
  return [
    "New Birch Reserve inquiry",
    `Brand: ${reservation.brandName ?? "Not provided"}`,
    `Work email: ${reservation.email}`,
    `Website: ${reservation.websiteUrl ?? "Not provided"}`,
    `Buying path: ${reservation.adInterest}`,
    `Payment: ${reservation.paymentStatus}`,
  ].join("\n");
}

let reservationAlertSender = sendReservationSlackAlert;

export function setReservationAlertSenderForTests(
  sender?: typeof sendReservationSlackAlert,
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Reservation alert sender overrides are test-only.");
  }
  reservationAlertSender = sender ?? sendReservationSlackAlert;
}

function reservationAlertTimeoutMs(): number {
  const configured = Number(process.env.SPLASH_RESERVE_ALERT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 10_000)
    : 2_000;
}

async function findByActivationToken(token: string) {
  const [reservation] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.activationToken, token));
  return reservation;
}

function offerLineItem(
  offer: ReserveOffer,
): Stripe.Checkout.SessionCreateParams.LineItem {
  return reserveCheckoutLineItem(offer);
}

async function markPaymentFailedFromSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const reservationId = session.metadata?.reservationId;
  if (!reservationId) return;
  const rawAttempt = session.metadata?.checkoutAttempt ?? "";
  const checkoutAttempt = /^\d+$/.test(rawAttempt)
    ? Number.parseInt(rawAttempt, 10)
    : null;
  const unresolvedAttempt =
    checkoutAttempt !== null && Number.isSafeInteger(checkoutAttempt)
      ? and(
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          eq(splashAdReservationsTable.checkoutAttempt, checkoutAttempt),
        )
      : sql`false`;

  await db
    .update(splashAdReservationsTable)
    .set({ status: "approved", paymentStatus: "failed" })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservationId),
        eq(splashAdReservationsTable.status, "payment_pending"),
        or(
          and(
            eq(splashAdReservationsTable.paymentStatus, "checkout_created"),
            eq(splashAdReservationsTable.stripeCheckoutSessionId, session.id),
          ),
          unresolvedAttempt,
        ),
        ne(splashAdReservationsTable.paymentStatus, "paid"),
      ),
    );
}

/**
 * Process only validated Stripe events. The updates are intentionally
 * idempotent, so Stripe retries and duplicate deliveries are safe.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "payment_intent.succeeded") {
    await markSplashReservationPaidFromPaymentIntent(
      event.data.object as Stripe.PaymentIntent,
    );
    return;
  }
  if (event.type === "payment_intent.payment_failed") {
    await markSplashReservationFailedFromPaymentIntent(
      event.data.object as Stripe.PaymentIntent,
    );
    return;
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      await markSplashReservationPaidFromSession(session);
    }
    return;
  }

  if (event.type === "checkout.session.async_payment_failed") {
    await markPaymentFailedFromSession(event.data.object as Stripe.Checkout.Session);
  }
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string,
): Promise<void> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Stripe webhook is not configured.");
  }

  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  await processStripeEvent(event);
}

router.post(
  "/launch/splash/reserve",
  async (req, res): Promise<void> => {
    const parsed = CreateSplashAdReservationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid Splash Ad reservation fields." });
      return;
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const hasValidEmailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizedEmail,
    );
    if (!hasValidEmailShape) {
      res.status(400).json({ error: "Invalid Splash Ad reservation fields." });
      return;
    }
    const submittedWebsite = parsed.data.websiteUrl?.trim();
    if (submittedWebsite) {
      try {
        const website = new URL(submittedWebsite);
        if (website.protocol !== "https:" && website.protocol !== "http:") {
          throw new Error("Unsupported website protocol.");
        }
      } catch {
        res.status(400).json({ error: "Invalid Splash Ad reservation fields." });
        return;
      }
    }
    const capturedAt = new Date();
    const offer = getPublicReserveOfferByKey(parsed.data.offer);
    if (
      !offer ||
      parsed.data.expectedAmountCents !== offer.amountCents ||
      parsed.data.expectedCurrency !== RESERVE_CURRENCY
    ) {
      res.status(409).json({
        error: "The offer changed. Review the current price and submit again.",
      });
      return;
    }

    const { reservation } = await claimSplashReserveSeat({
        brandName: parsed.data.brandName.trim(),
        email: normalizedEmail,
        websiteUrl: submittedWebsite || null,
        adInterest: parsed.data.buyerPath ?? "display",
        promotedOffer: `Birch Reserve ${offer.name}`,
        status: "seat_held",
        offerKey: offer.offerKey,
        amountCents: offer.amountCents,
        currency: RESERVE_CURRENCY,
        source: "birch_reserve_public_checkout",
        followUpBy: capturedAt,
        sheetSyncStatus: "pending",
        paymentStatus: "unpaid",
        creativeStatus: "locked",
      });

    if (!reservation) {
      res.status(409).json({ error: "Birch Reserve is sold out." });
      return;
    }

    // 6:50pm test-traffic hygiene: mark only (seat logic untouched).
    await markSplashReservationTestIfQa(reservation.id, {
      qaHeader: hasValidQaHeader(req),
      email: normalizedEmail,
      name: parsed.data.brandName,
      attribution: attributionFrom(res),
      log: req.log,
    });

    await db.insert(advertiserIntakesTable).values({
      normalizedEmail,
      visitorType: "other",
      advertisingIntent: "interested",
      advertiserSize: null,
      operatingScope: null,
      adInterest:
        parsed.data.buyerPath === "auto_buy" ? "performance" : "display",
      source: "site_form",
      followUpConsent: true,
    });

    if (process.env.SPLASH_RESERVE_ALERTS_DISABLED !== "true") {
      void deliverReservationAlert(reservation, {
        send: reservationAlertSender,
        onError: (alertDeliveryError) => {
          req.log.warn(
            { reservationId: reservation.id, alertDeliveryError },
            "Splash Ad request stored but Slack alert delivery failed",
          );
        },
      }).catch((error) => {
        req.log.error(
          { err: error, reservationId: reservation.id },
          "Unable to record Splash Ad alert delivery state",
        );
      });
    }

    await syncReservationToPipeline(reservation, {
      onError: (sheetSyncError) => {
        req.log.warn(
          { reservationId: reservation.id, sheetSyncError },
          "Splash Ad request stored but pipeline sync failed",
        );
      },
    });

    req.log.info(
      { reservationId: reservation.id, offerKey: offer.offerKey },
      "Birch Reserve seat held",
    );

    const heldReceipt = {
      reservationId: reservation.id,
      status: "held_pending_payments" as const,
      checkoutUrl: null,
      amountCents: offer.amountCents,
      currency: RESERVE_CURRENCY,
      offer: offer.offerKey,
    };

    if (!isReserveCheckoutConfigured()) {
      res.status(202).json(CreateSplashAdReservationResponse.parse(heldReceipt));
      return;
    }

    const baseUrl = configuredPublicAppUrl();
    if (!baseUrl) {
      res.status(202).json(CreateSplashAdReservationResponse.parse(heldReceipt));
      return;
    }

    const [claimedReservation] = await db
      .update(splashAdReservationsTable)
      .set({
        status: "payment_pending",
        paymentStatus: "checkout_creating",
        checkoutAttempt: 1,
        checkoutRequest: {
          mode: "payment",
          client_reference_id: reservation.id,
          customer_email: reservation.email,
          line_items: [offerLineItem(offer)],
          metadata: {
            reservationId: reservation.id,
            offerKey: offer.offerKey,
            sku: offer.sku,
            checkoutAttempt: "1",
          },
          payment_intent_data: {
            metadata: {
              reservationId: reservation.id,
              offerKey: offer.offerKey,
              sku: offer.sku,
              checkoutAttempt: "1",
            },
          },
          success_url: `${baseUrl}/api/launch/splash/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/?reserve=cancelled`,
          allow_promotion_codes: false,
        },
        checkoutIdempotencyKey: `public-reserve:${reservation.id}`,
        checkoutAttemptStartedAt: new Date(),
        checkoutRecoveryError: null,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, reservation.id),
          eq(splashAdReservationsTable.status, "seat_held"),
          eq(splashAdReservationsTable.paymentStatus, "unpaid"),
        ),
      )
      .returning();
    if (!claimedReservation) {
      res.status(202).json(CreateSplashAdReservationResponse.parse(heldReceipt));
      return;
    }

    let createdSession: Stripe.Checkout.Session | undefined;
    try {
      const session = await createStripeCheckoutSession(
        claimedReservation.checkoutRequest as Stripe.Checkout.SessionCreateParams,
        claimedReservation.checkoutIdempotencyKey!,
      );
      createdSession = session;
      if (
        !session.url ||
        session.currency !== RESERVE_CURRENCY ||
        session.amount_total !== offer.amountCents
      ) {
        throw new Error("Stripe returned a checkout session that does not match the selected offer.");
      }

      const [checkoutReservation] = await db
        .update(splashAdReservationsTable)
        .set({
          status: "payment_pending",
          paymentStatus: "checkout_created",
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: session.url,
          checkoutAttempt: 1,
        })
        .where(
          and(
            eq(splashAdReservationsTable.id, reservation.id),
            eq(splashAdReservationsTable.status, "payment_pending"),
            eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            eq(splashAdReservationsTable.checkoutAttempt, 1),
          ),
        )
        .returning();

      if (!checkoutReservation) {
        await expireStripeCheckoutSession(session.id);
        await db
          .update(splashAdReservationsTable)
          .set({ status: "seat_held", paymentStatus: "failed" })
          .where(
            and(
              eq(splashAdReservationsTable.id, claimedReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
              eq(splashAdReservationsTable.checkoutAttempt, 1),
            ),
          );
        res.status(202).json(CreateSplashAdReservationResponse.parse(heldReceipt));
        return;
      }

      res.json(
        CreateSplashAdReservationResponse.parse({
          ...heldReceipt,
          status: "checkout_ready",
          checkoutUrl: session.url,
        }),
      );
    } catch (error) {
      if (createdSession) {
        let expired = false;
        try {
          await expireStripeCheckoutSession(createdSession.id);
          expired = true;
        } catch (expireError) {
          req.log.warn(
            {
              err: expireError,
              reservationId: claimedReservation.id,
              sessionId: createdSession.id,
            },
            "Unable to expire unattached public reserve checkout",
          );
        }
        await db
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
                  lifecycleReason: "checkout_reconciliation_required",
                },
          )
          .where(
            and(
              eq(splashAdReservationsTable.id, claimedReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
              eq(splashAdReservationsTable.checkoutAttempt, 1),
            ),
          );
      } else if (isDefinitelyUncreatedStripeCheckoutError(error)) {
        // Stripe rejected the create (for example an invalid Price ID), so no
        // session exists. Mark the claim failed so the unpaid-hold sweep
        // releases the seat instead of stranding it in checkout_creating.
        await db
          .update(splashAdReservationsTable)
          .set({
            status: "seat_held",
            paymentStatus: "failed",
            lifecycleReason: "checkout_create_rejected",
            checkoutRecoveryError: (error instanceof Error
              ? error.message
              : "Stripe rejected the checkout request."
            ).slice(0, 500),
          })
          .where(
            and(
              eq(splashAdReservationsTable.id, claimedReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
              eq(splashAdReservationsTable.checkoutAttempt, 1),
            ),
          );
      } else {
        await db
          .update(splashAdReservationsTable)
          .set({ lifecycleReason: "checkout_reconciliation_required" })
          .where(
            and(
              eq(splashAdReservationsTable.id, claimedReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
              eq(splashAdReservationsTable.checkoutAttempt, 1),
            ),
          );
      }
      req.log.error(
        { err: error, reservationId: reservation.id },
        "Reserve checkout unavailable; seat remains held",
      );
      res.status(202).json(CreateSplashAdReservationResponse.parse(heldReceipt));
    }
  },
);

router.get(
  "/launch/splash/checkout/return",
  async (req, res): Promise<void> => {
    const sessionId =
      typeof req.query.session_id === "string" ? req.query.session_id : "";
    if (!sessionId.startsWith("cs_")) {
      res.redirect("/?reserve=verification-pending");
      return;
    }

    try {
      const session = await retrieveStripeCheckoutSession(sessionId);
      if (session.payment_status === "paid") {
        await markSplashReservationPaidFromSession(session);
        res.redirect("/?reserve=confirmed");
        return;
      }
    } catch (error) {
      req.log.error(
        { err: error, sessionId },
        "Unable to confirm returning Stripe checkout",
      );
    }
    res.redirect("/?reserve=verification-pending");
  },
);

/**
 * Runtime checkout switch for the homepage CTAs (reads STRIPE_CHECKOUT_DISABLED and
 * Stripe config; never changes them). While false, Lock the seat / Hold open the
 * Randy chat callback intake instead of a dead checkout.
 */
router.get("/launch/checkout-status", (_req, res): void => {
  res.set("cache-control", "no-store");
  res.json({ checkoutEnabled: isReserveCheckoutConfigured() });
});

router.get("/launch/splash/status", async (req, res): Promise<void> => {
  const parsed = GetSplashAdReservationStatusQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  const reservation = await findByActivationToken(parsed.data.token);
  if (!reservation) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  res.json(GetSplashAdReservationStatusResponse.parse(privateStatusView(reservation)));
});

router.patch(
  "/launch/admin/splash/:reservationId/review",
  async (req, res): Promise<void> => {
    const params = ReviewSplashAdReservationParams.safeParse(req.params);
    const headers = ReviewSplashAdReservationHeader.safeParse({
      "x-splash-ad-admin-secret": headerValue(req, "x-splash-ad-admin-secret"),
    });
    const body = ReviewSplashAdReservationBody.safeParse(req.body);

    if (
      !params.success ||
      !isUuid(params.data.reservationId) ||
      !headers.success ||
      !adminSecretMatches(headers.data["x-splash-ad-admin-secret"])
    ) {
      res.status(401).json({ error: "Administrator authentication failed." });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: "Invalid review state." });
      return;
    }

    const [existing] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, params.data.reservationId));
    if (!existing) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    if (!isPaidOfferKey(existing.offerKey)) {
      res.status(409).json({ error: "Interest captures do not have a checkout flow." });
      return;
    }
    if (
      existing.paymentStatus === "paid" ||
      !["pending_review", "approved", "rejected"].includes(existing.status)
    ) {
      res.status(409).json({ error: "This request cannot be re-reviewed." });
      return;
    }

    let reservation: SplashAdReservation | undefined;
    if (body.data.status === "approved") {
      const approval = await approveSplashReservationWithCapacity(
        existing.id,
        existing.activationToken ?? createActivationToken(),
      );
      if (approval.kind === "sold_out") {
        res.status(409).json({ error: "Birch Reserve is sold out." });
        return;
      }
      if (approval.kind !== "approved") {
        res.status(409).json({ error: "This request changed before review completed." });
        return;
      }
      reservation = approval.reservation;
    } else {
      [reservation] = await db
        .update(splashAdReservationsTable)
        .set({
          status: "rejected",
          activationToken: null,
          inventoryHeldAt: null,
          paymentStatus: "unpaid",
          creativeStatus: "locked",
          stripeCheckoutSessionId: null,
          stripeCheckoutUrl: null,
          stripePaymentIntentId: null,
        })
        .where(
          and(
            eq(splashAdReservationsTable.id, existing.id),
            eq(splashAdReservationsTable.status, existing.status),
            ne(splashAdReservationsTable.paymentStatus, "paid"),
          ),
        )
        .returning();
    }

    if (!reservation) {
      res.status(409).json({ error: "This request changed before review completed." });
      return;
    }
    req.log.info(
      { reservationId: reservation.id, status: reservation.status },
      "Splash Ad request reviewed",
    );
    const activationBaseUrl = configuredPublicAppUrl();
    res.json(
      ReviewSplashAdReservationResponse.parse({
        reservationId: reservation.id,
        status: reservation.status,
        paymentStatus: "unpaid",
        creativeStatus: "locked",
        activationUrl:
          reservation.status === "approved" &&
          reservation.activationToken &&
          activationBaseUrl
            ? `${activationBaseUrl}/splash/activation?token=${encodeURIComponent(reservation.activationToken)}`
            : null,
      }),
    );
  },
);

router.get(
  "/launch/admin/splash/checkout-recovery",
  requireSalesStaff,
  async (_req, res): Promise<void> => {
    const unresolved = await db
      .select()
      .from(splashAdReservationsTable)
      .where(
        and(
          eq(splashAdReservationsTable.status, "payment_pending"),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
        ),
      );
    res.json({
      unresolved: unresolved.map(staffRecoveryView),
    });
  },
);

router.get(
  "/launch/admin/splash/:reservationId/checkout-recovery",
  requireSalesStaff,
  async (req, res): Promise<void> => {
    const reservationId = Array.isArray(req.params.reservationId)
      ? req.params.reservationId[0]
      : req.params.reservationId;
    if (!reservationId || !isUuid(reservationId)) {
      res.status(400).json({ error: "Invalid reservation." });
      return;
    }
    const [reservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservationId));
    if (!reservation) {
      res.status(404).json({ error: "Not found." });
      return;
    }
    res.json(staffRecoveryView(reservation));
  },
);

router.patch(
  "/launch/admin/splash/:reservationId/creative",
  requireSalesStaff,
  async (req, res): Promise<void> => {
    const params = RecordSplashAdCreativeReceiptParams.safeParse(req.params);
    const body = RecordSplashAdCreativeReceiptBody.safeParse(req.body);
    if (!params.success || !isUuid(params.data.reservationId) || !body.success) {
      res.status(400).json({ error: "Invalid creative receipt." });
      return;
    }

    const result = await recordSplashCreativeReceipt(
      params.data.reservationId,
      body.data.creativeStatus,
    );
    if (result.kind === "not_found") {
      res.status(404).json({ error: "Not found." });
      return;
    }
    if (result.kind === "not_eligible") {
      res.status(409).json({
        error: "Only a paid, active reservation can receive creative.",
      });
      return;
    }

    const staff = getAuthorizedSalesStaff(req);
    req.log.info(
      {
        reservationId: result.reservation.id,
        creativeStatus: result.reservation.creativeStatus,
        staffAccessId: staff.id,
        staffName: staff.displayName,
      },
      "Splash Ad creative receipt recorded",
    );
    res.json(
      RecordSplashAdCreativeReceiptResponse.parse({
        reservationId: result.reservation.id,
        status: result.reservation.status,
        paymentStatus: result.reservation.paymentStatus,
        creativeStatus: result.reservation.creativeStatus,
        recordedAt: result.reservation.updatedAt,
      }),
    );
  },
);

router.post("/launch/splash/checkout", async (req, res): Promise<void> => {
  const parsed = CreateSplashAdCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  const reservation = await findByActivationToken(parsed.data.activationToken);
  if (!reservation) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  if (!isPaidOfferKey(reservation.offerKey)) {
    res.status(409).json({ error: "Interest captures do not have a checkout flow." });
    return;
  }
  if (reservation.paymentStatus === "paid" || reservation.status === "paid") {
    res.status(409).json({ error: "Payment has already been received." });
    return;
  }
  if (
    !(reservation.status === "approved" || reservation.status === "payment_pending") ||
    !reservation.activationToken
  ) {
    res.status(409).json({ error: "This request is not approved for payment." });
    return;
  }
  const checkoutOffer = getPayableReserveOffer(
    reservation.offerKey,
    reservation.amountCents,
    reservation.currency,
  );
  if (!checkoutOffer) {
    res.status(409).json({ error: "This reservation uses an outdated price." });
    return;
  }
  if (!isStripePaymentConfigured()) {
    res.status(503).json({ error: "Secure payment is not configured." });
    return;
  }
  if (reservation.paymentStatus === "checkout_creating") {
    res.status(409).json({ error: "Secure checkout is being prepared. Please retry shortly." });
    return;
  }
  let checkoutReservation = reservation;
  if (
    reservation.stripeCheckoutSessionId &&
    reservation.stripeCheckoutUrl &&
    reservation.paymentStatus === "checkout_created"
  ) {
    try {
      const currentSession = await retrieveStripeCheckoutSession(
        reservation.stripeCheckoutSessionId,
      );
      if (
        currentSession.id !== reservation.stripeCheckoutSessionId ||
        currentSession.metadata?.reservationId !== reservation.id ||
        currentSession.metadata?.offerKey !== reservation.offerKey ||
        currentSession.currency !== reservation.currency ||
        currentSession.amount_total !== reservation.amountCents
      ) {
        res.status(409).json({
          error: "The existing checkout does not match this reservation. Please contact Birch Reserve.",
        });
        return;
      }
      if (currentSession.payment_status === "paid") {
        await markSplashReservationPaidFromSession(currentSession);
        res.status(409).json({ error: "Payment has already been received." });
        return;
      }
      if (currentSession.status === "open") {
        res.json(
          CreateSplashAdCheckoutResponse.parse({
            status: "payment_pending",
            checkoutUrl: reservation.stripeCheckoutUrl,
          }),
        );
        return;
      }
      if (currentSession.status === "complete") {
        res.status(409).json({
          error: "Payment is still processing. We will update this private activation link when it clears.",
        });
        return;
      }
      const [reopened] = await db
        .update(splashAdReservationsTable)
        .set({
          status: "approved",
          paymentStatus: "unpaid",
          stripeCheckoutSessionId: null,
          stripeCheckoutUrl: null,
        })
        .where(
          and(
            eq(splashAdReservationsTable.id, reservation.id),
            eq(splashAdReservationsTable.status, "payment_pending"),
            eq(
              splashAdReservationsTable.stripeCheckoutSessionId,
              reservation.stripeCheckoutSessionId,
            ),
            eq(splashAdReservationsTable.paymentStatus, "checkout_created"),
          ),
        )
        .returning();
      if (!reopened) {
        res.status(409).json({ error: "This checkout changed before it could be renewed." });
        return;
      }
      checkoutReservation = reopened;
    } catch (error) {
      if (stripeConfigurationError(error)) {
        res.status(503).json({ error: "Secure payment is not configured." });
        return;
      }
      req.log.error(
        { err: error, reservationId: reservation.id },
        "Unable to inspect existing Stripe checkout",
      );
      res.status(502).json({ error: "Unable to create secure checkout." });
      return;
    }
  }

  const baseUrl = configuredPublicAppUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "Secure payment is not configured." });
    return;
  }
  let createdSession: Stripe.Checkout.Session | undefined;
  let checkoutAttached = false;
  try {
    const nextAttempt = checkoutReservation.checkoutAttempt + 1;
    const checkoutRequest: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      client_reference_id: checkoutReservation.id,
      customer_email: checkoutReservation.email,
      line_items: [offerLineItem(checkoutOffer)],
      metadata: {
        reservationId: checkoutReservation.id,
        offerKey: checkoutOffer.offerKey,
        sku: checkoutOffer.sku,
        checkoutAttempt: String(nextAttempt),
      },
      payment_intent_data: {
        metadata: {
          reservationId: checkoutReservation.id,
          offerKey: checkoutOffer.offerKey,
          sku: checkoutOffer.sku,
          checkoutAttempt: String(nextAttempt),
        },
      },
      success_url: `${baseUrl}/splash/activation?token=${encodeURIComponent(parsed.data.activationToken)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/splash/activation?token=${encodeURIComponent(parsed.data.activationToken)}&cancelled=1`,
      allow_promotion_codes: false,
    };
    const checkoutIdempotencyKey = `splash-ad-checkout:${checkoutReservation.id}:${nextAttempt}`;
    const checkoutAttemptStartedAt = new Date();
    const [claimedReservation] = await db
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
          eq(splashAdReservationsTable.id, checkoutReservation.id),
          eq(splashAdReservationsTable.status, "approved"),
          inArray(splashAdReservationsTable.paymentStatus, ["unpaid", "failed"]),
          eq(
            splashAdReservationsTable.checkoutAttempt,
            checkoutReservation.checkoutAttempt,
          ),
        ),
      )
      .returning();
    if (!claimedReservation) {
      res.status(409).json({ error: "This request changed before checkout could begin." });
      return;
    }

    const session = await createStripeCheckoutSession(
      checkoutRequest,
      checkoutIdempotencyKey,
    );
    createdSession = session;
    if (
      !session.url ||
      session.currency !== claimedReservation.currency ||
      session.amount_total !== claimedReservation.amountCents
    ) {
      throw new Error("Stripe returned a checkout session that does not match the reservation.");
    }

    const [attachedReservation] = await db
      .update(splashAdReservationsTable)
      .set({
        status: "payment_pending",
        paymentStatus: "checkout_created",
        stripeCheckoutSessionId: session.id,
        stripeCheckoutUrl: session.url,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, claimedReservation.id),
          eq(splashAdReservationsTable.status, "payment_pending"),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          eq(splashAdReservationsTable.checkoutAttempt, nextAttempt),
        ),
      )
      .returning();
    if (!attachedReservation) {
      let expired = false;
      try {
        await expireStripeCheckoutSession(session.id);
        expired = true;
      } catch (expireError) {
        req.log.warn(
          { err: expireError, reservationId: claimedReservation.id, sessionId: session.id },
          "Unable to expire unclaimed Stripe checkout session",
        );
      }
      if (expired) {
        await db
          .update(splashAdReservationsTable)
          .set({ status: "approved", paymentStatus: "unpaid" })
          .where(
            and(
              eq(splashAdReservationsTable.id, claimedReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
              eq(splashAdReservationsTable.checkoutAttempt, nextAttempt),
            ),
          );
      } else {
        // Do not permit another checkout attempt until the existing Stripe
        // session is durably recoverable by its reservation and webhook.
        await db
          .update(splashAdReservationsTable)
          .set({
            paymentStatus: "checkout_created",
            stripeCheckoutSessionId: session.id,
            stripeCheckoutUrl: session.url,
          })
          .where(
            and(
              eq(splashAdReservationsTable.id, claimedReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
              eq(splashAdReservationsTable.checkoutAttempt, nextAttempt),
            ),
          );
      }
      res.status(409).json({
        error: "This checkout changed before it could be issued. Please contact Birch Reserve.",
      });
      return;
    }
    checkoutAttached = true;

    res.json(
      CreateSplashAdCheckoutResponse.parse({
        status: "payment_pending",
        checkoutUrl: session.url,
      }),
    );
  } catch (error) {
    if (createdSession && !checkoutAttached) {
      let expired = false;
      try {
        await expireStripeCheckoutSession(createdSession.id);
        expired = true;
      } catch (expireError) {
        req.log.error(
          {
            err: expireError,
            reservationId: checkoutReservation.id,
            sessionId: createdSession.id,
          },
          "Unable to expire Stripe checkout session after attachment failure",
        );
      }

      if (expired) {
        await db
          .update(splashAdReservationsTable)
          .set({ status: "approved", paymentStatus: "failed" })
          .where(
            and(
              eq(splashAdReservationsTable.id, checkoutReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            ),
          );
      } else {
        // Preserve the claim until the session can be reconciled from a
        // verified webhook. A new attempt here could create a duplicate charge.
        await db
          .update(splashAdReservationsTable)
          .set({
            paymentStatus: "checkout_created",
            stripeCheckoutSessionId: createdSession.id,
            stripeCheckoutUrl: createdSession.url,
          })
          .where(
            and(
              eq(splashAdReservationsTable.id, checkoutReservation.id),
              eq(splashAdReservationsTable.status, "payment_pending"),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            ),
          );
      }
    } else if (!checkoutAttached) {
      await db
        .update(splashAdReservationsTable)
        .set({ lifecycleReason: "checkout_reconciliation_required" })
        .where(
          and(
            eq(splashAdReservationsTable.id, checkoutReservation.id),
            eq(splashAdReservationsTable.status, "payment_pending"),
            eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          ),
        );
    }
    if (stripeConfigurationError(error)) {
      res.status(503).json({ error: "Secure payment is not configured." });
      return;
    }
    req.log.error({ err: error, reservationId: reservation.id }, "Checkout creation failed");
    res.status(502).json({ error: "Unable to create secure checkout." });
  }
});

export default router;

export async function deliverReservationAlert(
  reservation: SplashAdReservation,
  options?: {
    send?: typeof sendReservationSlackAlert;
    onError?: (message: string) => void;
  },
): Promise<"sent" | "failed"> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      (options?.send ?? sendReservationSlackAlert)(reservation),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Slack alert delivery timed out")),
          reservationAlertTimeoutMs(),
        );
      }),
    ]);
    await db
      .update(splashAdReservationsTable)
      .set({
        alertDeliveryStatus: "sent",
        alertDeliveryError: null,
        alertDeliveredAt: new Date(),
      })
      .where(eq(splashAdReservationsTable.id, reservation.id));
    return "sent";
  } catch (error) {
    const alertDeliveryError =
      error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
    await db
      .update(splashAdReservationsTable)
      .set({
        alertDeliveryStatus: "failed",
        alertDeliveryError,
        alertDeliveredAt: null,
      })
      .where(eq(splashAdReservationsTable.id, reservation.id));
    options?.onError?.(alertDeliveryError);
    return "failed";
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const RESERVE_ALERT_SLACK_CHANNEL =
  process.env.SPLASH_RESERVE_SLACK_CHANNEL_ID?.trim() || "C0AUSTA1V9D";

export async function sendReservationSlackAlert(
  reservation: SplashAdReservation,
  proxyOverride?: SlackProxy,
): Promise<void> {
  const proxy =
    proxyOverride ??
    ((path, options) => {
      const connectors = new ReplitConnectors();
      return connectors.proxy("slack", path, options);
    });
  const response = await proxy("/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: RESERVE_ALERT_SLACK_CHANNEL,
      text: reserveAlertText(reservation),
    }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || body.ok !== true) {
    throw new Error(
      `Slack alert failed (${response.status}): ${body.error ?? "unknown_error"}`,
    );
  }
}
