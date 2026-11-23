/**
 * Site analytics (Randy, voice, Nov 23 2026 4:16 PM ET): page views, scroll depth, named clicks, form start / submit,
 * traffic source and skin, on every page of birchreserve.net and the scalehealth.ca/intake/_m mirror.
 *
 * One pipe: the same first-party /v1/ui-events beacon the attention + intake events already use (site_cta_events).
 * The server adds the coarse device / browser (from the user agent), the skin (from the Origin) and a daily-rotating
 * visitor hash; it never stores the IP or the user agent. No cookies, no localStorage, nothing typed by a visitor:
 * click labels come from fixed data-testid / aria names, never input values. Do Not Track / GPC turns it all off.
 * Event list + how to read it: api-server/src/lib/siteAnalytics.ts. Live dashboard: /ads/admin/analytics.
 */
import { siteSkin } from "@/lib/siteSkin";

type Extra = Record<string, string | number | boolean | undefined>;

const dnt = () => {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const w = window as Window & { doNotTrack?: string };
  return n.globalPrivacyControl === true || n.doNotTrack === "1" || w.doNotTrack === "1" || n.msDoNotTrack === "1";
};

/** Real path without the mirror prefix, private report tokens collapsed. */
function pagePath(): string {
  let p = (window.location.pathname || "/").replace(/^\/intake\/_m(?=\/|$)/, "") || "/";
  if (/^\/kit\/r\//.test(p)) p = "/kit/r/report";
  return p.replace(/[^A-Za-z0-9._~/-]/g, "").slice(0, 200) || "/";
}

const slug = (s: string, max = 40) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, max);

let source: Extra = {};
let skin = "birch";
let test = false;

function captureSource(): void {
  const q = new URLSearchParams(window.location.search);
  let ref = "";
  try {
    const h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
    if (h && h !== window.location.hostname.replace(/^www\./, "")) ref = h.slice(0, 80);
  } catch { /* ignore */ }
  const tag = (k: string) => (q.get(k) || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const src = tag("st") ? `st:${tag("st")}` : tag("qr") ? `qr:${tag("qr")}` : tag("ref") ? `ref:${tag("ref")}` : tag("src") ? `src:${tag("src")}` : "";
  source = { ref: ref || undefined, us: tag("utm_source") || undefined, um: tag("utm_medium") || undefined, uc: tag("utm_campaign") || undefined, src: src || undefined };
  test = tag("ref") === "qa" || tag("qa") === "1";
}

export function trackSite(event: string, extra: Extra = {}): void {
  try {
    const body = JSON.stringify({ event: `a.${event}`, path: pagePath(), skin, w: window.innerWidth, ...(test ? { test: true } : {}), ...extra });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/v1/ui-events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/v1/ui-events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch { /* analytics must never break the page */ }
}

/** Named buttons Randy asked to see; anything else is "other" with its test id as the label. */
export function clickName(el: Element, label: string, href: string, text: string): string {
  const t = `${label} ${text}`.toLowerCase();
  if (el.closest("elevenlabs-convai") || /hear randy|start a call|start talking|randy_handoff_ai_call/.test(t)) return "call_voice";
  if (href.startsWith("tel:") || /tap_to_call|panel_call|header_call|call_back|call randy/.test(t)) return "call_phone";
  if (/squirrel_launcher|button_open_randy_chat|randy_teaser|randy_figure_launcher|open the |ask about .* seats/.test(t)) return "chat_open";
  if (/\.pdf(\?|#|$)/i.test(href) || /_pdf|download/.test(t)) return "pdf_download";
  if (/get my (free )?kit|kit_cta|sticky_kit/.test(t)) return "get_my_kit";
  if (/buy ads now|buy_ads|hero_cta_buy|cta_buy/.test(t)) return "buy_ads_now";
  if (/7.day look|_look\b|cta_look|look_hero|hold.190/.test(t) || /sku=hold-190/.test(href)) return "look_7day";
  if (/inquire|premium/.test(t)) return "inquire_premium";
  if (/mock_hub_|hub_chip|hub_tab/.test(t)) return "hub_chip";
  if (/reserve|checkout|prepay/.test(t) || /sku=reserve|#reserve|\/exclusive/.test(href)) return "reserve";
  if (/media.?kit|mediakit|brochure/.test(t) || /media-?kit/.test(href)) return "media_kit";
  return "other";
}

function area(el: Element): string {
  if (el.closest("[data-testid*=sticky],[class*=sticky]")) return "sticky";
  if (el.closest("header,nav")) return "header";
  if (el.closest("footer")) return "footer";
  if (el.closest("[role=dialog],[data-testid^=randy]")) return "chat";
  const r = el.getBoundingClientRect();
  return r.top + window.scrollY < window.innerHeight ? "hero" : "body";
}

function onClick(e: MouseEvent): void {
  const cp = e.composedPath?.() ?? [];
  // The voice widget renders in a shadow root: count any click inside it as the call button.
  if (cp.some((n) => (n as Element).localName === "elevenlabs-convai")) {
    const inner = cp[0] as Element | undefined;
    if (inner?.closest?.("button,[role=button],a")) trackSite("click.call_voice", { label: slug(inner.closest("button,[role=button],a")?.getAttribute("aria-label") || "elevenlabs"), area: "widget" });
    return;
  }
  const path0 = (cp[0] ?? e.target) as Element | null;
  const target = e.target as Element | null;
  const el = (path0?.closest?.("a,button,[role=button],summary,[data-testid]") ?? target?.closest?.("a,button,[role=button],summary,elevenlabs-convai")) as Element | null;
  if (!el) return;
  const tid = el.closest("[data-testid]")?.getAttribute("data-testid") ?? "";
  const aria = el.getAttribute("aria-label") ?? "";
  // Static button text only (no inputs inside, short): never a typed value.
  const text = el.querySelector("input,textarea,select") ? "" : (el.textContent || "").trim().slice(0, 48);
  const href = el.getAttribute("href") ?? "";
  const name = clickName(el, `${tid} ${aria}`.replace(/-/g, "_"), href, text);
  const label = slug(tid || aria.slice(0, 40) || (el.tagName === "ELEVENLABS-CONVAI" ? "elevenlabs" : text) || el.tagName);
  trackSite(`click.${name}`, { label, area: area(el) });
}

const formsStarted = new WeakSet<Element>();
const inChat = (f: Element) => Boolean(f.closest("[data-testid^=randy],[data-testid=dialog-randy-chat],[data-testid*=squirrel]"));
const formName = (f: Element) => slug(f.getAttribute("data-testid") || f.getAttribute("id") || f.getAttribute("name") || f.getAttribute("aria-label") || "form");

let scrolled = new Set<number>();
function onScroll(): void {
  const doc = document.documentElement;
  const total = doc.scrollHeight - window.innerHeight;
  if (total <= 0) return;
  const pct = (window.scrollY / total) * 100;
  for (const n of [25, 50, 75, 100]) if (!scrolled.has(n) && pct >= n - (n === 100 ? 2 : 0)) { scrolled.add(n); trackSite(`scroll_${n}`); }
}

let lastPath = "";
function pageView(): void {
  const p = pagePath();
  if (p === lastPath) return;
  const first = lastPath === "";
  lastPath = p;
  scrolled = new Set();
  trackSite("pv", first ? source : { ref: "internal" });
}

let started = false;
export function initSiteAnalytics(): void {
  if (started || typeof window === "undefined" || typeof document === "undefined") return;
  started = true;
  if (dnt()) return;
  skin = siteSkin();
  captureSource();
  pageView();
  const h = window.history;
  for (const k of ["pushState", "replaceState"] as const) {
    const orig = h[k].bind(h);
    h[k] = ((...a: Parameters<History["pushState"]>) => { const r = orig(...a); setTimeout(pageView, 0); return r; }) as History["pushState"];
  }
  window.addEventListener("popstate", () => setTimeout(pageView, 0));
  document.addEventListener("click", onClick, { capture: true, passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("focusin", (e) => {
    const f = (e.target as Element | null)?.closest?.("form");
    if (f && inChat(f)) return; // the chat has its own events; the funnel counts page forms only
    if (f && !formsStarted.has(f)) { formsStarted.add(f); trackSite("form_start", { label: formName(f) }); }
  }, true);
  document.addEventListener("submit", (e) => {
    const f = e.target as Element | null;
    if (f && !inChat(f)) trackSite("form_submit", { label: formName(f) });
  }, true);
}
