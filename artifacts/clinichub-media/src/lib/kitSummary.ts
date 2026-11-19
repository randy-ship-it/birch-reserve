/**
 * Key numbers of the report on screen, for the PDF cover and the kit email (Randy, Nov 19 2026 10:54 AM ET).
 * Reuses the report's own model (buildModel / channelRows); adds nothing new. In-location display comes only from
 * the brand's own locations × visitors and carries no rate (priced by IO, like Street Team).
 */
import type { FridayReport } from "@/lib/fridayBrandIntake";
import type { FridayExposure } from "../../../api-server/src/lib/kitCalc/activation";
import { IN_LOCATION, inLocationReach, type PhysicalAnswer } from "../../../api-server/src/lib/overhaul/inLocation";
import { buildModel } from "@/components/br/report-v2";
import { big, channelRows, usd } from "@/components/br/report-views";
import type { KitCover } from "@/lib/kitRender";

export function kitSummary(report: FridayReport, exposure: FridayExposure, physical: PhysicalAnswer | null | undefined, source: KitCover["source"], reportUrl?: string): KitCover & { email: { exposureMonth?: string; earningsMonth?: string } } {
  const m = buildModel(report);
  const rows = channelRows(exposure, m.isAccelerate ? "accelerate" : "performance_only");
  const hubs = rows.find((r) => r.key === "hubs")?.range ?? null;
  const earn = m.total ? (m.total.low + m.total.high) / 2 : null;
  const loc = inLocationReach(physical);
  const headline: KitCover["headline"] = [];
  if (m.isSupplier && hubs) headline.push({ value: big(hubs.likely), label: "page-view exposures a month, likely", sub: `${big(hubs.low)}–${big(hubs.high)} · ${m.isAccelerate ? "with Accelerate" : "performance-only"}` });
  if (m.isPublisher && earn) headline.push({ value: usd(earn), label: "hub earnings a month, likely (USD)", sub: `${usd(earn * 12)} over 12 months` });
  if (loc) headline.push({ value: big(loc.monthlyVisits), label: "in-person visits a month at your locations", sub: IN_LOCATION.source });
  const channels: KitCover["channels"] = rows
    .filter((r) => r.range)
    .map((r) => ({ name: r.name, value: r.range!.low === r.range!.high ? big(r.range!.likely) : `${big(r.range!.low)}–${big(r.range!.high)}`, note: r.unit ? `${r.unit}${r.monthly ? " / month" : " in reach"}` : "" }));
  if (loc) channels.push({ name: IN_LOCATION.name, value: big(loc.monthlyVisits), note: IN_LOCATION.pricing });
  return {
    brand: m.name,
    source,
    headline,
    channels,
    reportUrl,
    email: { exposureMonth: hubs && m.isSupplier ? big(hubs.likely) : undefined, earningsMonth: earn && m.isPublisher ? usd(earn) : undefined },
  };
}
