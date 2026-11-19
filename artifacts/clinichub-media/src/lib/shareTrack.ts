/**
 * Share + referral tracking, client side (Randy via Emma, Nov 19 2026 8:31 AM ET). Server: /v1/share-events
 * (api-server/src/lib/shareEvents.ts). Fire-and-forget, never throws. No email, name or form values go in.
 */
export type ShareChannel = "copy" | "email" | "sms" | "linkedin" | "x" | "native";

export const safeSharePath = (p: string) => {
  const path = (p || "/").split(/[?#]/)[0]!.slice(0, 200);
  return /^\/kit\/r\//.test(path) ? "/kit/r/report" : path;
};

function send(body0: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const src = mirrorSource();
    const body = src ? { ...body0, src } : body0;
    const json = JSON.stringify(body);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/v1/share-events", new Blob([json], { type: "application/json" }))) return;
    void fetch("/v1/share-events", { method: "POST", headers: { "content-type": "application/json" }, body: json, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch {
    /* tracking must never break the page */
  }
}

/**
 * Mirror source (SCALE-MIRROR.md): the intake served under another host (a Scale-side domain pointed at this
 * project, or a proxy that adds ?src=scale_mirror). birchreserve.net, Vercel previews and localhost are not mirrors.
 */
const SRC_OK = /^[a-z0-9_]{2,32}$/;
export function mirrorSource(): string | null {
  if (typeof window === "undefined") return null;
  // Served through the Scale proxy (scalehealth.ca/intake): the server tags the shell (middlewares/mirrorHost.ts).
  const boot = (window as { __BR_MIRROR?: { src?: string } }).__BR_MIRROR?.src;
  if (boot && SRC_OK.test(boot)) return boot;
  try {
    const q = new URLSearchParams(window.location.search).get("src");
    if (q && SRC_OK.test(q)) sessionStorage.setItem("br_src", q);
    const saved = sessionStorage.getItem("br_src");
    if (saved && SRC_OK.test(saved)) return saved;
  } catch {
    /* ignore */
  }
  const h = window.location.hostname.toLowerCase();
  if (/(^|\.)birchreserve\.net$/.test(h) || h.endsWith(".vercel.app") || h === "localhost" || /^127\./.test(h)) return null;
  return /scale/.test(h) ? "scale_mirror" : "mirror";
}

export const newShareId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join("");

/** The link a visitor shares: same page, ?ref=share_<channel>&sid=<id>. Private report links keep their path. */
export function shareUrl(channel: ShareChannel, sid: string, href = typeof window !== "undefined" ? window.location.href : "https://birchreserve.net/intake"): string {
  const u = new URL(href);
  for (const k of [...u.searchParams.keys()]) if (k === "ref" || k === "sid" || k === "mock" || k.startsWith("utm_") || k.startsWith("_vercel")) u.searchParams.delete(k);
  u.hash = "";
  u.searchParams.set("ref", `share_${channel}`);
  u.searchParams.set("sid", sid);
  // Host-aware: a share from the mirror stays on the mirror host and keeps its source tag.
  const src = mirrorSource();
  if (src) u.searchParams.set("src", src);
  else u.searchParams.delete("src");
  return u.toString();
}

export function logShare(channel: ShareChannel, sid: string): void {
  send({ kind: "share", channel, path: safeSharePath(window.location.pathname), sid });
}

/** A tracked CTA click toward /intake (placement goes in ref, e.g. hero_home, nav, sticky_mobile). */
export function logCtaClick(ref: string): void {
  send({ kind: "click", channel: "cta", path: safeSharePath(window.location.pathname), ref });
}

/** Once per page load: an arrival on a tracked link (?ref=… or utm_*). */
let arrived = "";
export function logArrival(): void {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  const ref = q.get("ref");
  const utm = q.get("utm_source");
  if (!ref && !utm && !mirrorSource()) return;
  const key = `${window.location.pathname}?${ref}|${utm}|${q.get("sid")}|${mirrorSource()}`;
  if (arrived === key) return;
  arrived = key;
  try {
    if (sessionStorage.getItem(`br_arr_${key}`)) return;
    sessionStorage.setItem(`br_arr_${key}`, "1");
  } catch {
    /* ignore */
  }
  const clean = (v: string | null) => (v && /^[A-Za-z0-9._-]{1,64}$/.test(v) ? v : undefined);
  const sid = q.get("sid");
  send({
    kind: "arrival",
    path: safeSharePath(window.location.pathname),
    ref: clean(ref),
    utm_source: clean(utm),
    utm_medium: clean(q.get("utm_medium")),
    utm_campaign: clean(q.get("utm_campaign")),
    referrer: document.referrer || undefined,
    sid: sid && /^[a-z0-9]{6,24}$/.test(sid) ? sid : undefined,
  });
}

/**
 * A link that leaves /intake. On the Scale mirror it goes to the same page on birchreserve.net (the mirror only
 * carries /intake); everywhere else it is unchanged.
 */
export function birchHref(path: string): string {
  if (typeof window === "undefined") return path;
  const m = (window as { __BR_MIRROR?: { href?: (u: string) => string } }).__BR_MIRROR;
  return m && typeof m.href === "function" ? m.href(path) : path;
}
