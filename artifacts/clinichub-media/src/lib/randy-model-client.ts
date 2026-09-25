/**
 * Chat Randy model client: live Grok via api-server.
 *
 * Browser calls POST /api/launch/randy-chat (XAI_API_KEY stays server-side).
 * Contract (must match artifacts/api-server/src/routes/randyChat.ts parseBody):
 *   { messages: [{ role: "user" | "assistant", content }], mode?, chipId?, sessionId?, pagePath? }
 *
 * Failures are NEVER silent: network errors, timeouts (25s), 4xx and provider
 * 5xx return { ok: false } so the widget shows a friendly error with Retry +
 * the tel fallback. A fast transient failure (dropped connection, 5xx) is first
 * retried once, quietly, with the same request (see randy-wire.ts). The canned stub is only used when the server says AI is
 * switched off / not configured (reason "disabled" | "missing_key"), e.g. local dev.
 *
 * Knowledge SoT: birch-live-ops/voice-closer/knowledge (vendored snapshot on api-server).
 */

import {
  CHECKOUT_LIVE,
  RANDY_TEL_DISPLAY,
  LIVE_HUB_PROOF_URL,
  PUBLIC_SKU_KEYS,
  VOICE_CLOSER_KNOWLEDGE_SOT,
  shouldOfferLiveHandoff,
  type DiscoveryChipId,
} from "@/lib/randy-chat-knowledge";
import { fitWireBudget, withQuietRetry } from "@/lib/randy-wire";
import { clearHumanToken, ensureHuman, humanHeaders } from "@/lib/human-gate";
import { getAttribution } from "@/lib/attribution";

export type RandyModelMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RandyModelRequest = {
  messages: RandyModelMessage[];
  mode: "chat" | "hear";
  chipId?: DiscoveryChipId;
  sessionId?: string;
};

export type RandyReplyFailure = {
  ok: false;
  kind: "timeout" | "network" | "rate_limited" | "rejected" | "unavailable";
  status?: number;
  detail?: string;
};

export type RandyModelResponse = {
  text: string;
  source: "stub" | "grok";
  /** True when the stub/model wants the UI to show tel + Book a call. */
  offerHandoff?: boolean;
};

export type RandyVoiceSession =
  | { ok: true; provider: "eve" | "grok-voice"; note: string }
  | {
      ok: false;
      reason: string;
      status: "eve_pending";
      /** Legacy stub note; Hear Randy is the ElevenLabs ConvAI widget (layout). */
      uiNote: string;
    };

const RANDY_CHAT_API = "/api/launch/randy-chat";
const RANDY_EVENT_API = "/api/launch/randy-chat/event";
/** Server gives Grok 22s; allow for network on top. */
export const FETCH_TIMEOUT_MS = 25_000;
/** Same clip the server applies, so long replies never poison later requests. */
const MAX_CONTENT_CHARS = 1_500;
const MAX_MESSAGES = 80;

function currentPagePath(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const p = window.location.pathname || "/";
  return /^\/[A-Za-z0-9._~/?=&%-]{0,199}$/.test(p) ? p : "/";
}

/** Shape the thread exactly as the server accepts it (no extra fields). */
export function toWireMessages(messages: RandyModelMessage[]): RandyModelMessage[] {
  return fitWireBudget(
    messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
      .slice(-MAX_MESSAGES)
      .map((m) => {
        const content = m.content.trim();
        return {
          role: m.role,
          content: content.length > MAX_CONTENT_CHARS ? `${content.slice(0, MAX_CONTENT_CHARS - 1)}…` : content,
        };
      }),
  );
}

void VOICE_CLOSER_KNOWLEDGE_SOT;
void CHECKOUT_LIVE;
void PUBLIC_SKU_KEYS;

function stubOfferHandoff(
  req: RandyModelRequest,
  forced?: boolean,
): boolean | undefined {
  if (forced) return true;
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const offer = shouldOfferLiveHandoff({
    discoveryTurns: req.messages.filter((m) => m.role === "user").length,
    lastUserText: lastUser?.content ?? "",
    chipId: req.chipId,
  });
  return offer || undefined;
}

/**
 * Local stub replies — used when Grok API is missing/disabled/fails.
 * Facts stay aligned with public locks; full talk-track lives in the SoT pack.
 */
async function stubRandyReply(
  req: RandyModelRequest,
): Promise<RandyModelResponse> {
  await new Promise((r) => window.setTimeout(r, 180));

  if (req.mode === "hear") {
    return {
      text: "Voice is coming soon. Keep chatting here, or tap Call for the live line.",
      source: "stub",
      offerHandoff: true,
    };
  }

  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const chip = req.chipId;

  if (chip === "talk_human" || /\b(call|human|phone)\b/i.test(lastUser?.content ?? "")) {
    return {
      text: `Happy to connect you live. Tap Call for ${RANDY_TEL_DISPLAY}. Or leave your details here and the team will call you back.`,
      source: "stub",
      offerHandoff: true,
    };
  }

  if (chip === "how_seats") {
    return {
      text: "A Birch Reserve seat is one category spot on the screens inside partner recovery hubs, so your brand is the only one in that category there. Nothing runs until an insertion order names the surface. What category are you in?",
      source: "stub",
    };
  }

  if (chip === "hold_190") {
    return {
      text: "Hold $190 gives you a 7-day look at a category before you commit; Reserve $490 locks the seat. Online checkout is live on birchreserve.net — pay there, or keep going here and I’ll walk you through it. Which category do you want to hold?",
      source: "stub",
    };
  }

  if (chip === "live_hub") {
    return {
      // Emma HARD: never spell raw hub URLs as visible prose — label / markdown href only.
      text: `Tap See a live hub — or open [See a live hub](${LIVE_HUB_PROOF_URL}). That’s the kind of surface a seat shows up on. What category would you want in front of those patients?`,
      source: "stub",
    };
  }

  if (/\b(190|490|hold|reserve|seat|price|pricing|buy|checkout)\b/i.test(lastUser?.content ?? "")) {
    return {
      text: "Two options: Hold $190 for a 7-day look, or Reserve $490 for the seat. Online checkout is live on birchreserve.net. Want to pay there, call, or keep going here?",
      source: "stub",
      offerHandoff: true,
    };
  }

  return {
    text: "Got it. Which category are you thinking about for the recovery hubs? Call is there whenever you want it; and I can line up a callback once I know a bit more.",
    source: "stub",
    offerHandoff: stubOfferHandoff(req),
  };
}

type LiveResult =
  | { ok: true; value: RandyModelResponse }
  | RandyReplyFailure
  | { ok: "stub" }
  | { ok: "human" };

/** One POST. `payload` is built once so the quiet retry sends the exact same request. */
async function fetchGrokReply(req: RandyModelRequest, payload: string): Promise<LiveResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(RANDY_CHAT_API, {
      method: "POST",
      headers: { "content-type": "application/json", ...humanHeaders() },
      body: payload,
      signal: controller.signal,
    });

    let data: {
      text?: string;
      source?: string;
      offerHandoff?: boolean;
      disabled?: boolean;
      reason?: string;
      error?: string;
    } = {};
    try {
      data = await response.json();
    } catch {
      /* non-JSON (proxy error page) */
    }

    if (response.status === 429) return { ok: false, kind: "rate_limited", status: 429 };
    // Turnstile gate (server has TURNSTILE_* keys): verify once, then retry.
    if (response.status === 401 && (data as { humanRequired?: boolean }).humanRequired) return { ok: "human" };
    if (response.status === 503 && (data.reason === "disabled" || data.reason === "missing_key")) {
      return { ok: "stub" };
    }
    if (response.status >= 400 && response.status < 500) {
      console.warn("[randy-chat] request rejected", response.status, data.error);
      return { ok: false, kind: "rejected", status: response.status, detail: data.error };
    }
    if (!response.ok) {
      console.warn("[randy-chat] unavailable", response.status, data.reason ?? data.error);
      return { ok: false, kind: "unavailable", status: response.status, detail: data.reason };
    }
    if (data.source !== "grok" || typeof data.text !== "string" || !data.text.trim()) {
      return { ok: false, kind: "unavailable", status: response.status, detail: "empty_reply" };
    }

    return {
      ok: true,
      value: {
        text: data.text.trim(),
        source: "grok",
        ...(data.offerHandoff || stubOfferHandoff(req) ? { offerHandoff: true } : {}),
      },
    };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    console.warn("[randy-chat] fetch failed", aborted ? "timeout" : error);
    return { ok: false, kind: aborted ? "timeout" : "network" };
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Live Grok via api-server. Returns a failure (never a silent canned reply)
 * unless the server explicitly reports AI switched off / not configured.
 * Never reads XAI_API_KEY in the browser.
 */
export async function requestRandyReply(
  req: RandyModelRequest,
): Promise<({ ok: true } & RandyModelResponse) | RandyReplyFailure> {
  const pagePath = currentPagePath();
  const payload = JSON.stringify({
    messages: toWireMessages(req.messages),
    mode: req.mode,
    ...(req.chipId ? { chipId: req.chipId } : {}),
    ...(req.sessionId ? { sessionId: req.sessionId } : {}),
    ...(pagePath ? { pagePath } : {}),
  });
  // Humans only: no-op when the gate is off or this tab already verified.
  await ensureHuman();
  // Quiet retry lives here, below the UI: the widget pushes no bubble for it, so
  // the visitor never sees a duplicate message or a flash of the error card.
  const attempt = () =>
    withQuietRetry(() => fetchGrokReply(req, payload), {
      onRetry: (kind) => console.warn("[randy-chat] quiet retry after", kind),
    }) as Promise<LiveResult>;
  let live = await attempt();
  if (live.ok === "human") {
    clearHumanToken();
    live = (await ensureHuman()) ? await attempt() : live;
    if (live.ok === "human") return { ok: false, kind: "rejected", status: 401, detail: "human_required" };
  }
  if (live.ok === true) return { ok: true, ...live.value };
  if (live.ok === "stub") return { ok: true, ...(await stubRandyReply(req)) };
  return live;
}

export type RandyChatEventType =
  | "tel_click"
  | "callback_request"
  | "cal_shown"
  | "qualified"
  | "close"
  | "activity";

export type RandyChatEvent = {
  sessionId: string;
  type: RandyChatEventType;
  messages?: RandyModelMessage[];
  qualify?: { company?: string; category?: string; reach?: string; timing?: string; need?: string; size?: string };
  contact?: { phone?: string; email?: string; name?: string; role?: string };
  /** Honeypot (callback form). Filled only by bots; the server drops those. */
  fax?: string;
};

function eventPayload(evt: RandyChatEvent): string {
  const pagePath = currentPagePath();
  return JSON.stringify({
    sessionId: evt.sessionId,
    type: evt.type,
    ...(evt.messages ? { messages: toWireMessages(evt.messages) } : {}),
    ...(evt.qualify ? { qualify: evt.qualify } : {}),
    ...(evt.contact ? { contact: evt.contact } : {}),
    ...(evt.fax ? { fax: evt.fax } : {}),
    ...(pagePath ? { pagePath } : {}),
    // Lead-bearing events carry first-touch attribution (server stores it on the lead).
    ...(LEAD_EVENTS.has(evt.type) && Object.keys(getAttribution()).length ? { attribution: getAttribution() } : {}),
  });
}

const LEAD_EVENTS = new Set<RandyChatEventType>(["callback_request", "qualified", "tel_click"]);

/** Transcript / handoff event. Resolves true when the server stored it. */
export async function sendRandyEvent(evt: RandyChatEvent): Promise<boolean> {
  try {
    const response = await fetch(RANDY_EVENT_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: eventPayload(evt),
      keepalive: true,
    });
    if (!response.ok) console.warn("[randy-chat] event rejected", evt.type, response.status);
    return response.ok;
  } catch (error) {
    console.warn("[randy-chat] event failed", evt.type, error);
    return false;
  }
}

/** Close / pagehide: best-effort beacon (the server sweep still emails idle sessions). */
export function beaconRandyEvent(evt: RandyChatEvent): void {
  try {
    const blob = new Blob([eventPayload(evt)], { type: "application/json" });
    if (navigator.sendBeacon?.(RANDY_EVENT_API, blob)) return;
  } catch {
    /* fall through */
  }
  void sendRandyEvent(evt);
}

/**
 * Legacy stub — Hear Randy voice is the ElevenLabs ConvAI widget mounted in layout
 * (agent_id via ELEVENLABS_RANDY_AGENT_ID). randy-chat Mode is chat|call only;
 * this helper is unused by UI. Kept for type compatibility / tests.
 */
export async function startRandyVoiceSession(): Promise<RandyVoiceSession> {
  return {
    ok: false,
    status: "eve_pending",
    reason: "In-widget Eve/Grok voice unused — Hear Randy is ElevenLabs ConvAI widget.",
    uiNote:
      "Use Hear Randy (bottom-left) for voice, or Call for the live phone line.",
  };
}
