/**
 * "Performance only" path (Randy voice, Nov 21 2026 9:10 PM ET). For brands that are not a fit for the clinic hub
 * program: our drop-in code goes on key spots of the brand's OWN online customer experience, so they can still
 * activate offers and measure results without the clinic hub layer. One source of truth for home, media kits, the
 * intake choice, the site chat (Birch chat + Scale Squirrel), server HTML and llms.txt / llms-full.txt.
 * Rules: never "rejected"; no rates or percentages (terms are set at onboarding); no guarantees; no live-install or
 * results claims; ranges, if referenced, stay labelled as estimates.
 */
export const PERF_ONLY_HREF = "/intake?program=performance-only";
export const PERF_ONLY_URL = "https://birchreserve.net/intake?program=performance-only";
export const PERF_ONLY_PROGRAM_NOTE = "Program: Performance only (own site, no clinic layer layer)";
export const CLINIC_PROGRAM_NOTE = "Program: Clinic layer program";

export const PERFORMANCE_ONLY = {
  eyebrow: "Performance only · your own site",
  title: "Not every brand is a fit for the clinic layer program. You can still activate.",
  sub: "We place our drop-in code on key spots in your own online customer experience. No clinic layer needed.",
  spots: ["Post-purchase", "Order confirmation / thank-you", "Account pages", "Activation pages"],
  steps: [
    { n: "1", t: "Add our code", d: "A small snippet or tag from us goes on your site." },
    { n: "2", t: "Activate offers", d: "Offers show on the spots you choose, in your customer experience." },
    { n: "3", t: "Measure results", d: "See aggregate results. Performance-based terms are set at onboarding." },
  ],
  compare: [
    { k: "Clinic layer program", v: "Your offers inside clinic layers, with the clinic layer." },
    { k: "Performance only", v: "Our code on your own site. No clinic layer." },
  ],
  ranges: "Typical ranges are on this page as estimates. Not a guarantee, not Birch results.",
  cta: "Ask about performance only",
  detailsLabel: "What's included and how it works",
  details: [
    "Not every brand is a fit for the clinic layer program. Performance only is the other way to work with us.",
    "We give you a small snippet or tag. You place it, with our help, on the spots you pick: post-purchase, order confirmation or thank-you, account and activation pages.",
    "Performance-based terms are set at onboarding. Nothing is charged online and nothing runs until a person at Birch Reserve confirms the setup with you.",
    "Reporting is aggregate only. No guarantees of clicks, conversions or sales. Estimated ranges elsewhere on the page are estimates, not results.",
  ],
} as const;

/** One short paragraph for the chat prompt and llms.txt. */
export const PERF_ONLY_FACT =
  "Performance only (your own site): not every brand is a fit for the clinic layer program, and those brands can still work with us. We place our drop-in code (a small snippet or tag) on key spots in the brand's own online customer experience: post-purchase, order confirmation or thank-you, account and activation pages. They can activate offers and measure aggregate results without the clinic layer layer. Terms are performance-based and set at onboarding.";

/** Chat-only guardrail. */
export const PERF_ONLY_CHAT_RULE =
  "Say 'not every brand is a fit for the clinic layer program', never that anyone was rejected or declined. Do not quote rates, commissions or percentages for it: say performance-based terms are set at onboarding. No guarantees, and do not claim any live installs or results. If they want to start, send them to " + PERF_ONLY_URL + " (the brand intake with 'Performance only' picked).";
