/**
 * Chat Randy transcripts: log every widget session server-side and email each
 * finished session to Randy via Resend.
 *
 * - Storage: Postgres table `randy_chat_sessions` (Drizzle, @workspace/db).
 * - Email: Resend HTTP API. Env RESEND_API_KEY (required to send),
 *   RANDY_CHAT_FROM (default "Birch Reserve <care@scalehealth.ca>", a sender verified in
 *   the Scale Resend account that owns the Autoscale RESEND_API_KEY),
 *   RANDY_TRANSCRIPT_TO (default randy@silverbirchgrowth.com).
 *   Without RESEND_API_KEY, sessions are still logged and nothing is sent;
 *   once the key is set, the backlog from the last 7 days goes out.
 * - When: a session is due once it has new messages since the last send AND
 *   (it ended in a handoff: tel click, callback request, Cal shown) OR it has
 *   been idle for 10 minutes.
 * - Autoscale-safe: sweeps run on each chat request (throttled to 1/min) and on
 *   a 60s unref'd interval. Claims are atomic (sending_at + SKIP LOCKED), and
 *   sent_message_count makes sends idempotent across instances and restarts.
 */
import { logger } from "./logger";

export type TranscriptRole = "user" | "assistant";
export type TranscriptMessage = { role: TranscriptRole; content: string };
export type QualifyAnswers = {
  company?: string;
  category?: string;
  reach?: string;
  timing?: string;
};
export type ContactInfo = { phone?: string; email?: string; name?: string };
export type TranscriptEvent = { type: string; at: string };

export type TranscriptSession = {
  id: string;
  messages: TranscriptMessage[];
  qualify: QualifyAnswers;
  contact: ContactInfo;
  events: TranscriptEvent[];
  lastHandoff: string | null;
  handoffPending: boolean;
  pagePath: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  sentAt: Date | null;
  sentMessageCount: number;
  sendingAt: Date | null;
  sendAttempts: number;
  sendError: string | null;
};

export type TranscriptUpdate = {
  id: string;
  now: Date;
  messages?: TranscriptMessage[];
  qualify?: QualifyAnswers;
  contact?: ContactInfo;
  event?: string;
  handoff?: boolean;
  pagePath?: string;
};

export type ClaimOptions = {
  now: Date;
  idleMs: number;
  staleClaimMs: number;
  /** After maxAttempts, a failed row is still retried once per this interval (never stuck). */
  failedRetryMs?: number;
  maxAttempts: number;
  maxAgeMs: number;
  limit: number;
  onlyId?: string;
};

export interface TranscriptStore {
  upsert(update: TranscriptUpdate): Promise<void>;
  claimDue(opts: ClaimOptions): Promise<TranscriptSession[]>;
  markSent(id: string, sentMessageCount: number, now: Date): Promise<void>;
  markFailed(id: string, error: string, now?: Date): Promise<void>;
  get?(id: string): Promise<TranscriptSession | undefined>;
}

export const TRANSCRIPT_IDLE_MS = 10 * 60_000;
const STALE_CLAIM_MS = 5 * 60_000;
const FAILED_RETRY_MS = 30 * 60_000;
const MAX_SEND_ATTEMPTS = 5;
const MAX_BACKLOG_AGE_MS = 7 * 24 * 60 * 60_000;
const SWEEP_THROTTLE_MS = 60_000;
const MAX_STORED_MESSAGES = 200;
const MAX_EVENTS = 50;

export const HANDOFF_EVENTS = new Set(["tel_click", "callback_request", "cal_shown"]);
/** Our own line (env RANDY_TEL when the Toronto number lands), skipped when extracting visitor phones. */
const RANDY_TEL_DIGITS = (process.env["RANDY_TEL"] ?? "+15045046526").replace(/\D/g, "").slice(-10);

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Merge an incoming full thread into the stored one. The client normally sends
 * the whole thread; if it had to drop the head (very long chats), append only
 * the new tail so the transcript never loses earlier turns.
 */
export function mergeMessages(
  stored: TranscriptMessage[],
  incoming: TranscriptMessage[],
): TranscriptMessage[] {
  if (incoming.length === 0) return stored;
  if (stored.length === 0) return incoming.slice(-MAX_STORED_MESSAGES);
  const same = (a: TranscriptMessage, b: TranscriptMessage) =>
    a.role === b.role && a.content === b.content;
  // Incoming starts at the same place as stored → it is the fuller/newer view.
  if (same(stored[0]!, incoming[0]!) && incoming.length >= stored.length) {
    return incoming.slice(-MAX_STORED_MESSAGES);
  }
  // Find where incoming[0] sits inside stored and append the unseen tail.
  for (let i = stored.length - 1; i >= 0; i -= 1) {
    if (!same(stored[i]!, incoming[0]!)) continue;
    const overlap = stored.length - i;
    let ok = true;
    for (let k = 0; k < overlap && k < incoming.length; k += 1) {
      if (!same(stored[i + k]!, incoming[k]!)) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return [...stored, ...incoming.slice(overlap)].slice(-MAX_STORED_MESSAGES);
    }
  }
  return incoming.length >= stored.length ? incoming.slice(-MAX_STORED_MESSAGES) : stored;
}

function cleanFields<T extends Record<string, string | undefined>>(obj: T | undefined): Partial<T> {
  const out: Record<string, string> = {};
  if (!obj) return out as Partial<T>;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out as Partial<T>;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

/** Pull an email / phone the visitor typed into the chat (never Randy's own line). */
export function extractContactFromMessages(messages: TranscriptMessage[]): ContactInfo {
  const out: ContactInfo = {};
  for (const m of messages) {
    if (m.role !== "user") continue;
    if (!out.email) {
      const e = m.content.match(EMAIL_RE);
      if (e) out.email = e[0];
    }
    if (!out.phone) {
      for (const p of m.content.match(PHONE_RE) ?? []) {
        const digits = p.replace(/\D/g, "");
        if (digits.endsWith(RANDY_TEL_DIGITS)) continue;
        out.phone = p.trim();
        break;
      }
    }
  }
  return out;
}

export function emptySession(id: string, now: Date): TranscriptSession {
  return {
    id,
    messages: [],
    qualify: {},
    contact: {},
    events: [],
    lastHandoff: null,
    handoffPending: false,
    pagePath: null,
    createdAt: now,
    lastActivityAt: now,
    sentAt: null,
    sentMessageCount: 0,
    sendingAt: null,
    sendAttempts: 0,
    sendError: null,
  };
}

export function applyUpdate(
  existing: TranscriptSession | undefined,
  update: TranscriptUpdate,
): TranscriptSession {
  const base = existing ?? emptySession(update.id, update.now);
  const messages = update.messages ? mergeMessages(base.messages, update.messages) : base.messages;
  const extracted = extractContactFromMessages(messages);
  const events = update.event
    ? [...base.events, { type: update.event, at: update.now.toISOString() }].slice(-MAX_EVENTS)
    : base.events;
  const isHandoff = Boolean(update.handoff || (update.event && HANDOFF_EVENTS.has(update.event)));
  // A new handoff on a session whose last send failed retries right away.
  const retryNow = isHandoff && Boolean(base.sendError);
  return {
    ...base,
    ...(retryNow ? { sendAttempts: 0, sendingAt: null } : {}),
    messages,
    qualify: { ...base.qualify, ...cleanFields(update.qualify) },
    // Explicit fields win over values scraped from chat text.
    contact: { ...extracted, ...base.contact, ...cleanFields(update.contact) },
    events,
    lastHandoff: isHandoff ? (update.event ?? "handoff") : base.lastHandoff,
    handoffPending: base.handoffPending || isHandoff,
    pagePath: update.pagePath ?? base.pagePath,
    lastActivityAt: update.now,
  };
}

export function isDue(s: TranscriptSession, opts: ClaimOptions): boolean {
  const now = opts.now.getTime();
  const userCount = s.messages.filter((m) => m.role === "user").length;
  if (userCount === 0) return false;
  if (s.messages.length <= s.sentMessageCount) return false;
  if (now - s.lastActivityAt.getTime() > opts.maxAgeMs) return false;
  if (s.sendingAt && now - s.sendingAt.getTime() < opts.staleClaimMs) return false;
  if (s.sendAttempts >= opts.maxAttempts) {
    const retryMs = opts.failedRetryMs ?? FAILED_RETRY_MS;
    const lastTry = s.sendingAt?.getTime() ?? 0;
    if (!s.sendError || now - lastTry < retryMs) return false;
  }
  return s.handoffPending || now - s.lastActivityAt.getTime() >= opts.idleMs;
}

/* ------------------------------------------------------------------ */
/* Email rendering                                                     */
/* ------------------------------------------------------------------ */

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

function fmtToronto(d: Date): string {
  return `${new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d)} ET`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape, then turn naked http(s) URLs into anchors whose text IS the URL. */
function htmlWithNakedLinks(s: string): string {
  return escapeHtml(s).replace(
    /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g,
    (url) => `<a href="${url}">${url}</a>`,
  );
}

const EVENT_LABELS: Record<string, string> = {
  tel_click: "Tapped \"Get a call from Randy's AI now\" (tel)",
  callback_request: "Requested a callback",
  cal_shown: "Calendar link shown (qualified)",
  qualified: "Answered the qualifying questions",
  close: "Closed the chat",
  activity: "Chat activity",
};

export function renderTranscriptEmail(s: TranscriptSession): RenderedEmail {
  const company = s.qualify.company?.trim();
  const subject = `Birch chat transcript: ${company || "anon"}`;
  const outcome = s.lastHandoff
    ? EVENT_LABELS[s.lastHandoff] ?? s.lastHandoff
    : "Went idle (10 min)";
  const fields: Array<[string, string | undefined]> = [
    ["Company / brand", s.qualify.company],
    ["Category / who to reach", s.qualify.category],
    ...(s.qualify.reach ? ([["Wants to reach", s.qualify.reach]] as Array<[string, string]>) : []),
    ["Timing / budget", s.qualify.timing],
    ["Name", s.contact.name],
    ["Phone", s.contact.phone],
    ["Email", s.contact.email],
  ];
  const meta: Array<[string, string]> = [
    ["Session", s.id],
    ["Started", fmtToronto(s.createdAt)],
    ["Last activity", fmtToronto(s.lastActivityAt)],
    ["Page", s.pagePath ? `https://birchreserve.net${s.pagePath}` : "https://birchreserve.net"],
    ["Outcome", outcome],
  ];
  const events = s.events.map((e) => `${fmtToronto(new Date(e.at))}: ${EVENT_LABELS[e.type] ?? e.type}`);
  const lines = s.messages.map((m) => `${m.role === "user" ? "Visitor" : "Randy"}: ${m.content}`);

  const text = [
    "Birch chat transcript",
    "",
    ...meta.map(([k, v]) => `${k}: ${v}`),
    "",
    "Qualifying answers and contact",
    ...fields.map(([k, v]) => `${k}: ${v?.trim() || "(not given)"}`),
    "",
    "Events",
    ...(events.length ? events : ["(none)"]),
    "",
    "Transcript",
    "----------",
    ...lines.flatMap((l) => [l, ""]),
  ].join("\n");

  const row = (k: string, v: string) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#555;vertical-align:top">${escapeHtml(k)}</td><td style="padding:2px 0">${htmlWithNakedLinks(v)}</td></tr>`;
  const html = [
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.45">`,
    `<h2 style="margin:0 0 8px">Birch chat transcript</h2>`,
    `<table style="border-collapse:collapse;margin-bottom:12px">${meta.map(([k, v]) => row(k, v)).join("")}</table>`,
    `<h3 style="margin:12px 0 4px">Qualifying answers and contact</h3>`,
    `<table style="border-collapse:collapse;margin-bottom:12px">${fields.map(([k, v]) => row(k, v?.trim() || "(not given)")).join("")}</table>`,
    `<h3 style="margin:12px 0 4px">Events</h3>`,
    `<ul style="margin:0 0 12px;padding-left:18px">${(events.length ? events : ["(none)"]).map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`,
    `<h3 style="margin:12px 0 4px">Transcript</h3>`,
    ...s.messages.map(
      (m) =>
        `<p style="margin:0 0 10px"><strong>${m.role === "user" ? "Visitor" : "Randy"}:</strong> ${htmlWithNakedLinks(m.content)}</p>`,
    ),
    `</body></html>`,
  ].join("\n");

  return { subject, text, html, ...(s.contact.email ? { replyTo: s.contact.email } : {}) };
}

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

export class MemoryTranscriptStore implements TranscriptStore {
  rows = new Map<string, TranscriptSession>();

  async upsert(update: TranscriptUpdate): Promise<void> {
    this.rows.set(update.id, applyUpdate(this.rows.get(update.id), update));
  }

  async claimDue(opts: ClaimOptions): Promise<TranscriptSession[]> {
    const out: TranscriptSession[] = [];
    for (const s of this.rows.values()) {
      if (opts.onlyId && s.id !== opts.onlyId) continue;
      if (!isDue(s, opts)) continue;
      s.sendingAt = opts.now;
      s.sendAttempts += 1;
      out.push({ ...s, messages: [...s.messages] });
      if (out.length >= opts.limit) break;
    }
    return out;
  }

  async markSent(id: string, sentMessageCount: number, now: Date): Promise<void> {
    const s = this.rows.get(id);
    if (!s) return;
    s.sentAt = now;
    s.sentMessageCount = Math.max(s.sentMessageCount, sentMessageCount);
    s.handoffPending = false;
    s.sendingAt = null;
    s.sendAttempts = 0;
    s.sendError = null;
  }

  async markFailed(id: string, error: string, now: Date = new Date()): Promise<void> {
    const s = this.rows.get(id);
    if (!s) return;
    // sendingAt doubles as "last attempt at" so retries back off (stale-claim window).
    s.sendingAt = now;
    s.sendError = error.slice(0, 300);
  }

  async get(id: string): Promise<TranscriptSession | undefined> {
    return this.rows.get(id);
  }
}

type DbModule = typeof import("@workspace/db");
type RawRow = Record<string, unknown>;

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function rowToSession(r: RawRow): TranscriptSession {
  const pick = (camel: string, snake: string) => (camel in r ? r[camel] : r[snake]);
  return {
    id: String(r["id"]),
    messages: (pick("messages", "messages") as TranscriptMessage[]) ?? [],
    qualify: (pick("qualify", "qualify") as QualifyAnswers) ?? {},
    contact: (pick("contact", "contact") as ContactInfo) ?? {},
    events: (pick("events", "events") as TranscriptEvent[]) ?? [],
    lastHandoff: (pick("lastHandoff", "last_handoff") as string | null) ?? null,
    handoffPending: Boolean(pick("handoffPending", "handoff_pending")),
    pagePath: (pick("pagePath", "page_path") as string | null) ?? null,
    createdAt: toDate(pick("createdAt", "created_at")) ?? new Date(),
    lastActivityAt: toDate(pick("lastActivityAt", "last_activity_at")) ?? new Date(),
    sentAt: toDate(pick("sentAt", "sent_at")),
    sentMessageCount: Number(pick("sentMessageCount", "sent_message_count") ?? 0),
    sendingAt: toDate(pick("sendingAt", "sending_at")),
    sendAttempts: Number(pick("sendAttempts", "send_attempts") ?? 0),
    sendError: (pick("sendError", "send_error") as string | null) ?? null,
  };
}

/** Postgres store via @workspace/db (lazy import so tests without a DB never load it). */
export class DrizzleTranscriptStore implements TranscriptStore {
  private modPromise: Promise<DbModule> | null = null;
  private ensured = false;

  private async mod(): Promise<DbModule> {
    this.modPromise ??= import("@workspace/db");
    const m = await this.modPromise;
    if (!this.ensured) {
      // Safety net if `drizzle push` did not run at publish. Mirrors lib/db schema.
      await m.pool.query(`CREATE TABLE IF NOT EXISTS randy_chat_sessions (
        id text PRIMARY KEY,
        messages jsonb NOT NULL DEFAULT '[]'::jsonb,
        message_count integer NOT NULL DEFAULT 0,
        user_message_count integer NOT NULL DEFAULT 0,
        qualify jsonb NOT NULL DEFAULT '{}'::jsonb,
        contact jsonb NOT NULL DEFAULT '{}'::jsonb,
        events jsonb NOT NULL DEFAULT '[]'::jsonb,
        last_handoff text,
        handoff_pending boolean NOT NULL DEFAULT false,
        page_path text,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_activity_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz,
        sent_message_count integer NOT NULL DEFAULT 0,
        sending_at timestamptz,
        send_attempts integer NOT NULL DEFAULT 0,
        send_error text
      )`);
      this.ensured = true;
    }
    return m;
  }

  async upsert(update: TranscriptUpdate): Promise<void> {
    const m = await this.mod();
    const client = await m.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT * FROM randy_chat_sessions WHERE id = $1 FOR UPDATE", [update.id]);
      const existing = found.rows[0] ? rowToSession(found.rows[0] as RawRow) : undefined;
      const s = applyUpdate(existing, update);
      const userCount = s.messages.filter((x) => x.role === "user").length;
      await client.query(
        `INSERT INTO randy_chat_sessions
           (id, messages, message_count, user_message_count, qualify, contact, events,
            last_handoff, handoff_pending, page_path, created_at, last_activity_at)
         VALUES ($1, $2::jsonb, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           messages = EXCLUDED.messages,
           message_count = EXCLUDED.message_count,
           user_message_count = EXCLUDED.user_message_count,
           qualify = EXCLUDED.qualify,
           contact = EXCLUDED.contact,
           events = EXCLUDED.events,
           last_handoff = EXCLUDED.last_handoff,
           handoff_pending = randy_chat_sessions.handoff_pending OR EXCLUDED.handoff_pending,
           page_path = EXCLUDED.page_path,
           last_activity_at = EXCLUDED.last_activity_at,
           send_attempts = CASE WHEN $13 AND randy_chat_sessions.send_error IS NOT NULL
                                THEN 0 ELSE randy_chat_sessions.send_attempts END,
           sending_at = CASE WHEN $13 AND randy_chat_sessions.send_error IS NOT NULL
                             THEN NULL ELSE randy_chat_sessions.sending_at END`,
        [
          s.id,
          JSON.stringify(s.messages),
          s.messages.length,
          userCount,
          JSON.stringify(s.qualify),
          JSON.stringify(s.contact),
          JSON.stringify(s.events),
          s.lastHandoff,
          s.handoffPending,
          s.pagePath,
          s.createdAt,
          s.lastActivityAt,
          Boolean(update.handoff || (update.event && HANDOFF_EVENTS.has(update.event))),
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async claimDue(opts: ClaimOptions): Promise<TranscriptSession[]> {
    const m = await this.mod();
    const now = opts.now;
    const idleBefore = new Date(now.getTime() - opts.idleMs);
    const staleBefore = new Date(now.getTime() - opts.staleClaimMs);
    const notOlderThan = new Date(now.getTime() - opts.maxAgeMs);
    const res = await m.pool.query(
      `UPDATE randy_chat_sessions SET sending_at = $1, send_attempts = send_attempts + 1
        WHERE id IN (
          SELECT id FROM randy_chat_sessions
           WHERE message_count > sent_message_count
             AND user_message_count > 0
             AND (send_attempts < $2 OR (send_error IS NOT NULL AND (sending_at IS NULL OR sending_at <= $8)))
             AND last_activity_at >= $3
             AND (sending_at IS NULL OR sending_at <= $4)
             AND (handoff_pending OR last_activity_at <= $5)
             AND ($6::text IS NULL OR id = $6)
           ORDER BY last_activity_at
           LIMIT $7
           FOR UPDATE SKIP LOCKED)
        RETURNING *`,
      [
        now,
        opts.maxAttempts,
        notOlderThan,
        staleBefore,
        idleBefore,
        opts.onlyId ?? null,
        opts.limit,
        new Date(now.getTime() - (opts.failedRetryMs ?? FAILED_RETRY_MS)),
      ],
    );
    return (res.rows as RawRow[]).map(rowToSession);
  }

  async markSent(id: string, sentMessageCount: number, now: Date): Promise<void> {
    const m = await this.mod();
    await m.pool.query(
      `UPDATE randy_chat_sessions
          SET sent_at = $2, sent_message_count = GREATEST(sent_message_count, $3),
              handoff_pending = false, sending_at = NULL, send_attempts = 0, send_error = NULL
        WHERE id = $1`,
      [id, now, sentMessageCount],
    );
  }

  async markFailed(id: string, error: string, now: Date = new Date()): Promise<void> {
    const m = await this.mod();
    await m.pool.query(
      "UPDATE randy_chat_sessions SET sending_at = $3, send_error = $2 WHERE id = $1",
      [id, error.slice(0, 300), now],
    );
  }
}

/* ------------------------------------------------------------------ */
/* Mailer                                                              */
/* ------------------------------------------------------------------ */

export type TranscriptMailer = (email: RenderedEmail) => Promise<void>;

export const RESEND_API_KEY_ENV = "RESEND_API_KEY" as const;
/** Must be a sender verified in the Resend account behind RESEND_API_KEY (Scale's). */
export const DEFAULT_TRANSCRIPT_FROM = "Birch Reserve <care@scalehealth.ca>";
export const TRANSCRIPT_TO = "randy@silverbirchgrowth.com";
export function transcriptFrom(): string {
  return process.env["RANDY_CHAT_FROM"]?.trim() || DEFAULT_TRANSCRIPT_FROM;
}

export function resendConfigured(): boolean {
  return Boolean(process.env[RESEND_API_KEY_ENV]?.trim());
}

export const resendMailer: TranscriptMailer = async (email) => {
  const key = process.env[RESEND_API_KEY_ENV]?.trim();
  if (!key) throw new Error("resend_not_configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: transcriptFrom(),
        to: [process.env["RANDY_TRANSCRIPT_TO"]?.trim() || TRANSCRIPT_TO],
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
      throw new Error(`Resend HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
  } finally {
    clearTimeout(timeout);
  }
};

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

let store: TranscriptStore = new DrizzleTranscriptStore();
let mailer: TranscriptMailer = resendMailer;
let mailerReady: () => boolean = resendConfigured;
let lastSweepAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let warnedNoResend = false;

export function setTranscriptDepsForTests(deps: {
  store?: TranscriptStore;
  mailer?: TranscriptMailer;
  mailerReady?: () => boolean;
}): void {
  if (deps.store) store = deps.store;
  if (deps.mailer) mailer = deps.mailer;
  if (deps.mailerReady) mailerReady = deps.mailerReady;
  lastSweepAt = 0;
}

function transcriptsDisabled(): boolean {
  return process.env["RANDY_TRANSCRIPTS_DISABLED"] === "true";
}

/** Log a chat turn / event. Never throws (chat must not fail because logging did). */
export async function recordTranscript(update: Omit<TranscriptUpdate, "now"> & { now?: Date }): Promise<void> {
  if (transcriptsDisabled()) return;
  try {
    await store.upsert({ ...update, now: update.now ?? new Date() });
  } catch (error) {
    logger.warn(
      { err: error instanceof Error ? error.message : "transcript_upsert_failed" },
      "Randy chat transcript log failed",
    );
  }
}

export type SweepResult = { sent: number; failed: number; skipped?: "resend_not_configured" | "disabled" };

/**
 * Admin smoke test after publish: sends one sample transcript through the real mailer
 * (same from/to/subject format). Does not touch the sessions table.
 */
export async function sendTestTranscript(now: Date = new Date()): Promise<{ sent: boolean; reason?: string }> {
  if (!mailerReady()) return { sent: false, reason: "resend_not_configured" };
  const id = `test-${now.getTime()}`;
  const session = applyUpdate(undefined, {
    id,
    now,
    messages: [
      { role: "assistant", content: "Hey, I'm Randy. Want to see how a seat inside the recovery hubs works?" },
      { role: "user", content: "Test transcript from the admin endpoint." },
    ],
    qualify: { company: "Transcript test" },
    event: "callback_request",
  });
  await mailer(renderTranscriptEmail(session));
  return { sent: true };
}

/** Send every due transcript (or just `onlyId`). Idempotent; safe to call often. */
export async function sweepTranscripts(opts: { now?: Date; onlyId?: string } = {}): Promise<SweepResult> {
  if (transcriptsDisabled()) return { sent: 0, failed: 0, skipped: "disabled" };
  if (!mailerReady()) {
    if (!warnedNoResend) {
      warnedNoResend = true;
      logger.warn(
        { env: RESEND_API_KEY_ENV },
        "Randy chat transcripts are logged but not emailed: RESEND_API_KEY is not set",
      );
    }
    return { sent: 0, failed: 0, skipped: "resend_not_configured" };
  }
  const now = opts.now ?? new Date();
  let sent = 0;
  let failed = 0;
  const due = await store.claimDue({
    now,
    idleMs: TRANSCRIPT_IDLE_MS,
    staleClaimMs: STALE_CLAIM_MS,
    maxAttempts: MAX_SEND_ATTEMPTS,
    maxAgeMs: MAX_BACKLOG_AGE_MS,
    limit: 20,
    ...(opts.onlyId ? { onlyId: opts.onlyId } : {}),
  });
  for (const session of due) {
    try {
      await mailer(renderTranscriptEmail(session));
      await store.markSent(session.id, session.messages.length, new Date());
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "send_failed";
      await store.markFailed(session.id, message, now).catch(() => undefined);
      logger.warn({ err: message, session: session.id }, "Randy chat transcript email failed");
    }
  }
  return { sent, failed };
}

/** Fire-and-forget sweep, throttled to once a minute per instance. */
export function maybeSweepTranscripts(): void {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_THROTTLE_MS) return;
  lastSweepAt = now;
  void sweepTranscripts().catch((error) =>
    logger.warn({ err: error instanceof Error ? error.message : "sweep_failed" }, "Randy transcript sweep failed"),
  );
}

/** 60s interval sweep; unref'd so it never keeps an idle Autoscale instance alive. */
export function ensureTranscriptSweepTimer(): void {
  if (timer || transcriptsDisabled()) return;
  timer = setInterval(() => maybeSweepTranscripts(), SWEEP_THROTTLE_MS);
  timer.unref?.();
}

export function stopTranscriptSweepTimerForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
