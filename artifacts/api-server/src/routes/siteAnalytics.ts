/**
 * Live site analytics (Randy, voice, Nov 23 2026): /ads/admin/analytics (admin sign-in, same cookie as /ads/admin),
 * its JSON feed, and a signed read-only link for Friday (/analytics/live?k=…, frameable by fridayapp.org only).
 * Data: lib/siteAnalytics.ts (events) + Stripe Checkout Sessions (read-only list, cached 60 s).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { adminEmails } from "../lib/adserver/config";
import { sign, verify } from "../lib/adserver/auth";
import { getStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";
import { summarize, type AnalyticsSummary, type StripeFunnel } from "../lib/siteAnalytics";
import { siteAnalyticsStore } from "../lib/siteAnalyticsStore";
import { analyticsPage } from "../lib/siteAnalyticsPage";

const ADM = "br_ads_adm";
function cookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
const adminOf = (req: Request) => {
  const t = verify<{ e: string }>("adm", cookie(req, ADM));
  return t && adminEmails().includes(t.e) ? t.e : null;
};
const linkVersion = () => process.env.ANALYTICS_LINK_VERSION?.trim() || "1";
const linkOk = (k: unknown) => {
  const t = verify<{ v: string }>("ana", k);
  return Boolean(t && t.v === linkVersion());
};

export const RANGES = { today: "today", "7d": 7, "30d": 30 } as const;
type Range = keyof typeof RANGES;
export function sinceFor(range: Range, now = Date.now()): number {
  if (range === "today") {
    // Midnight in Toronto.
    const d = new Date(now);
    const tz = new Date(d.toLocaleString("en-US", { timeZone: "America/Toronto" }));
    const offset = d.getTime() - tz.getTime();
    tz.setHours(0, 0, 0, 0);
    return tz.getTime() + offset;
  }
  return now - (RANGES[range] as number) * 86_400_000;
}

/* --------------------------------------------------------------------------------------- Stripe (read-only) */
const QA_EMAIL = /qa-test|\+qa\b|\+test\b|@example\.(com|org)$/i;
let stripeCache = new Map<string, { at: number; v: StripeFunnel }>();
type StripeLister = (sinceSec: number) => Promise<Array<{ created: number; status: string | null; payment_status: string; success_url: string | null; cancel_url: string | null; email: string | null }>>;
let lister: StripeLister = async (sinceSec) => {
  const out: Awaited<ReturnType<StripeLister>> = [];
  for await (const s of getStripeClient().checkout.sessions.list({ created: { gte: sinceSec }, limit: 100 })) {
    out.push({ created: s.created, status: s.status, payment_status: s.payment_status, success_url: s.success_url ?? null, cancel_url: s.cancel_url ?? null, email: s.customer_details?.email ?? s.customer_email ?? null });
    if (out.length >= 1000) break;
  }
  return out;
};
export function setStripeListerForTests(l: StripeLister | null): void { if (l) lister = l; stripeCache = new Map(); }

export async function stripeFunnel(sinceMs: number): Promise<StripeFunnel> {
  const key = String(Math.floor(sinceMs / 60_000));
  const hit = stripeCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  let v: StripeFunnel;
  try {
    const all = await lister(Math.floor(sinceMs / 1000));
    const ours = all.filter((s) => /birchreserve\.net|scalehealth\.ca/.test(`${s.success_url ?? ""} ${s.cancel_url ?? ""}`) && !QA_EMAIL.test(s.email ?? ""));
    const bySkin: Record<string, number> = {};
    for (const s of ours) { const k = /scalehealth\.ca/.test(`${s.success_url} ${s.cancel_url}`) ? "scale" : "birch"; bySkin[k] = (bySkin[k] ?? 0) + 1; }
    v = { created: ours.length, paid: ours.filter((s) => s.status === "complete" && s.payment_status === "paid").length, createdBySkin: bySkin, available: true };
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "analytics: stripe list failed");
    v = { created: 0, paid: 0, createdBySkin: {}, available: false, note: "Stripe not reachable from this deployment" };
  }
  stripeCache.set(key, { at: Date.now(), v });
  return v;
}

/* --------------------------------------------------------------------------------------- summary cache */
const summaryCache = new Map<Range, { at: number; v: AnalyticsSummary }>();
const TTL: Record<Range, number> = { today: 4_000, "7d": 15_000, "30d": 60_000 };
export async function analyticsSummary(range: Range): Promise<AnalyticsSummary> {
  const hit = summaryCache.get(range);
  if (hit && Date.now() - hit.at < TTL[range]) return hit.v;
  const sinceMs = sinceFor(range);
  const [rows, stripe] = await Promise.all([(await siteAnalyticsStore()).since(sinceMs), stripeFunnel(sinceMs)]);
  const v = summarize(rows, { sinceMs, stripe, bucket: range === "today" ? "hour" : "day" });
  summaryCache.set(range, { at: Date.now(), v });
  return v;
}

const router: IRouter = Router();
const page = (res: Response, html: string, embed: boolean) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
  if (embed) {
    res.removeHeader("X-Frame-Options");
    res.set("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'self' https://fridayapp.org https://*.fridayapp.org");
  }
  res.type("html").send(html);
};

router.get(["/ads/admin/analytics", "/ads/admin/analytics/"], (req, res) => {
  const who = adminOf(req);
  if (!who) { res.redirect(302, "/ads/admin?next=analytics"); return; }
  page(res, analyticsPage({ who, embed: false }), false);
});

router.get(["/analytics/live", "/analytics/live/"], (req, res) => {
  if (!linkOk(req.query.k)) { res.status(403).type("text/plain").set("Cache-Control", "no-store").send("This analytics link is not valid or has been revoked."); return; }
  page(res, analyticsPage({ who: null, embed: true }), true);
});

router.get("/ads/admin/analytics.json", async (req, res) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  if (!adminOf(req) && !linkOk(req.query.k)) { res.status(401).json({ error: "sign_in_required" }); return; }
  const r = String(req.query.range ?? "today");
  const range: Range = r === "7d" || r === "30d" ? r : "today";
  try {
    res.json(await analyticsSummary(range));
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "analytics summary failed");
    res.status(503).json({ error: "unavailable" });
  }
});

router.post("/ads/admin/analytics/link", (req, res) => {
  res.set("Cache-Control", "no-store");
  const who = adminOf(req);
  if (!who) { res.status(401).json({ message: "Sign in first." }); return; }
  const origin = (req.get("origin") ?? "").replace(/\/$/, "");
  if (origin && !/^https:\/\/(www\.)?birchreserve\.net$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { res.status(403).json({ message: "Wrong origin." }); return; }
  const k = sign("ana", { v: linkVersion(), by: who }, 365 * 86_400_000);
  logger.info({ by: who }, "analytics: Friday link minted");
  res.json({ url: `https://birchreserve.net/analytics/live?k=${encodeURIComponent(k)}` });
});

export default router;
