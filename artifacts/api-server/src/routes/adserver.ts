/**
 * Birch Reserve ad system routes (Randy t330u, Nov 21 2026).
 *   Public:   /ads/embed.js · /ads/px.js · /ads/docs · /v1/ads/serve · /v1/ads/v · /v1/ads/c · /v1/ads/px · /v1/ads/postback · /v1/ads/cr/:id
 *   Customer: /account (+ /login, /auth, /logout, /alerts, /creative, /report.csv)
 *   Admin:    /ads/admin (+ campaigns, creatives, royalties, ledger, exports, Friday sync)
 *   Cron:     /api/cron/ads-friday (daily aggregate push to Friday)
 */
import * as promoLib from "../lib/adserver/promo";
import { promoAdminHtml } from "../lib/adserver/promoAdmin";
import { attachPendingForAccount } from "../lib/adserver/promo";
import express, { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { getStripeClient } from "../lib/stripeClient";
import { checkCreative, buyStore } from "../lib/buyFlow";
import { cronAuthorized } from "../lib/cronAuth";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { ADS_FROM, hubAlertEmail, loginLinkEmail, siteMail } from "../lib/adserver/mail";
import { ALERT_CATEGORIES, AD_DEFAULTS, PROMO_RATE_BPS, isPromoCampaign, MICROS, PLACEMENTS, adminEmails, adsLoginEmailEnabled, findSlot, placementLabel, type Placement } from "../lib/adserver/config";
import { pixelId, postbackKey, safeEqual, sign, verify } from "../lib/adserver/auth";
import * as store from "../lib/adserver/store";
import { draftCampaignFromCheckoutSafe, recordClick, recordConversion, recordView, serve } from "../lib/adserver/service";
import { EMBED_JS, PIXEL_JS } from "../lib/adserver/embed";
import { dashboardPage, loginPage } from "../lib/adserver/accountPage";
import { adminLoginPage, adminPage } from "../lib/adserver/adminPage";
import { docsPage } from "../lib/adserver/docsPage";
import { fridayReady, syncToFriday } from "../lib/adserver/friday";
import { toCsv } from "../lib/adserver/ui";
import type { CampaignPatch } from "../lib/adserver/store";

export const AD_CREATIVE_MIN = { width: 300, height: 50 } as const;

const router: IRouter = Router();
const json = express.json({ limit: "32kb" });
const raw = express.raw({ type: ["image/*", "application/octet-stream"], limit: "2200kb" });
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
  return promoAdminHtml({ codes, redemptions, street, qrs });
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

/* ------------------------------------------------------------------------------------------ serving */
router.options("/v1/ads/*splat", (_req, res) => {
  cors(res);
  res.status(204).end();
});

router.get("/v1/ads/serve", (req, res) =>
  safe(res, async () => {
    cors(res);
    noStore(res);
    const r = await serve({ slot: str(req.query.slot, 80), vid: str(req.query.v, 64) || null, test: req.query.test === "1", ua: ua(req), dnt: req.query.dnt === "1" || dntHeader(req), origin: origin(req) });
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

router.get("/v1/ads/cr/:id", (req, res) =>
  safe(res, async () => {
    const id = String(req.params.id).replace(/\.[a-z]+$/, "");
    const cr = await store.creativeData(id);
    if (!cr) {
      res.status(404).end();
      return;
    }
    if (cr.status !== "approved") {
      const mine = Boolean(admin(req)) || customer(req) === cr.accountEmail;
      if (!mine) {
        res.status(404).end();
        return;
      }
      res.set("Cache-Control", "private, no-store");
    } else {
      cors(res);
      res.set("Cache-Control", "public, max-age=86400");
    }
    res.set({ "Content-Type": cr.mime, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" }).send(cr.data);
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
    res.type("html").send(dashboardPage(await accountView(email, origin(req))));
  }),
);

/** First sign-in straight from a paid Stripe Checkout Session (the success page links here). */
router.get("/account/login", (req, res) =>
  safe(res, async () => {
    noStore(res);
    const sid = str(req.query.session_id, 220);
    if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) {
      res.redirect(302, "/account");
      return;
    }
    let session;
    try {
      session = await getStripeClient().checkout.sessions.retrieve(sid);
    } catch {
      res.type("html").send(loginPage({ error: "We couldn't find that payment. Email sales@silverbirchgrowth.com and we'll send your dashboard link." }));
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
    res.redirect(302, "/account");
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
      res.status(503).json({ message: "Email sign-in links are switching on shortly. Email sales@silverbirchgrowth.com for your dashboard link." });
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
    res.redirect(302, "/account?e=expired");
    return;
  }
  setCookie(res, ACCT, sign("a", { e: t.e }, 14 * 864e5), 14 * 86400);
  res.redirect(302, "/account");
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

async function uploadCreative(req: Request, campaignId: string, actor: string, approve: boolean): Promise<{ ok: boolean; message: string }> {
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const chk = checkCreative(buf, AD_CREATIVE_MIN); // display banners (728×90, 320×50, 656×280) are wider than tall
  if (!chk.ok) return { ok: false, message: chk.error };
  await store.addCreative({ campaignId, mime: chk.value.mime, width: chk.value.width, height: chk.value.height, data: buf, alt: str(req.query.alt, 200), uploadedBy: actor, status: approve ? "approved" : "pending" });
  return { ok: true, message: approve ? "Creative uploaded and approved." : "Creative sent for review. We'll approve it within 1 business day." };
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
    res.status(r.ok ? 200 : 400).json({ message: r.message });
  }),
);

router.get("/account/report.csv", (req, res) =>
  safe(res, async () => {
    const email = customer(req);
    if (!email) {
      res.redirect(302, "/account");
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
    const [hubs, testRoyalties] = await Promise.all([store.listContractHubs(), store.royalties(6, { testOnly: true })]);
    const byC = new Map<string, typeof creatives>();
    for (const cr of creatives) byC.set(cr.campaignId, [...(byC.get(cr.campaignId) ?? []), cr]);
    const brand = new Map(campaigns.map((c) => [c.id, c.brand]));
    const dayT = { serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 };
    for (const [id, t] of day) if (!campaigns.find((c) => c.id === id)?.isTest) for (const k of Object.keys(dayT) as Array<keyof typeof dayT>) dayT[k] += t[k];
    res.type("html").send(
      adminPage({
        who, campaigns: campaigns.map((c) => ({ c, t: totals.get(c.id) ?? { serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 } })),
        pending: creatives.filter((x) => x.status === "pending" && ids.includes(x.campaignId)).map((x) => ({ ...x, brand: brand.get(x.campaignId) ?? "" })),
        creativesByCampaign: byC, slotTotals, ledger: led, royalties: roy, shares, alerts, audit, day: dayT, friday: fridayReady(), schema: store.adSchema(),
        promoHtml: await promoPanels(), hubs, testRoyalties,
        orders: orders.map((o) => ({ id: o.id, at: o.createdAt, email: o.email, company: o.company, plan: o.plan, format: o.format, creativeId: o.creativeId })),
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
  if (b.hubs !== undefined || b.allowSubstitute !== undefined) p.hubs = (Array.isArray(b.hubs) ? b.hubs : []).map(String).filter((h) => findSlot(`${h}.landing`));
  if (b.allowSubstitute !== undefined) p.allowSubstitute = b.allowSubstitute === true;
  if (b.exclusive !== undefined) p.exclusive = b.exclusive === true;
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
      clickUrl: patch.clickUrl ?? null, exclusive: patch.exclusive, isTest: b.isTest === true, notes: patch.notes ?? null, orderKind: "manual (admin)", actor: who,
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
    const r = await uploadCreative(req, c.id, who, req.query.approve === "true");
    res.status(r.ok ? 200 : 400).json({ message: r.message });
  }),
);

router.post("/ads/admin/creatives/:id/status", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const to = req.query.to === "approved" ? "approved" : req.query.to === "rejected" ? "rejected" : null;
    if (!to) {
      res.status(400).json({ message: "Bad status." });
      return;
    }
    const reason = str((req.body as Record<string, unknown> | undefined)?.reason, 300);
    if (to === "rejected" && !reason) {
      res.status(400).json({ message: "Add a reason. The buyer sees it on their dashboard." });
      return;
    }
    const ok = await store.setCreativeStatus(String(req.params.id), to, who, to === "rejected" ? reason : null);
    res.status(ok ? 200 : 404).json({ message: ok ? (to === "approved" ? "Approved." : "Rejected.") : "Not found." });
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
    res.json({ message: `${name} is on contract. Its placements are sellable now (slot keys ${key}.landing … ${key}.post_purchase).` });
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
    await store.addCreative({ campaignId: c.id, mime: cr.mime, width: cr.width, height: cr.height, data: cr.data, alt: `${c.brand} (sponsored)`, uploadedBy: `${who} (from /buy)`, status: "pending", sourceRef: `buy:${order.id}` });
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
      rows = cs.map((c) => ({ id: c.id, brand: c.brand, email: c.accountEmail, status: c.status, test: c.isTest, order: c.orderRef, kind: c.orderKind, currency: c.currency, budget: (c.budgetMicros / MICROS).toFixed(2), spent: (c.spentMicros / MICROS).toFixed(2), pricing: c.pricing, placement: c.primaryPlacement, auto_move: c.allowSubstitute, flight_start: c.flightStart, flight_end: c.flightEnd, viewable: t.get(c.id)?.views ?? 0, clicks: t.get(c.id)?.clicks ?? 0, conversions: t.get(c.id)?.convs ?? 0 }));
    } else if (what === "ledger") {
      rows = (await store.ledger({ limit: 50_000 })).map((l) => ({ at: l.at, campaign_id: l.campaignId, kind: l.kind, slot: l.slotKey, partner: l.partner, units: l.units, amount: (l.amountMicros / MICROS).toFixed(6), currency: l.currency, note: l.note, actor: l.actor, test: l.isTest }));
    } else if (what === "royalties") {
      rows = (await store.royalties(13)).map((r) => ({ partner: r.partner, month: r.month, currency: r.currency, delivered: (r.grossMicros / MICROS).toFixed(2), share_pct: r.shareBps === null ? "" : (r.shareBps / 100).toFixed(2), payable: r.payableMicros === null ? "" : (r.payableMicros / MICROS).toFixed(2), status: r.status, approved_by: r.approvedBy, approved_at: r.approvedAt }));
    } else if (what === "payouts") {
      rows = (await store.payoutRows()).map((r) => ({ partner: r.partner, month: r.month, currency: r.currency, delivered: (Number(r.gross_micros) / MICROS).toFixed(2), share_pct: (Number(r.share_bps) / 100).toFixed(2), amount_to_pay: (Number(r.payable_micros) / MICROS).toFixed(2), status: r.status, approved_by: r.approved_by, approved_at: r.approved_at, paid_ref: r.paid_ref ?? "", paid_by: r.paid_by ?? "", paid_at: r.paid_at ?? "" }));
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

router.get("/ads/admin/email-preview", (req, res) => {
  if (!admin(req)) {
    res.redirect(302, "/ads/admin");
    return;
  }
  const a = loginLinkEmail("https://birchreserve.net/account/auth?t=PREVIEW");
  const b = hubAlertEmail({ hubName: "Example Physio Hub", category: "Recovery hardware", hubUrl: "https://scalehealth.ca" });
  noStore(res);
  res.type("html").send(`<!doctype html><meta charset="utf-8"><title>Ad email previews (not sending)</title><body style="font-family:Arial;background:#f8f6ef;padding:24px"><h1>Ad system emails (preview only)</h1>
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
