import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Durable application-owned table for Birch Reserve Founding Sponsor reservations.
 *
 * Design principles:
 * - packageKey identifies the commercial offering ("founding_sponsor_brand_5k_cad").
 * - amountCents + currency carry the indicative package rate for private review.
 * - all submissions are request-only; the application does not collect payment.
 * - marketingConsent is a typed boolean column, separate from terms acceptance.
 * - metadata JSONB holds fixed commercial policy fields and any future audit data.
 */
export const sponsorReservationsTable = pgTable(
  "sponsor_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ── Commercial offering ──────────────────────────────────────────────────
    packageKey: text("package_key").notNull(),
    amountCents: text("amount_cents").notNull(),
    currency: text("currency").notNull().default("cad"),
    // Public lifecycle is request-only; private review happens out of band.
    status: text("status").notNull().default("reserve_only"),
    // Public submission route is recorded separately from buyer type/package.
    accessRoute: text("access_route").notNull().default("open_market"),
    // Public requests can only create pending/not-applicable states. Verification
    // is completed during private review and cannot be granted by the requester.
    contributorVerificationStatus: text("contributor_verification_status")
      .notNull()
      .default("not_applicable"),

    // ── Buyer contact ────────────────────────────────────────────────────────
    buyerEmail: text("buyer_email").notNull(),
    buyerName: text("buyer_name"),
    companyName: text("company_name"),
    companyWebsite: text("company_website"),

    // ── Consent flags ────────────────────────────────────────────────────────
    // termsAccepted: always true at insert (validated server-side).
    termsAccepted: boolean("terms_accepted").notNull().default(false),
    // marketingConsent: explicit opt-in, defaults false.
    marketingConsent: boolean("marketing_consent").notNull().default(false),

    // ── Requested placement ──────────────────────────────────────────────────
    requestedHubId: text("requested_hub_id"),
    requestedHubName: text("requested_hub_name"),
    requestedCategory: text("requested_category"),
    advertisingObjective: text("advertising_objective"),
    preferredPlacement: text("preferred_placement"),
    investmentRange: text("investment_range"),
    launchTimeline: text("launch_timeline"),
    creativeStatus: text("creative_status"),
    additionalNotes: text("additional_notes"),

    // ── Lookup token (unguessable, for buyer status polling) ─────────────────
    lookupToken: text("lookup_token").notNull().unique(),

    // ── Fixed commercial policy metadata ─────────────────────────────────────
    // host_veto_policy, fulfillment, and any future audit fields.
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    // ── Timestamps ───────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("sponsor_reservations_buyer_email").on(table.buyerEmail),
    index("sponsor_reservations_status").on(table.status),
    index("sponsor_reservations_access_route").on(table.accessRoute),
    index("sponsor_reservations_package").on(table.packageKey),
  ],
);

export const insertSponsorReservationSchema = createInsertSchema(
  sponsorReservationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SponsorReservation = typeof sponsorReservationsTable.$inferSelect;
export type InsertSponsorReservation = z.infer<
  typeof insertSponsorReservationSchema
>;
