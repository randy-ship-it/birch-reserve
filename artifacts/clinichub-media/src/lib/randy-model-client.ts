/**
 * Chat Randy model client — prefers live Grok via api-server; stub fallback.
 *
 * Browser calls POST /api/launch/randy-chat (XAI_API_KEY stays server-side).
 * On 503 / disabled / network failure → stub replies (graceful).
 *
 * Knowledge SoT: birch-live-ops/voice-closer/knowledge (vendored snapshot on api-server).
 */

import {
  CHECKOUT_LIVE,
  LIVE_HUB_PROOF_DISPLAY,
  LIVE_HUB_PROOF_URL,
  PUBLIC_SKU_KEYS,
  VOICE_CLOSER_KNOWLEDGE_SOT,
  shouldOfferLiveHandoff,
  type DiscoveryChipId,
} from "@/lib/randy-chat-knowledge";

export type RandyModelMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type RandyModelRequest = {
  messages: RandyModelMessage[];
  mode: "chat" | "hear";
  chipId?: DiscoveryChipId;
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
      /** Clear UI copy for Hear Randy while realtime voice is next PR. */
      uiNote: string;
    };

const RANDY_CHAT_API = "/api/launch/randy-chat";
const FETCH_TIMEOUT_MS = 14_000;

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
      text: "Hear Randy text is live when Grok is on; in-widget Eve/Grok voice is next. Stay in Chat or tap Call for the live phone closer.",
      source: "stub",
      offerHandoff: true,
    };
  }

  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const chip = req.chipId;

  if (chip === "talk_human" || /\b(call|human|phone)\b/i.test(lastUser?.content ?? "")) {
    return {
      text: "Happy to connect you live. Tap Call for +1 (504) 504-6526. After a couple of quick questions here I can also open the calendar.",
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
      text: "Hold $190 gives you a 7-day look at a category before you commit; Reserve $490 locks the seat. Online checkout is off right now, so I’ll take it from here with you. Which category do you want to hold?",
      source: "stub",
    };
  }

  if (chip === "live_hub") {
    return {
      text: `Here’s a live hub: ${LIVE_HUB_PROOF_URL} (${LIVE_HUB_PROOF_DISPLAY}). That’s the kind of surface a seat shows up on. What category would you want in front of those patients?`,
      source: "stub",
    };
  }

  if (/\b(190|490|hold|reserve|seat|price|pricing|buy|checkout)\b/i.test(lastUser?.content ?? "")) {
    return {
      text: "Two options: Hold $190 for a 7-day look, or Reserve $490 for the seat. Online checkout is off for now. Want to call, or keep going here so I can open the calendar?",
      source: "stub",
      offerHandoff: true,
    };
  }

  return {
    text: "Got it. Which category are you thinking about for the recovery hubs? Call is there whenever you want it; the calendar opens after a quick pre-screen.",
    source: "stub",
    offerHandoff: stubOfferHandoff(req),
  };
}

async function fetchGrokReply(
  req: RandyModelRequest,
): Promise<RandyModelResponse | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(RANDY_CHAT_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        mode: req.mode,
        ...(req.chipId ? { chipId: req.chipId } : {}),
      }),
      signal: controller.signal,
    });

    if (response.status === 503 || response.status === 429) {
      return null;
    }
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      text?: string;
      source?: string;
      offerHandoff?: boolean;
      disabled?: boolean;
    };

    if (data.disabled || data.source !== "grok" || typeof data.text !== "string" || !data.text.trim()) {
      return null;
    }

    return {
      text: data.text.trim(),
      source: "grok",
      ...(data.offerHandoff || stubOfferHandoff(req)
        ? { offerHandoff: true }
        : {}),
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Prefer live Grok via api-server; fall back to stub on failure/disabled.
 * Never reads XAI_API_KEY in the browser.
 */
export async function requestRandyReply(
  req: RandyModelRequest,
): Promise<RandyModelResponse> {
  const live = await fetchGrokReply(req);
  if (live) return live;
  return stubRandyReply(req);
}

/**
 * Hear Randy voice session — Eve / Grok realtime is next PR.
 * Returns structured eve_pending so UI can label progress clearly.
 * Text replies still go through requestRandyReply (Grok when available).
 */
export async function startRandyVoiceSession(): Promise<RandyVoiceSession> {
  // TODO(next PR): Wire Grok / Eve realtime voice in-widget (WebRTC or xAI voice).
  return {
    ok: false,
    status: "eve_pending",
    reason: "Eve / Grok realtime voice not wired yet — text Grok still serves Hear mode.",
    uiNote:
      "Hear Randy: text via Grok when AI is on; live Eve/Grok voice is next. Call uses the phone closer now.",
  };
}
