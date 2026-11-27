/**
 * "What $100 gets you today" (Street 100). Derived only from the live rate card (RATE_SURFACES, starting-at CPM), never typed in.
 * Modelled: views = $100 / starter CPM x 1,000. Not a guarantee. USD.
 */
import { RATE_SURFACES } from "./pricing";

export const HUNDRED_USD = 100;
export type HundredRow = { key: string; label: string; cpm: number; views: number };
export const HUNDRED_ROWS: readonly HundredRow[] = RATE_SURFACES.map((s) => ({
  key: s.key,
  label: s.short,
  cpm: s.cpmStarter[0],
  views: Math.floor(((HUNDRED_USD / s.cpmStarter[0]) * 1000) / 100) * 100,
}));
export const HUNDRED_TITLE = "What $100 gets you today";
export const HUNDRED_NOTE = "Modelled at today's starting-at rate card, USD. Views are estimates, not a guarantee. Aggregate reporting only. Nothing runs until your insertion order names the clinic layer.";

export function hundredHtml(): string {
  const rows = HUNDRED_ROWS.map((r) => `<li><span>${r.label}</span><b>about ${r.views.toLocaleString("en-US")} views</b><small>$${r.cpm} CPM</small></li>`).join("");
  return `<details class="h100" data-testid="what-100"><summary>${HUNDRED_TITLE}</summary><ul>${rows}</ul><p>${HUNDRED_NOTE}</p></details>
<style>.h100{margin:18px 0 0;background:#fff;border:1px solid #071A39;border-radius:14px;padding:4px 16px;max-width:640px}.h100 summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600}.h100 ul{list-style:none;margin:0;padding:0}.h100 li{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:9px 0;border-top:1px solid #e3e5e8}.h100 li b{text-align:right}.h100 li small{grid-column:1/3;opacity:.6}.h100 p{font-size:13px;opacity:.75;margin:8px 0 12px}</style>`;
}
