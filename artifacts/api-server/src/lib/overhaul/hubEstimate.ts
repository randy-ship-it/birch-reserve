/**
 * Hub earnings estimate (Randy, Nov 21 2026 9:53 PM ET: simple form in, simple exciting numbers out).
 * Pure and shared by the /intake card and its tests. Everything derives from the existing model:
 *   views            from orders, visitors and list size (ratios of the network median hub, PUBLISHER_SURFACES)
 *   offers shown     views x sell-through (20% planning assumption, band 10-30%)
 *   clicks           offers shown x CTR band     (PERFORMANCE_RANGES, #350)
 *   orders           clicks x conversion band    (PERFORMANCE_RANGES, #350)
 *   sales driven     orders x average cart       (value created for the brands; NOT hub income)
 *   hub earnings     offers shown / 1000 x published starter CPM x 35% share (media revenue; independent of sales)
 * Model is USD; CAD visitors see x CAD_PER_USD. All outputs are per month; yearly = monthly x 12.
 */
import { PUBLISHER_SURFACES, PAYOUT } from "./brandIntake";
import { SELL_ASSUMPTION_PCT } from "./agencyShowcase";
import { PERFORMANCE_RANGES } from "./proofContent";

export type Level = "low" | "typical" | "high";
export const SENDS_PER_MONTH = 4; // visible planning assumption for newsletter views = list size x sends
export const SELL_BAND = [SELL_ASSUMPTION_PCT / 2, SELL_ASSUMPTION_PCT, SELL_ASSUMPTION_PCT * 1.5] as const;
export const CART_PRESETS = [50, 80, 120, 200] as const;

const surf = (k: string) => PUBLISHER_SURFACES.find((s) => s.key === k)!;
const BASE_ORDERS = surf("post_purchase").monthlyViews!;
const BASE_VISITORS = surf("home").monthlyViews!;
/** Which published band each surface uses. Post-purchase = row 0; everything else = Activation (row 2). The newsletter has no
 * band of its own on file, so it takes the lowest published one (Activation) rather than an invented number. */
const BAND_ROW: Record<string, 0 | 2> = { post_purchase: 0, member_dashboard: 2, home: 2, product: 2, services: 2, newsletter: 2 };
const pick = (b: { lo: number; hi: number }, l: Level) => (l === "low" ? b.lo : l === "high" ? b.hi : (b.lo + b.hi) / 2);

export type HubInputs = { orders: number; visitors: number | null; newsletter: boolean; list: number; cart: number; level: Level };
export const DEFAULT_INPUTS: HubInputs = { orders: BASE_ORDERS, visitors: null, newsletter: true, list: Math.round(surf("newsletter").monthlyViews! / SENDS_PER_MONTH), cart: 80, level: "typical" };
export const defaultVisitors = (orders: number) => Math.round((BASE_VISITORS * orders) / BASE_ORDERS);

export type SurfaceOut = { key: string; label: string; views: number; shown: number; clicks: number; orders: number; sales: number; earn: number };
export type HubOut = {
  views: number; shown: number; clicks: number; orders: number; sales: number;
  earn: { low: number; likely: number; high: number }; year: number; surfaces: SurfaceOut[];
  ctrPct: number; convPct: number; sellPct: number; sharePct: number; grossMedia: number;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : 0));

export function estimateHub(inp: HubInputs): HubOut {
  const orders = clamp(inp.orders, 0, 5_000_000);
  const visitors = clamp(inp.visitors ?? defaultVisitors(orders), 0, 50_000_000);
  const list = inp.newsletter ? clamp(inp.list, 0, 50_000_000) : 0;
  const cart = clamp(inp.cart, 0, 100_000);
  const share = PAYOUT.basePct / 100;
  const viewsOf: Record<string, number> = {
    post_purchase: orders,
    member_dashboard: (orders * surf("member_dashboard").monthlyViews!) / BASE_ORDERS,
    home: visitors,
    product: (visitors * surf("product").monthlyViews!) / BASE_VISITORS,
    services: (visitors * surf("services").monthlyViews!) / BASE_VISITORS,
    newsletter: list * SENDS_PER_MONTH,
  };
  const rows = PERFORMANCE_RANGES.rows;
  const earn = { low: 0, likely: 0, high: 0 };
  const surfaces: SurfaceOut[] = Object.keys(viewsOf).map((key) => {
    const s = surf(key);
    const views = viewsOf[key]!;
    const band = rows[BAND_ROW[key]!]!;
    const shown = (views * SELL_BAND[1]) / 100;
    const clicks = (shown * pick(band.ctr, inp.level)) / 100;
    const ord = (clicks * pick(band.conversion, inp.level)) / 100;
    const cpm = s.cpm!;
    const pay = (pct: number, c: number) => (((views * pct) / 100) / 1000) * c * share;
    earn.low += pay(SELL_BAND[0], cpm[0]);
    earn.likely += pay(SELL_BAND[1], (cpm[0] + cpm[1]) / 2);
    earn.high += pay(SELL_BAND[2], cpm[1]);
    return { key, label: s.label, views, shown, clicks, orders: ord, sales: ord * cart, earn: pay(SELL_BAND[1], (cpm[0] + cpm[1]) / 2) };
  });
  const sum = (f: (s: SurfaceOut) => number) => surfaces.reduce((a, s) => a + f(s), 0);
  const shown = sum((s) => s.shown), clicks = sum((s) => s.clicks), ord = sum((s) => s.orders);
  return {
    views: sum((s) => s.views), shown, clicks, orders: ord, sales: sum((s) => s.sales), earn, year: earn.likely * 12, surfaces,
    ctrPct: shown ? (clicks / shown) * 100 : 0, convPct: clicks ? (ord / clicks) * 100 : 0, sellPct: SELL_BAND[1], sharePct: PAYOUT.basePct,
    grossMedia: share ? earn.likely / share : 0,
  };
}
