/**
 * Book a call URL locks — HARD Randy 2026-09-24 ~3:00pm ET.
 *
 * Primary "Book a call" CTAs must OPEN/FOCUS the Randy chat widget for
 * qualifying dialogue. Do NOT navigate straight to Cal (never cold-dump).
 *
 * Cal is ONLY offered in-thread after qualification
 * (2–3 smart discovery turns OR clear fit) OR after Hear Randy / Call
 * paths that already screened.
 */
/** Post-qualify only: rendered solely inside Randy chat after the AI call / callback step. */
export const BOOK_CALL_CAL_URL = "https://cal.com/randy-gilling/30min" as const;


/** Mailto kept as secondary / fallback only. */
export const BOOK_CALL_MAILTO_HREF =
  "mailto:randy@silverbirchgrowth.com?subject=Book%20a%20call%20%E2%80%94%20Birch%20Reserve" as const;

export const BOOK_CALL_LABEL = "Book a call" as const;

/** Custom event name — Layout-mounted RandyChat listens. */
export const OPEN_RANDY_CHAT_EVENT = "birch:open-randy-chat" as const;

export type OpenRandyChatDetail = {
  reason?: "book-a-call" | "launcher" | "concierge" | "voice-demo";
  mode?: "chat" | "hear" | "call";
};

/** Primary Book a call / open-chat helper — never assigns location to Cal. */
export function openRandyChat(detail: OpenRandyChatDetail = { reason: "book-a-call" }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_RANDY_CHAT_EVENT, { detail }),
  );
}
