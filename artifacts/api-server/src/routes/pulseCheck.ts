/**
 * POST /v1/pulse-check             Rapid pulse check card (/agencies, /fit). Email + a few sentences about the agency's clients.
 * GET  /v1/pulse-check/export      Unsynced rows for the Google Sheet sync (header X-Pulse-Export-Key).
 * POST /v1/pulse-check/export/ack  Mark rows synced ({refs: [...]}).
 *
 * On submit: one row in rapid_pulse_checks, the CRM write (Friday, skipped for TEST), and the team alert email
 * (shared layout, "via birchreserve.net" / "via scalehealth.ca"). Nothing is ever emailed to the submitter.
 * Abuse guard: hidden honeypot, minimum fill time, 5 per IP per 10 minutes, 1 per address per hour (extra submits look
 * successful but store and send nothing), 40 per hour overall.
 */
import express, { Router, type IRouter, type Request, type Response } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { sendIntake, type IntakeInput, type IntakeResult } from "../lib/overhaul/fridayIntake";
import { alertSiteOf, sendSalesAlert, type SalesAlert, type SalesAlertResult } from "../lib/salesAlert";
import { limiter } from "../lib/rateLimit";
import { logger } from "../lib/logger";
import {
  PULSE_BLURB_MAX, PULSE_BLURB_MIN, PULSE_EMAIL_RE, PULSE_PER_EMAIL_WINDOW_MS, PgPulseStore, cleanPage, cleanText, isPulseTest, newPulseRef, sheetRowOf,
  type PulseStore,
} from "../lib/pulseCheck";

export const PULSE_CONFIRMATION = "Thanks. We'll reply within one business day with where you'd fit best.";

type Deps = {
  store?: PulseStore;
  sendIntake?: (i: IntakeInput) => Promise<IntakeResult>;
  sendAlert?: (a: SalesAlert) => Promise<SalesAlertResult>;
  exportKey?: () => string | undefined;
};

function clientIp(req: Request): string {
  const first = (v: string | undefined) => v?.split(",")[0]?.trim();
  return first(req.get("x-vercel-forwarded-for")) || first(req.get("x-real-ip")) || first(req.get("x-forwarded-for")) || req.ip || "anon";
}

function keyOk(given: string | undefined, want: string | undefined): boolean {
  if (!want || want.length < 24 || !given) return false;
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

export function createPulseCheckRouter(deps: Deps = {}): IRouter & { resetLimits(): void } {
  const router = Router() as IRouter & { resetLimits(): void };
  const store: PulseStore = deps.store ?? new PgPulseStore();
  const push = deps.sendIntake ?? ((i: IntakeInput) => sendIntake(i));
  const alert = deps.sendAlert ?? ((a: SalesAlert) => sendSalesAlert(a));
  const exportKey = deps.exportKey ?? (() => process.env["PULSE_CHECK_EXPORT_KEY"]?.trim());
  const perIp = limiter({ max: 5, windowMs: 10 * 60_000 });
  const overall = limiter({ max: 40, windowMs: 60 * 60_000 });
  const exportLimit = limiter({ max: 60, windowMs: 10 * 60_000 });
  const json = express.json({ limit: "16kb" });
  router.resetLimits = () => { perIp.reset(); overall.reset(); exportLimit.reset(); };

  router.post("/v1/pulse-check", json, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const ok = () => res.json({ ok: true, message: PULSE_CONFIRMATION });
    // Honeypot (any of the usual bait names) and too-fast fills: look successful, store and send nothing.
    if (cleanText(body["company_url"], 200) || cleanText(body["hp"], 200) || cleanText(body["fax"], 200)) return void ok();
    const renderedAt = Number(body["t"]);
    if (Number.isFinite(renderedAt) && renderedAt > 0 && Date.now() - renderedAt < 1500) return void ok();

    const email = cleanText(body["email"], 320).toLowerCase();
    const blurb = cleanText(body["blurb"], PULSE_BLURB_MAX + 200);
    if (!PULSE_EMAIL_RE.test(email)) return void res.status(400).json({ ok: false, error: "Add a valid email so we can reply." });
    if (blurb.length < PULSE_BLURB_MIN) return void res.status(400).json({ ok: false, error: "Add a couple of sentences about your clients and who they sell to." });
    if (blurb.length > PULSE_BLURB_MAX) return void res.status(400).json({ ok: false, error: "That's a bit long. A couple of sentences is plenty." });

    const ip = perIp.hit(clientIp(req));
    if (ip.limited || overall.hit("all").limited) {
      res.setHeader("Retry-After", String(Math.max(ip.retryAfterSec, 60)));
      return void res.status(429).json({ ok: false, error: "Too many requests. Try again in a few minutes." });
    }

    let dupe = false;
    try { dupe = await store.recentForEmail(email, PULSE_PER_EMAIL_WINDOW_MS); } catch (err) { logger.warn({ err: err instanceof Error ? err.message : String(err) }, "pulse check dedupe lookup failed"); }
    if (dupe) return void res.json({ ok: true, message: PULSE_CONFIRMATION, duplicate: true });

    const via = alertSiteOf(req);
    const page = cleanPage(body["path"]);
    const isTest = isPulseTest(email, blurb, body["test"]);
    const country = cleanText(req.get("x-vercel-ip-country"), 8);
    const userAgent = cleanText(req.get("user-agent"), 200);
    const ref = newPulseRef();

    let row;
    try {
      row = await store.insert({ ref, email, blurb, sourceSite: via, page, country, userAgent, status: "new", isTest, friday: "", alert: "" });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, "pulse check store failed");
    }

    // CRM write (skipped for TEST). A Friday failure never blocks the team alert.
    let friday = "skipped (TEST)";
    if (!isTest) {
      const r = await push({
        kind: "pulse_check", email, message: blurb, path: page,
        meta: { form: "rapid_pulse_check", source_site: via, ...(country ? { country } : {}), ref },
      }).catch(() => ({ status: "failed" as const, externalId: "" }));
      friday = r.status === "sent" ? "sent" : r.status === "skipped" ? "skipped (not configured)" : "failed";
    }
    const fridayFailed = friday === "failed";

    const scale = via === "scalehealth.ca";
    const sent: SalesAlertResult = await alert({
      via, event: "inquiry", tag: scale ? "SCALE PULSE CHECK" : "BIRCH PULSE CHECK",
      title: `Rapid pulse check: ${email}${fridayFailed ? " (Friday failed)" : ""}`,
      rows: [["Form", "Rapid pulse check (agency client base)"], ["Email", email], ["Client base", blurb], ["Source", `via ${via}`], ["Page", page], ["Country", country], ["CRM", friday], ["Ref", ref]],
      replyTo: email, isTest,
    }).catch((): SalesAlertResult => ({ status: "failed", to: [] }));

    if (row) await store.update(ref, { friday, alert: sent.status }).catch(() => undefined);
    req.log?.info({ kind: "pulse_check", ref, test: isTest, friday, alert: sent.status, stored: Boolean(row) }, "Rapid pulse check received");

    // The visitor only ever sees the confirmation. Test submissions also get the delivery receipt back for QA.
    res.status(201).json({ ok: true, message: PULSE_CONFIRMATION, ...(isTest ? { test: { ref, stored: Boolean(row), crm: friday, alert: sent.status, alertId: sent.id ?? null } } : {}) });
  });

  router.get("/v1/pulse-check/export", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const want = exportKey();
    if (!want) return void res.status(503).json({ ok: false, error: "Export is not configured." });
    if (exportLimit.hit(clientIp(req)).limited) return void res.status(429).json({ ok: false, error: "Slow down." });
    if (!keyOk(req.get("x-pulse-export-key"), want)) return void res.status(401).json({ ok: false, error: "Unauthorized." });
    const limit = Math.min(200, Math.max(1, Number(req.query["limit"]) || 100));
    try {
      const rows = await store.listUnsynced(limit);
      res.json({ ok: true, count: rows.length, rows: rows.map((r) => ({ ref: r.ref, isTest: r.isTest, crm: r.friday, alert: r.alert, sheetRow: sheetRowOf(r) })), columns: ["Timestamp (ET)", "Email", "Blurb", "Source site", "Page", "Country", "User agent", "Status", "Ref"] });
    } catch {
      res.status(500).json({ ok: false, error: "Export failed." });
    }
  });

  router.post("/v1/pulse-check/export/ack", json, async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const want = exportKey();
    if (!want) return void res.status(503).json({ ok: false, error: "Export is not configured." });
    if (!keyOk(req.get("x-pulse-export-key"), want)) return void res.status(401).json({ ok: false, error: "Unauthorized." });
    const refs = Array.isArray(req.body?.refs) ? (req.body.refs as unknown[]).map((r: unknown) => String(r)).filter((r: string) => /^pc-[a-z0-9-]{6,40}$/.test(r)).slice(0, 200) : [];
    try {
      res.json({ ok: true, acked: await store.ack(refs) });
    } catch {
      res.status(500).json({ ok: false, error: "Ack failed." });
    }
  });

  return router;
}

export default createPulseCheckRouter;
