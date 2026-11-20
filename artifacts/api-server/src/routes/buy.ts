/**
 * /buy: self-serve ad buy in three steps (see lib/buyFlow.ts). Standalone page, no SPA.
 *   GET  /buy                      the page
 *   POST /v1/buy/account           step 1 → signed account token (no password, no visitor email)
 *   POST /v1/buy/creative          step 2 → raw image body, x-buy-account header → signed creative token
 *   POST /v1/buy/order             step 3 → held for review; card plans get the /v1/checkout body back
 *   GET  /api/sales/buy-orders     staff only (mounted after Clerk)
 *   GET  /api/sales/buy-creatives/:id
 */
import { randomUUID } from "node:crypto";
import express, { Router, type IRouter, type Request, type Response } from "express";
import {
  BUY_FORMATS, BUY_PATH, BUY_PLANS, BUY_TAGLINE, CREATIVE_MAX_BYTES, CREATIVE_MIN_PX, CREATIVE_TYPES,
  accountToken, buyLimiters, buyStore, checkCreative, findFormat, findPlan, parseAccount, signToken, validPick, verifyToken,
  type AccountClaims, type CreativeClaims,
} from "../lib/buyFlow";
import { isBotUserAgent, HONEYPOT_FIELD } from "../lib/publicGuards";
import { hasValidQaHeader, isTestIdentity } from "../lib/testTraffic";
import { sendSalesAlert } from "../lib/salesAlert";
import { sendIntake } from "../lib/overhaul/fridayIntake";
import { requireSalesStaff } from "../lib/salesStaffAccess";
import { publicSeoTags } from "../lib/publicSeo";
import { FRIENDLY_429 } from "../lib/rateLimit";
import { logger } from "../lib/logger";
import { isReserveCheckoutConfigured } from "../lib/checkoutState";

const router: IRouter = Router();
export const buyStaffRouter: IRouter = Router();

const esc = (v: string) => v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const ipOf = (req: Request) => (req.ip || req.socket.remoteAddress || "unknown").slice(0, 64);

function guard(req: Request, res: Response): boolean {
  if (hasValidQaHeader(req)) return true;
  if (isBotUserAgent(req.get("user-agent"))) {
    res.status(403).json({ error: "Please use a regular browser." });
    return false;
  }
  return true;
}
function limited(res: Response, ...hits: Array<{ limited: boolean; retryAfterSec: number }>): boolean {
  const hit = hits.find((h) => h.limited);
  if (!hit) return false;
  res.setHeader("Retry-After", String(hit.retryAfterSec));
  res.status(429).json({ error: FRIENDLY_429 });
  return true;
}
const noStore = (res: Response) => res.setHeader("Cache-Control", "no-store");

/* ------------------------------------------------------------------ step 1 */
router.post("/v1/buy/account", express.json({ limit: "8kb" }), (req, res): void => {
  noStore(res);
  if (!guard(req, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD]) {
    res.json({ ok: true, account: signToken("acct", { bot: 1 }, 60_000), domain_check: "match" }); // dropped
    return;
  }
  const parsed = parseAccount(body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error, field: parsed.field });
    return;
  }
  if (limited(res, buyLimiters.accountIp.hit(ipOf(req)), buyLimiters.accountEmail.hit(parsed.value.email))) return;
  const a = parsed.value;
  res.json({
    ok: true,
    account: accountToken(a),
    domain_check: a.domainCheck,
    note: a.domainCheck === "match" ? null : "We'll confirm your company with a quick check before anything runs.",
  });
});

/* ------------------------------------------------------------------ step 2 */
router.post(
  "/v1/buy/creative",
  express.raw({ type: () => true, limit: CREATIVE_MAX_BYTES + 1024 }),
  async (req, res): Promise<void> => {
    noStore(res);
    if (!guard(req, res)) return;
    const acct = verifyToken<AccountClaims & { bot?: number }>("acct", req.get("x-buy-account"));
    if (!acct || acct.bot || !acct.id) {
      res.status(401).json({ error: "Start with step 1 so we know who the ad is for." });
      return;
    }
    if (limited(res, buyLimiters.creativeIp.hit(ipOf(req)), buyLimiters.creativeAccount.hit(acct.id))) return;
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const checked = checkCreative(buf);
    if (!checked.ok) {
      res.status(400).json({ error: checked.error });
      return;
    }
    const c = checked.value;
    const id = randomUUID();
    try {
      await buyStore().putCreative({ id, accountId: acct.id, email: acct.e, mime: c.mime, width: c.width, height: c.height, bytes: c.bytes, sha256: c.sha256, data: buf, createdAt: new Date() });
    } catch (err) {
      logger.error({ err }, "buy creative store failed");
      res.status(503).json({ error: "Upload could not be saved. Try again, or email it to sales@silverbirchgrowth.com." });
      return;
    }
    const token = signToken("crv", { id, a: acct.id, e: acct.e, m: c.mime, w: c.width, h: c.height, b: c.bytes, s: c.sha256 });
    res.json({ ok: true, creative: token, width: c.width, height: c.height, bytes: c.bytes, type: c.mime });
  },
);
router.use("/v1/buy/creative", (err: unknown, _req: Request, res: Response, next: (e?: unknown) => void) => {
  if (err && typeof err === "object" && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: "That file is over 2 MB. Export a smaller PNG, JPG or WebP." });
    return;
  }
  next(err);
});

/* ------------------------------------------------------------------ step 3 */
router.post("/v1/buy/order", express.json({ limit: "16kb" }), async (req, res): Promise<void> => {
  noStore(res);
  if (!guard(req, res)) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const acct = verifyToken<AccountClaims & { bot?: number }>("acct", body.account);
  if (!acct || !acct.id) {
    res.status(401).json({ error: "Your session timed out. Start again at step 1." });
    return;
  }
  if (acct.bot) {
    res.json({ ok: true, order_id: randomUUID(), next: "review" });
    return;
  }
  const crv = verifyToken<CreativeClaims>("crv", body.creative);
  if (!crv || crv.a !== acct.id) {
    res.status(400).json({ error: "Upload your ad image in step 2." });
    return;
  }
  const plan = findPlan(body.plan);
  const format = findFormat(body.format);
  if (!validPick(plan, format)) {
    res.status(400).json({ error: format?.premium ? "After checkout is exclusive only. Pick Exclusive display, or another spot." : "Pick a spot and a plan." });
    return;
  }
  if (body.terms !== true) {
    res.status(400).json({ error: "Please accept the terms first." });
    return;
  }
  if (limited(res, buyLimiters.orderIp.hit(ipOf(req)), buyLimiters.orderEmail.hit(acct.e))) return;
  const orderId = randomUUID();
  const isTest = isTestIdentity({ email: acct.e, name: acct.n });
  try {
    await buyStore().putOrder({ id: orderId, accountId: acct.id, name: acct.n, email: acct.e, company: acct.c, website: acct.w, domainCheck: acct.d, plan: plan!.key, format: format!.key, creativeId: crv.id, reviewStatus: "pending_review", ip: ipOf(req), createdAt: new Date() });
  } catch (err) {
    logger.error({ err }, "buy order store failed");
  }
  const origin = `https://${req.get("host") ?? "birchreserve.net"}`;
  const rows: Array<[string, string]> = [
    ["Plan", `${plan!.name} (${plan!.price})`],
    ["Where it shows", format!.label],
    ["Company", acct.c],
    ["Name", acct.n],
    ["Email", acct.e],
    ["Website", acct.w],
    ["Email vs website", acct.d === "match" ? "match" : `${acct.d}: check before approval`],
    ["Creative", `${crv.w}×${crv.h} ${crv.m}, ${Math.round(crv.b / 1024)} KB · ${origin}/api/sales/buy-creatives/${crv.id}`],
    ["Order", orderId],
    ["Review", "Creative held for approval. Nothing runs until approved."],
  ];
  // Internal alert to the sales inbox only. No email goes to the buyer.
  void sendSalesAlert({ event: plan!.pay === "card" ? "seat_hold" : "inquiry", title: `/buy ${plan!.name}: ${acct.c}`, rows, replyTo: acct.e, isTest }).catch((err) =>
    logger.warn({ err }, "buy sales alert failed"),
  );
  if (plan!.pay === "invoice") {
    void sendIntake({
      kind: "premium_inquiry", email: acct.e, name: acct.n, company: acct.c, website: acct.w, path: BUY_PATH,
      message: `Exclusive display via /buy. Slot: ${format!.label}. Creative ${crv.id} held for review. Email vs website: ${acct.d}.`,
      meta: { buy_order_id: orderId, format_pref: format!.key, creative_id: crv.id, domain_check: acct.d, is_test: isTest },
    }).catch((err) => logger.warn({ err }, "buy intake failed"));
    res.json({ ok: true, order_id: orderId, next: "invoice" });
    return;
  }
  res.json({
    ok: true,
    order_id: orderId,
    next: "checkout",
    checkout: { sku: plan!.key, brand: acct.c, email: acct.e, website_url: acct.w, format_pref: format!.key, currency: "usd", idempotency_key: `buy-${orderId}` },
  });
});

/* ------------------------------------------------------------------ staff */
buyStaffRouter.get("/api/sales/buy-orders", requireSalesStaff, async (_req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  try {
    const s = buyStore();
    res.json({ store: s.name, orders: await s.listOrders(200) });
  } catch (err) {
    logger.warn({ err }, "buy orders read failed");
    res.status(503).json({ error: "Unavailable right now." });
  }
});
buyStaffRouter.get("/api/sales/buy-creatives/:id", requireSalesStaff, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  const id = String(req.params.id ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    res.status(404).end();
    return;
  }
  const c = await buyStore().getCreative(id).catch(() => null);
  if (!c) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  res.setHeader("Content-Type", c.mime);
  res.setHeader("Content-Disposition", `inline; filename="creative-${c.id}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.send(c.data);
});

/* ------------------------------------------------------------------ page */
const TITLE = "Buy Scale Health ads through Birch Reserve";
const DESCRIPTION = "Set up your account, upload your ad and pick where it shows. Pay by card with Stripe, or get an invoice for exclusive display. USD.";

const MOCK: Record<string, string> = {
  recovery_plan: `<div class="mk"><i class="l w7"></i><i class="l w5"></i><b class="ad">Your ad</b><i class="l w6"></i></div>`,
  scheduled_service: `<div class="mk"><i class="l w5"></i><span class="slots"><i></i><i></i><i></i></span><b class="ad">Your ad</b></div>`,
  member_hub: `<div class="mk"><b class="ad big">Your ad</b><span class="tiles"><i></i><i></i></span></div>`,
  post_checkout: `<div class="mk"><span class="ok">✓</span><i class="l w5"></i><b class="ad big">Your ad</b></div>`,
};

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:#f8f6ef;color:#071A39;font:16px/1.5 "IBM Plex Sans",system-ui,sans-serif}
a{color:inherit}.wrap{max-width:980px;margin:0 auto;padding:0 18px}
header.top{border-bottom:1px solid #d8dccf}header.top .wrap{display:flex;justify-content:space-between;align-items:center;min-height:56px;gap:12px}
.logo{font-weight:600;letter-spacing:.14em;font-size:.84rem;text-decoration:none}header nav{display:flex;gap:14px;font-size:.9rem}header nav a{text-decoration:none;opacity:.8}
.hero{padding:34px 0 10px}h1,h2{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.08;margin:0}h1{font-size:clamp(2rem,6.4vw,3.3rem);max-width:15em}
.lede{color:#33445c;margin:10px 0 0;font-size:1.05rem}
.prog{display:flex;gap:8px;margin:22px 0 8px;list-style:none;padding:0}.prog li{flex:1;display:flex;align-items:center;gap:8px;font-size:.86rem;font-weight:600;opacity:.45}
.prog li b{display:inline-flex;width:28px;height:28px;border-radius:50%;border:2px solid #071A39;align-items:center;justify-content:center;flex:none}
.prog li.on{opacity:1}.prog li.done{opacity:1}.prog li.done b{background:#071A39;color:#f8f6ef}.prog li span{white-space:nowrap}
.card{background:#fff;border:1px solid #dfe2d8;border-radius:22px;padding:22px;margin:16px 0}.card[aria-disabled=true]{opacity:.5;pointer-events:none}
.card h2{font-size:1.55rem;margin-bottom:12px;display:flex;align-items:center;gap:10px}.card h2 em{font-style:normal;font-size:.8rem;font-family:"IBM Plex Sans",system-ui;background:#e9efe0;border-radius:999px;padding:3px 10px;color:#24412a}
label{display:block;font-size:.86rem;font-weight:600;margin:10px 0 4px}input[type=text],input[type=email]{width:100%;min-height:48px;border:1.5px solid #c9cfc2;border-radius:12px;padding:0 14px;font:inherit;background:#fbfbf8}
input:focus{outline:3px solid #C8F55A;border-color:#071A39}.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 24px;border-radius:999px;border:0;background:#071A39;color:#f8f6ef;font:600 16px "IBM Plex Sans",system-ui;cursor:pointer;margin-top:16px;text-decoration:none}
.btn[disabled]{opacity:.5;cursor:wait}.btn.alt{background:#C8F55A;color:#071A39}
.msg{min-height:1.4em;font-size:.92rem;margin:10px 0 0}.msg.err{color:#a12b1f}.msg.ok{color:#24412a}
.drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed #9aa79a;border-radius:18px;min-height:170px;padding:18px;text-align:center;cursor:pointer;background:#fbfbf8}
.drop.over{background:#eef5e2;border-color:#071A39}.drop strong{font-size:1.05rem}.drop span{font-size:.86rem;color:#4d5b6a}.drop input{position:absolute;opacity:0;width:1px;height:1px}
.preview{display:none;gap:14px;align-items:center;margin-top:12px}.preview.on{display:flex}.preview img{max-width:160px;max-height:120px;border-radius:10px;border:1px solid #dfe2d8}
.picks{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
.pick{position:relative;display:block;border:1.5px solid #dfe2d8;border-radius:16px;padding:12px;cursor:pointer;background:#fbfbf8;margin:0;font-weight:400}
.pick input{position:absolute;opacity:0}.pick:has(input:checked){border-color:#071A39;box-shadow:4px 4px 0 #C8F55A;background:#fff}.pick:has(input:disabled){opacity:.4;cursor:not-allowed}
.pick strong{display:block;font-size:.98rem}.pick small{display:block;font-size:.8rem;color:#4d5b6a;line-height:1.3;margin-top:2px}
.pick .price{font-family:Fraunces,Georgia,serif;font-size:1.9rem;line-height:1;display:block;margin-bottom:6px}.pick .tag{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:#071A39;color:#f8f6ef;border-radius:999px;padding:2px 8px;margin-top:6px}
.mk{height:86px;border-radius:10px;background:#eef0ea;padding:8px;display:flex;flex-direction:column;gap:5px;margin-bottom:8px;overflow:hidden}
.mk .l{display:block;height:6px;border-radius:3px;background:#c9cfc2}.w5{width:50%}.w6{width:60%}.w7{width:70%}
.mk .ad{display:flex;align-items:center;justify-content:center;background:#C8F55A;border-radius:6px;font-size:.7rem;font-weight:700;min-height:22px}.mk .ad.big{flex:1}
.mk .slots,.mk .tiles{display:flex;gap:4px}.mk .slots i{flex:1;height:12px;border-radius:4px;background:#fff}.mk .tiles i{flex:1;height:18px;border-radius:5px;background:#fff}
.mk .ok{font-size:.9rem;font-weight:700;color:#24412a}
.check{display:flex;gap:10px;align-items:flex-start;font-size:.9rem;margin-top:14px}.check input{width:20px;height:20px;margin-top:2px}
.trust{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}.trust li{font-size:.8rem;background:#e9efe0;border-radius:999px;padding:4px 10px}
details{margin:14px 0 0;font-size:.86rem;color:#4d5b6a}details summary{cursor:pointer;font-weight:600;color:#071A39}details ul{padding-left:18px;margin:8px 0}
.done-box{display:none;text-align:center;padding:28px 18px}.done-box.on{display:block}.done-box h2{font-size:1.8rem;margin-bottom:8px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
footer{border-top:1px solid #d8dccf;margin-top:30px;padding:20px 0 36px;font-size:.84rem;color:#4d5b6a}
@media(max-width:760px){header nav a[href^=tel]{display:none}.picks{grid-template-columns:1fr 1fr}.plans{grid-template-columns:1fr}.g2{grid-template-columns:1fr}.prog li span{display:none}.prog li.on span{display:inline}.card{padding:18px}}`;

export function renderBuyPage(opts: { checkoutLive: boolean }): string {
  const formats = BUY_FORMATS.map(
    (f, i) => `<label class="pick" data-premium="${f.premium ? 1 : 0}"><input type="radio" name="format" value="${f.key}"${i === 0 ? " checked" : ""}>${MOCK[f.key] ?? ""}<strong>${esc(f.label)}</strong><small>${esc(f.hint)}</small></label>`,
  ).join("");
  const plans = BUY_PLANS.map(
    (p, i) => `<label class="pick" data-pay="${p.pay}"><input type="radio" name="plan" value="${p.key}"${i === 0 ? " checked" : ""}><span class="price">${esc(p.price)}</span><strong>${esc(p.name)}</strong><small>${esc(p.line)}</small><span class="tag">${p.pay === "card" ? "Card" : "Invoice"}</span></label>`,
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(TITLE)} | Birch Reserve</title><meta name="description" content="${esc(DESCRIPTION)}">
${publicSeoTags(BUY_PATH, TITLE, DESCRIPTION)}
<link rel="icon" href="/favicon.svg"><style>${CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="logo" href="/">BIRCH RESERVE</a><nav><a href="/rates">Rates</a><a href="/media-kit">Media kit</a><a href="tel:+16479316278">(647) 931-6278</a></nav></div></header>
<main class="wrap">
<section class="hero"><h1>${esc(BUY_TAGLINE)}</h1><p class="lede">Three steps. About two minutes. Prices in USD.</p>
<ol class="prog" id="prog"><li class="on" data-s="1"><b>1</b><span>Your account</span></li><li data-s="2"><b>2</b><span>Your ad</span></li><li data-s="3"><b>3</b><span>Where it shows</span></li></ol></section>

<form class="card" id="s1" novalidate autocomplete="on"><h2>1 · Your account</h2>
<div class="g2"><div><label for="b-name">Your name</label><input type="text" id="b-name" name="name" required maxlength="120" autocomplete="name"></div>
<div><label for="b-email">Work email</label><input type="email" id="b-email" name="email" required maxlength="200" autocomplete="email" inputmode="email"></div>
<div><label for="b-company">Company</label><input type="text" id="b-company" name="company" required maxlength="160" autocomplete="organization"></div>
<div><label for="b-web">Company website</label><input type="text" id="b-web" name="website" required maxlength="300" placeholder="yourbrand.com" autocomplete="url" inputmode="url"></div></div>
<div class="hp" aria-hidden="true"><label for="b-fax">Fax</label><input type="text" id="b-fax" name="fax" tabindex="-1" autocomplete="off"></div>
<button class="btn" id="s1-go" type="submit">Continue</button><p class="msg" id="s1-msg" role="status" aria-live="polite"></p></form>

<div class="card" id="s2" aria-disabled="true"><h2>2 · Your ad</h2>
<label class="drop" id="drop" for="b-file"><strong>Drop your image here, or tap to choose</strong><span>PNG, JPG, WebP or GIF · up to 2 MB · at least ${CREATIVE_MIN_PX} px a side</span>
<input type="file" id="b-file" accept="${CREATIVE_TYPES.join(",")}"></label>
<div class="preview" id="pv"><img id="pv-img" alt="Your ad preview"><div><strong id="pv-name"></strong><br><small id="pv-meta"></small></div></div>
<p class="msg" id="s2-msg" role="status" aria-live="polite"></p>
<details><summary>Ad rules</summary><ul><li>Every ad is checked by a person before it runs. We'll reply if anything needs a change.</li><li>No medical claims, before-and-after photos or prices that are not real.</li><li>Need a size made for you? Upload what you have and say so; we'll help.</li></ul></details></div>

<form class="card" id="s3" aria-disabled="true" novalidate><h2>3 · Where it shows</h2>
<div class="picks" role="radiogroup" aria-label="Where it shows">${formats}</div>
<div class="plans" role="radiogroup" aria-label="Plan">${plans}</div>
<label class="check"><input type="checkbox" id="b-terms" required><span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms</a>. My ad is reviewed before it runs.</span></label>
<button class="btn alt" id="s3-go" type="submit">${opts.checkoutLive ? "Continue to secure checkout" : "Send my order"}</button>
<p class="msg" id="s3-msg" role="status" aria-live="polite"></p>
<ul class="trust"><li>Card checkout by Stripe</li><li>Bank check when your bank asks</li><li>Ad reviewed by a person</li><li>USD</li></ul>
<details><summary>Small print</summary><ul><li>Card plans open Stripe Checkout. Stripe verifies the card and screens for fraud; your bank may ask you to confirm.</li><li>The $490 reserve is 100% media credit, refundable until 14 days before launch. The $190 look converts in full to the reserve within 7 days, or is refunded.</li><li>Exclusive display is one brand per category for its term. We send an insertion order and an invoice (card, cheque or wire). No card today.</li><li>Your ad shows inside private retail hubs. Placement is named in your insertion order before anything runs.</li><li>No impression guarantee. Aggregate reporting only. No patient data.</li></ul></details></form>

<div class="card done-box" id="done"><h2 id="done-h">Got it.</h2><p id="done-p"></p><a class="btn" href="/">Back to Birch Reserve</a></div>
</main>
<footer><div class="wrap">Silver Birch Growth Inc. · Toronto · <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a> · <a href="tel:+16479316278">(647) 931-6278</a></div></footer>
<script>
(function(){var acct=null,crv=null,live=${opts.checkoutLive ? "true" : "false"};
function $(id){return document.getElementById(id)}
function msg(el,t,err){el.textContent=t||"";el.className="msg"+(t?(err?" err":" ok"):"")}
function step(n){[1,2,3].forEach(function(i){var li=document.querySelector('#prog li[data-s="'+i+'"]');li.className=i<n?"done":i===n?"on":"";var c=$("s"+i);if(i<=n)c.removeAttribute("aria-disabled");else c.setAttribute("aria-disabled","true")});var c=$("s"+n);if(c&&n>1)c.scrollIntoView({behavior:"smooth",block:"start"})}
async function post(url,body,headers){var r=await fetch(url,{method:"POST",headers:Object.assign({"content-type":"application/json"},headers||{}),body:body});var o={};try{o=await r.json()}catch(_){}return{ok:r.ok,status:r.status,body:o}}
$("s1").addEventListener("submit",async function(e){e.preventDefault();var f=e.target,m=$("s1-msg");if(!f.reportValidity())return;var b=$("s1-go");b.disabled=true;msg(m,"Setting up your account…");var d=Object.fromEntries(new FormData(f));try{var r=await post("/v1/buy/account",JSON.stringify(d));if(r.ok&&r.body.account){acct=r.body.account;msg(m,r.body.note||"Account ready.",false);f.querySelectorAll("input").forEach(function(i){i.readOnly=true});b.textContent="Edit";b.disabled=false;b.type="button";b.onclick=function(){f.querySelectorAll("input").forEach(function(i){i.readOnly=false});acct=null;crv=null;b.type="submit";b.textContent="Continue";b.onclick=null;step(1)};step(crv?3:2);return}msg(m,r.body.error||"That didn't work. Try again.",true);if(r.body.field){var el=f.elements[r.body.field];if(el)el.focus()}}catch(_){msg(m,"Network problem. Try again.",true)}b.disabled=false});
var drop=$("drop"),file=$("b-file");
["dragenter","dragover"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add("over")})});["dragleave","drop"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove("over")})});
drop.addEventListener("drop",function(e){if(e.dataTransfer.files[0])upload(e.dataTransfer.files[0])});file.addEventListener("change",function(){if(file.files[0])upload(file.files[0])});
async function upload(fl){var m=$("s2-msg");if(!acct){msg(m,"Finish step 1 first.",true);return}if(${JSON.stringify(CREATIVE_TYPES)}.indexOf(fl.type)<0){msg(m,"Use a PNG, JPG, WebP or GIF image.",true);return}if(fl.size>${CREATIVE_MAX_BYTES}){msg(m,"That file is over 2 MB. Export a smaller one.",true);return}
msg(m,"Uploading…");var url=URL.createObjectURL(fl);$("pv-img").src=url;$("pv-name").textContent=fl.name;$("pv").classList.add("on");
try{var r=await fetch("/v1/buy/creative",{method:"POST",headers:{"content-type":fl.type,"x-buy-account":acct},body:fl});var o={};try{o=await r.json()}catch(_){}if(r.ok&&o.creative){crv=o.creative;$("pv-meta").textContent=o.width+" × "+o.height+" px · "+Math.max(1,Math.round(o.bytes/1024))+" KB · held for review";msg(m,"Uploaded. A person checks it before it runs.",false);step(3);return}crv=null;msg(m,o.error||"Upload failed. Try again.",true)}catch(_){crv=null;msg(m,"Upload failed. Try again.",true)}}
var s3=$("s3");function sync(){var fmt=s3.querySelector("input[name=format]:checked"),prem=fmt&&fmt.closest(".pick").getAttribute("data-premium")==="1";s3.querySelectorAll(".plans .pick").forEach(function(p){var inp=p.querySelector("input");inp.disabled=prem&&p.getAttribute("data-pay")==="card";if(inp.disabled&&inp.checked){inp.checked=false;s3.querySelector('input[name=plan][value=exclusive]').checked=true}});var plan=s3.querySelector("input[name=plan]:checked"),inv=plan&&plan.closest(".pick").getAttribute("data-pay")==="invoice";$("s3-go").textContent=inv?"Request invoice":(live?"Continue to secure checkout":"Send my order")}
s3.addEventListener("change",sync);sync();
s3.addEventListener("submit",async function(e){e.preventDefault();var m=$("s3-msg"),b=$("s3-go");if(!acct){msg(m,"Finish step 1 first.",true);step(1);return}if(!crv){msg(m,"Upload your ad in step 2.",true);return}if(!$("b-terms").checked){msg(m,"Please accept the terms first.",true);return}
b.disabled=true;msg(m,"Saving your order…");var plan=s3.querySelector("input[name=plan]:checked").value,fmt=s3.querySelector("input[name=format]:checked").value;
try{var r=await post("/v1/buy/order",JSON.stringify({account:acct,creative:crv,plan:plan,format:fmt,terms:true}));if(!r.ok){msg(m,r.body.error||"That didn't work. Try again.",true);b.disabled=false;return}
if(r.body.next==="checkout"&&r.body.checkout){msg(m,"Opening secure checkout…");var c=await post("/v1/checkout",JSON.stringify(r.body.checkout));if(c.body.checkout_url){location.assign(c.body.checkout_url);return}if(c.body.order_id){finish("Order saved.","No card was charged. We'll confirm by email or call (647) 931-6278. Ref "+r.body.order_id.slice(0,8)+".");return}msg(m,c.body.error||"Checkout could not open. Call (647) 931-6278.",true);b.disabled=false;return}
finish("Invoice on the way.","We'll send your insertion order and invoice within 1 business day. Your ad is held for review. No card was charged. Ref "+r.body.order_id.slice(0,8)+".")}catch(_){msg(m,"Network problem. No payment was taken. Try again.",true);b.disabled=false}});
function finish(h,p){["s1","s2","s3"].forEach(function(id){$(id).style.display="none"});$("prog").querySelectorAll("li").forEach(function(li){li.className="done"});$("done-h").textContent=h;$("done-p").textContent=p;$("done").classList.add("on");$("done").scrollIntoView({behavior:"smooth"})}
if(/[?&]checkout=cancelled/.test(location.search))msg($("s1-msg"),"Checkout was cancelled. No payment was taken.",false);
})();
</script></body></html>`;
}

router.get(["/buy", "/buy/"], (_req, res): void => {
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.type("html").send(renderBuyPage({ checkoutLive: isReserveCheckoutConfigured() }));
});

export default router;
