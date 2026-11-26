/**
 * One price source + one pricing component (BR-15 move 4, Randy, Nov 21 2026 3:34 PM ET:
 * "it is based on where you are coming from").
 *
 * The same three steps everywhere, in the visitor's currency:
 *   $190 7-day look → $490 shared reserve → $1,900 starter placement that holds a $5K–$50K dedicated package.
 * Look and reserve use the existing CAD table ($270 / $690 CAD, reserveOffers.ts). The $1,900 starter placement has no
 * CAD/USD table, so it is the same number in both. $25,000–$1.5M premium slots stay inquire-only at the top.
 *
 * Pure module: safe for the API and the browser bundle (no Node or Express imports).
 */
import { PUBLIC_RESERVE_OFFERS, offerPriceLabel, type ReserveCurrency } from "./reserveOffers";
import { EXCLUSIVE_RESERVE, exclusiveReserveFor } from "./exclusiveReserveTerms";

export type LadderStep = {
  key: "hold-190" | "reserve-490" | "exclusive";
  price: string;
  name: string;
  line: string;
  href: string;
  cta: string;
};

const look = PUBLIC_RESERVE_OFFERS.find((o) => o.sku === "hold-190")!;
const seat = PUBLIC_RESERVE_OFFERS.find((o) => o.sku === "reserve-490")!;

export const PREMIUM_RANGE = "$25,000–$1.5M USD" as const;

export function priceLadder(currency: ReserveCurrency): readonly LadderStep[] {
  const ex = exclusiveReserveFor(currency);
  return [
    { key: "hold-190", price: offerPriceLabel(look, currency), name: "7-day look", line: "See your placement for 7 days. Converts in full to the reserve, or refunded.", href: "/buy?plan=hold-190", cta: "Take a look" },
    { key: "reserve-490", price: offerPriceLabel(seat, currency), name: "Reserve your space", line: "A shared category seat. 100% media credit, refundable until 14 days before launch.", href: "/buy?plan=reserve-490", cta: "Reserve" },
    { key: "exclusive", price: ex.label, name: "Starter placement", line: `Holds a ${ex.packageLabel} dedicated package in your category pending your IO. All $1,900 counts toward it.`, href: "/starter", cta: "Get started" },
  ];
}

/** "Prices in USD · CAD" switch for server pages. hrefFor builds the link for the other currency. */
export function currencyToggleHtml(currency: ReserveCurrency, hrefFor: (c: ReserveCurrency) => string): string {
  const link = (c: ReserveCurrency) =>
    `<a href="${hrefFor(c).replaceAll("&", "&amp;")}" data-currency="${c}" rel="nofollow" aria-pressed="${c === currency}">${c.toUpperCase()}</a>`;
  return `<span class="currency-toggle br-cur" data-testid="currency-toggle" role="group" aria-label="Currency"><span>Prices in</span> ${link("usd")} ${link("cad")}</span>`;
}

/** Keep the current path + query, swap ?currency=. */
export function currencyHref(path: string, query: Record<string, unknown>, c: ReserveCurrency, hash = ""): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (typeof v === "string" && !["currency", "pf", "session_id", "reserve", "deposit", "checkout"].includes(k)) p.set(k, v);
  p.set("currency", c);
  return `${path}?${p.toString()}${hash}`;
}

const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** The pricing component: three steps, then the premium inquire line. */
export function priceLadderHtml(currency: ReserveCurrency, opts: { title?: string; current?: LadderStep["key"] | null; premiumHref?: string } = {}): string {
  const steps = priceLadder(currency)
    .map(
      (s, i) =>
        `<li class="brl-step${s.key === opts.current ? " on" : ""}" data-testid="ladder-${s.key}"><span class="brl-n">${i + 1}</span><b class="brl-price">${esc(s.price)}</b><span class="brl-name">${esc(s.name)}</span><span class="brl-line">${esc(s.line)}</span><a class="brl-go" href="${esc(s.href)}">${esc(s.cta)} →</a></li>`,
    )
    .join("");
  return `<section class="brl" data-testid="price-ladder" data-currency="${currency}" aria-label="Prices">${opts.title ? `<h2 class="brl-h">${esc(opts.title)}</h2>` : ""}<ol class="brl-list">${steps}</ol><p class="brl-top">Premium slots, ${PREMIUM_RANGE}, are the top of the range: one brand, priority placement, set on an insertion order. <a href="${esc(opts.premiumHref ?? "/media-kit#premium")}">Inquire</a>.</p></section>`;
}

export const PRICE_LADDER_CSS = `.brl{margin:20px 0}.brl-h{font-family:var(--br-serif,Fraunces,Georgia,serif);font-weight:400;font-size:var(--br-fs-20,20px);margin:0 0 10px}
.brl-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.brl-step{position:relative;display:flex;flex-direction:column;gap:4px;background:var(--br-surface,#fff);border:1px solid var(--br-line,#D9DDE3);border-radius:var(--br-r-card,8px);padding:14px 14px 12px}
.brl-step.on{border-color:var(--br-ink,#071A39);box-shadow:inset 0 0 0 1px var(--br-ink,#071A39)}
.brl-n{position:absolute;top:12px;right:12px;font:600 12px/1 var(--br-mono,ui-monospace,monospace);color:var(--br-ink-3,#6B7785)}
.brl-price{font:600 24px/1.1 var(--br-sans,"IBM Plex Sans",system-ui,sans-serif);font-variant-numeric:tabular-nums;color:var(--br-ink,#071A39)}
.brl-name{font-weight:600;font-size:14px;color:var(--br-ink,#071A39)}.brl-line{font-size:13px;line-height:1.45;color:var(--br-ink-2,#4D5B6A);flex:1}
.brl-go{display:inline-flex;align-items:center;min-height:40px;font-weight:600;font-size:14px;color:var(--br-ink,#071A39)}
.brl-top{margin:10px 0 0;font-size:13px;color:var(--br-ink-2,#4D5B6A)}.brl-top a{color:var(--br-ink,#071A39);font-weight:600}
.br-cur{display:inline-flex;align-items:center;gap:4px;font-size:13px;color:var(--br-ink-2,#4D5B6A);white-space:nowrap}.br-cur a{display:inline-flex;align-items:center;justify-content:center;min-height:32px;min-width:40px;padding:0 8px;border:1px solid var(--br-line,#D9DDE3);border-radius:var(--br-r-ctl,6px);text-decoration:none;font-weight:600;font-size:12px;color:var(--br-ink,#071A39);background:var(--br-surface,#fff)}.br-cur a[aria-pressed=true]{background:var(--br-ink,#071A39);color:#fff;border-color:var(--br-ink,#071A39)}
@media (max-width:760px){.brl-list{grid-template-columns:1fr}}`;
