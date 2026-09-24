/**
 * POST /api/voice/web-session-ended: the in-browser live voice client on
 * birchreserve.net ("AI call now", the chat Call chip, /sales/voice-demo) reports
 * each session when it ends, including unexpected closes (sendBeacon / keepalive
 * fetch on pagehide). Saved to voice_calls (source "web", call_id
 * "web:<sessionId>") and to the single leads row, then pushed to Friday like chat.
 *
 * Public (no secret, it is called from the browser), so: Origin-checked like
 * /api/launch/randy-chat/event, rate-limited per IP, strictly validated, and the
 * response is always a bare { ok: true } (never echoes contact data).
 * Idempotent on sessionId: the pagehide beacon and the explicit end can both
 * arrive; the second merges into the first.
 */
import { Router, type IRouter, type Request } from "express";
import { ingestVoiceCall, parseTime, type NormalizedVoiceCall, type VoiceExtracted, type VoiceTurn } from "../lib/voiceCalls";

const router: IRouter = Router();

const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const FIELD_KEYS = ["name", "company", "role", "phone", "email", "need", "size", "timing"] as const;
const FIELD_MAX = 300;
const MAX_TURNS = 300;
const MAX_TURN_CHARS = 2000;
const ALLOWED_KEYS = new Set([
  "sessionId",
  "chatSessionId",
  "startedAt",
  "endedAt",
  "endReason",
  "transcript",
  "fields",
  "pagePath",
  "surface",
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function webVoiceOriginAllowed(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return true; // same-origin navigations / beacons without Origin
  try {
    const originHost = new URL(origin).host;
    return (
      originHost === req.get("host") ||
      originHost === "birchreserve.net" ||
      originHost === "www.birchreserve.net" ||
      originHost.endsWith(".replit.dev") ||
      originHost.endsWith(".replit.app")
    );
  } catch {
    return false;
  }
}

const hits = new Map<string, number[]>();
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 30;
export function resetWebVoiceRateLimitForTests(): void {
  hits.clear();
}
function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

export type WebSessionBody = {
  sessionId: string;
  chatSessionId?: string;
  call: NormalizedVoiceCall;
};

/** sendBeacon may arrive as text/plain; accept a JSON string body too. */
function asObject(body: unknown): Record<string, unknown> | null {
  let b = body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch {
      return null;
    }
  }
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
}

export function parseWebSessionBody(raw: unknown): { ok: true; body: WebSessionBody } | { ok: false; error: string } {
  const o = asObject(raw);
  if (!o) return { ok: false, error: "Invalid body." };
  for (const k of Object.keys(o)) if (!ALLOWED_KEYS.has(k)) return { ok: false, error: "Invalid body." };
  if (typeof o["sessionId"] !== "string" || !SESSION_ID_RE.test(o["sessionId"])) return { ok: false, error: "Invalid session." };
  const chat = o["chatSessionId"];
  if (chat !== undefined && (typeof chat !== "string" || !SESSION_ID_RE.test(chat))) return { ok: false, error: "Invalid session." };

  const turns: VoiceTurn[] = [];
  if (o["transcript"] !== undefined) {
    if (!Array.isArray(o["transcript"]) || o["transcript"].length > MAX_TURNS) return { ok: false, error: "Invalid transcript." };
    for (const t of o["transcript"]) {
      if (!t || typeof t !== "object") return { ok: false, error: "Invalid transcript." };
      const { role, content, at } = t as Record<string, unknown>;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return { ok: false, error: "Invalid transcript." };
      const text = content.trim().slice(0, MAX_TURN_CHARS);
      if (!text) continue;
      turns.push({ role: role === "user" ? "caller" : "agent", text, ...(typeof at === "string" && at.length <= 40 ? { at } : {}) });
    }
  }

  const extracted: VoiceExtracted = {};
  if (o["fields"] !== undefined) {
    const f = o["fields"];
    if (!f || typeof f !== "object" || Array.isArray(f)) return { ok: false, error: "Invalid fields." };
    for (const [k, v] of Object.entries(f as Record<string, unknown>)) {
      if (!(FIELD_KEYS as readonly string[]).includes(k)) return { ok: false, error: "Invalid fields." };
      if (v == null || v === "") continue;
      if (typeof v !== "string" || v.length > FIELD_MAX) return { ok: false, error: "Invalid fields." };
      const val = v.trim();
      if (!val) continue;
      if (k === "email" && !EMAIL_RE.test(val)) continue;
      extracted[k as (typeof FIELD_KEYS)[number]] = val;
    }
  }

  const str = (k: string, max: number) => {
    const v = o[k];
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  };
  const startedAt = parseTime(o["startedAt"]);
  const endedAt = parseTime(o["endedAt"]);
  const endReason = str("endReason", 80);
  const call: NormalizedVoiceCall = {
    callId: `web:${o["sessionId"]}`,
    source: "web",
    callerNumber: null,
    calledNumber: null,
    startedAt,
    endedAt,
    durationSeconds: startedAt && endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null,
    endReason, // surface + pagePath stay in raw_payload
    transcript: turns.length ? turns.map((t) => `${t.role === "caller" ? "Visitor" : "Randy AI"}: ${t.text}`).join("\n") : null,
    turns,
    extracted,
  };
  return { ok: true, body: { sessionId: o["sessionId"], ...(typeof chat === "string" ? { chatSessionId: chat } : {}), call } };
}

router.post("/voice/web-session-ended", async (req, res): Promise<void> => {
  if (!webVoiceOriginAllowed(req)) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }
  if (rateLimited(req.ip || "unknown")) {
    res.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
    return;
  }
  const parsed = parseWebSessionBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { call, chatSessionId } = parsed.body;
  try {
    const raw = asObject(req.body);
    await ingestVoiceCall(call, raw, {
      notifyOnlyWithContent: true,
      ...(chatSessionId ? { leadId: `chat:${chatSessionId}` } : {}),
    });
  } catch (error) {
    req.log?.warn({ err: error instanceof Error ? error.message : "web_voice_ingest_failed" }, "Web voice session save failed");
    res.status(500).json({ error: "Could not save the session." });
    return;
  }
  res.status(200).json({ ok: true });
});

export default router;
