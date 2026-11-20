import { Router, type IRouter } from "express";
import { cronAuthorized } from "../lib/cronAuth";
import { allowedRegion, allowedWho, isPulseAction, recordPulse } from "../lib/activityPulse";
import { ingestInstantly } from "../lib/pulseIngest";

/**
 * GET  /api/cron/pulse-ingest   hourly Vercel cron: new Instantly replies → activity pulse (lib/pulseIngest.ts).
 *      Auth: Bearer CRON_SECRET when that is set; otherwise Vercel's cron user agent, throttled to one run per 20 min.
 *      The job only reads Instantly and appends deduped, anonymized rows, so a spoofed call can at most cause one read.
 * POST /v1/activity-pulse/append  Bearer PULSE_INGEST_SECRET. For the daily inbox routine (Gmail has no server creds):
 *      body { events: [{ at, who, region, action, src_id }] }, every field checked against the fixed lists.
 */
export const pulseIngestRouter: IRouter = Router();

let lastRun = 0;
pulseIngestRouter.get("/api/cron/pulse-ingest", async (req, res): Promise<void> => {
  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const bySecret = cronAuthorized(auth, process.env.CRON_SECRET);
  const byAgent = /^vercel-cron\//i.test(String(req.headers["user-agent"] ?? "")) && Date.now() - lastRun > 20 * 60000;
  if (!bySecret && !byAgent) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  lastRun = Date.now();
  const r = await ingestInstantly();
  res.status(200).json(r);
});

pulseIngestRouter.post("/v1/activity-pulse/append", async (req, res): Promise<void> => {
  const auth = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  if (!cronAuthorized(auth, process.env.PULSE_INGEST_SECRET)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const events = Array.isArray(req.body?.events) ? (req.body.events as unknown[]).slice(0, 200) : [];
  let appended = 0;
  for (const raw of events) {
    const e = raw as Record<string, unknown>;
    const at = Date.parse(String(e.at ?? ""));
    const who = allowedWho(e.who);
    const srcId = typeof e.src_id === "string" && /^[a-z]+:[a-f0-9]{8,40}$/.test(e.src_id) ? e.src_id : null;
    if (!isPulseAction(e.action) || !who || !srcId || !Number.isFinite(at) || at > Date.now() || Date.now() - at > 90 * 864e5) continue;
    await recordPulse(e.action, null, { src: "inbox", who, region: allowedRegion(e.region), at: new Date(at), srcId });
    appended += 1;
  }
  res.json({ ok: true, appended });
});
