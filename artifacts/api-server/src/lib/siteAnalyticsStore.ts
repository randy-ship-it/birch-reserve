/**
 * Storage for site analytics rows (lib/siteAnalytics.ts). Production writes site_cta_events (columns added on first
 * use, additive only, lib/schemaEnsure.ts). Without DATABASE_URL (local QA, tests) rows live in this instance's memory.
 */
import { applyAdditiveColumns } from "./schemaEnsure";
import type { EventRow } from "./siteAnalytics";

export const SITE_ANALYTICS_DDL = [
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS label text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS area text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS skin text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS device text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS browser text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS os text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS ref_host text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS utm_source text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS utm_medium text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS utm_campaign text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS src text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS vh text",
  "ALTER TABLE IF EXISTS site_cta_events ADD COLUMN IF NOT EXISTS is_test boolean",
] as const;

export type InsertRow = Omit<EventRow, "createdAt"> & { offer: string | null; area: string | null; utmMedium: string | null; utmCampaign: string | null };
type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

export interface SiteAnalyticsStore {
  insert(r: InsertRow): Promise<void>;
  since(sinceMs: number, limit?: number): Promise<EventRow[]>;
}

export function memoryStore(): SiteAnalyticsStore & { rows: EventRow[] } {
  const rows: EventRow[] = [];
  return {
    rows,
    async insert(r) { rows.push({ ...r, createdAt: new Date() }); if (rows.length > 50_000) rows.splice(0, 10_000); },
    async since(ms) { return rows.filter((r) => r.createdAt.getTime() >= ms); },
  };
}

export function pgStore(pool: Queryable): SiteAnalyticsStore {
  let ready: Promise<unknown> | null = null;
  const ensure = () => (ready ??= applyAdditiveColumns(pool, SITE_ANALYTICS_DDL).catch((e) => { ready = null; throw e; }));
  return {
    async insert(r) {
      await ensure();
      await pool.query(
        `INSERT INTO site_cta_events (event, path, offer, label, area, skin, device, browser, os, ref_host, utm_source, utm_medium, utm_campaign, src, vh, is_test)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [r.event, r.path, r.offer, r.label, r.area, r.skin, r.device, r.browser, r.os, r.refHost, r.utmSource, r.utmMedium, r.utmCampaign, r.src, r.vh, r.isTest],
      );
    },
    async since(ms, limit = 120_000) {
      await ensure();
      const res = await pool.query(
        `SELECT event, path, label, skin, device, browser, os, ref_host, utm_source, src, vh, coalesce(is_test, false) AS is_test, created_at
         FROM site_cta_events WHERE created_at >= $1 ORDER BY created_at ASC LIMIT $2`,
        [new Date(ms), limit],
      );
      return (res.rows as Array<Record<string, unknown>>).map((x) => ({
        event: String(x.event), path: String(x.path), label: (x.label as string) ?? null, skin: (x.skin as string) ?? null, device: (x.device as string) ?? null,
        browser: (x.browser as string) ?? null, os: (x.os as string) ?? null, refHost: (x.ref_host as string) ?? null, utmSource: (x.utm_source as string) ?? null,
        src: (x.src as string) ?? null, vh: (x.vh as string) ?? null, isTest: Boolean(x.is_test), createdAt: new Date(x.created_at as string),
      }));
    },
  };
}

let current: SiteAnalyticsStore | null = null;
export function setSiteAnalyticsStore(s: SiteAnalyticsStore | null): void { current = s; }
export async function siteAnalyticsStore(): Promise<SiteAnalyticsStore> {
  if (current) return current;
  if (!process.env.DATABASE_URL) return (current = memoryStore());
  const { pool } = await import("@workspace/db");
  return (current = pgStore(pool));
}
