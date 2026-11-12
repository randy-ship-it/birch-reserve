/**
 * Birch Reserve sponsorship page + marketing kit (PREVIEW).
 *
 * GET  /sponsor              prepaid sponsorship credit + SMB activation incentive
 * GET  /kit                  per-hub display inventory and rate card (replaces the creative-brief-only kit)
 * POST /v1/sponsor/deposit   Stripe Checkout for a sponsorship credit deposit
 *
 * Deposits stay off unless SPONSOR_DEPOSITS_ENABLED=true. Even then, a live key
 * is refused unless SPONSOR_DEPOSITS_LIVE=true, so a preview can only ever
 * create test-mode sessions. All impression figures are modelled.
 */
import express, { Router, type IRouter, type Request, type Response } from "express";
import { getStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";
import { sendIntakeAndAlert as sendIntake } from "../lib/overhaul/fridayIntake";
import {
  CUSTOM_MAX,
  CUSTOM_MIN,
  DEPOSIT_TIERS,
  HUBS,
  SLOTS,
  SMB_LADDER,
  TAM_FACTS,
  corePackageUsd,
  money,
  slotPriceUsd,
  sponsorImpressions,
  toCad,
  type Currency,
} from "../lib/sponsorKit";

const router: IRouter = Router();
const SELLER = "Silver Birch Growth Inc. · 777-2255B Queen St E, Toronto ON M4E 1G3";

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function pickCurrency(req: Request): Currency {
  const q = String(req.query.currency ?? "").toLowerCase();
  if (q === "cad" || q === "usd") return q;
  const cookie = /(?:^|;\s*)br_currency=(cad|usd)/i.exec(req.headers.cookie ?? "");
  if (cookie?.[1]) return cookie[1].toLowerCase() as Currency;
  return String(req.headers["x-vercel-ip-country"] ?? "").toUpperCase() === "CA" ? "cad" : "usd";
}

function price(usd: number, currency: Currency): string {
  return money(currency === "cad" ? toCad(usd) : usd, currency);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function shell(title: string, description: string, path: string, currency: Currency, body: string): string {
  const other: Currency = currency === "cad" ? "usd" : "cad";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><meta name="robots" content="noindex,nofollow">
<link rel="canonical" href="https://birchreserve.net${path}" />
<meta property="og:url" content="https://birchreserve.net${path}" /><meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" /><meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="https://birchreserve.net/og-birch-reserve.png" /><meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#f8f6ef;color:#071A39;font:16px/1.6 "IBM Plex Sans",sans-serif}
header,main,footer{max-width:1040px;margin:auto;padding:20px 24px}header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:baseline;border-bottom:1px solid #ccd2d8}
h1,h2,h3{font-family:Fraunces,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(2.1rem,5.5vw,3.3rem);margin:.3em 0}h2{font-size:clamp(1.5rem,3.5vw,2rem);margin:1.6em 0 .4em}
a{color:#071A39}nav{display:flex;flex-wrap:wrap;gap:14px;font-size:.92rem}.fine{color:#4d5b6a;font-size:.88rem}
.draft{background:#071A39;color:#f8f6ef;font-size:.85rem;padding:8px 14px;border-radius:8px;margin:12px 0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:18px 0}
.stat{border:1px solid #ccd2d8;border-radius:12px;padding:14px;background:#fff}.stat b{display:block;font:600 1.7rem Fraunces,serif}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.card{border:1px solid #ccd2d8;border-radius:14px;padding:18px;background:#fff;display:flex;flex-direction:column;gap:6px}
.card .amt{font:600 2rem Fraunces,serif}.card button,.btn{margin-top:auto;background:#071A39;color:#fff;border:0;border-radius:999px;padding:12px 16px;font:600 .95rem "IBM Plex Sans";cursor:pointer;text-decoration:none;text-align:center}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;counter-reset:s;padding:0;list-style:none}
.steps li{border-left:3px solid #071A39;padding:4px 12px}
.tw{overflow-x:auto;border:1px solid #ccd2d8;border-radius:12px;background:#fff}table{border-collapse:collapse;width:100%;font-size:.92rem}
th,td{padding:9px 12px;border-bottom:1px solid #e6e9ec;text-align:left;vertical-align:top}th{font-weight:600;background:#f1efe7}td.n,th.n{text-align:right;white-space:nowrap}
tr.hub td{background:#f6f4ec;font-weight:600}
form.dep{display:grid;gap:10px;max-width:520px;border:1px solid #ccd2d8;border-radius:14px;padding:18px;background:#fff}
form.dep input,form.dep select{width:100%;padding:10px;border:1px solid #b9c1c9;border-radius:8px;font:inherit}
.cur{display:inline-flex;gap:8px;font-size:.88rem}
</style></head><body>
<header><a href="/"><strong>BIRCH RESERVE</strong></a><nav><a href="/sponsor?currency=${currency}">Sponsor</a><a href="/kit?currency=${currency}">Marketing kit</a><a href="/terms">Terms</a><span class="cur">Prices in ${currency.toUpperCase()} · <a href="?currency=${other}">Show ${other.toUpperCase()}</a></span></nav></header>
<main>${body}</main>
<footer class="fine">${esc(SELLER)} · <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a></footer>
</body></html>`;
}

function statsStrip(): string {
  return `<div class="stats">
<div class="stat"><b>${TAM_FACTS.ordersLabel}</b>${esc(TAM_FACTS.ordersNote)}</div>
<div class="stat"><b>${TAM_FACTS.viewsLabel}</b>${esc(TAM_FACTS.viewsNote)}</div>
<div class="stat"><b>${TAM_FACTS.listedPartners}</b>listed partner brands and our clinic hub network</div>
</div>
<p class="fine">Modelled from the network feed at <a href="${TAM_FACTS.source}">scalehealth.ca/tam</a>, read ${TAM_FACTS.readOn}. Listed partners are not yet signed for display. Not audited, not a delivery promise. Nothing runs until an insertion order names the hub.</p>`;
}

function hubPackageTable(currency: Currency): string {
  const rows = HUBS.map((hub) => {
    const core = SLOTS.filter((s) => s.core);
    const imps = core.reduce((acc, s) => acc + sponsorImpressions(hub, s), 0);
    return `<tr><td><a href="${esc(hub.url)}">${esc(hub.name)}</a><div class="fine">${esc(hub.category)}</div></td><td>${esc(hub.status)}</td><td class="n">${fmt(imps)}</td><td class="n">${price(corePackageUsd(hub), currency)}</td></tr>`;
  }).join("");
  return `<div class="tw"><table><thead><tr><th>Hub</th><th>Status</th><th class="n">Modelled impressions / mo</th><th class="n">Core package / mo</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="fine">Core package = thank-you after buy or book, member dashboard tile and hub hero banner, as one of five rotating sponsors (20% share of voice) at 75% availability. Impressions are modelled. Full slot-by-slot pricing is in the <a href="/kit?currency=${currency}">marketing kit</a>.</p>`;
}

function sponsorHtml(currency: Currency): string {
  const tiers = DEPOSIT_TIERS.map((t) => {
    const amount = currency === "cad" ? t.cad : t.usd;
    const credit = Math.round(amount * (1 + t.bonusPct / 100));
    return `<div class="card"><strong>${esc(t.label)}</strong><span class="amt">${money(amount, currency)}</span><span>Becomes ${money(credit, currency)} in sponsorship credit (+${t.bonusPct}%).</span><span class="fine">Spends down on live hubs over 6 months. Unused credit: refund or extend.</span><button type="button" data-tier="${t.key}">Deposit ${money(amount, currency)}</button></div>`;
  }).join("");
  const min = currency === "cad" ? CUSTOM_MIN.cad : CUSTOM_MIN.usd;
  const max = currency === "cad" ? CUSTOM_MAX.cad : CUSTOM_MAX.usd;
  const ladder = SMB_LADDER.map((r) => `<tr><td>${r.customers} activated customers</td><td class="n">$${fmt(r.cashCad)} CAD cash</td><td class="n">$${fmt(r.creditCad)} CAD ad credit</td></tr>`).join("");
  return `<p class="draft">Online payment opens soon. Reserve by inquiry today and we'll confirm within 1 business day.</p>
<h1>Sponsor the hubs now. Run your ads when you're ready.</h1>
<p>Put cash on account today as sponsorship credit. The named hubs are live inventory: your credit spends down on them over the 6 months after it lands, at the published rate card, under an insertion order that names the hubs. Unused credit can be refunded, or extended month by month at the same rate. 3x more inventory is in queue by year end, and we take deposits for it too.</p>
${statsStrip()}
<h2>How a sponsorship works</h2>
<ol class="steps">
<li><strong>Deposit</strong><br>Pick a tier or enter an amount. Stripe hosts the payment. Your balance shows as sponsorship credit.</li>
<li><strong>Pick hubs and slots</strong><br>When you're ready, choose launching partner brand hubs, our clinic hub network, or both.</li>
<li><strong>Sign an insertion order</strong><br>The order names each hub, slot and month. Nothing runs before it.</li>
<li><strong>Draw down</strong><br>Credit comes off at the rate card as your ad runs. You get a monthly statement with your balance.</li>
</ol>
<h2>Deposit tiers</h2>
<div class="cards">${tiers}</div>
<h3>Or choose your own amount</h3>
<form class="dep" id="deposit">
<label>Amount (${currency.toUpperCase()}, ${money(min, currency)} to ${money(max, currency)})<input name="amount" type="number" min="${min}" max="${max}" step="10" value="${min}"></label>
<label>Brand<input name="brand" required maxlength="160"></label>
<label>Work email<input name="email" type="email" required></label>
<label class="fine"><input id="terms" type="checkbox" required style="width:auto;margin-right:8px">I agree to the sponsorship terms below.</label>
<button class="btn" type="submit">Deposit and open my credit</button>
<p id="msg" role="status" class="fine"></p>
</form>
<h2>Where your credit runs</h2>
<p>Live partner brand hubs plus our clinic hub network: physio, mobility, gym and studio members who buy and book through their clinic's hub.</p>
${hubPackageTable(currency)}
<h2>Clinics and studios: get paid to activate your customers</h2>
<p>Open a Clinic Hub at <a href="https://scalehealth.ca/clinichubs">scalehealth.ca/clinichubs</a> and activate your audience: email, text, a link on your website, at checkout and on social media. When they buy or book through your hub, you earn a cash bonus, or a bigger bonus as Birch Reserve ad credit to promote your own business.</p>
<div class="tw"><table><thead><tr><th>Milestone (first 90 days live)</th><th class="n">Cash</th><th class="n">Or ad credit</th></tr></thead><tbody>${ladder}</tbody></table></div>
<p class="fine">Proposal. An activated customer is a unique customer of your business who completes a paid order or booking through your Clinic Hub and does not refund or charge back. The 90-day clock starts once we see real traffic or transactions; bonuses are credited when it ends. Self-purchases (you, your staff or your own accounts) are excluded. One bonus per business per year, top milestone only. Refunded or charged-back orders are reversed. Ad credit has no cash value and expires 12 months after it lands.</p>
<h2>Sponsorship terms</h2>
<ul>
<li>Your deposit is a prepaid credit for Birch Reserve display placements. It is not an impression guarantee and not a fee.</li>
<li>The named hubs are live inventory. Credit spends down over the 6 months after it lands, only for placements that ran under an insertion order naming the hub, slot and month, at the rate card in force when the order is issued.</li>
<li>Bonus credit (+5%, +10% or +15%) is used after your paid credit and has no cash value.</li>
<li>Unused paid credit at the end of the spend-down: take a refund, or extend the spend-down month by month at the same rate. After an insertion order, cancellation and makegoods follow IAB terms.</li>
<li>Reporting is aggregate only. No patient data, no clinical pixels.</li>
</ul>
<p class="fine">Questions: <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a></p>
<script>
(function(){
var cur=${JSON.stringify(currency)};var msg=document.getElementById('msg');var f=document.getElementById('deposit');
function go(body){msg.textContent='Opening secure checkout…';fetch('/v1/sponsor/deposit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})}).then(function(x){if(x.ok&&x.j.url){location.href=x.j.url}else{msg.textContent=x.j.message||x.j.error||'Reserve by inquiry: email sales@silverbirchgrowth.com and we will confirm within 1 business day.'}}).catch(function(){msg.textContent='Network error. Email sales@silverbirchgrowth.com.'})}
function base(){return{currency:cur,brand:f.brand.value,email:f.email.value,agree:document.getElementById('terms').checked}}
document.querySelectorAll('button[data-tier]').forEach(function(b){b.addEventListener('click',function(){var d=base();d.tier=b.getAttribute('data-tier');if(!d.brand||!d.email||!d.agree){msg.textContent='Add your brand, work email and agree to the terms below, then pick a tier.';f.scrollIntoView({behavior:'smooth'});return}go(d)})});
f.addEventListener('submit',function(e){e.preventDefault();var d=base();d.amount=Number(f.amount.value);go(d)});
})();
</script>`;
}

function kitHtml(currency: Currency): string {
  const rows = HUBS.map((hub) => {
    const slotRows = SLOTS.map((s) => `<tr><td>${esc(s.label)}${s.core ? "" : ' <span class="fine">(partner approval per send)</span>'}</td><td class="n">${fmt(sponsorImpressions(hub, s))}</td><td class="n">${price(s.cpmUsd, currency)}</td><td class="n">${price(slotPriceUsd(hub, s), currency)}</td></tr>`).join("");
    return `<tr class="hub"><td colspan="4"><a href="${esc(hub.url)}">${esc(hub.name)}</a> · ${esc(hub.status)} · ${esc(hub.category)} <span class="fine">· basis: ${esc(hub.basis)} · core package ${price(corePackageUsd(hub), currency)}/mo</span></td></tr>${slotRows}`;
  }).join("");
  const slotDefs = SLOTS.map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.where)}</td><td>${esc(s.size)}</td><td class="n">${price(s.cpmUsd, currency)}</td><td class="fine">${esc(s.comp)}</td></tr>`).join("");
  return `<p class="draft">Every impression figure on this page is modelled, not measured.</p>
<h1>Birch Reserve marketing kit</h1>
<p>Display beside the product they already trust: thank-you pages after someone buys or books, member dashboards and hub home pages across launching partner brand hubs and our clinic hub network.</p>
${statsStrip()}
<h2>Placement slots</h2>
<div class="tw"><table><thead><tr><th>Slot</th><th>Where it runs</th><th>Size</th><th class="n">CPM</th><th>Market comp</th></tr></thead><tbody>${slotDefs}</tbody></table></div>
<p class="fine">Comps: retail media onsite display $7–$22 CPM, median about $8.40–$12.50 (CMO Mag Retail Media CPM Benchmark 2026, cmomag.com; Benchmarketing 2026, benchmarketing.org). Post-purchase page revenue $0.25–$0.80 per order (Rokt Thanks, aftersell.com). Health and wellness newsletter sponsorship $40–$100 per 1,000 sends (sponsorships.ai, 2026). Health display $10–$25 CPM (ChannelROIHub).</p>
<h2>Per-hub inventory and pricing</h2>
<div class="tw"><table><thead><tr><th>Slot</th><th class="n">Modelled impressions / mo</th><th class="n">CPM</th><th class="n">Price / mo</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="fine">Per sponsor: one of five rotating positions (20% share of voice) at 75% availability. Hubs without their own feed row use the network median partner until their feed lands. Core package floor is ${price(190, currency)}/mo. Prices draw down from your <a href="/sponsor?currency=${currency}">sponsorship credit</a>.</p>
<h2>Ways to buy</h2>
<ul>
<li>Sponsorship credit: ${DEPOSIT_TIERS.map((t) => `${price(t.usd, currency)} (+${t.bonusPct}% credit)`).join(" · ")} or your own amount. <a href="/sponsor?currency=${currency}">Sponsor</a></li>
<li>7-day category look: ${price(190, currency)} · Lock your category: ${price(490, currency)}. <a href="/buycalc">Calculator</a></li>
<li>Multi-hub or annual programs: book a call at <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a></li>
</ul>
<h2>What to send</h2>
<ul><li>Square still (primary creative) and optional 15-second silent motion</li><li>Destination URL and one brand category</li><li>Contact email for creative and insertion-order follow-up</li></ul>
<p class="fine">Mock placements are illustrative until an insertion order names the hub. Reporting is aggregate only. No patient data, no clinical pixels. <a href="/sample-io">Sample insertion order</a> · <a href="/terms">Terms</a></p>`;
}

router.get(["/sponsor", "/sponsor/"], (req: Request, res: Response) => {
  const currency = pickCurrency(req);
  res.set("Cache-Control", "private, no-cache");
  res.type("html").send(shell("Sponsor the hubs — Birch Reserve", "Sponsorship credit for display across live partner brand hubs and our clinic hub network.", "/sponsor", currency, sponsorHtml(currency)));
});

router.get(["/kit", "/kit/"], (req: Request, res: Response) => {
  const currency = pickCurrency(req);
  res.set("Cache-Control", "private, no-cache");
  res.type("html").send(shell("Marketing kit — Birch Reserve", "Per-hub display inventory, modelled impressions and pricing for Birch Reserve.", "/kit", currency, kitHtml(currency)));
});

export type DepositRequest = { tier?: string; amount?: number; currency?: string; brand?: string; email?: string; agree?: boolean };

/** Pure: validate a deposit request and build Stripe Checkout params. */
export function buildDepositSession(body: DepositRequest, origin: string):
  | { ok: false; error: string }
  | { ok: true; amountCents: number; currency: Currency; params: Record<string, unknown> } {
  const currency: Currency = body.currency === "cad" ? "cad" : "usd";
  const brand = String(body.brand ?? "").trim().slice(0, 160);
  const email = String(body.email ?? "").trim().slice(0, 200);
  if (!brand || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Add your brand and a work email." };
  if (body.agree !== true) return { ok: false, error: "Please agree to the sponsorship terms." };
  let amount: number;
  let bonusPct = 0;
  let tierKey = "custom";
  if (body.tier) {
    const tier = DEPOSIT_TIERS.find((t) => t.key === body.tier);
    if (!tier) return { ok: false, error: "Unknown tier." };
    amount = currency === "cad" ? tier.cad : tier.usd;
    bonusPct = tier.bonusPct;
    tierKey = tier.key;
  } else {
    amount = Math.round(Number(body.amount));
    const min = currency === "cad" ? CUSTOM_MIN.cad : CUSTOM_MIN.usd;
    const max = currency === "cad" ? CUSTOM_MAX.cad : CUSTOM_MAX.usd;
    if (!Number.isFinite(amount) || amount < min || amount > max) return { ok: false, error: `Choose an amount between ${money(min, currency)} and ${money(max, currency)}.` };
  }
  const amountCents = amount * 100;
  const creditCents = Math.round(amountCents * (1 + bonusPct / 100));
  const metadata = {
    kind: "sponsorship_credit",
    tier: tierKey,
    bonus_pct: String(bonusPct),
    credit_cents: String(creditCents),
    brand,
    terms_version: "sponsor-draft-2026-11-12",
  };
  return {
    ok: true,
    amountCents,
    currency,
    params: {
      mode: "payment",
      customer_email: email,
      customer_creation: "always",
      line_items: [{ quantity: 1, price_data: { currency, unit_amount: amountCents, product_data: { name: "Birch Reserve sponsorship credit", description: `Prepaid display credit${bonusPct ? ` (+${bonusPct}% bonus credit)` : ""}. Spends down on live hubs under an insertion order that names the hubs; unused credit refundable or extendable.` } } }],
      metadata,
      payment_intent_data: { description: `Birch Reserve sponsorship credit · ${brand}`, metadata },
      success_url: `${origin}/sponsor?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/sponsor?deposit=cancelled`,
    },
  };
}

router.post("/v1/sponsor/deposit", express.json({ limit: "8kb" }), async (req: Request, res: Response) => {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const enabled = process.env.SPONSOR_DEPOSITS_ENABLED === "true";
  const liveAllowed = process.env.SPONSOR_DEPOSITS_LIVE === "true";
  if (!enabled || !key || (key.startsWith("sk_live_") && !liveAllowed)) {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof b.email === "string" ? b.email.trim().slice(0, 320) : "";
    let stored = "skipped";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const friday = await sendIntake({ kind: "deposit_interest", email, company: typeof b.brand === "string" ? b.brand.slice(0, 160) : undefined, path: "/sponsor", meta: { tier: String(b.tier ?? ""), amount: String(b.amount ?? ""), currency: String(b.currency ?? ""), checkout_open: false } }).catch(() => ({ status: "failed" }));
      stored = friday.status;
    }
    res.status(200).json({ held: true, message: "Reserved by inquiry. We'll confirm within 1 business day. No charge today.", stored });
    return;
  }
  const built = buildDepositSession(req.body ?? {}, `https://${req.headers.host ?? "birchreserve.net"}`);
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  // Every attempt reaches Friday + the instant alert, paid or not.
  {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof b.email === "string" ? b.email.trim().slice(0, 320) : "";
    await sendIntake({ kind: "deposit_interest", email: email || undefined, company: typeof b.brand === "string" ? b.brand.slice(0, 160) : undefined, path: "/sponsor", meta: { tier: String(b.tier ?? ""), amount: built.amountCents / 100, currency: built.currency, checkout_open: true } }).catch(() => undefined);
  }
  try {
    const session = await getStripeClient().checkout.sessions.create(built.params as never);
    res.json({ url: session.url, livemode: session.livemode });
  } catch (err) {
    logger.warn({ err }, "sponsor deposit session failed");
    res.status(502).json({ error: "Checkout could not open. Email sales@silverbirchgrowth.com." });
  }
});

export default router;
