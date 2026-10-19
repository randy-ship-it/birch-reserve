import { Router, type IRouter } from "express";
import { cronAuthorized } from "../lib/cronAuth";
import type { SplashLifecycleResult } from "../lib/splashReservationLifecycle";

type Cleanup = () => Promise<SplashLifecycleResult>;

async function defaultCleanup(): Promise<SplashLifecycleResult> {
  const { cleanupSplashReservations } = await import(
    "../lib/splashReservationLifecycle"
  );
  return cleanupSplashReservations();
}

let cleanup: Cleanup = defaultCleanup;

export function setSplashExpiryCleanupForTests(next: Cleanup | null): void {
  cleanup = next ?? defaultCleanup;
}

const router: IRouter = Router();

router.get("/api/cron/splash-expiry", async (req, res): Promise<void> => {
  const header = req.headers.authorization;
  const authorization = Array.isArray(header) ? header[0] : header;
  if (!cronAuthorized(authorization, process.env.CRON_SECRET)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await cleanup();
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    // A disabled Postgres endpoint must not turn the Vercel cron into a 500.
    // Seats stay as they are; the public read path already reports the open pool.
    req.log?.error({ err: error }, "Splash expiry cron skipped; database unavailable");
    res.status(200).json({
      ok: true,
      degraded: true,
      expiredUnpaid: 0,
      recycledPaid: 0,
      creativeWarningsSent: 0,
      creativeWarningsFailed: 0,
      skippedProcessing: 0,
      reconciledCheckouts: 0,
    });
  }
});

export default router;
