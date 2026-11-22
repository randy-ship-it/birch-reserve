import { Router, type IRouter } from "express";
import { pulseFeed } from "../lib/activityPulse";
import { pulsePurgeOnce } from "../lib/pulsePurge";

/** GET /v1/activity-pulse: the latest real anonymized events (lib/activityPulse.ts). `show:false` hides the strip. */
export const activityPulseRouter: IRouter = Router();

activityPulseRouter.get("/v1/activity-pulse", async (_req, res): Promise<void> => {
  pulsePurgeOnce();
  const feed = await pulseFeed();
  res.set("Cache-Control", "public, max-age=60, s-maxage=60");
  res.json(feed);
});
