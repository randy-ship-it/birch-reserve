import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Share + referral events (Randy via Emma, Nov 19 2026 8:31 AM ET). One row per share tap ("share"), per tracked
 * CTA click ("click"), and per arrival from a tracked link ("arrival"). Aggregate attribution only: channel, page,
 * ref / utm values, the referrer HOST (never the full URL), and a random share-link id. No IP, email, name or
 * free text. Report tokens never land here (/kit/r/* is stored as /kit/r/report).
 */
export const shareEventsTable = pgTable(
  "share_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    channel: text("channel").notNull(),
    path: text("path").notNull(),
    ref: text("ref"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    referrerHost: text("referrer_host"),
    shareId: text("share_id"),
    /** Mirror host tag (e.g. scale_mirror) when the intake is served under another host. Null on birchreserve.net. */
    src: text("src"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("share_events_created_idx").on(t.createdAt)],
);
