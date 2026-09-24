import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Birch Reserve leads: the single system of record for every inbound lead
 * (HARD 5:46pm). Chat Randy intakes, chat callback requests, xAI voice calls and
 * advertiser follow-up forms all upsert exactly one row here, keyed by a
 * deterministic id:
 *
 *   chat:<randy_chat_sessions.id>    source chat_intake | chat_callback
 *   voice:<voice_calls.call_id>      source voice
 *   intake:<advertiser_intakes.id>   source advertiser_intake
 *
 * The source tables (randy_chat_sessions, voice_calls, advertiser_intakes) keep
 * the full detail (transcripts, raw payloads); this table holds the normalized
 * contact + qualify fields and the Friday CRM push status.
 *
 * ADDITIVE ONLY. Mirrored byte-for-byte by the runtime CREATE TABLE IF NOT EXISTS
 * safety net in artifacts/api-server/src/lib/leads.ts and by
 * scripts/sql/2026-09-24-leads-voice-calls.sql (run in the Replit dev DB before
 * publishing so the publish diff never proposes drops).
 */
export const leadsTable = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    sourceRef: text("source_ref").notNull(),
    name: text("name"),
    company: text("company"),
    role: text("role"),
    phone: text("phone"),
    email: text("email"),
    need: text("need"),
    size: text("size"),
    timing: text("timing"),
    pagePath: text("page_path"),
    fridayStatus: text("friday_status").notNull().default("pending"),
    fridayAttempts: integer("friday_attempts").notNull().default(0),
    fridayLastError: text("friday_last_error"),
    fridayContactId: text("friday_contact_id"),
    fridayDealId: text("friday_deal_id"),
    fridayPushedAt: timestamp("friday_pushed_at", { withTimezone: true }),
    fridayAttemptedAt: timestamp("friday_attempted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leads_created_at_idx").on(table.createdAt),
    index("leads_friday_status_idx").on(table.fridayStatus, table.updatedAt),
  ],
);

export type LeadRow = typeof leadsTable.$inferSelect;

/**
 * Voice call records, one row per call_id (idempotent; repeats bump received_count):
 *   source "phone"  POST /api/voice/call-ended (secured generic ingest, e.g. parsed
 *                   xAI phone-agent emails); raw_payload keeps the exact JSON posted
 *   source "web"    reserved for a future in-browser voice client
 */
export const voiceCallsTable = pgTable(
  "voice_calls",
  {
    callId: text("call_id").primaryKey(),
    source: text("source").notNull().default("phone"),
    leadId: text("lead_id"),
    callerNumber: text("caller_number"),
    calledNumber: text("called_number"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    endReason: text("end_reason"),
    transcript: text("transcript"),
    transcriptTurns: jsonb("transcript_turns").notNull().default([]),
    extracted: jsonb("extracted").notNull().default({}),
    rawPayload: jsonb("raw_payload").notNull().default({}),
    receivedCount: integer("received_count").notNull().default(1),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    notifyError: text("notify_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("voice_calls_created_at_idx").on(table.createdAt)],
);

export type VoiceCallRow = typeof voiceCallsTable.$inferSelect;
