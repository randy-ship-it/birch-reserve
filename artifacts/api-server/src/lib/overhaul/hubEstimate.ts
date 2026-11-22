/**
 * Hub earnings estimate (Randy, Nov 21 2026 9:53 PM ET: simple form in, simple exciting numbers out).
 * Pure and shared by the /intake card and its tests. Everything derives from the existing model:
 *   views            from orders, visitors and list size (ratios of the network median hub, PUBLISHER_SURFACES)
 *   offers shown     views x sell-through (20% planning assumption, band 10-30%)
 *   clicks           offers shown x CTR band     (PERFORMANCE_RANGES, #350)
 *   orders           clicks x conversion band    (PERFORMANCE_RANGES, #350)
 *   sales driven     orders x average cart       (value created for the brands; NOT hub income)
 *   hub earnings     offers shown / 1000 x published starter CPM x hub share (70% under 1MM views a month, 75% at 1MM+, 80% at 3MM+, 85% at 5MM+; shareForViews) (media revenue; independent of sales)
 * Model is USD; CAD visitors see x CAD_PER_USD. All outputs are per month; yearly = monthly x 12.
 */
import { PUBLISHER_SURFACES, shareForViews, EMAIL_OPEN_PCT_MID } from "./brandIntake";
import { SELL_ASSUMPTION_PCT } from "./agencyShowcase";
import { PERFORMANCE_RANGES } from "./proofContent";

export type Level = "low" | "typical" | "high";
export const SENDS_PER_MONTH = 4; // visible planning assumption for newsletter views = list size x sends
/** Share of views that carry a paid brand offer. Low = our 20% planning assumption (ramp); High = 60%, the bottom of the 60-80% direct
 * sell-through Google News Initiative gives as a target for a well-run direct-sold business; Likely = the midpoint, 40%. */
export const SELL_BAND = [SELL_ASSUMPTION_PCT, SELL_ASSUMPTION_PCT * 2, SELL_ASSUMPTION_PCT * 3] as const;
export const CART_PRESETS = [50, 80, 120, 200] as const;

const surf = (k: string) => PUBLISHER_SURFACES.find((s) => s.key === k)!;
const BASE_ORDERS = surf("post_purchase").monthlyViews!;
const BASE_VISITORS = surf("home").monthlyViews!;
/** Which published band each surface uses. Post-purchase = row 0; everything else = Activation (row 2). The newsletter has no
 * band of its own on file, so it takes the lowest published one (Activation) rather than an invented number. */
const pick = (b: { lo: number; hi: number }, l: Level) => (l === "low" ? b.lo : l === "high" ? b.hi : (b.lo + b.hi) / 2);
type Band = { lo: number; hi: number };
const avg = (a: Band, b: Band): Band => ({ lo: (a.lo + b.lo) / 2, hi: (a.hi + b.hi) / 2 });
/** Bands per surface (all from PERFORMANCE_RANGES, #350). The post-purchase surface is the thank-you and booking-confirmation page,
 * so it averages the Post-purchase row (2-5% / 4-8%) and the Thank-you row (1-3% / 3-6%). Hub home, member dashboard, product and
 * services pages use the Activation row (0.5-2% / 2-5%); there is no separate published band for product/services pages. */
const surfaceBand = (key: string): { ctr: Band; conversion: Band } => {
  const r = PERFORMANCE_RANGES.rows;
  if (key === "post_purchase") return { ctr: avg(r[0]!.ctr, r[1]!.ctr), conversion: avg(r[0]!.conversion, r[1]!.conversion) };
  return { ctr: r[2]!.ctr, conversion: r[2]!.conversion };
};
/** Email band (public benchmarks, health and fitness / wellness). Views for email are OPENS (an ad is seen when the email is opened),
 * so email views = list x sends x open rate. Clicks are per send, then restated per open. Sponsored-slot share of an email's clicks
 * has no public benchmark: 15-35% (typical 25%) is OUR assumption for one sponsored slot among a newsletter's links. */
export const EMAIL = {
  openRate: { lo: 19.2, hi: 47.81 } as Band, // Campaign Monitor wellness and fitness 19.2% (2022); MailerLite health and fitness 47.81% (2026, inflated by Apple Mail Privacy)
  clickPerSend: { lo: 0.72, hi: 1.45 } as Band, // Omnisend beauty and fitness 0.72%; Campaign Monitor 1.2%; Klaviyo health and beauty 1.24%; MailerLite health and fitness 1.45%
  slotShare: { lo: 15, hi: 35 } as Band, // assumption, flagged
  sources: [
    { label: "MailerLite 2026 benchmarks, health and fitness: 47.81% open, 1.45% click (3.6M campaigns)", url: "https://www.mailerlite.com/blog/compare-your-email-performance-metrics-industry-benchmarks" },
    { label: "Klaviyo 2026 benchmarks, health and beauty campaigns: 30.5% open, 1.24% click", url: "https://www.klaviyo.com/products/email-marketing/benchmarks" },
    { label: "Campaign Monitor, wellness and fitness: 19.2% open, 1.2% click", url: "https://www.campaignmonitor.com/resources/guides/email-marketing-benchmarks/" },
    { label: "Omnisend, beauty and fitness campaigns: 0.72% click (via The Retentionist)", url: "https://theretentionist.com/benchmarks/email-marketing-benchmarks-by-industry/" },
  ],

} as const;
const emailOpen = EMAIL_OPEN_PCT_MID;

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
  const viewsOf: Record<string, number> = {
    post_purchase: orders,
    member_dashboard: (orders * surf("member_dashboard").monthlyViews!) / BASE_ORDERS,
    home: visitors,
    product: (visitors * surf("product").monthlyViews!) / BASE_VISITORS,
    services: (visitors * surf("services").monthlyViews!) / BASE_VISITORS,
    newsletter: (list * SENDS_PER_MONTH * emailOpen) / 100, // opens, not sends
  };
  const totalViews = Object.values(viewsOf).reduce((a, b) => a + b, 0);
  const sharePct = shareForViews(totalViews);
  const share = sharePct / 100;
  const earn = { low: 0, likely: 0, high: 0 };
  const surfaces: SurfaceOut[] = Object.keys(viewsOf).map((key) => {
    const s = surf(key);
    const views = viewsOf[key]!;
    const band = surfaceBand(key);
    const shown = (views * SELL_BAND[1]) / 100;
    // Email: sponsored clicks per open = click rate per send / open rate x slot share (typical open rate, so earnings never move with the level).
    const ctrPct = key === "newsletter" ? (pick(EMAIL.clickPerSend, inp.level) / emailOpen) * pick(EMAIL.slotShare, inp.level) : pick(band.ctr, inp.level);
    const clicks = (shown * ctrPct) / 100;
    const conv = key === "newsletter" ? pick(surfaceBand("home").conversion, inp.level) : pick(band.conversion, inp.level);
    const ord = (clicks * conv) / 100;
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
    ctrPct: shown ? (clicks / shown) * 100 : 0, convPct: clicks ? (ord / clicks) * 100 : 0, sellPct: SELL_BAND[1], sharePct,
    grossMedia: share ? earn.likely / share : 0,
  };
}

/** Benchmarks behind the "Compared with typical publisher earnings" line. */
export const COMPARE_SOURCES = [
  { label: "EarnifyHub 2026: health and wellness RPM $25-38 Mediavine, $30-45 Raptive, $14-25 Ezoic", url: "https://earnifyhub.com/blog/blogging/mediavine-vs-raptive-vs-ezoic-rpm" },
  { label: "Revenue By AdApp: health and wellness page RPM about $5-9 (conservative)", url: "https://www.revenuebyadapp.com/estimates/mediavine/health" },
  { label: "Google News Initiative: direct-sold CPMs $10-20 at 60-80% sell-through", url: "https://newsinitiative.withgoogle.com/resources/trainings/estimate-ad-revenue/" },
  { label: "Rokt ecommerce terms: post-purchase partners receive 50% of advertiser receipts", url: "https://www.rokt.com/policies/product-specific-terms" },
  { label: "Mediavine revenue share: 75% to 90% by annual earnings", url: "https://help.mediavine.com/revenue-share" },
  { label: "Google AdSense: 80% after the advertiser platform fee, about 68% when Google Ads buys the ad", url: "https://support.google.com/adsense/answer/180195?hl=en" },
  { label: "Aftersell docs: Rokt Thanks earns merchants about $0.20-0.50 per order", url: "https://docs.aftersell.com/aftersell/earn-save" },
  { label: "SenderCircle: wellness newsletter sponsorship about $15 per 1,000 opens", url: "https://sendercircle.com/guides/wellness-newsletter-advertising-rates" },
  { label: "RMIQ citing BCG: onsite retail media retains 70-90% margin", url: "https://www.rmiq.net/glossary/retail-media-monetization/" },
] as const;
