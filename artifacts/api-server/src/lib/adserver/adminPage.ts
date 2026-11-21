/** Admin console (/ads/admin) for Randy and Jon. Real rows only; payouts are calculated and approved, never sent. */
import { AD_SLOTS, PLACEMENTS, placementLabel } from "./config";
import { flightProgress, pacingState, type Campaign } from "./engine";
import type { Creative, LedgerLine, RoyaltyRow, Totals } from "./store";
import { esc, fmtDate, fmtDateTime, fmtInt, fmtMoney, fmtPct, isoDay, shell } from "./ui";

export function adminLoginPage(error?: string): string {
  return shell({
    title: "Admin sign in · Birch Reserve ads",
    nav: "Ads admin",
    body: `<div style="max-width:480px;margin:48px auto"><h1>Ads admin</h1><p class="lede">Randy and Jon only.</p>
${error ? `<p class="warn" role="alert">${esc(error)}</p>` : ""}
<div class="card"><form class="f" data-post="/ads/admin/login"><label>Email<input type="email" name="email" required autocomplete="username"></label>
<label>Admin key<input type="password" name="key" required autocomplete="current-password"></label><button type="submit">Sign in</button></form></div></div>`,
  });
}

export type AdminView = {
  who: string;
  campaigns: Array<{ c: Campaign; t: Totals }>;
  pending: Array<Creative & { brand: string }>;
  creativesByCampaign: Map<string, Creative[]>;
  slotTotals: Map<string, Totals>;
  ledger: LedgerLine[];
  royalties: RoyaltyRow[];
  shares: Map<string, number | null>;
  orders: Array<{ id: string; at: Date; email: string; company: string; plan: string; format: string; creativeId: string | null }>;
  alerts: Array<{ email: string; categories: string[] }>;
  audit: Array<{ at: Date; actor: string | null; action: string; target: string | null; detail: string | null }>;
  day: Totals;
  friday: boolean;
  schema: string;
  promoHtml?: string;
  hubs?: Array<{ key: string; name: string; category: string; url: string; partner: string; contractRef: string; status: string; isTest: boolean; createdBy: string | null; createdAt: Date }>;
  testRoyalties?: RoyaltyRow[];
};

const sel = (name: string, opts: Array<[string, string]>, cur: string) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const hubList = () => [...new Map(AD_SLOTS.map((s) => [s.hub, s] as const)).values()];

function campaignForm(c: Campaign | null): string {
  const v = c;
  return `<div class="row">
${c ? "" : `<label>Customer email<input name="accountEmail" type="email" required></label><label>Brand<input name="brand" required maxlength="160"></label>`}
${c ? `<label>Brand<input name="brand" value="${esc(v!.brand)}" maxlength="160"></label>` : ""}
<label>Category<input name="category" value="${esc(v?.category ?? "")}" maxlength="80"></label>
${c ? `<label>Status${sel("status", [["draft", "Draft"], ["active", "Active (serving)"], ["paused", "Paused"], ["completed", "Completed"]], v!.status)}</label>` : `<label>Budget (major units)<input name="budget" type="number" min="1" step="0.01" required></label><label>Currency${sel("currency", [["usd", "USD"], ["cad", "CAD"]], "usd")}</label>`}
<label>Pricing${sel("pricing", [["cpm", "CPM (viewable impressions)"], ["cpc", "CPC (clicks)"]], v?.pricing ?? "cpm")}</label>
<label>Bought placement${sel("primaryPlacement", PLACEMENTS.map((p) => [p, placementLabel(p)]), v?.primaryPlacement ?? "post_purchase")}</label>
<label>Flight start<input type="date" name="flightStart" value="${esc(isoDay(v?.flightStart ?? null))}"></label>
<label>Flight end (≤ 6 months)<input type="date" name="flightEnd" value="${esc(isoDay(v?.flightEnd ?? null))}"></label>
<label>Rate vs card (bps, 10000 = card)<input type="number" name="rateMultiplierBps" min="1000" max="10000" value="${v?.rateMultiplierBps ?? 10000}"></label>
<label>Landing URL<input type="url" name="clickUrl" value="${esc(v?.clickUrl ?? "")}" placeholder="https://brand.com/offer"></label>
<label>Freq cap / visitor / day<input type="number" name="freqCapPerDay" min="1" max="50" value="${v?.freqCapPerDay ?? 6}"></label>
<label>Click window (days)<input type="number" name="clickWindowDays" min="1" max="30" value="${v?.clickWindowDays ?? 7}"></label>
<label>View window (days)<input type="number" name="viewWindowDays" min="0" max="7" value="${v?.viewWindowDays ?? 1}"></label></div>
<div class="checks" style="margin-top:6px"><span class="fine">Hubs (none = every live hub):</span>${hubList().map((h) => `<label><input type="checkbox" name="hubs[]" value="${esc(h.hub)}"${v?.hubs.includes(h.hub) ? " checked" : ""}> ${esc(h.hubName)}${h.live ? "" : " (not live)"}</label>`).join("")}</div>
<div class="checks"><label><input type="checkbox" name="allowSubstitute"${v ? (v.allowSubstitute ? " checked" : "") : " checked"}> Auto-move spend to equal-or-lower-rate placements</label>
<label><input type="checkbox" name="exclusive"${v?.exclusive ? " checked" : ""}> Exclusive (blocks same-category brands on its hubs)</label>${c ? "" : `<label><input type="checkbox" name="isTest"> TEST campaign (serves only on test requests)</label>`}</div>
<label>Notes<input name="notes" value="${esc(v?.notes ?? "")}" maxlength="500"></label>`;
}

export function adminPage(v: AdminView, now = Date.now()): string {
  const live = v.campaigns.filter((x) => x.c.status === "active");
  const drafts = v.campaigns.filter((x) => x.c.status === "draft");
  const rows = v.campaigns.map(({ c, t }) => {
    const st = pacingState(c, now);
    const sp = c.budgetMicros > 0 ? (c.spentMicros / c.budgetMicros) * 100 : 0;
    const fp = flightProgress(c, now) * 100;
    const crs = v.creativesByCampaign.get(c.id) ?? [];
    return `<tr><td><b>${esc(c.brand)}</b>${c.isTest ? ` <span class="chip c-test">Test</span>` : ""}${c.exclusive ? ` <span class="chip c-ahead">Excl.</span>` : ""}<div class="fine">${esc(c.accountEmail)}<br>${esc(c.orderKind ?? "manual")} · ${esc(c.id.slice(0, 8))}</div></td>
<td><span class="chip c-${esc(c.status)}">${esc(c.status)}</span><br><span class="chip c-${esc(st)}" style="margin-top:4px">${esc(st.replace("_", " "))}</span></td>
<td>${esc(placementLabel(c.primaryPlacement))}<div class="fine">${c.pricing.toUpperCase()}${c.allowSubstitute ? " · auto-move on" : ""}${c.rateMultiplierBps !== 10000 ? ` · ${c.rateMultiplierBps / 100}% of card` : ""}<br>${c.hubs.length ? esc(c.hubs.join(", ")) : "all live hubs"}</div></td>
<td class="n">${fmtMoney(c.budgetMicros, c.currency)}<div class="fine">spent ${fmtMoney(c.spentMicros, c.currency)}</div><div class="bar" style="min-width:120px"><i style="width:${sp.toFixed(1)}%"></i>${c.flightStart ? `<em style="left:${fp.toFixed(1)}%"></em>` : ""}</div></td>
<td class="fine">${fmtDate(c.flightStart)}<br>${fmtDate(c.flightEnd)}</td>
<td class="n">${fmtInt(t.views)}<div class="fine">${fmtInt(t.clicks)} clk · ${fmtPct(t.clicks, t.views)}<br>${fmtInt(t.convs)} conv</div></td>
<td class="fine">${crs.length ? crs.map((x) => `<span class="chip c-${esc(x.status)}">${esc(x.status)}</span>`).join(" ") : "none"}</td>
<td style="min-width:120px"><details class="ed"><summary>Edit</summary><form class="f" data-post="/ads/admin/campaigns/${esc(c.id)}" data-reload>${campaignForm(c)}<button type="submit">Save</button></form>
<form class="f" data-post="/ads/admin/campaigns/${esc(c.id)}/budget" data-reload style="margin-top:8px"><div class="row"><label>Top up / adjust (±, ${c.currency.toUpperCase()})<input name="delta" type="number" step="0.01" required></label><label>Ledger note<input name="note" required maxlength="200" placeholder="IO #, top-up, refund"></label></div><button class="ghost sm" type="submit">Post to ledger</button></form>
<form class="f" data-post="/ads/admin/creatives?campaign=${esc(c.id)}" data-reload style="margin-top:8px"><label>Add creative (image)<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" required></label><label>Alt text<input name="alt" maxlength="200"></label><label style="display:flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" name="approve"> Approve now</label><button class="ghost sm" type="submit">Upload</button></form>
<form data-post="/ads/admin/campaigns/${esc(c.id)}/login-link" style="margin-top:8px"><button class="ghost sm" type="submit">Copy customer dashboard link</button><pre data-out style="display:none;white-space:pre-wrap;word-break:break-all"></pre></form>
${v.friday ? `<form data-post="/ads/admin/friday-sync?campaign=${esc(c.id)}" style="margin-top:6px"><button class="ghost sm" type="submit">Push summary to Friday</button></form>` : ""}
${c.isTest ? `<form data-post="/ads/admin/campaigns/${esc(c.id)}/purge" data-reload style="margin-top:6px"><button class="danger sm" type="submit">Delete test campaign + its data</button></form>` : ""}</details></td></tr>`;
  });
  const pending = v.pending.map((x) => `<div class="card" style="display:grid;gap:8px"><img src="/v1/ads/cr/${esc(x.id)}?preview=1" alt="${esc(x.alt)}" style="max-width:100%;border-radius:10px;border:1px solid #eee">
<div><b>${esc(x.brand)}</b> <span class="fine">${x.width}×${x.height} · ${fmtInt(x.bytes / 1024)} KB · ${esc(x.uploadedBy ?? "")}</span><div class="fine">Alt: ${esc(x.alt || "–")}</div></div>
<div style="display:flex;gap:8px"><form data-post="/ads/admin/creatives/${esc(x.id)}/status?to=approved" data-reload><button class="sm" type="submit">Approve</button></form><form data-post="/ads/admin/creatives/${esc(x.id)}/status?to=rejected" data-reload style="display:flex;gap:6px"><input name="reason" required maxlength="300" placeholder="Reason (the buyer sees this)"><button class="ghost sm" type="submit">Reject</button></form></div></div>`);
  const slotRows = [...AD_SLOTS].sort((a, b) => Number(b.live) - Number(a.live)).map((s) => {
    const t = v.slotTotals.get(s.key);
    return `<tr><td>${esc(s.hubName)}</td><td>${esc(placementLabel(s.placement))}<div class="fine"><code>${esc(s.key)}</code></div></td><td><span class="chip ${s.live ? "c-active" : "c-pending"}">${s.live ? "live" : "not live"}</span></td><td class="n">$${s.cpmUsd.toFixed(2)}</td><td class="n">$${s.cpcUsd.toFixed(2)}</td><td class="n">${fmtInt(t?.serves ?? 0)}</td><td class="n">${fmtInt(t?.views ?? 0)}</td><td class="n">${fmtInt(t?.clicks ?? 0)}</td><td class="n">${fmtPct(t?.clicks ?? 0, t?.views ?? 0)}</td></tr>`;
  });
  const partners = [...new Set(AD_SLOTS.map((s) => s.partner))];
  const roy = v.royalties.map((r) => `<tr><td>${esc(r.partner)}</td><td>${esc(r.month)}</td><td class="n">${fmtMoney(r.grossMicros, r.currency)}<div class="fine">${fmtInt(r.units)} billed units</div></td><td class="n">${r.shareBps === null ? `<span class="chip c-pending">pending rate</span>` : `${(r.shareBps / 100).toFixed(2)}%`}</td><td class="n">${r.payableMicros === null ? "–" : fmtMoney(r.payableMicros, r.currency)}</td>
<td><span class="chip c-${r.status}">${r.status}</span>${r.approvedBy ? `<div class="fine">${esc(r.approvedBy)} · ${fmtDateTime(r.approvedAt)}</div>` : ""}${r.paidRef ? `<div class="fine">paid · ${esc(r.paidRef)} · ${fmtDateTime(r.paidAt ?? null)}</div>` : ""}</td>
<td>${r.status === "calculated" && r.shareBps !== null ? `<form data-post="/ads/admin/payouts/approve" data-reload><input type="hidden" name="partner" value="${esc(r.partner)}"><input type="hidden" name="month" value="${esc(r.month)}"><input type="hidden" name="currency" value="${esc(r.currency)}"><button class="sm" type="submit">Approve statement</button></form>` : r.status === "approved" ? `<form data-post="/ads/admin/payouts/paid" data-reload style="display:flex;gap:6px"><input type="hidden" name="partner" value="${esc(r.partner)}"><input type="hidden" name="month" value="${esc(r.month)}"><input type="hidden" name="currency" value="${esc(r.currency)}"><input name="ref" required maxlength="120" placeholder="e-transfer / cheque ref"><button class="ghost sm" type="submit">Mark paid (manual)</button></form>` : ""}</td></tr>`);
  const testRoy = (v.testRoyalties ?? []).map((r) => `<tr><td>${esc(r.partner)} <span class="chip c-test">test</span></td><td>${esc(r.month)}</td><td class="n">${fmtMoney(r.grossMicros, r.currency)}<div class="fine">${fmtInt(r.units)} billed units</div></td><td class="n">${r.shareBps === null ? "pending rate" : `${(r.shareBps / 100).toFixed(2)}%`}</td><td class="n">${r.payableMicros === null ? "–" : fmtMoney(r.payableMicros, r.currency)}</td><td colspan="2" class="fine">QA only, never approvable or exported</td></tr>`);
  const hubRows = (v.hubs ?? []).map((h) => `<tr><td><b>${esc(h.name)}</b>${h.isTest ? ` <span class="chip c-test">test</span>` : ""}<div class="fine"><code>${esc(h.key)}</code> · ${esc(h.category)}</div></td><td class="fine"><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.url)}</a></td><td>${esc(h.partner)}<div class="fine">rate: ${v.shares.get(h.partner) != null ? `${(v.shares.get(h.partner)! / 100).toFixed(2)}%` : "pending rate"}</div></td><td class="fine">${esc(h.contractRef)}<br>${esc(h.createdBy ?? "")} · ${fmtDate(h.createdAt)}</td><td><span class="chip ${h.status === "live" ? "c-active" : "c-paused"}">${esc(h.status)}</span></td>
<td><form data-post="/ads/admin/hubs/${esc(h.key)}/status?to=${h.status === "live" ? "paused" : "live"}" data-reload style="display:inline"><button class="ghost sm" type="submit">${h.status === "live" ? "Pause" : "Set live"}</button></form>${h.isTest ? ` <form data-post="/ads/admin/hubs/${esc(h.key)}/purge" data-reload style="display:inline"><button class="danger sm" type="submit">Delete test hub</button></form>` : ""}</td></tr>`);
  const led = v.ledger.slice(0, 300).map((l) => `<tr><td class="fine">${fmtDateTime(l.at)}</td><td>${esc(l.kind)}${l.isTest ? ` <span class="chip c-test">test</span>` : ""}</td><td class="fine">${esc(l.campaignId.slice(0, 8))}</td><td class="fine">${esc(l.slotKey ?? "")}</td><td class="n">${l.units || ""}</td><td class="n">${fmtMoney(l.amountMicros, l.currency)}</td><td class="fine">${esc(l.note ?? "")} · ${esc(l.actor ?? "")}</td></tr>`);
  const catCount = new Map<string, number>();
  for (const a of v.alerts) for (const c of a.categories) catCount.set(c, (catCount.get(c) ?? 0) + 1);
  const body = `<h1 style="margin-top:26px">Ad system</h1>
<p class="lede">Signed in as ${esc(v.who)}. Live numbers from logged, bot-filtered events. Store: <code>${esc(v.schema)}</code>.</p>
<section id="overview"><div class="grid k"><div class="card kpi"><span>Live campaigns</span><b>${live.length}</b><small>${drafts.length} paid draft${drafts.length === 1 ? "" : "s"} waiting</small></div>
<div class="card kpi"><span>Creatives to review</span><b>${v.pending.length}</b><small><a href="#creatives">Review</a></small></div>
<div class="card kpi"><span>Viewable (24h, real)</span><b>${fmtInt(v.day.views)}</b><small>${fmtInt(v.day.serves)} served</small></div>
<div class="card kpi"><span>Clicks (24h, real)</span><b>${fmtInt(v.day.clicks)}</b><small>CTR ${fmtPct(v.day.clicks, v.day.views)}</small></div>
<div class="card kpi"><span>Conversions (24h, real)</span><b>${fmtInt(v.day.convs)}</b><small>pixel + postback</small></div></div></section>
<section id="campaigns"><h2>Campaigns</h2><p class="fine">Paid checkouts open a draft automatically. To go live: approve a creative, set the flight (after the IO is signed), set the landing URL, then set status Active. Pacing is even across the flight, charged at each slot's card rate, and never past budget.</p>
<div class="tw"><table><thead><tr><th>Campaign</th><th>Status</th><th>Placement</th><th class="n">Budget</th><th>Flight</th><th class="n">Delivery</th><th>Creatives</th><th></th></tr></thead><tbody>${rows.join("") || `<tr><td colspan="8" class="muted">No campaigns yet.</td></tr>`}</tbody></table></div>
<details class="ed"><summary>New campaign (manual or from an IO)</summary><form class="f" data-post="/ads/admin/campaigns" data-reload>${campaignForm(null)}<button type="submit">Create draft</button></form></details></section>
<section id="creatives"><h2>Creative approval</h2>${pending.length ? `<div class="grid two">${pending.join("")}</div>` : `<p class="empty">Nothing waiting for review.</p>`}</section>
<section id="onboard"><h2>Hubs on contract</h2><p class="fine">When a hub signs, add it here with the contract reference. Its ${PLACEMENTS.length} placements become sellable at card rates right away (serving still needs a paid, approved, active campaign). Same key as a queued kit hub (e.g. <code>jack-health</code>) switches that hub live. The royalty rate stays <b>pending rate</b> until set below from the contract.</p>
<div class="tw"><table><thead><tr><th>Hub</th><th>URL</th><th>Royalty partner</th><th>Contract</th><th>Status</th><th></th></tr></thead><tbody>${hubRows.join("") || `<tr><td colspan="6" class="muted">No hubs onboarded on contract yet. Kit hubs below are built in.</td></tr>`}</tbody></table></div>
<details class="ed"><summary>Onboard a hub on contract</summary><form class="f" data-post="/ads/admin/hubs" data-reload><div class="row"><label>Key (lowercase, e.g. calm-joints)<input name="key" required pattern="[a-z0-9][a-z0-9-]{1,40}"></label><label>Hub name<input name="name" required maxlength="80"></label><label>Audience category<input name="category" required maxlength="80"></label><label>Hub URL<input name="url" type="url" required></label><label>Royalty partner (defaults to hub name)<input name="partner" maxlength="120"></label><label>Contract reference (signed agreement, date)<input name="contractRef" required maxlength="160"></label></div>
<div class="checks"><label><input type="checkbox" name="isTest"> TEST hub (QA only; serves test campaigns on test requests, never real buyers)</label></div><button type="submit">Add hub and open its placements</button></form></details></section>
<section id="inventory"><h2>Slot inventory</h2><p class="fine">Rates are the public starter (starting-at) card. Last 30 days. Embed a slot with <code>&lt;div data-br-slot="KEY"&gt;house card&lt;/div&gt;</code>; see <a href="/ads/docs">docs</a>.</p>
<div class="tw"><table><thead><tr><th>Hub</th><th>Placement</th><th>Status</th><th class="n">CPM</th><th class="n">CPC</th><th class="n">Served</th><th class="n">Viewable</th><th class="n">Clicks</th><th class="n">CTR</th></tr></thead><tbody>${slotRows.join("")}</tbody></table></div></section>
<section id="royalties"><h2>Royalty statements</h2><p class="fine">Per hub partner and month, from delivered (charged) spend on that partner's slots, test campaigns excluded. Approving freezes the statement. <b>Nothing pays out from here.</b> Payment is sent by Randy outside this system.</p>
<form class="f" data-post="/ads/admin/partners/share" data-reload style="margin-bottom:10px"><div class="row"><label>Partner${sel("partner", partners.map((p) => [p, `${p}${v.shares.get(p) != null ? ` (now ${(v.shares.get(p)! / 100).toFixed(2)}%)` : ""}`]), partners[0] ?? "")}</label><label>Royalty share %<input type="number" name="sharePct" min="0" max="100" step="0.01" required></label></div><button class="ghost sm" type="submit">Set share</button></form>
<div class="tw"><table><thead><tr><th>Partner</th><th>Month</th><th class="n">Delivered</th><th class="n">Share</th><th class="n">Payable</th><th>Status</th><th></th></tr></thead><tbody>${roy.join("") || `<tr><td colspan="7" class="muted">No delivered spend yet.</td></tr>`}${testRoy.join("")}</tbody></table></div>
<p class="fine">Manual payouts: approve a statement, pay it outside this system, then record the reference with "Mark paid". <a href="/ads/admin/export/payouts.csv">Payout CSV</a> lists approved and paid statements with the amounts to send.</p></section>
${v.promoHtml ?? ""}
<section id="ledger"><h2>Ledger</h2><p class="fine">Credits, hourly charge lines per slot, and manual adjustments. <a href="/ads/admin/export/ledger.csv">CSV</a></p>
<div class="tw"><table><thead><tr><th>When</th><th>Kind</th><th>Campaign</th><th>Slot</th><th class="n">Units</th><th class="n">Amount</th><th>Note</th></tr></thead><tbody>${led.join("") || `<tr><td colspan="7" class="muted">Empty.</td></tr>`}</tbody></table></div></section>
<section id="orders"><h2>Orders from /buy</h2><p class="fine">Card checkouts (packs, reserves) open draft campaigns automatically; /buy orders are listed here to turn into campaigns once paid.</p>
<div class="tw"><table><thead><tr><th>When</th><th>Company</th><th>Email</th><th>Plan</th><th>Format</th><th>Creative</th></tr></thead><tbody>${v.orders.map((o) => `<tr><td class="fine">${fmtDateTime(o.at)}</td><td>${esc(o.company)}</td><td class="fine">${esc(o.email)}</td><td>${esc(o.plan)}</td><td>${esc(o.format)}</td><td class="fine">${o.creativeId ? `uploaded${(() => { const m = v.campaigns.filter((x) => x.c.accountEmail === o.email.toLowerCase()); return m.length ? `<form data-post="/ads/admin/orders/${esc(o.id)}/attach" data-reload style="display:flex;gap:6px;margin-top:4px">${sel("campaign", m.map((x) => [x.c.id, `${x.c.brand} · ${x.c.id.slice(0, 8)}`]), m[0]!.c.id)}<button class="ghost sm" type="submit">Send to approval queue</button></form>` : "<br>no paid campaign for this email yet"; })()}` : "–"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No /buy orders.</td></tr>`}</tbody></table></div></section>
<section id="alerts"><h2>New-hub alert subscribers</h2><p class="fine">${v.alerts.length} opted in. Alert emails are OFF until Randy previews the template.</p>
<div class="checks">${[...catCount.entries()].map(([c, n]) => `<span class="chip c-approved">${esc(c)}: ${n}</span>`).join(" ") || `<span class="muted">None yet.</span>`}</div></section>
<section id="exports"><h2>Exports</h2><p><a class="btn ghost sm" href="/ads/admin/export/campaigns.csv">Campaigns</a> <a class="btn ghost sm" href="/ads/admin/export/delivery.csv">Daily delivery</a> <a class="btn ghost sm" href="/ads/admin/export/ledger.csv">Ledger</a> <a class="btn ghost sm" href="/ads/admin/export/royalties.csv">Royalties</a> <a class="btn ghost sm" href="/ads/admin/export/payouts.csv">Payouts (manual)</a>
${v.friday ? `<form data-post="/ads/admin/friday-sync" style="display:inline"><button class="ghost sm" type="submit">Push all summaries to Friday</button></form>` : `<span class="fine">Friday push is not configured on this deployment.</span>`}</p></section>
<section id="audit"><h2>Audit log</h2><div class="tw" style="max-height:320px"><table><tbody>${v.audit.map((a) => `<tr><td class="fine">${fmtDateTime(a.at)}</td><td>${esc(a.actor ?? "")}</td><td>${esc(a.action)}</td><td class="fine">${esc(a.target ?? "")}</td><td class="fine">${esc((a.detail ?? "").slice(0, 160))}</td></tr>`).join("")}</tbody></table></div></section>`;
  return shell({
    title: "Ads admin · Birch Reserve",
    nav: "Ads admin",
    right: `<nav class="tabs"><a href="#campaigns">Campaigns</a><a href="#creatives">Creatives${v.pending.length ? ` (${v.pending.length})` : ""}</a><a href="#onboard">Hubs</a><a href="#inventory">Inventory</a><a href="#royalties">Royalties</a><a href="#ledger">Ledger</a><a href="#orders">Orders</a><a href="/ads/docs">Docs</a><form data-post="/ads/admin/logout" style="display:inline"><button class="ghost sm" type="submit">Sign out</button></form></nav>`,
    body,
  });
}
