/**
 * /buycalc "Start small from $190" tier strip (Randy, Nov 19 2026 ET). Mirrors
 * clinichub-media components/br/start-small.tsx. USD only, no new payment code:
 * the look and seat pick the EXISTING form below; starter blocks and agency
 * client tests are request-only (deposit collected at confirmation).
 * Never imply zero demand. No impression guarantee; views are modelled.
 */
import { fmtUsd, quotePack } from "./overhaul/pricing";

export const START_SMALL_BLOCK_USD = quotePack(["landing"], 100_000).startingUsd;

export const START_SMALL_CSS = `.ss-tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}.ss-tier{background:#fff;border:1px solid #071A39;padding:18px;display:flex;flex-direction:column;gap:6px}.ss-tier.on{background:#071A39;color:#F9F8F6}.ss-tier small{font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;opacity:.7}.ss-tier .price{font:400 2.1rem/1 Fraunces,Georgia,serif;margin-top:4px}.ss-tier .name{font-weight:600}.ss-tier p{margin:0;font-size:14px;opacity:.85}.ss-tier .ref{font-size:12px;font-weight:600;opacity:1}.ss-tier.on .ref{color:#C8F55A}.ss-tier .btn{margin-top:auto;width:100%;text-align:center}.ss-tier .note{font-size:11px;opacity:.65}.ss-fine{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;margin-top:14px}.ss-fine details{border-bottom:1px solid #d5d9df;padding:10px 0;font-size:14px}.ss-fine summary{cursor:pointer;font-weight:600}.ss-fine details p{margin:8px 0 0;opacity:.8}@media(max-width:900px){.ss-tiers{grid-template-columns:1fr 1fr}}@media(max-width:560px){.ss-tiers,.ss-fine{grid-template-columns:1fr}}`;

const utm = (key: string) => `utm_source=birchreserve&amp;utm_medium=start-small&amp;utm_campaign=buycalc-${key}`;

export function startSmallHtml(): string {
  const tier = (t: { key: string; on?: boolean; eyebrow: string; price: string; name: string; line: string; cta: string; href: string; pick?: string; note: string }) =>
    `<article class="ss-tier${t.on ? " on" : ""}" data-testid="start-small-${t.key}"><small>${t.eyebrow}</small><div class="price">${t.price}</div><div class="name">${t.name}</div><p>${t.line}</p><p class="ref">Fully refundable deposit</p><a class="btn${t.on ? "" : " line"}" href="${t.href}"${t.pick ? ` data-pick-sku="${t.pick}"` : ""} data-testid="start-small-${t.key}-cta">${t.cta}</a><span class="note">${t.note}</span></article>`;
  const fine = [
    ["Refund terms", "Every deposit is 100% media credit. Ask by email and the full amount goes back to your card any time before activation, which today means up to 14 days before the launch date on your insertion order (IO). The $190 look converts in full to the $490 seat within 7 days, or is refunded. After launch, unused credit can be extended or refunded under your IO."],
    ["What you get", "A share of display space across a growing network of private health and wellness hubs, curated as hubs launch. The IO names the hub and placement before anything runs. Views are modelled estimates at the starter rate, not a guarantee. Aggregate reporting only. No PHI, no clinical pixels."],
    ["Agencies", "Prepay a $1,000–$5,000 USD client test. Each client gets its own IO and reporting. The agency of record earns 10% of media spend, paid in cash."],
    ["Bigger budgets", "Premium slots ($25K–$50K) are by inquiry. Start small now and move up any time; your credit carries over."],
  ];
  return `<section class="band" id="start-small" data-testid="start-small"><div class="wrap"><p class="kicker">Start small</p><h2>Start small from $190. Fully refundable deposit.</h2><p class="fine" style="margin:8px 0 0">Pick a size. Nothing runs until you approve the IO.</p>
<div class="ss-tiers">${[
    tier({ key: "look", eyebrow: "7-day look", price: "$190 USD", name: "See it before you commit", line: "Your placement, live in a hub for 7 days.", cta: "Start the 7-day look", href: `/buycalc?sku=hold-190&amp;${utm("look")}#reserve`, pick: "hold-190", note: "Card checkout below" }),
    tier({ key: "seat", on: true, eyebrow: "Category seat", price: "$490 USD", name: "Your named category seat", line: "All $490 is media credit for your category.", cta: "Reserve my seat", href: `/buycalc?sku=reserve-490&amp;${utm("seat")}#reserve`, pick: "reserve-490", note: "Card checkout below" }),
    tier({ key: "block", eyebrow: "Starter view block", price: `From ${fmtUsd(START_SMALL_BLOCK_USD)} USD`, name: "100K modelled views", line: "One hub surface at the starter rate.", cta: "Request a block", href: `/?inquire=pack&amp;block=100000&amp;surfaces=landing&amp;${utm("block")}#quick-buy`, note: "Deposit collected at confirmation" }),
    tier({ key: "agency", eyebrow: "Agency client test", price: "$1K–$5K USD", name: "Test a client in the hubs", line: "One IO per client. 10% of spend paid to the agency.", cta: "Request a client test", href: `/agencies?${utm("agency")}#talk`, note: "Deposit collected at confirmation" }),
  ].join("")}</div>
<div class="ss-fine">${fine.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
<p class="fine" style="margin-top:10px">USD. Views are modelled estimates, not a guarantee.</p></div></section>`;
}
