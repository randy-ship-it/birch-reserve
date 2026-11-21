/**
 * Admin panel: ad activation answers (inventory estimate + which ads can run on a partner's hubs).
 * Filter: all / open to non-core / curated only. The roll-up is an INTERNAL, self-reported count built from range
 * midpoints. It never feeds a public inventory figure. Test rows are listed (marked) but never counted.
 */
import type { Lead } from "../leads";
import { ACT_OPENNESS, ACT_ROLES, ACT_EXCLUSIONS, LIST_RANGES, PAGES_RANGES, VIEWS_RANGES, isNonCore } from "../overhaul/adActivation";
import { esc, fmtDateTime } from "./ui";

const FILTERS = [["", "All"], ["noncore", "Open to non-core"], ["curated", "Curated only"]] as const;
const rangeLabel = (list: Array<{ key: string; label: string }>, k?: string) => list.find((r) => r.key === k)?.label ?? "?";
const n = (v: number) => v.toLocaleString("en-US");

export type ActivationRollup = { partners: number; noncore: number; pages: number; views: number; list: number; unsure: number; byRole: Record<string, number> };
/** Roll the estimates into the internal inventory count (real rows only). "Not sure" answers add 0 and are counted as unsure. */
export function activationRollup(leads: Lead[]): ActivationRollup {
  const real = leads.filter((l) => !l.isTest);
  const byRole: Record<string, number> = {};
  const out: ActivationRollup = { partners: real.length, noncore: real.filter((l) => isNonCore(l.meta.act_openness)).length, pages: 0, views: 0, list: 0, unsure: 0, byRole };
  for (const l of real) {
    out.pages += l.meta.act_pages_mid ?? 0; out.views += l.meta.act_views_mid ?? 0; out.list += l.meta.act_list_mid ?? 0;
    if (l.meta.act_pages === "unsure" || l.meta.act_views === "unsure") out.unsure += 1;
    const r = l.meta.act_role ?? "?";
    byRole[r] = (byRole[r] ?? 0) + 1;
  }
  return out;
}

export function activationAdminHtml(leads: Lead[], filter: string): string {
  const want = filter === "noncore" || filter === "curated" ? filter : "";
  const rows = leads.filter((l) => (want === "noncore" ? isNonCore(l.meta.act_openness) : want === "curated" ? l.meta.act_openness === "curated" : true));
  const real = leads.filter((l) => !l.isTest);
  const cnt = (f: string) => (f === "noncore" ? real.filter((l) => isNonCore(l.meta.act_openness)).length : f === "curated" ? real.filter((l) => l.meta.act_openness === "curated").length : real.length);
  const tabs = FILTERS.map(([k, t]) => `<a href="/ads/admin?act=${k}#activation" class="chip ${want === k ? "c-live" : "c-paused"}" style="text-decoration:none;margin-right:6px" data-testid="act-filter-${k || "all"}">${esc(t)} (${cnt(k)})</a>`).join("");
  const ro = activationRollup(leads);
  const roles = ACT_ROLES.map((r) => `${esc(r.label)}: ${ro.byRole[r.key] ?? 0}`).join(" · ");
  const body = rows.map((l) => {
    const o = ACT_OPENNESS.find((x) => x.key === l.meta.act_openness);
    const ex = (l.meta.act_excl && l.meta.act_excl !== "none" ? l.meta.act_excl.split(",") : []).map((k) => ACT_EXCLUSIONS.find((e) => e.key === k)?.label ?? k);
    const other = (l.need ?? "").split("\n").find((x) => x.startsWith("Other ad data:"));
    return `<tr><td class="fine">${esc(fmtDateTime(l.updatedAt))}</td><td>${esc(l.company ?? "")}<div class="fine">${esc(l.email ?? "")}</div>${l.isTest ? ` <span class="chip c-paused">test</span>` : ""}</td><td class="fine">${esc(ACT_ROLES.find((r) => r.key === l.meta.act_role)?.label ?? "?")}${l.meta.hub_slug ? `<br>hub ${esc(l.meta.hub_slug)}` : ""}</td><td class="fine">Pages/screens ${esc(rangeLabel(PAGES_RANGES, l.meta.act_pages))}<br>Views/mo ${esc(rangeLabel(VIEWS_RANGES, l.meta.act_views))}<br>List ${esc(rangeLabel(LIST_RANGES, l.meta.act_list))}${other ? `<br>${esc(other)}` : ""}</td><td><span class="chip ${isNonCore(l.meta.act_openness) ? "c-live" : "c-paused"}">${isNonCore(l.meta.act_openness) ? "Open to non-core" : "Curated only"}</span><div class="fine">${esc(o?.label ?? "?")}${ex.length ? `<br>Excludes: ${esc(ex.join(", "))}` : ""}</div></td><td class="fine"><code>${esc(l.id)}</code></td></tr>`;
  }).join("");
  return `<section id="activation" data-testid="act-admin"><h2>Ad activation: inventory estimates and ad openness</h2><p class="fine">Answers partners give when their ads are being turned on. Self-reported ranges. Nothing here changes the public inventory figures, and no ad runs on a hub without our ad system plus Randy or Jon permission.</p><div class="tw"><table data-testid="act-rollup"><thead><tr><th>Internal inventory count (admin only)</th><th class="n">Pages / hub screens</th><th class="n">Monthly views</th><th class="n">Email / SMS list</th><th class="n">Open to non-core</th></tr></thead><tbody><tr><td class="fine">${ro.partners} partner${ro.partners === 1 ? "" : "s"} · ${roles}<br>${ro.unsure} with a "Not sure" answer (counted as 0)</td><td class="n">${n(ro.pages)}</td><td class="n">${n(ro.views)}</td><td class="n">${n(ro.list)}</td><td class="n">${ro.noncore}</td></tr></tbody></table></div><p class="fine">Totals use the middle of each range, so treat them as a planning estimate only.</p><p>${tabs}</p>${rows.length ? `<div class="tw"><table><thead><tr><th>Updated</th><th>Partner</th><th>Who</th><th>Estimate</th><th>Ads allowed</th><th>Lead id</th></tr></thead><tbody>${body}</tbody></table></div>` : `<p class="fine">No activation answers yet.</p>`}</section>`;
}
