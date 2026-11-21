/**
 * Public anonymized sample report: aggregate views and clicks by surface from the real ad-event store.
 * Excludes test / QA traffic (is_test) and anything on a test hub. No campaign, brand or visitor identifiers leave this module.
 * Clicks land on the brand's site UTM-tagged by surface (utm_content = slot key), so "UTM visits" here are those tagged click-throughs.
 * Surfaces with no real events are omitted: no zero counts, nothing padded.
 */
import { AD_SLOTS, placementLabel } from "./config";
import { db, S } from "./store";

export type PublicReport = {
  available: boolean;
  from?: string;
  to?: string;
  days?: number;
  totalViews?: number;
  totalClicks?: number;
  surfaces?: Array<{ key: string; label: string; views: number; clicks: number }>;
  source: string;
};
const SOURCE = "Measured on a live hub: Birch Reserve ad-event store, test and QA traffic excluded, aggregate only.";
let cache: { at: number; v: PublicReport } | null = null;

export async function publicSampleReport(): Promise<PublicReport> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.v;
  const p = await db();
  const { rows } = await p.query(
    `SELECT coalesce(placement, split_part(slot_key, '.', 2)) AS pl, hub, kind, count(*)::int AS n, min(at) AS first, max(at) AS last
       FROM ${S()}.ad_events WHERE kind IN ('view','click') AND is_test = false AND slot_key IS NOT NULL GROUP BY 1, 2, 3`,
  );
  const testHubs = new Set(AD_SLOTS.filter((s) => s.test).map((s) => s.hub));
  const by = new Map<string, { views: number; clicks: number }>();
  let first: Date | null = null, last: Date | null = null;
  for (const r of rows) {
    if (testHubs.has(String(r.hub))) continue;
    const k = String(r.pl);
    const t = by.get(k) ?? { views: 0, clicks: 0 };
    if (r.kind === "view") t.views += Number(r.n);
    else t.clicks += Number(r.n);
    by.set(k, t);
    const f = new Date(String(r.first)), l = new Date(String(r.last));
    if (!first || f < first) first = f;
    if (!last || l > last) last = l;
  }
  const surfaces = [...by.entries()].filter(([, t]) => t.views > 0).map(([key, t]) => ({ key, label: placementLabel(key), views: t.views, clicks: t.clicks })).sort((a, b) => b.views - a.views);
  const v: PublicReport = surfaces.length && first && last
    ? { available: true, from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10), days: Math.max(1, Math.round((+last - +first) / 864e5) + 1), totalViews: surfaces.reduce((a, s) => a + s.views, 0), totalClicks: surfaces.reduce((a, s) => a + s.clicks, 0), surfaces, source: SOURCE }
    : { available: false, source: SOURCE };
  cache = { at: Date.now(), v };
  return v;
}
