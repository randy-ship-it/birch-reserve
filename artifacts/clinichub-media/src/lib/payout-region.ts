import type { PayoutRegion } from "../../../api-server/src/lib/payoutCurrency";

/**
 * Region for CAD-defined payout figures. The function writes window.__BR_PAYOUT_REGION__ into the
 * document head (from x-vercel-ip-country) before the bundle runs, so this is correct on first render.
 * Absent means CAD.
 */
export function payoutRegion(): PayoutRegion {
  if (typeof window === "undefined") return "ca";
  return (window as unknown as { __BR_PAYOUT_REGION__?: string }).__BR_PAYOUT_REGION__ === "us" ? "us" : "ca";
}
