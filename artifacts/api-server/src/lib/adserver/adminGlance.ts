/** Admin "Today and this week" strip (Randy + Jon day-to-day view). Real rows only: test leads, test campaigns and test payouts are excluded; no placeholder numbers. */
import type { Lead, LeadSource } from "../leads";
import type { Campaign } from "./engine";
import type { RoyaltyRow, Totals } from "./store";
import { esc, fmtInt, fmtMoney } from "./ui";

const DAY = 864e5;
const SOURCES: Array<[LeadSource, string]> = [
  ["brand_intake", "Brand intake"],
  ["advertiser_intake", "Advertiser intake"],
  ["partners", "Hub intake (publisher)"],
  ["activation", "Hub ad-activation answers"],
  ["inventory_signup", "Hub signups"],
  ["checkout", "Paid checkouts"],
];

export type GlanceInput = {
  now?: number;
  leads: Partial<Record<LeadSource, Lead[]>>;
  /** /buy orders, newest first (real). */
  orders: Array<{ at: Date }>;
  campaigns: Array<{ c: Campaign; t: Totals }>;
  week: Map<string, Totals>;
  royalties: RoyaltyRow[];
};

export function adminGlanceHtml(g: GlanceInput): string {
  const now = g.now ?? Date.now();
  const count = (rows: Array<{ createdAt?: Date; at?: Date; isTest?: boolean }>, ms: number) =>
    rows.filter((r) => !r.isTest && now - (r.createdAt ?? r.at ?? new Date(0)).getTime() <= ms).length;
  const leadRows = SOURCES.map(([src, label]) => {
    const rows = g.leads[src] ?? [];
    return `<tr><td>${esc(label)}</td><td class="n">${fmtInt(count(rows, DAY))}</td><td class="n">${fmtInt(count(rows, 7 * DAY))}</td></tr>`;
  });
  leadRows.push(`<tr><td>/buy orders</td><td class="n">${fmtInt(count(g.orders, DAY))}</td><td class="n">${fmtInt(count(g.orders, 7 * DAY))}</td></tr>`);

  const real = g.campaigns.filter((x) => !x.c.isTest);
  const by = (s: string) => real.filter((x) => x.c.status === s).length;
  const wk = { views: 0, clicks: 0, convs: 0 };
  const spend = new Map<string, number>();
  for (const x of real) {
    const t = g.week.get(x.c.id);
    if (t) { wk.views += t.views; wk.clicks += t.clicks; spend.set(x.c.currency, (spend.get(x.c.currency) ?? 0) + t.spendMicros); wk.convs += t.convs; }
  }
  const owed = new Map<string, { calc: number; appr: number }>();
  for (const r of g.royalties) {
    if (r.payableMicros == null || (r.status !== "calculated" && r.status !== "approved")) continue;
    const o = owed.get(r.currency) ?? { calc: 0, appr: 0 };
    if (r.status === "calculated") o.calc += r.payableMicros; else o.appr += r.payableMicros;
    owed.set(r.currency, o);
  }
  const owedHtml = [...owed].map(([cur, o]) => `${fmtMoney(o.appr, cur)} approved, unpaid · ${fmtMoney(o.calc, cur)} awaiting approval`).join("<br>") || "Nothing owed";
  const sellerBits = (["birch", "scale"] as const).map((s) => {
    const rows = real.filter((x) => (x.c.seller ?? "birch") === s);
    const live = rows.filter((x) => x.c.status === "active").length;
    return `${s === "birch" ? "Birch (brokerage)" : "Scale (direct)"}: ${rows.length} campaign${rows.length === 1 ? "" : "s"}, ${live} live`;
  }).join(" · ");
  return `<section id="glance"><h2>Today and this week</h2><p class="fine">Real activity only (test rows excluded). Last 24 hours and last 7 days.</p>
<div class="grid two"><div class="card"><h3>New leads and orders</h3><div class="tw"><table><thead><tr><th>Source</th><th class="n">24h</th><th class="n">7 days</th></tr></thead><tbody>${leadRows.join("")}</tbody></table></div></div>
<div class="card"><h3>Campaigns and money</h3><p><b>${by("active")}</b> live · <b>${by("paused")}</b> paused · <b>${by("draft")}</b> draft · <b>${by("completed")}</b> completed</p><p class="fine">${esc(sellerBits)}</p>
<p>7 days: <b>${fmtInt(wk.views)}</b> viewable impressions · <b>${fmtInt(wk.clicks)}</b> clicks · <b>${fmtInt(wk.convs)}</b> conversions · ${[...spend].map(([cur, m]) => fmtMoney(m, cur)).join(" + ") || fmtMoney(0, "USD")} delivered</p>
<p class="fine">Hub payouts owed (calculated from delivered spend; Birch override and Scale direct rates are set under Payout split):<br>${owedHtml}</p></div></div></section>`;
}
