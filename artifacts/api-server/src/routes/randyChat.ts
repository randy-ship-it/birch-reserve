/**
 * Chat Randy — xAI Grok wire (draft-safe with disabled / missing-key 503).
 *
 * Mirrors concierge.ts patterns (origin check, rate limit, short caps) but uses
 * xAI Chat Completions (https://api.x.ai/v1) instead of OpenAI.
 *
 * Model: GROK_MODEL env, default `grok-3-mini` (lower latency for widget chat).
 * Override to `grok-4` when quality > latency.
 *
 * Auth: XAI_API_KEY (alias GROK_API_KEY). Never log or echo the key.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { loadVoiceCloserSystemPrompt } from "../lib/voiceCloserKnowledge";
import {
  ensureTranscriptSweepTimer,
  maybeSweepTranscripts,
  sendTestTranscript,
  recordTranscript,
  sweepTranscripts,
  type ContactInfo,
  type QualifyAnswers,
} from "../lib/randyChatTranscripts";

type ChatRole = "user" | "assistant";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

/**
 * Client ↔ server contract (keep in sync with clinichub-media randy-model-client.ts):
 *   POST /api/launch/randy-chat
 *     { messages: [{role:"user"|"assistant", content}], mode?: "chat"|"hear",
 *       chipId?: string, sessionId?: string, pagePath?: string }
 *   POST /api/launch/randy-chat/event
 *     { sessionId, type, messages?, qualify?, contact?, pagePath? }
 */
type RandyChatBody = {
  messages: IncomingMessage[];
  mode?: "chat" | "hear";
  chipId?: string;
  sessionId?: string;
  pagePath?: string;
};

type RandyChatSuccess = {
  text: string;
  source: "grok";
  offerHandoff?: boolean;
};

type DisabledReason = "disabled" | "missing_key" | "knowledge" | "provider_error";

type RandyChatDisabled = {
  error: string;
  disabled: true;
  source: "disabled";
  reason: DisabledReason;
};

const router: IRouter = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const EVENT_RATE_LIMIT_MAX = 60;
/** Grok can take 5–15s on long threads; client waits 25s. */
const PROVIDER_TIMEOUT_MS = 22_000;
/** Accept the whole thread (for transcripts); only the recent window goes to Grok. */
const MAX_INCOMING_MESSAGES = 80;
const MAX_CONTENT_CHARS = 1_500;
const MAX_RAW_CONTENT_CHARS = 8_000;
const MODEL_WINDOW_MESSAGES = 20;
const MODEL_WINDOW_CHARS = 9_000;
const XAI_BASE = "https://api.x.ai/v1";
/** Default grok-3-mini for widget latency; set GROK_MODEL=grok-4 for stronger replies. */
const DEFAULT_GROK_MODEL = "grok-3-mini";

const VALID_ROLES = new Set<string>(["user", "assistant", "system"]);
/** Birch Reserve site chips (HARD 2026-09-24 3:31pm ET: BR only, no portfolio menu). */
const VALID_CHIPS = new Set([
  "how_seats",
  "hold_190",
  "live_hub",
  "talk_human",
]);
/**
 * Pre-#11 chip ids. Accepted (and ignored) so a browser tab still running the
 * old bundle during a publish does not 400 and fall into a dead chat.
 */
const LEGACY_CHIPS = new Set([
  "birch_seat",
  "scale_providers",
  "align_care",
  "not_sure",
]);
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const PAGE_PATH_PATTERN = /^\/[A-Za-z0-9._~/?=&%-]{0,199}$/;

const LIVE_HUB_PROOF_URL = "https://physio.drhonow.com/dr-ho/portal";

/**
 * Thin birchreserve.net wrapper. The brain (identity, qualify flow, routing, Scale
 * answers, NEVER-SAY) lives in src/knowledge/birch-chat.prompt.txt, vendored from
 * /workspace/sales-brain/dist. Only widget-specific rules live here.
 */
export const BIRCH_SITE_SCOPE_PROMPT = [
  "WIDGET RULES (birchreserve.net chat): You are Randy from Birch Reserve. Lead with Birch Reserve category seats; never open with a menu of brands.",
  "Never pitch the portfolio or other companies unprompted.",
  `Live proof hub: ${LIVE_HUB_PROOF_URL} (share when they ask to see a live hub or who sees the ads).`,
  "When the visitor raises Scale Health, Align, clinics, providers, or care, answer properly from the brain (never brush them off) and give the ONE routing URL that fits.",
  "Links: write each as a full https:// URL on its own; the widget makes it clickable. Only URLs from the routing table.",
  "Never type a phone number: the chat's Call button and callback form carry it. The human path is qualify (2-3 questions), then the AI call or a callback, then the calendar only after both.",
  "Public prices: Hold $190 and Reserve $490 only. Checkout is off: never invent payment links. No reach, impression, CTR, or audience-size numbers.",
].join(" ");

const CHIP_INTENT_NOTES: Record<string, string> = {
  how_seats:
    "Visitor tapped \"How seats work\": explain a Birch Reserve category seat inside the recovery hubs in plain words, then ask their category.",
  hold_190:
    "Visitor tapped \"Hold a category $190\": explain the $190 7-day hold vs $490 Reserve, note checkout is off, and ask which category to hold.",
  live_hub: `Visitor tapped \"See a live hub\": share ${LIVE_HUB_PROOF_URL} as the live proof, then ask what category they would want there.`,
  talk_human:
    "Visitor tapped \"Talk to a human\": say you can set that up, ask the first quick question (company or brand), and mention the AI call or a callback come right after.",
};

const requestBuckets = new Map<
  string,
  { count: number; windowStartedAt: number }
>();

function getXaiApiKey(): string | undefined {
  const key =
    process.env["XAI_API_KEY"]?.trim() ||
    process.env["GROK_API_KEY"]?.trim() ||
    "";
  return key || undefined;
}

function getGrokModel(): string {
  return process.env["GROK_MODEL"]?.trim() || DEFAULT_GROK_MODEL;
}

function isAiDisabled(): boolean {
  return process.env["RANDY_CHAT_AI_DISABLED"] === "true";
}

function requestIsAllowed(req: Request): boolean {
  const origin = req.get("origin");
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    const requestHost = req.get("host");
    return (
      originHost === requestHost ||
      originHost === "birchreserve.net" ||
      originHost === "www.birchreserve.net" ||
      originHost.endsWith(".replit.dev") ||
      originHost.endsWith(".replit.app")
    );
  } catch {
    return false;
  }
}

function isRateLimited(key: string, max = RATE_LIMIT_MAX): boolean {
  const now = Date.now();
  const current = requestBuckets.get(key);

  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(key, { count: 1, windowStartedAt: now });
    return false;
  }

  current.count += 1;
  return current.count > max;
}

type ParseOk<T> = { ok: true; body: T };
type ParseErr = { ok: false; error: string };

function clip(text: string): string {
  return text.length > MAX_CONTENT_CHARS ? `${text.slice(0, MAX_CONTENT_CHARS - 1)}…` : text;
}

/**
 * Parse a thread. Long assistant replies and long threads are clipped/trimmed,
 * never rejected: before this, one >1200-char Grok reply or a 13th turn made
 * every later request 400 and the widget silently fell back to canned replies.
 * Client-sent "system" messages are dropped (no prompt injection via role).
 */
export function parseMessages(raw: unknown, required: boolean): ParseOk<IncomingMessage[]> | ParseErr {
  if (raw === undefined && !required) return { ok: true, body: [] };
  if (!Array.isArray(raw) || (required && raw.length === 0)) {
    return { ok: false, error: "messages required." };
  }
  const items = raw.length > MAX_INCOMING_MESSAGES ? raw.slice(-MAX_INCOMING_MESSAGES) : raw;
  const messages: IncomingMessage[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Invalid message." };
    }
    const m = item as Record<string, unknown>;
    if (typeof m.role !== "string" || !VALID_ROLES.has(m.role)) {
      return { ok: false, error: "Invalid role." };
    }
    if (typeof m.content !== "string") {
      return { ok: false, error: "Invalid content." };
    }
    const trimmed = m.content.trim();
    if (trimmed.length > MAX_RAW_CONTENT_CHARS) {
      return { ok: false, error: "Message length out of bounds." };
    }
    if (!trimmed || m.role === "system") continue;
    messages.push({ role: m.role as ChatRole, content: clip(trimmed) });
  }
  if (required && !messages.some((m) => m.role === "user")) {
    return { ok: false, error: "messages required." };
  }
  return { ok: true, body: messages };
}

/** Most recent turns that fit the model window (always ends with the latest turn). */
export function modelWindow(messages: IncomingMessage[]): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0 && out.length < MODEL_WINDOW_MESSAGES; i -= 1) {
    const m = messages[i]!;
    if (total + m.content.length > MODEL_WINDOW_CHARS && out.length > 0) break;
    total += m.content.length;
    out.unshift(m);
  }
  // Chat APIs expect the first non-system turn to be a user turn or the opener; fine either way.
  return out;
}

function parseOptionalSessionId(v: unknown): ParseOk<string | undefined> | ParseErr {
  if (v === undefined) return { ok: true, body: undefined };
  if (typeof v !== "string" || !SESSION_ID_PATTERN.test(v)) return { ok: false, error: "Invalid sessionId." };
  return { ok: true, body: v };
}

function parseOptionalPagePath(v: unknown): ParseOk<string | undefined> | ParseErr {
  if (v === undefined) return { ok: true, body: undefined };
  if (typeof v !== "string" || !PAGE_PATH_PATTERN.test(v)) return { ok: false, error: "Invalid pagePath." };
  return { ok: true, body: v };
}

export function parseBody(raw: unknown): ParseOk<RandyChatBody> | ParseErr {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid body." };
  }

  const obj = raw as Record<string, unknown>;
  const allowedKeys = new Set(["messages", "mode", "chipId", "sessionId", "pagePath"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: "Unknown field." };
    }
  }

  const parsedMessages = parseMessages(obj.messages, true);
  if (!parsedMessages.ok) return parsedMessages;

  let mode: "chat" | "hear" | undefined;
  if (obj.mode !== undefined) {
    if (obj.mode !== "chat" && obj.mode !== "hear") {
      return { ok: false, error: "Invalid mode." };
    }
    mode = obj.mode;
  }

  let chipId: string | undefined;
  if (obj.chipId !== undefined) {
    if (typeof obj.chipId !== "string" || !(VALID_CHIPS.has(obj.chipId) || LEGACY_CHIPS.has(obj.chipId))) {
      return { ok: false, error: "Invalid chipId." };
    }
    // Legacy chips are accepted but carry no intent note.
    chipId = VALID_CHIPS.has(obj.chipId) ? obj.chipId : undefined;
  }

  const sessionId = parseOptionalSessionId(obj.sessionId);
  if (!sessionId.ok) return sessionId;
  const pagePath = parseOptionalPagePath(obj.pagePath);
  if (!pagePath.ok) return pagePath;

  return {
    ok: true,
    body: {
      messages: parsedMessages.body,
      ...(mode ? { mode } : {}),
      ...(chipId ? { chipId } : {}),
      ...(sessionId.body ? { sessionId: sessionId.body } : {}),
      ...(pagePath.body ? { pagePath: pagePath.body } : {}),
    },
  };
}

const EVENT_TYPES = new Set(["tel_click", "callback_request", "cal_shown", "qualified", "close", "activity"]);
const QUALIFY_KEYS = ["company", "category", "reach", "timing"] as const;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;

export type RandyChatEventBody = {
  sessionId: string;
  type: string;
  messages: IncomingMessage[];
  qualify?: QualifyAnswers;
  contact?: ContactInfo;
  pagePath?: string;
};

export function parseEventBody(raw: unknown): ParseOk<RandyChatEventBody> | ParseErr {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "Invalid body." };
  const obj = raw as Record<string, unknown>;
  const allowed = new Set(["sessionId", "type", "messages", "qualify", "contact", "pagePath"]);
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return { ok: false, error: "Unknown field." };
  }
  if (typeof obj.sessionId !== "string" || !SESSION_ID_PATTERN.test(obj.sessionId)) {
    return { ok: false, error: "Invalid sessionId." };
  }
  if (typeof obj.type !== "string" || !EVENT_TYPES.has(obj.type)) return { ok: false, error: "Invalid type." };
  const messages = parseMessages(obj.messages, false);
  if (!messages.ok) return messages;

  let qualify: QualifyAnswers | undefined;
  if (obj.qualify !== undefined) {
    if (!obj.qualify || typeof obj.qualify !== "object" || Array.isArray(obj.qualify)) {
      return { ok: false, error: "Invalid qualify." };
    }
    qualify = {};
    for (const [k, v] of Object.entries(obj.qualify as Record<string, unknown>)) {
      if (!(QUALIFY_KEYS as readonly string[]).includes(k)) return { ok: false, error: "Invalid qualify." };
      if (typeof v !== "string" || v.length > 300) return { ok: false, error: "Invalid qualify." };
      qualify[k as (typeof QUALIFY_KEYS)[number]] = v.trim();
    }
  }

  let contact: ContactInfo | undefined;
  if (obj.contact !== undefined) {
    if (!obj.contact || typeof obj.contact !== "object" || Array.isArray(obj.contact)) {
      return { ok: false, error: "Invalid contact." };
    }
    const c = obj.contact as Record<string, unknown>;
    for (const k of Object.keys(c)) {
      if (!["phone", "email", "name"].includes(k)) return { ok: false, error: "Invalid contact." };
    }
    contact = {};
    if (c.phone !== undefined) {
      const digits = typeof c.phone === "string" ? c.phone.replace(/\D/g, "") : "";
      if (typeof c.phone !== "string" || c.phone.length > 32 || digits.length < 10 || digits.length > 15) {
        return { ok: false, error: "Invalid phone." };
      }
      contact.phone = c.phone.trim();
    }
    if (c.email !== undefined) {
      if (typeof c.email !== "string" || !EMAIL_PATTERN.test(c.email.trim())) return { ok: false, error: "Invalid email." };
      contact.email = c.email.trim();
    }
    if (c.name !== undefined) {
      if (typeof c.name !== "string" || c.name.length > 80) return { ok: false, error: "Invalid name." };
      contact.name = c.name.trim();
    }
  }
  if (obj.type === "callback_request" && !contact?.phone) {
    return { ok: false, error: "Phone required for a callback." };
  }
  const pagePath = parseOptionalPagePath(obj.pagePath);
  if (!pagePath.ok) return pagePath;

  return {
    ok: true,
    body: {
      sessionId: obj.sessionId,
      type: obj.type,
      messages: messages.body,
      ...(qualify ? { qualify } : {}),
      ...(contact ? { contact } : {}),
      ...(pagePath.body ? { pagePath: pagePath.body } : {}),
    },
  };
}

const BUY_OR_HUMAN =
  /\b(buy|purchase|checkout|pay|card|hold\s*\$?190|reserve\s*\$?490|human|call\s+me|phone|talk\s+to)\b/i;

function inferOfferHandoff(body: RandyChatBody): boolean {
  if (body.chipId === "talk_human") return true;
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  if (lastUser && BUY_OR_HUMAN.test(lastUser.content)) return true;
  const userTurns = body.messages.filter((m) => m.role === "user").length;
  return userTurns >= 2;
}

async function callGrok(
  systemPrompt: string,
  body: RandyChatBody,
  apiKey: string,
): Promise<string> {
  const model = getGrokModel();
  const modeNote =
    body.mode === "hear"
      ? "Caller selected Hear Randy: reply in concise spoken-friendly text. Do not claim live in-widget voice; Eve/Grok realtime voice is pending."
      : "Caller is in Chat Randy text mode.";
  const chipNote = body.chipId
    ? CHIP_INTENT_NOTES[body.chipId] ?? `UI chip selected: ${body.chipId}.`
    : "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(`${XAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        // grok-3-mini reasons before answering; reasoning tokens share this budget,
        // so 420 could yield empty content (→ 503). Keep replies short via the prompt.
        max_tokens: 1_200,
        temperature: 0.6,
        ...(model.startsWith("grok-3-mini") ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: BIRCH_SITE_SCOPE_PROMPT },
          {
            role: "system",
            content: `${modeNote} ${chipNote} Keep replies short (2–5 sentences). Never invent checkout URLs. Birch Reserve only unless the visitor raises another company. At most one URL per reply, from the verified routing table only.`.trim(),
          },
          ...modelWindow(body.messages).map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Do not include response body in thrown message if it might echo auth errors with tokens.
      throw new Error(`xAI HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("xAI returned empty content.");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function disabledPayload(reason: DisabledReason, error: string): RandyChatDisabled {
  return { error, disabled: true, source: "disabled", reason };
}

router.post("/launch/randy-chat", async (req, res): Promise<void> => {
  if (!requestIsAllowed(req)) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }

  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    req.log?.warn({ error: parsed.error }, "Randy chat request rejected");
    res.status(400).json({ error: parsed.error });
    return;
  }
  const body = parsed.body;

  ensureTranscriptSweepTimer();
  maybeSweepTranscripts();

  if (isAiDisabled()) {
    if (body.sessionId) {
      void recordTranscript({ id: body.sessionId, messages: body.messages, ...(body.pagePath ? { pagePath: body.pagePath } : {}) });
    }
    res.status(503).json(disabledPayload("disabled", "Randy chat AI disabled (RANDY_CHAT_AI_DISABLED)."));
    return;
  }

  const apiKey = getXaiApiKey();
  if (!apiKey) {
    if (body.sessionId) {
      void recordTranscript({ id: body.sessionId, messages: body.messages, ...(body.pagePath ? { pagePath: body.pagePath } : {}) });
    }
    res.status(503).json(disabledPayload("missing_key", "Randy chat AI unavailable (missing XAI_API_KEY)."));
    return;
  }

  if (isRateLimited(req.ip || "unknown")) {
    res.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
    return;
  }

  let systemPrompt: string;
  try {
    systemPrompt = loadVoiceCloserSystemPrompt();
  } catch (error) {
    req.log?.error(
      { err: error instanceof Error ? error.message : "knowledge_load_failed" },
      "Randy chat knowledge load failed",
    );
    res.status(503).json(disabledPayload("knowledge", "Randy chat knowledge pack unavailable."));
    return;
  }

  const startedAt = Date.now();
  try {
    const text = await callGrok(systemPrompt, body, apiKey);
    const offerHandoff = inferOfferHandoff(body);
    const success: RandyChatSuccess = {
      text,
      source: "grok",
      ...(offerHandoff ? { offerHandoff: true } : {}),
    };

    if (body.sessionId) {
      await recordTranscript({
        id: body.sessionId,
        messages: [...body.messages, { role: "assistant", content: text }],
        ...(body.pagePath ? { pagePath: body.pagePath } : {}),
      });
    }

    req.log?.info(
      {
        source: "grok",
        model: getGrokModel(),
        mode: body.mode ?? "chat",
        chipId: body.chipId ?? null,
        offerHandoff,
        ms: Date.now() - startedAt,
        // Never log API key or full message bodies.
        messageCount: body.messages.length,
      },
      "Randy chat Grok reply",
    );

    res.status(200).json(success);
  } catch (error) {
    req.log?.warn(
      {
        err: error instanceof Error ? error.message : "grok_failed",
        model: getGrokModel(),
        ms: Date.now() - startedAt,
      },
      "Randy chat Grok call failed",
    );
    if (body.sessionId) {
      void recordTranscript({ id: body.sessionId, messages: body.messages });
    }
    res.status(503).json(disabledPayload("provider_error", "Randy chat AI temporarily unavailable."));
  }
});

/**
 * Widget events: handoffs (tel click, callback request, Cal shown), qualifying
 * answers, close beacon, and local-only turns. Handoffs email the transcript now.
 */
router.post("/launch/randy-chat/event", async (req, res): Promise<void> => {
  if (!requestIsAllowed(req)) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }
  const parsed = parseEventBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  if (isRateLimited(`event:${req.ip || "unknown"}`, EVENT_RATE_LIMIT_MAX)) {
    res.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
    return;
  }
  const b = parsed.body;
  ensureTranscriptSweepTimer();
  await recordTranscript({
    id: b.sessionId,
    event: b.type,
    ...(b.messages.length ? { messages: b.messages } : {}),
    ...(b.qualify ? { qualify: b.qualify } : {}),
    ...(b.contact ? { contact: b.contact } : {}),
    ...(b.pagePath ? { pagePath: b.pagePath } : {}),
  });
  if (b.type === "tel_click" || b.type === "callback_request" || b.type === "cal_shown") {
    // Await (bounded by the mailer's 10s timeout) so Autoscale can't freeze the
    // instance before the handoff email goes out.
    await sweepTranscripts({ onlyId: b.sessionId }).catch((error) =>
      req.log?.warn({ err: error }, "Randy chat handoff transcript send failed"),
    );
  } else {
    maybeSweepTranscripts();
  }
  req.log?.info({ type: b.type, messageCount: b.messages.length }, "Randy chat event");
  res.status(200).json({ ok: true });
});

/**
 * Post-publish smoke test: POST /api/launch/randy-chat/transcript-test with header
 * x-randy-admin-token equal to env RANDY_CHAT_ADMIN_TOKEN. 404 when the env is unset.
 */
router.post("/launch/randy-chat/transcript-test", async (req, res): Promise<void> => {
  const expected = process.env["RANDY_CHAT_ADMIN_TOKEN"]?.trim();
  if (!expected) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const given = String(req.get("x-randy-admin-token") ?? "");
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  try {
    const result = await sendTestTranscript();
    res.status(result.sent ? 200 : 503).json(result);
  } catch (error) {
    req.log?.warn({ err: error }, "Randy chat test transcript failed");
    res.status(502).json({ sent: false, reason: "send_failed" });
  }
});

export default router;
