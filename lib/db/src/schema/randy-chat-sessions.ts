import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Chat Randy transcripts (birchreserve.net widget). One row per browser chat
 * session. Holds only what the visitor typed or chose to share (qualifying
 * answers, phone/email they gave). No IP address and no user agent.
 *
 * Email send is idempotent: a transcript is due when
 *   message_count > sent_message_count AND (handoff_pending OR idle >= 10 min).
 * A send is claimed atomically via sending_at so concurrent Autoscale
 * instances never double-send.
 */
export const randyChatSessionsTable = pgTable("randy_chat_sessions", {
  id: text("id").primaryKey(),
  messages: jsonb("messages").notNull().default([]),
  messageCount: integer("message_count").notNull().default(0),
  userMessageCount: integer("user_message_count").notNull().default(0),
  qualify: jsonb("qualify").notNull().default({}),
  contact: jsonb("contact").notNull().default({}),
  events: jsonb("events").notNull().default([]),
  lastHandoff: text("last_handoff"),
  handoffPending: boolean("handoff_pending").notNull().default(false),
  pagePath: text("page_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentMessageCount: integer("sent_message_count").notNull().default(0),
  sendingAt: timestamp("sending_at", { withTimezone: true }),
  sendAttempts: integer("send_attempts").notNull().default(0),
  sendError: text("send_error"),
});

export type RandyChatSessionRow = typeof randyChatSessionsTable.$inferSelect;
