/**
 * Payout display currency (Randy, Fri Nov 20 2026): "CAD is right but USD agnostic if the user is
 * based in the USA." Publisher and clinic payouts are defined, and paid, in CAD. Visitors whose edge
 * country is US see an approximate USD figure instead; everyone else (and unknown) sees CAD.
 *
 * Only numbers defined in CAD go through here. Buyer prices that are already USD ($190, $490, the
 * $1.5K / $3K / $6K packs, Stripe checkout) never do. The CAD payout terms themselves do not change.
 *
 * One config: change PAYOUT_USD_PER_CAD here and every surface follows.
 */
export const PAYOUT_USD_PER_CAD = 0.72;
/** Approximate USD is rounded to the nearest US$5 so it never reads as a precise quote. */
export const PAYOUT_USD_ROUND_TO = 5;

export type PayoutRegion = "ca" | "us";

/** Raw header value (x-vercel-ip-country) -> display region. Only an explicit US gets USD. */
export function payoutRegionForCountry(country: string | string[] | null | undefined): PayoutRegion {
  const raw = Array.isArray(country) ? country[0] : country;
  return String(raw ?? "").trim().toUpperCase() === "US" ? "us" : "ca";
}

export function cadToApproxUsd(cad: number): number {
  return Math.round((cad * PAYOUT_USD_PER_CAD) / PAYOUT_USD_ROUND_TO) * PAYOUT_USD_ROUND_TO;
}

/** "$500 CAD" for Canada and everyone else; "≈ US$360" for US visitors. `plus` adds a trailing "+". */
export function payoutAmount(cad: number, region: PayoutRegion, plus = false): string {
  const p = plus ? "+" : "";
  return region === "us"
    ? `≈ US$${cadToApproxUsd(cad).toLocaleString("en-US")}${p}`
    : `$${cad.toLocaleString("en-US")}${p} CAD`;
}

/** Short currency label for column heads and captions. */
export function payoutLabel(region: PayoutRegion): string {
  return region === "us" ? "approx. USD" : "CAD";
}

/** Footnote shown wherever the US view is active. */
export function payoutUsNote(): string {
  return `Payouts are set and paid in CAD. US$ figures are approximate (about US$${PAYOUT_USD_PER_CAD.toFixed(2)} per C$1).`;
}
