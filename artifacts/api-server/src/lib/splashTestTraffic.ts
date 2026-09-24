/**
 * Splash reservations get the same is_test marking as leads (6:50pm). Marking ONLY:
 * seat claims, holds, checkout and QA-hold release are untouched. Best-effort:
 * never blocks or fails a real reservation.
 */
import { db, splashAdReservationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Attribution } from "./leads";
import { isTestIdentity } from "./testTraffic";

type Log = { info?: (obj: object, msg: string) => void; warn?: (obj: object, msg: string) => void } | undefined;

export async function markSplashReservationTestIfQa(
  reservationId: string,
  opts: { qaHeader: boolean; email: string; name?: string | null; attribution?: Attribution; log?: Log },
): Promise<boolean> {
  const attribution = opts.attribution ?? {};
  if (Object.keys(attribution).length) opts.log?.info?.({ reservationId, attribution }, "Birch Reserve reservation attribution");
  const isTest = opts.qaHeader || isTestIdentity({ email: opts.email, name: opts.name ?? null });
  if (!isTest) return false;
  try {
    await db.update(splashAdReservationsTable).set({ isTest: true }).where(eq(splashAdReservationsTable.id, reservationId));
    opts.log?.info?.({ reservationId }, "Birch Reserve reservation marked is_test");
    return true;
  } catch (error) {
    opts.log?.warn?.({ reservationId, err: error instanceof Error ? error.message : "mark_test_failed" }, "Could not mark reservation is_test");
    return false;
  }
}
