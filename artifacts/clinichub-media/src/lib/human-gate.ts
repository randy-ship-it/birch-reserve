/**
 * Humans-only gate, browser side (Randy 6:50pm). Cloudflare Turnstile, managed
 * widget with appearance "interaction-only": invisible for almost everyone, a small
 * checkbox only when Cloudflare needs it. Verified once per tab session; the server
 * returns a short-lived signed token we send as X-Birch-Human on chat / voice starts.
 * When the server has no TURNSTILE_* keys, config says enabled:false and this no-ops.
 */
const CONFIG_URL = "/api/launch/human/config";
const VERIFY_URL = "/api/launch/human/verify";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_KEY = "birch_human_v1";
const TIMEOUT_MS = 20_000;

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

let configPromise: Promise<{ enabled: boolean; siteKey: string | null }> | null = null;
let inflight: Promise<boolean> | null = null;
let scriptPromise: Promise<Turnstile | null> | null = null;

function loadConfig() {
  configPromise ??= fetch(CONFIG_URL, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { enabled: false, siteKey: null }))
    .catch(() => ({ enabled: false, siteKey: null }));
  return configPromise;
}

function readToken(): string | null {
  try {
    const raw = window.sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw) as { token?: string; expiresAt?: number };
    if (!token || !expiresAt || expiresAt - 60_000 < Date.now()) return null;
    return token;
  } catch {
    return null;
  }
}

export function clearHumanToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function humanHeaders(): Record<string, string> {
  const t = typeof window === "undefined" ? null : readToken();
  return t ? { "x-birch-human": t } : {};
}

function loadScript(): Promise<Turnstile | null> {
  scriptPromise ??= new Promise((resolve) => {
    const w = window as Window & { turnstile?: Turnstile };
    if (w.turnstile) return resolve(w.turnstile);
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(w.turnstile ?? null);
    s.onerror = () => {
      scriptPromise = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function verifyOnce(siteKey: string): Promise<boolean> {
  const ts = await loadScript();
  if (!ts) return false;
  const host = document.createElement("div");
  host.setAttribute("data-testid", "turnstile-host");
  host.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483646;";
  document.body.appendChild(host);
  let widgetId = "";
  try {
    const token = await new Promise<string | null>((resolve) => {
      const t = window.setTimeout(() => resolve(null), TIMEOUT_MS);
      widgetId = ts.render(host, {
        sitekey: siteKey,
        appearance: "interaction-only",
        action: "chat",
        callback: (tok: string) => {
          window.clearTimeout(t);
          resolve(tok);
        },
        "error-callback": () => {
          window.clearTimeout(t);
          resolve(null);
        },
      });
    });
    if (!token) return false;
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { humanToken?: string; expiresAt?: number; required?: boolean };
    if (data.required === false) return true;
    if (!data.humanToken || !data.expiresAt) return false;
    window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: data.humanToken, expiresAt: data.expiresAt }));
    return true;
  } catch {
    return false;
  } finally {
    try {
      if (widgetId) ts.remove(widgetId);
    } catch {
      /* ignore */
    }
    host.remove();
  }
}

/** Resolves true when the visitor may start a chat / voice session (gate off, cached, or just verified). */
export async function ensureHuman(): Promise<boolean> {
  if (typeof window === "undefined") return true;
  const cfg = await loadConfig();
  if (!cfg.enabled || !cfg.siteKey) return true;
  if (readToken()) return true;
  inflight ??= verifyOnce(cfg.siteKey).finally(() => {
    inflight = null;
  });
  return inflight;
}
