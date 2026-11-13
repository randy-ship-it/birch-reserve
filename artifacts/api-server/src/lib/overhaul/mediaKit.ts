/**
 * Media kit (/media-kit), Randy Nov 12 2026 7:12 PM ET. Pure numbers shared by the
 * page and its tests. Non-partner entry rates; every volume here is modelled.
 */

/** Effective CPM band for non-partner entry buys (modelled). */
export const MEDIA_KIT_CPM = { lo: 8, hi: 12 } as const;

export type KitExample = { spend: number; bonusPct: number; credit: number; imprLo: number; imprHi: number };

/** Prepaid spend plus bonus credit, then modelled impressions across the CPM band. */
export function kitExample(spend: number, bonusPct: number, cpm = MEDIA_KIT_CPM): KitExample {
  const credit = Math.round(spend * (100 + bonusPct)) / 100;
  return {
    spend,
    bonusPct,
    credit,
    imprLo: Math.round((credit / cpm.hi) * 1000),
    imprHi: Math.round((credit / cpm.lo) * 1000),
  };
}

export const MEDIA_KIT_OFFERS = {
  testRail: { name: "Test Rail", spend: 10_000, bonusPct: 10 },
  categoryLock: { name: "Category Lock", spendLo: 35_000, spendHi: 75_000, bonusPct: 15, months: 3 },
} as const;

export const MEDIA_KIT_EXAMPLES: KitExample[] = [
  kitExample(MEDIA_KIT_OFFERS.testRail.spend, MEDIA_KIT_OFFERS.testRail.bonusPct),
  kitExample(MEDIA_KIT_OFFERS.categoryLock.spendLo, MEDIA_KIT_OFFERS.categoryLock.bonusPct),
  kitExample(MEDIA_KIT_OFFERS.categoryLock.spendHi, MEDIA_KIT_OFFERS.categoryLock.bonusPct),
];

/** Agency: place a client, keep 10-12% of the client's spend as media credit. */
export const AGENCY_CREDIT_PCT = { lo: 10, hi: 12 } as const;
export function agencyCredit(clientSpend: number): { lo: number; hi: number } {
  return { lo: Math.round(clientSpend * AGENCY_CREDIT_PCT.lo) / 100, hi: Math.round(clientSpend * AGENCY_CREDIT_PCT.hi) / 100 };
}

/** Static fallback if Friday's cockpit feed can't be read. */
export const MEDIA_KIT_NETWORK_FALLBACK = { ordersYr: 20_000_000, monthlyViews: 128_000_000, listedPartners: 42 } as const;
export const FRIDAY_COCKPIT_URL = "https://fridayapp.org/api/public/birch/cockpit";

export type KitNetwork = { ordersYr: number; monthlyViews: number; listedPartners: number; live: boolean; asOf?: string };

/** Read the cockpit payload. Anything missing or implausible falls back to the static values. */
export function parseCockpit(data: unknown): KitNetwork {
  const d = (data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const signed = (d.signed ?? {}) as Record<string, unknown>;
  const orders = num(d.orders_yr);
  const views = num(d.monthly_views);
  const listed = num(d.listed_partners) ?? num(signed.listed);
  if (!orders || !views || !listed) return { ...MEDIA_KIT_NETWORK_FALLBACK, live: false };
  return { ordersYr: orders, monthlyViews: views, listedPartners: Math.round(listed), live: true, asOf: typeof d.as_of === "string" ? d.as_of : undefined };
}

/** 20,000,000 -> "20MM", 127,890,000 -> "128MM"; millions(1,375,000) -> "1.375M", millions(916,667) -> "0.92M". */
export function mm(n: number): string {
  return `${Math.round(n / 1_000_000)}MM`;
}
export function millions(n: number): string {
  const m = n / 1_000_000;
  // Exact thousands show as-is (1,375,000 -> 1.375M); anything else rounds to 3 significant figures.
  const s = n % 1000 === 0 ? String(m) : m < 1 ? m.toFixed(2) : m.toPrecision(3);
  return `${s.includes(".") ? s.replace(/\.?0+$/, "") : s}M`;
}
export function usd(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
export function usdK(n: number): string {
  return n % 1000 === 0 ? `$${n / 1000}K` : usd(n);
}

/** Categories (same slugs as /buycalc and Friday's seat feed). One brand each. */
export const MEDIA_KIT_CATEGORIES = [
  "Pain relief / topicals",
  "Recovery hardware",
  "Nutrition",
  "Sleep",
  "Meal prep",
  "Women’s health",
  "Men’s health",
  "Diagnostics / services",
] as const;
