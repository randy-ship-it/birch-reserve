import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * First-party marketing CTA clicks. Path and offer only — no IP, no email,
 * no phone, no name, and no free-text fields.
 * Site analytics columns (Nov 23 2026, all nullable, added at runtime by api-server lib/siteAnalyticsStore.ts):
 * fixed-vocabulary label / area, coarse device + browser + os, referrer host, utm, st/qr/ref tag, skin, a visitor hash
 * that rotates daily (never the IP or user agent) and is_test for QA traffic.
 */
export const siteCtaEventsTable = pgTable("site_cta_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  event: text("event").notNull(),
  path: text("path").notNull(),
  offer: text("offer"),
  label: text("label"),
  area: text("area"),
  skin: text("skin"),
  device: text("device"),
  browser: text("browser"),
  os: text("os"),
  refHost: text("ref_host"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  src: text("src"),
  vh: text("vh"),
  isTest: boolean("is_test"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
