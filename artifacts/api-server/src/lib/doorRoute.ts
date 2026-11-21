/**
 * Street-team door section (Randy, Nov 17 2026 ET, voice 9:10 PM). Area-level census
 * figures for the day-1 route areas, from /workspace/door-census/route-day1.json.
 *
 * Rules: area-level only (no homes, addresses or house numbers), no ambassador name,
 * no door-hit counts, no "exclusive", inquire-only (no SKU, no door prices).
 * Census incomes are 2020 household income in 2020 CAD, labelled as such and never
 * converted. 2MM+ homes reached by 2027 (with Calm Joints) is a plan, not a guarantee.
 */
import { DOOR_ROUTE_DATA as D } from "./doorRouteData";

const cadK = (n: number) => `$${Math.round(n / 1000)}K`;
const cad = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Collapsed headline row: est. 2026 values (CAD incomes). */
export const DOOR_HEADLINE = [
  { value: cadK(D.est2026.avgHouseholdIncomeCad), label: "Avg income" },
  { value: `$${Math.round(D.est2026.medianHouseholdIncomeCadRange[0] / 1000)}–${Math.round(D.est2026.medianHouseholdIncomeCadRange[1] / 1000)}K`, label: "Median income" },
  { value: `${D.est2026.ownerSharePct}%`, label: "Own their home" },
  { value: `${D.est2026.familiesWithChildrenPct}%`, label: "Families with kids" },
] as const;

/** Expanded table: est. 2026 next to the 2021 Census actuals. */
export const DOOR_DETAIL_ROWS = [
  { label: "Average household income (CAD)", est: cad(D.est2026.avgHouseholdIncomeCad), census: `${cad(D.census2021.avgHouseholdIncome2020Cad)} (2020 income)` },
  { label: "Median household income (CAD)", est: `${cad(D.est2026.medianHouseholdIncomeCadRange[0])}–${cad(D.est2026.medianHouseholdIncomeCadRange[1])}`, census: `${cad(D.census2021.medianHouseholdIncome2020CadRange[0])}–${cad(D.census2021.medianHouseholdIncome2020CadRange[1])}` },
  { label: "Households that own their home", est: `${D.est2026.ownerSharePct}%`, census: `${D.census2021.ownerSharePct}%` },
  { label: "Census families with children", est: `${D.est2026.familiesWithChildrenPct}%`, census: `${D.census2021.familiesWithChildrenPct}%` },
  { label: "Average household size", est: String(D.est2026.averageHouseholdSize), census: String(D.census2021.averageHouseholdSize) },
] as const;

export const DOOR_ROUTE = {
  kicker: "Street team · Day 1",
  title: "Day 1: lead ambassador testing areas around our private network.",
  body:
    "Ambassador street routes give brands sought-after door-to-door display and performance-based placements, targeted by neighbourhood. Placements are limited by route.",
  goal: "The plan: Calm Joints and Street Team Ambassadors reach 2MM+ homes by 2027, with multiple offers.",
  goalNote: "A target, modelled, not a guarantee. Reach and audience, not delivered impressions.",
  mapAlt:
    "Day-1 street-team route areas near Yonge and Lawrence in Toronto, shown as a heat map of route zones. No homes or addresses are shown.",
  mapCaption: "Day-1 route areas · Bedford Park and Lawrence Park North, Toronto. Area view only.",
  mapWebp: "/street-team/door-route.webp",
  mapJpg: "/street-team/door-route.jpg",
  mapWidth: 1107,
  mapHeight: 600,
  censusTitle: "Households in the route areas",
  censusQualifier: "est. 2026 · CAD",
  censusToggle: "Details",
  censusExpandedTitle: "Estimated 2026 vs the 2021 Census",
  censusMethod: `Incomes: 2020 household incomes from the 2021 Census, multiplied by ${D.incomeFactorDisplay}, the ratio of the Canada all-items CPI over the 12 months to October 2026 (${D.cpi12mToOct2026Average}) to its 2020 average (${D.cpi2020Average}), then rounded to the nearest $100. This is an inflation adjustment, not a forecast of real income growth. Home ownership, families with children and household size are 2021 Census values carried forward; no sourced post-Census data justified changing them. The 2021 Census is the latest full census; 2026 results are due in 2027.`,
  sourceLead: "Sources: Statistics Canada, 2021 Census of Population, via",
  sourceLabel: "City of Toronto Neighbourhood Profiles",
  sourceHref: "https://open.toronto.ca/dataset/neighbourhood-profiles/",
  sourceMid: `(Bedford Park-Nortown and Lawrence Park North, 25% sample); Statistics Canada CPI, table ${D.cpiTable}, via the`,
  cpiLabel: "Bank of Canada",
  cpiHref: "https://www.bankofcanada.ca/rates/price-indexes/cpi/",
  sourceTail: "Area-level figures, not a count of doors on the route.",
  inquire: "Ask about door placements",
  inquireNote: "Door placements are by inquiry only, scoped and priced on your insertion order.",
} as const;
