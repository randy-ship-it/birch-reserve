/**
 * INTERNAL ONLY (BR-39). Never import this from client code or a route: the labor rate and management cost are not public.
 * Public copy says only "50% of net" (SERVICES_SPLIT in ./brandIntake).
 *
 * Net = revenue - labor - management cost. Hub / partner share = 50% of net.
 *   labor      = provider hours x LABOR_PER_HOUR_USD (about $70 an hour, internal)
 *   management = about 10% of REVENUE (default). Variant "gp": 10% of gross profit (revenue - labor) instead.
 * Old basis (replaced): 50% of gross profit = 50% x (revenue - labor).
 */
export const LABOR_PER_HOUR_USD = 70;
export const MANAGEMENT_PCT = 10;

export type ServicesSplitInput = { revenueUsd: number; hours: number; managementOn?: "revenue" | "grossProfit" };
export function servicesSplit({ revenueUsd, hours, managementOn = "revenue" }: ServicesSplitInput) {
  const labor = hours * LABOR_PER_HOUR_USD;
  const grossProfit = revenueUsd - labor;
  const management = ((managementOn === "revenue" ? revenueUsd : grossProfit) * MANAGEMENT_PCT) / 100;
  const net = grossProfit - management;
  return { labor, grossProfit, management, net, hubNew: Math.max(0, net) / 2, hubOld: Math.max(0, grossProfit) / 2 };
}
