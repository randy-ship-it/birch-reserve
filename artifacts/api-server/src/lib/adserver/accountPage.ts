/** Customer dashboard (/account). Real logged data only: every number is a count or sum of ad_events / ledger rows. */
import { isPromoCampaign, regularRateSummary } from "./config";
import { PROMO_SCRIPT_TAG } from "./promoBoxJs";
import { HUBS } from "../sponsorKit";
import { ALERT_CATEGORIES, adsAlertEmailEnabled, adsLoginEmailEnabled, placementLabel } from "./config";
import { flightProgress, pacingState, type Campaign } from "./engine";
import type { Creative, Totals } from "./store";
import { esc, fmtDate, fmtInt, fmtMoney, fmtPct, shell, sparkline } from "./ui";

export function loginPage(o: { message?: string; error?: string; sent?: boolean } = {}): string {
  const emailOn = adsLoginEmailEnabled();
  return shell({
    title: "Sign in · Your ads · Birch Reserve",
    nav: "Your ads",
    body: `<div style="max-width:560px;margin:48px auto">
<h1>Your ad dashboard</h1>
<p class="lede">See your credit, pacing, viewable impressions, clicks and conversions. Top up when you're ready.</p>
${o.error ? `<p class="warn" role="alert">${esc(o.error)}</p>` : ""}${o.message ? `<p class="ok" role="status">${esc(o.message)}</p>` : ""}
<div class="card"><h3>Just paid?</h3><p>Use the <b>Open your ad dashboard</b> button on your payment confirmation page. It signs you in straight away, no password.</p></div>
<div class="card" style="margin-top:12px"><h3>Sign in with your email</h3>
${emailOn
      ? `<form class="f" data-post="/account/login"><label>Work email<input type="email" name="email" required autocomplete="email" placeholder="you@brand.com"></label><button type="submit">Email me a sign-in link</button></form><p class="fine">The link works once and expires in 24 hours.</p>`
      : `<p>Email sign-in links are switching on shortly. Until then, reply to your Birch Reserve receipt or email <a href="mailto:sales@silverbirchgrowth.com?subject=Ad%20dashboard%20link">sales@silverbirchgrowth.com</a> and we'll send your personal dashboard link.</p>`}
</div></div>`,
  });
}

export type AccountView = {
  email: string;
  campaigns: Array<{ c: Campaign; t: Totals; days: Array<{ day: string; views: number; clicks: number }>; bySlot: Array<{ slot: string; t: Totals }>; creatives: Creative[] }>;
  alerts: { categories: string[]; optedIn: boolean };
  pixel: string;
  postback: string;
  origin: string;
};

const STATE_LABEL: Record<string, string> = { draft: "Getting ready", not_started: "Scheduled", behind: "Live · catching up", on_pace: "Live · on pace", ahead: "Live · ahead", spent: "Fully spent", ended: "Ended", paused: "Paused" };

function campaignCard(v: AccountView["campaigns"][number], now: number): string {
  const { c, t } = v;
  const st = pacingState(c, now);
  const promoCamp = isPromoCampaign(c);
  const spentPct = c.budgetMicros > 0 ? Math.min(100, (c.spentMicros / c.budgetMicros) * 100) : 0;
  const flightPct = flightProgress(c, now) * 100;
  const remaining = Math.max(0, c.budgetMicros - c.spentMicros);
  const approved = v.creatives.some((x) => x.status === "approved");
  const pending = v.creatives.some((x) => x.status === "pending");
  const steps = [
    { done: true, text: promoCamp ? `Free ad credit · ${esc(c.orderKind ?? "promo")}` : `Paid · ${esc(c.orderKind ?? "media credit")}` },
    { done: approved, text: approved ? "Creative approved" : pending ? "Creative uploaded, in review (usually 1 business day)" : "Send your creative (upload below)" },
    { done: Boolean(c.flightStart), text: c.flightStart ? `Flight set: ${fmtDate(c.flightStart)} – ${fmtDate(c.flightEnd)}` : "Insertion order signed and flight dates set (we email the IO)" },
    { done: c.status === "active" || c.status === "completed", text: "Live on the hubs" },
  ];
  const delivery =
    t.views + t.clicks === 0
      ? `<div class="empty"><b>No delivery yet.</b> Numbers appear here as soon as your ad runs. Every figure is counted from real served ads, never estimated.</div>`
      : `<div class="grid k" style="margin:10px 0"><div class="card kpi"><span>Viewable impressions</span><b>${fmtInt(t.views)}</b><small>50% in view for 1s+</small></div>
<div class="card kpi"><span>Clicks</span><b>${fmtInt(t.clicks)}</b><small>CTR ${fmtPct(t.clicks, t.views)}</small></div>
<div class="card kpi"><span>Conversions</span><b>${fmtInt(t.convs)}</b><small>${t.convs > 0 ? `Cost per conversion ${fmtMoney(Math.round(c.spentMicros / t.convs), c.currency)}` : "Add the pixel to track"}</small></div>
<div class="card kpi"><span>Spent</span><b>${fmtMoney(c.spentMicros, c.currency)}</b><small>at rate-card prices</small></div></div>
${sparkline(v.days)}
<div class="tw" style="margin-top:10px"><table><thead><tr><th>Where it ran</th><th class="n">Viewable</th><th class="n">Clicks</th><th class="n">CTR</th><th class="n">Conv.</th><th class="n">Spent</th></tr></thead><tbody>
${v.bySlot.map((r) => `<tr><td>${esc(r.slot)}</td><td class="n">${fmtInt(r.t.views)}</td><td class="n">${fmtInt(r.t.clicks)}</td><td class="n">${fmtPct(r.t.clicks, r.t.views)}</td><td class="n">${fmtInt(r.t.convs)}</td><td class="n">${fmtMoney(r.t.spendMicros, c.currency)}</td></tr>`).join("")}
</tbody></table></div>`;
  return `<article class="card" style="margin-top:14px" id="c-${esc(c.id)}">
<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">${esc(c.brand)}${c.category ? ` <span class="muted" style="font-size:.9rem">· ${esc(c.category)}</span>` : ""}</h3>
<span><span class="chip c-${esc(st)}">${esc(STATE_LABEL[st] ?? st)}</span>${c.isTest ? ` <span class="chip c-test">Test</span>` : ""}${c.exclusive ? ` <span class="chip c-ahead">Exclusive</span>` : ""}${promoCamp ? ` <span class="chip c-approved">Promo credit · regular rates</span>` : ""}</span></div>
${promoCamp ? `<p class="fine" style="margin:6px 0 0">${esc(regularRateSummary().line)} ${esc(regularRateSummary().compare)} Ad spend only, no cash value.</p>` : ""}
<div class="grid two" style="margin-top:8px"><div><div class="fine">Credit used ${fmtMoney(c.spentMicros, c.currency)} of ${fmtMoney(c.budgetMicros, c.currency)} · <b>${fmtMoney(remaining, c.currency)} left</b></div>
<div class="bar" title="Spent ${spentPct.toFixed(0)}% · flight ${flightPct.toFixed(0)}% through"><i style="width:${spentPct.toFixed(1)}%"></i>${c.flightStart ? `<em style="left:${flightPct.toFixed(1)}%"></em>` : ""}</div>
<div class="fine">${c.flightStart ? `Even pacing over ${fmtDate(c.flightStart)} – ${fmtDate(c.flightEnd)}. Green mark = where an even plan would be today.` : "Pacing starts when your flight is set (up to 6 months, or faster)."}</div></div>
<div class="fine">Bought: <b>${esc(placementLabel(c.primaryPlacement))}</b> · ${c.pricing.toUpperCase()}${c.allowSubstitute ? "<br>Can also run on equal-or-lower-rate placements on your hubs, so your credit keeps pacing. Each placement is charged at its own card rate." : ""}${c.rateMultiplierBps !== 10000 ? `<br>Your rate: ${(100 - c.rateMultiplierBps / 100).toFixed(0)}% below card` : ""}</div></div>
<ol class="steps">${steps.map((s, i) => `<li class="${s.done ? "done" : ""}"><b>${s.done ? "✓" : i + 1}</b><span>${s.text}</span></li>`).join("")}</ol>
${delivery}
${approved ? "" : `<details class="ed"${pending ? "" : " open"}><summary>Upload a creative</summary><form class="f" data-post="/account/creative?campaign=${esc(c.id)}" data-reload>
<label>Image (PNG, JPG, WebP or GIF, at least 300px wide, up to 2 MB)<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" required></label>
<label>Alt text (what the image says)<input name="alt" maxlength="200" placeholder="e.g. 20% off recovery bundles"></label><button type="submit">Send for review</button></form>
<p class="fine">Every creative is reviewed by a person before it runs. Sizes that fit most slots: 1200×300, 728×90, 656×280, 600×400, 300×250.</p></details>`}
</article>`;
}

export function dashboardPage(v: AccountView, now = Date.now()): string {
  const all = v.campaigns;
  const cur = all[0]?.c.currency ?? "usd";
  const sameCur = all.filter((x) => x.c.currency === cur);
  const sum = (f: (x: AccountView["campaigns"][number]) => number) => sameCur.reduce((a, x) => a + f(x), 0);
  const remaining = sum((x) => Math.max(0, x.c.budgetMicros - x.c.spentMicros));
  const views = sum((x) => x.t.views);
  const clicks = sum((x) => x.t.clicks);
  const convs = sum((x) => x.t.convs);
  const myCats = new Set(all.map((x) => (x.c.category ?? "").toLowerCase()).filter(Boolean));
  const hubs = HUBS.map((h) => ({ h, live: h.status === "Live inventory", match: [...myCats].some((c) => h.category.toLowerCase().includes(c.split(" ")[0]!)) }));
  const lowCredit = sameCur.some((x) => x.c.status === "active" && x.c.budgetMicros > 0 && x.c.spentMicros / x.c.budgetMicros > 0.75);
  const pixelTag = `<script async src="${v.origin}/ads/px.js" data-pixel="${v.pixel}"></script>
<script>
  window.brpx = window.brpx || function(){ (brpx.q = brpx.q || []).push(arguments) };
  // On your order confirmation page:
  brpx('conversion', { value: 49.99, currency: 'USD', order_id: 'ORDER-123' });
</script>`;
  const postback = `${v.origin}/v1/ads/postback?key=${v.postback}&click_id={br_click}&value={order_total}&currency=USD&order_id={order_id}`;
  const body = `<h1 style="margin-top:28px">Welcome back${all[0] ? `, ${esc(all[0].c.brand)}` : ""}</h1>
<p class="lede">Your Birch Reserve placements in one place. Every number below is counted from real served ads. Aggregate reporting only: we never show or share who saw your ad.</p>
${lowCredit ? `<p class="warn"><b>Your credit is more than 75% used.</b> Top up to keep your placement pacing without a gap. <a href="/sponsor">See packs with bonus credit</a>.</p>` : ""}
${all.length === 0 ? `<div class="empty" style="margin-top:14px"><b>No campaigns on this email yet.</b> If you just paid, your campaign appears within a minute. Start with a <a href="/buy">$190 look or $490 reserve</a>, or prepay a <a href="/sponsor">sponsor pack</a>.</div>` : `
<div class="grid k" style="margin-top:14px"><div class="card kpi"><span>Credit left</span><b>${fmtMoney(remaining, cur)}</b><small>${sameCur.length} campaign${sameCur.length === 1 ? "" : "s"}</small></div>
<div class="card kpi"><span>Viewable impressions</span><b>${fmtInt(views)}</b><small>all time</small></div>
<div class="card kpi"><span>Clicks</span><b>${fmtInt(clicks)}</b><small>CTR ${fmtPct(clicks, views)}</small></div>
<div class="card kpi"><span>Conversions</span><b>${fmtInt(convs)}</b><small>from your pixel or postback</small></div></div>`}
${all.map((x) => campaignCard(x, now)).join("")}
<section id="code"><h2>Promo code</h2><div data-promo-box="account"></div></section>
${PROMO_SCRIPT_TAG}
<section id="more"><h2>Grow your reach</h2>
<div class="grid two"><div class="card"><h3>Top up with a sponsor pack</h3><p>$1,500, $3,000 or $6,000 of credit with 5–15% bonus credit. A paid $190 look or $490 reserve counts in full toward a pack bought within 30 days.</p><a class="btn" href="/sponsor">See sponsor packs</a></div>
<div class="card"><h3>Lock your category</h3><p>$1,900 CAD reserves a $5K–$50K exclusive display package in your category, 25% below the regular rate. Insertion order before anything runs.</p><a class="btn ghost" href="/exclusive">Exclusive reserve</a></div>
<div class="card"><h3>Add another placement</h3><p>Start a new placement on another hub or surface with a $190 look or $490 reserve.</p><a class="btn ghost" href="/buy">Order a placement</a></div></div></section>
<section id="hubs"><h2>Private hubs</h2><p class="fine">Members-only health and wellness hubs. Live hubs take placements now; the rest are being onboarded.</p>
<div class="tw"><table><thead><tr><th>Hub</th><th>Audience</th><th>Status</th></tr></thead><tbody>${hubs.map(({ h, live, match }) => `<tr><td><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.name)}</a>${match ? ` <span class="chip c-approved">Fits your category</span>` : ""}</td><td>${esc(h.category)}</td><td><span class="chip ${live ? "c-active" : "c-pending"}">${live ? "Live" : esc(h.status)}</span></td></tr>`).join("")}</tbody></table></div></section>
<section id="alerts"><h2>New-hub alerts</h2><div class="card"><form class="f" data-post="/account/alerts" data-reload>
<p style="margin:0">Tell me when a new private hub launches with members in these categories:</p>
<div class="checks">${ALERT_CATEGORIES.map((c) => `<label><input type="checkbox" name="categories[]" value="${esc(c)}"${v.alerts.categories.includes(c) ? " checked" : ""}> ${esc(c)}</label>`).join("")}</div>
<label style="display:flex;gap:8px;align-items:center;font-weight:500"><input type="checkbox" name="optedIn"${v.alerts.optedIn ? " checked" : ""}> Yes, email me about new hubs in these categories (about one email per new hub; unsubscribe any time)</label>
<button type="submit">Save my alerts</button>${adsAlertEmailEnabled() ? "" : `<p class="fine">Your choices are saved now. Hub alert emails start once the first alert goes out; new hubs also show in the list above.</p>`}</form></div></section>
<section id="tracking"><h2>Track conversions (CPA)</h2><div class="grid two"><div class="card"><h3>1. Pixel on your thank-you page</h3>
<p class="fine">Your pixel id <code>${esc(v.pixel)}</code>. Paste this on your order confirmation page. It reads the <code>br_click</code> id our ad link adds to your landing URL and sends only that id, the order value and an order reference (hashed on our side). No names, emails or cookies. Visitors with Do Not Track or Global Privacy Control on are never tracked.</p>
<pre id="px">${esc(pixelTag)}</pre><button class="ghost sm" data-copy="#px" type="button">Copy pixel</button></div>
<div class="card"><h3>2. Or a server postback</h3><p class="fine">Store the <code>br_click</code> value from the landing URL with the order, then call this URL from your server when it's paid. Keep the key private.</p>
<pre id="pb">${esc(postback)}</pre><button class="ghost sm" data-copy="#pb" type="button">Copy postback URL</button>
<p class="fine">Attribution: last click within 7 days. Same-site hub carts can also credit a viewable impression within 1 day. <a href="/ads/docs#pixel">Full setup guide</a></p></div></div></section>
<p style="margin-top:20px"><a class="btn ghost sm" href="/account/report.csv">Download daily report (CSV)</a></p>`;
  return shell({
    title: "Your ads · Birch Reserve",
    nav: "Your ads",
    right: `<nav class="tabs"><a href="#more">Top up</a><a href="#hubs">Hubs</a><a href="#alerts">Alerts</a><a href="#tracking">Tracking</a><form data-post="/account/logout" style="display:inline"><button class="ghost sm" type="submit">Sign out ${esc(v.email)}</button></form></nav>`,
    body,
  });
}
