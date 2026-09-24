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
import { Router, type IRouter, type Request } from "express";
import { loadVoiceCloserSystemPrompt } from "../lib/voiceCloserKnowledge";

type ChatRole = "user" | "assistant" | "system";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

type RandyChatBody = {
  messages: IncomingMessage[];
  mode?: "chat" | "hear";
  chipId?: string;
};

type RandyChatSuccess = {
  text: string;
  source: "grok";
  offerHandoff?: boolean;
};

type RandyChatDisabled = {
  error: string;
  disabled: true;
  source: "disabled";
};

const router: IRouter = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const PROVIDER_TIMEOUT_MS = 12_000;
const MAX_MESSAGES = 24;
const MAX_CONTENT_CHARS = 1_200;
const MAX_TOTAL_CHARS = 8_000;
const XAI_BASE = "https://api.x.ai/v1";
/** Default grok-3-mini for widget latency; set GROK_MODEL=grok-4 for stronger replies. */
const DEFAULT_GROK_MODEL = "grok-3-mini";

const VALID_ROLES = new Set<ChatRole>(["user", "assistant", "system"]);
const VALID_CHIPS = new Set([
  "birch_seat",
  "scale_providers",
  "align_care",
  "not_sure",
  "talk_human",
]);

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

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = requestBuckets.get(key);

  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(key, { count: 1, windowStartedAt: now });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

function parseBody(raw: unknown): { ok: true; body: RandyChatBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Invalid body." };
  }

  const obj = raw as Record<string, unknown>;
  const allowedKeys = new Set(["messages", "mode", "chipId"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      return { ok: false, error: "Unknown field." };
    }
  }

  if (!Array.isArray(obj.messages) || obj.messages.length === 0) {
    return { ok: false, error: "messages required." };
  }
  if (obj.messages.length > MAX_MESSAGES) {
    return { ok: false, error: "Too many messages." };
  }

  let total = 0;
  const messages: IncomingMessage[] = [];
  for (const item of obj.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Invalid message." };
    }
    const m = item as Record<string, unknown>;
    const role = m.role;
    const content = m.content;
    if (typeof role !== "string" || !VALID_ROLES.has(role as ChatRole)) {
      return { ok: false, error: "Invalid role." };
    }
    if (typeof content !== "string") {
      return { ok: false, error: "Invalid content." };
    }
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_CONTENT_CHARS) {
      return { ok: false, error: "Message length out of bounds." };
    }
    total += trimmed.length;
    if (total > MAX_TOTAL_CHARS) {
      return { ok: false, error: "Thread too long." };
    }
    messages.push({ role: role as ChatRole, content: trimmed });
  }

  let mode: "chat" | "hear" | undefined;
  if (obj.mode !== undefined) {
    if (obj.mode !== "chat" && obj.mode !== "hear") {
      return { ok: false, error: "Invalid mode." };
    }
    mode = obj.mode;
  }

  let chipId: string | undefined;
  if (obj.chipId !== undefined) {
    if (typeof obj.chipId !== "string" || !VALID_CHIPS.has(obj.chipId)) {
      return { ok: false, error: "Invalid chipId." };
    }
    chipId = obj.chipId;
  }

  return { ok: true, body: { messages, ...(mode ? { mode } : {}), ...(chipId ? { chipId } : {}) } };
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
    ? `UI chip selected: ${body.chipId}.`
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
        max_tokens: 420,
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "system",
            content: `${modeNote} ${chipNote} Keep replies short (2–5 sentences). Never invent checkout URLs. Never hero $899.`.trim(),
          },
          ...body.messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
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

router.post("/launch/randy-chat", async (req, res): Promise<void> => {
  if (!requestIsAllowed(req)) {
    res.status(403).json({ error: "Origin not allowed." });
    return;
  }

  const parsed = parseBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  if (isAiDisabled()) {
    const disabled: RandyChatDisabled = {
      error: "Randy chat AI disabled (RANDY_CHAT_AI_DISABLED).",
      disabled: true,
      source: "disabled",
    };
    res.status(503).json(disabled);
    return;
  }

  const apiKey = getXaiApiKey();
  if (!apiKey) {
    const disabled: RandyChatDisabled = {
      error: "Randy chat AI unavailable (missing XAI_API_KEY).",
      disabled: true,
      source: "disabled",
    };
    res.status(503).json(disabled);
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
    req.log.error(
      { err: error instanceof Error ? error.message : "knowledge_load_failed" },
      "Randy chat knowledge load failed",
    );
    res.status(503).json({
      error: "Randy chat knowledge pack unavailable.",
      disabled: true,
      source: "disabled",
    } satisfies RandyChatDisabled);
    return;
  }

  try {
    const text = await callGrok(systemPrompt, parsed.body, apiKey);
    const offerHandoff = inferOfferHandoff(parsed.body);
    const success: RandyChatSuccess = {
      text,
      source: "grok",
      ...(offerHandoff ? { offerHandoff: true } : {}),
    };

    req.log.info(
      {
        source: "grok",
        model: getGrokModel(),
        mode: parsed.body.mode ?? "chat",
        chipId: parsed.body.chipId ?? null,
        offerHandoff,
        // Never log API key or full message bodies.
        messageCount: parsed.body.messages.length,
      },
      "Randy chat Grok reply",
    );

    res.status(200).json(success);
  } catch (error) {
    req.log.warn(
      {
        err: error instanceof Error ? error.message : "grok_failed",
        model: getGrokModel(),
      },
      "Randy chat Grok call failed",
    );
    res.status(503).json({
      error: "Randy chat AI temporarily unavailable.",
      disabled: true,
      source: "disabled",
    } satisfies RandyChatDisabled);
  }
});

export default router;
