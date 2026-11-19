import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { requireSalesStaff } from "../lib/salesStaffAccess";
import { parseShareEvent, shareBurstLimited, shareStore, summarize } from "../lib/shareEvents";

/** Share + referral tracking (see lib/shareEvents.ts). Mounted after body parsing and Clerk. */
export const shareEventsRouter: IRouter = Router();

shareEventsRouter.post("/v1/share-events", async (req, res): Promise<void> => {
  if (shareBurstLimited()) {
    res.status(429).end();
    return;
  }
  let body: unknown = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const ev = parseShareEvent(body);
  if (!ev) {
    res.status(400).json({ error: "Unsupported event." });
    return;
  }
  try {
    await shareStore().add(ev);
  } catch (error) {
    logger.warn({ err: error }, "Share event was not stored");
  }
  res.status(204).end();
});

shareEventsRouter.get("/api/sales/share-events", requireSalesStaff, async (req, res): Promise<void> => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  try {
    const s = shareStore();
    const rows = await s.list(days, 5000);
    res.json(summarize(rows, s.name, days));
  } catch (error) {
    logger.warn({ err: error }, "Share events could not be read");
    res.status(503).json({ error: "Share events are unavailable right now." });
  }
});
