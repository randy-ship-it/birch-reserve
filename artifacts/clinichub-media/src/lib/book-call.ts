/**
 * Book a call locks (HARD Randy 2026-09-24 5:28pm ET).
 *
 * "Book a call" CTAs OPEN the Randy chat: a few qualifying questions, then the
 * AI call or a callback intake (name, company, role, phone, email, need, size,
 * timing). No calendar button, chip or link anywhere in the UI; the model may
 * give Randy's calendar only if a visitor insists on a set time.
 */
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
