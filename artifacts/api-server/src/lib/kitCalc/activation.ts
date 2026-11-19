/**
 * Now-vs-later activation range (Randy via Emma, Nov 18 2026 10:48 PM ET). Modelled, Estimate.
 *   now / minimum  = what activates today (advertiser: channels eligible now in the brand's markets;
 *                    publisher: the surfaces the hub switched on), at the low end of the range.
 *   later / maximum = everything that can activate later (advertiser: + "later" channels;
 *                    publisher: every surface on), at the high end.
 * Friday v1.1 will return `activation`; when present the UI shows Friday's numbers instead (assumed shape below).
 */
import { CHANNEL_GEO, channelEligibility, type Market } from "./channelGeo";
import { projectPublisher, PUBLISHER_SURFACES, type PublisherInput } from "../overhaul/brandIntake";

export type MinMax = { min: number; max: number };
/** ASSUMED Friday v1.1 shape (CONTRACT-GAPS.md): activation.{advertiser_exposure_usd|publisher_monetization_usd}.{now,later}.{min,max} */
export type ActivationBlock = { now: MinMax; later: MinMax; period?: "month" | "test"; estimate?: boolean; label?: string };
export type Activation = { advertiser_exposure_usd?: ActivationBlock; publisher_monetization_usd?: ActivationBlock };

const r = (n: number) => Math.max(0, Math.round(n));

/** Advertiser exposure value for a test spend: revenueOpp [lo, hi] spread over channels eligible now vs later. */
export function advertiserActivation(revenueOppUsd: readonly [number, number], market: Market | null | undefined): ActivationBlock {
  const el = CHANNEL_GEO.map((c) => channelEligibility(c.key, market));
  const now = el.filter((e) => e === "now").length;
  const total = now + el.filter((e) => e === "later").length || 1;
  const share = now / total;
  return { now: { min: r(revenueOppUsd[0] * share), max: r(revenueOppUsd[1] * share) }, later: { min: r(revenueOppUsd[0]), max: r(revenueOppUsd[1]) }, period: "test", estimate: true, label: "Modelled" };
}

/** Publisher monetization per month: surfaces on now vs every surface on later. */
export function publisherActivation(input: PublisherInput): ActivationBlock {
  const nowP = projectPublisher(input).monthlyTotalUsd;
  const all = Object.fromEntries(PUBLISHER_SURFACES.map((s) => [s.key, true])) as PublisherInput["on"];
  const laterP = projectPublisher({ ...input, on: all }).monthlyTotalUsd;
  return { now: { min: r(nowP[0]), max: r(nowP[1]) }, later: { min: r(Math.max(laterP[0], nowP[0])), max: r(Math.max(laterP[1], nowP[1])) }, period: "month", estimate: true, label: "Modelled" };
}

/** Tolerant read of Friday's block: numbers only, min ≤ max, else null (→ labelled mock). */
export function readActivation(x: unknown): ActivationBlock | null {
  const o = x as { now?: Partial<MinMax>; later?: Partial<MinMax>; period?: string } | null;
  const ok = (m?: Partial<MinMax>) => !!m && typeof m.min === "number" && typeof m.max === "number" && m.min >= 0 && m.min <= m.max;
  if (!o || !ok(o.now) || !ok(o.later)) return null;
  return { now: o.now as MinMax, later: o.later as MinMax, period: o.period === "month" ? "month" : o.period === "test" ? "test" : undefined, estimate: true };
}

/* ---------------- Friday v1.1 `exposure` (brand-report.v1 additive) ---------------- */
export type ExposureChannel = { key: string; geo_label?: string; eligible_now: boolean; later_option?: boolean; reason?: string | null; unit?: string; now: MinMax | null; later: MinMax | null; figure_now?: string | null; figure_later?: string | null; needs_figure?: boolean };
export type FridayExposure = { label?: string; basis?: string; markets?: string[]; activation?: { min_share: number; max_share: number; placeholder?: boolean }; geo_weights?: Record<string, number | boolean>; channels: ExposureChannel[] };

/** Tolerant read of Friday's `exposure`; null when absent or malformed (→ labelled mock). */
export function readExposure(x: unknown): FridayExposure | null {
  const o = x as FridayExposure | null;
  if (!o || !Array.isArray(o.channels) || !o.channels.length) return null;
  const mm = (m: unknown): MinMax | null => {
    const v = m as Partial<MinMax> | null;
    return v && typeof v.min === "number" && typeof v.max === "number" && v.min <= v.max ? { min: v.min, max: v.max } : null;
  };
  return { ...o, channels: o.channels.filter((c) => c && typeof c.key === "string").map((c) => ({ ...c, eligible_now: !!c.eligible_now, now: mm(c.now), later: mm(c.later) })) };
}

/**
 * MOCK exposure in Friday's v1.1 shape, from Randy's network figures only (Friday v1.1 §2 table) and PLACEHOLDER
 * activation shares. Labelled "Mock · placeholder shares, not a forecast" wherever it renders.
 */
export const MOCK_SHARES = { min_share: 0.01, max_share: 0.05, placeholder: true } as const;
const FIG = [
  { key: "hubs", unit: "page views / month", now: 700_000_000, later: 5_000_000_000, figure_now: ">700MM page views now", figure_later: ">5B page views (2027 target)" },
  { key: "street_team", unit: "homes", now: 500_000, later: 3_000_000, figure_now: "500K homes now", figure_later: "3MM+ homes later" },
  { key: "retail", unit: "recovery customers", now: 1_000_000, later: 1_000_000, figure_now: "120+ retail hubs · 1MM+ recovery customers · Canada + USA", figure_later: "120+ retail hubs · 1MM+ recovery customers · Canada + USA" },
  { key: "calm_joints", unit: "", now: 0, later: 0, figure_now: null, figure_later: null, needs_figure: true },
] as const;
const FKEY_TO_BIRCH: Record<string, ChannelGeoKey> = { hubs: "scale-hubs", calm_joints: "calm-joints", street_team: "street-team", retail: "retail-network" };
type ChannelGeoKey = "scale-hubs" | "calm-joints" | "street-team" | "retail-network";

export function mockExposure(market: Market | null | undefined): FridayExposure {
  const s = MOCK_SHARES;
  const span = (n: number): MinMax => ({ min: Math.round(n * s.min_share), max: Math.round(n * s.max_share) });
  return {
    label: "Estimate",
    basis: "Mock: network figures / targets × placeholder activation shares (1%–5%)",
    activation: { ...s },
    channels: FIG.map((f) => {
      const g = CHANNEL_GEO.find((c) => c.key === FKEY_TO_BIRCH[f.key])!;
      const e = channelEligibility(g.key, market);
      const needs = "needs_figure" in f && f.needs_figure;
      return {
        key: f.key, geo_label: g.label, eligible_now: e === "now", later_option: !!g.later, unit: f.unit,
        reason: e === "now" ? null : e === "later" ? "Opens in your markets later (Canada-wide)" : "Not in your markets yet",
        now: e === "now" && !needs ? span(f.now) : null,
        later: e !== "not_available" && !needs ? span(f.later) : null,
        figure_now: f.figure_now, figure_later: f.figure_later, needs_figure: needs || undefined,
      };
    }),
  };
}
