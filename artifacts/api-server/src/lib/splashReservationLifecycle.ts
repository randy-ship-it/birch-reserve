import {
  db,
  type WorkspaceDatabase,
  splashAdReservationsTable,
  ucpAgentCheckoutIdempotencyTable,
  ucpAgentIdentityEnrollmentsTable,
  type InsertSplashAdReservation,
  type SplashAdReservation,
} from "@workspace/db";
import { and, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  retrieveStripePaymentIntent,
  retrieveStripeCheckoutSession,
} from "./stripeClient";
import {
  INVENTORY_OFFER_KEYS,
  getPayableReserveOffer,
  isInventoryOfferKey,
} from "./reserveOffers";
import {
  deliverCreativeDeadlineWarning,
  type CreativeDeadlineWarningSender,
} from "./splashAdReserveAlerts";
export const SPLASH_RESERVE_HOLD_TTL_MS = 20 * 60 * 1000;

export type UcpLegacyPublicIdempotencyCandidate = {
  agentIdentityHash: string;
  publicIdempotencyKey: string;
  storedAgentIdentityHash?: string;
  legacyProfileUrl?: string;
};
const CREATIVE_TTL_MS = 72 * 60 * 60 * 1000;

export const STRIPE_IDEMPOTENCY_REPLAY_WINDOW_MS = 23 * 60 * 60 * 1000;

const CREATIVE_WARNING_LEAD_MS = 24 * 60 * 60 * 1000;
const inventoryHeldSince = sql<Date>`coalesce(${splashAdReservationsTable.inventoryHeldAt}, ${splashAdReservationsTable.createdAt})`;

type StripeSessionReader = (id: string) => Promise<Stripe.Checkout.Session>;
type StripeSessionExpirer = (id: string) => Promise<void>;

export type SplashLifecycleResult = {
  expiredUnpaid: number;
  recycledPaid: number;
  creativeWarningsSent: number;
  creativeWarningsFailed: number;
  skippedProcessing: number;
  reconciledCheckouts: number;
};

export type SplashSeatCounts = {
  seats_total: number;
  seats_paid: number;
  seats_held: number;
  seats_open: number;
};

export type SplashCreativeReceiptResult =
  | { kind: "recorded"; reservation: SplashAdReservation }
  | { kind: "not_found" }
  | { kind: "not_eligible" };

export type SplashApprovalResult =
  | { kind: "approved"; reservation: SplashAdReservation }
  | { kind: "not_found" | "not_eligible" | "sold_out" | "conflict" };

export type SplashCancellationResult =
  | { kind: "canceled"; reservation: SplashAdReservation }
  | { kind: "terminal"; reservation: SplashAdReservation }
  | { kind: "not_found" }
  | { kind: "not_eligible" }
  | { kind: "conflict" };

export function stripeSessionMatchesReservation(
  session: Stripe.Checkout.Session,
  reservation: SplashAdReservation,
): boolean {
  if (
    session.metadata?.reservationId !== reservation.id ||
    session.metadata?.offerKey !== reservation.offerKey ||
    session.currency !== reservation.currency ||
    session.amount_total !== reservation.amountCents
  ) {
    return false;
  }

  if (reservation.source !== "birch_reserve_v1_checkout") return true;

  const offer = getPayableReserveOffer(
    reservation.offerKey,
    reservation.amountCents,
    reservation.currency,
  );
  return (
    offer !== null &&
    session.client_reference_id === reservation.id &&
    session.metadata?.sku === offer.sku &&
    session.metadata?.checkoutAttempt === String(reservation.checkoutAttempt)
  );
}
function configuredSeatTotal(): number {
  const configured = Number.parseInt(process.env.SEATS_TOTAL ?? "8", 10);
  return Number.isFinite(configured) ? Math.max(0, configured) : 8;
}

function seatCounts(rows: Array<Pick<SplashAdReservation, "status" | "paymentStatus">>): SplashSeatCounts {
  const paid = rows.filter(
    (row) =>
      (row.paymentStatus === "paid" || row.status === "paid") &&
      !["recycled", "rejected", "expired"].includes(row.status),
  ).length;
  const held = rows.filter(
    (row) =>
      row.paymentStatus !== "paid" &&
      ["seat_held", "held_pending_payments", "payment_pending", "approved"].includes(
        row.status,
      ),
  ).length;
  const total = configuredSeatTotal();
  return {
    seats_total: total,
    seats_paid: paid,
    seats_held: held,
    seats_open: Math.max(0, total - paid - held),
  };
}

export async function getSplashSeatCounts(): Promise<SplashSeatCounts> {
  const rows = await db
    .select({
      status: splashAdReservationsTable.status,
      paymentStatus: splashAdReservationsTable.paymentStatus,
    })
    .from(splashAdReservationsTable)
    .where(inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS));
  return seatCounts(rows);
}

export async function claimSplashReserveSeat(
  values: InsertSplashAdReservation,
  database: WorkspaceDatabase = db,
  ucpIdempotency?: {
    agentIdentityHash: string;
    authorizedAgentIdentityHashes: string[];
    idempotencyKeyHash: string;
    legacyPublicIdempotencyKeys: UcpLegacyPublicIdempotencyCandidate[];
  },
): Promise<{ reservation: SplashAdReservation | null; created: boolean }> {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('birch_reserve_inventory', 0))`,
    );

    if (ucpIdempotency) {
      const mappings = await tx
        .select({
          reservationId: ucpAgentCheckoutIdempotencyTable.reservationId,
        })
        .from(ucpAgentCheckoutIdempotencyTable)
        .where(
          and(
            eq(
              ucpAgentCheckoutIdempotencyTable.idempotencyKeyHash,
              ucpIdempotency.idempotencyKeyHash,
            ),
            inArray(
              ucpAgentCheckoutIdempotencyTable.agentIdentityHash,
              ucpIdempotency.authorizedAgentIdentityHashes,
            ),
          ),
        );
      const reservationIds = [...new Set(mappings.map((row) => row.reservationId))];
      if (reservationIds.length > 1) {
        throw new Error("UCP idempotency lineage maps to multiple reservations.");
      }
      const reservationId = reservationIds[0];
      if (reservationId) {
        const [existing] = await tx
          .select()
          .from(splashAdReservationsTable)
          .where(eq(splashAdReservationsTable.id, reservationId))
          .limit(1);
        if (!existing) {
          throw new Error("UCP idempotency mapping has no reservation.");
        }
        await tx
          .insert(ucpAgentCheckoutIdempotencyTable)
          .values(
            ucpIdempotency.authorizedAgentIdentityHashes.map(
              (agentIdentityHash) => ({
                agentIdentityHash,
                idempotencyKeyHash: ucpIdempotency.idempotencyKeyHash,
                reservationId,
              }),
            ),
          )
          .onConflictDoNothing();
        return { reservation: existing, created: false };
      }

      const legacyIdentityByPublicKey = new Map<
        string,
        UcpLegacyPublicIdempotencyCandidate
      >();
      for (const candidate of ucpIdempotency.legacyPublicIdempotencyKeys) {
        const existingCandidate = legacyIdentityByPublicKey.get(
          candidate.publicIdempotencyKey,
        );
        if (
          existingCandidate &&
          (existingCandidate.agentIdentityHash !== candidate.agentIdentityHash ||
            existingCandidate.storedAgentIdentityHash !==
              candidate.storedAgentIdentityHash ||
            existingCandidate.legacyProfileUrl !== candidate.legacyProfileUrl)
        ) {
          throw new Error(
            "UCP legacy idempotency key maps to multiple identities.",
          );
        }
        legacyIdentityByPublicKey.set(
          candidate.publicIdempotencyKey,
          candidate,
        );
      }
      const legacyPublicIdempotencyKeys = [
        ...legacyIdentityByPublicKey.keys(),
      ];
      const storedAgentIdentityHashes = [
        ...new Set(
          [...legacyIdentityByPublicKey.values()].map(
            (candidate) =>
              candidate.storedAgentIdentityHash ??
              candidate.agentIdentityHash,
          ),
        ),
      ];
      if (legacyPublicIdempotencyKeys.length > 0) {
        const legacyReservations = await tx
          .select()
          .from(splashAdReservationsTable)
          .where(
            and(
              inArray(
                splashAdReservationsTable.publicIdempotencyKey,
                legacyPublicIdempotencyKeys,
              ),
              or(
                isNull(splashAdReservationsTable.ucpAgentIdentityHash),
                inArray(
                  splashAdReservationsTable.ucpAgentIdentityHash,
                  storedAgentIdentityHashes,
                ),
              ),
            ),
          );
        if (legacyReservations.length > 1) {
          throw new Error(
            "UCP legacy idempotency lineage maps to multiple reservations.",
          );
        }
        let [legacyReservation] = legacyReservations;
        if (legacyReservation) {
          const matchedCandidate = legacyReservation.publicIdempotencyKey
            ? legacyIdentityByPublicKey.get(
                legacyReservation.publicIdempotencyKey,
              )
            : undefined;
          if (!matchedCandidate) {
            throw new Error(
              "UCP legacy reservation cannot be attributed to an identity.",
            );
          }
          const storedAgentIdentityHash =
            matchedCandidate.storedAgentIdentityHash ??
            matchedCandidate.agentIdentityHash;
          if (
            legacyReservation.ucpAgentIdentityHash !== null &&
            legacyReservation.ucpAgentIdentityHash !== storedAgentIdentityHash
          ) {
            throw new Error(
              "UCP legacy reservation owner does not match its idempotency identity.",
            );
          }
          const mustBindIdentity =
            legacyReservation.ucpAgentIdentityHash !==
            matchedCandidate.agentIdentityHash;
          const mustEnrollProfile =
            Boolean(matchedCandidate.legacyProfileUrl) &&
            (legacyReservation.ucpAgentProfileUrl === null ||
              legacyReservation.ucpAgentPublicKey === null);
          if (mustBindIdentity || mustEnrollProfile) {
            const existingIdentityHash =
              legacyReservation.ucpAgentIdentityHash;
            const [boundReservation] = await tx
              .update(splashAdReservationsTable)
              .set({
                ucpAgentIdentityHash: matchedCandidate.agentIdentityHash,
                ...(matchedCandidate.legacyProfileUrl
                  ? {
                      ucpAgentProfileUrl: matchedCandidate.legacyProfileUrl,
                      ucpAgentPublicKey: values.ucpAgentPublicKey ?? null,
                    }
                  : {}),
              })
              .where(
                and(
                  eq(splashAdReservationsTable.id, legacyReservation.id),
                  eq(
                    splashAdReservationsTable.publicIdempotencyKey,
                    matchedCandidate.publicIdempotencyKey,
                  ),
                  existingIdentityHash === null
                    ? isNull(splashAdReservationsTable.ucpAgentIdentityHash)
                    : eq(
                        splashAdReservationsTable.ucpAgentIdentityHash,
                        existingIdentityHash,
                      ),
                ),
              )
              .returning();
            if (!boundReservation) {
              throw new Error(
                "UCP legacy reservation ownership changed during adoption.",
              );
            }
            legacyReservation = boundReservation;
          }
          if (matchedCandidate.legacyProfileUrl) {
            await tx
              .insert(ucpAgentIdentityEnrollmentsTable)
              .values({
                reservationId: legacyReservation.id,
                profileUrl: matchedCandidate.legacyProfileUrl,
                previousIdentityHash: storedAgentIdentityHash,
                replacementIdentityHash: matchedCandidate.agentIdentityHash,
                recoveryProofHash: ucpIdempotency.idempotencyKeyHash,
              })
              .onConflictDoNothing();
          }
          await tx
            .insert(ucpAgentCheckoutIdempotencyTable)
            .values(
              ucpIdempotency.authorizedAgentIdentityHashes.map(
                (agentIdentityHash) => ({
                  agentIdentityHash,
                  idempotencyKeyHash: ucpIdempotency.idempotencyKeyHash,
                  reservationId: legacyReservation.id,
                }),
              ),
            )
            .onConflictDoNothing();
          return { reservation: legacyReservation, created: false };
        }
      }
    } else if (values.publicIdempotencyKey) {
      const [existing] = await tx
        .select()
        .from(splashAdReservationsTable)
        .where(
          eq(
            splashAdReservationsTable.publicIdempotencyKey,
            values.publicIdempotencyKey,
          ),
        )
        .limit(1);
      if (existing) return { reservation: existing, created: false };
    }

    const rows = await tx
      .select({
        status: splashAdReservationsTable.status,
        paymentStatus: splashAdReservationsTable.paymentStatus,
      })
      .from(splashAdReservationsTable)
      .where(inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS));
    if (seatCounts(rows).seats_open < 1) {
      return { reservation: null, created: false };
    }

    const [reservation] = await tx
      .insert(splashAdReservationsTable)
      .values({
        ...values,
        inventoryHeldAt: values.inventoryHeldAt ?? new Date(),
      })
      .returning();
    if (reservation && ucpIdempotency) {
      await tx.insert(ucpAgentCheckoutIdempotencyTable).values(
        ucpIdempotency.authorizedAgentIdentityHashes.map(
          (agentIdentityHash) => ({
            agentIdentityHash,
            idempotencyKeyHash: ucpIdempotency.idempotencyKeyHash,
            reservationId: reservation.id,
          }),
        ),
      );
    }
    return { reservation: reservation ?? null, created: Boolean(reservation) };
  });
}

export async function approveSplashReservationWithCapacity(
  reservationId: string,
  activationToken: string,
): Promise<SplashApprovalResult> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('birch_reserve_inventory', 0))`,
    );

    const [existing] = await tx
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservationId));
    if (!existing) return { kind: "not_found" as const };
    if (
      !isInventoryOfferKey(existing.offerKey) ||
      existing.paymentStatus === "paid" ||
      !["pending_review", "approved", "rejected"].includes(existing.status)
    ) {
      return { kind: "not_eligible" as const };
    }

    if (existing.status !== "approved") {
      const rows = await tx
        .select({
          status: splashAdReservationsTable.status,
          paymentStatus: splashAdReservationsTable.paymentStatus,
        })
        .from(splashAdReservationsTable)
        .where(inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS));
      if (seatCounts(rows).seats_open < 1) {
        return { kind: "sold_out" as const };
      }
    }

    const [reservation] = await tx
      .update(splashAdReservationsTable)
      .set({
        status: "approved",
        activationToken: existing.activationToken ?? activationToken,
        inventoryHeldAt:
          existing.status === "approved"
            ? existing.inventoryHeldAt
            : new Date(),
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
          eq(splashAdReservationsTable.paymentStatus, existing.paymentStatus),
        ),
      )
      .returning();
    return reservation
      ? { kind: "approved" as const, reservation }
      : { kind: "conflict" as const };
  });
}

export async function markSplashReservationPaidFromSession(
  session: Stripe.Checkout.Session,
  database: WorkspaceDatabase = db,
): Promise<"paid" | "ignored"> {
  const reservationId = session.metadata?.reservationId;
  if (!reservationId) return "ignored";

  const [reservation] = await database
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservationId));
  if (!reservation || !stripeSessionMatchesReservation(session, reservation)) {
    return "ignored";
  }
  if (
    reservation.paymentStatus === "paid" &&
    reservation.stripeCheckoutSessionId === session.id
  ) {
    return "paid";
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const checkoutEmail =
    session.customer_details?.email ?? session.customer_email ?? null;
  const [paid] = await database
    .update(splashAdReservationsTable)
    .set({
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      paidAt: new Date(),
      expiredAt: null,
      recycledAt: null,
      lifecycleReason: null,
      ...(reservation.email.endsWith("@buyer.invalid") &&
      checkoutEmail &&
      checkoutEmail.length <= 320
        ? { email: checkoutEmail.trim().toLowerCase() }
        : {}),
    })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservationId),
        inArray(splashAdReservationsTable.status, ["payment_pending", "expired"]),
        or(
          and(
            eq(splashAdReservationsTable.paymentStatus, "checkout_created"),
            eq(splashAdReservationsTable.stripeCheckoutSessionId, session.id),
          ),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          and(
            eq(splashAdReservationsTable.paymentStatus, "failed"),
            eq(splashAdReservationsTable.stripeCheckoutSessionId, session.id),
          ),
        ),
        ne(splashAdReservationsTable.paymentStatus, "paid"),
      ),
    )
    .returning({ id: splashAdReservationsTable.id });
  return paid ? "paid" : "ignored";
}

export async function markSplashReservationPaidFromPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
): Promise<"paid" | "ignored"> {
  const reservationId = paymentIntent.metadata?.reservationId;
  if (!reservationId || paymentIntent.status !== "succeeded") return "ignored";
  const [reservation] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservationId));
  if (
    !reservation ||
    reservation.source !== "birch_reserve_v1_checkout" ||
    paymentIntent.amount !== reservation.amountCents ||
    paymentIntent.currency !== reservation.currency ||
    paymentIntent.metadata?.offerKey !== reservation.offerKey ||
    paymentIntent.metadata?.ucpHandler !== "com.stripe.payments" ||
    paymentIntent.metadata?.checkoutAttempt !== String(reservation.checkoutAttempt)
  ) {
    return "ignored";
  }
  if (
    reservation.paymentStatus === "paid" &&
    reservation.stripePaymentIntentId === paymentIntent.id
  ) {
    return "paid";
  }
  const [paid] = await db
    .update(splashAdReservationsTable)
    .set({
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      stripePaymentIntentId: paymentIntent.id,
      paidAt: new Date(),
      expiredAt: null,
      recycledAt: null,
      lifecycleReason: null,
    })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservation.id),
        inArray(splashAdReservationsTable.status, ["payment_pending", "expired"]),
        inArray(splashAdReservationsTable.paymentStatus, [
          "checkout_creating",
          "failed",
        ]),
        ne(splashAdReservationsTable.paymentStatus, "paid"),
      ),
    )
    .returning({ id: splashAdReservationsTable.id });
  return paid ? "paid" : "ignored";
}
export async function cancelSplashReservation(
  reservationId: string,
  options: {
    now?: Date;
    retrieveSession?: StripeSessionReader;
    expireSession?: StripeSessionExpirer;
    database?: WorkspaceDatabase;
  } = {},
): Promise<SplashCancellationResult> {
  const database = options.database ?? db;
  const [existing] = await database
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservationId))
    .limit(1);
  if (!existing) return { kind: "not_found" };
  if (
    existing.source !== "birch_reserve_v1_checkout" ||
    !isInventoryOfferKey(existing.offerKey)
  ) {
    return { kind: "not_eligible" };
  }
  if (
    existing.paymentStatus === "paid" ||
    ["paid", "recycled", "rejected", "expired", "live", "completed"].includes(
      existing.status,
    )
  ) {
    return { kind: "terminal", reservation: existing };
  }
  if (
    !["seat_held", "held_pending_payments", "payment_pending", "approved"].includes(
      existing.status,
    ) ||
    !["unpaid", "failed", "checkout_created"].includes(existing.paymentStatus)
  ) {
    return { kind: "not_eligible" };
  }

  if (existing.stripeCheckoutSessionId) {
    const retrieveSession =
      options.retrieveSession ?? retrieveStripeCheckoutSession;
    const expireSession =
      options.expireSession ??
      (async (sessionId: string) => {
        await expireStripeCheckoutSession(sessionId);
      });
    const session = await retrieveSession(existing.stripeCheckoutSessionId);
    if (!stripeSessionMatchesReservation(session, existing)) {
      return { kind: "conflict" };
    }
    if (session.payment_status === "paid") {
      await markSplashReservationPaidFromSession(session, database);
      const [paid] = await database
        .select()
        .from(splashAdReservationsTable)
        .where(eq(splashAdReservationsTable.id, reservationId))
        .limit(1);
      return paid
        ? { kind: "terminal", reservation: paid }
        : { kind: "not_found" };
    }
    if (session.status === "complete") return { kind: "conflict" };
    if (session.status === "open") await expireSession(session.id);
    else if (session.status !== "expired") return { kind: "conflict" };
  }

  const now = options.now ?? new Date();
  const [canceled] = await database
    .update(splashAdReservationsTable)
    .set({
      status: "expired",
      expiredAt: now,
      lifecycleReason: "buyer_agent_canceled",
      stripeCheckoutUrl: null,
    })
    .where(
      and(
        eq(splashAdReservationsTable.id, existing.id),
        inArray(splashAdReservationsTable.status, [
          "seat_held",
          "held_pending_payments",
          "payment_pending",
          "approved",
        ]),
        inArray(splashAdReservationsTable.paymentStatus, [
          "unpaid",
          "failed",
          "checkout_created",
        ]),
        existing.stripeCheckoutSessionId
          ? eq(
              splashAdReservationsTable.stripeCheckoutSessionId,
              existing.stripeCheckoutSessionId,
            )
          : isNull(splashAdReservationsTable.stripeCheckoutSessionId),
      ),
    )
    .returning();
  if (canceled) return { kind: "canceled", reservation: canceled };

  const [current] = await database
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservationId))
    .limit(1);
  if (
    current &&
    (current.paymentStatus === "paid" ||
      ["paid", "recycled", "rejected", "expired", "live", "completed"].includes(
        current.status,
      ))
  ) {
    return { kind: "terminal", reservation: current };
  }
  return current ? { kind: "conflict" } : { kind: "not_found" };
}

export async function recordSplashCreativeReceipt(
  reservationId: string,
  creativeStatus: "submitted" | "approved",
): Promise<SplashCreativeReceiptResult> {
  const [existing] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservationId));
  if (!existing) return { kind: "not_found" };
  if (existing.status !== "paid" || existing.paymentStatus !== "paid") {
    return { kind: "not_eligible" };
  }

  const rank = { awaiting_upload: 0, submitted: 1, approved: 2 } as const;
  const currentRank =
    existing.creativeStatus in rank
      ? rank[existing.creativeStatus as keyof typeof rank]
      : -1;
  if (currentRank >= rank[creativeStatus]) {
    return { kind: "recorded", reservation: existing };
  }

  const [updated] = await db
    .update(splashAdReservationsTable)
    .set({ creativeStatus })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservationId),
        eq(splashAdReservationsTable.status, "paid"),
        eq(splashAdReservationsTable.paymentStatus, "paid"),
        eq(splashAdReservationsTable.creativeStatus, existing.creativeStatus),
      ),
    )
    .returning();
  if (updated) return { kind: "recorded", reservation: updated };

  const [current] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservationId));
  if (
    current?.status === "paid" &&
    current.paymentStatus === "paid" &&
    current.creativeStatus in rank &&
    rank[current.creativeStatus as keyof typeof rank] >= rank[creativeStatus]
  ) {
    return { kind: "recorded", reservation: current };
  }
  return { kind: current ? "not_eligible" : "not_found" };
}

async function expireUnpaidRow(
  reservation: SplashAdReservation,
  cutoff: Date,
  now: Date,
  retrieveSession: StripeSessionReader,
  expireSession: StripeSessionExpirer,
): Promise<"expired" | "skipped"> {
  if (reservation.stripeCheckoutSessionId) {
    const session = await retrieveSession(reservation.stripeCheckoutSessionId);
    if (session.payment_status === "paid") {
      await markSplashReservationPaidFromSession(session);
      return "skipped";
    }
    if (
      session.status === "complete" &&
      reservation.paymentStatus !== "failed"
    ) {
      return "skipped";
    }
    if (session.status === "open") {
      await expireSession(session.id);
    }
  }

  const [expired] = await db
    .update(splashAdReservationsTable)
    .set({
      status: "expired",
      expiredAt: now,
      lifecycleReason: "unpaid_hold_timeout",
      stripeCheckoutUrl: null,
    })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservation.id),
        inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS),
        lt(inventoryHeldSince, cutoff),
        inArray(splashAdReservationsTable.status, [
          "seat_held",
          "held_pending_payments",
          "payment_pending",
          "approved",
        ]),
        or(
          inArray(splashAdReservationsTable.paymentStatus, [
            "unpaid",
            "failed",
            "checkout_created",
          ]),
        ),
        reservation.stripeCheckoutSessionId
          ? eq(
              splashAdReservationsTable.stripeCheckoutSessionId,
              reservation.stripeCheckoutSessionId,
            )
          : isNull(splashAdReservationsTable.stripeCheckoutSessionId),
      ),
    )
    .returning({ id: splashAdReservationsTable.id });
  return expired ? "expired" : "skipped";
}

function recoveryError(error: unknown): string {
  return (error instanceof Error ? error.message : "Unknown Stripe recovery error").slice(
    0,
    500,
  );
}
export async function cleanupSplashReservations(
  options: {
    now?: Date;
    retrieveSession?: StripeSessionReader;
    expireSession?: StripeSessionExpirer;
    reservationIds?: string[];
    afterCandidatesSelected?: () => Promise<void>;
    sendCreativeDeadlineWarning?: CreativeDeadlineWarningSender;
  } = {},
): Promise<SplashLifecycleResult> {
  const now = options.now ?? new Date();
  const holdCutoff = new Date(
    now.getTime() - SPLASH_RESERVE_HOLD_TTL_MS,
  );
  const creativeCutoff = new Date(now.getTime() - CREATIVE_TTL_MS);
  const creativeWarningCutoff = new Date(
    now.getTime() - (CREATIVE_TTL_MS - CREATIVE_WARNING_LEAD_MS),
  );
  const retrieveSession = options.retrieveSession ?? retrieveStripeCheckoutSession;
  const expireSession: StripeSessionExpirer =
    options.expireSession ??
    (async (sessionId) => {
      await expireStripeCheckoutSession(sessionId);
    });

  const unresolvedClaims = await db
    .select()
    .from(splashAdReservationsTable)
    .where(
      and(
        inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS),
        eq(splashAdReservationsTable.status, "payment_pending"),
        eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
        lt(splashAdReservationsTable.updatedAt, holdCutoff),
        options.reservationIds
          ? inArray(splashAdReservationsTable.id, options.reservationIds)
          : undefined,
      ),
    );

  let reconciledCheckouts = 0;
  let unresolvedCheckouts = 0;
  for (const reservation of unresolvedClaims) {
    const result = await reconcileCheckoutCreation(reservation, now);
    if (result === "reconciled") reconciledCheckouts += 1;
    else unresolvedCheckouts += 1;
  }

  const candidates = await db
    .select()
    .from(splashAdReservationsTable)
    .where(
      and(
        inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS),
        lt(inventoryHeldSince, holdCutoff),
        inArray(splashAdReservationsTable.status, [
          "seat_held",
          "held_pending_payments",
          "payment_pending",
          "approved",
        ]),
        inArray(splashAdReservationsTable.paymentStatus, [
          "unpaid",
          "failed",
          "checkout_created",
        ]),
        options.reservationIds
          ? inArray(splashAdReservationsTable.id, options.reservationIds)
          : undefined,
      ),
    );
  await options.afterCandidatesSelected?.();

  let expiredUnpaid = 0;
  let skippedProcessing = unresolvedCheckouts;
  for (const reservation of candidates) {
    try {
      const result = await expireUnpaidRow(
        reservation,
        holdCutoff,
        now,
        retrieveSession,
        expireSession,
      );
      if (result === "expired") expiredUnpaid += 1;
      else skippedProcessing += 1;
    } catch {
      // A Stripe read/expire failure leaves the hold in place. Reopening
      // inventory while its checkout remains payable could oversell the pool.
      skippedProcessing += 1;
    }
  }

  let creativeWarningsSent = 0;
  let creativeWarningsFailed = 0;
  if (
    options.sendCreativeDeadlineWarning ||
    process.env.SPLASH_RESERVE_ALERTS_DISABLED !== "true"
  ) {
    const warningCandidates = await db
      .select()
      .from(splashAdReservationsTable)
      .where(
        and(
          inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS),
          eq(splashAdReservationsTable.status, "paid"),
          eq(splashAdReservationsTable.paymentStatus, "paid"),
          eq(splashAdReservationsTable.creativeStatus, "awaiting_upload"),
          lt(splashAdReservationsTable.paidAt, creativeWarningCutoff),
          gt(splashAdReservationsTable.paidAt, creativeCutoff),
          inArray(splashAdReservationsTable.creativeDeadlineWarningStatus, [
            "pending",
            "failed",
          ]),
          options.reservationIds
            ? inArray(splashAdReservationsTable.id, options.reservationIds)
            : undefined,
        ),
      );
    for (const reservation of warningCandidates) {
      const deadline = new Date(
        reservation.paidAt!.getTime() + CREATIVE_TTL_MS,
      );
      const result = await deliverCreativeDeadlineWarning(
        reservation,
        deadline,
        {
          now,
          send: options.sendCreativeDeadlineWarning,
        },
      );
      if (result === "sent") creativeWarningsSent += 1;
      if (result === "failed") creativeWarningsFailed += 1;
    }
  }

  const recycled = await db
    .update(splashAdReservationsTable)
    .set({
      status: "recycled",
      recycledAt: now,
      lifecycleReason: "creative_not_received_72h",
    })
    .where(
      and(
        inArray(splashAdReservationsTable.offerKey, INVENTORY_OFFER_KEYS),
        eq(splashAdReservationsTable.status, "paid"),
        eq(splashAdReservationsTable.paymentStatus, "paid"),
        eq(splashAdReservationsTable.creativeStatus, "awaiting_upload"),
        lt(splashAdReservationsTable.paidAt, creativeCutoff),
        isNull(splashAdReservationsTable.recycledAt),
        ne(splashAdReservationsTable.status, "live"),
        ne(splashAdReservationsTable.status, "completed"),
        options.reservationIds
          ? inArray(splashAdReservationsTable.id, options.reservationIds)
          : undefined,
      ),
    )
    .returning({ id: splashAdReservationsTable.id });

  return {
    expiredUnpaid,
    recycledPaid: recycled.length,
    creativeWarningsSent,
    creativeWarningsFailed,
    skippedProcessing,
    reconciledCheckouts,
  };
}

export function startSplashReservationCleanup(
  onError: (error: unknown) => void,
): () => void {
  const run = () => {
    void cleanupSplashReservations().catch(onError);
  };
  run();
  const timer = setInterval(run, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}

async function reconcileCheckoutCreation(
  reservation: SplashAdReservation,
  now: Date,
): Promise<"reconciled" | "skipped"> {
  const checkoutRequest =
    reservation.checkoutRequest &&
    typeof reservation.checkoutRequest === "object" &&
    !Array.isArray(reservation.checkoutRequest)
      ? (reservation.checkoutRequest as Record<string, unknown>)
      : null;
  if (checkoutRequest?.kind === "ucp_delegated_payment") {
    if (
      !reservation.checkoutAttemptStartedAt ||
      now.getTime() - reservation.checkoutAttemptStartedAt.getTime() >
        STRIPE_IDEMPOTENCY_REPLAY_WINDOW_MS
    ) {
      await db
        .update(splashAdReservationsTable)
        .set({
          lifecycleReason: "delegated_payment_reconciliation_required",
          checkoutRecoveryError:
            "Automatic replay stopped because Stripe idempotency retention may have expired.",
          checkoutRecoveryAttemptedAt: now,
        })
        .where(
          and(
            eq(splashAdReservationsTable.id, reservation.id),
            eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
          ),
        );
      return "skipped";
    }
    if (reservation.stripePaymentIntentId) {
      try {
        const intent = await retrieveStripePaymentIntent(
          reservation.stripePaymentIntentId,
        );
        const paid = await markSplashReservationPaidFromPaymentIntent(intent);
        if (paid === "paid") return "reconciled";
        if (["canceled", "requires_payment_method"].includes(intent.status)) {
          const failed = await markSplashReservationFailedFromPaymentIntent(intent);
          if (failed === "failed") return "reconciled";
        }
      } catch (error) {
        await db
          .update(splashAdReservationsTable)
          .set({
            lifecycleReason: "delegated_payment_reconciliation_required",
            checkoutRecoveryError: recoveryError(error),
            checkoutRecoveryAttemptedAt: now,
          })
          .where(
            and(
              eq(splashAdReservationsTable.id, reservation.id),
              eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
              eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
            ),
          );
        return "skipped";
      }
    }
    await db
      .update(splashAdReservationsTable)
      .set({
        lifecycleReason: "delegated_payment_reconciliation_required",
        checkoutRecoveryAttemptedAt: now,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, reservation.id),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
        ),
      );
    return "skipped";
  }
  if (!reservation.checkoutRequest || !reservation.checkoutIdempotencyKey) {
    await db
      .update(splashAdReservationsTable)
      .set({
        lifecycleReason: "checkout_reconciliation_required",
        checkoutRecoveryError: "Original Stripe checkout parameters are unavailable.",
        checkoutRecoveryAttemptedAt: now,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, reservation.id),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
        ),
      );
    return "skipped";
  }
  if (
    !reservation.checkoutAttemptStartedAt ||
    now.getTime() - reservation.checkoutAttemptStartedAt.getTime() >
      STRIPE_IDEMPOTENCY_REPLAY_WINDOW_MS
  ) {
    await db
      .update(splashAdReservationsTable)
      .set({
        lifecycleReason: "checkout_reconciliation_required",
        checkoutRecoveryError:
          "Automatic replay stopped because Stripe idempotency retention may have expired.",
        checkoutRecoveryAttemptedAt: now,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, reservation.id),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
        ),
      );
    return "skipped";
  }

  try {
    const recovered = await createStripeCheckoutSession(
      reservation.checkoutRequest as Stripe.Checkout.SessionCreateParams,
      reservation.checkoutIdempotencyKey,
    );
    const session = await retrieveStripeCheckoutSession(recovered.id);
    if (
      session.metadata?.reservationId !== reservation.id ||
      session.metadata?.checkoutAttempt !== String(reservation.checkoutAttempt) ||
      session.currency !== reservation.currency ||
      session.amount_total !== reservation.amountCents
    ) {
      throw new Error("Recovered Stripe checkout does not match its reservation.");
    }
    if (session.payment_status === "paid") {
      await markSplashReservationPaidFromSession(session);
      return "reconciled";
    }
    if (session.status === "open" && session.url) {
      const [attached] = await db
        .update(splashAdReservationsTable)
        .set({
          paymentStatus: "checkout_created",
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: session.url,
          inventoryHeldAt: now,
          lifecycleReason: null,
          checkoutRecoveryError: null,
          checkoutRecoveryAttemptedAt: now,
        })
        .where(
          and(
            eq(splashAdReservationsTable.id, reservation.id),
            eq(splashAdReservationsTable.status, "payment_pending"),
            eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
          ),
        )
        .returning({ id: splashAdReservationsTable.id });
      return attached ? "reconciled" : "skipped";
    }
    if (session.status === "expired") {
      const [released] = await db
        .update(splashAdReservationsTable)
        .set({
          status: "expired",
          paymentStatus: "failed",
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: null,
          expiredAt: now,
          lifecycleReason: "checkout_reconciled_without_payment",
          checkoutRecoveryError: null,
          checkoutRecoveryAttemptedAt: now,
        })
        .where(
          and(
            eq(splashAdReservationsTable.id, reservation.id),
            eq(splashAdReservationsTable.status, "payment_pending"),
            eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
            eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
          ),
        )
        .returning({ id: splashAdReservationsTable.id });
      return released ? "reconciled" : "skipped";
    }
    throw new Error(`Stripe checkout remains ${session.status ?? "unresolved"}.`);
  } catch (error) {
    await db
      .update(splashAdReservationsTable)
      .set({
        lifecycleReason: "checkout_reconciliation_required",
        checkoutRecoveryError: recoveryError(error),
        checkoutRecoveryAttemptedAt: now,
      })
      .where(
        and(
          eq(splashAdReservationsTable.id, reservation.id),
          eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
          eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
        ),
      );
    return "skipped";
  }
}

export async function markSplashReservationFailedFromPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
): Promise<"failed" | "ignored"> {
  const reservationId = paymentIntent.metadata?.reservationId;
  if (
    !reservationId ||
    paymentIntent.metadata?.ucpHandler !== "com.stripe.payments" ||
    !["canceled", "requires_payment_method"].includes(paymentIntent.status)
  ) {
    return "ignored";
  }
  const [reservation] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservationId))
    .limit(1);
  if (
    !reservation ||
    reservation.source !== "birch_reserve_v1_checkout" ||
    paymentIntent.metadata?.offerKey !== reservation.offerKey ||
    paymentIntent.metadata?.checkoutAttempt !== String(reservation.checkoutAttempt) ||
    paymentIntent.amount !== reservation.amountCents ||
    paymentIntent.currency !== reservation.currency
  ) {
    return "ignored";
  }
  if (
    reservation.paymentStatus === "failed" &&
    reservation.stripePaymentIntentId === paymentIntent.id
  ) {
    return "failed";
  }
  const [failed] = await db
    .update(splashAdReservationsTable)
    .set({
      status: "seat_held",
      paymentStatus: "failed",
      stripePaymentIntentId: paymentIntent.id,
      lifecycleReason: "delegated_payment_failed",
    })
    .where(
      and(
        eq(splashAdReservationsTable.id, reservation.id),
        eq(splashAdReservationsTable.status, "payment_pending"),
        eq(splashAdReservationsTable.paymentStatus, "checkout_creating"),
        eq(splashAdReservationsTable.checkoutAttempt, reservation.checkoutAttempt),
      ),
    )
    .returning({ id: splashAdReservationsTable.id });
  return failed ? "failed" : "ignored";
}
