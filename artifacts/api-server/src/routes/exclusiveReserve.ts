/**
 * GET  /exclusive and /starter   $1,900 starter placement in the visitor's currency (server-rendered)
 * POST /v1/exclusive/reserve     Stripe Checkout in the currency the page showed (body.currency)
 *
 * Same gate as sponsorship packs (sponsorDepositsOpen): live sessions only when
 * SPONSOR_DEPOSITS_LIVE=true, so a preview with a test key only ever makes test sessions.
 */
import { BUYER_HEADER_CSS, TOKENS_CSS, buyerHeaderHtml } from "../lib/brandTokens";
import { PROMO_SCRIPT_TAG } from "../lib/adserver/promoBoxJs";
import { siteOf, withPromoMetadata, withScaleReturn } from "../lib/adserver/promoContext";
import express, { Router, type IRouter, type Request, type Response } from "express";
import { getStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";
import { sponsorDepositsOpen } from "./sponsorPage";
import { sendIntake } from "../lib/overhaul/fridayIntake";
import { sendSalesAlert, alertSiteOf } from "../lib/salesAlert";
import { hasValidQaHeader, isTestIdentity } from "../lib/testTraffic";
import { TWO_LANE_CATEGORIES } from "../lib/twoLane";
import { EXCLUSIVE_RESERVE, EXCLUSIVE_RESERVE_TERMS, buildExclusiveReserveSession, exclusiveReserveFor } from "../lib/exclusiveReserve";
import { exclusivePacing } from "../lib/inventoryPlan";
import { pageCurrency } from "../lib/currency";
import { PRICE_LADDER_CSS, currencyHref, currencyToggleHtml, priceLadderHtml } from "../lib/priceLadder";
import type { ReserveCurrency } from "../lib/reserveOffers";

const router: IRouter = Router();

const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

type Status = { kind: "success"; ref: string; paid: boolean; livemode: boolean; sid?: string } | { kind: "cancelled" } | null;

function page(open: boolean, status: Status, currency: ReserveCurrency = "cad", query: Record<string, unknown> = {}, path = "/starter"): string {
  const pace = exclusivePacing(currency);
  const X = exclusiveReserveFor(currency);
  const C = currency.toUpperCase();
  // Category pages deep-link with ?category=<label> (buyer-answer pages, Nov 22 2026): preselect it when it is a real option.
  const pre = typeof query.category === "string" ? query.category.replace(/['’]/g, "’").trim().toLowerCase() : "";
  const cats = TWO_LANE_CATEGORIES.map((c) => `<option value="${esc(c.label)}"${pre && c.label.toLowerCase() === pre ? " selected" : ""}>${esc(c.label)}</option>`).join("");
  const banner =
    status?.kind === "success"
      ? `<div class="ok" role="status"><b>${status.paid ? "Payment received." : "Payment is processing."}</b> Your starter placement is recorded${status.livemode ? "" : " (test mode, no real charge)"}. Ref ${esc(status.ref)}. We email your insertion order within 1 business day. Nothing runs until you sign it.${status.paid && status.sid ? ` <a href="/account/login?session_id=${esc(status.sid)}" style="font-weight:700">Open your ad dashboard →</a>` : ""}</div>`
      : status?.kind === "cancelled"
        ? `<div class="note" role="status">Checkout cancelled. No charge was made.</div>`
        : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Starter placement · ${X.label} — Birch Reserve</title>
<meta name="description" content="Dedicated placements from $1,900. ${X.label} holds a $5K–$50K dedicated package in your category pending your insertion order. Refunded if you are bumped by another advertiser before you have finalized payment. Nothing runs before the IO.">
<link rel="canonical" href="https://birchreserve.net/starter">
<meta property="og:type" content="website"><meta property="og:url" content="https://birchreserve.net/starter"><meta property="og:title" content="Starter placement · ${X.label} — Birch Reserve"><meta property="og:description" content="Dedicated placements from $1,900 inside private health and wellness hubs. Nothing runs before a signed insertion order."><meta property="og:image" content="https://birchreserve.net/og-birch-reserve.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Starter placement · ${X.label} — Birch Reserve"><meta name="twitter:description" content="Dedicated placements from $1,900 inside private health and wellness hubs. Nothing runs before a signed insertion order."><meta name="twitter:image" content="https://birchreserve.net/og-birch-reserve.png">
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;background:#F9F8F6;color:#071A39;font:16px/1.6 "IBM Plex Sans",sans-serif}
header,main,footer{max-width:1080px;margin:auto;padding:18px 22px}header{display:flex;justify-content:space-between;gap:12px;align-items:baseline;border-bottom:1px solid #ccd2d8;flex-wrap:wrap}
h1,h2{font-family:Fraunces,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(2rem,5vw,3rem);margin:.3em 0}h2{font-size:1.5rem;margin:1.4em 0 .4em}a{color:#071A39}
.fine{color:#4d5b6a;font-size:.88rem}.ok{background:#BFF3D6;color:#0B6B43;padding:10px 14px;border-radius:8px;margin:12px 0}.note{background:#fff;border:1px solid #ccd2d8;padding:10px 14px;border-radius:8px;margin:12px 0}
.sp-hero{display:grid;gap:28px;margin-top:8px}@media(min-width:900px){.sp-hero{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:56px;align-items:start}.sp-side{position:sticky;top:20px}.jump{display:none!important}}.eb{font-size:.72rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#4d5b6a;margin:28px 0 0}.lede{font-size:1.02rem;color:#33425a;max-width:36rem}.facts{margin:26px 0 0;border-top:1px solid #071A39}.facts>div{display:grid;grid-template-columns:9.5rem minmax(0,1fr);gap:14px;padding:14px 0;border-bottom:1px solid #d9dde2}.facts dt{font-size:.72rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#4d5b6a;padding-top:.35rem}.facts dd{margin:0;color:#33425a;font-size:.95rem}.facts dd b{display:block;font:400 1.55rem/1.15 Fraunces,serif;color:#071A39}@media(max-width:520px){.facts>div{grid-template-columns:1fr;gap:2px}}
.mc{display:inline-block;margin-right:6px;padding:1px 7px;border-radius:999px;background:#FFF4DB;border:1px solid #F1D58F;color:#8A5A00;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;vertical-align:middle}
.cta{display:inline-block;background:#071A39;color:#fff;border-radius:6px;padding:12px 18px;min-height:44px;box-sizing:border-box;font:600 1rem "IBM Plex Sans";text-decoration:none}.steps{list-style:none;margin:22px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0 16px;counter-reset:s}.steps li{font-size:.85rem;color:#4d5b6a;line-height:1.4;border-top:2px solid #071A39;padding-top:8px}.steps b{display:block;color:#071A39}@media(max-width:520px){.steps{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px}}form{display:grid;gap:12px;border:1px solid #071A39;border-radius:4px;padding:22px;background:#fff}form .ft{font:400 1.35rem/1.2 Fraunces,serif;margin:0 0 4px}input,select{width:100%;padding:10px;border:1px solid #b9c1c9;border-radius:8px;font:inherit}
button{background:#071A39;color:#fff;border:0;border-radius:6px;min-height:44px;padding:12px 18px;justify-self:start;font:600 1rem "IBM Plex Sans";cursor:pointer}button:disabled{opacity:.6}
details{border-top:1px solid #ccd2d8;padding:12px 0}summary{cursor:pointer;font-weight:600}ul{padding-left:1.1em}${TOKENS_CSS}${BUYER_HEADER_CSS}${PRICE_LADDER_CSS}</style></head><body>
${buyerHeaderHtml("exclusive", currencyToggleHtml(currency, (c) => currencyHref(path, query, c)))}
<main>${banner}<div data-promo-box="success"></div>
<div class="sp-hero"><div class="sp-main">
<p class="eb">Starter placement · Pay by card</p>
<h1>Starter placement · ${X.label}</h1>
<p class="lede">Dedicated placements from $1,900. Your $1,900 counts in full toward a ${X.packageLabel} package in your category while we write your insertion order (IO). The IO names the hub, placement and dates. If you are bumped by another advertiser before you have finalized payment, we refund the $1,900 in full.</p>
<p><a class="cta jump" href="#f">Start: pay ${X.label} &darr;</a></p>
<dl class="facts">
<div><dt>Today</dt><dd><b>${X.label}</b>by card, counted in full</dd></div>
<div><dt>Package</dt><dd><b>${EXCLUSIVE_RESERVE.packageRange}</b>dedicated package, ${C}</dd></div>
<div><dt>Refund</dt><dd><b>Pending your IO</b>refunded if you are bumped by another advertiser before you have finalized payment</dd></div>
<div><dt>Pacing <span class="mc">Modelled</span></dt><dd><b>${esc(pace.perMonth)}</b>over up to 6 months (${esc(pace.viewsPerMonth)})</dd></div>
</dl>
<ol class="steps"><li><b>1 Pay</b>by card, 4 fields</li><li><b>2 IO</b>we email it within 1 business day</li><li><b>3 Sign</b>and send creative</li><li><b>4 Runs</b>on the dates in the IO</li></ol>
</div><div class="sp-side">
${open ? `<form id="f"><p class="ft">Start your placement</p><label>Brand<input name="brand" required maxlength="160" autocomplete="organization"></label>
<label>Work email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
<label>Category<select name="category" required><option value="">Choose a category</option>${cats}</select></label>
<label class="fine"><input type="checkbox" name="agree" style="width:auto"> I agree to the <a href="/terms#exclusive">placement terms</a>. Nothing runs until I sign an insertion order.</label>
<div data-promo-box></div><input type="hidden" name="currency" value="${currency}"><button id="b" type="submit">Pay ${X.label}</button><p id="m" class="fine" role="status"></p></form>`
    : `<form id="f"><p><b>Card checkout is paused right now.</b> Leave your details and we'll send the insertion order and a payment link within 1 business day.</p><label>Brand<input name="brand" required></label><label>Work email<input name="email" type="email" required></label><label>Category<select name="category"><option value="">Choose a category</option>${cats}</select></label><input type="hidden" name="agree" value="on"><input type="hidden" name="currency" value="${currency}"><button id="b" type="submit">Request this placement</button><p id="m" class="fine" role="status"></p></form>`}
<p class="fine">Card checkout by Stripe, charged in ${C}, the currency shown on this page. Statement shows BIRCHRSV* RESERVE.</p>
</div></div>
${priceLadderHtml(currency, { title: "Where this sits", current: "exclusive" })}
<details><summary>Placement terms</summary><ul>${EXCLUSIVE_RESERVE_TERMS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></details>
<details><summary>How the 6-month spend-down works</summary><p><span class="mc">Modelled</span>A ${esc(pace.credit)} package paced over 6 months is ${esc(pace.perMonth)}, about ${esc(pace.viewsPerMonth)} at today's blended starter CPM. Spend faster if you like. No impression guarantee; reporting is aggregate only.</p></details>
</main><footer class="fine">Silver Birch Growth Inc. · Toronto, Ontario · <a href="mailto:randy@scalehealth.ca">randy@scalehealth.ca</a></footer>
${PROMO_SCRIPT_TAG}
<script>(function(){var f=document.getElementById("f"),b=document.getElementById("b"),m=document.getElementById("m");f.addEventListener("submit",async function(e){e.preventDefault();var d=Object.fromEntries(new FormData(f));var body={brand:d.brand,email:d.email,category:d.category||"",agree:d.agree==="on",currency:d.currency||"${currency}"};if(!body.agree){m.textContent="Please agree to the placement terms.";return}b.disabled=true;m.textContent="Opening secure checkout…";try{var r=await fetch("/v1/exclusive/reserve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});var o=await r.json().catch(function(){return{}});if(o.url){location.assign(o.url);return}if(o.held){m.textContent=o.message;f.querySelectorAll("input,select,button").forEach(function(x){x.disabled=true});return}m.textContent=o.error||"Checkout could not open. Email randy@scalehealth.ca.";b.disabled=false}catch(err){m.textContent="Checkout could not open. No charge was made.";b.disabled=false}})})();</script>
</body></html>`;
}

router.get(["/exclusive", "/exclusive/", "/starter", "/starter/"], async (req: Request, res: Response) => {
  res.set("Cache-Control", "private, no-store");
  let status: Status = null;
  if (req.query.reserve === "cancelled") status = { kind: "cancelled" };
  const sid = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (req.query.reserve === "success" && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) {
    try {
      const s = await getStripeClient().checkout.sessions.retrieve(sid);
      if (s.metadata?.kind === EXCLUSIVE_RESERVE.kind) status = { kind: "success", ref: s.id.slice(-8).toUpperCase(), paid: s.payment_status === "paid", livemode: s.livemode, sid: s.id };
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : String(err) }, "exclusive reserve success lookup failed");
    }
  }
  const cur = pageCurrency(req, res).currency;
  const path = req.path.replace(/\/+$/, "") || "/starter";
  const pagePath = path === "/exclusive" ? "/exclusive" : "/starter";
  res.type("html").send(page(sponsorDepositsOpen(), status, cur, req.query as Record<string, unknown>, pagePath));
});

router.post("/v1/exclusive/reserve", express.json({ limit: "8kb" }), async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (!sponsorDepositsOpen()) {
    const email = typeof b.email === "string" ? b.email.trim().slice(0, 320) : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Add your brand and a work email." });
      return;
    }
    const friday = await sendIntake({ kind: "deposit_interest", email, company: typeof b.brand === "string" ? b.brand.slice(0, 160) : undefined, path: "/exclusive", meta: { tier: exclusiveReserveFor(String(b.currency ?? "").toLowerCase() === "usd" ? "usd" : "cad").sku, category: String(b.category ?? ""), checkout_open: false } }).catch(() => ({ status: "failed" }));
    // Form audit Nov 26 2026: held requests only reached Friday; the team now also gets the internal email.
    await sendSalesAlert({
      via: alertSiteOf(req), event: "inquiry", tag: "BIRCH EXCLUSIVE", title: `Starter placement request (held): ${String(b.brand ?? "").slice(0, 120) || email}`, rows: [["Form", "Starter placement (/exclusive), checkout not open"], ["Brand", String(b.brand ?? "").slice(0, 160)], ["Email", email], ["Category", String(b.category ?? "")], ["Currency", String(b.currency ?? "")]], replyTo: email, isTest: hasValidQaHeader(req) || isTestIdentity({ email, name: String(b.brand ?? "") }) || /\bTEST\b/.test(String(b.brand ?? "")) });
    res.json({ held: true, message: "Got it. We'll send your insertion order and payment link within 1 business day. No charge today.", stored: friday.status });
    return;
  }
  const built = buildExclusiveReserveSession(b, `https://${req.headers.host ?? "birchreserve.net"}`, siteOf(req));
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  try {
    const session = await getStripeClient().checkout.sessions.create(withPromoMetadata(withScaleReturn(req, built.params)) as never);
    // Form audit Nov 26 2026: a $1,900 card checkout that opens and is abandoned never reached the team (only PAID did).
    if (session.livemode) {
      const em = String(b.email ?? "").trim().toLowerCase();
      await sendSalesAlert({
      via: alertSiteOf(req), event: "seat_hold", tag: "BIRCH EXCLUSIVE", title: `Starter placement checkout opened: ${String(b.brand ?? "").slice(0, 120) || em}`, rows: [["Form", "Starter placement (/exclusive)"], ["Brand", String(b.brand ?? "").slice(0, 160)], ["Email", em], ["Category", String(b.category ?? "")], ["Currency", String(b.currency ?? "")], ["Status", "Card checkout opened, not paid yet"]], replyTo: em, isTest: hasValidQaHeader(req) || isTestIdentity({ email: em, name: String(b.brand ?? "") }) || /\bTEST\b/.test(String(b.brand ?? "")) });
    }
    res.json({ url: session.url, livemode: session.livemode });
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "exclusive reserve session failed");
    res.status(502).json({ error: "Checkout could not open. Email randy@scalehealth.ca." });
  }
});

export default router;
