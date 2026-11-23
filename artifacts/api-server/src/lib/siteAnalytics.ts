/**
 * Site analytics (Randy, voice, Nov 23 2026 4:16 PM ET). One pipe: /v1/ui-events -> site_cta_events, the table the
 * attention (attn.*), intake (intake.*) and CTA (cta_*) events already use. Client: clinichub-media/src/lib/siteAnalytics.ts.
 *
 *   a.pv                    page view (every route, SPA navigations included); first view carries the source
 *   a.scroll_25|50|75|100   scroll depth, once per page view
 *   a.click.<name>          click; name is one of CLICK_NAMES, label = data-testid (or aria / short static text), area
 *   a.form_start|form_submit  first focus in a form / its submit; label = the form's test id
 * Server-added columns: skin (birch | scale, from the Origin), device + browser + os (coarse, from the UA), vh (a visitor
 * hash that rotates daily: HMAC(day, ip, ua) truncated; neither ip nor ua is stored), is_test (QA traffic).
 * Funnel checkout + paid counts come from Stripe itself (read-only list), the source of truth.
 * Dashboard: /ads/admin/analytics (admin sign-in) and the signed read-only link it mints for Friday.
 */
import { hashRef } from "./adserver/auth";

export const CLICK_NAMES = ["get_my_kit", "buy_ads_now", "look_7day", "reserve", "inquire_premium", "chat_open", "call_voice", "call_phone", "hub_chip", "media_kit", "pdf_download", "other"] as const;
const CLICK_SET = new Set<string>(CLICK_NAMES);
const PLAIN = new Set(["a.pv", "a.scroll_25", "a.scroll_50", "a.scroll_75", "a.scroll_100", "a.form_start", "a.form_submit"]);

export function isSiteEvent(event: string): boolean {
  if (PLAIN.has(event)) return true;
  const m = /^a\.click\.([a-z0-9_]+)$/.exec(event);
  return Boolean(m && CLICK_SET.has(m[1]!));
}

export const SITE_EVENT_KEYS = ["skin", "w", "test", "ref", "us", "um", "uc", "src", "label", "area"] as const;

export type SiteExtras = {
  label: string | null; area: string | null; refHost: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
  src: string | null; skin: "birch" | "scale"; width: number | null; clientTest: boolean;
};

const tok = (v: unknown, max: number, re = /^[a-z0-9_:.-]+$/) => {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().trim().slice(0, max);
  return s && re.test(s) ? s : null;
};

export function parseSiteExtras(r: Record<string, unknown>): SiteExtras {
  const w = typeof r.w === "number" && Number.isFinite(r.w) ? Math.max(0, Math.min(10000, Math.round(r.w))) : null;
  return {
    label: tok(r.label, 40, /^[a-z0-9_]+$/), area: tok(r.area, 12, /^[a-z]+$/), refHost: tok(r.ref, 80, /^[a-z0-9.-]+$/),
    utmSource: tok(r.us, 40, /^[a-z0-9_-]+$/), utmMedium: tok(r.um, 40, /^[a-z0-9_-]+$/), utmCampaign: tok(r.uc, 40, /^[a-z0-9_-]+$/),
    src: tok(r.src, 48, /^(st|qr|ref|src):[a-z0-9_-]+$/), skin: r.skin === "scale" ? "scale" : "birch", width: w, clientTest: r.test === true,
  };
}

export function uaInfo(ua: string, width: number | null = null): { device: string; browser: string; os: string; bot: boolean } {
  const u = ua || "";
  const bot = /bot|crawl|spider|slurp|preview|headless|lighthouse|python|curl|wget|httpclient|axios|node-fetch|go-http|java\//i.test(u);
  const tablet = /ipad|tablet|(android(?!.*mobile))|kindle|silk/i.test(u);
  const mobile = !tablet && /mobi|iphone|ipod|android.*mobile|windows phone/i.test(u);
  let device = tablet ? "tablet" : mobile ? "mobile" : "desktop";
  if (device === "desktop" && width !== null && width > 0 && width < 600) device = "mobile";
  const browser = /edg\//i.test(u) ? "Edge" : /samsungbrowser/i.test(u) ? "Samsung" : /opr\/|opera/i.test(u) ? "Opera" : /firefox|fxios/i.test(u) ? "Firefox"
    : /crios|chrome|chromium/i.test(u) ? "Chrome" : /safari/i.test(u) ? "Safari" : "Other";
  const os = /iphone|ipad|ipod/i.test(u) ? "iOS" : /android/i.test(u) ? "Android" : /mac os x|macintosh/i.test(u) ? "macOS" : /windows/i.test(u) ? "Windows" : /cros/i.test(u) ? "ChromeOS" : /linux/i.test(u) ? "Linux" : "Other";
  return { device: bot ? "bot" : device, browser, os, bot };
}

/** Cookieless daily visitor hash. Rotates at 00:00 UTC; ip and ua never leave this function. */
export const visitorDayHash = (ip: string, ua: string, now = Date.now()) => hashRef(`vh:${new Date(now).toISOString().slice(0, 10)}:${ip}|${ua}`).slice(0, 16);

/* ------------------------------------------------------------------------------------------ aggregation */
export type EventRow = {
  event: string; path: string; label: string | null; skin: string | null; device: string | null; browser: string | null; os: string | null;
  refHost: string | null; utmSource: string | null; src: string | null; vh: string | null; isTest: boolean; createdAt: Date;
};
export type StripeFunnel = { created: number; paid: number; createdBySkin: Record<string, number>; available: boolean; note?: string };

const BUY_PATH = /^\/(intake|exclusive|buy|buy-ads|buyads|buycalc|sponsor|checkout)(\/|$)/;
const LIVE_MS = 5 * 60_000;

function inc(m: Map<string, number>, k: string, n = 1) { m.set(k, (m.get(k) ?? 0) + n); }
const top = (m: Map<string, number>, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }));
/** Distinct visitors where a hash exists, plus one per row for legacy rows (stored before the hash existed). */
function people(rows: EventRow[]): number {
  const s = new Set<string>(); let legacy = 0;
  for (const r of rows) { if (r.vh) s.add(r.vh); else legacy += 1; }
  return s.size + legacy;
}
/** Legacy home-page rows (attn.view / attn.scroll_*) stand in for a.pv / a.scroll_* only before the new events existed. */
const isView = (r: EventRow) => r.event === "a.pv" || (r.event === "attn.view" && !r.vh);
const scrollOf = (r: EventRow) => { const m = /^(?:a|attn)\.scroll_(\d+)$/.exec(r.event); return m && (r.event.startsWith("a.") || !r.vh) ? Number(m[1]) : null; };

export function sourceOf(r: Pick<EventRow, "refHost" | "utmSource" | "src">): string {
  if (r.src) return r.src.startsWith("st:") ? "street team" : r.src.startsWith("qr:") ? "qr" : r.src;
  if (r.utmSource) return `utm:${r.utmSource}`;
  if (r.refHost === "internal") return "internal";
  if (!r.refHost) return "direct";
  const h = r.refHost;
  if (/google\./.test(h)) return "google";
  if (/bing\.|duckduckgo|yahoo\./.test(h)) return "search (other)";
  if (/chatgpt|openai|perplexity|gemini|copilot|grok|claude/.test(h)) return "ai search";
  if (/linkedin|lnkd/.test(h)) return "linkedin";
  if (/(^|\.)x\.com|twitter|t\.co$/.test(h)) return "x";
  if (/facebook|instagram|fb\.|meta\./.test(h)) return "meta";
  if (/scalehealth/.test(h)) return "scalehealth.ca";
  if (/mail\.|outlook|gmail/.test(h)) return "email";
  return h;
}

export function summarize(all: EventRow[], opts: { now?: number; sinceMs: number; stripe: StripeFunnel; bucket: "hour" | "day" }) {
  const now = opts.now ?? Date.now();
  const rows = all.filter((r) => !r.isTest && r.device !== "bot");
  const tests = all.length - rows.length;
  const views = rows.filter(isView);
  const pv = rows.filter((r) => r.event === "a.pv");
  const firstViews = pv.filter((r) => r.refHost !== "internal");
  const live = rows.filter((r) => now - r.createdAt.getTime() < LIVE_MS);
  const liveVisitors = new Set(live.map((r) => r.vh).filter(Boolean)).size;
  const byPage = new Map<string, number>(), uniqByPage = new Map<string, Set<string>>();
  for (const r of views) { inc(byPage, r.path); if (r.vh) { const s = uniqByPage.get(r.path) ?? new Set(); s.add(r.vh); uniqByPage.set(r.path, s); } }
  const sources = new Map<string, number>(), devices = new Map<string, number>(), browsers = new Map<string, number>(), oses = new Map<string, number>(), skins = new Map<string, number>(), refs = new Map<string, number>(), utm = new Map<string, number>(), tags = new Map<string, number>();
  for (const r of firstViews) {
    inc(sources, sourceOf(r)); if (r.refHost && r.refHost !== "internal") inc(refs, r.refHost); if (r.utmSource) inc(utm, r.utmSource); if (r.src) inc(tags, r.src);
  }
  for (const r of pv) { inc(devices, r.device ?? "unknown"); inc(browsers, r.browser ?? "unknown"); inc(oses, r.os ?? "unknown"); inc(skins, r.skin ?? "birch"); }
  const clicks = new Map<string, number>(), clickLabels = new Map<string, number>();
  for (const r of rows) {
    const m = /^a\.click\.(.+)$/.exec(r.event);
    if (m) { inc(clicks, m[1]!); if (m[1] !== "other" || r.label) inc(clickLabels, `${m[1]} · ${r.label ?? ""}`); }
    else if (r.event.startsWith("attn.hero_cta.") && !r.vh) inc(clicks, `hero_${r.event.slice(14)} (legacy)`);
    else if (r.event.startsWith("cta_") && !r.vh) inc(clicks, `${r.event} (legacy)`);
  }
  const scrollCounts: Record<string, number> = { "25": 0, "50": 0, "75": 0, "100": 0 };
  for (const r of rows) { const s = scrollOf(r); if (s) scrollCounts[String(s)] = (scrollCounts[String(s)] ?? 0) + 1; }
  // Timeline: views + visitors per bucket.
  const step = opts.bucket === "hour" ? 3600_000 : 86_400_000;
  const start = Math.floor(opts.sinceMs / step) * step;
  const nB = Math.max(1, Math.min(60, Math.ceil((now - start) / step)));
  const series = Array.from({ length: nB }, (_, i) => ({ t: start + i * step, views: 0, visitors: new Set<string>(), legacy: 0 }));
  for (const r of views) { const i = Math.floor((r.createdAt.getTime() - start) / step); const b = series[i]; if (b) { b.views += 1; if (r.vh) b.visitors.add(r.vh); else b.legacy += 1; } }
  const formStart = rows.filter((r) => r.event === "a.form_start" || (/^intake\.[a-z]+\.field_start/.test(r.event) && !r.vh));
  const formSubmit = rows.filter((r) => r.event === "a.form_submit" || (/^intake\.[a-z]+\.submit($|\.)/.test(r.event) && !r.vh));
  const funnel = [
    { step: "Visited", n: people(views) },
    { step: "Saw a buy page", n: people(views.filter((r) => BUY_PATH.test(r.path))) },
    { step: "Started a form", n: people(formStart) },
    { step: "Submitted a form", n: people(formSubmit) },
    { step: "Opened Stripe checkout", n: opts.stripe.created },
    { step: "Paid", n: opts.stripe.paid },
  ];
  return {
    generated_at: new Date(now).toISOString(), since: new Date(opts.sinceMs).toISOString(),
    totals: { views: views.length, visitors: people(views), live_visitors: liveVisitors, events: rows.length, excluded_test_or_bot: tests,
      clicks: [...clicks.values()].reduce((a, b) => a + b, 0), form_starts: formStart.length, form_submits: formSubmit.length },
    pages: top(byPage, 15).map(({ k, v }) => ({ k, v, u: uniqByPage.get(k)?.size ?? 0 })),
    sources: top(sources), referrers: top(refs), utm: top(utm), tags: top(tags), devices: top(devices), browsers: top(browsers), os: top(oses), skins: top(skins),
    clicks: top(clicks, 16), click_labels: top(clickLabels, 20), scroll: scrollCounts,
    series: series.map((b) => ({ t: b.t, views: b.views, visitors: b.visitors.size + b.legacy })),
    funnel, stripe: opts.stripe,
    recent: rows.slice(-25).reverse().map((r) => ({ at: r.createdAt.toISOString(), event: r.event, path: r.path, label: r.label, skin: r.skin, device: r.device, source: r.event === "a.pv" ? sourceOf(r) : null })),
  };
}
export type AnalyticsSummary = ReturnType<typeof summarize>;
