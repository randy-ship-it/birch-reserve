/**
 * Chat Randy knowledge pointer — DRAFT.
 *
 * HARD: Same SoT as the phone voice closer. Do NOT fork a chat-only knowledge pack.
 * SoT path (ops / phone / chat share this):
 *   /workspace/birch-live-ops/voice-closer/knowledge/
 *
 * Files to load when Grok/xAI is wired (paste / RAG order per README.md):
 *   SYSTEM-PROMPT.md · BIRCH-OFFER.md · NEVER-SAY.md · HANDOFF-CHECKLIST.md
 *   CROSS-PORTFOLIO.md · SCALE.md · ALIGN.md · RDGDH-PORTFOLIO.md · TEAM-ACCESS.md
 *
 * This module only exports path constants + lightweight UI intent helpers.
 * It does not duplicate offer copy from the pack.
 */

/** Absolute ops SoT shared with phone closer. */
export const VOICE_CLOSER_KNOWLEDGE_SOT =
  "/workspace/birch-live-ops/voice-closer/knowledge/" as const;

/** Relative map for future agent/RAG wiring (same pack, no fork). */
export const VOICE_CLOSER_KNOWLEDGE_FILES = [
  "SYSTEM-PROMPT.md",
  "BIRCH-OFFER.md",
  "NEVER-SAY.md",
  "HANDOFF-CHECKLIST.md",
  "CROSS-PORTFOLIO.md",
  "SCALE.md",
  "ALIGN.md",
  "RDGDH-PORTFOLIO.md",
  "TEAM-ACCESS.md",
  "README.md",
] as const;

/** Public SKUs only — never hero $899 / reserve-899. */
export const PUBLIC_SKU_KEYS = ["hold-190", "reserve-490"] as const;

/** Checkout OFF until Gordon — chat must not invent pay links or claim live checkout. */
export const CHECKOUT_LIVE = false;

export const RANDY_TEL_HREF = "tel:+15045046526" as const;
export const RANDY_TEL_DISPLAY = "+1 (504) 504-6526" as const;

export type RandyChatMode = "chat" | "hear" | "call";

export type DiscoveryChipId =
  | "birch_seat"
  | "scale_providers"
  | "align_care"
  | "not_sure"
  | "talk_human";

export const SMART_OPENER =
  "Hey — Randy here. Birch, Scale, Align, or something else in the portfolio? Tell me what you were looking at and I’ll point you." as const;

export const SUGGESTION_CHIPS: ReadonlyArray<{
  id: DiscoveryChipId;
  label: string;
}> = [
  { id: "birch_seat", label: "Birch Reserve seat" },
  { id: "scale_providers", label: "Scale providers / hubs" },
  { id: "align_care", label: "Align care network" },
  { id: "not_sure", label: "Not sure yet" },
  { id: "talk_human", label: "Talk to a human" },
] as const;

const BUY_INTENT =
  /\b(buy|purchase|checkout|pay|card|hold\s*\$?190|reserve\s*\$?490|lock\s+(the\s+)?seat|get\s+(the\s+)?seat)\b/i;
const HUMAN_ASK =
  /\b(human|real\s+person|talk\s+to\s+(randy|someone|a\s+person|you)|call\s+me|phone|speak\s+to|live\s+agent)\b/i;

export function detectsBuyIntent(text: string): boolean {
  return BUY_INTENT.test(text);
}

export function detectsHumanAsk(text: string): boolean {
  return HUMAN_ASK.test(text);
}

/** After 2–3 discovery turns, or buy/human intent → surface tel; Cal only once qualified. */
export function shouldOfferLiveHandoff(opts: {
  discoveryTurns: number;
  lastUserText: string;
  chipId?: DiscoveryChipId;
}): boolean {
  if (opts.chipId === "talk_human") return true;
  if (detectsBuyIntent(opts.lastUserText) || detectsHumanAsk(opts.lastUserText)) {
    return true;
  }
  return opts.discoveryTurns >= 2;
}
