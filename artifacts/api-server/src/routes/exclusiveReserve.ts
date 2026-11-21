/**
 * GET  /exclusive                $1,900 CAD exclusive display reserve (server-rendered)
 * POST /v1/exclusive/reserve     Stripe Checkout (inline CAD price_data)
 *
 * Same gate as sponsorship packs (sponsorDepositsOpen): live sessions only when
 * SPONSOR_DEPOSITS_LIVE=true, so a preview with a test key only ever makes test sessions.
 */
import { BUYER_HEADER_CSS, TOKENS_CSS, buyerHeaderHtml } from "../lib/brandTokens";
import { PROMO_SCRIPT_TAG } from "../lib/adserver/promoBoxJs";
import { promoMetadata } from "../lib/adserver/promoContext";
import express, { Router, type IRouter, type Request, type Response } from "express";
import { getStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";
import { sponsorDepositsOpen } from "./sponsorPage";
import { sendIntake } from "../lib/overhaul/fridayIntake";
import { TWO_LANE_CATEGORIES } from "../lib/twoLane";
import { EXCLUSIVE_RESERVE, EXCLUSIVE_RESERVE_TERMS, buildExclusiveReserveSession } from "../lib/exclusiveReserve";
import { PACING_ROWS } from "../lib/inventoryPlan";

const router: IRouter = Router();

const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

type Status = { kind: "success"; ref: string; paid: boolean; livemode: boolean; sid?: string } | { kind: "cancelled" } | null;

function page(open: boolean, status: Status): string {
  const pace = PACING_ROWS.find((r) => r.key === "exclusive-1900")!;
  const cats = TWO_LANE_CATEGORIES.map((c) => `<option value="${esc(c.label)}">${esc(c.label)}</option>`).join("");
  const banner =
    status?.kind === "success"
      ? `<div class="ok" role="status"><b>${status.paid ? "Payment received." : "Payment is processing."}</b> Your exclusive display reserve is recorded${status.livemode ? "" : " (test mode, no real charge)"}. Ref ${esc(status.ref)}. We email your insertion order within 1 business day. Nothing runs until you sign it.${status.paid && status.sid ? ` <a href="/account/login?session_id=${esc(status.sid)}" style="font-weight:700">Open your ad dashboard →</a>` : ""}</div>`
      : status?.kind === "cancelled"
        ? `<div class="note" role="status">Checkout cancelled. No charge was made.</div>`
        : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Exclusive display reserve · $1,900 CAD — Birch Reserve</title>
<meta name="description" content="Reserve $1,900 CAD to lock a $5K–$50K exclusive display package in your category at 25% below the regular rate. Insertion order before anything runs.">
<link rel="canonical" href="https://birchreserve.net/exclusive"><link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box}body{margin:0;background:#F9F8F6;color:#071A39;font:16px/1.6 "IBM Plex Sans",sans-serif}
header,main,footer{max-width:880px;margin:auto;padding:18px 22px}header{display:flex;justify-content:space-between;gap:12px;align-items:baseline;border-bottom:1px solid #ccd2d8;flex-wrap:wrap}
h1,h2{font-family:Fraunces,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(2rem,5vw,3rem);margin:.3em 0}h2{font-size:1.5rem;margin:1.4em 0 .4em}a{color:#071A39}
.fine{color:#4d5b6a;font-size:.88rem}.ok{background:#BFF3D6;color:#0B6B43;padding:10px 14px;border-radius:8px;margin:12px 0}.note{background:#fff;border:1px solid #ccd2d8;padding:10px 14px;border-radius:8px;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:16px 0}.stat{border:1px solid #ccd2d8;border-radius:12px;padding:14px;background:#fff}.stat b{display:block;font:600 1.6rem Fraunces,serif}
.mc{display:inline-block;margin-right:6px;padding:1px 7px;border-radius:999px;background:#FFF4DB;border:1px solid #F1D58F;color:#8A5A00;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;vertical-align:middle}
form{display:grid;gap:10px;border:1px solid #ccd2d8;border-radius:14px;padding:18px;background:#fff}input,select{width:100%;padding:10px;border:1px solid #b9c1c9;border-radius:8px;font:inherit}
button{background:#071A39;color:#fff;border:0;border-radius:6px;min-height:44px;padding:12px 18px;justify-self:start;font:600 1rem "IBM Plex Sans";cursor:pointer}button:disabled{opacity:.6}
details{border-top:1px solid #ccd2d8;padding:12px 0}summary{cursor:pointer;font-weight:600}ul{padding-left:1.1em}${TOKENS_CSS}${BUYER_HEADER_CSS}</style></head><body>
${buyerHeaderHtml("exclusive")}
<main>${banner}<div data-promo-box="success"></div>
<p class="fine">EXCLUSIVE DISPLAY · ONE BRAND PER CATEGORY</p>
<h1>Reserve ${EXCLUSIVE_RESERVE.label}. Lock your category's exclusive display.</h1>
<p>Your $1,900 locks a ${EXCLUSIVE_RESERVE.packageRange} CAD exclusive display package in your category at ${EXCLUSIVE_RESERVE.discountPct}% below the regular rate. All $1,900 counts toward the package. Your insertion order names the hub, placement and dates before anything runs.</p>
<div class="grid">
<div class="stat"><b>${EXCLUSIVE_RESERVE.label}</b>today, by card, counted in full</div>
<div class="stat"><b>${EXCLUSIVE_RESERVE.packageRange}</b>exclusive display package, CAD</div>
<div class="stat"><b>${EXCLUSIVE_RESERVE.discountPct}% below</b>the regular rate, set on the IO</div>
<div class="stat"><span class="mc">Modelled</span><b>${esc(pace.perMonth)}</b>over up to 6 months (${esc(pace.viewsPerMonth)})</div>
</div>
${open ? `<form id="f"><label>Brand<input name="brand" required maxlength="160" autocomplete="organization"></label>
<label>Work email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
<label>Category<select name="category" required><option value="">Choose a category</option>${cats}</select></label>
<label class="fine"><input type="checkbox" name="agree" style="width:auto"> I agree to the <a href="/terms#exclusive">reserve terms</a>. Nothing runs until I sign an insertion order.</label>
<div data-promo-box></div><button id="b" type="submit">Reserve for ${EXCLUSIVE_RESERVE.label}</button><p id="m" class="fine" role="status"></p></form>`
    : `<form id="f"><p><b>Card checkout is paused right now.</b> Leave your details and we'll send the insertion order and a payment link within 1 business day.</p><label>Brand<input name="brand" required></label><label>Work email<input name="email" type="email" required></label><label>Category<select name="category"><option value="">Choose a category</option>${cats}</select></label><input type="hidden" name="agree" value="on"><button id="b" type="submit">Request the reserve</button><p id="m" class="fine" role="status"></p></form>`}
<p class="fine">Card checkout by Stripe, charged in CAD. Statement shows BIRCHRSV* RESERVE.</p>
<details><summary>Reserve terms</summary><ul>${EXCLUSIVE_RESERVE_TERMS.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></details>
<details><summary>How the 6-month spend-down works</summary><p><span class="mc">Modelled</span>A ${esc(pace.credit)} package paced over 6 months is ${esc(pace.perMonth)}, about ${esc(pace.viewsPerMonth)} at today's blended starter CPM. Spend faster if you like. No impression guarantee; reporting is aggregate only.</p></details>
</main><footer class="fine">Silver Birch Growth Inc. · Toronto, Ontario · <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a> · (647) 931-6278</footer>
${PROMO_SCRIPT_TAG}
<script>(function(){var f=document.getElementById("f"),b=document.getElementById("b"),m=document.getElementById("m");f.addEventListener("submit",async function(e){e.preventDefault();var d=Object.fromEntries(new FormData(f));var body={brand:d.brand,email:d.email,category:d.category||"",agree:d.agree==="on"};if(!body.agree){m.textContent="Please agree to the reserve terms.";return}b.disabled=true;m.textContent="Opening secure checkout…";try{var r=await fetch("/v1/exclusive/reserve",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});var o=await r.json().catch(function(){return{}});if(o.url){location.assign(o.url);return}if(o.held){m.textContent=o.message;f.querySelectorAll("input,select,button").forEach(function(x){x.disabled=true});return}m.textContent=o.error||"Checkout could not open. Email sales@silverbirchgrowth.com.";b.disabled=false}catch(err){m.textContent="Checkout could not open. No charge was made.";b.disabled=false}})})();</script>
</body></html>`;
}

router.get(["/exclusive", "/exclusive/"], async (req: Request, res: Response) => {
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
  res.type("html").send(page(sponsorDepositsOpen(), status));
});

router.post("/v1/exclusive/reserve", express.json({ limit: "8kb" }), async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (!sponsorDepositsOpen()) {
    const email = typeof b.email === "string" ? b.email.trim().slice(0, 320) : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Add your brand and a work email." });
      return;
    }
    const friday = await sendIntake({ kind: "deposit_interest", email, company: typeof b.brand === "string" ? b.brand.slice(0, 160) : undefined, path: "/exclusive", meta: { tier: EXCLUSIVE_RESERVE.sku, category: String(b.category ?? ""), checkout_open: false } }).catch(() => ({ status: "failed" }));
    res.json({ held: true, message: "Got it. We'll send your insertion order and payment link within 1 business day. No charge today.", stored: friday.status });
    return;
  }
  const built = buildExclusiveReserveSession(b, `https://${req.headers.host ?? "birchreserve.net"}`);
  if (!built.ok) {
    res.status(400).json({ error: built.error });
    return;
  }
  try {
    const session = await getStripeClient().checkout.sessions.create({ ...built.params, metadata: { ...(built.params.metadata ?? {}), ...promoMetadata() } } as never);
    res.json({ url: session.url, livemode: session.livemode });
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "exclusive reserve session failed");
    res.status(502).json({ error: "Checkout could not open. Email sales@silverbirchgrowth.com." });
  }
});

export default router;
