import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const createdAtColumn = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const marketplaceHostsTable = pgTable("marketplace_hosts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  accessKeyHash: text("access_key_hash").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const marketplacePlacementsTable = pgTable("marketplace_placements", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => marketplaceHostsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  floorCpmCents: integer("floor_cpm_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  allowedCategories: text("allowed_categories").array().notNull().default([]),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  vetoTerms: text("veto_terms").array().notNull().default([]),
  exclusivityHours: integer("exclusivity_hours").notNull().default(24),
  status: text("status").notNull().default("pending"),
  accessKeyHash: text("access_key_hash").notNull(),
  eventSigningSecretEncrypted: text("event_signing_secret_encrypted").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const marketplaceAdvertisersTable = pgTable("marketplace_advertisers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").notNull().default("pending"),
  accessKeyHash: text("access_key_hash").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const marketplaceCampaignsTable = pgTable("marketplace_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  advertiserId: uuid("advertiser_id")
    .notNull()
    .references(() => marketplaceAdvertisersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  creativeUrl: text("creative_url").notNull(),
  creativeText: text("creative_text").notNull().default(""),
  destinationUrl: text("destination_url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bidCpmCents: integer("bid_cpm_cents").notNull(),
  budgetCents: integer("budget_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  spentCents: integer("spent_cents").notNull().default(0),
  spentMilliCents: integer("spent_milli_cents").notNull().default(0),
  status: text("status").notNull().default("draft"),
  reviewNote: text("review_note"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: createdAtColumn(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const marketplaceDeliveriesTable = pgTable(
  "marketplace_deliveries",
  {
    id: text("id").primaryKey(),
    placementId: uuid("placement_id")
      .notNull()
      .references(() => marketplacePlacementsTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketplaceCampaignsTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    priceCpmCents: integer("price_cpm_cents").notNull(),
    reservedMilliCents: integer("reserved_milli_cents").notNull(),
    status: text("status").notNull().default("issued"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    reportedAt: timestamp("reported_at", { withTimezone: true }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("marketplace_deliveries_placement_expiry").on(
      table.placementId,
      table.status,
      table.expiresAt,
    ),
    index("marketplace_deliveries_campaign").on(table.campaignId),
  ],
);

export const marketplaceCategoryLocksTable = pgTable(
  "marketplace_category_locks",
  {
    placementId: uuid("placement_id")
      .notNull()
      .references(() => marketplacePlacementsTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketplaceCampaignsTable.id, { onDelete: "cascade" }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({
      name: "marketplace_category_locks_pk",
      columns: [table.placementId, table.category],
    }),
  ],
);

export const marketplaceDeliveryEventsTable = pgTable(
  "marketplace_delivery_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalEventId: text("external_event_id").notNull(),
    deliveryId: text("delivery_id")
      .notNull()
      .references(() => marketplaceDeliveriesTable.id, { onDelete: "cascade" }),
    placementId: uuid("placement_id")
      .notNull()
      .references(() => marketplacePlacementsTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => marketplaceCampaignsTable.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    priceCpmCents: integer("price_cpm_cents").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("marketplace_delivery_events_external_event_id").on(
      table.externalEventId,
    ),
    uniqueIndex("marketplace_delivery_events_delivery_type").on(
      table.deliveryId,
      table.eventType,
    ),
  ],
);

export const insertMarketplaceHostSchema = createInsertSchema(marketplaceHostsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMarketplacePlacementSchema = createInsertSchema(
  marketplacePlacementsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMarketplaceAdvertiserSchema = createInsertSchema(
  marketplaceAdvertisersTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMarketplaceCampaignSchema = createInsertSchema(
  marketplaceCampaignsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MarketplaceHost = typeof marketplaceHostsTable.$inferSelect;
export type MarketplacePlacement = typeof marketplacePlacementsTable.$inferSelect;
export type MarketplaceAdvertiser = typeof marketplaceAdvertisersTable.$inferSelect;
export type MarketplaceCampaign = typeof marketplaceCampaignsTable.$inferSelect;
export type MarketplaceDelivery = typeof marketplaceDeliveriesTable.$inferSelect;
export type MarketplaceCategoryLock = typeof marketplaceCategoryLocksTable.$inferSelect;
export type MarketplaceDeliveryEvent = typeof marketplaceDeliveryEventsTable.$inferSelect;
export type InsertMarketplaceHost = z.infer<typeof insertMarketplaceHostSchema>;