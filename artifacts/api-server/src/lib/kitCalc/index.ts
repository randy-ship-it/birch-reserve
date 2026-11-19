/**
 * Kit calculator: pure TS + config.json, no framework, no Node or DOM imports.
 * Shared by birchreserve.net (Download my kit) and, later, scalehealth.ca/clinichubs.
 *
 * Side A ("Your revenue opportunity"), transparent math only:
 *   purchasesPerYear = repeat (visits / purchases per customer per year, >= 1)
 *   GP LTV per customer = AOV × purchasesPerYear × margin band (lo..hi) × horizon years (lo..hi)
 *   Scale visits         = spend ÷ blended hub CPM × 1000 × CTR band (lo..hi)        (Birch modelled figures)
 *   New customers        = Scale visits × your conversion scenario %
 *   Revenue opportunity  = new customers × AOV × purchasesPerYear × horizon years
 *   GP opportunity       = new customers × GP LTV
 *   Break-even customers = spend ÷ GP LTV
 * Every output is an Estimate.
 */
import CONFIG from "./config.json";

export const KIT_CALC_CONFIG = CONFIG;
export type MarginBandKey = (typeof CONFIG.marginBands)[number]["key"];
export type Range = [number, number];

export type KitCalcInput = {
  aovUsd: number;
  monthlyOrders: number;
  /** A number, or a repeat band [lo, hi] (chips 1 / 2–3 / 4–6 / 7+). */
  purchasesPerYear: number | Range;
  marginBand: MarginBandKey | string;
  spendUsd?: number;
  conversionPct?: number;
};

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const r0 = (n: number) => Math.round(n);

export function kitCalc(input: KitCalcInput) {
  const aov = clamp(input.aovUsd, 0, 100_000);
  const monthly = clamp(input.monthlyOrders, 0, 10_000_000);
  const ppyR: Range = Array.isArray(input.purchasesPerYear) ? [clamp(input.purchasesPerYear[0], 1, 365), clamp(input.purchasesPerYear[1], 1, 365)] : [clamp(input.purchasesPerYear, 1, 365), clamp(input.purchasesPerYear, 1, 365)];
  const ppy = ppyR[0];
  const band = CONFIG.marginBands.find((b) => b.key === input.marginBand) ?? CONFIG.marginBands[1]!;
  const spend = CONFIG.spendLevels.some((s) => s.usd === input.spendUsd) ? input.spendUsd! : CONFIG.spendLevels[0]!.usd;
  const conv = clamp(input.conversionPct ?? CONFIG.defaultConversionPct, 0, 100);
  const H = CONFIG.ltvHorizonYears;
  const D = CONFIG.demand;

  // Same formula as Friday ltv-v1: avg cart × margin band × purchases/yr × lifetime years (low with low, high with high).
  const gpPerOrder: Range = [r0(aov * band.lo), r0(aov * band.hi)];
  const ltvGp: Range = [r0(aov * band.lo * ppyR[0] * H.lo), r0(aov * band.hi * ppyR[1] * H.hi)];
  const ltvRevenue: Range = [r0(aov * ppyR[0] * H.lo), r0(aov * ppyR[1] * H.hi)];
  const views = Math.floor(((spend / D.blendedHubCpmUsd) * 1000) / 100) * 100;
  const visits: Range = [r0(views * D.ctrBand.lo), r0(views * D.ctrBand.hi)];
  const customers: [number, number] = [(visits[0] * conv) / 100, (visits[1] * conv) / 100];
  const revenueOpp: Range = [r0(customers[0] * ltvRevenue[0]), r0(customers[1] * ltvRevenue[1])];
  const gpOpp: Range = [r0(customers[0] * ltvGp[0]), r0(customers[1] * ltvGp[1])];
  const breakEven: Range = ltvGp[1] > 0 ? [Math.ceil(spend / ltvGp[1]), ltvGp[0] > 0 ? Math.ceil(spend / ltvGp[0]) : Infinity] : [Infinity, Infinity];
  const annualRevenue = r0(aov * monthly * 12);
  const customersPerYear = r0((monthly * 12) / ppy);
  const monthlyGp: Range = [r0(monthly * gpPerOrder[0]), r0(monthly * gpPerOrder[1])];

  return {
    inputs: { aovUsd: aov, monthlyOrders: monthly, purchasesPerYear: ppy, purchasesPerYearRange: ppyR, marginBand: band.key, marginLabel: band.label, spendUsd: spend, conversionPct: conv },
    current: { annualRevenueUsd: annualRevenue, customersPerYear, monthlyGpUsd: monthlyGp },
    gpPerOrderUsd: gpPerOrder,
    ltvGpUsd: ltvGp,
    ltvRevenueUsd: ltvRevenue,
    scale: { spendUsd: spend, modelledViews: views, visits, newCustomers: [Math.round(customers[0] * 10) / 10, Math.round(customers[1] * 10) / 10] as Range },
    revenueOppUsd: revenueOpp,
    gpOppUsd: gpOpp,
    breakEvenCustomers: breakEven,
    label: "Estimate" as const,
  };
}

export type KitCalcResult = ReturnType<typeof kitCalc>;

/** Repeat chip → [lo, hi] purchases per year. */
export function repeatRange(key: string): Range {
  const b = CONFIG.repeatBands.find((x) => x.key === key) ?? CONFIG.repeatBands[1]!;
  return [b.lo, b.hi];
}

export const KIT_CALC_FORMULA = [
  "GP LTV per customer = average cart × margin band × purchases per year × 1–3 years (low with low, high with high).",
  "Scale visits = spend ÷ blended hub CPM × 1,000 × the ‘Browsing the hub’ CTR band (Birch modelled figures).",
  "New customers = Scale visits × your conversion scenario.",
  "Revenue opportunity = new customers × average cart × purchases per year × 1–3 years.",
  "Gross-profit opportunity = new customers × GP LTV. Break-even = spend ÷ GP LTV.",
];

export const KIT_CALC_ASSUMPTIONS = [
  CONFIG.ltvHorizonYears.label,
  `Blended hub CPM $${CONFIG.demand.blendedHubCpmUsd} USD: ${CONFIG.demand.blendedHubCpmSource}.`,
  `CTR band ${(CONFIG.demand.ctrBand.lo * 100).toFixed(2)}–${(CONFIG.demand.ctrBand.hi * 100).toFixed(1)}%: ${CONFIG.demand.ctrBand.source}.`,
  CONFIG.conversionLabel,
  "Spend levels are existing Birch prices. Views are modelled, not guaranteed. No impression, click, sales or ROAS guarantee.",
];
