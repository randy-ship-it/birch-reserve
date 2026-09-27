/**
 * IndexNow for birchreserve.net.
 *
 * GET /{key}.txt — public key file (mounted at the origin root, and also
 * listed on the API service so Autoscale does not SPA-rewrite it).
 * The same bytes live in artifacts/clinichub-media/public/{key}.txt, which
 * Vite copies next to robots.txt for the static host.
 *
 * POST /api/ops/indexnow/notify — same X-Birch-QA gate as /api/ops/mail-test.
 * The body is ignored. Only INDEXNOW_URL_LIST is submitted.
 * Rate limit: 6 per hour per instance.
 */
import { Router, type IRouter } from "express";
import { hasValidQaHeader } from "../lib/testTraffic";
import { limiter } from "../lib/rateLimit";
import { logger } from "../lib/logger";
import { INDEXNOW_KEY, submitIndexNow } from "../lib/indexNow";

export const INDEXNOW_NOTIFY_MAX_PER_HOUR = 6;
const notifyLimiter = limiter({ max: INDEXNOW_NOTIFY_MAX_PER_HOUR, windowMs: 60 * 60_000 });

export const indexNowKeyRouter: IRouter = Router();

indexNowKeyRouter.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => {
  res.set({
    "Cache-Control": "public, max-age=3600",
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.send(INDEXNOW_KEY);
});

const router: IRouter = Router();

router.post("/ops/indexnow/notify", async (req, res): Promise<void> => {
  if (!hasValidQaHeader(req)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const hit = notifyLimiter.hit("global");
  if (hit.limited) {
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ ok: false, error: "IndexNow notify limit reached (6 per hour). Try again later." });
    return;
  }
  try {
    const result = await submitIndexNow();
    if (!result.ok) {
      logger.warn({ status: result.status, body: result.body.slice(0, 500) }, "IndexNow notify failed");
      res.status(502).json({
        ok: false,
        indexNowStatus: result.status,
        error: result.body.slice(0, 500) || "IndexNow rejected the submission.",
      });
      return;
    }
    logger.info({ status: result.status }, "IndexNow notify accepted");
    res.status(200).json({ ok: true, indexNowStatus: result.status });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "request_failed";
    logger.warn({ err: msg }, "IndexNow notify failed");
    res.status(502).json({ ok: false, error: msg.slice(0, 200) });
  }
});

export default router;
