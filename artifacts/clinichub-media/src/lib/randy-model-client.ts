/**
 * Chat Randy model client — DRAFT STUB.
 *
 * TODO(Emma/Randy authorize + Grok wire): call xAI / Grok with instructions
 * loaded from VOICE_CLOSER_KNOWLEDGE_SOT (same pack as phone — no chat-only fork).
 *
 * Do NOT turn this on for publish until draft is greenlit.
 * Existing Birch Guide concierge uses OpenAI via api-server; Randy chat is Grok/xAI later.
 */

import {
  CHECKOUT_LIVE,
  PUBLIC_SKU_KEYS,
  VOICE_CLOSER_KNOWLEDGE_SOT,
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

/**
 * Stub replies for draft UX. Replace body with Grok when wired.
 * Facts stay aligned with public locks; full talk-track lives in the SoT pack.
 */
export async function requestRandyReply(
  req: RandyModelRequest,
): Promise<RandyModelResponse> {
  // TODO: Wire Grok/xAI here. Load system prompt from VOICE_CLOSER_KNOWLEDGE_SOT.
  // Example future env: XAI_API_KEY / GROK_MODEL — not read in this draft.
  void VOICE_CLOSER_KNOWLEDGE_SOT;
  void CHECKOUT_LIVE;
  void PUBLIC_SKU_KEYS;

  await new Promise((r) => window.setTimeout(r, 280));

  if (req.mode === "hear") {
    return {
      text: "Hear Randy is stubbed for draft — Eve / Grok voice lands next. Stay in Chat for now, or tap Call for the live phone closer.",
      source: "stub",
      offerHandoff: true,
    };
  }

  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
  const chip = req.chipId;

  if (chip === "talk_human" || /\b(call|human|phone)\b/i.test(lastUser?.content ?? "")) {
    return {
      text: "Happy to connect you live. Tap Call for +1 (504) 504-6526. Calendar unlocks after this pre-screen.",
      source: "stub",
      offerHandoff: true,
    };
  }

  if (chip === "birch_seat") {
    return {
      text: "Birch Reserve is a category seat on signed Scale hubs — Hold $190 for a 7-day look, Reserve $490 for the seat + media credit. Checkout is off until Gordon stamps; I can take interest or get you on a call. What category are you thinking?",
      source: "stub",
    };
  }

  if (chip === "scale_providers") {
    return {
      text: "That’s a Scale Health door — rails, not leads. Providers list a surface; hubs are the free store. Want the providers path, clinichubs, or a quick call?",
      source: "stub",
    };
  }

  if (chip === "align_care") {
    return {
      text: "Align is the care / MSP fulfillment lane — separate from Birch display. I can route you, or we hop on a call if it’s custom.",
      source: "stub",
    };
  }

  if (chip === "not_sure") {
    return {
      text: "No problem. Are you a brand looking for hub placement, a clinic/provider, or exploring the portfolio?",
      source: "stub",
    };
  }

  if (/\b(190|490|hold|reserve|seat|price|pricing|buy|checkout)\b/i.test(lastUser?.content ?? "")) {
    return {
      text: "Public SKUs are Hold $190 and Reserve $490 only — no $899 hero. Checkout stays off until Gordon. Prefer Call now, or keep chatting so I can unlock the calendar?",
      source: "stub",
      offerHandoff: true,
    };
  }

  return {
    text: "Got it. One more beat — brand/display seat, Scale providers/hubs, or Align care? Call is there when you’re ready; calendar after we qualify.",
    source: "stub",
  };
}

/** Placeholder for in-widget live audio (Eve / Grok voice until clone). */
export async function startRandyVoiceSession(): Promise<{ ok: false; reason: string }> {
  // TODO: Wire Grok voice / Eve realtime session in-widget.
  return {
    ok: false,
    reason: "DRAFT: Hear Randy voice backend not wired yet (Eve / Grok voice until clone).",
  };
}
