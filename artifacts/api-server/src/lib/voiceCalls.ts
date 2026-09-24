/**
 * Voice call intake: phone calls (POST /api/voice/call-ended, a secured generic
 * ingest; xAI phone agents have no post-call webhook today, they email randy@,
 * so Emma may post parsed call emails here). source "web" is reserved for a
 * future in-browser voice client (none on birchreserve.net today).
 *
 * xAI does not publish a post-call webhook schema (the documented SIP
 * webhook is `realtime.call.incoming` in a Standard Webhooks envelope:
 * { object:"event", id, type, created_at, data:{ call_id, sip_headers:[{name,value}] } }).
 * So this parser is deliberately tolerant: flat or enveloped payloads, snake or
 * camel case, transcript as a string or an array of turns (OpenAI-realtime style
 * content parts too), and extracted fields under any of the common wrappers.
 *
 * Flow: normalize → upsert voice_calls (idempotent on call_id, raw payload kept)
 * → upsert the single `leads` row (voice:<callId>) → structured log safety net →
 * email Randy + Jon once per call (atomic claim) → non-blocking Friday push.
 */
import { logger } from "./logger";
import { leadsDb, upsertLeadSafe } from "./leads";
import { queueFridayPush } from "./fridayPush";
import {
  resendConfigured,
  resendMailer,
  type RenderedEmail,
  type TranscriptMailer,
} from "./randyChatTranscripts";

export type VoiceTurn = { role: "caller" | "agent" | "other"; text: string; at?: string };
export type VoiceExtracted = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  role?: string;
  need?: string;
  size?: string;
  timing?: string;
  summary?: string;
};

export type VoiceCallSource = "phone" | "web";

export type NormalizedVoiceCall = {
  callId: string;
  source: VoiceCallSource;
  callerNumber: string | null;
  calledNumber: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  endReason: string | null;
  transcript: string | null;
  turns: VoiceTurn[];
  extracted: VoiceExtracted;
};

/* ------------------------------------------------------------------ */
/* Tolerant payload parsing                                            */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/** Case/underscore-insensitive key lookup: "callId" matches call_id, CallID, call-id. */
function norm(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getKey(o: Obj, key: string): unknown {
  if (key in o) return o[key];
  const want = norm(key);
  for (const [k, v] of Object.entries(o)) if (norm(k) === want) return v;
  return undefined;
}

/** Dotted path lookup with tolerant keys; unwraps { value } objects. */
function getPath(o: Obj, path: string): unknown {
  let cur: unknown = o;
  for (const part of path.split(".")) {
    if (!isObj(cur)) return undefined;
    cur = getKey(cur, part);
  }
  if (isObj(cur) && "value" in cur && Object.keys(cur).length <= 4) cur = cur["value"];
  return cur;
}

function firstString(sources: Obj[], paths: string[], max = 500): string | undefined {
  for (const src of sources) {
    for (const p of paths) {
      const v = getPath(src, p);
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
  }
  return undefined;
}

function firstValue(sources: Obj[], paths: string[]): unknown {
  for (const src of sources) {
    for (const p of paths) {
      const v = getPath(src, p);
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
}

/** sip:+14165550100@host, <tel:+1...>, "Name" <sip:...> → +14165550100 */
export function cleanPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(/(?:sip:|tel:)?(\+?[\d().\s-]{7,20})(?:@|>|;|$)/i);
  const candidate = (m ? m[1]! : s).trim();
  const digits = candidate.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 7) return s.slice(0, 60) || null;
  return digits.slice(0, 20);
}

export function parseTime(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  let n: number | null = null;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim())) n = Number(v.trim());
  if (n !== null) {
    // Seconds vs milliseconds since epoch.
    const ms = n < 1e11 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function roleOf(raw: unknown): VoiceTurn["role"] {
  const r = typeof raw === "string" ? raw.toLowerCase() : "";
  if (/(user|caller|customer|human|visitor|client|lead|prospect|inbound|speaker_?0|^0$)/.test(r)) return "caller";
  if (/(assistant|agent|bot|ai|grok|randy|model|system_agent|speaker_?1|^1$)/.test(r)) return "agent";
  return "other";
}

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(" ");
  if (isObj(v)) {
    for (const k of ["text", "transcript", "content", "message", "utterance", "value", "words"]) {
      const inner = getKey(v, k);
      if (inner !== undefined) {
        const t = textOf(inner);
        if (t) return t;
      }
    }
  }
  return "";
}

const MAX_TURNS = 500;
const MAX_TRANSCRIPT_CHARS = 100_000;

export function parseTurns(v: unknown): VoiceTurn[] {
  if (isObj(v)) {
    for (const k of ["turns", "messages", "items", "utterances", "segments", "entries", "conversation"]) {
      const inner = getKey(v, k);
      if (Array.isArray(inner)) return parseTurns(inner);
    }
    return [];
  }
  if (!Array.isArray(v)) return [];
  const out: VoiceTurn[] = [];
  for (const item of v.slice(0, MAX_TURNS * 2)) {
    if (typeof item === "string") {
      const m = item.match(/^\s*([A-Za-z ]{2,20}):\s*(.+)$/s);
      if (m) out.push({ role: roleOf(m[1]), text: m[2]!.trim() });
      else if (item.trim()) out.push({ role: "other", text: item.trim() });
      continue;
    }
    if (!isObj(item)) continue;
    // Skip non-speech items (function calls etc.) that carry no text.
    const text = textOf(
      firstValue([item], ["text", "transcript", "content", "message", "utterance", "words"]) ?? "",
    ).trim();
    if (!text) continue;
    const role = roleOf(firstValue([item], ["role", "speaker", "from", "participant", "author", "who", "channel", "type"]));
    const atRaw = firstValue([item], ["at", "timestamp", "time", "created_at", "start", "start_time", "offset"]);
    const at = typeof atRaw === "string" || typeof atRaw === "number" ? String(atRaw) : undefined;
    out.push({ role, text: text.slice(0, 5000), ...(at ? { at } : {}) });
    if (out.length >= MAX_TURNS) break;
  }
  return out;
}

const ROLE_LABEL: Record<VoiceTurn["role"], string> = { caller: "Caller", agent: "Randy AI", other: "Speaker" };

export function turnsToText(turns: VoiceTurn[]): string {
  return turns.map((t) => `${ROLE_LABEL[t.role]}: ${t.text}`).join("\n");
}

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const EXTRACT_WRAPPERS = [
  "extracted",
  "extracted_data",
  "extracted_fields",
  "extracted_variables",
  "extraction",
  "variables",
  "data_collection",
  "data_collection_results",
  "collected_data",
  "structured_data",
  "structured_output",
  "analysis",
  "analysis.data",
  "analysis.structured_data",
  "analysis.data_collection_results",
  "post_call",
  "post_call_analysis",
  "results",
  "lead",
  "contact",
  "customer",
  "caller",
  "fields",
  "metadata",
];

export function normalizeVoicePayload(raw: unknown): { ok: true; call: NormalizedVoiceCall } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: "Invalid payload." };
  // Standard Webhooks envelope: { object:"event", type, data:{...} }; also { payload } / { call }.
  const enveloped =
    isObj(raw["data"]) && (typeof raw["type"] === "string" || raw["object"] === "event" || !("call_id" in raw));
  const body: Obj = enveloped ? (raw["data"] as Obj) : isObj(raw["payload"]) ? (raw["payload"] as Obj) : raw;
  const callObj = isObj(getKey(body, "call")) ? (getKey(body, "call") as Obj) : {};
  const sources: Obj[] = [body, callObj, raw];

  let callId = firstString(
    sources,
    ["call_id", "callId", "call_sid", "conversation_id", "session_id", "call.id", "call_uuid", "sid"],
    200,
  );
  if (!callId) callId = firstString([callObj, ...(enveloped ? [body] : [raw])], ["id"], 200);
  if (!callId || !/^[\w.:@+\-]{1,200}$/.test(callId)) return { ok: false, error: "Missing call id." };

  // SIP headers (xAI realtime.call.incoming shape).
  const sip: Record<string, string> = {};
  const sipHeaders = firstValue(sources, ["sip_headers", "sipHeaders"]);
  if (Array.isArray(sipHeaders)) {
    for (const h of sipHeaders) {
      if (isObj(h) && typeof h["name"] === "string" && typeof h["value"] === "string") sip[h["name"].toLowerCase()] = h["value"];
    }
  }

  const callerNumber = cleanPhone(
    firstString(sources, [
      "caller_number",
      "from_number",
      "from",
      "caller",
      "caller_id",
      "caller_phone",
      "customer_number",
      "customer_phone",
      "customer.number",
      "customer.phone",
      "phone_number",
      "ani",
      "from.number",
      "from.phone_number",
    ]) ?? sip["from"],
  );
  const calledNumber = cleanPhone(
    firstString(sources, ["called_number", "to_number", "to", "assistant_phone", "agent_phone", "dnis", "to.number"]) ?? sip["to"],
  );

  const startedAt = parseTime(firstValue(sources, ["started_at", "start_time", "start_timestamp", "call_started_at", "startedAt", "start", "answered_at"]));
  const endedAt = parseTime(firstValue(sources, ["ended_at", "end_time", "end_timestamp", "call_ended_at", "endedAt", "end", "hangup_at"]));
  let durationSeconds: number | null = null;
  const dur = firstValue(sources, ["duration_seconds", "duration", "call_duration", "duration_secs", "call_duration_secs"]);
  const durMs = firstValue(sources, ["duration_ms", "durationMs"]);
  if (typeof dur === "number" || (typeof dur === "string" && /^\d+(\.\d+)?$/.test(dur))) durationSeconds = Math.round(Number(dur));
  else if (typeof durMs === "number" || (typeof durMs === "string" && /^\d+$/.test(durMs))) durationSeconds = Math.round(Number(durMs) / 1000);
  else if (startedAt && endedAt) durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

  const endReason =
    firstString(sources, [
      "end_reason",
      "ended_reason",
      "hangup_reason",
      "disconnect_reason",
      "disconnection_reason",
      "termination_reason",
      "call_end_reason",
      "ended_by",
      "hangup_by",
      "status",
    ], 200) ?? null;

  // Transcript: string or turns (or an object holding turns + text).
  const tRaw = firstValue(sources, ["transcript", "transcription", "transcript_text", "transcript_turns", "messages", "turns", "conversation", "dialogue", "items", "utterances"]);
  let turns = parseTurns(tRaw);
  let transcript: string | null = null;
  if (typeof tRaw === "string") {
    transcript = tRaw.trim() || null;
    if (!turns.length && transcript) turns = parseTurns(transcript.split(/\r?\n/).filter((l) => l.trim()));
  } else if (isObj(tRaw) && typeof getKey(tRaw, "text") === "string") {
    transcript = String(getKey(tRaw, "text")).trim() || null;
  }
  if (!transcript && turns.length) transcript = turnsToText(turns);
  if (transcript) transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS);

  // Extracted lead fields: any wrapper, then top level.
  const wrappers: Obj[] = [];
  for (const src of [body, callObj]) {
    for (const w of EXTRACT_WRAPPERS) {
      const v = getPath(src, w);
      if (isObj(v)) wrappers.push(v);
    }
  }
  const exSources = [...wrappers, body];
  const first = firstString(exSources, ["first_name", "firstName", "given_name"], 100);
  const last = firstString(exSources, ["last_name", "lastName", "family_name", "surname"], 100);
  const extracted: VoiceExtracted = {};
  const put = (k: keyof VoiceExtracted, v: string | undefined) => {
    if (v) extracted[k] = v;
  };
  put(
    "name",
    firstString(exSources, ["name", "full_name", "caller_name", "contact_name", "customer_name", "lead_name", "person_name"], 200) ??
      ([first, last].filter(Boolean).join(" ") || undefined),
  );
  put("company", firstString(exSources, ["company", "company_name", "business", "business_name", "organization", "organisation", "brand", "employer"], 200));
  const email = firstString(exSources, ["email", "email_address", "caller_email", "contact_email", "customer_email"], 320);
  if (email && EMAIL_RE.test(email)) extracted.email = email;
  const exPhone = firstString(exSources, ["phone", "phone_number", "callback_number", "callback_phone", "contact_phone", "mobile"], 60);
  put("phone", exPhone ? (cleanPhone(exPhone) ?? undefined) : undefined);
  put("role", firstString(exSources, ["role", "title", "job_title", "position"], 200));
  put("need", firstString(exSources, ["need", "needs", "interest", "use_case", "intent", "inquiry", "goal", "what_they_need"], 1000));
  put("size", firstString(exSources, ["size", "company_size", "locations", "team_size", "budget", "deal_size"], 300));
  put("timing", firstString(exSources, ["timing", "timeline", "timeframe", "when", "start_date", "urgency"], 300));
  put("summary", firstString([...wrappers, body, callObj], ["summary", "call_summary", "transcript_summary", "analysis.summary", "analysis.transcript_summary"], 4000));

  return {
    ok: true,
    call: {
      callId,
      source: "phone",
      callerNumber,
      calledNumber,
      startedAt,
      endedAt,
      durationSeconds,
      endReason,
      transcript,
      turns,
      extracted,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

export type VoiceCallRecord = NormalizedVoiceCall & {
  leadId: string | null;
  rawPayload: unknown;
  receivedCount: number;
  notifiedAt: Date | null;
  notifyError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface VoiceCallStore {
  upsert(call: NormalizedVoiceCall, raw: unknown, leadId: string, now: Date): Promise<{ created: boolean; row: VoiceCallRecord }>;
  /** Atomically claim the one notification email for this call. */
  claimNotify(callId: string, now: Date): Promise<boolean>;
  markNotifyFailed(callId: string, error: string): Promise<void>;
  get(callId: string): Promise<VoiceCallRecord | undefined>;
}

/** Later deliveries fill gaps; they never blank out what an earlier one had. */
export function mergeVoiceCall(existing: VoiceCallRecord | undefined, call: NormalizedVoiceCall, raw: unknown, leadId: string, now: Date): VoiceCallRecord {
  if (!existing) {
    return { ...call, leadId, rawPayload: raw, receivedCount: 1, notifiedAt: null, notifyError: null, createdAt: now, updatedAt: now };
  }
  return {
    ...existing,
    source: existing.source,
    callerNumber: call.callerNumber ?? existing.callerNumber,
    calledNumber: call.calledNumber ?? existing.calledNumber,
    startedAt: call.startedAt ?? existing.startedAt,
    endedAt: call.endedAt ?? existing.endedAt,
    durationSeconds: call.durationSeconds ?? existing.durationSeconds,
    endReason: call.endReason ?? existing.endReason,
    transcript: call.transcript ?? existing.transcript,
    turns: call.turns.length ? call.turns : existing.turns,
    extracted: { ...existing.extracted, ...call.extracted },
    leadId: existing.leadId ?? leadId,
    rawPayload: raw,
    receivedCount: existing.receivedCount + 1,
    updatedAt: now,
  };
}

export class MemoryVoiceCallStore implements VoiceCallStore {
  rows = new Map<string, VoiceCallRecord>();
  async upsert(call: NormalizedVoiceCall, raw: unknown, leadId: string, now: Date) {
    const existing = this.rows.get(call.callId);
    const row = mergeVoiceCall(existing, call, raw, leadId, now);
    this.rows.set(call.callId, row);
    return { created: !existing, row: { ...row } };
  }
  async claimNotify(callId: string, now: Date) {
    const r = this.rows.get(callId);
    if (!r || r.notifiedAt) return false;
    r.notifiedAt = now;
    return true;
  }
  async markNotifyFailed(callId: string, error: string) {
    const r = this.rows.get(callId);
    if (!r) return;
    r.notifiedAt = null;
    r.notifyError = error.slice(0, 300);
  }
  async get(callId: string) {
    const r = this.rows.get(callId);
    return r ? { ...r } : undefined;
  }
}

/** Mirrors lib/db/src/schema/leads.ts and scripts/sql/2026-09-24-leads-voice-calls.sql exactly. */
export const VOICE_CALLS_DDL = [
  `CREATE TABLE IF NOT EXISTS voice_calls (
  call_id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'phone',
  lead_id text,
  caller_number text,
  called_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  end_reason text,
  transcript text,
  transcript_turns jsonb NOT NULL DEFAULT '[]'::jsonb,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_count integer NOT NULL DEFAULT 1,
  notified_at timestamptz,
  notify_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`,
  `CREATE INDEX IF NOT EXISTS voice_calls_created_at_idx ON voice_calls (created_at)`,
] as const;

type RawRow = Record<string, unknown>;
const d = (v: unknown): Date | null => {
  if (v == null) return null;
  const x = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(x.getTime()) ? null : x;
};
const s = (v: unknown): string | null => (v == null ? null : String(v));

function rowToVoice(r: RawRow): VoiceCallRecord {
  return {
    callId: String(r["call_id"]),
    source: (s(r["source"]) ?? "phone") as VoiceCallSource,
    leadId: s(r["lead_id"]),
    callerNumber: s(r["caller_number"]),
    calledNumber: s(r["called_number"]),
    startedAt: d(r["started_at"]),
    endedAt: d(r["ended_at"]),
    durationSeconds: r["duration_seconds"] == null ? null : Number(r["duration_seconds"]),
    endReason: s(r["end_reason"]),
    transcript: s(r["transcript"]),
    turns: (r["transcript_turns"] as VoiceTurn[]) ?? [],
    extracted: (r["extracted"] as VoiceExtracted) ?? {},
    rawPayload: r["raw_payload"],
    receivedCount: Number(r["received_count"] ?? 1),
    notifiedAt: d(r["notified_at"]),
    notifyError: s(r["notify_error"]),
    createdAt: d(r["created_at"]) ?? new Date(),
    updatedAt: d(r["updated_at"]) ?? new Date(),
  };
}

let voiceEnsured = false;
async function voiceDb() {
  const m = await leadsDb();
  if (!voiceEnsured) {
    for (const stmt of VOICE_CALLS_DDL) await m.pool.query(stmt);
    voiceEnsured = true;
  }
  return m;
}

export class PgVoiceCallStore implements VoiceCallStore {
  async upsert(call: NormalizedVoiceCall, raw: unknown, leadId: string, now: Date) {
    const m = await voiceDb();
    const res = await m.pool.query(
      `INSERT INTO voice_calls (call_id, source, lead_id, caller_number, called_number, started_at, ended_at,
                                duration_seconds, end_reason, transcript, transcript_turns, extracted,
                                raw_payload, created_at, updated_at)
       VALUES ($1,$14,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$13)
       ON CONFLICT (call_id) DO UPDATE SET
         lead_id = COALESCE(voice_calls.lead_id, EXCLUDED.lead_id),
         caller_number = COALESCE(EXCLUDED.caller_number, voice_calls.caller_number),
         called_number = COALESCE(EXCLUDED.called_number, voice_calls.called_number),
         started_at = COALESCE(EXCLUDED.started_at, voice_calls.started_at),
         ended_at = COALESCE(EXCLUDED.ended_at, voice_calls.ended_at),
         duration_seconds = COALESCE(EXCLUDED.duration_seconds, voice_calls.duration_seconds),
         end_reason = COALESCE(EXCLUDED.end_reason, voice_calls.end_reason),
         transcript = COALESCE(EXCLUDED.transcript, voice_calls.transcript),
         transcript_turns = CASE WHEN jsonb_array_length(EXCLUDED.transcript_turns) > 0
                                 THEN EXCLUDED.transcript_turns ELSE voice_calls.transcript_turns END,
         extracted = voice_calls.extracted || EXCLUDED.extracted,
         raw_payload = EXCLUDED.raw_payload,
         received_count = voice_calls.received_count + 1,
         updated_at = EXCLUDED.updated_at
       RETURNING *, (xmax = 0) AS inserted`,
      [
        call.callId,
        leadId,
        call.callerNumber,
        call.calledNumber,
        call.startedAt,
        call.endedAt,
        call.durationSeconds,
        call.endReason,
        call.transcript,
        JSON.stringify(call.turns),
        JSON.stringify(call.extracted),
        JSON.stringify(raw ?? {}),
        now,
        call.source,
      ],
    );
    const r = res.rows[0] as RawRow;
    return { created: Boolean(r["inserted"]), row: rowToVoice(r) };
  }
  async claimNotify(callId: string, now: Date) {
    const m = await voiceDb();
    const res = await m.pool.query(
      "UPDATE voice_calls SET notified_at = $2 WHERE call_id = $1 AND notified_at IS NULL RETURNING call_id",
      [callId, now],
    );
    return (res.rowCount ?? 0) > 0;
  }
  async markNotifyFailed(callId: string, error: string) {
    const m = await voiceDb();
    await m.pool.query("UPDATE voice_calls SET notified_at = NULL, notify_error = $2 WHERE call_id = $1", [callId, error.slice(0, 300)]);
  }
  async get(callId: string) {
    const m = await voiceDb();
    const res = await m.pool.query("SELECT * FROM voice_calls WHERE call_id = $1", [callId]);
    return res.rows[0] ? rowToVoice(res.rows[0] as RawRow) : undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Email + log safety net                                              */
/* ------------------------------------------------------------------ */

function fmtToronto(x: Date | null): string {
  if (!x) return "(unknown)";
  return `${new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(x)} ET`;
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function leadPhone(r: Pick<VoiceCallRecord, "extracted" | "callerNumber">): string | null {
  return r.extracted.phone ?? r.callerNumber ?? null;
}

export function renderVoiceEmail(r: VoiceCallRecord): RenderedEmail {
  const who = r.extracted.company || r.extracted.name || "anon";
  const web = r.source === "web";
  const subject = `Birch ${web ? "web voice session" : "voice call"}: ${who}`;
  const fields: Array<[string, string | null | undefined]> = [
    ["Name", r.extracted.name],
    ["Company", r.extracted.company],
    ["Role", r.extracted.role],
    ["Phone", leadPhone(r)],
    ["Email", r.extracted.email],
    ["Need", r.extracted.need],
    ["Size", r.extracted.size],
    ["Timing", r.extracted.timing],
  ];
  const meta: Array<[string, string]> = [
    ["Call", r.callId],
    ["Channel", web ? "Web voice (birchreserve.net)" : "Phone"],
    ["Caller number", r.callerNumber ?? "(unknown)"],
    ["Called number", r.calledNumber ?? "(unknown)"],
    ["Started", fmtToronto(r.startedAt)],
    ["Ended", fmtToronto(r.endedAt)],
    ["Duration", r.durationSeconds == null ? "(unknown)" : `${Math.floor(r.durationSeconds / 60)}m ${r.durationSeconds % 60}s`],
    ["End reason", r.endReason ?? "(not given)"],
  ];
  const lines = r.turns.length ? r.turns.map((t) => `${ROLE_LABEL[t.role]}: ${t.text}`) : (r.transcript ?? "").split(/\r?\n/).filter(Boolean);
  const text = [
    web ? "Birch web voice session (Randy AI, birchreserve.net)" : "Birch voice call (Randy AI)",
    "",
    "Voice intake",
    ...fields.map(([k, v]) => `${k}: ${v?.trim() || "(not given)"}`),
    "",
    ...meta.map(([k, v]) => `${k}: ${v}`),
    ...(r.extracted.summary ? ["", "Summary", r.extracted.summary] : []),
    "",
    "Transcript",
    "----------",
    ...(lines.length ? lines.flatMap((l) => [l, ""]) : ["(no transcript in the webhook)"]),
  ].join("\n");
  const row = (k: string, v: string) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#555;vertical-align:top">${escapeHtml(k)}</td><td style="padding:2px 0">${escapeHtml(v)}</td></tr>`;
  const html = [
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.45">`,
    `<h2 style="margin:0 0 8px">${web ? "Birch web voice session (Randy AI, birchreserve.net)" : "Birch voice call (Randy AI)"}</h2>`,
    `<h3 style="margin:12px 0 4px">Voice intake</h3>`,
    `<table style="border-collapse:collapse;margin-bottom:12px">${fields.map(([k, v]) => row(k, v?.trim() || "(not given)")).join("")}</table>`,
    `<table style="border-collapse:collapse;margin-bottom:12px">${meta.map(([k, v]) => row(k, v)).join("")}</table>`,
    ...(r.extracted.summary ? [`<h3 style="margin:12px 0 4px">Summary</h3>`, `<p>${escapeHtml(r.extracted.summary)}</p>`] : []),
    `<h3 style="margin:12px 0 4px">Transcript</h3>`,
    ...(lines.length ? lines.map((l) => `<p style="margin:0 0 10px">${escapeHtml(l)}</p>`) : ["<p>(no transcript in the webhook)</p>"]),
    `</body></html>`,
  ].join("\n");
  return { subject, text, html, ...(r.extracted.email ? { replyTo: r.extracted.email } : {}) };
}

/** Lead safety net: one structured log line (kind voice_call_intake). Never in responses. */
export function logVoiceIntake(r: VoiceCallRecord, reason: string, error?: string): void {
  logger.info(
    {
      kind: "voice_call_intake",
      source: r.source,
      reason,
      call: r.callId,
      lead: r.leadId,
      intake: {
        name: r.extracted.name ?? null,
        company: r.extracted.company ?? null,
        role: r.extracted.role ?? null,
        phone: leadPhone(r),
        email: r.extracted.email ?? null,
        need: r.extracted.need ?? null,
        size: r.extracted.size ?? null,
        timing: r.extracted.timing ?? null,
      },
      callerNumber: r.callerNumber,
      startedAt: r.startedAt?.toISOString() ?? null,
      endedAt: r.endedAt?.toISOString() ?? null,
      endReason: r.endReason,
      summary: r.extracted.summary ?? null,
      transcript: r.turns.length ? r.turns.map((t) => `${ROLE_LABEL[t.role]}: ${t.text}`) : r.transcript,
      ...(error ? { error } : {}),
    },
    "Voice call intake",
  );
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

let voiceStore: VoiceCallStore = new PgVoiceCallStore();
let mailer: TranscriptMailer = resendMailer;
let mailerReady: () => boolean = resendConfigured;

export function setVoiceDepsForTests(deps: { store?: VoiceCallStore; mailer?: TranscriptMailer; mailerReady?: () => boolean }): void {
  if (deps.store) voiceStore = deps.store;
  if (deps.mailer) mailer = deps.mailer;
  if (deps.mailerReady) mailerReady = deps.mailerReady;
}

export type VoiceIngestResult = { duplicate: boolean; emailed: boolean };

/** Store + lead + log + email (once) + Friday (non-blocking). Throws only if the call row can't be saved. */
export type VoiceIngestOptions = {
  now?: Date;
  /** Lead row to merge into (web sessions started from a chat reuse chat:<id>). */
  leadId?: string;
  /** Only email when the call has caller speech or contact fields (web sessions). */
  notifyOnlyWithContent?: boolean;
};

function hasContent(r: VoiceCallRecord): boolean {
  const e = r.extracted;
  return r.turns.some((t) => t.role === "caller") || Boolean(e.name || e.company || e.email || e.phone || e.need);
}

export async function ingestVoiceCall(call: NormalizedVoiceCall, raw: unknown, opts: VoiceIngestOptions = {}): Promise<VoiceIngestResult> {
  const now = opts.now ?? new Date();
  const leadId = opts.leadId ?? (call.source === "web" ? `webvoice:${call.callId.replace(/^web:/, "")}` : `voice:${call.callId}`);
  let stored: { created: boolean; row: VoiceCallRecord };
  try {
    stored = await voiceStore.upsert(call, raw, leadId, now);
  } catch (error) {
    // DB down: the log line is the safety net (the webhook returns 500 so xAI retries).
    const message = error instanceof Error ? error.message : "store_failed";
    logVoiceIntake(mergeVoiceCall(undefined, call, raw, leadId, now), "store_failed", message);
    throw error;
  }
  const { created, row } = stored;

  const phone = leadPhone(row);
  const actionable = Boolean(phone || row.extracted.email || row.extracted.name || row.extracted.company);
  // No contact at all (e.g. an empty web session): keep the call row, no lead.
  const lead = !actionable ? undefined : await upsertLeadSafe({
    id: leadId,
    source: call.source === "web" ? "web_voice" : "voice",
    sourceRef: call.callId,
    name: row.extracted.name,
    company: row.extracted.company,
    role: row.extracted.role,
    phone,
    email: row.extracted.email,
    need: row.extracted.need ?? row.extracted.summary,
    size: row.extracted.size,
    timing: row.extracted.timing,
    now,
  });

  logVoiceIntake(row, created ? "call_ended" : "call_ended_repeat");

  let emailed = false;
  if (opts.notifyOnlyWithContent && !hasContent(row)) {
    // Empty web session (opened and closed with nothing said): stored, not emailed.
  } else if (!mailerReady()) {
    logVoiceIntake(row, "resend_not_configured");
  } else if (await voiceStore.claimNotify(call.callId, now)) {
    logVoiceIntake(row, "before_send");
    try {
      await mailer(renderVoiceEmail(row));
      emailed = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "send_failed";
      await voiceStore.markNotifyFailed(call.callId, message).catch(() => undefined);
      logVoiceIntake(row, "send_failed", message);
    }
  }

  if (lead) queueFridayPush(lead.id);
  return { duplicate: !created, emailed };
}
