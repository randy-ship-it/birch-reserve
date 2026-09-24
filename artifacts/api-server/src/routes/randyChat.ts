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
/** Birch Reserve site chips (HARD 2026-09-24 3:31pm ET: BR only, no portfolio menu). */
const VALID_CHIPS = new Set([
  "how_seats",
  "hold_190",
  "live_hub",
  "talk_human",
]);

const LIVE_HUB_PROOF_URL = "https://physio.drhonow.com/dr-ho/portal";

/**
 * Site scope for birchreserve.net. Layered on top of the shared voice-closer
 * pack (same brain, different front door). The vendored knowledge files are
 * untouched; this only scopes how Randy leads on this site.
 */
export const BIRCH_SITE_SCOPE_PROMPT = [
  "SITE SCOPE (overrides any portfolio-routing or multi-brand opener in the pack): You are Randy on birchreserve.net and you represent Birch Reserve only.",
  "Lead with Birch Reserve category seats inside the recovery hubs. Do not open with or offer a menu of brands (no \"Birch, Scale, Align, or something else\").",
  "Use Scale Health, Align Wellness, or RDGDH knowledge only if the visitor raises it themselves (for example \"what are the hubs?\"); answer briefly and bring it back to the Birch seat. Never pitch the portfolio or other companies.",
  "Public prices are Hold $190 (7-day look) and Reserve $490 (the seat) only. Never mention any other price or SKU. Online checkout is off: never invent checkout or payment links.",
  "Never claim reach, impression, CTR, unique-visitor, or audience-size numbers, and never guarantee patient outcomes.",
  `Live proof of a hub surface: ${LIVE_HUB_PROOF_URL} (physio.drhonow.com). Share it when the visitor asks to see a live hub.`,
  "Human path: the live line is +1 (504) 504-6526. Only suggest booking a calendar call after a short pre-screen (category, what they want in the hubs, timing).",
].join(" ");

const CHIP_INTENT_NOTES: Record<string, string> = {
  how_seats:
    "Visitor tapped \"How seats work\": explain a Birch Reserve category seat inside the recovery hubs in plain words, then ask their category.",
  hold_190:
    "Visitor tapped \"Hold a category $190\": explain the $190 7-day hold vs $490 Reserve, note checkout is off, and ask which category to hold.",
  live_hub: `Visitor tapped \"See a live hub\": share ${LIVE_HUB_PROOF_URL} as the live proof, then ask what category they would want there.`,
  talk_human:
    "Visitor tapped \"Talk to a human\": give the live line +1 (504) 504-6526 and ask one quick pre-screen question.",
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
        max_tokens: 420,
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: BIRCH_SITE_SCOPE_PROMPT },
          {
            role: "system",
            content: `${modeNote} ${chipNote} Keep replies short (2–5 sentences). Never invent checkout URLs. Birch Reserve only unless the visitor raises another company.`.trim(),
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
