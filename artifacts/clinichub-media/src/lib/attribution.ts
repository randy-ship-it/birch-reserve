/**
 * First-touch attribution (Randy 6:50pm): UTM params, external document.referrer and
 * the landing page, captured on the first visit (localStorage, sessionStorage
 * fallback) and sent with every lead / intake / email-capture / reservation POST as
 * `attribution`. The server lifts it off the body and stores it on the leads row.
 */
export type AttributionPayload = Partial<
  Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content" | "referrer" | "landing_page", string>
>;

const KEY = "birch_attr_v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

const clip = (v: string, n = 500) => v.trim().slice(0, n);

export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  const s = store();
  if (!s) return;
  try {
    if (s.getItem(KEY)) return; // first touch wins
    const url = new URL(window.location.href);
    const out: AttributionPayload = {};
    for (const k of UTM_KEYS) {
      const v = url.searchParams.get(k);
      if (v && v.trim()) out[k] = clip(v, 200);
    }
    const ref = document.referrer;
    if (ref) {
      try {
        const r = new URL(ref);
        if (r.host !== window.location.host) out.referrer = clip(`${r.origin}${r.pathname}`);
      } catch {
        /* ignore malformed referrer */
      }
    }
    out.landing_page = clip(`${url.pathname}${url.search}`);
    s.setItem(KEY, JSON.stringify(out));
  } catch {
    /* storage full / blocked: attribution is best-effort */
  }
}

export function getAttribution(): AttributionPayload {
  if (typeof window === "undefined") return {};
  try {
    const raw = store()?.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: AttributionPayload = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v) out[k as keyof AttributionPayload] = v;
    }
    return out;
  } catch {
    return {};
  }
}
