/** Admin console (/ads/admin) for Randy and Jon. Real rows only; payouts are calculated and approved, never sent. */
import { CREATIVE_UPLOAD_JS, creativeFields } from "./creativeUploadJs";
import { findFormat } from "./creativeSpec";
import type { CreativeVariant } from "./store";
import { AD_SLOTS, PLACEMENTS, placementLabel } from "./config";
import { flightProgress, pacingState, type Campaign } from "./engine";
import type { Creative, LedgerLine, MonthSummary, PayoutSettings, RoyaltyRow, Totals } from "./store";
import { CHANNEL_DEFAULT_BPS, CHANNEL_LABEL, gatePassed, overrideFor, ratesAt, recipientsAt, workedExample, type ChannelRateRow, type Gate, type RateRow, type RecipientRow } from "./payoutSplit";
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
  hubServing?: Map<string, { enabled: boolean; approvedBy: string; actor: string; note: string | null; at: Date }>;
  who: string;
  campaigns: Array<{ c: Campaign; t: Totals }>;
  pending: Array<Creative & { brand: string; variants?: CreativeVariant[] }>;
  creativesByCampaign: Map<string, Creative[]>;
  slotTotals: Map<string, Totals>;
  ledger: LedgerLine[];
  royalties: RoyaltyRow[];
  channelRates?: Array<ChannelRateRow & { actor: string | null; note: string | null }>;
  shares: Map<string, number | null>;
  orders: Array<{ id: string; at: Date; email: string; company: string; website?: string; plan: string; format: string; creativeId: string | null }>;
  alerts: Array<{ email: string; categories: string[] }>;
  audit: Array<{ at: Date; actor: string | null; action: string; target: string | null; detail: string | null }>;
  day: Totals;
  friday: boolean;
  schema: string;
  promoHtml?: string;
  /** Referral orders + per-referrer commission (referralAdmin.ts). */
  referralHtml?: string;
  partnersHtml?: string;
  /** Street-team / partner members, for the recipient form's Referrer scope. */
  referrers?: Array<{ id: string; label: string }>;
  hubs?: Array<{ key: string; name: string; category: string; url: string; partner: string; contractRef: string; status: string; isTest: boolean; createdBy: string | null; createdAt: Date }>;
  testRoyalties?: RoyaltyRow[];
  summary?: MonthSummary[];
  testSummary?: MonthSummary[];
  rates?: Array<RateRow & { actor: string | null; note: string | null; id: number }>;
  recipients?: Array<RecipientRow & { actor: string | null; id: number }>;
  gates?: Map<string, Gate & { updatedBy: string | null; updatedAt: Date | null }>;
  timing?: PayoutSettings;
};

const pct = (bps: number | null | undefined) => (bps == null ? "–" : `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`);
const usd0 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Per-channel Birch override (Randy voice Nov 21 2026 2:45 PM): brokerage = the default override above; Scale direct and internal have their own dated rates. */
function channelRatesHtml(v: AdminView, g: { overrideBps: number; hubBps: number } | null): string {
  const now = Date.now();
  const rows = v.channelRates ?? [];
  const cur = (ch: "scale_direct" | "internal") => overrideFor(ch, 0, rows, now);
  const ex = (ov: number) => {
    if (!g) return "";
    const e = workedExample(ov, g.hubBps, []);
    return `${usd0(e.gross)} → override ${usd0(e.override)} · net ${usd0(e.net)} · hub ${usd0(e.hub)} · retained ${usd0(e.retained)}`;
  };
  const pct = (b: number) => `${(b / 100).toFixed(b % 100 ? 2 : 0)}%`;
  const hist = rows.slice(0, 12).map((r) => `<tr><td>${esc(CHANNEL_LABEL[r.channel])}</td><td class="n">${pct(r.overrideBps)}</td><td>${fmtDateTime(r.effectiveAt)}</td><td class="fine">${esc(r.actor ?? "")}${r.note ? ` · ${esc(r.note)}` : ""}</td></tr>`).join("");
  return `<h3>Birch override by sales channel</h3><p class="fine">Picked per campaign when each charge is made: <b>internal</b> flag first, then who sold it. Dated; never retroactive.</p>
<div class="tw"><table><thead><tr><th>Channel</th><th>When</th><th class="n">Birch override now</th><th>On $1,000 collected (hub ${g ? pct(g.hubBps) : "–"} of net)</th></tr></thead><tbody>
<tr><td>${CHANNEL_LABEL.brokerage}</td><td class="fine">Sold through Birch Reserve (seller Birch)</td><td class="n">${g ? pct(g.overrideBps) : "–"} <span class="fine">(default above; per hub below)</span></td><td class="fine">${g ? ex(g.overrideBps) : ""}</td></tr>
<tr><td>${CHANNEL_LABEL.scale_direct}</td><td class="fine">Sold organically off the Scale Health site (seller Scale)</td><td class="n">${pct(cur("scale_direct"))}</td><td class="fine">${ex(cur("scale_direct"))}</td></tr>
<tr><td>${CHANNEL_LABEL.internal}</td><td class="fine">Birch runs it internally as cost accounting (campaign flag)</td><td class="n">${pct(cur("internal"))}</td><td class="fine">${ex(cur("internal"))}</td></tr>
</tbody></table></div>
<details class="ed"><summary>Edit a channel rate</summary><form class="f" data-post="/ads/admin/payout/channel-rates" data-reload data-hub-pct="${g ? g.hubBps / 100 : ""}"><div class="row"><label>Channel<select name="channel"><option value="scale_direct">${CHANNEL_LABEL.scale_direct}</option><option value="internal">${CHANNEL_LABEL.internal}</option></select></label><label>Birch override % of gross<input name="overridePct" type="number" min="0" max="100" step="0.01" required placeholder="${CHANNEL_DEFAULT_BPS.scale_direct / 100}"></label><label>Effective from (blank = now)<input type="date" name="effective"></label><label>Note<input name="note" maxlength="300"></label></div><button class="ghost sm" type="submit">Save channel rate</button> <span class="fine">Brokerage uses the default Birch override above.</span></form></details>
${hist ? `<details><summary class="fine">Channel rate history</summary><div class="tw"><table><thead><tr><th>Channel</th><th class="n">Override</th><th>Effective</th><th>By</th></tr></thead><tbody>${hist}</tbody></table></div></details>` : ""}`;
}

function payoutSettingsHtml(v: AdminView, partners: string[]): string {
  const now = Date.now();
  const rates = v.rates ?? [];
  const rec = v.recipients ?? [];
  const g = ratesAt(rates, "\u0000default", now);
  const cur = recipientsAt(rec, now);
  const activeGlobal = cur.filter((r) => r.active && !r.scopePartner && !r.scopeCampaign);
  const ex = g ? workedExample(g.overrideBps, g.hubBps, activeGlobal) : null;
  const t = v.timing ?? { cadence: "monthly", netDays: 30 };
  const opts = (sel: string | null) => [`<option value="">All hubs</option>`, ...partners.map((p) => `<option value="${esc(p)}"${p === sel ? " selected" : ""}>${esc(p)}</option>`)].join("");
  const hubRows = partners.map((p) => {
    const r = ratesAt(rates, p, now);
    const own = rates.filter((x) => x.partner === p && x.effectiveAt.getTime() <= now).sort((a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime())[0];
    const gt = v.gates?.get(p);
    const ok = gatePassed(gt);
    return `<tr><td><b>${esc(p)}</b></td><td class="n">${pct(r?.overrideBps)}${own?.overrideBps != null ? " (hub)" : ""}</td><td class="n">${pct(r?.hubBps)}${own?.hubBps != null ? " (hub)" : ""}</td><td class="fine">${(r?.tiers ?? []).map((x) => `${usd0(x.fromMicros / 1e6)}+ → ${pct(x.hubBps)}`).join("<br>") || "none"}</td>
<td><span class="chip ${ok ? "c-active" : "c-pending"}">${ok ? (gt?.override ? "released (override)" : "payouts open") : "held: not activated"}</span><div class="fine">${gt ? `${gt.live ? "✓" : "✗"} live · ${gt.hasTransactions ? "✓" : "✗"} transactions · ${gt.audienceActivated ? "✓" : "✗"} audience${gt.note ? ` · ${esc(gt.note)}` : ""}` : "✗ live · ✗ transactions · ✗ audience"}</div></td>
<td><details class="ed"><summary>Edit</summary><form class="f" data-post="/ads/admin/payout/gates" data-reload><input type="hidden" name="partner" value="${esc(p)}"><div class="checks"><label><input type="checkbox" name="live"${gt?.live ? " checked" : ""}> Hub live</label><label><input type="checkbox" name="hasTransactions"${gt?.hasTransactions ? " checked" : ""}> Has transactions</label><label><input type="checkbox" name="audienceActivated"${gt?.audienceActivated ? " checked" : ""}> Own customer audience activated</label><label><input type="checkbox" name="override"${gt?.override ? " checked" : ""}> Manual override (release now)</label></div><label>Note (required for override)<input name="note" maxlength="300" value="${esc(gt?.note ?? "")}"></label><button class="ghost sm" type="submit">Save gate</button></form>
<form class="f" data-post="/ads/admin/payout/rates" data-reload style="margin-top:8px"><input type="hidden" name="partner" value="${esc(p)}"><div class="row"><label>Override % (blank = default)<input name="overridePct" type="number" min="0" max="100" step="0.01" value="${own?.overrideBps != null ? own.overrideBps / 100 : ""}"></label><label>Hub % of net (blank = default)<input name="hubPct" type="number" min="0" max="100" step="0.01" value="${own?.hubBps != null ? own.hubBps / 100 : ""}"></label><label>Volume tiers (monthly USD gross : hub %)<input name="tiers" placeholder="10000:40, 25000:50" value="${esc((own?.tiers ?? []).map((x) => `${x.fromMicros / 1e6}:${x.hubBps / 100}`).join(", "))}"></label><label>Effective from<input type="date" name="effective"></label></div><button class="ghost sm" type="submit">Save hub rates</button></form></details></td></tr>`;
  });
  const recRows = cur.sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<tr><td><b>${esc(r.name)}</b><div class="fine"><code>${esc(r.rkey)}</code></div></td><td>${esc(r.kind)}</td><td class="n">${pct(r.pctBps)}</td><td class="fine">${r.scopeReferrer ? `referral orders by <b>${esc(r.scopeReferrer)}</b>` : `${esc(r.scopePartner ?? "all hubs")}<br>${esc(r.scopeCampaign ? r.scopeCampaign.slice(0, 8) : "all campaigns")}`}</td><td><span class="chip ${r.active ? "c-active" : "c-paused"}">${r.active ? "active" : "off"}</span></td><td class="fine">${esc(r.payoutRef ?? "")}</td><td class="fine">since ${fmtDateTime(r.effectiveAt)}</td>
<td><details class="ed"><summary>Edit</summary>${recipientForm(r, opts(r.scopePartner), v.referrers)}${r.rkey.startsWith("qa-") ? `<form data-post="/ads/admin/payout/recipients/${esc(r.rkey)}/purge" data-reload><button class="danger sm" type="submit">Delete test recipient</button></form>` : ""}</details></td></tr>`);
  const history = [...rates.map((r) => ({ at: r.effectiveAt, who: r.actor, what: `${r.partner ?? "Default"}: override ${pct(r.overrideBps)} · hub ${pct(r.hubBps)}${r.tiers?.length ? ` · tiers ${r.tiers.map((x) => `${usd0(x.fromMicros / 1e6)}→${pct(x.hubBps)}`).join(", ")}` : ""}${r.note ? ` · ${r.note}` : ""}` })), ...rec.map((r) => ({ at: r.effectiveAt, who: r.actor, what: `${r.name} (${r.kind}): ${pct(r.pctBps)} of pool · ${r.scopePartner ?? "all hubs"} · ${r.active ? "active" : "off"}` }))].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 30);
  return `<section id="payout-settings"><h2>Payout split</h2><p class="fine">Applies to collected revenue as it delivers (charged ad spend; promo credit is free credit and earns nothing). Order: Birch override off the top, then the hub's share of what's left, then Birch/SBG keeps the rest. Each change is dated and only applies from its effective time. Source: ad (transactions can use the same split later).</p>
${ex ? `<div class="card" style="margin:8px 0"><b>Worked example (current default)</b><div class="tw"><table><tbody>
<tr><td>Collected</td><td class="n">${usd0(ex.gross)}</td></tr><tr><td>Birch override (${pct(g!.overrideBps)} of gross)</td><td class="n">${usd0(ex.override)}</td></tr>
${ex.recipients.map((r) => `<tr><td class="fine">↳ ${esc(r.name)}</td><td class="n fine">${usd0(r.amount)}</td></tr>`).join("")}${ex.recipients.length ? `<tr><td class="fine">↳ unallocated, stays with Birch</td><td class="n fine">${usd0(ex.unallocatedOverride)}</td></tr>` : ""}
<tr><td>Net after override</td><td class="n">${usd0(ex.net)}</td></tr><tr><td>Hub royalty (${pct(g!.hubBps)} of net = ${pct(Math.round((g!.hubBps * (10_000 - g!.overrideBps)) / 10_000))} of gross)</td><td class="n">${usd0(ex.hub)}</td></tr>
<tr><td><b>Retained by Birch/SBG</b> (net after hub)</td><td class="n"><b>${usd0(ex.retained)}</b></td></tr></tbody></table></div></div>` : `<p class="warn">No default rate set.</p>`}
<details class="ed"><summary>Edit default rates</summary><form class="f" data-post="/ads/admin/payout/rates" data-reload><div class="row"><label>Default Birch override % of gross<input name="overridePct" type="number" min="0" max="100" step="0.01" required value="${g ? g.overrideBps / 100 : ""}"></label><label>Default hub % of net<input name="hubPct" type="number" min="0" max="100" step="0.01" required value="${g ? g.hubBps / 100 : ""}"></label><label>Effective from (blank = now)<input type="date" name="effective"></label><label>Note<input name="note" maxlength="300"></label></div><button class="ghost sm" type="submit">Save default rates</button></form></details>
${channelRatesHtml(v, g)}
<details class="ed"><summary>Edit payout timing</summary><form class="f" data-post="/ads/admin/payout/timing" data-reload><div class="row"><label>Payout cadence<select name="cadence"><option value="monthly"${t.cadence === "monthly" ? " selected" : ""}>Monthly</option><option value="quarterly"${t.cadence === "quarterly" ? " selected" : ""}>Quarterly</option></select></label><label>Net days after period end<input name="netDays" type="number" min="0" max="120" value="${t.netDays}"></label></div><button class="ghost sm" type="submit">Save payout timing</button> <span class="fine">Now: ${t.cadence}, Net ${t.netDays}.</span></form></details>
<h3>Hubs: rates, tiers and payout gate</h3><p class="fine">No hub or override payout for a hub until it is live, has transactions and has activated its own customer audience. Until then lines accrue as <b>held: not activated</b> and release when the gate passes or you override with a note.</p>
<div class="tw"><table><thead><tr><th>Hub</th><th class="n">Override</th><th class="n">Hub % of net</th><th>Tiers</th><th>Payout gate</th><th></th></tr></thead><tbody>${hubRows.join("")}</tbody></table></div>
<h3>Override pool recipients (brokerage / commission)</h3><p class="fine">Each recipient gets a % of the Birch override pool. The total on any hub or campaign must stay at or under 100%; anything unallocated stays with Birch.</p>
<div class="tw"><table><thead><tr><th>Recipient</th><th>Type</th><th class="n">% of pool</th><th>Scope</th><th>Status</th><th>Payout email / ref</th><th>Effective</th><th></th></tr></thead><tbody>${recRows.join("") || `<tr><td colspan="8" class="muted">No recipients. The whole override stays with Birch.</td></tr>`}</tbody></table></div>
<details class="ed"><summary>Add a recipient</summary>${recipientForm(null, opts(null), v.referrers)}</details>
<details class="ed"><summary>Rate and recipient change history</summary><div class="tw"><table><tbody>${history.map((h) => `<tr><td class="fine">${fmtDateTime(h.at)}</td><td class="fine">${esc(h.who ?? "")}</td><td>${esc(h.what)}</td></tr>`).join("")}</tbody></table></div></details></section>`;
}

function recipientForm(r: RecipientRow | null, scopeOpts: string, referrers: Array<{ id: string; label: string }> = []): string {
  const refSel = `<label>Referrer (referral orders only)<select name="scopeReferrer"><option value="">None (delivery share)</option>${referrers.map((m) => `<option value="${esc(m.id)}"${m.id === r?.scopeReferrer ? " selected" : ""}>${esc(m.label)} (${esc(m.id)})</option>`).join("")}</select></label>`;
  return `<form class="f" data-post="/ads/admin/payout/recipients" data-reload>${r ? `<input type="hidden" name="rkey" value="${esc(r.rkey)}">` : ""}<div class="row"><label>Name<input name="name" required maxlength="120" value="${esc(r?.name ?? "")}"></label><label>Type<select name="kind"><option value="brokerage"${r?.kind !== "commission" ? " selected" : ""}>Brokerage</option><option value="commission"${r?.kind === "commission" ? " selected" : ""}>Commission</option></select></label><label>% of override pool<input name="pct" type="number" min="0" max="100" step="0.01" required value="${r ? r.pctBps / 100 : ""}"></label><label>Hub scope<select name="scopePartner">${scopeOpts}</select></label><label>Campaign scope (id, optional)<input name="scopeCampaign" maxlength="40" value="${esc(r?.scopeCampaign ?? "")}"></label>${refSel}<label>Payout email / reference<input name="payoutRef" maxlength="200" value="${esc(r?.payoutRef ?? "")}"></label><label>Effective from (blank = now)<input type="date" name="effective"></label></div><div class="checks"><label><input type="checkbox" name="active"${!r || r.active ? " checked" : ""}> Active</label></div><button class="ghost sm" type="submit">${r ? "Save new version" : "Add recipient"}</button></form>`;
}

const sel = (name: string, opts: Array<[string, string]>, cur: string) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const hubList = () => [...new Map(AD_SLOTS.map((s) => [s.hub, s] as const)).values()];

function campaignForm(c: Campaign | null): string {
  const v = c;
  return `<div class="row">
${c ? "" : `<label>Customer email<input name="accountEmail" type="email" required></label><label>Brand<input name="brand" required maxlength="160"></label><label>Sold by<select name="seller"><option value="birch">Birch Reserve</option><option value="scale">Scale Health (direct)</option></select></label><label><input type="checkbox" name="internal"> Internal / cost accounting (Birch fee at the internal rate)</label>`}
${c ? `<label>Brand<input name="brand" value="${esc(v!.brand)}" maxlength="160"></label><label>Sold by${sel("seller", [["birch", "Birch Reserve"], ["scale", "Scale Health (direct)"]], v!.seller ?? "birch")}</label><label><input type="checkbox" name="internal"${v!.internal ? " checked" : ""}> Internal / cost accounting</label><input type="hidden" name="internalSet" value="1"><p class="fine">Changing who sold it applies to delivery from now on; past lines keep the channel they were charged under.</p>` : ""}
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

/** Where ads may run (Randy Nov 21 2026 3:42/3:43 PM). Hubs default OFF; only Randy or Jon turn one on. */
function hubServingHtml(v: AdminView): string {
  const hubs = new Map<string, string>();
  for (const s of AD_SLOTS) if (s.kind !== "marketing" && !s.test) hubs.set(s.hub, s.hubName);
  const rows = [...hubs].map(([k, name]) => {
    const st = v.hubServing?.get(k);
    return `<tr><td>${esc(name)} <span class="fine"><code>${esc(k)}</code></span></td><td><span class="chip ${st?.enabled ? "c-active" : "c-pending"}">${st?.enabled ? "ADS ON" : "OFF"}</span>${st ? `<div class="fine">${st.enabled ? "approved by" : "turned off by"} ${esc(st.approvedBy)} (${esc(st.actor)}) · ${fmtDateTime(st.at)}${st.note ? ` · ${esc(st.note)}` : ""}</div>` : ""}</td>
<td><form class="f" data-post="/ads/admin/hubs/${esc(k)}/serving" data-reload style="display:flex;gap:6px">${st?.enabled ? `<input type="hidden" name="enabled" value="">` : `<input type="hidden" name="enabled" value="on"><input name="note" maxlength="300" required placeholder="Randy/Jon approval note">`}<button class="ghost sm" type="submit">${st?.enabled ? "Turn off" : "Turn on"}</button></form></td></tr>`;
  });
  const mk = AD_SLOTS.filter((s) => s.kind === "marketing").map((s) => `<tr><td><code>${esc(s.key)}</code></td><td>${esc(s.label)}</td><td class="fine">${esc(s.hubUrl)}</td></tr>`).join("");
  return `<section id="where"><h2>Where ads run</h2>
<p class="fine">Ads run only on Birch / Scale marketing and intake pages that sell ads. A marketing slot serves only campaigns that name it (never by auto-move); none is embedded on a page yet. <b>Hubs are OFF</b> until Randy or Jon turns one on here (audited, with who approved it). The server refuses every hub slot that is off, including auto-moved campaigns.</p>
<h3>Marketing and intake placements</h3><div class="tw"><table><thead><tr><th>Slot</th><th>Page</th><th>URL</th></tr></thead><tbody>${mk}</tbody></table></div>
<h3>Hubs</h3><div class="tw"><table><thead><tr><th>Hub</th><th>Ads</th><th></th></tr></thead><tbody>${rows.join("")}</tbody></table></div></section>`;
}

export function adminPage(v: AdminView, now = Date.now()): string {
  const live = v.campaigns.filter((x) => x.c.status === "active");
  const drafts = v.campaigns.filter((x) => x.c.status === "draft");
  const rows = v.campaigns.map(({ c, t }) => {
    const st = pacingState(c, now);
    const sp = c.budgetMicros > 0 ? (c.spentMicros / c.budgetMicros) * 100 : 0;
    const fp = flightProgress(c, now) * 100;
    const crs = v.creativesByCampaign.get(c.id) ?? [];
    return `<tr><td><b>${esc(c.brand)}</b>${c.isTest ? ` <span class="chip c-test">Test</span>` : ""}${c.exclusive ? ` <span class="chip c-ahead">Excl.</span>` : ""}<div class="fine">${esc(c.accountEmail)}<br>${c.internal ? "Internal" : c.seller === "scale" ? "Scale direct" : "Birch"} · ${esc(c.orderKind ?? "manual")} · ${esc(c.id.slice(0, 8))}${c.referrer ? `<br>Referred by <b>${esc(c.referrer)}</b>${c.referrerQr ? ` (QR ${esc(c.referrerQr)})` : ""}${c.referrerSite === "scale" ? " · Scale mirror" : ""}` : ""}</div></td>
<td><span class="chip c-${esc(c.status)}">${esc(c.status)}</span><br><span class="chip c-${esc(st)}" style="margin-top:4px">${esc(st.replace("_", " "))}</span></td>
<td>${esc(placementLabel(c.primaryPlacement))}<div class="fine">${c.pricing.toUpperCase()}${c.allowSubstitute ? " · auto-move on" : ""}${c.rateMultiplierBps !== 10000 ? ` · ${c.rateMultiplierBps / 100}% of card` : ""}<br>${c.hubs.length ? esc(c.hubs.join(", ")) : "all live hubs"}</div></td>
<td class="n">${fmtMoney(c.budgetMicros, c.currency)}<div class="fine">spent ${fmtMoney(c.spentMicros, c.currency)}</div><div class="bar" style="min-width:120px"><i style="width:${sp.toFixed(1)}%"></i>${c.flightStart ? `<em style="left:${fp.toFixed(1)}%"></em>` : ""}</div></td>
<td class="fine">${fmtDate(c.flightStart)}<br>${fmtDate(c.flightEnd)}</td>
<td class="n">${fmtInt(t.views)}<div class="fine">${fmtInt(t.clicks)} clk · ${fmtPct(t.clicks, t.views)}<br>${fmtInt(t.convs)} conv</div></td>
<td class="fine">${crs.length ? crs.map((x) => `<span class="chip c-${esc(x.status)}">${esc(x.status)}</span>`).join(" ") : "none"}</td>
<td style="min-width:120px"><details class="ed"><summary>Edit</summary><form class="f" data-post="/ads/admin/campaigns/${esc(c.id)}" data-reload>${campaignForm(c)}<button type="submit">Save</button></form>
<form class="f" data-post="/ads/admin/campaigns/${esc(c.id)}/budget" data-reload style="margin-top:8px"><div class="row"><label>Top up / adjust (±, ${c.currency.toUpperCase()})<input name="delta" type="number" step="0.01" required></label><label>Ledger note<input name="note" required maxlength="200" placeholder="IO #, top-up, refund"></label></div><button class="ghost sm" type="submit">Post to ledger</button></form>
<form class="f" data-creative-upload="/ads/admin/creatives?campaign=${esc(c.id)}" data-variant-base="/ads/admin/creatives/" style="margin-top:8px">${creativeFields()}<label style="display:flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" name="approve"> Approve now (stills; videos wait for the poster)</label><label style="display:flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" name="force"> Allow a size outside the specs</label><button class="ghost sm" type="submit">Upload</button><a class="fine" href="/ads/specs" target="_blank">Specs</a></form>
<form data-post="/ads/admin/campaigns/${esc(c.id)}/login-link" style="margin-top:8px"><button class="ghost sm" type="submit">Copy customer dashboard link</button><pre data-out style="display:none;white-space:pre-wrap;word-break:break-all"></pre></form>
${v.friday ? `<form data-post="/ads/admin/friday-sync?campaign=${esc(c.id)}" style="margin-top:6px"><button class="ghost sm" type="submit">Push summary to Friday</button></form>` : ""}
${c.isTest ? `<form data-post="/ads/admin/campaigns/${esc(c.id)}/purge" data-reload style="margin-top:6px"><button class="danger sm" type="submit">Delete test campaign + its data</button></form>` : ""}</details></td></tr>`;
  });
  const pending = v.pending.map((x) => {
    const vs = x.variants ?? [];
    const poster = vs.find((y) => y.role === "poster");
    const fmt = findFormat(x.format);
    const preview = x.kind === "video"
      ? `<video src="/v1/ads/cr/${esc(x.id)}" ${poster ? `poster="/v1/ads/crv/${esc(poster.id)}"` : ""} muted loop playsinline controls preload="metadata" style="max-width:100%;border-radius:10px;border:1px solid #eee;background:#071A39"></video>`
      : `<img src="/v1/ads/cr/${esc(x.id)}?preview=1" alt="${esc(x.alt)}" style="max-width:100%;border-radius:10px;border:1px solid #eee">`;
    return `<div class="card" style="display:grid;gap:8px">${preview}
<div><b>${esc(x.brand)}</b> <span class="chip ${fmt ? "c-approved" : "c-pending"}">${esc(fmt ? fmt.label : "no format match")}</span> <span class="fine">${x.kind === "video" ? `video ${((x.durationMs ?? 0) / 1000).toFixed(1)}s · ` : ""}${x.width}×${x.height} · ${fmtInt(x.bytes / 1024)} KB · ${esc(x.mime)} · ${esc(x.uploadedBy ?? "")}</span>
<div class="fine">Alt: ${esc(x.alt || "–")}${x.headline ? ` · Headline: ${esc(x.headline)}` : ""}${x.cta ? ` · Button: ${esc(x.cta)}` : ""}</div>
<div class="fine">Variants: ${vs.filter((y) => y.role !== "poster").map((y) => `${esc(y.role)} ${y.width}px`).join(", ") || "none"}${x.kind === "video" ? ` · Poster: ${poster ? "yes" : "<b>missing (add one before approving)</b>"}` : ""}</div>
${x.warnings?.length ? `<div class="fine">⚠ ${x.warnings.map(esc).join(" · ")}</div>` : ""}</div>
${x.kind === "video" && !poster ? `<form class="f" data-post="/ads/admin/creatives/${esc(x.id)}/variant?role=poster" data-reload><label>Poster frame (JPG/WebP/PNG, same shape)<input type="file" name="file" accept="image/jpeg,image/webp,image/png" required></label><button class="ghost sm" type="submit">Add poster</button></form>` : ""}
<form class="f" data-post="/ads/admin/creatives/${esc(x.id)}/alt" data-reload style="display:flex;gap:6px;margin:6px 0"><input name="alt" maxlength="200" value="${esc(x.alt ?? "")}" aria-label="Alt text"><button class="ghost sm" type="submit">Save alt</button></form>
<div style="display:flex;gap:8px"><form data-post="/ads/admin/creatives/${esc(x.id)}/status?to=approved" data-reload><button class="sm" type="submit">Approve</button></form><form data-post="/ads/admin/creatives/${esc(x.id)}/status?to=rejected" data-reload style="display:flex;gap:6px"><input name="reason" required maxlength="300" placeholder="Reason (the buyer sees this)"><button class="ghost sm" type="submit">Reject</button></form></div></div>`;
  });
  const slotRows = [...AD_SLOTS].sort((a, b) => Number(b.live) - Number(a.live)).map((s) => {
    const t = v.slotTotals.get(s.key);
    return `<tr><td>${esc(s.hubName)}</td><td>${esc(placementLabel(s.placement))}<div class="fine"><code>${esc(s.key)}</code></div></td><td><span class="chip ${s.live ? "c-active" : "c-pending"}">${s.live ? "live" : "not live"}</span></td><td class="n">$${s.cpmUsd.toFixed(2)}</td><td class="n">$${s.cpcUsd.toFixed(2)}</td><td class="n">${fmtInt(t?.serves ?? 0)}</td><td class="n">${fmtInt(t?.views ?? 0)}</td><td class="n">${fmtInt(t?.clicks ?? 0)}</td><td class="n">${fmtPct(t?.clicks ?? 0, t?.views ?? 0)}</td></tr>`;
  });
  const partners = [...new Set(AD_SLOTS.map((s) => s.partner))];
  const royRow = (r: RoyaltyRow, test = false) => `<tr><td>${esc(r.label)}${test ? ` <span class="chip c-test">test</span>` : ""}<div class="fine">${esc(r.kind)}${r.kind !== "hub" ? ` · on ${esc(r.hub)}` : ""}${r.payoutRef ? ` · ${esc(r.payoutRef)}` : ""}</div></td><td>${esc(r.month)}<div class="fine">due ${r.dueAt ? fmtDate(r.dueAt) : "–"}</div></td><td class="n">${fmtMoney(r.grossMicros, r.currency)}<div class="fine">${r.kind === "hub" ? "delivered" : "pool basis"}</div></td><td class="n">${r.shareBps === null ? `<span class="chip c-pending">pending rate</span>` : `${(r.shareBps / 100).toFixed(2)}%${r.kind === "hub" ? " of net" : " of pool"}`}${r.overrideNote ? `<div class="fine">override ${esc(r.overrideNote)}</div>` : ""}</td><td class="n">${r.payableMicros === null ? "–" : fmtMoney(r.payableMicros, r.currency)}</td>
<td><span class="chip c-${r.status === "held" ? "pending" : r.status}">${r.status === "held" ? "held: not activated" : r.status === "approved" && r.batchId ? "batched" : r.status}</span>${r.batchId ? `<div class="fine">${esc(r.batchId)}</div>` : ""}${r.approvedBy ? `<div class="fine">${esc(r.approvedBy)} · ${fmtDateTime(r.approvedAt)}</div>` : ""}${r.paidRef ? `<div class="fine">paid · ${esc(r.paidRef)} · ${fmtDateTime(r.paidAt ?? null)}</div>` : ""}</td>
<td>${test ? `<div class="fine">Test hub: never in the real Pay batch or exports</div>` : ""}${r.status === "calculated" && r.shareBps !== null ? `<form data-post="/ads/admin/payouts/approve" data-reload><input type="hidden" name="partner" value="${esc(r.partner)}"><input type="hidden" name="month" value="${esc(r.month)}"><input type="hidden" name="currency" value="${esc(r.currency)}"><button class="sm" type="submit">Approve</button></form>` : r.status === "approved" ? `<form data-post="/ads/admin/payouts/paid" data-reload style="display:flex;gap:6px"><input type="hidden" name="partner" value="${esc(r.partner)}"><input type="hidden" name="month" value="${esc(r.month)}"><input type="hidden" name="currency" value="${esc(r.currency)}"><input name="ref" required maxlength="120" placeholder="e-transfer / Stripe ref"><button class="ghost sm" type="submit">Mark paid</button></form>` : ""}</td></tr>`;
  const roy = v.royalties.map((r) => royRow(r));
  const sumRow = (m: MonthSummary, test = false) => `<tr><td>${esc(m.month)}${test ? ` <span class="chip c-test">test</span>` : ""}</td><td class="n">${fmtMoney(m.grossMicros, m.currency)}</td><td class="n">${fmtMoney(m.overrideMicros, m.currency)}</td><td class="n">${fmtMoney(m.recipientsMicros, m.currency)}</td><td class="n">${fmtMoney(m.hubMicros, m.currency)}</td><td class="n"><b>${fmtMoney(m.retainedMicros, m.currency)}</b></td><td class="n">${m.pendingMicros ? fmtMoney(m.pendingMicros, m.currency) : "–"}</td></tr>`;
  const sums = [...(v.summary ?? []).map((m) => sumRow(m)), ...(v.testSummary ?? []).map((m) => sumRow(m, true))];
  const testRoy = (v.testRoyalties ?? []).map((r) => royRow(r, true));
  const hubRows = (v.hubs ?? []).map((h) => `<tr><td><b>${esc(h.name)}</b>${h.isTest ? ` <span class="chip c-test">test</span>` : ""}<div class="fine"><code>${esc(h.key)}</code> · ${esc(h.category)}</div></td><td class="fine"><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.url)}</a></td><td>${esc(h.partner)}<div class="fine">rate: ${v.shares.get(h.partner) != null ? `${(v.shares.get(h.partner)! / 100).toFixed(2)}%` : "pending rate"}</div></td><td class="fine">${esc(h.contractRef)}<br>${esc(h.createdBy ?? "")} · ${fmtDate(h.createdAt)}</td><td><span class="chip ${h.status === "live" ? "c-active" : "c-paused"}">${esc(h.status)}</span></td>
<td><form data-post="/ads/admin/hubs/${esc(h.key)}/status?to=${h.status === "live" ? "paused" : "live"}" data-reload style="display:inline"><button class="ghost sm" type="submit">${h.status === "live" ? "Pause" : "Set live"}</button></form>${h.isTest ? ` <form data-post="/ads/admin/hubs/${esc(h.key)}/purge" data-reload style="display:inline"><button class="danger sm" type="submit">Delete test hub</button></form>` : ""}</td></tr>`);
  const led = v.ledger.slice(0, 300).map((l) => `<tr><td class="fine">${fmtDateTime(l.at)}</td><td>${esc(l.kind)}${l.isTest ? ` <span class="chip c-test">test</span>` : ""}</td><td class="fine">${esc(l.campaignId.slice(0, 8))}</td><td class="fine">${esc(l.slotKey ?? "")}</td><td class="n">${l.units || ""}</td><td class="n">${fmtMoney(l.amountMicros, l.currency)}</td><td class="fine">${esc(l.note ?? "")} · ${esc(l.actor ?? "")}</td></tr>`);
  const catCount = new Map<string, number>();
  for (const a of v.alerts) for (const c of a.categories) catCount.set(c, (catCount.get(c) ?? 0) + 1);
  const body = `<div class="ck-head"><h1>Ad system</h1><p class="fine">${esc(v.who)} · real, bot-filtered events only · store <code>${esc(v.schema)}</code> · updated ${fmtDateTime(new Date())}</p></div>
<section id="overview" class="ck-kpis"><div class="grid k"><div class="card kpi"><span>Live campaigns</span><b>${live.length}</b><small>${drafts.length} paid draft${drafts.length === 1 ? "" : "s"} waiting</small></div>
<div class="card kpi"><span>Creatives to review</span><b>${v.pending.length}</b><small><a href="#creatives">Review queue</a></small></div>
<div class="card kpi"><span>Viewable · 24h</span><b>${fmtInt(v.day.views)}</b><small>${fmtInt(v.day.serves)} served</small></div>
<div class="card kpi"><span>Clicks · 24h</span><b>${fmtInt(v.day.clicks)}</b><small>CTR ${fmtPct(v.day.clicks, v.day.views)}</small></div>
<div class="card kpi"><span>Conversions · 24h</span><b>${fmtInt(v.day.convs)}</b><small>pixel + postback</small></div></div></section>
<section id="campaigns"><h2>Campaigns</h2><p class="fine">Paid checkouts open a draft automatically. To go live: approve a creative, set the flight (after the IO is signed), set the landing URL, then set status Active. Pacing is even across the flight, charged at each slot's card rate, and never past budget.</p>
<div class="tw"><table><thead><tr><th>Campaign</th><th>Status</th><th>Placement</th><th class="n">Budget</th><th>Flight</th><th class="n">Delivery</th><th>Creatives</th><th></th></tr></thead><tbody>${rows.join("") || `<tr><td colspan="8" class="muted">No campaigns yet.</td></tr>`}</tbody></table></div>
<details class="ed"><summary>Customer dashboard link</summary><form data-post="/ads/admin/account-link" class="f"><div class="row"><label>Customer dashboard link by email (promo-only buyers)<input name="email" type="email" required></label></div><button class="ghost sm" type="submit">Copy dashboard link</button><pre data-out style="display:none;white-space:pre-wrap;word-break:break-all"></pre></form></details>
<details class="ed"><summary>New campaign (manual or from an IO)</summary><form class="f" data-post="/ads/admin/campaigns" data-reload>${campaignForm(null)}<button type="submit">Create draft</button></form></details></section>
<section id="creatives"><h2>Creative approval</h2>${pending.length ? `<div class="grid two">${pending.join("")}</div>` : `<p class="empty">Nothing waiting for review.</p>`}</section>
${hubServingHtml(v)}
<section id="onboard"><h2>Hubs on contract</h2><p class="fine">When a hub signs, add it here with the contract reference. Its ${PLACEMENTS.length} placements become sellable at card rates right away (serving still needs a paid, approved, active campaign). Same key as a queued kit hub (e.g. <code>jack-health</code>) switches that hub live. The royalty rate stays <b>pending rate</b> until set below from the contract.</p>
<div class="tw"><table><thead><tr><th>Hub</th><th>URL</th><th>Royalty partner</th><th>Contract</th><th>Status</th><th></th></tr></thead><tbody>${hubRows.join("") || `<tr><td colspan="6" class="muted">No hubs onboarded on contract yet. Kit hubs below are built in.</td></tr>`}</tbody></table></div>
<details class="ed"><summary>Onboard a hub on contract</summary><form class="f" data-post="/ads/admin/hubs" data-reload><div class="row"><label>Key (lowercase, e.g. calm-joints)<input name="key" required pattern="[a-z0-9][a-z0-9-]{1,40}"></label><label>Hub name<input name="name" required maxlength="80"></label><label>Audience category<input name="category" required maxlength="80"></label><label>Hub URL<input name="url" type="url" required></label><label>Royalty partner (defaults to hub name)<input name="partner" maxlength="120"></label><label>Contract reference (signed agreement, date)<input name="contractRef" required maxlength="160"></label></div>
<div class="checks"><label><input type="checkbox" name="isTest"> TEST hub (QA only; serves test campaigns on test requests, never real buyers)</label></div><button type="submit">Add hub and open its placements</button></form></details></section>
<section id="inventory"><h2>Slot inventory</h2><p class="fine">Rates are the public starter (starting-at) card. Last 30 days. Embed a slot with <code>&lt;div data-br-slot="KEY"&gt;house card&lt;/div&gt;</code>; see <a href="/ads/docs">docs</a>.</p>
<div class="tw"><table><thead><tr><th>Hub</th><th>Placement</th><th>Status</th><th class="n">CPM</th><th class="n">CPC</th><th class="n">Served</th><th class="n">Viewable</th><th class="n">Clicks</th><th class="n">CTR</th></tr></thead><tbody>${slotRows.join("")}</tbody></table></div></section>
${payoutSettingsHtml(v, partners)}
<section id="royalties"><h2>Royalty statements</h2><p class="fine">Per hub partner and month, from delivered (charged) spend on that partner's slots, test campaigns excluded. Approving freezes the statement. <b>Nothing pays out from here.</b> Payment is sent by Randy outside this system.</p>

<div class="tw"><table><thead><tr><th>Month</th><th class="n">Collected (delivered)</th><th class="n">Birch override</th><th class="n">To recipients</th><th class="n">To hubs</th><th class="n">Retained (net after hubs)</th><th class="n">Pending rate</th></tr></thead><tbody>${sums.join("") || `<tr><td colspan="7" class="muted">No collected delivery yet.</td></tr>`}</tbody></table></div>
<div class="tw"><table><thead><tr><th>Payee</th><th>Month</th><th class="n">Basis</th><th class="n">Rate</th><th class="n">Payable</th><th>Status</th><th></th></tr></thead><tbody>${roy.join("") || `<tr><td colspan="7" class="muted">No delivered spend yet.</td></tr>`}${testRoy.join("")}</tbody></table></div>
<p class="fine">Payouts are manual and nothing moves without your click. No Stripe connected accounts exist yet, so <b>Pay</b> builds a batch of approved lines with a Stripe-ready CSV; pay each line, then <b>Mark paid</b> with the reference. <a href="/ads/admin/export/payouts.csv">Payout CSV</a> lists every approved and paid line.</p>
<form data-post="/ads/admin/payouts/batch"><button class="sm" type="submit">Pay: build payout batch + Stripe-ready CSV</button><pre data-out style="display:none;white-space:pre-wrap;word-break:break-all"></pre></form></section>
${v.referralHtml ?? ""}
${v.partnersHtml ?? ""}
${v.promoHtml ?? ""}
<section id="ledger"><h2>Ledger</h2><p class="fine">Credits, hourly charge lines per slot, and manual adjustments. <a href="/ads/admin/export/ledger.csv">CSV</a></p>
<div class="tw"><table><thead><tr><th>When</th><th>Kind</th><th>Campaign</th><th>Slot</th><th class="n">Units</th><th class="n">Amount</th><th>Note</th></tr></thead><tbody>${led.join("") || `<tr><td colspan="7" class="muted">Empty.</td></tr>`}</tbody></table></div></section>
<section id="orders"><h2>Orders from /buy</h2><p class="fine">Card checkouts (packs, reserves) open draft campaigns automatically; /buy orders are listed here to turn into campaigns once paid.</p>
<div class="tw"><table><thead><tr><th>When</th><th>Company</th><th>Email</th><th>Plan</th><th>Format</th><th>Creative</th></tr></thead><tbody>${v.orders.map((o) => `<tr><td class="fine">${fmtDateTime(o.at)}</td><td>${esc(o.company)}${o.website ? `<div class="fine">${esc(o.website)}</div>` : ""}</td><td class="fine">${esc(o.email)}</td><td>${esc(o.plan)}</td><td>${esc(o.format)}</td><td class="fine">${o.creativeId ? `uploaded${(() => { const m = v.campaigns.filter((x) => x.c.accountEmail === o.email.toLowerCase()); return m.length ? `<form data-post="/ads/admin/orders/${esc(o.id)}/attach" data-reload style="display:flex;gap:6px;margin-top:4px">${sel("campaign", m.map((x) => [x.c.id, `${x.c.brand} · ${x.c.id.slice(0, 8)}`]), m[0]!.c.id)}<button class="ghost sm" type="submit">Send to approval queue</button></form>` : "<br>no paid campaign for this email yet"; })()}` : "–"}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">No /buy orders.</td></tr>`}</tbody></table></div></section>
<section id="alerts"><h2>New-hub alert subscribers</h2><p class="fine">${v.alerts.length} opted in. Alert emails are OFF until Randy previews the template.</p>
<div class="checks">${[...catCount.entries()].map(([c, n]) => `<span class="chip c-approved">${esc(c)}: ${n}</span>`).join(" ") || `<span class="muted">None yet.</span>`}</div></section>
<section id="exports"><h2>Exports</h2><p><a class="btn ghost sm" href="/ads/admin/export/campaigns.csv">Campaigns</a> <a class="btn ghost sm" href="/ads/admin/export/delivery.csv">Daily delivery</a> <a class="btn ghost sm" href="/ads/admin/export/ledger.csv">Ledger</a> <a class="btn ghost sm" href="/ads/admin/export/royalties.csv">Royalties</a> <a class="btn ghost sm" href="/ads/admin/export/payouts.csv">Payouts (manual)</a>
${v.friday ? `<form data-post="/ads/admin/friday-sync" style="display:inline"><button class="ghost sm" type="submit">Push all summaries to Friday</button></form>` : `<span class="fine">Friday push is not configured on this deployment.</span>`}</p></section>
<section id="audit"><h2>Audit log</h2><div class="tw" style="max-height:560px"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>${v.audit.map((a) => `<tr><td class="fine">${fmtDateTime(a.at)}</td><td>${esc(a.actor ?? "")}</td><td>${esc(a.action)}</td><td class="fine">${esc(a.target ?? "")}</td><td class="fine">${esc((a.detail ?? "").slice(0, 160))}</td></tr>`).join("")}</tbody></table></div></section>`;
  const tabs: Array<[string, string]> = [["campaigns", "Campaigns"], ["creatives", `Creatives${v.pending.length ? ` <i>${v.pending.length}</i>` : ""}`], ["inventory", "Inventory"], ["hubs", "Hubs"], ["money", "Money"], ["promo", "Promo"], ["audit", "Audit"]];
  return shell({
    title: "Ads admin · Birch Reserve",
    nav: "Ads admin",
    head: `<style>${COCKPIT_CSS}</style>`,
    right: `<nav class="tabs"><a href="/ads/docs">Docs</a><a href="/ads/specs">Specs</a><form data-post="/ads/admin/logout" style="display:inline"><button class="ghost sm" type="submit">Sign out</button></form></nav>`,
    body: `<div class="cockpit"><aside class="ck-rail"><nav aria-label="Ad system">${tabs.map(([k, l]) => `<a href="#${k}" data-tab="${k}">${l}</a>`).join("")}</nav></aside><div class="ck-pane">${body}</div></div><script>${COCKPIT_JS}</script><script>${CREATIVE_UPLOAD_JS}</script>`,
  });
}

/** Cockpit shell (redesign move 2): left rail on desktop, wrapped tab bar on phones, one group of sections per tab. */
const COCKPIT_CSS = `main.wrap{max-width:1360px}.cockpit{display:grid;grid-template-columns:184px minmax(0,1fr);gap:28px;align-items:start;margin-top:16px}
.ck-rail{position:sticky;top:72px}.ck-rail nav{display:grid;gap:2px}.ck-rail a{display:flex;align-items:center;justify-content:space-between;min-height:40px;padding:0 12px;border-radius:6px;text-decoration:none;color:var(--br-ink-2);font-weight:500}
.ck-rail a:hover{background:#EEECE6;color:var(--br-ink)}.ck-rail a[aria-current=true]{background:var(--br-ink);color:#fff}.ck-rail a i{font-style:normal;font-size:11px;font-weight:700;background:var(--br-accent);color:var(--br-ink);border-radius:999px;padding:1px 7px}
.ck-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px 16px;flex-wrap:wrap}.ck-head h1{margin:0}.ck-head p{margin:0}
.ck-kpis{position:sticky;top:56px;z-index:5;background:var(--br-bg);padding:10px 0;margin:6px 0 4px;border-bottom:1px solid var(--br-line)}.ck-kpis .grid{gap:8px}
.ck-pane>section>h2:first-child{margin-top:18px}html.ck-on .ck-pane>section[data-g]:not(.ck-show){display:none}
@media(max-width:900px){.cockpit{grid-template-columns:1fr;gap:8px}.ck-rail{position:static}.ck-rail nav{display:flex;flex-wrap:wrap;gap:4px}.ck-rail a{flex:1 1 auto;justify-content:center;gap:6px;border:1px solid var(--br-line);background:var(--br-surface)}.ck-kpis{position:static}}
@media(max-width:640px){.ck-kpis .k{grid-template-columns:repeat(2,minmax(0,1fr))}}`;

const COCKPIT_JS = `(function(){var G={overview:"*",campaigns:"campaigns",creatives:"creatives",inventory:"inventory",onboard:"hubs",hubproof:"hubs","payout-settings":"money",royalties:"money",referrals:"money",ledger:"money",orders:"money",exports:"money",promo:"promo",street:"promo",alerts:"promo",audit:"audit"};
var secs=[].slice.call(document.querySelectorAll(".ck-pane>section[id]"));var tabs={};secs.forEach(function(s){var g=G[s.id]||"campaigns";s.setAttribute("data-g",g);tabs[g]=1});
var links=[].slice.call(document.querySelectorAll(".ck-rail a[data-tab]"));
function show(h){var id=(h||"").replace(/^#/,"");var g=tabs[id]?id:(G[id]&&G[id]!=="*"?G[id]:"campaigns");
secs.forEach(function(s){s.classList.toggle("ck-show",s.getAttribute("data-g")==="*"||s.getAttribute("data-g")===g)});
links.forEach(function(a){a.setAttribute("aria-current",a.getAttribute("data-tab")===g?"true":"false")});
var t=document.getElementById(id);if(t&&!tabs[id]&&G[id]!=="*")setTimeout(function(){t.scrollIntoView({block:"start"})},0);else window.scrollTo(0,0)}
document.documentElement.classList.add("ck-on");window.addEventListener("hashchange",function(){show(location.hash)});show(location.hash);})();`;
