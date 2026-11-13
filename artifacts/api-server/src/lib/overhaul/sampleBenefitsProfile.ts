/**
 * Illustrative sample partner audience profile for /audiences.
 * Figures are plausible ranges for a mid-market Canadian group-benefits
 * book, labelled Sample. They are not measured, not modelled from a named
 * partner, and must never be presented as a real book of business.
 * Do not put a partner name on the page.
 */

export const SAMPLE_PROFILE_BADGE = "Sample profile, illustrative" as const;
export const SAMPLE_PROFILE_TITLE = "Benefits partner (sample)" as const;
export const SAMPLE_PROFILE_KIND = "Mid-market group insurance / workplace benefits" as const;
export const SAMPLE_PROFILE_HOWTO =
  "How buyers use it: campaigns on Birch can target hub activations by these segments, aggregated only. No customer-level data is ever shared with brands.";

export type SampleBand = { label: string; lo: number; hi: number; note?: string };
export type SampleShare = { label: string; lo: number; hi: number };

export const SAMPLE_MEMBER_BAND = "5,000–15,000 plan members" as const;

export const SAMPLE_INDUSTRY: SampleShare[] = [
  { label: "Professional services", lo: 25, hi: 35 },
  { label: "Healthcare and education", lo: 20, hi: 30 },
  { label: "Manufacturing and trades", lo: 15, hi: 25 },
  { label: "Technology", lo: 10, hi: 20 },
  { label: "Other employers", lo: 10, hi: 15 },
];

export const SAMPLE_REGION: SampleShare[] = [
  { label: "Ontario", lo: 35, hi: 45 },
  { label: "Quebec", lo: 20, hi: 30 },
  { label: "Western Canada", lo: 20, hi: 30 },
  { label: "Atlantic Canada", lo: 5, hi: 10 },
];

export const SAMPLE_AGE: SampleShare[] = [
  { label: "18–34", lo: 25, hi: 35 },
  { label: "35–44", lo: 25, hi: 30 },
  { label: "45–54", lo: 20, hi: 25 },
  { label: "55–64", lo: 15, hi: 20 },
  { label: "65+", lo: 2, hi: 5 },
];

export const SAMPLE_GENDER: SampleShare[] = [
  { label: "Women", lo: 52, hi: 58 },
  { label: "Men", lo: 42, hi: 48 },
];

export const SAMPLE_PLAN_TIER: SampleShare[] = [
  { label: "Enhanced paramedical", lo: 40, hi: 50 },
  { label: "Standard", lo: 35, hi: 45 },
  { label: "Basic", lo: 10, hi: 20 },
];

export const SAMPLE_USAGE = {
  anyParamedical: "35–50% of members use a paramedical benefit in a given year",
  physio: "15–25% of members submit a physiotherapy claim in a given year",
} as const;

export const SAMPLE_CLAIM_CATEGORIES: SampleShare[] = [
  { label: "Physiotherapy", lo: 30, hi: 40 },
  { label: "Massage", lo: 25, hi: 35 },
  { label: "Chiropractic", lo: 15, hi: 25 },
  { label: "Other paramedical", lo: 10, hi: 20 },
];

export const SAMPLE_BALANCE = {
  usedByClaimants: "Members who claim typically use 40–60% of their annual paramedical maximum",
  unusedBudget: "About 40–55% of the plan's annual paramedical budget goes unused",
} as const;

export const SAMPLE_SEASONALITY =
  "Claims usually peak in January–March (new-year activity and leftover year-end balances) and again in September–November (back to work and sport). Mid-summer is quieter.";

export const SAMPLE_CHANNEL = {
  inPerson: "60–75% in-person visits",
  digital: "25–40% digital or virtual visits, and rising",
} as const;

export function fmtPctRange(lo: number, hi: number): string {
  return `${lo}–${hi}%`;
}
