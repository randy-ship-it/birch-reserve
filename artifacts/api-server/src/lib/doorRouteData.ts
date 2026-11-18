/**
 * Street-team census figures, generated from /workspace/door-census/route-day1.json
 * (Friday workstream, est2026 block as of 2026-11-17). Area-level aggregates only: no streets,
 * postal codes, homes or counts of doors. Incomes are CAD. est. 2026 incomes = 2020 Census
 * incomes x Canada all-items CPI ratio (12 months to Oct 2026 / 2020 average), rounded to
 * the nearest $100. Shares and household size are 2021 Census values carried forward.
 */
export const DOOR_ROUTE_DATA = {
  "asOf": "2026-11-17",
  "area": "Bedford Park-Nortown + Lawrence Park North",
  "est2026": {
    "avgHouseholdIncomeCad": 327300,
    "medianHouseholdIncomeCadRange": [
      165500,
      206000
    ],
    "ownerSharePct": 71,
    "familiesWithChildrenPct": 68,
    "averageHouseholdSize": 2.7,
    "label": "est. 2026"
  },
  "census2021": {
    "avgHouseholdIncome2020Cad": 266900,
    "medianHouseholdIncome2020CadRange": [
      135000,
      168000
    ],
    "ownerSharePct": 71,
    "familiesWithChildrenPct": 68,
    "averageHouseholdSize": 2.7
  },
  "incomeFactor": 1.226285,
  "incomeFactorDisplay": "1.226",
  "cpi2020Average": 136.96,
  "cpi12mToOct2026Average": 167.95,
  "cpiTable": "18-10-0004-01"
} as const;
