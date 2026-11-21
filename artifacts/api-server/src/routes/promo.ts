/**
 * Promo codes + street team (Randy, voice Nov 21 2026).
 *   Public:   POST /v1/promo/validate · /v1/promo/scan · /v1/promo/claim · /v1/promo/order
 *   Account:  POST /account/promo (signed-in customer adds a code)
 *   Admin:    /ads/admin/promo/* and /ads/admin/street/* (codes, redemptions CSV, members, links, QR)
 * Public responses carry no PII: member ids are name-only, and nothing about other redeemers is ever returned.
 */
import { createHash } from "node:crypto";
import express, { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { FixedWindowLimiter } from "../lib/rateLimit";
import { getStripeClient } from "../lib/stripeClient";
import { adminEmails, isBotUa, regularRateSummary } from "../lib/adserver/config";
import { verify } from "../lib/adserver/auth";
import { publicSampleReport } from "../lib/adserver/publicReport";
import * as promo from "../lib/adserver/promo";
import { promoCtxOf, siteOf } from "../lib/adserver/promoContext";
import { qrPng, qrSvg } from "../lib/adserver/qr";
import { draftCampaignFromCheckoutSafe } from "../lib/adserver/service";
import * as store from "../lib/adserver/store";
import { toCsv } from "../lib/adserver/ui";
import { hasQaUaToken, hasValidQaHeader, isTestIdentity } from "../lib/testTraffic";

const router: IRouter = Router();
const json = express.json({ limit: "8kb" });
const vLim = new FixedWindowLimiter({ max: 20, windowMs: 60_000 });
const cLim = new FixedWindowLimiter({ max: 8, windowMs: 10 * 60_000 });
const sLim = new FixedWindowLimiter({ max: 60, windowMs: 60_000 });
const oLim = new FixedWindowLimiter({ max: 40, windowMs: 60_000 });

const str = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const noStore = (res: Response) => res.set("Cache-Control", "no-store");
const origin = (req: Request) => `https://${req.get("x-forwarded-host") ?? req.get("host") ?? "birchreserve.net"}`;
const ip = (req: Request) => req.ip ?? "?";
const cookieOf = (req: Request, name: string): string | null => {
  for (const part of (req.get("cookie") ?? "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
};
const sameOrigin = (req: Request) => {
  const o = req.get("origin");
  if (!o) return req.get("sec-fetch-site") !== "cross-site";
  try {
    const h = new URL(o).host;
    return h === (req.get("x-forwarded-host") ?? req.get("host")) || h === "scalehealth.ca" || h === "www.scalehealth.ca";
  } catch {
    return false;
  }
};
const adminOf = (req: Request) => {
  const t = verify<{ e: string }>("adm", cookieOf(req, "br_ads_adm"));
  return t && adminEmails().includes(t.e) ? t.e : null;
};
function guard(req: Request, res: Response): string | null {
  const who = adminOf(req);
  if (!who || (req.method === "POST" && !sameOrigin(req))) {
    res.status(401).json({ message: "Sign in again." });
    return null;
  }
  return who;
}
async function safe(res: Response, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "promo route failed");
    if (!res.headersSent) res.status(500).json({ ok: false, message: "Something went wrong. Try again, or keep going without the code." });
  }
}

/* ------------------------------------------------------------------------------------------ public */
/** Anonymized aggregate sample report from the real ad-event store (no test traffic). Cached 5 minutes. */
router.get("/v1/ads/sample-report", (_req, res) =>
  safe(res, async () => {
    res.set("Cache-Control", "public, max-age=300");
    res.json(await publicSampleReport());
  }),
);

router.post("/v1/promo/validate", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    if (vLim.hit(`v:${ip(req)}`).limited) return void res.status(429).json({ ok: false, reason: "rate", message: "Too many tries. Wait a minute and try again, or keep going without the code." });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const r = await promo.validateCode(str(b.code, 60), promo.cleanEmail(b.email) || undefined);
    // Never echo the code (canonical or alias) back to the browser.
    res.json(r.ok ? { ok: true, creditUsd: r.creditUsd, label: r.label, message: r.message } : r);
  }),
);

/** A street team link opened. Aggregate only: one row per device per day, bots dropped. Answers { member } for an active member, else 204. */
router.post("/v1/promo/scan", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    if (sLim.hit(`s:${ip(req)}`).limited) return void res.status(204).end();
    const b = (req.body ?? {}) as Record<string, unknown>;
    const member = await promo.resolveMember(b.st);
    if (!member || isBotUa(req.get("user-agent"))) return void res.status(204).end();
    const day = new Date().toISOString().slice(0, 10);
    const vid = createHash("sha256").update(`${ip(req)}|${req.get("user-agent")}|${day}`).digest("hex").slice(0, 16);
    const site = siteOf(req);
    const test = hasValidQaHeader(req) || hasQaUaToken(req);
    const qrLabel = typeof b.qr === "string" && /^[a-z0-9_-]{1,40}$/i.test(b.qr) ? (b.qr === "1" ? "qr" : b.qr.toLowerCase()) : b.qr === true ? "qr" : null;
    await promo.streetEvent({ member, kind: "visit", site, isTest: test, dedupeKey: `v:${member}:${site}:${vid}:${day}` });
    if (qrLabel) await promo.streetEvent({ member, kind: "scan", qr: qrLabel, site, isTest: test, dedupeKey: `q:${member}:${site}:${qrLabel}:${vid}:${day}` });
    // The browser only lets ?ref= / ?via= take over attribution once this confirms an active member (member ids are name-only).
    res.json({ ok: true, member });
  }),
);

/** Add a code to an email without a purchase (e.g. checkout steps that already know the email). Stores a pending credit. */
router.post("/v1/promo/claim", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    if (!sameOrigin(req) || cLim.hit(`c:${ip(req)}`).limited) return void res.status(429).json({ ok: false, message: "Too many tries. Wait a few minutes." });
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = promo.cleanEmail(b.email);
    if (!promo.validEmail(email)) return void res.status(400).json({ ok: false, message: "Add your work email so we can attach the credit." });
    const ctx = promoCtxOf(req);
    const r = await promo.claimCode({ code: str(b.code, 60) || ctx.code || "", email, company: str(b.company, 160) || null, site: ctx.site, st: ctx.st, src: "claim" });
    res.json(r.ok ? { ok: true, message: `Code accepted: ${r.label}. It attaches when you buy or sign in to your account.`, label: r.label } : { ok: false, reason: r.reason, message: r.message });
  }),
);

/** Thank-you page: what was applied to this order. Reconciles from Stripe when the webhook has not landed yet. */
router.post("/v1/promo/order", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    if (oLim.hit(`o:${ip(req)}`).limited) return void res.status(429).json({ applied: false });
    const sid = str((req.body as Record<string, unknown>)?.session_id, 220);
    if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) return void res.status(400).json({ applied: false });
    const show = async (r: Awaited<ReturnType<typeof promo.redemptionForSession>>) =>
      r ? { applied: true, label: promo.creditLabel(r.creditMicros), member: await promo.memberLabel(r.st), rate: regularRateSummary().line, compare: regularRateSummary().compare } : null;
    const hit = await show(await promo.redemptionForSession(sid));
    if (hit) return void res.json(hit);
    let session;
    try {
      session = await getStripeClient().checkout.sessions.retrieve(sid);
    } catch {
      return void res.json({ applied: false });
    }
    if (session.payment_status !== "paid") return void res.json({ applied: false });
    await draftCampaignFromCheckoutSafe(session);
    const again = await show(await promo.redemptionForSession(sid));
    if (again) return void res.json(again);
    const code = session.metadata?.promo;
    const found = code ? await promo.findCode(code) : null;
    res.json(found && !promo.codeProblem(found) ? { applied: false, pending: true, label: promo.creditLabel(found.creditMicros) } : { applied: false });
  }),
);

/**
 * QA proof for the referral e2e (Playwright on birchreserve.net and the Scale mirror): the attribution fields Stripe holds on an
 * OPEN, unpaid Checkout Session created in the last hour for a qa+ / test identity. Anything else is a 404. Returns only the
 * name-only member id, QR label, code and site; never an email, amount or anything about real buyers.
 */
router.post("/v1/promo/attribution", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    if (oLim.hit(`a:${ip(req)}`).limited) return void res.status(429).json({ ok: false });
    const sid = str((req.body as Record<string, unknown>)?.session_id, 220);
    if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) return void res.status(400).json({ ok: false });
    let s;
    try {
      s = await getStripeClient().checkout.sessions.retrieve(sid);
    } catch {
      return void res.status(404).json({ ok: false });
    }
    const email = s.customer_details?.email || s.customer_email || "";
    const fresh = Date.now() / 1000 - (s.created ?? 0) < 3600;
    if (s.status !== "open" || s.payment_status === "paid" || !fresh || !isTestIdentity({ email })) return void res.status(404).json({ ok: false });
    const md = s.metadata ?? {};
    res.json({ ok: true, st: md.st ?? null, st_qr: md.st_qr ?? null, promo: md.promo ?? null, site: md.site ?? null, sold_by: md.sold_by ?? null });
  }),
);

/** Signed-in customer adds a code from /account: credit attaches now. */
router.post("/account/promo", json, (req, res) =>
  safe(res, async () => {
    noStore(res);
    const email = verify<{ e: string }>("a", cookieOf(req, "br_ads_acct"))?.e;
    if (!email) return void res.status(401).json({ ok: false, message: "Sign in to add a code." });
    if (!sameOrigin(req) || cLim.hit(`ca:${ip(req)}`).limited) return void res.status(429).json({ ok: false, message: "Too many tries. Wait a few minutes." });
    const ctx = promoCtxOf(req);
    const code = str((req.body as Record<string, unknown>)?.code, 60);
    const r = await promo.claimCode({ code, email, site: ctx.site, st: ctx.st, src: "account" });
    if (!r.ok) return void res.json({ ok: false, reason: r.reason, message: r.message });
    await promo.attachPendingForAccount(email, "account");
    res.json({ ok: true, message: `Code applied: ${r.label} added to your account. Ad spend only, no cash value.` });
  }),
);

/* ------------------------------------------------------------------------------------------ admin */
router.post("/ads/admin/promo/save", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const exp = str(b.expires, 10);
    const max = Math.round(Number(b.max));
    const r = await promo.saveCode(
      {
        code: str(b.code, 60), creditUsd: Number(b.credit), maxRedemptions: Number.isFinite(max) && max > 0 ? max : null,
        expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(exp) ? new Date(`${exp}T05:00:00.000Z`) : null, notes: str(b.notes, 300) || null,
        aliases: str(b.aliases, 200).split(",").map((x) => x.trim()).filter(Boolean),
      },
      who,
    );
    res.status(r.ok ? 200 : 400).json({ message: r.message });
  }),
);
router.post("/ads/admin/promo/:key/:action", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const action = String(req.params.action);
    if (action !== "enable" && action !== "disable") return void res.status(404).json({ message: "Not found." });
    const ok = await promo.setCodeActive(String(req.params.key), action === "enable", who);
    res.status(ok ? 200 : 404).json({ message: ok ? `Code ${action}d.` : "No such code." });
  }),
);
router.post("/ads/admin/street/member", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const id = str(b.id, 40).toLowerCase();
    const r = await promo.createMember(id, str(b.label, 60), who);
    if (!r.ok) return void res.status(400).json({ message: r.message });
    const site = b.site === "scale" ? "scale" : "birch";
    const label = str(b.qrLabel, 60) || (site === "scale" ? "scale-intake-digital" : "birch-intake");
    const url = promo.shareUrl(id, site, str(b.code, 60) || null, label.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40));
    await promo.registerQr(id, label, site, url, who);
    res.json({ message: `${r.message} Link copied; reload to see it in the table.`, copy: `${url}\nQR PNG: ${`${origin(req)}/ads/admin/street/qr.png?member=${encodeURIComponent(id)}&label=${encodeURIComponent(label)}`}`, url, png: `/ads/admin/street/qr.png?member=${encodeURIComponent(id)}&label=${encodeURIComponent(label)}` });
  }),
);
router.get(["/ads/admin/street/qr.png", "/ads/admin/street/qr.svg"], (req, res) =>
  safe(res, async () => {
    if (!adminOf(req)) return void res.status(401).end();
    const member = str(req.query.member, 40);
    const label = str(req.query.label, 60);
    const q = (await promo.listQrs()).find((x) => x.member === member && x.label === label);
    if (!q) return void res.status(404).end();
    noStore(res);
    if (req.path.endsWith(".svg")) res.type("image/svg+xml").send(qrSvg(q.url));
    else res.set("Content-Disposition", `inline; filename="${member}-${label}.png"`).type("image/png").send(qrPng(q.url));
  }),
);
router.get("/ads/admin/export/:what", (req, res, next) =>
  safe(res, async () => {
    const what = String(req.params.what).replace(/\.csv$/, "");
    if (what !== "promo-redemptions" && what !== "street-team") return void next();
    const who = adminOf(req);
    if (!who) return void res.redirect(302, "/ads/admin");
    let rows: Array<Record<string, unknown>>;
    if (what === "promo-redemptions") {
      rows = (await promo.listRedemptions(50_000)).map((r) => ({ at: r.createdAt, code: r.code, email: r.email, company: r.company, site: r.site, street_team: r.st, source: r.src, status: r.status, credit_usd: r.creditMicros / 1_000_000, order: r.sessionId, campaign_id: r.campaignId, applied_at: r.appliedAt, test: r.isTest }));
    } else {
      rows = (await promo.streetStats()).map((m) => ({ member: m.id, visits: m.visits, qr_scans: m.scans, intakes: m.intakes, code_redemptions: m.redemptions, credits_applied: m.applied, paid_orders: m.orders, revenue: m.revenue.map((x) => `${(x.cents / 100).toFixed(2)} ${x.currency.toUpperCase()}`).join(" + ") }));
    }
    await store.audit(who, "export", what);
    noStore(res);
    res.set("Content-Disposition", `attachment; filename="birch-${what}.csv"`).type("text/csv").send(toCsv(rows) || "empty\n");
  }),
);
router.post("/ads/admin/promo-test/purge", json, (req, res) =>
  safe(res, async () => {
    const who = guard(req, res);
    if (!who) return;
    res.json({ message: `Removed ${await promo.purgeTestPromo(who)} test redemptions.` });
  }),
);

export default router;
