/**
 * AI-search referral beacon (Randy, Nov 22 2026, Granola AEO playbook: measure AI separately from Google).
 * One ai_ref.<source>.<site> event per page load when the visit came from ChatGPT, Perplexity, Grok, Gemini,
 * Copilot, Claude, Meta AI or DeepSeek. Referrer host + utm_source only. Never anything typed.
 */
import { aiRefEvent, aiSourceOf } from "../../../api-server/src/lib/aiReferral";
import { isScaleSkin } from "@/lib/siteSkin";

export function trackAiReferral(): void {
  try {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const src = aiSourceOf({ referrer: document.referrer || null, utmSource: q.get("utm_source") });
    if (!src) return;
    const body = JSON.stringify({ event: aiRefEvent(src, isScaleSkin() ? "scale" : "birch"), path: (window.location.pathname || "/").slice(0, 200) });
    if (typeof navigator.sendBeacon === "function") navigator.sendBeacon("/v1/ui-events", new Blob([body], { type: "application/json" }));
  } catch {
    /* analytics must never break the page */
  }
}
