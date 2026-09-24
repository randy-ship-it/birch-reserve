/** Emma HARD 2026-09-24 — only public booking URL. Do not invent others. */
export const BOOK_CALL_CAL_URL = "https://cal.com/randy-gilling/30min" as const;

/** Primary Book a call CTA — Cal 30 Min Meeting (Mon–Fri 1–3pm America/Toronto). */
export const BOOK_CALL_HREF = BOOK_CALL_CAL_URL;

/** Mailto kept as secondary / fallback only. */
export const BOOK_CALL_MAILTO_HREF =
  "mailto:randy@silverbirchgrowth.com?subject=Book%20a%20call%20%E2%80%94%20Birch%20Reserve" as const;

export const BOOK_CALL_LABEL = "Book a call" as const;
