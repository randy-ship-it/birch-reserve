/**
 * ONE-SHOT cleanup of our own eval/test rows in activity_pulse_events (Randy, Nov 21 2026 7:03 PM ET).
 * Phase "dump": logs the candidate rows (id, action, region, time) as PULSE_PURGE_DUMP lines so they can be backed up.
 * Phase "delete": deletes ONLY the exact ids listed in PURGE_IDS (taken from the backup). Idempotent, production only.
 * Removed again right after it has run.
 */
import { sql } from "drizzle-orm";

export const PURGE_PHASE: "dump" | "delete" = "dump";
export const PURGE_SINCE = "2026-11-21T22:30:00Z";
export const PURGE_IDS: readonly string[] = [];

let started = false;
export function pulsePurgeOnce(): void {
  if (started || process.env.VERCEL_ENV !== "production") return;
  started = true;
  void (async () => {
    try {
      const db = (await import("@workspace/db")).db;
      if (PURGE_PHASE === "dump") {
        const res = await db.execute(sql`SELECT id::text AS id, action, category, who, region, src, src_id, created_at FROM activity_pulse_events WHERE created_at >= ${PURGE_SINCE}::timestamptz AND action LIKE 'chat\\_%' ORDER BY created_at`);
        const rows = ((res as unknown as { rows?: unknown[] }).rows ?? (res as unknown as unknown[])) as Array<Record<string, unknown>>;
        // Compact [id, action, region, src|src_id flag, ISO time] so a log line stays under the log viewer's line cap.
        const c = rows.map((r) => [r.id, String(r.action), r.region ?? "", r.src || r.src_id ? 1 : 0, new Date(String(r.created_at).replace(" ", "T").replace(/\+00$/, "Z")).toISOString()]);
        for (let i = 0; i < c.length; i += 16) console.log("PULSE_PURGE_DUMP2 " + JSON.stringify({ total: c.length, offset: i, rows: c.slice(i, i + 16) }));
        if (!rows.length) console.log("PULSE_PURGE_DUMP " + JSON.stringify({ total: 0 }));
      } else if (PURGE_IDS.length) {
        const ids = PURGE_IDS.map((x) => `'${x.replace(/[^0-9a-f-]/gi, "")}'`).join(",");
        const res = await db.execute(sql.raw(`DELETE FROM activity_pulse_events WHERE id::text IN (${ids}) AND action LIKE 'chat\\_%' AND src IS NULL AND src_id IS NULL RETURNING id::text`));
        const n = ((res as unknown as { rows?: unknown[] }).rows ?? (res as unknown as unknown[])).length;
        console.log("PULSE_PURGE_DONE " + JSON.stringify({ requested: PURGE_IDS.length, deleted: n }));
      }
    } catch (e) {
      console.log("PULSE_PURGE_ERROR " + String(e instanceof Error ? e.message : e));
    }
  })();
}
