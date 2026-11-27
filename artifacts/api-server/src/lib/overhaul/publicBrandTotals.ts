/**
 * Public rolled-up totals for /advertise/brands (no brand names, no per-hub volumes).
 * Every figure is copied from existing approved site copy. Do not invent numbers.
 * This module must stay free of hubLadder / model / sponsorKit / brandIntake imports
 * so the public advertise page chunk does not pull the named brand list into its graph.
 *
 * Sources (asserted in overhaul tests):
 *   - ~128MM modelled / 200+ / 1MM+ / 3MM+ est. 2027: AUDIENCE_LINE, RETAIL_COPY, STREET_REACH_FIG (brandIntake.ts)
 *   - 20MM+ orders, 42 listed partners: TAM in model.ts (feed snapshot 2026-11-12)
 *   - 4 placements: SURFACES in model.ts (already on this page)
 *   - Recovery, Longevity, Food: POSITIONING.recoveryBrandVerticals that are not in queue
 */
export const CLAIM_LINE = "Modelled estimates from listed partners";

export const PUBLIC_BRAND_TOTALS = [
  { v: "~128MM", l: "modelled page views a month (estimate)" },
  { v: "20MM+", l: "audience orders being onboarded", note: "Modelled" },
  { v: "42", l: "listed partners" },
  { v: "200+", l: "retail locations (500+ soon)" },
  { v: "1MM+", l: "captive recovery consumers" },
  { v: "1MM+", l: "consumers now, Street Team and provider network" },
  { v: "3MM+", l: "consumers in 2027", estimate: true },
  { v: "4", l: "clinic layer placements, display + CPC" },
] as const;

/** Live verticals only (Pets is in queue and is not listed here). */
export const PUBLIC_CATEGORIES = ["Recovery", "Longevity", "Food"] as const;

export const PUBLIC_FINE =
  "Modelled estimates from listed partners. Reach and audience, not delivered impressions, and not a guarantee. The 3MM+ figure for 2027 is an estimate. Audience orders are modelled.";
