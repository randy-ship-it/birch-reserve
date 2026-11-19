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
