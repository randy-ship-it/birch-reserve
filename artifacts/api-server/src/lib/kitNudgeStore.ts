/**
 * NudgeStore on the BR leads table (brand_intake rows, production only; see brandIntakeProxy defaultRecordLead).
 * Abandoned = meta.stage "abandoned"; one nudge max = meta.nudged_at set atomically; meta.unsub stops any reminder.
 * Both keys are in leads.ts META_STRING_KEYS, so later partial saves keep them.
 */
import { leadsDb } from "./leads";
import type { AbandonedLead, NudgeStore } from "./kitEmails";

const ID = (id: string) => `brandintake:${id}`.slice(0, 200);
const rolesOf = (need: string | null) => (need?.match(/\(([^)]*)\)/)?.[1] ?? "").split(",").map((s) => s.trim()).filter((s) => /^(supplier|publisher|kit|brand)$/.test(s));

export class PgNudgeStore implements NudgeStore {
  async listAbandoned(olderThan: Date, limit: number): Promise<AbandonedLead[]> {
    const m = await leadsDb();
    const r = await m.pool.query(
      `SELECT source_ref, email, company, updated_at FROM leads
        WHERE source = 'brand_intake' AND is_test = false AND email IS NOT NULL
          AND meta->>'stage' = 'abandoned' AND meta->>'nudged_at' IS NULL AND meta->>'unsub' IS NULL
          AND updated_at < $1
        ORDER BY updated_at ASC LIMIT $2`,
      [olderThan, Math.min(200, Math.max(1, limit))],
    );
    return r.rows.map((x: Record<string, unknown>) => ({ id: String(x.source_ref), email: String(x.email), website: (x.company as string) ?? null, updatedAt: x.updated_at as Date }));
  }
  async claimNudge(id: string, now: Date): Promise<boolean> {
    const m = await leadsDb();
    const r = await m.pool.query(
      `UPDATE leads SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('nudged_at', $2::text)
        WHERE id = $1 AND meta->>'stage' = 'abandoned' AND meta->>'nudged_at' IS NULL AND meta->>'unsub' IS NULL
        RETURNING id`,
      [ID(id), now.toISOString()],
    );
    return (r.rowCount ?? 0) === 1;
  }
  async unsubscribe(id: string, email: string, now: Date): Promise<void> {
    const m = await leadsDb();
    await m.pool.query(`UPDATE leads SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('unsub', $3::text) WHERE id = $1 AND lower(email) = lower($2)`, [ID(id), email, now.toISOString()]);
  }
  async get(id: string): Promise<{ email: string; website: string | null; roles: string[] } | null> {
    const m = await leadsDb();
    const r = await m.pool.query(`SELECT email, company, need FROM leads WHERE id = $1 AND source = 'brand_intake'`, [ID(id)]);
    const x = r.rows[0] as Record<string, string | null> | undefined;
    return x?.email ? { email: x.email, website: x.company ?? null, roles: rolesOf(x.need ?? null) } : null;
  }
}
