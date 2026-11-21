/** Admin panel: partnership inquiries (/partners), filterable by track. Real and test rows, test marked. */
import type { Lead } from "../leads";
import { PARTNER_TRACKS, partnerTrackName } from "../overhaul/partners";
import { esc, fmtDateTime } from "./ui";

export function partnersAdminHtml(leads: Lead[], track: string): string {
  const want = PARTNER_TRACKS.some((t) => t.key === track) ? track : "";
  const rows = leads.filter((l) => !want || l.meta.partner_track === want);
  const count = (k: string) => leads.filter((l) => !l.isTest && l.meta.partner_track === k).length;
  const tab = (k: string, label: string) => `<a href="/ads/admin?ptrack=${k}#partners" class="chip ${want === k ? "c-live" : "c-paused"}" style="text-decoration:none;margin-right:6px">${esc(label)}</a>`;
  const body = rows.map((l) => `<tr><td class="fine">${esc(fmtDateTime(l.createdAt))}</td><td><b>${esc(partnerTrackName(l.meta.partner_track) || "?")}</b>${l.isTest ? ` <span class="chip c-paused">test</span>` : ""}</td><td>${esc(l.company ?? "")}<div class="fine">${esc(l.name ?? "")}</div></td><td class="fine">${esc(l.email ?? "")}${l.phone ? `<br>${esc(l.phone)}` : ""}</td><td class="fine" style="white-space:pre-wrap;max-width:420px">${esc(l.need ?? "")}${l.size ? `\nReach: ${esc(l.size)}` : ""}</td><td class="fine"><code>${esc(l.id)}</code></td></tr>`).join("");
  return `<section id="partners"><h2>Partner leads</h2><p class="fine">From birchreserve.net/partners. Alerts go to randy@scalehealth.ca and randy@silverbirchgrowth.com.</p><p>${tab("", `All (${leads.filter((l) => !l.isTest).length})`)}${PARTNER_TRACKS.map((t) => tab(t.key, `${t.name} (${count(t.key)})`)).join("")}</p>${rows.length ? `<div class="tw"><table><thead><tr><th>When</th><th>Track</th><th>Company</th><th>Contact</th><th>Details</th><th>Lead id</th></tr></thead><tbody>${body}</tbody></table></div>` : `<p class="fine">No partner leads yet.</p>`}</section>`;
}
