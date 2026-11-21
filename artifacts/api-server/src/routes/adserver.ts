import { mirrorPathOf } from "../lib/adserver/promoContext";
import { decideCurrency } from "../lib/currency";
/**
 * Birch Reserve ad system routes (Randy t330u, Nov 21 2026).
 *   Public:   /ads/embed.js · /ads/px.js · /ads/docs · /v1/ads/serve · /v1/ads/v · /v1/ads/c · /v1/ads/px · /v1/ads/postback · /v1/ads/cr/:id
 *   Customer: /account (+ /login, /auth, /logout, /alerts, /creative, /report.csv)
 *   Admin:    /ads/admin (+ campaigns, creatives, royalties, ledger, exports, Friday sync)
 *   Cron:     /api/cron/ads-friday (daily aggregate push to Friday)
 */
import * as promoLib from "../lib/adserver/promo";
import { hubProofAdminHtml, listProofs } from "../lib/adserver/hubProof";
import { promoAdminHtml } from "../lib/adserver/promoAdmin";
import { attachPendingForAccount } from "../lib/adserver/promo";
import express, { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getStripeClient } from "../lib/stripeClient";
import { buyStore } from "../lib/buyFlow";
import { cronAuthorized } from "../lib/cronAuth";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { ADS_FROM, hubAlertEmail, loginLinkEmail, siteMail } from "../lib/adserver/mail";
import { sendBuyerEmail } from "../lib/siteMail";
import { renderSalesAlert } from "../lib/salesAlert";
import { renderLocalBizLeadEmail } from "../lib/localBizLeadNotify";
import { renderEmailCaptureEmail } from "../lib/emailCapture";
import { renderTranscriptEmail } from "../lib/randyChatTranscripts";
import { renderKitEmail, renderNudgeEmail } from "../lib/kitEmails";
import { buildHoldConfirmationEmail, buildPrepayConfirmationEmail } from "../lib/prepayConfirmationEmail";
import { AD_SLOTS, ALERT_CATEGORIES, AD_DEFAULTS, PROMO_RATE_BPS, isPromoCampaign, MICROS, PLACEMENTS, adminEmails, adsLoginEmailEnabled, findSlot, placementLabel, type Placement } from "../lib/adserver/config";
import { pixelId, postbackKey, safeEqual, sign, verify } from "../lib/adserver/auth";
import * as store from "../lib/adserver/store";
import { maxPoolAllocationBps, maxReferrerAllocationBps, recipientsAt, splitReferralOrders } from "../lib/adserver/payoutSplit";
import { listReferralOrders, toLine as toReferralLine } from "../lib/adserver/referrals";
import { referralAdminHtml } from "../lib/adserver/referralAdmin";
import { partnersAdminHtml } from "../lib/adserver/partnersAdmin";
import { activationAdminHtml } from "../lib/adserver/activationAdmin";
import { getLeadStore } from "../lib/leads";
import { draftCampaignFromCheckoutSafe, recordClick, recordConversion, recordView, serve } from "../lib/adserver/service";
import { EMBED_JS, PIXEL_JS } from "../lib/adserver/embed";
import { dashboardPage, loginPage } from "../lib/adserver/accountPage";
import { adminLoginPage, adminPage } from "../lib/adserver/adminPage";
import { docsPage } from "../lib/adserver/docsPage";
import { checkUpload, checkVariant, findFormat, matchFormat, templateSvg, MAX_VIDEO_BYTES, VARIANT_ROLES, MAX_VARIANTS, type VariantRole } from "../lib/adserver/creativeSpec";
import { specsPage, hubKitPage } from "../lib/adserver/specsPage";
import { fridayReady, syncToFriday } from "../lib/adserver/friday";
import { toCsv } from "../lib/adserver/ui";
import type { CampaignPatch } from "../lib/adserver/store";

export const AD_CREATIVE_MIN = { width: 300, height: 50 } as const;

const router: IRouter = Router();
const json = express.json({ limit: "32kb" });
const raw = express.raw({ type: ["image/*", "video/*", "application/octet-stream"], limit: MAX_VIDEO_BYTES + 64 * 1024 });
const loginLimiter = new FixedWindowLimiter({ max: 8, windowMs: 15 * 60_000 });
const pxLimiter = new FixedWindowLimiter({ max: 120, windowMs: 60_000 });

const origin = (req: Request) => {
  const host = req.get("x-forwarded-host") ?? req.get("host") ?? "birchreserve.net";
  return `${/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https"}://${host}`;
};
const ACCT = "br_ads_acct";
const ADM = "br_ads_adm";
function cookie(req: Request, name: string): string | null {
  const raw = req.get("cookie") ?? "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}
function setCookie(res: Response, name: string, value: string, maxAgeSec: number, path = "/"): void {
  res.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`);
}
const sameOrigin = (req: Request) => {
  const o = req.get("origin");
  if (!o) return req.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(o).host === (req.get("x-forwarded-host") ?? req.get("host"));
  } catch {
    return false;
  }
};
const customer = (req: Request) => verify<{ e: string }>("a", cookie(req, ACCT))?.e ?? null;
const admin = (req: Request) => {
  const t = verify<{ e: string }>("adm", cookie(req, ADM));
  return t && adminEmails().includes(t.e) ? t.e : null;
};
const ua = (req: Request) => req.get("user-agent");
const dntHeader = (req: Request) => req.get("dnt") === "1" || req.get("sec-gpc") === "1";
const promoPanels = async () => {
  const [codes, redemptions, street, qrs] = await Promise.all([promoLib.listCodes(), promoLib.listRedemptions(300), promoLib.streetStats(true), promoLib.listQrs()]);
  return promoAdminHtml({ codes, redemptions, street, qrs }) + hubProofAdminHtml(await listProofs());
};
/** Referral orders (QR / street team / partner links) with their commission detail, for the payouts view. */
const referralPanel = async (recips: Awaited<ReturnType<typeof store.recipientHistory>>) => {
  const [orders, rates, chRates, members] = await Promise.all([listReferralOrders({ includeTest: true, limit: 2000 }), store.rateHistory(), store.channelRateHistory(), promoLib.members()]);
  const { detail } = splitReferralOrders(orders.map(toReferralLine), rates, recips, chRates);
  const refMembers = members.map((m) => ({ id: m.id, label: m.label }));
  return { referralHtml: referralAdminHtml({ orders, detail, members: refMembers, recipients: recips }), referrers: refMembers };
};
const promoAttach = (email: string) => attachPendingForAccount(email).catch(() => 0);
const noStore = (res: Response) => res.set("Cache-Control", "no-store");
const cors = (res: Response) => res.set({ "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Timing-Allow-Origin": "*" });
const str = (v: unknown, n = 300) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

async function safe(res: Response, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "adserver route failed");
    if (!res.headersSent) res.status(500).json({ error: "Something went wrong. Try again." });
  }
}

/* ------------------------------------------------------------------------------------------ scripts + docs */
router.get("/ads/embed.js", (_req, res) => {
  cors(res);
  res.set("Cache-Control", "public, max-age=300").type("application/javascript").send(EMBED_JS);
});
router.get("/ads/px.js", (_req, res) => {
  cors(res);
  res.set("Cache-Control", "public, max-age=300").type("application/javascript").send(PIXEL_JS);
});
router.get(["/ads/docs", "/ads/docs/"], async (req, res) => {
  await store.db().catch(() => undefined); // include hubs onboarded on contract
  res.set("Cache-Control", "public, max-age=300").type("html").send(docsPage(origin(req)));
});
router.get(["/ads", "/ads/"], (_req, res) => res.redirect(302, "/ads/docs"));
// Creative specs (public) and the hub drop-in kit (unlisted handoff for hub builders). ?br_mirror=scale = Scale skin.
const skinOf = (req: Request) => (req.query.br_mirror === "scale" ? "scale" : "birch") as "scale" | "birch";
router.get(["/ads/specs", "/ads/specs/", "/creative-specs"], (req, res) => {
  const skin = skinOf(req);
  res.set("Cache-Control", skin === "scale" ? "private, no-store" : "public, max-age=300").type("html").send(specsPage({ skin }));
});
router.get(["/ads/hub-kit", "/ads/hub-kit/"], (req, res) => {
  const skin = skinOf(req);
  res.set("Cache-Control", skin === "scale" ? "private, no-store" : "public, max-age=300").set("X-Robots-Tag", "noindex").type("html").send(hubKitPage({ skin }));
});
router.get("/ads/specs/templates/:file", (req, res) => {
  const png = /^([a-z_]+)\.png$/.exec(String(req.params.file));
  if (png && findFormat(png[1])) {
    res.redirect(302, `/ads-specs/templates/${png[1]}.png`); // static file (artifacts/clinichub-media/public/ads-specs)
    return;
  }
  const m = /^([a-z_]+)\.svg$/.exec(String(req.params.file));
  const f = m ? findFormat(m[1]) : undefined;
  if (!f) {
    res.status(404).type("text").send("Unknown template");
    return;
  }
  cors(res);
  res.set({ "Cache-Control": "public, max-age=3600", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" });
  if (req.query.download !== undefined) res.set("Content-Disposition", `attachment; filename="birch-${f.key}-${f.upload[0]}x${f.upload[1]}.svg"`);
  res.type("image/svg+xml").send(templateSvg(f));
});

/* ------------------------------------------------------------------------------------------ serving */
router.options("/v1/ads/*splat", (_req, res) => {
  cors(res);
  res.status(204).end();
});

router.get("/v1/ads/serve", (req, res) =>
  safe(res, async () => {
    cors(res);
    noStore(res);
    const formats = str(req.query.fmt, 200).split(",").map((x) => x.trim()).filter((x) => findFormat(x));
    const r = await serve({ slot: str(req.query.slot, 80), formats: formats.length ? formats : null, vid: str(req.query.v, 64) || null, test: req.query.test === "1", ua: ua(req), dnt: req.query.dnt === "1" || dntHeader(req), origin: origin(req) });
    res.json(r);
  }),
);

const viewHandler = (req: Request, res: Response) =>
  safe(res, async () => {
    cors(res);
    noStore(res);
    await recordView(req.query.t, ua(req));
    res.status(204).end();
  });
router.get("/v1/ads/v", viewHandler);
router.post("/v1/ads/v", viewHandler);

router.get("/v1/ads/c", (req, res) =>
  safe(res, async () => {
    noStore(res);
    const r = await recordClick(req.query.t, ua(req));
    res.set("Referrer-Policy", "no-referrer-when-downgrade").redirect(302, r.location);
  }),
);

const pxHandler = (req: Request, res: Response) =>
  safe(res, async () => {
    cors(res);
    noStore(res);
    if (!dntHeader(req) && !pxLimiter.hit(req.ip ?? "?").limited && str(req.query.e, 40) === "conversion") {
      const val = Number(req.query.val);
      await recordConversion({
        source: "pixel", pixel: str(req.query.p, 40), clickId: str(req.query.ck, 40) || null,
        viewIds: str(req.query.vw, 500).split(",").filter(Boolean), value: Number.isFinite(val) ? val : null, currency: str(req.query.cur, 3) || null, orderId: str(req.query.oid, 200) || null,
      });
    }
    if (req.method === "POST") res.status(204).end();
    else res.type("image/gif").send(GIF);
  });
router.get("/v1/ads/px", pxHandler);
router.post("/v1/ads/px", pxHandler);

const postbackHandler = (req: Request, res: Response) =>
  safe(res, async () => {
    noStore(res);
    const q = { ...(req.query as Record<string, unknown>), ...((req.body as Record<string, unknown>) ?? {}) };
    const key = str(q.key, 60);
    if (!key.startsWith("pb_")) {
      res.status(401).json({ ok: false, error: "missing or invalid key" });
      return;
    }
    const emails = [...new Set((await store.listCampaigns()).map((c) => c.accountEmail))];
    const email = emails.find((e) => safeEqual(postbackKey(e), key));
    if (!email) {
      res.status(401).json({ ok: false, error: "missing or invalid key" });
      return;
    }
    const val = Number(q.value);
    const r = await recordConversion({ source: "postback", accountEmail: email, clickId: str(q.click_id, 40) || null, value: Number.isFinite(val) ? val : null, currency: str(q.currency, 3) || null, orderId: str(q.order_id, 200) || null });
    res.json({ ok: true, ...r });
  });
router.get("/v1/ads/postback", postbackHandler);
router.post("/v1/ads/postback", json, postbackHandler);

/** Sends creative bytes. Supports HTTP Range (Safari and iOS will not play a video without 206 responses). */
function sendMedia(req: Request, res: Response, mime: string, data: Buffer): void {
  res.set({ "Content-Type": mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'", "Accept-Ranges": "bytes", "Cross-Origin-Resource-Policy": "cross-origin" });
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.get("range") ?? "");
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, data.length - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
    if (start >= data.length || start > end) {
      res.status(416).set("Content-Range", `bytes */${data.length}`).end();
      return;
    }
    start = Math.max(0, start);
    end = Math.max(start, end);
    res.status(206).set("Content-Range", `bytes ${start}-${end}/${data.length}`).send(data.subarray(start, end + 1));
    return;
  }
  res.send(data);
}

async function mediaAccess(req: Request, res: Response, row: { status: string; accountEmail: string }): Promise<boolean> {
  if (row.status !== "approved") {
    const mine = Boolean(admin(req)) || customer(req) === row.accountEmail;
    if (!mine) {
      res.status(404).end();
      return false;
    }
    res.set("Cache-Control", "private, no-store");
  } else {
    cors(res);
    res.set("Cache-Control", "public, max-age=86400");
  }
  return true;
}

router.get("/v1/ads/cr/:id", (req, res) =>
  safe(res, async () => {
    const id = String(req.params.id).replace(/\.[a-z0-9]+$/, "");
    const cr = await store.creativeData(id);
    if (!cr) {
      res.status(404).end();
      return;
    }
    if (!(await mediaAccess(req, res, cr))) return;
    sendMedia(req, res, cr.mime, cr.data);
  }),
);

/* Responsive variant (WebP / AVIF) or video poster of a creative. Same visibility rule as the creative itself. */
router.get("/v1/ads/crv/:id", (req, res) =>
  safe(res, async () => {
    const v = await store.variantData(String(req.params.id).replace(/\.[a-z0-9]+$/, ""));
    if (!v) {
      res.status(404).end();
      return;
    }
    if (!(await mediaAccess(req, res, v))) return;
    sendMedia(req, res, v.mime, v.data);
  }),
);

/* ------------------------------------------------------------------------------------------ customer */
async function accountView(email: string, o: string) {
  const campaigns = await store.listCampaigns({ email });
  const ids = campaigns.map((c) => c.id);
  const [totals, alerts] = await Promise.all([store.totalsByCampaign(ids), store.getAlertPrefs(email)]);
  const out = [];
  for (const c of campaigns) {
    const [days, slots, creatives] = await Promise.all([store.dailyFor([c.id], 30), store.bySlotFor([c.id], 400), store.listCreatives({ campaignId: c.id })]);
    out.push({
      c,
      t: totals.get(c.id) ?? { serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 },
      days: days.map((d) => ({ day: d.day, views: d.views, clicks: d.clicks })),
      bySlot: [...slots.entries()].filter(([, t]) => t.views + t.clicks + t.convs > 0).map(([k, t]) => ({ slot: findSlot(k)?.label ?? k, t })),
      creatives,
    });
  }
  return { email, campaigns: out, alerts, pixel: pixelId(email), postback: postbackKey(email), origin: o };
}

router.get(["/account", "/account/"], (req, res) =>
  safe(res, async () => {
    noStore(res);
    res.set("X-Robots-Tag", "noindex");
    const email = customer(req);
    if (!email) {
      res.type("html").send(loginPage({ error: req.query.e === "expired" ? "That sign-in link has expired or was already used. Ask for a new one below." : undefined }));
      return;
    }
    await promoAttach(email);
    res.setHeader("Vary", "Cookie, x-vercel-ip-country");
    res.type("html").send(dashboardPage(await accountView(email, origin(req)), Date.now(), decideCurrency(req).currency));
  }),
);

/** First sign-in straight from a paid Stripe Checkout Session (the success page links here). */
router.get("/account/login", (req, res) =>
  safe(res, async () => {
    noStore(res);
    const sid = str(req.query.session_id, 220);
    if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) {
      res.redirect(302, mirrorPathOf(req, "/account"));
      return;
    }
    let session;
    try {
      session = await getStripeClient().checkout.sessions.retrieve(sid);
    } catch {
      res.type("html").send(loginPage({ error: "We couldn't find that payment. Email randy@scalehealth.ca and we'll send your dashboard link." }));
      return;
    }
    const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    const fresh = Date.now() / 1000 - session.created < 45 * 86400;
    if (session.payment_status !== "paid" || !email || !fresh) {
      res.type("html").send(loginPage({ error: "That payment isn't complete yet. Refresh in a minute, or sign in with your email." }));
      return;
    }
    await draftCampaignFromCheckoutSafe(session);
    await promoAttach(email);
    setCookie(res, ACCT, sign("a", { e: email }, 14 * 864e5), 14 * 86400);
    // On the Scale mirror (scalehealth.ca/intake/_m/…, tagged br_mirror=scale) stay on the mirror instead of scalehealth.ca/account.
    res.redirect(302, mirrorPathOf(req, "/account"));
  }),
);

router.post("/account/login", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    if (!sameOrigin(req)) {
      res.status(403).json({ message: "Blocked." });
      return;
    }
    const email = str((req.body as { email?: unknown })?.email, 200).toLowerCase();
    if (loginLimiter.hit(`acct:${req.ip}`).limited || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ message: "Check your email and try again in a few minutes." });
      return;
    }
    const generic = { message: "If that email has a Birch Reserve campaign, a sign-in link is on its way. It expires in 24 hours." };
    if (!adsLoginEmailEnabled()) {
      res.status(503).json({ message: "Email sign-in links are switching on shortly. Email randy@scalehealth.ca for your dashboard link." });
      return;
    }
    const has = (await store.listCampaigns({ email })).length > 0;
    if (has) {
      const link = `${origin(req)}/account/auth?t=${encodeURIComponent(sign("l", { e: email }, 864e5))}`;
      await siteMail.loginLink(email, link).catch((err: unknown) => logger.warn({ err: String(err) }, "ads login email failed"));
    }
    res.json(generic);
  }),
);

router.get("/account/auth", (req, res) => {
  noStore(res);
  const t = verify<{ e: string }>("l", req.query.t);
  if (!t) {
    res.redirect(302, mirrorPathOf(req, "/account?e=expired"));
    return;
  }
  setCookie(res, ACCT, sign("a", { e: t.e }, 14 * 864e5), 14 * 86400);
  res.redirect(302, mirrorPathOf(req, "/account"));
});

router.post("/account/logout", json, (req, res) => {
  setCookie(res, ACCT, "", 0);
  res.json({ message: "Signed out", redirect: "/account" });
});

router.post("/account/alerts", json, (req, res) =>
  safe(res, async () => {
    const email = customer(req);
    if (!email || !sameOrigin(req)) {
      res.status(401).json({ message: "Sign in again." });
      return;
    }
    const b = req.body as { categories?: unknown; optedIn?: unknown };
    const cats = (Array.isArray(b.categories) ? b.categories : []).map(String).filter((c) => (ALERT_CATEGORIES as readonly string[]).includes(c));
    await store.setAlertPrefs(email, cats, b.optedIn === true && cats.length > 0);
    res.json({ message: b.optedIn === true && cats.length > 0 ? "Saved. You'll hear about new hubs in those categories." : "Saved." });
  }),
);

type UploadResult = { ok: boolean; message: string; field?: string; id?: string; kind?: string; format?: string | null; width?: number; height?: number; warnings?: string[] };
async function uploadCreative(req: Request, campaignId: string, actor: string, approve: boolean, force = false): Promise<UploadResult> {
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const chk = checkUpload(buf, { alt: req.query.alt, headline: req.query.headline, cta: req.query.cta }, { force });
  if (!chk.ok) return { ok: false, message: chk.error, field: chk.field };
  const v = chk.value;
  // A video needs a poster before it can run, so an admin "approve now" on a video waits for the poster.
  const status = approve && v.kind === "image" ? "approved" : "pending";
  const cr = await store.addCreative({ campaignId, mime: v.mime, width: v.width, height: v.height, data: buf, alt: v.alt, uploadedBy: actor, status, kind: v.kind, format: v.format, durationMs: v.durationMs, headline: v.headline, cta: v.cta, warnings: v.warnings });
  const fmt = findFormat(v.format);
  const head = `${fmt ? fmt.label : "Custom size"} ${v.width}×${v.height}${v.kind === "video" ? `, ${((v.durationMs ?? 0) / 1000).toFixed(1)}s` : ""}.`;
  const tail = status === "approved" ? " Uploaded and approved." : approve && v.kind === "video" ? " Uploaded. Approve it once the poster frame is in." : " Sent for review. We approve within 1 business day.";
  return { ok: true, message: `${head}${tail}${v.warnings.length ? ` Tip: ${v.warnings[0]}` : ""}`, id: cr.id, kind: v.kind, format: v.format, width: v.width, height: v.height, warnings: v.warnings };
}

/** Browser-made WebP / AVIF sizes and the video poster. Buyers can add them while the creative is in review; admins any time. */
async function uploadVariant(req: Request, res: Response, creativeId: string, actor: string, isAdmin: boolean): Promise<void> {
  const cr = await store.getCreative(creativeId);
  if (!cr || (!isAdmin && cr.accountEmail !== actor)) {
    res.status(404).json({ message: "Creative not found." });
    return;
  }
  if (!isAdmin && cr.status !== "pending") {
    res.status(409).json({ message: "This creative is already reviewed. Upload a new one to change it." });
    return;
  }
  const role = String(req.query.role ?? "") as VariantRole;
  if (!(VARIANT_ROLES as readonly string[]).includes(role)) {
    res.status(400).json({ message: "Unknown variant." });
    return;
  }
  if ((await store.listVariants([cr.id])).length >= MAX_VARIANTS && role !== "poster") {
    res.status(409).json({ message: "This creative already has its variants." });
    return;
  }
  const chk = checkVariant(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), role, { kind: cr.kind ?? "image", width: cr.width, height: cr.height });
  if (!chk.ok) {
    res.status(400).json({ message: chk.error });
    return;
  }
  await store.addVariant({ creativeId: cr.id, role, mime: chk.value.mime, width: chk.value.width, height: chk.value.height, data: req.body as Buffer, actor });
  res.json({ ok: true, message: role === "poster" ? "Poster frame saved." : `${role.toUpperCase()} ${chk.value.width}px saved.` });
}

function tooLarge(err: unknown, _req: Request, res: Response, next: (e?: unknown) => void): void {
  if (err && typeof err === "object" && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ message: "That file is too big. Images: up to 2 MB. Videos: up to 4 MB (6–10 seconds at about 2 Mbps). Specs: /ads/specs", field: "file" });
    return;
  }
  next(err);
}

router.post("/account/creative", raw, (req, res) =>
  safe(res, async () => {
    const email = customer(req);
    const c = email ? await store.getCampaign(str(req.query.campaign, 40)) : null;
    if (!email || !c || c.accountEmail !== email || !sameOrigin(req)) {
      res.status(401).json({ message: "Sign in again." });
      return;
    }
    const r = await uploadCreative(req, c.id, email, false);
    res.status(r.ok ? 200 : 400).json(r);
  }),
);
router.post("/account/creative/:id/variant", raw, (req, res) =>
  safe(res, async () => {
    const email = customer(req);
    if (!email || !sameOrigin(req)) {
      res.status(401).json({ message: "Sign in again." });
      return;
    }
    await uploadVariant(req, res, String(req.params.id), email, false);
  }),
);

router.get("/account/report.csv", (req, res) =>
  safe(res, async () => {
    const email = customer(req);
    if (!email) {
      res.redirect(302, mirrorPathOf(req, "/account"));
      return;
    }
    const cs = await store.listCampaigns({ email });
    const rows: Array<Record<string, unknown>> = [];
    for (const c of cs) for (const d of await store.dailyFor([c.id], 400)) rows.push({ campaign: c.brand, campaign_id: c.id, day: d.day, viewable_impressions: d.views, clicks: d.clicks, conversions: d.convs, spend: (d.spendMicros / MICROS).toFixed(2), currency: c.currency });
    noStore(res);
    res.set("Content-Disposition", 'attachment; filename="birch-reserve-ads-report.csv"').type("text/csv").send(toCsv(rows) || "campaign,day,viewable_impressions,clicks,conversions,spend,currency\n");
  }),
);

/* ------------------------------------------------------------------------------------------ admin */
router.get(["/ads/admin", "/ads/admin/"], (req, res) =>
  safe(res, async () => {
    noStore(res);
    res.set("X-Robots-Tag", "noindex");
    const who = admin(req);
    if (!who) {
      res.type("html").send(adminLoginPage());
      return;
    }
    const campaigns = await store.listCampaigns();
    const ids = campaigns.map((c) => c.id);
    const [totals, creatives, slotTotals, led, roy, shares, alerts, audit, day, orders] = await Promise.all([
      store.totalsByCampaign("all"), store.listCreatives({}), store.bySlotFor("all", 30), store.ledger({ limit: 300 }), store.royalties(6), store.partnerShares(),
      store.alertSubscribers(), store.auditLog(80), store.totalsByCampaign("all", 1), buyStore().listOrders(50).catch(() => []),
    ]);
    const [hubs, testSt, realSt, rates, recips, gateMap, timing, channelRates] = await Promise.all([store.listContractHubs(), store.statements(6, { testOnly: true }), store.statements(6), store.rateHistory(), store.recipientHistory(), store.gates(), store.payoutSettings(), store.channelRateHistory()]);
    const testRoyalties = testSt.lines;
    const byC = new Map<string, typeof creatives>();
    for (const cr of creatives) byC.set(cr.campaignId, [...(byC.get(cr.campaignId) ?? []), cr]);
    const brand = new Map(campaigns.map((c) => [c.id, c.brand]));
    const dayT = { serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 };
    for (const [id, t] of day) if (!campaigns.find((c) => c.id === id)?.isTest) for (const k of Object.keys(dayT) as Array<keyof typeof dayT>) dayT[k] += t[k];
    res.type("html").send(
      adminPage({
        who, campaigns: campaigns.map((c) => ({ c, t: totals.get(c.id) ?? { serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 } })),
        pending: await (async () => {
          const pend = creatives.filter((x) => x.status === "pending" && ids.includes(x.campaignId));
          const vs = await store.listVariants(pend.map((x) => x.id));
          return pend.map((x) => ({ ...x, brand: brand.get(x.campaignId) ?? "", variants: vs.filter((y) => y.creativeId === x.id) }));
        })(),
        creativesByCampaign: byC, slotTotals, ledger: led, royalties: roy, shares, alerts, audit, day: dayT, friday: fridayReady(), schema: store.adSchema(),
        promoHtml: await promoPanels(), partnersHtml: partnersAdminHtml(await getLeadStore().listBySource("partners", 300).catch(() => []), str(req.query["ptrack"], 20)) + activationAdminHtml(await getLeadStore().listBySource("activation", 500).catch(() => []), str(req.query["act"], 20)), ...(await referralPanel(recips)), hubServing: await store.hubServing(), hubs, testRoyalties, summary: realSt.summary, testSummary: testSt.summary, rates, recipients: recips, gates: gateMap, timing, channelRates,
        orders: orders.map((o) => ({ id: o.id, at: o.createdAt, email: o.email, company: o.company, website: o.website, plan: o.plan, format: o.format, creativeId: o.creativeId })),
      }),
    );
  }),
);

router.post("/ads/admin/login", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    const b = req.body as { email?: unknown; key?: unknown };
    const email = str(b.email, 200).toLowerCase();
    const key = str(b.key, 200);
    const want = process.env.ADS_ADMIN_KEY?.trim() ?? "";
    if (!sameOrigin(req) || loginLimiter.hit(`adm:${req.ip}`).limited) {
      res.status(429).json({ message: "Too many tries. Wait 15 minutes." });
      return;
    }
    if (!want || want.length < 24) {
      res.status(503).json({ message: "Admin sign-in is not configured on this deployment." });
      return;
    }
    if (!adminEmails().includes(email) || !safeEqual(key, want)) {
      await store.audit(email || "?", "admin.login_failed", null);
      res.status(401).json({ message: "Email or key not recognised." });
      return;
    }
    setCookie(res, ADM, sign("adm", { e: email }, 12 * 3600_000), 12 * 3600);
    await store.audit(email, "admin.login", null);
    res.json({ message: "Signed in", redirect: "/ads/admin" });
  }),
);
router.post("/ads/admin/logout", json, (_req, res) => {
  setCookie(res, ADM, "", 0);
  res.json({ message: "Signed out", redirect: "/ads/admin" });
});

/** Admin guard for POSTs and exports. */
function guard(req: Request, res: Response): string | null {
  const who = admin(req);
  if (!who || (req.method === "POST" && !sameOrigin(req))) {
    res.status(401).json({ message: "Sign in again." });
    return null;
  }
  return who;
}

const day = (v: unknown, end = false): Date | null | undefined => {
  const s = str(v, 10);
  if (s === "") return v === undefined ? undefined : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  // Flight days run midnight to midnight Toronto time (EST, UTC-5).
  const d = new Date(`${s}T05:00:00.000Z`);
  return end ? new Date(d.getTime() + 864e5) : d;
};
const int = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};
const url = (v: unknown): string | null | undefined => {
  const s = str(v, 500);
  if (!s) return v === undefined ? undefined : null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
};

function patchFrom(b: Record<string, unknown>): { patch: CampaignPatch; error?: string } {
  const p: CampaignPatch = {};
  if (b.status !== undefined) {
    if (!["draft", "active", "paused", "completed"].includes(String(b.status))) return { patch: p, error: "Bad status." };
    p.status = String(b.status) as CampaignPatch["status"];
  }
  if (b.brand !== undefined && str(b.brand)) p.brand = str(b.brand, 160);
  if (b.category !== undefined) p.category = str(b.category, 80) || null;
  if (b.pricing !== undefined) p.pricing = b.pricing === "cpc" ? "cpc" : "cpm";
  if (b.primaryPlacement !== undefined && (PLACEMENTS as readonly string[]).includes(String(b.primaryPlacement))) p.primaryPlacement = String(b.primaryPlacement) as Placement;
  if (b.hubs !== undefined || b.allowSubstitute !== undefined) p.hubs = (Array.isArray(b.hubs) ? b.hubs : []).map(String).filter((h) => AD_SLOTS.some((s) => s.hub === h)); // hub keys and marketing keys (mkt-birch, mkt-scale)
  if (b.allowSubstitute !== undefined) p.allowSubstitute = b.allowSubstitute === true;
  if (b.exclusive !== undefined) p.exclusive = b.exclusive === true;
  if (b.seller === "birch" || b.seller === "scale") p.seller = b.seller;
  if (b.internal !== undefined || b.internalSet !== undefined) p.internal = b.internal === true || b.internal === "on";
  const m = int(b.rateMultiplierBps, 1000, 10000);
  if (m !== undefined) p.rateMultiplierBps = m;
  const fs = day(b.flightStart);
  const fe = day(b.flightEnd, true);
  if (fs !== undefined) p.flightStart = fs;
  if (fe !== undefined) p.flightEnd = fe;
  if (p.flightStart && p.flightEnd) {
    if (p.flightEnd <= p.flightStart) return { patch: p, error: "Flight end must be after the start." };
    if (p.flightEnd.getTime() - p.flightStart.getTime() > AD_DEFAULTS.maxFlightDays * 864e5) return { patch: p, error: "Flights run up to 6 months." };
  }
  const cu = url(b.clickUrl);
  if (b.clickUrl !== undefined && cu === undefined) return { patch: p, error: "Landing URL must start with https://" };
  if (cu !== undefined) p.clickUrl = cu;
  const fc = int(b.freqCapPerDay, 1, 50);
  if (fc !== undefined) p.freqCapPerDay = fc;
  const cw = int(b.clickWindowDays, 1, 30);
  if (cw !== undefined) p.clickWindowDays = cw;
  const vw = int(b.viewWindowDays, 0, 7);
  if (vw !== undefined) p.viewWindowDays = vw;
  if (b.notes !== undefined) p.notes = str(b.notes, 500) || null;
  return { patch: p };
}

router.post("/ads/admin/campaigns", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = str(b.accountEmail, 200).toLowerCase();
    const budget = Number(b.budget);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !str(b.brand) || !Number.isFinite(budget) || budget <= 0 || budget > 1_000_000) {
      res.status(400).json({ message: "Add an email, brand and budget." });
      return;
    }
    const { patch, error } = patchFrom(b);
    if (error) {
      res.status(400).json({ message: error });
      return;
    }
    const { campaign } = await store.createCampaign({
      accountEmail: email, brand: str(b.brand, 160), category: patch.category ?? null, currency: b.currency === "cad" ? "cad" : "usd", budgetMicros: Math.round(budget * MICROS),
      pricing: patch.pricing, primaryPlacement: patch.primaryPlacement, hubs: patch.hubs, allowSubstitute: patch.allowSubstitute ?? true, rateMultiplierBps: patch.rateMultiplierBps,
      clickUrl: patch.clickUrl ?? null, exclusive: patch.exclusive, isTest: b.isTest === true, notes: patch.notes ?? null, orderKind: "manual (admin)", seller: b.seller === "scale" ? "scale" : "birch", internal: b.internal === true || b.internal === "on", actor: who,
    });
    const { status: _s, ...rest } = patch;
    await store.updateCampaign(campaign.id, rest, who);
    res.json({ message: `Draft created for ${campaign.brand}.` });
  }),
);

router.post("/ads/admin/campaigns/:id", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const c = await store.getCampaign(String(req.params.id));
    if (!c) {
      res.status(404).json({ message: "Not found." });
      return;
    }
    const { patch, error } = patchFrom((req.body ?? {}) as Record<string, unknown>);
    if (error) {
      res.status(400).json({ message: error });
      return;
    }
    if (isPromoCampaign(c)) patch.rateMultiplierBps = PROMO_RATE_BPS; // promo credit always runs at regular rates
    const next = { ...c, ...patch };
    if (patch.status === "active") {
      const approved = (await store.listCreatives({ campaignId: c.id, status: "approved" })).length;
      const missing = [!approved && "an approved creative", !next.flightStart && "a flight start", !next.flightEnd && "a flight end", !next.clickUrl && "a landing URL", next.budgetMicros <= next.spentMicros && "remaining budget"].filter(Boolean);
      if (missing.length) {
        res.status(400).json({ message: `To go live it needs ${missing.join(", ")}.` });
        return;
      }
    }
    await store.updateCampaign(c.id, patch, who);
    res.json({ message: patch.status === "active" && c.status !== "active" ? "Live. It starts serving within a minute." : "Saved." });
  }),
);

router.post("/ads/admin/campaigns/:id/budget", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const delta = Number(b.delta);
    if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1_000_000 || !str(b.note)) {
      res.status(400).json({ message: "Enter an amount and a note." });
      return;
    }
    const c = await store.adjustBudget(String(req.params.id), delta * MICROS, str(b.note, 200), who);
    res.status(c ? 200 : 400).json({ message: c ? "Posted to the ledger." : "Budget can't go below what's already spent." });
  }),
);

router.post("/ads/admin/campaigns/:id/login-link", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const c = await store.getCampaign(String(req.params.id));
    if (!c) {
      res.status(404).json({ message: "Not found." });
      return;
    }
    const link = `${origin(req)}/account/auth?t=${encodeURIComponent(sign("l", { e: c.accountEmail }, 7 * 864e5))}`;
    await store.audit(who, "account.link", c.id, c.accountEmail);
    res.json({ message: "Dashboard link copied (valid 7 days). Send it to the customer yourself.", copy: link });
  }),
);

/* Dashboard link by email (promo-only buyers have no campaign until they sign in; login emails stay OFF until Randy previews them). */
router.post("/ads/admin/account-link", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const email = str((req.body as Record<string, unknown> | undefined)?.email, 200).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(400).json({ message: "Enter the customer's email." });
      return;
    }
    const link = `${origin(req)}/account/auth?t=${encodeURIComponent(sign("l", { e: email }, 7 * 864e5))}`;
    await store.audit(who, "account.link", email, "by email");
    res.json({ message: "Dashboard link copied (valid 7 days). Send it to the customer yourself.", copy: link });
  }),
);

router.post("/ads/admin/campaigns/:id/purge", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const ok = await store.purgeTestCampaign(String(req.params.id), who);
    res.status(ok ? 200 : 400).json({ message: ok ? "Test campaign and its data deleted." : "Only test campaigns can be deleted." });
  }),
);

router.post("/ads/admin/creatives", raw, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const c = await store.getCampaign(str(req.query.campaign, 40));
    if (!c) {
      res.status(404).json({ message: "Campaign not found." });
      return;
    }
    const r = await uploadCreative(req, c.id, who, req.query.approve === "true", req.query.force === "true");
    res.status(r.ok ? 200 : 400).json(r);
  }),
);
router.post("/ads/admin/creatives/:id/variant", raw, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    await uploadVariant(req, res, String(req.params.id), who, true);
  }),
);
router.use(["/account/creative", "/ads/admin/creatives"], tooLarge);

router.post("/ads/admin/creatives/:id/alt", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const alt = str((req.body as Record<string, unknown> | undefined)?.alt, 200);
    if (!alt) return void res.status(400).json({ message: "Add alt text." });
    const ok = await store.setCreativeAlt(String(req.params.id), alt, who);
    res.status(ok ? 200 : 404).json({ message: ok ? "Alt text saved." : "Not found." });
  }),
);
router.post("/ads/admin/creatives/:id/status", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    // "pending" puts a creative back in the approval queue (undo an approval made by mistake); it never activates anything.
    const to = req.query.to === "approved" ? "approved" : req.query.to === "rejected" ? "rejected" : req.query.to === "pending" ? "pending" : null;
    if (!to) {
      res.status(400).json({ message: "Bad status." });
      return;
    }
    const reason = str((req.body as Record<string, unknown> | undefined)?.reason, 300);
    if (to === "rejected" && !reason) {
      res.status(400).json({ message: "Add a reason. The buyer sees it on their dashboard." });
      return;
    }
    // QA guard (Nov 21 2026): automated QA (header x-br-qa, sent by every box QA browser) can never approve a real creative. Randy approves real ads by hand.
    if (to === "approved" && req.get("x-br-qa")) {
      const f = await store.creativeTestFlag(String(req.params.id));
      if (!f?.isTest) {
        await store.audit(who, "creative.qa_approve_blocked", String(req.params.id));
        res.status(403).json({ message: "QA can only approve TEST creatives. Real ads are approved by hand." });
        return;
      }
    }
    if (to === "approved") {
      const cr = await store.getCreative(String(req.params.id));
      if (cr?.kind === "video" && !(await store.listVariants([cr.id])).some((x) => x.role === "poster")) {
        res.status(400).json({ message: "Add a poster frame first (a still from the video, same size). It shows before the video plays and when motion is off." });
        return;
      }
    }
    const ok = await store.setCreativeStatus(String(req.params.id), to, who, to === "rejected" ? reason : null);
    if (ok && to === "approved") {
      // No format yet (uploaded before the table, e.g. /buy): match it by shape so format-scoped slots can take it.
      const cr = await store.getCreative(String(req.params.id));
      const f = cr && !cr.format ? matchFormat(cr.kind ?? "image", cr.width, cr.height) : undefined;
      if (cr && f) await store.setCreativeFormatIfEmpty(cr.id, f.key, who);
    }
    res.status(ok ? 200 : 404).json({ message: ok ? (to === "approved" ? "Approved." : to === "pending" ? "Back in the approval queue." : "Rejected.") : "Not found." });
  }),
);

router.post("/ads/admin/partners/share", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const pct = Number(b.sharePct);
    const partner = str(b.partner, 120);
    if (!partner || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      res.status(400).json({ message: "Pick a partner and a share from 0 to 100%." });
      return;
    }
    await store.setPartnerShare(partner, Math.round(pct * 100), who);
    res.json({ message: `${partner} royalty share set to ${pct}%. Approved statements keep the share they were approved at.` });
  }),
);

router.post("/ads/admin/payouts/approve", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const r = await store.approvePayout(str(b.partner, 120), str(b.month, 7), str(b.currency, 3), who);
    res.status(r ? 200 : 400).json({ message: r ? "Statement approved. No money was sent; pay it outside this system." : "Can't approve: set the share first, or it's already approved." });
  }),
);

/* Hub inventory on contract (Randy voice Nov 21 12:44): a signed hub becomes sellable placements at card rates. */
router.post("/ads/admin/hubs", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const key = str(b.key, 41).toLowerCase();
    const name = str(b.name, 80);
    const category = str(b.category, 80);
    const url = str(b.url, 300);
    const contractRef = str(b.contractRef, 160);
    let okUrl = false;
    try {
      okUrl = new URL(url).protocol === "https:";
    } catch {
      okUrl = false;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(key) || !name || !category || !okUrl || !contractRef) {
      res.status(400).json({ message: "Key (lowercase letters, numbers, dashes), name, category, an https URL and the contract reference are all required." });
      return;
    }
    const isTest = b.isTest === "on" || b.isTest === true;
    await store.upsertContractHub({ key, name, category, url, partner: str(b.partner, 120) || name, contractRef, status: "live", isTest }, who);
    if (!isTest) void alertNewHub(origin(req), key);
    res.json({ message: `${name} is on contract. Its placements are sellable now (slot keys ${key}.landing … ${key}.post_purchase).` });
  }),
);

/* Hub ad serving switch (Randy Nov 21 2026 3:43 PM t397u): default OFF; only Randy or Jon may turn a hub on, with a note. Audited. */
const HUB_APPROVERS: Record<string, "Randy" | "Jon"> = { "randy@silverbirchgrowth.com": "Randy", "randy@scalehealth.ca": "Randy", "john@scalehealth.ca": "Jon" };
router.post("/ads/admin/hubs/:key/serving", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const hub = String(req.params.key);
    if (!AD_SLOTS.some((s) => s.hub === hub && s.kind !== "marketing")) return void res.status(404).json({ message: "Unknown hub." });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const enabled = b.enabled === true || b.enabled === "on";
    const approver = HUB_APPROVERS[who.toLowerCase()];
    const note = str(b.note, 300) || null;
    if (enabled && !approver) return void res.status(403).json({ message: "Only Randy or Jon can turn ads on for a hub." });
    if (enabled && !note) return void res.status(400).json({ message: "Add a note: who approved it and why (e.g. Randy's message)." });
    await store.setHubServing(hub, enabled, approver ?? "Randy", who, note);
    res.json({ message: enabled ? `Ads ON for ${hub} (approved by ${approver}).` : `Ads OFF for ${hub}.` });
  }),
);

router.post("/ads/admin/hubs/:key/status", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const to = req.query.to === "paused" ? "paused" : req.query.to === "live" ? "live" : null;
    if (!to) {
      res.status(400).json({ message: "Bad status." });
      return;
    }
    const ok = await store.setHubStatus(String(req.params.key), to, who);
    if (ok && to === "live") void alertNewHub(origin(req), String(req.params.key));
    res.status(ok ? 200 : 404).json({ message: ok ? `Hub ${to}.` : "Not found." });
  }),
);

router.post("/ads/admin/hubs/:key/purge", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const ok = await store.purgeTestHub(String(req.params.key), who);
    res.status(ok ? 200 : 400).json({ message: ok ? "Test hub deleted." : "Only test hubs can be deleted." });
  }),
);

/* A /buy order's uploaded ad goes into the approval queue of the buyer's paid campaign. */
router.post("/ads/admin/orders/:id/attach", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const order = (await buyStore().listOrders(500)).find((o) => o.id === String(req.params.id));
    const c = await store.getCampaign(str((req.body as Record<string, unknown> | undefined)?.campaign, 40));
    if (!order || !order.creativeId || !c || c.accountEmail !== order.email.toLowerCase()) {
      res.status(400).json({ message: "Pick a campaign for the same email as the order, and the order needs an uploaded ad." });
      return;
    }
    const already = (await store.listCreatives({ campaignId: c.id })).some((x) => x.sourceRef === `buy:${order.id}`);
    if (already) {
      res.json({ message: "Already in the approval queue." });
      return;
    }
    const cr = await buyStore().getCreative(order.creativeId);
    if (!cr) {
      res.status(404).json({ message: "The uploaded file is no longer stored. Ask the buyer to upload it on their dashboard." });
      return;
    }
    await store.addCreative({ campaignId: c.id, mime: cr.mime, width: cr.width, height: cr.height, data: cr.data, alt: `${c.brand} ad`, uploadedBy: `${who} (from /buy)`, status: "pending", sourceRef: `buy:${order.id}`, kind: "image", format: matchFormat("image", cr.width, cr.height)?.key ?? null });
    res.json({ message: "Sent to the approval queue." });
  }),
);

/* Manual payouts: record that an approved statement was paid outside this system. No money moves here. */
router.post("/ads/admin/payouts/paid", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const ref = str(b.ref, 120);
    if (!ref) {
      res.status(400).json({ message: "Add the payment reference (e-transfer, cheque or wire)." });
      return;
    }
    const ok = await store.markPayoutPaid(str(b.partner, 120), str(b.month, 7), str(b.currency, 3), ref, who);
    res.status(ok ? 200 : 400).json({ message: ok ? "Recorded as paid. Nothing was sent from here." : "Only approved statements can be marked paid." });
  }),
);

/* ---------------------------------------------------------------- payout split settings (Randy voice Nov 21 1:09 / 1:10 PM) */
const pctBps = (v: unknown): number | null | undefined => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : undefined;
};
/**
 * Effective time: blank or today = the next full hour (delivery is ledgered in hourly lines, so this is never retroactive);
 * a future date = that day 00:00 Toronto. Past dates are refused.
 */
function effectiveFrom(v: unknown): Date | null {
  const d = str(v, 10);
  const now = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000);
  if (!d) return now;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T00:00:00-05:00`);
  if (Number.isNaN(t.getTime())) return null;
  if (t.getTime() < Date.now() - 864e5) return null;
  return t.getTime() < now.getTime() ? now : t;
}
function parseTiers(v: unknown): Array<{ fromMicros: number; hubBps: number }> | null | undefined {
  const raw = str(v, 400);
  if (!raw) return null;
  const out: Array<{ fromMicros: number; hubBps: number }> = [];
  for (const part of raw.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)) {
    const m = /^\$?([\d_.,]+)\s*[:=@]\s*([\d.]+)%?$/.exec(part.replace(/\s+/g, " "));
    if (!m) return undefined;
    const usd = Number(m[1]!.replace(/[_,]/g, ""));
    const pct = Number(m[2]);
    if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(pct) || pct < 0 || pct > 100) return undefined;
    out.push({ fromMicros: Math.round(usd * MICROS), hubBps: Math.round(pct * 100) });
  }
  return out.sort((a, b) => a.fromMicros - b.fromMicros);
}

router.post("/ads/admin/payout/rates", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const partner = str(b.partner, 120) || null;
    const ov = pctBps(b.overridePct);
    const hub = pctBps(b.hubPct);
    const tiers = parseTiers(b.tiers);
    const eff = effectiveFrom(b.effective);
    if (ov === undefined || hub === undefined) return void res.status(400).json({ message: "Percentages run 0–100 (blank on a hub = use the default)." });
    if (tiers === undefined) return void res.status(400).json({ message: "Tiers look like: 10000:40, 25000:50 (monthly USD gross : hub % of net)." });
    if (!eff) return void res.status(400).json({ message: "Pick today or a future date. Rate changes are never retroactive." });
    if (!partner && (ov === null || hub === null)) return void res.status(400).json({ message: "The default needs both the override % and the hub %." });
    if (!partner && tiers?.length) return void res.status(400).json({ message: "Volume tiers are set per hub." });
    await store.addRate({ partner, overrideBps: ov, hubBps: hub, tiers, effectiveAt: eff, note: str(b.note, 300) || null }, who);
    res.json({ message: `${partner ?? "Default"} rates saved, effective ${eff.toISOString().slice(0, 16).replace("T", " ")} UTC. Earlier delivery keeps its old rate.` });
  }),
);

/* Per-channel Birch override (Randy voice Nov 21 2026 2:45 PM): Scale direct / internal rates, dated, never retroactive. Brokerage = default override. */
router.post("/ads/admin/payout/channel-rates", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const channel = b.channel === "scale_direct" || b.channel === "internal" ? b.channel : null;
    const ov = pctBps(b.overridePct);
    const eff = effectiveFrom(b.effective);
    if (!channel) return void res.status(400).json({ message: "Pick Scale direct or Internal. Brokerage uses the default Birch override." });
    if (ov === undefined || ov === null) return void res.status(400).json({ message: "Override runs 0–100%." });
    if (!eff) return void res.status(400).json({ message: "Pick today or a future date. Rate changes are never retroactive." });
    await store.addChannelRate({ channel, overrideBps: ov, effectiveAt: eff, note: str(b.note, 300) || null }, who);
    res.json({ message: `${channel === "internal" ? "Internal" : "Scale direct"} override ${ov / 100}% saved, effective ${eff.toISOString().slice(0, 16).replace("T", " ")} UTC. Earlier delivery keeps its old rate.` });
  }),
);

router.post("/ads/admin/payout/recipients", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const name = str(b.name, 120);
    const pct = pctBps(b.pct);
    const eff = effectiveFrom(b.effective);
    const kind = b.kind === "commission" ? "commission" : "brokerage";
    const rkey = (str(b.rkey, 60) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)) || "";
    if (!name || !rkey || pct === undefined || pct === null) return void res.status(400).json({ message: "Add a name and a % of the override pool (0–100)." });
    if (!eff) return void res.status(400).json({ message: "Pick today or a future date. Changes are never retroactive." });
    const active = b.active === "on" || b.active === true;
    const scopeReferrer = (await promoLib.resolveMember(str(b.scopeReferrer, 40))) ?? null;
    if (str(b.scopeReferrer, 40) && !scopeReferrer) return void res.status(400).json({ message: "Pick an active street-team / partner member as the referrer." });
    const next = { rkey, name, kind, pctBps: pct, scopePartner: scopeReferrer ? null : str(b.scopePartner, 120) || null, scopeCampaign: scopeReferrer ? null : str(b.scopeCampaign, 40) || null, scopeReferrer, active, payoutRef: str(b.payoutRef, 200) || null, effectiveAt: eff } as const;
    const hist = await store.recipientHistory();
    const at = recipientsAt([...hist, next], eff.getTime() + 1).filter((r) => r.active);
    const campaigns = (await store.listCampaigns()).map((c) => c.id);
    const max = maxPoolAllocationBps(at, [...new Set(AD_SLOTS.map((x) => x.partner))], campaigns);
    if (max > 10_000) return void res.status(400).json({ message: `That would hand out ${(max / 100).toFixed(2)}% of the override pool on some hub or campaign. Keep the total at or under 100%.` });
    const maxRef = maxReferrerAllocationBps(at);
    if (maxRef > 10_000) return void res.status(400).json({ message: `That would hand out ${(maxRef / 100).toFixed(2)}% of one referrer's referral pool. Keep the total at or under 100%.` });
    await store.addRecipientVersion({ ...next }, who);
    if (scopeReferrer) return void res.json({ message: `${name} saved: ${pct / 100}% of the referral pool on orders ${scopeReferrer} refers (sale-time; never on delivery).` });
    res.json({ message: `${name} saved (${pct / 100}% of the pool). Up to ${(max / 100).toFixed(2)}% of the pool is now allocated on any one hub; the rest stays with Birch.` });
  }),
);

router.post("/ads/admin/payout/recipients/:rkey/purge", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const ok = await store.purgeTestRecipient(String(req.params.rkey), who);
    res.status(ok ? 200 : 400).json({ message: ok ? "Test recipient deleted." : "Only test recipients (key starting qa-) can be deleted; switch real ones off instead." });
  }),
);

router.post("/ads/admin/payout/gates", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const partner = str(b.partner, 120);
    const on = (k: string) => b[k] === "on" || b[k] === true;
    const note = str(b.note, 300) || null;
    if (!partner) return void res.status(400).json({ message: "Pick a hub." });
    if (on("override") && !note) return void res.status(400).json({ message: "An override needs a note (why it's released early)." });
    await store.setGate(partner, { live: on("live"), hasTransactions: on("hasTransactions"), audienceActivated: on("audienceActivated"), override: on("override"), note }, who);
    res.json({ message: `${partner} payout gate saved.` });
  }),
);

router.post("/ads/admin/payout/timing", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const netDays = Number(b.netDays);
    if (!Number.isInteger(netDays) || netDays < 0 || netDays > 120) return void res.status(400).json({ message: "Net days run 0–120." });
    await store.setPayoutSettings({ cadence: b.cadence === "quarterly" ? "quarterly" : "monthly", netDays }, who);
    res.json({ message: "Payout timing saved." });
  }),
);

/* "Pay": no Stripe connected accounts exist, so this builds a batch of approved lines and a Stripe-ready CSV. No money moves. */
router.post("/ads/admin/payouts/batch", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const raw = (req.body as Record<string, unknown> | undefined)?.payees;
    const payees = Array.isArray(raw) ? raw.map((x) => str(x, 160)).filter(Boolean) : undefined; // optional: batch only these payees (e.g. one QA test hub)
    const r = await store.createPayoutBatch(who, payees);
    if (!r.rows.length) return void res.json({ message: "No approved, unbatched lines to pay." });
    res.json({ message: `Batch ${r.batchId}: ${r.rows.length} lines. Download the CSV, pay each line, then Mark paid with the reference. Nothing was sent.`, copy: `${origin(req)}/ads/admin/export/batch-${r.batchId}.csv` });
  }),
);

router.post("/ads/admin/friday-sync", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const r = await syncToFriday({ campaignId: str(req.query.campaign, 40) || undefined, includeTest: Boolean(req.query.campaign) });
    res.status(r.failed && !r.sent ? 502 : 200).json({ message: `Friday: ${r.sent} sent, ${r.failed} failed${r.errors[0] ? ` (${r.errors[0]})` : ""}.`, ...r });
  }),
);

router.get("/ads/admin/export/:what", (req, res) =>
  safe(res, async () => {
    const who = admin(req);
    if (!who) {
      res.redirect(302, "/ads/admin");
      return;
    }
    const what = String(req.params.what).replace(/\.csv$/, "");
    let rows: Array<Record<string, unknown>> = [];
    if (what === "campaigns") {
      const cs = await store.listCampaigns();
      const t = await store.totalsByCampaign("all");
      rows = cs.map((c) => ({ id: c.id, seller: c.seller ?? "birch", brand: c.brand, email: c.accountEmail, status: c.status, test: c.isTest, order: c.orderRef, kind: c.orderKind, currency: c.currency, budget: (c.budgetMicros / MICROS).toFixed(2), spent: (c.spentMicros / MICROS).toFixed(2), pricing: c.pricing, placement: c.primaryPlacement, auto_move: c.allowSubstitute, flight_start: c.flightStart, flight_end: c.flightEnd, viewable: t.get(c.id)?.views ?? 0, clicks: t.get(c.id)?.clicks ?? 0, conversions: t.get(c.id)?.convs ?? 0 }));
    } else if (what === "ledger") {
      rows = (await store.ledger({ limit: 50_000 })).map((l) => ({ at: l.at, campaign_id: l.campaignId, kind: l.kind, slot: l.slotKey, partner: l.partner, units: l.units, amount: (l.amountMicros / MICROS).toFixed(6), currency: l.currency, note: l.note, actor: l.actor, test: l.isTest }));
    } else if (what === "royalties") {
      rows = (await store.royalties(13)).map((r) => ({ type: r.kind, payee: r.label, hub: r.hub, source: r.source, due: r.dueAt ? r.dueAt.toISOString().slice(0, 10) : "", held: r.heldReason ?? "", partner: r.partner, month: r.month, currency: r.currency, delivered: (r.grossMicros / MICROS).toFixed(2), share_pct: r.shareBps === null ? "" : (r.shareBps / 100).toFixed(2), override: r.overrideNote ?? "", payable: r.payableMicros === null ? "" : (r.payableMicros / MICROS).toFixed(2), status: r.status, approved_by: r.approvedBy, approved_at: r.approvedAt }));
    } else if (what === "referrals") {
      const orders = await listReferralOrders({ includeTest: true, limit: 50_000 });
      const { detail } = splitReferralOrders(orders.map(toReferralLine), await store.rateHistory(), await store.recipientHistory(), await store.channelRateHistory());
      const d = new Map(detail.map((x) => [x.sessionId, x]));
      rows = orders.map((o) => {
        const x = d.get(o.sessionId);
        return { paid_at: o.paidAt.toISOString(), session_id: o.sessionId, campaign_id: o.campaignId, brand: o.brand, order_kind: o.orderKind, referrer: o.member, qr: o.qr, code: o.code, site: o.site, channel: o.channel, collected: (o.amountCents / 100).toFixed(2), currency: o.currency, override_pct: x?.overrideBps != null ? (x.overrideBps / 100).toFixed(2) : "", pool: x?.poolMicros != null ? (x.poolMicros / MICROS).toFixed(2) : "", commission: x ? (x.commissions.reduce((s, c) => s + c.micros, 0) / MICROS).toFixed(2) : "", recipients: x ? x.commissions.map((c) => `${c.name} ${c.pctBps / 100}%`).join("; ") : "", test: o.isTest };
      });
    } else if (what.startsWith("batch-batch_")) {
      rows = (await store.batchRows(what.slice(6))).map((r) => ({ batch_id: r.batch_id, payee: r.label ?? r.partner, payee_key: r.partner, type: r.kind ?? "hub", destination_stripe_account: "", amount_cents: Math.round(Number(r.payable_micros) / 10_000), currency: r.currency, description: `Birch Reserve ${r.kind ?? "hub"} payout ${r.month}`, "metadata[month]": r.month, "metadata[payee_key]": r.partner, payout_reference: r.payee_ref ?? "", status: r.status }));
    } else if (what === "payouts") {
      rows = (await store.payoutRows()).map((r) => ({ type: r.kind ?? "hub", payee: r.label ?? r.partner, payout_reference: r.payee_ref ?? "", batch_id: r.batch_id ?? "", partner: r.partner, month: r.month, currency: r.currency, delivered: (Number(r.gross_micros) / MICROS).toFixed(2), share_pct: (Number(r.share_bps) / 100).toFixed(2), amount_to_pay: (Number(r.payable_micros) / MICROS).toFixed(2), status: r.status, approved_by: r.approved_by, approved_at: r.approved_at, paid_ref: r.paid_ref ?? "", paid_by: r.paid_by ?? "", paid_at: r.paid_at ?? "" }));
    } else if (what === "delivery") {
      const cs = await store.listCampaigns();
      for (const c of cs) for (const d of await store.dailyFor([c.id], 400)) rows.push({ day: d.day, campaign_id: c.id, brand: c.brand, test: c.isTest, served: d.serves, viewable: d.views, clicks: d.clicks, conversions: d.convs, spend: (d.spendMicros / MICROS).toFixed(2), currency: c.currency });
    } else {
      res.status(404).end();
      return;
    }
    await store.audit(who, "export", what);
    noStore(res);
    res.set("Content-Disposition", `attachment; filename="birch-ads-${what}.csv"`).type("text/csv").send(toCsv(rows) || "empty\n");
  }),
);

/* New-hub alerts: once per hub per opted-in subscriber whose categories match. Test hubs never alert. */
async function alertNewHub(base: string, key: string): Promise<void> {
  try {
    if (process.env.ADS_HUB_ALERT_EMAIL_ENABLED !== "true") return;
    const h = (await store.listContractHubs()).find((x) => x.key === key);
    if (!h || h.isTest || h.status !== "live") return;
    for (const s of await store.alertSubscribers()) {
      if (!s.categories.includes(h.category)) continue;
      if (!(await store.claimHubAlert(h.key, s.email))) continue;
      const off = `${base}/account/alerts/off?t=${encodeURIComponent(sign("u", { e: s.email }, 365 * 864e5))}`;
      await siteMail.hubAlert(s.email, { hubName: h.name, category: h.category, hubUrl: h.url }, off).catch((err: unknown) => logger.warn({ err: String(err) }, "hub alert email failed"));
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "hub alerts failed");
  }
}

router.get("/account/alerts/off", (req, res) =>
  safe(res, async () => {
    noStore(res);
    const t = verify<{ e: string }>("u", req.query.t);
    if (t) await store.alertsOff(t.e);
    res.type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alerts</title><body style="font:16px/1.6 Arial,sans-serif;color:#071A39;padding:32px;max-width:520px">${t ? "<h1>You're unsubscribed</h1><p>No more new-hub alerts. You can turn them back on from your dashboard.</p>" : "<h1>That link has expired</h1><p>Sign in to your dashboard to change alerts.</p>"}<p><a href="/account#alerts">Open my dashboard</a></p></body>`);
  }),
);

/* QA: send both system emails for real, only ever to Randy's own inbox (Randy voice Nov 21 1:10 PM). */
const EMAIL_TEST_TO = "randy@silverbirchgrowth.com";
router.post("/ads/admin/email-test", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const base = origin(req);
    const login = loginLinkEmail(`${base}/account/auth?t=${encodeURIComponent(sign("l", { e: EMAIL_TEST_TO }, 864e5))}`);
    const off = `${base}/account/alerts/off?t=${encodeURIComponent(sign("u", { e: EMAIL_TEST_TO }, 365 * 864e5))}`;
    const alert = hubAlertEmail({ hubName: "Example Physio Hub", category: "Recovery hardware", hubUrl: "https://scalehealth.ca", unsubscribeUrl: off });
    const all = (req.body as Record<string, unknown> | undefined)?.all === true;
    const now = new Date();
    const lead = { id: "lead_test", name: "Test Person", company: "Northline Recovery (test)", role: "Founder", email: EMAIL_TEST_TO, phone: null, need: "Reach recovery shoppers", size: "$5K", timing: "Next month", pagePath: "/intake", meta: { category: "Recovery hardware", hubs: "SOLE" }, sourceRef: "test", utmSource: null, utmMedium: null, utmCampaign: null, utmTerm: null, utmContent: null, referrer: null, landingPage: "/intake" } as never;
    const extra = all
      ? [
          renderSalesAlert({ event: "inquiry", title: "gtm setup inquiry: Northline Recovery (test)", rows: [["Form", "gtm_setup_inquiry"], ["Company", "Northline Recovery (test)"], ["Email", EMAIL_TEST_TO]], isTest: true }),
          renderSalesAlert({ event: "paid_checkout", title: "Paid: 7-day look $190 · Northline Recovery (test)", rows: [["Amount", "$190.00 USD"], ["Plan", "7-day look"]], isTest: true }),
          renderSalesAlert({ event: "seat_hold", title: "/buy 7-day look: Northline Recovery (test)", rows: [["Plan", "7-day look · $190"]], isTest: true }),
          renderLocalBizLeadEmail(lead),
          renderEmailCaptureEmail(lead),
          renderTranscriptEmail({ id: "sess_test", messages: [{ role: "user", content: "How does pricing work?" }, { role: "assistant", content: "See https://birchreserve.net/rates" }], qualify: { company: "Northline Recovery (test)" }, contact: { name: "Test Person", email: EMAIL_TEST_TO }, events: [], lastHandoff: null, handoffPending: false, pagePath: "/rates", createdAt: now, lastActivityAt: now, sentAt: null, sentMessageCount: 0, sendingAt: null, sendAttempts: 0 } as never),
          renderKitEmail({ brand: "Northline Recovery (test)", reportUrl: `${base}/intake`, headline: { exposureMonth: "120K", earningsMonth: "$2.4K" }, hasPdf: false }),
          renderNudgeEmail({ resumeUrl: `${base}/intake`, unsubscribeUrl: `${base}/intake`, website: "northline.test" }),
          buildPrepayConfirmationEmail({ brandName: "Northline Recovery (test)", amountCents: 49000, currency: "usd" } as never),
        ]
      : [];
    const skip = Math.max(0, Math.min(20, Number((req.body as Record<string, unknown> | undefined)?.skip) || 0));
    const ids: Array<string | null> = [];
    for (const [i, m] of [login, alert, ...extra].entries()) {
      if (i < skip) continue;
      if (ids.length) await new Promise((r) => setTimeout(r, 600)); // Resend rate limit
      ids.push(await sendBuyerEmail({ from: ADS_FROM(), to: [EMAIL_TEST_TO], subject: `[Test] ${m.subject}`, text: m.text, html: m.html }).then((x) => x.id, (e: unknown) => `failed: ${String(e).slice(0, 80)}`));
    }
    await store.audit(who, "email.test", EMAIL_TEST_TO, ids.join(","));
    res.json({ message: `Sent ${ids.length} test emails to ${EMAIL_TEST_TO}.`, ids });
  }),
);

/*
 * Replay a live Stripe event (Nov 21 2026, after the webhook signing-secret mismatch). The event is fetched from Stripe with the
 * server's key (so it is authentic) and runs through the same idempotent handler as the webhook: mark paid, Friday record, the
 * internal [BIRCH PAID] alert. Once per event id. Optional buyer confirmation for hold-190, only ever to Randy's own address.
 */
router.post("/ads/admin/stripe/replay", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const eventId = str(b.eventId, 80);
    if (!/^evt_[A-Za-z0-9]+$/.test(eventId)) return void res.status(400).json({ message: "Pass a Stripe event id (evt_…)." });
    const event = await getStripeClient().events.retrieve(eventId);
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      return void res.status(400).json({ message: `Only paid checkout events replay (got ${event.type}).` });
    }
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return void res.status(400).json({ message: "That checkout is not paid." });
    const out: Record<string, unknown> = { event: event.id, session: session.id, livemode: event.livemode };
    if (await store.claimOnce(`stripe.replay:${event.id}`, who)) {
      const { processStripeEvent } = await import("./splashAdReservations");
      await processStripeEvent(event);
      out.processed = true;
    } else out.processed = "already replayed";
    if (b.confirmation === true) {
      const rid = session.metadata?.reservationId ?? "";
      const r = await store.reservationForConfirmation(rid);
      if (!r) out.confirmation = "no reservation";
      else if (r.email !== EMAIL_TEST_TO) out.confirmation = "refused: buyer is not Randy (buyer emails stay off until Randy previews them)";
      else if (r.offerKey !== "hold-190") out.confirmation = `refused: offer ${r.offerKey} (hold-190 only)`;
      else if (!(await store.claimOnce(`buyer.confirmation:${rid}`, who))) out.confirmation = "already sent";
      else {
        const camp = (await store.listCampaigns()).find((c) => c.orderRef === session.id);
        const fmt = camp ? placementLabel(camp.primaryPlacement) : null;
        const m = buildHoldConfirmationEmail({ brandName: r.brandName, amountCents: r.amountCents, currency: r.currency, format: fmt });
        out.confirmation = await sendBuyerEmail({ from: ADS_FROM(), to: [EMAIL_TEST_TO], subject: m.subject, text: m.text, html: m.html }).then((x) => `sent ${x.id ?? ""}`.trim(), (e: unknown) => `failed: ${String(e).slice(0, 80)}`);
      }
    }
    await store.audit(who, "stripe.replay", eventId, JSON.stringify(out).slice(0, 300));
    res.json({ message: "Replayed.", ...out });
  }),
);

/* Expire a webhook-verification checkout session (metadata.purpose = webhook_verification*) or an unpaid qa+ test session, never a real order. Fires a signed checkout.session.expired. */
router.post("/ads/admin/stripe/expire-verification", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const id = str((req.body as Record<string, unknown> | undefined)?.sessionId, 120);
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return void res.status(400).json({ message: "Pass a checkout session id." });
    const stripe = getStripeClient();
    const s = await stripe.checkout.sessions.retrieve(id);
    // Also allowed: an unpaid QA checkout opened with a qa+ address on our own domain (live currency checks).
    const qaSession = /^qa\+[^@\s]*@silverbirchgrowth\.com$/i.test(String(s.customer_email ?? "")) && s.payment_status === "unpaid";
    if ((!String(s.metadata?.purpose ?? "").startsWith("webhook_verification") && !qaSession) || s.metadata?.reservationId) return void res.status(403).json({ message: "Only webhook-verification or unpaid qa+ sessions can be expired here." });
    if (s.status !== "open") return void res.json({ message: `Already ${s.status}.`, status: s.status });
    const x = await stripe.checkout.sessions.expire(id);
    await store.audit(who, "stripe.expire_verification", id);
    res.json({ message: "Expired.", status: x.status });
  }),
);

router.get("/ads/admin/email-preview", (req, res) => {
  if (!admin(req)) {
    res.redirect(302, "/ads/admin");
    return;
  }
  const a = loginLinkEmail("https://birchreserve.net/account/auth?t=PREVIEW");
  const b = hubAlertEmail({ hubName: "Example Physio Hub", category: "Recovery hardware", hubUrl: "https://scalehealth.ca" });
  noStore(res);
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Ad email previews</title><body style="font-family:Arial;background:#F9F8F6;padding:24px"><h1>Ad system emails</h1>
<p>Login links send: <b>${adsLoginEmailEnabled() ? "ON" : "OFF"}</b> (ADS_LOGIN_EMAIL_ENABLED). Hub alerts send: <b>${process.env.ADS_HUB_ALERT_EMAIL_ENABLED === "true" ? "ON" : "OFF"}</b> (ADS_HUB_ALERT_EMAIL_ENABLED). From: ${ADS_FROM().replace(/</g, "&lt;")}</p>
<h2>Subject: ${a.subject}</h2><div style="background:#fff;padding:16px;border-radius:12px">${a.html}</div><h2>Subject: ${b.subject}</h2><div style="background:#fff;padding:16px;border-radius:12px">${b.html}</div></body>`);
});

/* ------------------------------------------------------------------------------------------ cron */
router.get("/api/cron/ads-friday", (req, res) =>
  safe(res, async () => {
    if (!cronAuthorized(req.get("authorization"), process.env.CRON_SECRET)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.json(await syncToFriday({}));
  }),
);

export { placementLabel };
export default router;
