/**
 * Chat Randy knowledge pointer.
 *
 * HARD: Same SoT as the phone voice closer. Do NOT fork a chat-only knowledge pack.
 * SoT (ops): /workspace/birch-live-ops/voice-closer/knowledge/
 * Runtime snapshot (api-server Autoscale): artifacts/api-server/src/knowledge/voice-closer/
 * Re-sync from SoT before ship — do not invent alternate talk-track in the snapshot.
 *
 * Files (paste / RAG order per SoT README.md):
 *   SYSTEM-PROMPT.md · BIRCH-OFFER.md · NEVER-SAY.md · HANDOFF-CHECKLIST.md
 *   CROSS-PORTFOLIO.md · SCALE.md · ALIGN.md · RDGDH-PORTFOLIO.md · TEAM-ACCESS.md
 *
 * This module only exports path constants + lightweight UI intent helpers.
 * It does not duplicate offer copy from the pack.
 */

/** Absolute ops SoT shared with phone closer. */
export const VOICE_CLOSER_KNOWLEDGE_SOT =
  "/workspace/birch-live-ops/voice-closer/knowledge/" as const;

/** Vendored runtime snapshot inside birch-reserve (Autoscale-readable). */
export const VOICE_CLOSER_KNOWLEDGE_VENDORED =
  "artifacts/api-server/src/knowledge/voice-closer/" as const;

/** Relative map for agent/RAG wiring (same pack, no fork). */
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

/**
 * The ONE place the live/AI call number lives on the client. Set VITE_RANDY_TEL
 * (E.164, e.g. +14165550123) at build time to swap numbers; fallback is the current line.
 */
const RANDY_TEL_E164 = (() => {
  const raw = String(import.meta.env.VITE_RANDY_TEL ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return "+15045046526";
})();
export const RANDY_TEL_HREF = `tel:${RANDY_TEL_E164}`;
/** HARD 3:42pm ET: after qualifying, the next step is an AI call first. */
export const AI_CALL_LABEL = "Get a call from Randy's AI now" as const;
export const RANDY_TEL_DISPLAY = `+1 (${RANDY_TEL_E164.slice(2, 5)}) ${RANDY_TEL_E164.slice(5, 8)}-${RANDY_TEL_E164.slice(8)}`;

export type RandyChatMode = "chat" | "hear" | "call";

/**
 * HARD Randy 2026-09-24 3:31pm ET: birchreserve.net = BIRCH RESERVE ONLY.
 * Greeting + chips are Birch only. Scale / Align / RDGDH knowledge is used
 * only when the visitor raises it mid-dialogue — never a portfolio menu here.
 */
export type DiscoveryChipId =
  | "how_seats"
  | "hold_190"
  | "live_hub"
  | "talk_human";

/** Live proof of a recovery hub surface (public). */
export const LIVE_HUB_PROOF_URL = "https://physio.drhonow.com/dr-ho/portal" as const;
export const LIVE_HUB_PROOF_DISPLAY = "physio.drhonow.com" as const;

export const SMART_OPENER =
  "Hey, I’m Randy. Want to see how a seat inside the recovery hubs works?" as const;

/** Teaser bubble shown beside the full-body figure (closed state). */
export const TEASER_TEXT = "Got a category in mind? Ask me." as const;

export const SUGGESTION_CHIPS: ReadonlyArray<{
  id: DiscoveryChipId;
  label: string;
  /** What is sent to the model as the visitor turn (label stays in the bubble). */
  message: string;
}> = [
  {
    id: "how_seats",
    label: "How seats work",
    message: "How does a Birch Reserve category seat inside the recovery hubs work?",
  },
  {
    id: "hold_190",
    label: "Hold a category $190",
    message: "I want to hold a category for $190. How does the hold work?",
  },
  {
    id: "live_hub",
    label: "See a live hub",
    message: "Can I see a live hub?",
  },
  {
    id: "talk_human",
    label: "Talk to a human",
    message: "I’d like to talk to a human.",
  },
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

/**
 * Book a call qualifying questions (HARD 2026-09-24 3:42pm ET). Book a call opens the chat
 * and asks these first; next step is the AI call (tel) or a callback request,
 * and only then, if qualified, Randy's calendar.
 */
export type QualifyKey = "company" | "category" | "timing";

export const QUALIFY_QUESTIONS: ReadonlyArray<{ key: QualifyKey; prompt: string }> = [
  {
    key: "company",
    prompt:
      "Happy to set up a call. Three quick questions so it's useful. First, what's your brand or company?",
  },
  {
    key: "category",
    prompt: "Thanks. What category are you in, and who do you want to reach?",
  },
  {
    key: "timing",
    prompt:
      "Last one: what's your timing, and a rough budget range? (For reference, a hold is $190 and a seat is $490.)",
  },
] as const;

export function qualifyDoneMessage(company?: string): string {
  const who = company?.trim() ? `Perfect, ${company.trim()}.` : "Perfect.";
  return `${who} Fastest next step: ${AI_CALL_LABEL.replace("Get", "get")} (it picks up right away), or leave your number and we'll call you back. Once that's done I can open Randy's calendar.`;
}

export const TALK_HUMAN_REPLY =
  "Sure. The fastest way is a call from Randy's AI right now, or leave your number and we'll call you back." as const;
