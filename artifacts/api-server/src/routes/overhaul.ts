/**
 * birchreserve.net overhaul API (Nov 12 2026). Standalone: no DB imports, so the
 * same router runs in production (mounted in app.ts) and in the preview function.
 *
 *  POST /v1/match            match-your-audience (modelled) -> Friday
 *  GET  /v1/area/quote       lock-down-my-area quote (modelled)
 *  POST /v1/area/checkout    Stripe Checkout (gated: AREA_LOCK_ENABLED / AREA_LOCK_LIVE)
 *  POST /v1/leads            email gate + publisher / agency inquiries -> Friday
 *  GET  /v1/overhaul/status  which checkouts are open (no secrets)
 */
import express, { Router, type IRouter, type Request, type Response } from "express";
import { fetchSiteSignals } from "../lib/overhaul/fetchSite";
import { emptySignals, normalizeUrl, scoreMatch } from "../lib/overhaul/audienceMatch";
import { quoteAreaLock, type Currency } from "../lib/overhaul/model";
import { buildAreaLockSession, checkoutGate } from "../lib/overhaul/checkout";
import { sendIntake, type IntakeKind } from "../lib/overhaul/fridayIntake";
import { PREMIUM_INQUIRY_MESSAGE, isPremiumOffer } from "../lib/premiumInquireOnly";

export type CreateSession = (params: Record<string, unknown>) => Promise<{ url: string | null; livemode: boolean }>;

const hits = new Map<string, number[]>();
function limited(req: Request, max: number, windowMs = 60_000): boolean {
  const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",").pop()!.trim() || "anon";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEAD_KINDS: IntakeKind[] = ["hub_access", "cobranded_hub_inquiry", "display_cpc_inquiry", "publisher_studio", "area_lock_interest", "agency_inquiry", "deposit_interest", "premium_inquiry"];

function originOf(req: Request): string {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "birchreserve.net");
  return `https://${host}`;
}

function utmOf(body: Record<string, unknown>): Record<string, string | undefined> {
  const u = (body.utm ?? {}) as Record<string, unknown>;
  return { utm_source: str(u.utm_source, 120) || undefined, utm_medium: str(u.utm_medium, 120) || undefined, utm_campaign: str(u.utm_campaign, 120) || undefined };
}

export function createOverhaulRouter(deps: { createSession?: CreateSession; log?: (msg: string, extra?: unknown) => void } = {}): IRouter {
  const router: IRouter = Router();
  const log = deps.log ?? (() => undefined);
  const json = express.json({ limit: "16kb" });

  router.get(["/publish", "/publish/"], (_req, res) => res.redirect(301, "/publish/brands"));
  // Short alias for the one-link media kit (keeps any query, e.g. UTM tags).
  router.get(["/mediakit", "/mediakit/"], (req, res) => {
    const q = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
    res.redirect(301, `/media-kit${q}`);
  });

  router.get("/v1/overhaul/status", (_req, res) => {
    const area = checkoutGate(process.env, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE");
    const deposits = checkoutGate(process.env, "SPONSOR_DEPOSITS_ENABLED", "SPONSOR_DEPOSITS_LIVE");
    res.set("Cache-Control", "no-store");
    // Area lock is in PREMIUM_INQUIRE_ONLY: never advertise card checkout for it.
    res.json({ areaLockCheckout: area.open && !isPremiumOffer("area-lock"), areaLockInquireOnly: isPremiumOffer("area-lock"), depositCheckout: deposits.open, stripeMode: area.mode, friday: Boolean(process.env.FRIDAY_API_URL && process.env.FRIDAY_API_KEY) });
  });

  router.post("/v1/match", json, async (req: Request, res: Response) => {
    if (limited(req, 12)) {
      res.status(429).json({ error: "Too many checks in a minute. Try again shortly." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const url = normalizeUrl(str(body.url, 400));
    const blurb = str(body.blurb, 2000);
    const email = str(body.email, 320);
    if (!url) {
      res.status(400).json({ error: "Enter your website, like yourstudio.com." });
      return;
    }
    const signals = process.env.MATCH_FETCH_DISABLED === "true" ? emptySignals(url, "Site fetch is off on this preview.") : await fetchSiteSignals(url);
    const result = scoreMatch(signals, blurb);
    const friday = await sendIntake({
      kind: "match_tool",
      email: EMAIL_RE.test(email) ? email : undefined,
      company: str(body.company, 160) || undefined,
      website: url,
      message: blurb || undefined,
      path: "/match",
      meta: {
        match_score: result.score,
        match_label: result.label,
        business_type: result.businessType,
        recommended: result.recommended.product,
        top_categories: result.topCategories.map((c) => `${c.label}:${c.strength}`).join(", "),
        site_title: signals.title.slice(0, 200) || undefined,
        site_fetched: signals.fetched,
        method: result.method,
        is_test: body.is_test === true || undefined,
      },
      utm: utmOf(body),
    });
    log("match", { host: signals.host, score: result.score, friday: friday.status });
    res.json({
      ...result,
      site: { host: signals.host, title: signals.title, description: signals.description, fetched: signals.fetched, note: signals.fetchNote ?? null, products: signals.products.slice(0, 6) },
      stored: friday.status,
    });
  });

  router.get("/v1/area/quote", (req: Request, res: Response) => {
    const cur = str(req.query.currency, 3).toLowerCase();
    const q = quoteAreaLock(str(req.query.postal, 12), Number(req.query.term ?? 3), cur === "cad" || cur === "usd" ? (cur as Currency) : undefined);
    if (!q.ok) {
      res.status(400).json(q);
      return;
    }
    res.set("Cache-Control", "no-store");
    res.json(q);
  });

  router.post("/v1/area/checkout", json, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const gate = checkoutGate(process.env, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE");
    const built = buildAreaLockSession(body, originOf(req));
    if (!built.ok) {
      res.status(400).json({ error: built.error });
      return;
    }
    // Every attempt reaches Friday, paid or not.
    const meta = built.params.metadata as Record<string, string>;
    const friday = await sendIntake({ kind: "area_lock_interest", email: str(body.email, 320), company: meta.business, website: meta.website || undefined, path: "/advertise/local", meta: { ...meta, checkout_open: gate.open, amount: built.amountCents / 100, currency: built.currency } });
    // PREMIUM_INQUIRE_ONLY: an area lock is never paid by card. The intake above is the inquiry.
    if (isPremiumOffer("area-lock")) {
      res.status(200).json({ held: true, inquire_only: true, message: `Inquiry sent. ${PREMIUM_INQUIRY_MESSAGE} We'll confirm your area within 1 business day. No charge was made.`, stored: friday.status });
      return;
    }
    if (!gate.open || !deps.createSession) {
      res.status(200).json({ held: true, message: "Reserved by inquiry. We'll confirm your area within 1 business day. No charge today.", stored: friday.status });
      return;
    }
    try {
      const session = await deps.createSession(built.params);
      res.json({ url: session.url, livemode: session.livemode, stored: friday.status });
    } catch (err) {
      log("area checkout failed", err);
      res.status(502).json({ error: "Checkout could not open. Email sales@silverbirchgrowth.com and we'll hold your area." });
    }
  });

  router.post("/v1/leads", json, async (req: Request, res: Response) => {
    if (limited(req, 20)) {
      res.status(429).json({ error: "Too many requests. Try again shortly." });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kind = str(body.kind, 40) as IntakeKind;
    const email = str(body.email, 320);
    if (!LEAD_KINDS.includes(kind)) {
      res.status(400).json({ error: "Unknown form." });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Add a work email." });
      return;
    }
    const fields = (body.fields ?? {}) as Record<string, unknown>;
    const meta: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields).slice(0, 20)) if (/^[a-z_]{2,40}$/.test(k)) meta[k] = str(v, 500);
    const friday = await sendIntake({
      kind,
      email,
      name: str(body.name, 120) || undefined,
      company: str(body.company, 160) || undefined,
      phone: str(body.phone, 40) || undefined,
      website: normalizeUrl(str(body.website, 400)) ?? undefined,
      message: str(body.message, 2000) || undefined,
      path: str(body.path, 200) || undefined,
      meta,
      utm: utmOf(body),
    });
    log("lead", { kind, friday: friday.status });
    res.json({ ok: true, stored: friday.status });
  });

  return router;
}
