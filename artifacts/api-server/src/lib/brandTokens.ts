/**
 * Birch Reserve shared style sheet (cockpit redesign move 1, Nov 21 2026).
 * One set of tokens for every server-rendered page (buyer pages, /account, /ads/admin, docs, specs), matching the
 * React site's intake palette (#F9F8F6 canvas, #071A39 ink, #C8F55A lime). Type: IBM Plex Sans 12/13/14/16/20/28,
 * Fraunces only for page titles. Shape: 6px controls, 8px cards, 999px only for status chips. Tap targets >= 40px.
 */
export const TOKENS = {
  bg: "#F9F8F6",
  surface: "#FFFFFF",
  ink: "#071A39",
  ink2: "#4D5B6A",
  ink3: "#6B7785",
  line: "#D9DDE3",
  lineSoft: "#ECEEF1",
  head: "#F3F2EE",
  accent: "#C8F55A",
  accentInk: "#3F5A00",
} as const;

export const TOKENS_CSS = `:root{--br-bg:${TOKENS.bg};--br-surface:${TOKENS.surface};--br-ink:${TOKENS.ink};--br-ink-2:${TOKENS.ink2};--br-ink-3:${TOKENS.ink3};--br-line:${TOKENS.line};--br-line-soft:${TOKENS.lineSoft};--br-head:${TOKENS.head};--br-accent:${TOKENS.accent};--br-accent-ink:${TOKENS.accentInk};
--br-fs-12:12px;--br-fs-13:13px;--br-fs-14:14px;--br-fs-16:16px;--br-fs-20:20px;--br-fs-28:28px;--br-r-ctl:6px;--br-r-card:8px;--br-tap:40px;
--br-sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--br-serif:Fraunces,Georgia,serif;--br-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace}`;

export type BuyerNavKey = "buy" | "buycalc" | "sponsor" | "exclusive" | "media-kit" | "rates";

/** The one buyer header for /buy, /buycalc, /sponsor and /exclusive. `extra` is page-specific (e.g. a currency toggle). */
export function buyerHeaderHtml(active: BuyerNavKey | null, extra = ""): string {
  const items: Array<[BuyerNavKey, string, string]> = [
    ["buycalc", "/buycalc", "Prices"],
    ["buy", "/buy", "Buy"],
    ["sponsor", "/sponsor", "Packs"],
    ["exclusive", "/exclusive", "Exclusive"],
    ["media-kit", "/media-kit", "Media kit"],
  ];
  const links = items.map(([k, href, label]) => `<a href="${href}"${k === active ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<header class="br-bh"><div class="br-bh-in"><a class="br-bh-logo" href="/">BIRCH RESERVE</a><nav class="br-bh-nav" aria-label="Buying">${links}</nav><div class="br-bh-end">${extra}<a class="br-bh-tel" href="tel:+16479316278">(647) 931-6278</a></div></div></header>`;
}

export const BUYER_HEADER_CSS = `.br-bh{position:sticky;top:0;z-index:20;background:rgba(249,248,246,.96);backdrop-filter:blur(6px);border-bottom:1px solid var(--br-line);font-family:var(--br-sans)}
.br-bh-in{max-width:1180px;margin:0 auto;padding:0 22px;min-height:56px;display:flex;align-items:center;gap:18px}
.br-bh-logo{font-weight:600;letter-spacing:.16em;font-size:13px;color:var(--br-ink);text-decoration:none;white-space:nowrap}
.br-bh-nav{display:flex;gap:2px;flex:1;min-width:0}.br-bh-nav a,.br-bh-tel{display:inline-flex;align-items:center;min-height:40px;padding:0 10px;border-radius:var(--br-r-ctl);font-size:14px;color:var(--br-ink-2);text-decoration:none;white-space:nowrap}
.br-bh-nav a:hover,.br-bh-tel:hover{background:#EEECE6;color:var(--br-ink)}.br-bh-nav a[aria-current=page]{color:var(--br-ink);font-weight:600;box-shadow:inset 0 -2px 0 var(--br-ink)}
.br-bh-end{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--br-ink-2)}.br-bh-end a{color:var(--br-ink)}.br-bh-tel{color:var(--br-ink);font-weight:500}
@media(max-width:860px){.br-bh{position:static}.br-bh-in{flex-wrap:wrap;gap:0 12px;padding:8px 14px}.br-bh-logo{flex:1}.br-bh-nav{order:3;flex-basis:100%;flex-wrap:wrap;margin:0 -10px}.br-bh-nav a{padding:0 10px}}`;
