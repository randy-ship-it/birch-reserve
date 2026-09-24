/**
 * Tiny analytics wrapper (Randy 6:50pm). No-ops unless configured at build time:
 *   VITE_PLAUSIBLE_DOMAIN  e.g. birchreserve.net   → Plausible (script data-domain)
 *   VITE_PLAUSIBLE_SRC     optional script URL (default https://plausible.io/js/script.js)
 *   VITE_GA4_ID            a real GA4 measurement id (G-XXXX) → gtag.js
 * No GA4 property exists for Birch / SBG today, so Plausible is the default choice.
 * Never put contact details (email, phone, name) in event props.
 */
export type AnalyticsEvent =
  | "chat_open"
  | "chat_message"
  | "intake_submit"
  | "email_capture"
  | "checkout_click"
  | "checkout_success"
  | "call_click"
  | "media_kit_download";

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

type PlausibleFn = ((event: string, opts?: { props?: Record<string, string | number | boolean> }) => void) & { q?: unknown[] };
type AnalyticsWindow = Window & { plausible?: PlausibleFn; dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const PLAUSIBLE_DOMAIN = env.VITE_PLAUSIBLE_DOMAIN?.trim() || "";
const PLAUSIBLE_SRC = env.VITE_PLAUSIBLE_SRC?.trim() || "https://plausible.io/js/script.js";
const GA4_ID = /^G-[A-Z0-9]{4,20}$/.test(env.VITE_GA4_ID?.trim() ?? "") ? env.VITE_GA4_ID!.trim() : "";

let initialized = false;

export function analyticsConfigured(): boolean {
  return Boolean(PLAUSIBLE_DOMAIN || GA4_ID);
}

export function initAnalytics(): void {
  if (initialized || typeof window === "undefined" || typeof document === "undefined") return;
  initialized = true;
  if (analyticsConfigured()) listenForCallClicks();
  const w = window as AnalyticsWindow;
  if (PLAUSIBLE_DOMAIN) {
    w.plausible =
      w.plausible ||
      (Object.assign(
        (...args: unknown[]) => {
          (w.plausible!.q = w.plausible!.q || []).push(args);
        },
        {},
      ) as PlausibleFn);
    const s = document.createElement("script");
    s.defer = true;
    s.src = PLAUSIBLE_SRC;
    s.setAttribute("data-domain", PLAUSIBLE_DOMAIN);
    document.head.appendChild(s);
  }
  if (GA4_ID) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer!.push(args);
    };
    w.gtag("js", new Date());
    w.gtag("config", GA4_ID);
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_ID)}`;
    document.head.appendChild(s);
  }
}

/** call_click for every tel: link on the site (chat, hero, kit, concierge), one listener. */
function listenForCallClicks(): void {
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="tel:"]');
      if (!a) return;
      const where = a.closest("[data-testid]")?.getAttribute("data-testid") ?? "page";
      track("call_click", { where: where.slice(0, 60), path: window.location.pathname.slice(0, 100) });
    },
    { capture: true },
  );
}

/** Fire-and-forget event. Silent no-op without config; never throws. */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (!analyticsConfigured() || typeof window === "undefined") return;
  try {
    const clean: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(props ?? {})) if (v !== undefined) clean[k] = v;
    const w = window as AnalyticsWindow;
    if (PLAUSIBLE_DOMAIN) w.plausible?.(event, Object.keys(clean).length ? { props: clean } : undefined);
    if (GA4_ID) w.gtag?.("event", event, clean);
  } catch {
    /* analytics must never break the page */
  }
}
