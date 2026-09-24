import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * First-party marketing CTA clicks. Path and offer only — no IP, no email,
 * no phone, no name, and no free-text fields.
 */
export const siteCtaEventsTable = pgTable("site_cta_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: text("event").notNull(),
  path: text("path").notNull(),
  offer: text("offer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
