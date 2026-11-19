/**
 * The one view model both kit sides render from. Two sources:
 *   preview: the shared calculator module, instantly, while the user types (labelled "Live preview").
 *   friday:  Friday's brand-report.v1 (ltv + demand_fit shown exactly as returned, never recomputed).
 * Demand reach (views → visits → customers) is Birch's own modelled math in both cases; Friday has no field for it yet.
 */
import { visibleHubs } from "../../../api-server/src/lib/overhaul/hubMatch";
import { CHANNEL_GEO, channelEligibility, type Eligibility, type Market } from "../../../api-server/src/lib/kitCalc/channelGeo";
import type { KitCalcResult } from "../../../api-server/src/lib/kitCalc";
type Range = readonly [number, number];
import { KIT_CALC_FORMULA } from "../../../api-server/src/lib/kitCalc";
import { EXPOSURE_CHANNELS, HUB_RATE_RANGE, hubFit } from "../../../api-server/src/lib/overhaul/brandIntake";
import type { FridayReport } from "./fridayBrandIntake";

export type KitView = {
  source: "preview" | "friday" | "sample";
  mock: boolean;
  brand: string;
  categoryLabel: string;
  ltvGp: Range | null;
  gpPerOrder: Range | null;
  ltvNote: string;
  scale: KitCalcResult["scale"];
  revenueOpp: Range;
  gpOpp: Range | null;
  breakEven: Range | null;
  chips: string[];
  formula: string[];
  fitHeader: string;
  hubs: Array<{ name: string; status: string; fitLabel: string; what?: string }>;
  channels: Array<{ key: string; name: string; figures: string[]; fitLabel: string | null; rateNote: string; image?: string; geo?: string; eligibility?: Eligibility }>;
  hubRates: { cpm: Range; cpc: Range; fitLabel: string | null };
  mapDataUrl?: string;
};

const FKEY: Record<string, string> = { hubs: "scale-hubs", calm_joints: "calm-joints", street_team: "street-team", retail: "retail-network" };
const tileFigures = (key: string) => {
  const r = EXPOSURE_CHANNELS.find((c) => c.key === key)?.reach;
  return r && r !== "Figures to come" ? [r] : [];
};

export function chipsFor(calc: KitCalcResult, repeatLabel: string): string[] {
  return [`Cart $${calc.inputs.aovUsd.toLocaleString("en-US")}`, `${calc.inputs.monthlyOrders.toLocaleString("en-US")} orders/mo`, `${repeatLabel}× a year`, `Margin ${calc.inputs.marginLabel}`, `Scenario ${calc.inputs.conversionPct}%`];
}

export function previewView(calc: KitCalcResult, o: { brand: string; categoryKey: string; categoryLabel: string; repeatLabel: string; mapDataUrl?: string; domain?: string | null }): KitView {
  return {
    source: "preview",
    mock: false,
    brand: o.brand,
    categoryLabel: o.categoryLabel,
    ltvGp: calc.ltvGpUsd,
    gpPerOrder: calc.gpPerOrderUsd,
    ltvNote: "Live preview · 1–3 years at your purchase rate and margin band",
    scale: calc.scale,
    revenueOpp: calc.revenueOppUsd,
    gpOpp: calc.gpOppUsd,
    breakEven: calc.breakEvenCustomers,
    chips: chipsFor(calc, o.repeatLabel),
    formula: KIT_CALC_FORMULA.slice(0, 3),
    fitHeader: "Live preview · fit confirmed after you submit",
    hubs: visibleHubs(hubFit(o.categoryKey), { category: o.categoryKey, domain: o.domain }).map((h) => ({ name: h.name, status: h.live ? "Live" : "In queue", fitLabel: `${h.fit} · preview`, what: h.what })),
    channels: EXPOSURE_CHANNELS.slice(1).map((c) => ({ key: c.key, name: c.name, figures: tileFigures(c.key), fitLabel: null, rateNote: c.rateNote, image: c.key === "street-team" ? "map" : undefined })),
    hubRates: { cpm: HUB_RATE_RANGE.cpm, cpc: HUB_RATE_RANGE.cpc, fitLabel: null },
    mapDataUrl: o.mapDataUrl,
  };
}

/** Friday's numbers, exactly as returned. Only reach math (views/visits) stays Birch's. */
export function fridayView(r: FridayReport, calc: KitCalcResult, o: { brand: string; categoryLabel: string; repeatLabel: string; mapDataUrl?: string }): KitView {
  const lt = r.ltv;
  const ltvGp: Range | null = lt?.gp_ltv_usd ? [lt.gp_ltv_usd.low, lt.gp_ltv_usd.high] : null;
  const df = r.demand_fit;
  const fitOf = (k: string) => df?.channels.find((c) => (FKEY[c.key] ?? c.key) === k);
  const hubsFit = fitOf("scale-hubs");
  const fridayFig = (k: string) => r.channels?.find((c) => (FKEY[c.key] ?? c.key) === k)?.figures;
  const nc = calc.scale.newCustomers;
  return {
    source: "friday",
    mock: !!r.mock,
    brand: o.brand,
    categoryLabel: o.categoryLabel,
    ltvGp,
    gpPerOrder: lt?.gp_per_order_usd ? [lt.gp_per_order_usd.low, lt.gp_per_order_usd.high] : null,
    ltvNote: lt ? `${lt.label} · ${lt.formula}` : "No LTV yet",
    scale: calc.scale,
    revenueOpp: calc.revenueOppUsd,
    gpOpp: ltvGp ? [Math.round(nc[0] * ltvGp[0]), Math.round(nc[1] * ltvGp[1])] : null,
    breakEven: ltvGp && ltvGp[1] > 0 ? [Math.ceil(calc.scale.spendUsd / ltvGp[1]), ltvGp[0] > 0 ? Math.ceil(calc.scale.spendUsd / ltvGp[0]) : Infinity] : null,
    chips: chipsFor(calc, o.repeatLabel),
    formula: [lt?.formula ?? "", ...KIT_CALC_FORMULA.slice(1, 3)],
    fitHeader: df?.label ?? "Estimate · subject to human confirmation",
    hubs: visibleHubs((df?.anchor_hubs ?? []) as Array<NonNullable<typeof df>["anchor_hubs"][number] & { hidden?: boolean }>, { domain: r.brand?.domain, category: r.brand?.category ?? r.demand_opportunity?.category?.key ?? null }).slice(0, 6).map((h) => ({ name: h.name, status: h.status, fitLabel: h.fit_label })),
    channels: ["calm-joints", "street-team", "retail-network"].map((k) => {
      const c = EXPOSURE_CHANNELS.find((x) => x.key === k)!;
      return { key: k, name: fitOf(k)?.name ?? c.name, figures: k === "retail-network" || k === "street-team" ? tileFigures(k) /* fixed copy: RETAIL_COPY (retail-network estimate); Street Team "reaches a few million doors…" (Randy 2:27 PM) */ : fridayFig(k) ?? tileFigures(k), fitLabel: fitOf(k)?.fit_label ?? null, rateNote: c.rateNote, image: k === "street-team" ? "map" : undefined };
    }),
    hubRates: { cpm: r.headline?.best_fit_cpm_usd ? [r.headline.best_fit_cpm_usd.low, r.headline.best_fit_cpm_usd.high] : HUB_RATE_RANGE.cpm, cpc: r.headline?.best_fit_cpc_usd ? [r.headline.best_fit_cpc_usd.low, r.headline.best_fit_cpc_usd.high] : HUB_RATE_RANGE.cpc, fitLabel: hubsFit?.fit_label ?? null },
    mapDataUrl: o.mapDataUrl,
  };
}

/** The landing-page sample (Randy, 10:23 PM ET): fixed example inputs, example brand, labelled sample everywhere. */
export const SAMPLE_INPUTS = { aovUsd: 80, monthlyOrders: 500, repeat: [2, 3] as [number, number], repeatLabel: "2–3", marginBand: "30_50", spendUsd: 490, conversionPct: 1 } as const;
export function sampleView(calc: KitCalcResult, mapDataUrl?: string): KitView {
  const v = previewView(calc, { brand: "Example brand", categoryKey: "recovery", categoryLabel: "Example category", repeatLabel: SAMPLE_INPUTS.repeatLabel, mapDataUrl });
  return {
    ...v,
    source: "sample",
    ltvNote: "Sample · example values only · 1–3 years at the example purchase rate and margin",
    fitHeader: "Example fit · real kits are subject to human confirmation",
    hubs: v.hubs.map((h) => ({ ...h, fitLabel: "Example fit" })),
    channels: v.channels.map((c) => ({ ...c, fitLabel: "Example fit" })),
    hubRates: { ...v.hubRates, fitLabel: "Example fit" },
  };
}

const ELIG_SHORT: Record<Eligibility, string> = { now: "Now", later: "Later", not_available: "Not in your markets yet" };
/** Per-channel geography on the kit (Friday's eligibility when present, else the config). */
export function withGeo(v: KitView, market: Market | null | undefined, fridayGeo?: Array<{ key: string; eligibility: Eligibility }>): KitView {
  return {
    ...v,
    channels: v.channels.map((c) => {
      const g = CHANNEL_GEO.find((x) => x.key === c.key);
      if (!g) return c;
      const f = fridayGeo?.find((x) => x.key === g.friday_key || x.key === g.key)?.eligibility;
      const e = f ?? channelEligibility(g.key, market);
      return { ...c, eligibility: e, geo: `${ELIG_SHORT[e]} · ${g.label}` };
    }),
  };
}
