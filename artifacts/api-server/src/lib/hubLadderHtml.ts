/**
 * The hub status ladder for server-rendered pages (/buycalc, /sponsor). Same data as the React pages (lib/hubLadder.ts).
 * Live now = cards with the real capture, one audience line and a link to the real hub page; Activating = a short list;
 * Coming = "and more launching". Skin-neutral wording (the Scale mirror renames it); self-contained CSS.
 */
import { activatingHubs, liveHubs, hubHref, LABEL_ACTIVATING, LABEL_LIVE, MORE_LAUNCHING } from "./hubLadder";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const HUB_LADDER_CSS = `.hl{margin:0 auto;max-width:1040px;color:#071A39}.hl h2{font-family:inherit;margin:0 0 10px}.hl-k{margin:14px 0 8px;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;opacity:.65}.hl-live{list-style:none;margin:0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(var(--n,3),minmax(0,1fr))}.hl-live li{min-width:0;border:1px solid rgba(7,26,57,.12);border-radius:16px;background:#fff;overflow:hidden}.hl-live a,.hl-live .hl-c{display:block;color:inherit;text-decoration:none}.hl-live img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top}.hl-b{display:block;padding:10px 12px}.hl-n{display:block;font-weight:700;line-height:1.2}.hl-a{display:block;margin-top:2px;font-size:13px;line-height:1.35;opacity:.75}.hl-t{display:inline-block;margin:0 0 6px;border-radius:999px;background:#d9f99d;padding:2px 8px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.hl-act{list-style:none;margin:0;padding:0;display:grid;gap:8px;grid-template-columns:repeat(3,minmax(0,1fr))}.hl-act li{min-width:0;border:1px dashed rgba(7,26,57,.28);border-radius:12px;padding:8px 10px;background:rgba(255,255,255,.7)}.hl-act li.more{display:grid;place-items:center;font-weight:600;opacity:.75;text-align:center}.hl-fine{margin:10px 0 0;font-size:12px;opacity:.65}@media(max-width:900px){.hl-live{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.hl-live,.hl-act{grid-template-columns:minmax(0,1fr)}}`;

export function hubLadderHtml(testId = "hub-ladder"): string {
  const live = liveHubs()
    .map((h) => {
      const href = hubHref(h);
      const inner = `${h.thumb ? `<img src="${esc(h.thumb)}" alt="${esc(h.name)} members-only hub" width="1000" height="625" loading="lazy">` : ""}<span class="hl-b"><span class="hl-t">${LABEL_LIVE}</span><span class="hl-n">${esc(h.name)}${href ? " ↗" : ""}</span><span class="hl-a">${esc(h.audience)}</span></span>`;
      return `<li data-hub="${esc(h.key)}">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener" aria-label="Visit the ${esc(h.name)} hub">${inner}</a>` : `<span class="hl-c">${inner}</span>`}</li>`;
    })
    .join("");
  const act = activatingHubs()
    .map((h) => `<li data-hub="${esc(h.key)}"><span class="hl-n">${esc(h.name)}</span><span class="hl-a">${esc(h.audience)}</span></li>`)
    .join("");
  return `<style>${HUB_LADDER_CSS}</style><div class="hl" data-testid="${testId}"><p class="hl-k">${LABEL_LIVE}</p><ul class="hl-live" style="--n:${liveHubs().length}" data-testid="${testId}-live">${live}</ul><p class="hl-k">${LABEL_ACTIVATING}</p><ul class="hl-act" data-testid="${testId}-activating">${act}<li class="more">${MORE_LAUNCHING}</li></ul><p class="hl-fine">Hub audiences are described, not guaranteed. Any view or reach figure on this site is a modelled estimate, not delivered impressions.</p></div>`;
}
