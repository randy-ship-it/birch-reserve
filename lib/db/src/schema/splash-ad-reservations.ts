import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const splashAdReservationsTable = pgTable(
  "splash_ad_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandName: text("brand_name"),
    email: text("email").notNull(),
    websiteUrl: text("website_url"),
    adInterest: text("ad_interest").notNull().default("display"),
    promotedOffer: text("promoted_offer"),
    launchWindow: text("launch_window"),
    status: text("status").notNull().default("interest_captured"),
    offerKey: text("offer_key").notNull().default("reserve-490"),
    amountCents: integer("amount_cents").notNull().default(49000),
    currency: text("currency").notNull().default("usd"),
    source: text("source").notNull().default("splash_ad_prebuy"),
    followUpBy: timestamp("follow_up_by", { withTimezone: true }).notNull(),
    sheetSyncStatus: text("sheet_sync_status").notNull().default("pending"),
    sheetSyncError: text("sheet_sync_error"),
    alertDeliveryStatus: text("alert_delivery_status").notNull().default("pending"),
    alertDeliveryError: text("alert_delivery_error"),
    alertDeliveredAt: timestamp("alert_delivered_at", { withTimezone: true }),
    activationToken: text("activation_token"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripeCheckoutUrl: text("stripe_checkout_url"),
    checkoutAttempt: integer("checkout_attempt").notNull().default(0),
    checkoutRequest: jsonb("checkout_request"),
    checkoutIdempotencyKey: text("checkout_idempotency_key"),
    checkoutAttemptStartedAt: timestamp("checkout_attempt_started_at", {
      withTimezone: true,
    }),
    checkoutRecoveryError: text("checkout_recovery_error"),
    checkoutRecoveryAttemptedAt: timestamp("checkout_recovery_attempted_at", {
      withTimezone: true,
    }),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    publicIdempotencyKey: text("public_idempotency_key"),
    publicRequestFingerprint: text("public_request_fingerprint"),
    ucpAgentProfileUrl: text("ucp_agent_profile_url"),
    ucpAgentIdentityHash: text("ucp_agent_identity_hash"),
    ucpAgentPublicKey: jsonb("ucp_agent_public_key").$type<
      Record<string, unknown>
    >(),
    ucpIdentityOperationId: text("ucp_identity_operation_id"),
    ucpIdentityOperationStartedAt: timestamp(
      "ucp_identity_operation_started_at",
      { withTimezone: true },
    ),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    creativeStatus: text("creative_status").notNull().default("locked"),
    inventoryHeldAt: timestamp("inventory_held_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    recycledAt: timestamp("recycled_at", { withTimezone: true }),
    lifecycleReason: text("lifecycle_reason"),
    creativeDeadlineWarningStatus: text("creative_deadline_warning_status")
      .notNull()
      .default("pending"),
    creativeDeadlineWarningError: text("creative_deadline_warning_error"),
    creativeDeadlineWarningAttemptedAt: timestamp(
      "creative_deadline_warning_attempted_at",
      { withTimezone: true },
    ),
    creativeDeadlineWarningDeliveredAt: timestamp(
      "creative_deadline_warning_delivered_at",
      { withTimezone: true },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("splash_ad_reservations_email").on(table.email),
    index("splash_ad_reservations_status").on(table.status),
    index("splash_ad_reservations_follow_up").on(table.followUpBy),
    index("splash_ad_reservations_lifecycle").on(
      table.offerKey,
      table.status,
      table.inventoryHeldAt,
    ),
    index("splash_ad_reservations_creative_warning").on(
      table.creativeDeadlineWarningStatus,
      table.paidAt,
    ),
    uniqueIndex("splash_ad_reservations_activation_token").on(table.activationToken),
    uniqueIndex("splash_ad_reservations_checkout_session").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("splash_ad_reservations_public_idempotency").on(
      table.publicIdempotencyKey,
    ),
  ],
);

export const insertSplashAdReservationSchema = createInsertSchema(
  splashAdReservationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SplashAdReservation =
  typeof splashAdReservationsTable.$inferSelect;
export type InsertSplashAdReservation = z.infer<
  typeof insertSplashAdReservationSchema
>;

export const ucpAgentIdentityRotationsTable = pgTable(
  "ucp_agent_identity_rotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationId: uuid("reservation_id").notNull(),
    previousProfileUrl: text("previous_profile_url").notNull(),
    previousIdentityHash: text("previous_identity_hash").notNull(),
    previousPublicKeyThumbprint: text(
      "previous_public_key_thumbprint",
    ).notNull(),
    replacementProfileUrl: text("replacement_profile_url").notNull(),
    replacementIdentityHash: text("replacement_identity_hash").notNull(),
    authorizationIdHash: text("authorization_id_hash").notNull(),
    authorizationProofHash: text("authorization_proof_hash").notNull(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ucp_identity_rotations_authorization").on(
      table.authorizationIdHash,
    ),
    index("ucp_identity_rotations_checkout").on(table.reservationId),
  ],
);

export type UcpAgentIdentityRotation =
  typeof ucpAgentIdentityRotationsTable.$inferSelect;

export const ucpAgentIdentityEnrollmentsTable = pgTable(
  "ucp_agent_identity_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationId: uuid("reservation_id").notNull(),
    profileUrl: text("profile_url").notNull(),
    previousIdentityHash: text("previous_identity_hash").notNull(),
    replacementIdentityHash: text("replacement_identity_hash").notNull(),
    recoveryProofHash: text("recovery_proof_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ucp_identity_enrollments_checkout").on(table.reservationId),
    index("ucp_identity_enrollments_previous_identity").on(
      table.previousIdentityHash,
    ),
  ],
);

export type UcpAgentIdentityEnrollment =
  typeof ucpAgentIdentityEnrollmentsTable.$inferSelect;

export const ucpCheckoutIdempotencyAliasesTable = pgTable(
  "ucp_checkout_idempotency_aliases",
  {
    idempotencyKey: text("idempotency_key").primaryKey(),
    canonicalIdempotencyKey: text("canonical_idempotency_key").notNull(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => splashAdReservationsTable.id, { onDelete: "cascade" }),
    agentIdentityHash: text("agent_identity_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ucp_checkout_idempotency_alias_owner").on(
      table.reservationId,
      table.agentIdentityHash,
    ),
    index("ucp_checkout_idempotency_alias_reservation").on(table.reservationId),
  ],
);
