import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pilotWaitlistEntriesTable = pgTable(
  "pilot_waitlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queueSequence: serial("queue_sequence").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    interestType: text("interest_type").notNull(),
    category: text("category"),
    company: text("company"),
    website: text("website"),
    businessSize: text("business_size"),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pilot_waitlist_entries_normalized_email").on(
      table.normalizedEmail,
    ),
    uniqueIndex("pilot_waitlist_entries_queue_sequence").on(
      table.queueSequence,
    ),
    index("pilot_waitlist_entries_interest_created").on(
      table.interestType,
      table.createdAt,
    ),
  ],
);

export const commercialInquiriesTable = pgTable(
  "commercial_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryType: text("inquiry_type").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    name: text("name").notNull(),
    company: text("company").notNull(),
    website: text("website").notNull(),
    category: text("category").notNull(),
    coverageRegion: text("coverage_region").notNull(),
    details: text("details").notNull(),
    transactionConsent: boolean("transaction_consent").notNull().default(false),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("commercial_inquiries_email_type").on(
      table.normalizedEmail,
      table.inquiryType,
    ),
    index("commercial_inquiries_type_created").on(
      table.inquiryType,
      table.createdAt,
    ),
  ],
);

export const advertiserIntakesTable = pgTable(
  "advertiser_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    normalizedEmail: text("normalized_email").notNull(),
    visitorType: text("visitor_type").notNull(),
    advertisingIntent: text("advertising_intent").notNull(),
    advertiserSize: text("advertiser_size"),
    operatingScope: text("operating_scope"),
    adInterest: text("ad_interest"),
    source: text("source").notNull(),
    followUpConsent: boolean("follow_up_consent").notNull().default(false),
    reviewStatus: text("review_status").notNull().default("new"),
    lastReviewedByStaffAccessId: uuid("last_reviewed_by_staff_access_id"),
    lastReviewedByName: text("last_reviewed_by_name"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("advertiser_intakes_email_created").on(
      table.normalizedEmail,
      table.createdAt,
    ),
    index("advertiser_intakes_profile_created").on(
      table.visitorType,
      table.advertiserSize,
      table.createdAt,
    ),
    index("advertiser_intakes_review_created").on(
      table.reviewStatus,
      table.createdAt,
    ),
  ],
);

export const salesStaffAccessTable = pgTable(
  "sales_staff_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    normalizedEmail: text("normalized_email").notNull(),
    displayName: text("display_name").notNull(),
    clerkUserId: text("clerk_user_id"),
    role: text("role").notNull().default("sales"),
    accessStatus: text("access_status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("sales_staff_access_normalized_email").on(
      table.normalizedEmail,
    ),
    uniqueIndex("sales_staff_access_clerk_user_id").on(table.clerkUserId),
    index("sales_staff_access_role_status").on(
      table.role,
      table.accessStatus,
    ),
  ],
);

export const advertiserIntakeReviewEventsTable = pgTable(
  "advertiser_intake_review_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advertiserIntakeId: uuid("advertiser_intake_id").notNull(),
    previousStatus: text("previous_status").notNull(),
    nextStatus: text("next_status").notNull(),
    staffAccessId: uuid("staff_access_id").notNull(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("advertiser_intake_review_events_intake_created").on(
      table.advertiserIntakeId,
      table.createdAt,
    ),
    index("advertiser_intake_review_events_staff_created").on(
      table.staffAccessId,
      table.createdAt,
    ),
  ],
);

export const salesStaffAccessEventsTable = pgTable(
  "sales_staff_access_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetStaffAccessId: uuid("target_staff_access_id").notNull(),
    targetNormalizedEmail: text("target_normalized_email").notNull(),
    targetDisplayName: text("target_display_name").notNull(),
    action: text("action").notNull(),
    previousStatus: text("previous_status"),
    nextStatus: text("next_status").notNull(),
    managerStaffAccessId: uuid("manager_staff_access_id").notNull(),
    actorClerkUserId: text("actor_clerk_user_id").notNull(),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sales_staff_access_events_target_created").on(
      table.targetStaffAccessId,
      table.createdAt,
    ),
    index("sales_staff_access_events_manager_created").on(
      table.managerStaffAccessId,
      table.createdAt,
    ),
  ],
);

export const insertPilotWaitlistEntrySchema = createInsertSchema(
  pilotWaitlistEntriesTable,
).omit({
  id: true,
  queueSequence: true,
  createdAt: true,
});

export type PilotWaitlistEntry =
  typeof pilotWaitlistEntriesTable.$inferSelect;
export type InsertPilotWaitlistEntry = z.infer<
  typeof insertPilotWaitlistEntrySchema
>;

export const insertCommercialInquirySchema = createInsertSchema(
  commercialInquiriesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CommercialInquiry =
  typeof commercialInquiriesTable.$inferSelect;
export type InsertCommercialInquiry = z.infer<
  typeof insertCommercialInquirySchema
>;

export const insertAdvertiserIntakeSchema = createInsertSchema(
  advertiserIntakesTable,
).omit({
  id: true,
  reviewStatus: true,
  lastReviewedByStaffAccessId: true,
  lastReviewedByName: true,
  lastReviewedAt: true,
  createdAt: true,
});

export type AdvertiserIntake =
  typeof advertiserIntakesTable.$inferSelect;
export type InsertAdvertiserIntake = z.infer<
  typeof insertAdvertiserIntakeSchema
>;

export const insertSalesStaffAccessSchema = createInsertSchema(
  salesStaffAccessTable,
).omit({
  id: true,
  clerkUserId: true,
  createdAt: true,
  updatedAt: true,
  revokedAt: true,
});

export type SalesStaffAccess = typeof salesStaffAccessTable.$inferSelect;
export type InsertSalesStaffAccess = z.infer<
  typeof insertSalesStaffAccessSchema
>;

export const insertAdvertiserIntakeReviewEventSchema = createInsertSchema(
  advertiserIntakeReviewEventsTable,
).omit({
  id: true,
  createdAt: true,
});

export type AdvertiserIntakeReviewEvent =
  typeof advertiserIntakeReviewEventsTable.$inferSelect;
export type InsertAdvertiserIntakeReviewEvent = z.infer<
  typeof insertAdvertiserIntakeReviewEventSchema
>;

export const insertSalesStaffAccessEventSchema = createInsertSchema(
  salesStaffAccessEventsTable,
).omit({
  id: true,
  createdAt: true,
});

export type SalesStaffAccessEvent =
  typeof salesStaffAccessEventsTable.$inferSelect;
export type InsertSalesStaffAccessEvent = z.infer<
  typeof insertSalesStaffAccessEventSchema
>;