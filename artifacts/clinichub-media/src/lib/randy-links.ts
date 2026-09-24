/**
 * Randy reply link parsing (Randy via Emma 2026-09-24 6:48pm ET): links in
 * Randy's messages render as short labels, never as spelled-out URLs.
 *
 * - Markdown `[label](url)` → the label.
 * - Bare `https://…`, `www.…`, known bare domains, `tel:` or `mailto:` → a
 *   short label (known destinations get a friendly name; otherwise the host
 *   without protocol / "www.").
 * - Only http, https, tel and mailto are ever linkable. Anything else stays
 *   plain text. Pure string → token output; the React layer renders tokens as
 *   text nodes / anchors (no HTML parsing, no dangerouslySetInnerHTML).
 */

export type RandyLinkToken =
  | { kind: "text"; text: string }
  | { kind: "link"; href: string; label: string; external: boolean; calendar: boolean };

const TRAILING = /[.,;:!?)\]}'"]+$/;
const MAX_LABEL = 60;

/**
 * One pass, left-to-right:
 *   1) markdown [label](target)
 *   2) scheme URLs: http(s)://…, mailto:…, tel:…
 *   3) www.… or bare host with a common TLD (not part of an email address)
 */
const LINK_RE =
  /\[([^\]\n]{1,200})\]\(\s*((?:[^()\s]|\([^()\s]*\)){1,2048})\s*\)|((?:https?:\/\/|mailto:|tel:)[^\s<>"'`]+)|(?<![@\w.\/-])((?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|ca|net|org|io|co|app|health|us)(?:\/[^\s<>"'`]*)?)(?![\w@-])/gi;

/** Friendly labels for destinations Randy commonly shares. */
const KNOWN_LABELS: ReadonlyArray<{ match: (u: URL) => boolean; label: string }> = [
  {
    match: (u) => u.hostname === "physio.drhonow.com" && u.pathname.replace(/\/+$/, "") === "/dr-ho/portal",
    label: "the live DR-HO hub",
  },
  {
    match: (u) => /(^|\.)scalehealth\.ca$/.test(u.hostname) && u.pathname.replace(/\/+$/, "") === "/clinichubs",
    label: "Scale Health clinic hubs",
  },
  {
    match: (u) => /(^|\.)scalehealth\.ca$/.test(u.hostname) && u.pathname.replace(/\/+$/, "") === "/providers",
    label: "Scale Health for providers",
  },
  {
    match: (u) => /(^|\.)birchreserve\.net$/.test(u.hostname),
    label: "Birch Reserve",
  },
];

export function isCalendarHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "cal.com" || h.endsWith(".cal.com");
}

/** Returns a normalized, safe href or null. Only http/https/tel/mailto. */
export function safeLinkHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /[\u0000-\u001f\u007f\s]/.test(trimmed)) return null;
  let candidate = trimmed;
  if (/^www\./i.test(candidate) || !/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // Bare host (www.example.com/path). Refuse anything that isn't host-like.
    if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#].*)?$/i.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return null;
  }
  switch (u.protocol) {
    case "http:":
    case "https:":
      if (u.username || u.password || !u.hostname) return null;
      return u.toString();
    case "mailto:": {
      const addr = decodeSafe(u.pathname);
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(addr)) return null;
      return u.toString();
    }
    case "tel:": {
      const num = decodeSafe(u.pathname);
      if (!/^\+?[0-9().\-\s]{5,24}$/.test(num)) return null;
      return `tel:${num.replace(/[^0-9+]/g, "")}`;
    }
    default:
      return null;
  }
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function looksLikeUrl(label: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|www\.)/i.test(label.trim()) ||
    /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?$/i.test(label.trim());
}

function formatTel(href: string): string {
  const digits = href.replace(/^tel:/, "");
  const m = /^\+?1?(\d{3})(\d{3})(\d{4})$/.exec(digits);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : "call";
}

/** Short label for a safe href (never the full URL). */
export function labelForHref(href: string): string {
  if (href.startsWith("tel:")) return formatTel(href);
  if (href.startsWith("mailto:")) return "email Randy's team";
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return "this link";
  }
  if (isCalendarHost(u.hostname)) return "Randy's calendar";
  const known = KNOWN_LABELS.find((k) => k.match(u));
  if (known) return known.label;
  const host = u.hostname.replace(/^www\./i, "");
  return host && host.length <= MAX_LABEL ? host : "this link";
}

function cleanLabel(label: string, href: string): string {
  const t = label.replace(/\s+/g, " ").trim();
  if (!t || looksLikeUrl(t)) return labelForHref(href);
  return t.length > MAX_LABEL ? `${t.slice(0, MAX_LABEL - 1)}…` : t;
}

export function tokenizeRandyLinks(text: string): RandyLinkToken[] {
  const out: RandyLinkToken[] = [];
  const pushText = (s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev && prev.kind === "text") prev.text += s;
    else out.push({ kind: "text", text: s });
  };
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0;
    pushText(text.slice(last, start));
    last = start + m[0].length;
    if (m[1] !== undefined && m[2] !== undefined) {
      const href = safeLinkHref(m[2]);
      const label = m[1];
      if (!href) {
        // Unsafe target: keep the words, drop the link.
        pushText(looksLikeUrl(label) ? "this link" : label);
        continue;
      }
      out.push(makeLink(href, cleanLabel(label, href)));
      continue;
    }
    let raw = m[3] ?? m[4] ?? "";
    const trail = raw.match(TRAILING)?.[0] ?? "";
    if (trail) raw = raw.slice(0, raw.length - trail.length);
    const href = safeLinkHref(raw);
    if (!href) {
      pushText(raw + trail);
      continue;
    }
    out.push(makeLink(href, labelForHref(href)));
    pushText(trail);
  }
  pushText(text.slice(last));
  return out;
}

function makeLink(href: string, label: string): RandyLinkToken {
  const web = href.startsWith("http:") || href.startsWith("https:");
  let calendar = false;
  if (web) {
    try {
      calendar = isCalendarHost(new URL(href).hostname);
    } catch {
      calendar = false;
    }
  }
  return { kind: "link", href, label, external: web, calendar };
}
