/**
 * Admin Business tab: "AI search" (Randy, Nov 22 2026, Granola AEO playbook: measure Google and AI separately).
 * Visits that arrived from an AI assistant (ai_ref.* ui-events, last 30 days) and leads whose first touch was an
 * AI assistant (referrer host / utm_source on the lead). Real rows only; test leads excluded. Read-only.
 */
import { db, siteCtaEventsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { Lead } from "../leads";
import { isTestIdentity } from "../testTraffic";
import { AI_SOURCES, AI_SOURCE_LABEL, aiSourceOf, parseAiRefEvent, type AiSource } from "../aiReferral";
import { leadSiteOf, type SiteFilter } from "./adminBusiness";
import { esc, fmtInt } from "./ui";

export type AiVisitRow = { event: string; path: string; n: number };

/** Last 30 days of ai_ref.* events, grouped by event + path. Throws when the DB can't be read. */
export async function loadAiVisits(): Promise<AiVisitRow[]> {
  const r = await db.execute(sql`select event, path, count(*)::integer as n from ${siteCtaEventsTable}
    where event like 'ai_ref.%' and created_at > now() - interval '30 days' group by event, path order by n desc limit 300`);
  return (r.rows as Array<{ event: string; path: string; n: number | string }>).map((x) => ({ event: x.event, path: x.path, n: Number(x.n) }));
}

export function aiSearchHtml(visits: AiVisitRow[] | null, leads: Partial<Record<Lead["source"], Lead[]>>, site: SiteFilter): string {
  const head = `<section id="ai-search"><h2>AI search</h2><p class="fine">Visits sent by ChatGPT, Perplexity, Grok, Gemini, Copilot, Claude, Meta AI or DeepSeek (referrer host or utm_source, last 30 days), and leads whose first touch was one of them. Tracked separately from Google. Aggregate only.</p>`;
  const bySrc = new Map<AiSource, { visits: number; leads: number }>();
  const pages = new Map<string, number>();
  for (const v of visits ?? []) {
    const p = parseAiRefEvent(v.event);
    if (!p || (site !== "all" && p.site !== site)) continue;
    const a = bySrc.get(p.source) ?? { visits: 0, leads: 0 };
    a.visits += v.n;
    bySrc.set(p.source, a);
    pages.set(`${p.site === "scale" ? "Scale" : "Birch"} ${v.path}`, (pages.get(`${p.site === "scale" ? "Scale" : "Birch"} ${v.path}`) ?? 0) + v.n);
  }
  const leadRows: Array<{ l: Lead; s: AiSource }> = [];
  for (const list of Object.values(leads)) for (const l of list ?? []) {
    if (l.isTest || isTestIdentity({ email: l.email ?? undefined, name: l.name ?? undefined })) continue;
    if (site !== "all" && leadSiteOf(l) !== site) continue;
    const s = aiSourceOf({ referrer: l.referrer, utmSource: l.utmSource });
    if (!s) continue;
    leadRows.push({ l, s });
    const a = bySrc.get(s) ?? { visits: 0, leads: 0 };
    a.leads += 1;
    bySrc.set(s, a);
  }
  const visitNote = visits ? "" : `<p class="warn" role="alert">Visit counts could not be read right now. Nothing is shown rather than guessing.</p>`;
  if (!bySrc.size) return `${head}${visitNote}<p class="empty">No visits or leads from AI assistants yet. New buyer-answer pages are listed in /llms.txt and the sitemap; re-check after crawlers pick them up.</p></section>`;
  const rows = AI_SOURCES.filter((s) => bySrc.has(s)).map((s) => `<tr><td>${AI_SOURCE_LABEL[s]}</td><td class="n">${fmtInt(bySrc.get(s)!.visits)}</td><td class="n">${fmtInt(bySrc.get(s)!.leads)}</td></tr>`).join("");
  const top = [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, n]) => `<li>${esc(p)} · ${fmtInt(n)}</li>`).join("");
  const lr = leadRows.slice(0, 50).map(({ l, s }) => `<li>${esc(AI_SOURCE_LABEL[s])} → <b>${esc(l.company || l.name || l.email || "lead")}</b> <span class="fine">${esc(l.landingPage ?? "")}</span></li>`).join("");
  return `${head}${visitNote}<div class="tw"><table><thead><tr><th>Assistant</th><th class="n">Visits (30 days)</th><th class="n">Leads (first touch)</th></tr></thead><tbody>${rows}</tbody></table></div>
${top ? `<p class="fine" style="margin-top:10px">Top landing pages</p><ul class="fine">${top}</ul>` : ""}${lr ? `<p class="fine">Leads from AI search</p><ul class="fine">${lr}</ul>` : ""}</section>`;
}
