/**
 * /buy: self-serve ad buy in three steps (see lib/buyFlow.ts). Standalone page, no SPA.
 *   GET  /buy                      the page
 *   POST /v1/buy/account           step 1 → signed account token (no password, no visitor email)
 *   POST /v1/buy/creative          step 2 → raw image body, x-buy-account header → signed creative token
 *   POST /v1/buy/order             step 3 → held for review; card plans get the /v1/checkout body back
 *   GET  /api/sales/buy-orders     staff only (mounted after Clerk)
 *   GET  /api/sales/buy-creatives/:id
 */
import { BUYER_HEADER_CSS, TOKENS_CSS, buyerHeaderHtml } from "../lib/brandTokens";
import { PROMO_SCRIPT_TAG } from "../lib/adserver/promoBoxJs";
import { randomUUID } from "node:crypto";
import express, { Router, type IRouter, type Request, type Response } from "express";
import {
  BUY_FORMATS, BUY_PATH, BUY_PLANS, BUY_TAGLINE, buyPlans, CREATIVE_MAX_BYTES, CREATIVE_MIN_PX, CREATIVE_TYPES,
  accountToken, buyLimiters, buyStore, openPrefill, parsePrefill, sealPrefill, checkCreative, findFormat, findPlan, parseAccount, signToken, validPick, verifyToken,
  type AccountClaims, type CreativeClaims,
} from "../lib/buyFlow";
import { isBotUserAgent, HONEYPOT_FIELD } from "../lib/publicGuards";
import { hasValidQaHeader, isTestIdentity } from "../lib/testTraffic";
import { sendSalesAlert, alertSiteOf } from "../lib/salesAlert";
import { sendIntake } from "../lib/overhaul/fridayIntake";
import { requireSalesStaff } from "../lib/salesStaffAccess";
import { publicSeoTags } from "../lib/publicSeo";
import { FRIENDLY_429 } from "../lib/rateLimit";
import { logger } from "../lib/logger";
import { coarseRegion, recordPulse } from "../lib/activityPulse";
import { isReserveCheckoutConfigured } from "../lib/checkoutState";
import { decideCurrency, pageCurrency } from "../lib/currency";
import { parseReserveCurrency, type ReserveCurrency } from "../lib/reserveOffers";
import { currencyHref, currencyToggleHtml, PRICE_LADDER_CSS } from "../lib/priceLadder";

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

/* ------------------------------------------------------------------ kit prefill */
// The kit posts what it already has; /buy?pf=<token> opens step 1 filled in. Encrypted token, nothing stored.
router.post("/v1/buy/prefill", express.json({ limit: "4kb" }), (req, res): void => {
  noStore(res);
  if (!guard(req, res)) return;
  if (limited(res, buyLimiters.prefillIp.hit(ipOf(req)))) return;
  const p = parsePrefill(req.body);
  if (!Object.keys(p).length) {
    res.status(400).json({ error: "Nothing to prefill." });
    return;
  }
  res.json({ ok: true, pf: sealPrefill(p) });
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
      res.status(503).json({ error: "Upload could not be saved. Try again, or email it to randy@scalehealth.ca." });
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
  // "Send it later" (Nov 21 2026): the order can go in without an image. Nothing runs until one is sent and approved.
  const later = body.creative_later === true && !body.creative;
  const crv = later ? null : verifyToken<CreativeClaims>("crv", body.creative);
  if (!later && (!crv || crv.a !== acct.id)) {
    res.status(400).json({ error: "Upload your ad image, or pick Send it later." });
    return;
  }
  const plan = findPlan(body.plan);
  const format = findFormat(body.format);
  if (!validPick(plan, format)) {
    res.status(400).json({ error: format?.premium ? "After checkout is for starter placement only. Pick Starter placement, or another spot." : "Pick a spot and a plan." });
    return;
  }
  if (body.terms !== true) {
    res.status(400).json({ error: "Please accept the terms first." });
    return;
  }
  if (limited(res, buyLimiters.orderIp.hit(ipOf(req)), buyLimiters.orderEmail.hit(acct.e))) return;
  const orderId = randomUUID();
  const isTest = isTestIdentity({ email: acct.e, name: acct.n });
  void recordPulse("buy_order", null, { isTest: isTest || hasValidQaHeader(req) || /@(silverbirchgrowth\.com|scalehealth\.ca|birchreserve\.net|example\.(com|org))$/i.test(acct.e), region: coarseRegion((h) => req.get(h)) });
  try {
    await buyStore().putOrder({ id: orderId, accountId: acct.id, name: acct.n, email: acct.e, company: acct.c, website: acct.w, domainCheck: acct.d, plan: plan!.key, format: format!.key, creativeId: crv?.id ?? null, reviewStatus: "pending_review", ip: ipOf(req), createdAt: new Date() });
  } catch (err) {
    logger.error({ err }, "buy order store failed");
  }
  const origin = `https://${req.get("host") ?? "birchreserve.net"}`;
  const rows: Array<[string, string]> = [
    ["Plan", `${plan!.name} (${buyPlans(parseReserveCurrency(body.currency) ?? decideCurrency(req).currency).find((p) => p.key === plan!.key)!.price})`],
    ["Where it shows", format!.label],
    ["Company", acct.c],
    ["Name", acct.n],
    ["Email", acct.e],
    ["Website", acct.w],
    ["Email vs website", acct.d === "match" ? "match" : `${acct.d}: check before approval`],
    ["Creative", crv ? `${crv.w}×${crv.h} ${crv.m}, ${Math.round(crv.b / 1024)} KB · ${origin}/api/sales/buy-creatives/${crv.id}` : "Sending later: ask for it with the insertion order"],
    ["Order", orderId],
    ["Review", crv ? "Creative held for approval. Nothing runs until approved." : "No creative yet. Nothing runs until one is sent and approved."],
  ];
  // Internal alert to the sales inbox only. No email goes to the buyer.
  // Awaited (form audit Nov 26 2026): a fire-and-forget send can be frozen with the serverless function after the
  // response. sendSalesAlert never throws and has a 10s mailer timeout.
  await sendSalesAlert({
      via: alertSiteOf(req), event: plan!.pay === "card" ? "seat_hold" : "inquiry", title: `/buy ${plan!.name}: ${acct.c}`, rows, replyTo: acct.e, isTest }).catch((err) =>
    logger.warn({ err }, "buy sales alert failed"),
  );
  // Charge the currency the page showed (sent by the page), else the visitor's geo currency.
  const currency: ReserveCurrency = parseReserveCurrency(body.currency) ?? decideCurrency(req).currency;
  if (plan!.pay === "reserve") {
    void sendIntake({
      kind: "premium_inquiry", email: acct.e, name: acct.n, company: acct.c, website: acct.w, path: BUY_PATH,
      message: `Starter placement via /buy (${currency.toUpperCase()}; card checkout opens next). Slot: ${format!.label}. ${crv ? `Creative ${crv.id} held for review.` : "Creative: sending later."} Email vs website: ${acct.d}.`,
      meta: { buy_order_id: orderId, format_pref: format!.key, creative_id: crv?.id ?? "later", domain_check: acct.d, is_test: isTest },
    }).catch((err) => logger.warn({ err }, "buy intake failed"));
    res.json({ ok: true, order_id: orderId, next: "reserve", reserve: { brand: acct.c, email: acct.e, category: "", agree: true, currency } });
    return;
  }
  res.json({
    ok: true,
    order_id: orderId,
    next: "checkout",
    checkout: { sku: plan!.key, brand: acct.c, email: acct.e, website_url: acct.w, format_pref: format!.key, currency, idempotency_key: `buy-${orderId}` },
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
const DESCRIPTION = "Set up your account, upload your ad and pick where it shows. Pay by card with Stripe: a 7-day look, a category placement, or the $1,900 starter placement that holds your category pending your IO. USD or CAD.";

const MOCK: Record<string, string> = {
  recovery_plan: `<div class="mk"><i class="l w7"></i><i class="l w5"></i><b class="ad">Your ad</b><i class="l w6"></i></div>`,
  scheduled_service: `<div class="mk"><i class="l w5"></i><span class="slots"><i></i><i></i><i></i></span><b class="ad">Your ad</b></div>`,
  member_hub: `<div class="mk"><b class="ad big">Your ad</b><span class="tiles"><i></i><i></i></span></div>`,
  post_checkout: `<div class="mk"><span class="ok">✓</span><i class="l w5"></i><b class="ad big">Your ad</b></div>`,
};

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:#F9F8F6;color:#071A39;font:16px/1.5 "IBM Plex Sans",system-ui,sans-serif}
a{color:inherit}.wrap{max-width:860px;margin:0 auto;padding:0 18px}
header.top{border-bottom:1px solid #d8dccf}header.top .wrap{display:flex;justify-content:space-between;align-items:center;min-height:56px;gap:12px}
.logo{font-weight:600;letter-spacing:.14em;font-size:.84rem;text-decoration:none}header nav{display:flex;gap:14px;font-size:.9rem}header nav a{text-decoration:none;opacity:.8}
.hero{padding:28px 0 4px}h1,h2{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.08;margin:0}h1{font-size:clamp(1.9rem,6vw,3rem);max-width:15em}
.lede{color:#33445c;margin:8px 0 0;font-size:1.02rem}
.prog{margin:18px 0 0}.prog .row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:.78rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#4d5b6a}
.prog .row span:last-child{letter-spacing:0;text-transform:none;font-weight:600}
.bar{height:7px;border-radius:99px;background:#e1e4da;margin-top:6px;overflow:hidden}.bar i{display:block;height:100%;background:#9fd13a;border-radius:99px;transition:width .3s}
.card{background:#fff;border:1px solid #dfe2d8;border-radius:22px;padding:22px;margin:16px 0}.step{display:none}.step.on{display:block}
.card h2{font-size:1.6rem;margin-bottom:4px}.hint{margin:0 0 14px;font-weight:600;font-size:.95rem;color:#24412a}
.sub{font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#4d5b6a;margin:18px 0 8px}
label.f{display:block;font-size:.86rem;font-weight:600;margin:12px 0 4px}input[type=text],input[type=email]{width:100%;min-height:52px;border:1.5px solid #c9cfc2;border-radius:12px;padding:0 14px;font:inherit;font-size:16px;background:#fbfbf8}
input[aria-invalid=true]{border-color:#a12b1f;background:#fff8f6}.fe{display:block;min-height:0;font-size:.85rem;font-weight:600;color:#a12b1f;margin-top:4px}.fe:empty{display:none}
input:focus{outline:3px solid #C8F55A;border-color:#071A39}.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:20px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;border-radius:6px;border:0;background:#071A39;color:#F9F8F6;font:700 16px "IBM Plex Sans",system-ui;cursor:pointer;text-decoration:none;flex:1 1 auto;max-width:420px}
.btn[disabled]{opacity:.55;cursor:wait}.btn.alt{background:#C8F55A;color:#071A39;box-shadow:0 8px 24px rgba(159,209,58,.35)}
.back{min-height:48px;padding:0 20px;border-radius:6px;border:1.5px solid #c9cfc2;background:#fff;font:600 15px "IBM Plex Sans",system-ui;color:#071A39;cursor:pointer}
.msg{min-height:1.4em;font-size:.92rem;margin:10px 0 0}.msg.err{color:#a12b1f;font-weight:600}.msg.ok{color:#24412a}
.drop{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:2px dashed #9aa79a;border-radius:18px;min-height:150px;padding:18px;text-align:center;cursor:pointer;background:#fbfbf8;margin:0}
.drop.over{background:#eef5e2;border-color:#071A39}.drop strong{font-size:1.05rem}.drop span{font-size:.86rem;color:#4d5b6a}.drop input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.preview{display:none;gap:14px;align-items:center;margin-top:12px}.preview.on{display:flex}.preview img{max-width:160px;max-height:120px;border-radius:10px;border:1px solid #dfe2d8}
.adpick{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.picks{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pick{position:relative;display:block;border:1.5px solid #dfe2d8;border-radius:16px;padding:12px;cursor:pointer;background:#fbfbf8;margin:0;font-weight:400}
.pick input{position:absolute;opacity:0;top:0;left:0;width:1px;height:1px}.pick:has(input:checked){border-color:#071A39;box-shadow:4px 4px 0 #C8F55A;background:#fff}.pick:has(input:disabled){opacity:.45;cursor:not-allowed}
.pick:has(input:focus-visible){outline:3px solid #C8F55A}
.pick strong{display:block;font-size:.98rem}.pick small{display:block;font-size:.8rem;color:#4d5b6a;line-height:1.3;margin-top:2px}
.pick .price{font-family:Fraunces,Georgia,serif;font-size:1.9rem;line-height:1;display:block;margin-bottom:6px}.pick .tag{display:inline-block;font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:#071A39;color:#F9F8F6;border-radius:999px;padding:2px 8px;margin-top:6px}
.pick .lock{display:none;font-size:.72rem;font-weight:700;color:#8a5a00;margin-top:4px}.pick:has(input:disabled) .lock{display:block}
.mk{height:76px;border-radius:10px;background:#eef0ea;padding:8px;display:flex;flex-direction:column;gap:5px;margin-bottom:8px;overflow:hidden}
.mk .l{display:block;height:6px;border-radius:3px;background:#c9cfc2}.w5{width:50%}.w6{width:60%}.w7{width:70%}
.mk .ad{display:flex;align-items:center;justify-content:center;background:#C8F55A;border-radius:6px;font-size:.7rem;font-weight:700;min-height:22px}.mk .ad.big{flex:1}
.mk .slots,.mk .tiles{display:flex;gap:4px}.mk .slots i{flex:1;height:12px;border-radius:4px;background:#fff}.mk .tiles i{flex:1;height:18px;border-radius:5px;background:#fff}
.mk .ok{font-size:.9rem;font-weight:700;color:#24412a}
.sum{background:#f3f5ee;border-radius:14px;padding:12px 14px;font-size:.92rem;margin:14px 0 0}.sum b{font-weight:700}.sum a{font-weight:600}
.check{display:flex;gap:10px;align-items:flex-start;font-size:.95rem;margin-top:16px;font-weight:500}.check input{width:22px;height:22px;margin-top:1px;flex:none}
.trust{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0;padding:0;list-style:none}.trust li{font-size:.8rem;background:#e9efe0;border-radius:999px;padding:4px 10px}
details{margin:14px 0 0;font-size:.86rem;color:#4d5b6a}details summary{cursor:pointer;font-weight:600;color:#071A39}details ul{padding-left:18px;margin:8px 0}
.done-box{display:none;padding:26px 20px}.done-box.on{display:block}.done-box h2{font-size:1.9rem;margin-bottom:8px}.done-box ol{padding-left:20px;margin:10px 0 0}.done-box li{margin:4px 0}
.saved{display:none;background:#eef5e2;border-radius:12px;padding:8px 12px;font-size:.88rem;margin:0 0 12px}.saved.on{display:block}.saved button{background:none;border:0;padding:0;font:inherit;font-weight:600;text-decoration:underline;cursor:pointer;color:inherit}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
footer{border-top:1px solid #d8dccf;margin-top:30px;padding:20px 0 36px;font-size:.84rem;color:#4d5b6a}
@media(max-width:760px){header nav a[href^=tel]{display:none}.picks{grid-template-columns:1fr 1fr}.plans{grid-template-columns:1fr}.g2{grid-template-columns:1fr}.card{padding:18px}.btn{max-width:none;width:100%}.back{flex:0 0 auto}.actions .btn{flex:1 1 0}.adpick{grid-template-columns:1fr}}`;

/**
 * Guided buy (Randy, voice, Nov 21 2026: "really, really easy to complete"): one step on screen at a time,
 * "Step N of 3" + a one-line hint, plan first (preselected from the link), then contact, then the ad, which can
 * now be sent later (nothing runs until a person approves it). Answers are kept in this browser until the order
 * is sent; Back on every step; inline checks; a clear success screen with what happens next.
 */
export function renderBuyPage(opts: { checkoutLive: boolean; plan?: unknown; prefill?: import("../lib/buyFlow").BuyPrefill | null; currency?: ReserveCurrency; query?: Record<string, unknown> }): string {
  const currency: ReserveCurrency = opts.currency ?? "usd";
  const C = currency.toUpperCase();
  const PLANS_NOW = buyPlans(currency);
  const pf = opts.prefill ?? {};
  const val = (v?: string) => (v ? ` value="${esc(v)}"` : "");
  // ?plan= preselects a plan (deep links from the kit / media kit). Unknown values keep the default.
  const pre = findPlan(opts.plan)?.key ?? BUY_PLANS[0]!.key;
  const formats = BUY_FORMATS.map(
    (f, i) => `<label class="pick" data-premium="${f.premium ? 1 : 0}"><input type="radio" name="format" value="${f.key}"${i === 0 ? " checked" : ""}>${MOCK[f.key] ?? ""}<strong>${esc(f.label)}</strong><small>${esc(f.hint)}</small>${f.premium ? `<span class="lock">Pick Starter placement above to use this spot</span>` : ""}</label>`,
  ).join("");
  const plans = PLANS_NOW.map(
    (p) => `<label class="pick" data-pay="${p.pay}"><input type="radio" name="plan" value="${p.key}"${p.key === pre ? " checked" : ""}><span class="price">${esc(p.price)}</span><strong>${esc(p.name)}</strong><small>${esc(p.line)}</small><span class="tag">${p.pay === "card" ? "Card" : "Card · then IO"}</span></label>`,
  ).join("");
  const planMeta = Object.fromEntries(PLANS_NOW.map((p) => [p.key, { name: p.name, price: p.price, pay: p.pay }]));
  const formatMeta = Object.fromEntries(BUY_FORMATS.map((f) => [f.key, f.label]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(TITLE)} | Birch Reserve</title><meta name="description" content="${esc(DESCRIPTION)}">
${publicSeoTags(BUY_PATH, TITLE, DESCRIPTION)}
<link rel="icon" href="/favicon.svg"><style>${TOKENS_CSS}${CSS}${BUYER_HEADER_CSS}${PRICE_LADDER_CSS}</style></head><body>
${buyerHeaderHtml("buy", currencyToggleHtml(currency, (c) => currencyHref("/buy", opts.query ?? {}, c)))}
<main class="wrap">
<section class="hero"><h1>${esc(BUY_TAGLINE)}</h1><p class="lede">3 short steps · about 1 minute · ${C} · nothing runs until a person approves your ad</p>
<div class="prog" id="prog" aria-live="polite"><div class="row"><span id="prog-n">Step 1 of 3</span><span id="prog-t">Your plan</span></div><div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1" id="prog-bar"><i style="width:33%"></i></div></div></section>

<form class="card step on" id="s1" data-step="1" novalidate><h2>Pick your plan</h2>
<p class="hint" id="s1-hint">We picked the plan from the link you clicked. Change it if you like, then press Next.</p>
<p class="saved" id="saved">We kept what you entered last time. <button type="button" id="start-over">Start over</button></p>
<div class="plans" role="radiogroup" aria-label="Plan">${plans}</div>
<p class="sub">Where your ad shows</p>
<div class="picks" role="radiogroup" aria-label="Where it shows">${formats}</div>
<div class="actions"><button class="btn" id="s1-go" type="submit">Next: your details →</button></div>
<p class="msg" id="s1-msg" role="status" aria-live="polite"></p></form>

<form class="card step" id="s2" data-step="2" novalidate autocomplete="on"><h2>Your details</h2>
<p class="hint">Four quick fields for your receipt and insertion order. No password, no account to manage.</p>${opts.prefill ? `<p class="msg ok" id="s1-pf">Filled in from your kit. Check it, add your name, and continue.</p>` : ""}
<div class="g2"><div><label class="f" for="b-name">Your name</label><input type="text" id="b-name" name="name" required maxlength="120" autocomplete="name" autocapitalize="words"${val(pf.name)}><span class="fe" id="e-name"></span></div>
<div><label class="f" for="b-email">Work email</label><input type="email" id="b-email" name="email" required maxlength="200" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" placeholder="you@yourbrand.com"${val(pf.email)}><span class="fe" id="e-email"></span></div>
<div><label class="f" for="b-company">Company</label><input type="text" id="b-company" name="company" required maxlength="160" autocomplete="organization"${val(pf.company)}><span class="fe" id="e-company"></span></div>
<div><label class="f" for="b-web">Company website</label><input type="text" id="b-web" name="website" required maxlength="300" placeholder="yourbrand.com" autocomplete="url" inputmode="url" autocapitalize="none" spellcheck="false"${val(pf.website)}><span class="fe" id="e-website"></span></div></div>
<div class="hp" aria-hidden="true"><label for="b-fax">Fax</label><input type="text" id="b-fax" name="fax" tabindex="-1" autocomplete="off"></div>
<div class="actions"><button class="back" type="button" data-back="1">← Back</button><button class="btn" id="s2-go" type="submit">Next: your ad →</button></div>
<p class="msg" id="s2-msg" role="status" aria-live="polite"></p></form>

<form class="card step" id="s3" data-step="3" novalidate><h2>Your ad, then confirm</h2>
<p class="hint">Upload your ad now, or send it later. Then tick the box and press the green button.</p>
<div class="adpick" role="radiogroup" aria-label="Your ad"><label class="pick"><input type="radio" name="admode" value="now" checked><strong>Upload it now</strong><small>PNG, JPG, WebP or GIF · up to 2 MB · <a href="/ads/specs" target="_blank" rel="noopener">sizes &amp; templates</a></small></label><label class="pick"><input type="radio" name="admode" value="later"><strong>Send it later</strong><small>We'll ask for it with your insertion order. Nothing runs until it's approved.</small></label></div>
<div id="ad-now"><label class="drop" id="drop"><strong>Drop your image here, or tap to choose</strong><span>PNG, JPG, WebP or GIF · up to 2 MB · at least ${CREATIVE_MIN_PX} px a side</span>
<input type="file" id="b-file" accept="${CREATIVE_TYPES.join(",")}" aria-label="Choose your ad image"></label>
<div class="preview" id="pv"><img id="pv-img" alt="Your ad preview"><div><strong id="pv-name"></strong><br><small id="pv-meta"></small></div></div>
<details><summary>Ad rules</summary><ul><li>Every ad is checked by a person before it runs. We'll reply if anything needs a change.</li><li>No medical claims, before-and-after photos or prices that are not real.</li><li>Need a size made for you? Upload what you have and say so; we'll help.</li></ul></details></div>
<details class="ex"><summary>Example: what your ad looks like on a hub</summary><figure style="margin:8px 0 0"><img src="/ads-examples/hub-example-sole.webp" width="1280" height="720" loading="lazy" alt="Example: a sample ad shown inside a partner hub page, marked Sponsored" style="width:100%;height:auto;border-radius:10px;border:1px solid #e5e7eb"><figcaption class="hint">Illustration only, not a live placement. Ads run on a partner hub only once that hub is approved for ads.</figcaption></figure></details>
<p class="msg" id="s2b-msg" role="status" aria-live="polite"></p>
<div class="sum" id="sum" data-testid="buy-summary"></div>
<label class="check"><input type="checkbox" id="b-terms" required><span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms</a> (for Starter placement, the <a href="/terms#exclusive" target="_blank" rel="noopener">placement terms</a>). My ad is reviewed before it runs.</span></label>
<span class="fe" id="e-terms"></span>
<div data-promo-box></div>
<div class="actions"><button class="back" type="button" data-back="2">← Back</button><button class="btn alt" id="s3-go" type="submit">${opts.checkoutLive ? "Continue to secure checkout" : "Send my order"}</button></div>
<p class="msg" id="s3-msg" role="status" aria-live="polite"></p>
<ul class="trust"><li>Card checkout by Stripe</li><li>Bank check when your bank asks</li><li>Ad reviewed by a person</li><li>Prices and checkout in ${C}</li></ul>
<details><summary>Small print</summary><ul><li>Card plans open Stripe Checkout. Stripe verifies the card and screens for fraud; your bank may ask you to confirm.</li><li>The $490 category placement is 100% media credit, refundable until 14 days before launch. The $190 look converts in full to the category placement within 7 days, or is refunded.</li><li>The starter placement is ${PLANS_NOW.find((p) => p.key === "exclusive")!.price} by card. It holds one dedicated package in your category ($5K–$50K ${C}) pending your insertion order, counted in full; the package rate is set on the IO, at or below the rate card. Refunded if you are bumped by another advertiser before you have finalized payment. <a href="/terms#exclusive" target="_blank" rel="noopener">Placement terms</a>. Premium slots ($25,000–$1.5M) are by inquiry.</li><li>Your ad shows inside private retail hubs. Placement is named in your insertion order before anything runs.</li><li>No impression guarantee. Aggregate reporting only. No patient data.</li></ul></details></form>

<div class="card done-box" id="done" role="status"><h2 id="done-h">Got it.</h2><p id="done-p"></p><p class="sub">What happens next</p><ol id="done-next"><li>We email your insertion order within 1 business day. It names the hub, placement and dates.</li><li>A person checks your ad. No ad yet? Reply to that email with it.</li><li>You approve the insertion order. Then it runs.</li></ol><div class="actions"><a class="btn" href="/media-kit">See the media kit</a><a class="back" href="/" style="display:inline-flex;align-items:center;text-decoration:none">Back to Birch Reserve</a></div></div>
</main>
<footer><div class="wrap">Silver Birch Growth Inc. · Toronto · <a href="mailto:randy@scalehealth.ca">randy@scalehealth.ca</a></div></footer>
${PROMO_SCRIPT_TAG}
<script>
(function(){var acct=null,crv=null,live=${opts.checkoutLive ? "true" : "false"},cur=1,hasPf=${opts.prefill ? "true" : "false"};
var CUR=${JSON.stringify(currency)},PLANS=${JSON.stringify(planMeta).replaceAll("<", "\\u003c")},FORMATS=${JSON.stringify(formatMeta).replaceAll("<", "\\u003c")};
var TITLES=["Your plan","Your details","Your ad + confirm"],KEY="br-form:buy",SKEY="br-buy-session";
function $(id){return document.getElementById(id)}
function msg(el,t,err){el.textContent=t||"";el.className="msg"+(t?(err?" err":" ok"):"")}
var EM=/^[^\\s@]{1,64}@[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$/i,WS=/^(https?:\\/\\/)?([a-z0-9-]+\\.)+[a-z]{2,}(\\/.*)?$/i;
function ferr(name,v){v=(v||"").trim();if(name==="name")return v.length<2?"Add your name.":"";if(name==="company")return v.length<2?"Add your company name.":"";if(name==="email")return !v?"Add your work email.":EM.test(v)?"":"That email looks off. Check for a typo, like name@company.com.";if(name==="website")return !v?"Add your website, like yourbrand.com.":WS.test(v)?"":"Use a web address like yourbrand.com.";return""}
function show(name,t){var i=$("s2").elements[name],e=$("e-"+name);if(e)e.textContent=t||"";if(i){if(t)i.setAttribute("aria-invalid","true");else i.removeAttribute("aria-invalid")}}
function step(n,noScroll){cur=n;[1,2,3].forEach(function(i){$("s"+i).classList.toggle("on",i===n)});$("prog-n").textContent="Step "+n+" of 3";$("prog-t").textContent=TITLES[n-1];$("prog-bar").setAttribute("aria-valuenow",String(n));$("prog-bar").firstChild.style.width=Math.round(n/3*100)+"%";if(n===3)summary();save();if(!noScroll){$("prog").scrollIntoView({behavior:"smooth",block:"start"});var f=$("s"+n).querySelector("input:not([type=hidden]):not([tabindex='-1'])");if(f&&n===2&&!f.value)setTimeout(function(){f.focus({preventScroll:true})},250)}}
async function post(url,body,headers){var r=await fetch(url,{method:"POST",headers:Object.assign({"content-type":"application/json"},headers||{}),body:body});var o={};try{o=await r.json()}catch(_){}return{ok:r.ok,status:r.status,body:o}}
function pick(name){var x=document.querySelector("input[name="+name+"]:checked");return x?x.value:""}
function fields(){var f=$("s2");return{name:f.name.value,email:f.email.value,company:f.company.value,website:f.website.value}}
function save(){try{var d=fields();d.plan=pick("plan");d.format=pick("format");localStorage.setItem(KEY,JSON.stringify({at:Date.now(),v:d}));sessionStorage.setItem(SKEY,JSON.stringify({acct:acct,crv:crv,step:cur}))}catch(_){}}
function clearSave(){try{localStorage.removeItem(KEY);sessionStorage.removeItem(SKEY)}catch(_){}}
function summary(){var p=PLANS[pick("plan")]||{},d=fields(),later=pick("admode")==="later";$("sum").innerHTML="";var add=function(k,v){var r=document.createElement("div");var b=document.createElement("b");b.textContent=k+": ";r.appendChild(b);r.appendChild(document.createTextNode(v));$("sum").appendChild(r)};add("Plan",(p.name||"")+" · "+(p.price||""));add("Where it shows",FORMATS[pick("format")]||"");add("For",(d.company||"")+" · "+(d.email||""));add("Your ad",later?"Sending later":(crv?"Uploaded, held for review":"Not uploaded yet"));var e=document.createElement("a");e.href="#";e.textContent="Change plan";e.onclick=function(ev){ev.preventDefault();step(1)};$("sum").appendChild(e);$("s3-go").textContent=p.pay==="reserve"?"Continue to secure checkout · "+(p.price||""):(live?"Continue to secure checkout · "+(p.price||""):"Send my order →")}
// restore: kit prefill wins for contact fields; plan from the URL wins for the plan.
(function(){try{var o=JSON.parse(localStorage.getItem(KEY)||"null");if(o&&o.v&&Date.now()-o.at<6048e5){var f=$("s2"),v=o.v,any=false;["name","email","company","website"].forEach(function(k){if(v[k]&&!f[k].value){f[k].value=String(v[k]).slice(0,300);any=true}});if(v.format){var fm=document.querySelector("input[name=format][value='"+String(v.format).replace(/[^a-z_]/g,"")+"']");if(fm)fm.checked=true}if(v.plan&&!/[?&]plan=/.test(location.search)){var pl=document.querySelector("input[name=plan][value='"+String(v.plan).replace(/[^a-z0-9-]/g,"")+"']");if(pl)pl.checked=true}if(any&&!hasPf)$("saved").classList.add("on")}}catch(_){}
try{var q=JSON.parse(sessionStorage.getItem("br_quick_reserve")||"null");if(q){var f2=$("s2");if(q.brand&&!f2.company.value)f2.company.value=String(q.brand).slice(0,160);if(q.email&&!f2.email.value)f2.email.value=String(q.email).slice(0,200)}}catch(_){}
try{var ss=JSON.parse(sessionStorage.getItem(SKEY)||"null");if(ss&&ss.acct){acct=ss.acct;crv=ss.crv||null}}catch(_){}})();
$("start-over").addEventListener("click",function(){clearSave();["name","email","company","website"].forEach(function(k){$("s2")[k].value=""});acct=null;crv=null;$("saved").classList.remove("on")});
document.querySelectorAll("[data-back]").forEach(function(b){b.addEventListener("click",function(){step(Number(b.getAttribute("data-back")))})});
// Step 1: plan + spot. A card plan cannot use an exclusive-only spot: that spot is disabled with a note, never silently switched.
var s1=$("s1");function sync(){var plan=pick("plan"),card=(PLANS[plan]||{}).pay==="card";s1.querySelectorAll(".picks .pick").forEach(function(p){var inp=p.querySelector("input"),prem=p.getAttribute("data-premium")==="1";inp.disabled=card&&prem;if(inp.disabled&&inp.checked){inp.checked=false;s1.querySelector(".picks .pick:not([data-premium='1']) input").checked=true}});save()}
s1.addEventListener("change",sync);sync();
s1.addEventListener("submit",function(e){e.preventDefault();if(!pick("plan")||!pick("format")){msg($("s1-msg"),"Pick a plan and a spot.",true);return}msg($("s1-msg"),"");step(acct?3:2)});
// Step 2: contact → signed account token (no password, no visitor email).
var s2=$("s2");["name","email","company","website"].forEach(function(k){var i=s2.elements[k];i.addEventListener("blur",function(){if(i.value.trim())show(k,ferr(k,i.value))});i.addEventListener("input",function(){if(i.getAttribute("aria-invalid"))show(k,ferr(k,i.value));if(acct){acct=null;crv=null}save()})});
s2.addEventListener("submit",async function(e){e.preventDefault();var m=$("s2-msg"),bad=null;["name","email","company","website"].forEach(function(k){var t=ferr(k,s2.elements[k].value);show(k,t);if(t&&!bad)bad=k});if(bad){s2.elements[bad].focus();msg(m,"");return}
var b=$("s2-go");b.disabled=true;msg(m,"Saving…");var d=Object.fromEntries(new FormData(s2));try{var r=await post("/v1/buy/account",JSON.stringify(d));if(r.ok&&r.body.account){acct=r.body.account;msg(m,"");msg($("s2b-msg"),r.body.note||"",false);b.disabled=false;step(3);return}msg(m,r.body.error||"That didn't work. Try again.",true);if(r.body.field){show(r.body.field,r.body.error);var el=s2.elements[r.body.field];if(el)el.focus()}}catch(_){msg(m,"Network problem. Check your connection and press Next again.",true)}b.disabled=false});
// Step 3: ad (now or later) + terms → order.
var s3=$("s3");s3.querySelectorAll("input[name=admode]").forEach(function(r){r.addEventListener("change",function(){$("ad-now").style.display=pick("admode")==="later"?"none":"";msg($("s2b-msg"),"");summary()})});
var drop=$("drop"),file=$("b-file");
["dragenter","dragover"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add("over")})});["dragleave","drop"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove("over")})});
drop.addEventListener("drop",function(e){if(e.dataTransfer.files[0])upload(e.dataTransfer.files[0])});file.addEventListener("change",function(){if(file.files[0])upload(file.files[0])});
async function upload(fl){var m=$("s2b-msg");if(!acct){msg(m,"Add your details first.",true);step(2);return}if(${JSON.stringify(CREATIVE_TYPES)}.indexOf(fl.type)<0){msg(m,"Use a PNG, JPG, WebP or GIF image. Or pick Send it later.",true);return}if(fl.size>${CREATIVE_MAX_BYTES}){msg(m,"That file is over 2 MB. Export a smaller one, or pick Send it later.",true);return}
msg(m,"Uploading…");var url=URL.createObjectURL(fl);$("pv-img").src=url;$("pv-name").textContent=fl.name;$("pv").classList.add("on");
try{var r=await fetch("/v1/buy/creative",{method:"POST",headers:{"content-type":fl.type,"x-buy-account":acct},body:fl});var o={};try{o=await r.json()}catch(_){}if(r.ok&&o.creative){crv=o.creative;$("pv-meta").textContent=o.width+" × "+o.height+" px · "+Math.max(1,Math.round(o.bytes/1024))+" KB · held for review";msg(m,"Uploaded. A person checks it before it runs.",false);save();summary();return}crv=null;if(r.status===401){msg(m,"Your session timed out. Press Back and Next to refresh it.",true);acct=null;return}msg(m,(o.error||"Upload failed.")+" Or pick Send it later.",true)}catch(_){crv=null;msg(m,"Upload failed. Try again, or pick Send it later.",true)}summary()}
$("b-terms").addEventListener("change",function(){if(this.checked)$("e-terms").textContent=""});
s3.addEventListener("submit",async function(e){e.preventDefault();var m=$("s3-msg"),b=$("s3-go"),later=pick("admode")==="later";if(!acct){msg(m,"");step(2);msg($("s2-msg"),"Press Next to confirm your details.",true);return}if(!later&&!crv){msg(m,"Upload your ad, or pick Send it later.",true);drop.scrollIntoView({behavior:"smooth",block:"center"});return}if(!$("b-terms").checked){$("e-terms").textContent="Tick the box to agree to the terms.";$("b-terms").focus();return}
b.disabled=true;msg(m,"Saving your order…");var plan=pick("plan"),fmt=pick("format");
try{var r=await post("/v1/buy/order",JSON.stringify({account:acct,creative:later?null:crv,creative_later:later,plan:plan,format:fmt,terms:true,currency:CUR}));if(!r.ok){if(r.status===401){acct=null;msg(m,"");step(2);msg($("s2-msg"),"Your session timed out. Press Next to refresh it. Your answers are still here.",true);b.disabled=false;return}msg(m,r.body.error||"That didn't work. Try again.",true);b.disabled=false;return}
if(r.body.next==="checkout"&&r.body.checkout){msg(m,"Opening secure checkout…");var c=await post("/v1/checkout",JSON.stringify(r.body.checkout));if(c.body.checkout_url){save();location.assign(c.body.checkout_url);return}if(c.body.order_id){finish("Order saved.","No card was charged. We'll confirm by email or call (647) 931-6278. Ref "+r.body.order_id.slice(0,8)+".");return}msg(m,c.body.error||"Checkout could not open. Call (647) 931-6278.",true);b.disabled=false;return}
if(r.body.next==="reserve"&&r.body.reserve){msg(m,"Opening secure checkout…");var x=await post("/v1/exclusive/reserve",JSON.stringify(r.body.reserve));if(x.body.url){save();location.assign(x.body.url);return}if(x.body.held){finish("Request received.",x.body.message+" Ref "+r.body.order_id.slice(0,8)+".");return}msg(m,x.body.error||"Checkout could not open. Call (647) 931-6278.",true);b.disabled=false;return}
finish("Order received.","We'll be in touch within 1 business day. Your ad is held for review. No card was charged. Ref "+r.body.order_id.slice(0,8)+".")}catch(_){msg(m,"Network problem. No payment was taken. Try again.",true);b.disabled=false}});
function finish(h,p){clearSave();["s1","s2","s3"].forEach(function(id){$(id).classList.remove("on")});$("prog-n").textContent="Done";$("prog-t").textContent="Order received";$("prog-bar").firstChild.style.width="100%";$("done-h").textContent=h;$("done-p").textContent=p;$("done").classList.add("on");$("done").scrollIntoView({behavior:"smooth"})}
if(/[?&]checkout=cancelled/.test(location.search)){step(acct?3:1,true);msg($("s"+(acct?3:1)+"-msg"),"Checkout was cancelled. No payment was taken. Your answers are still here.",false)}
else if(acct){step(3,true)}
summary();
})();
</script></body></html>`;
}

router.get(["/buy", "/buy/"], (req, res): void => {
  const prefill = openPrefill(req.query.pf);
  // A prefilled page carries the visitor's details: never cache it anywhere.
  if (req.query.pf !== undefined) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader("Referrer-Policy", "no-referrer");
  } else res.setHeader("Cache-Control", "private, no-cache");
  const currency = pageCurrency(req, res).currency;
  res.type("html").send(renderBuyPage({ checkoutLive: isReserveCheckoutConfigured(), plan: req.query.plan, prefill, currency, query: req.query as Record<string, unknown> }));
});

export default router;
