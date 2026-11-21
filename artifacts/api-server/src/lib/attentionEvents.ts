/**
 * Attention metrics for the home page (Nov 21 2026, MrBeast "win attention" review): the web equivalents of CTR,
 * average view duration and average view percentage. Shared by the client (clinichub-media/src/lib/attention.ts)
 * and /v1/ui-events. Fixed names only: aggregate counts, no personal data, no typed brand names, no file names.
 *   attn.view              page view (the denominator for everything below)
 *   attn.hero_cta.<key>    hero CTA click-through (CTR)
 *   attn.scroll_<n>        scroll depth reached, once per page load (AVP)
 *   attn.first_touch       first click, tap, key or scroll after load
 *   attn.tfi_<bucket>      time to first interaction, bucketed (AVD proxy)
 *   attn.preview.<step>    "see your ad on a live hub" engagement (the wow beat)
 *   attn.beat.<name>       a beat scrolled into view (where people drop off)
 *   attn.ladder.<step>     offer ladder step clicks
 */
export const ATTENTION_DETAILS = {
  hero_cta: ["buy", "kit", "look", "preview"],
  preview: ["type", "logo", "hub", "cta"],
  beat: ["audience", "hubs", "ladder", "street", "details", "end"],
  ladder: ["look", "reserve", "sponsor", "premium"],
} as const;
export const ATTENTION_PLAIN = ["view", "scroll_25", "scroll_50", "scroll_75", "scroll_100", "first_touch", "tfi_lt3s", "tfi_3_10s", "tfi_10_30s", "tfi_gt30s"] as const;

const SET = new Set<string>([
  ...ATTENTION_PLAIN.map((n) => `attn.${n}`),
  ...Object.entries(ATTENTION_DETAILS).flatMap(([k, ds]) => ds.map((d) => `attn.${k}.${d}`)),
]);
export const ATTENTION_EVENTS: readonly string[] = [...SET];
export function isAttentionEvent(event: string): boolean {
  return SET.has(event);
}
export function tfiBucket(ms: number): "tfi_lt3s" | "tfi_3_10s" | "tfi_10_30s" | "tfi_gt30s" {
  return ms < 3000 ? "tfi_lt3s" : ms < 10000 ? "tfi_3_10s" : ms < 30000 ? "tfi_10_30s" : "tfi_gt30s";
}
