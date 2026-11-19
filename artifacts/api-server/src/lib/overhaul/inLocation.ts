/**
 * Physical locations → "In-location display" channel line (Randy, Nov 19 2026 10:54 AM ET).
 * Pure module shared by the client (relative import) and tests.
 * Reach = the brand's own numbers only: locations × monthly visitors per location, or their monthly total.
 * No rate is invented: in-location display is priced by IO, the same per-door economics as Street Team
 * (Street Team is "Inquire: priced by route"; there is no per-door $ figure in the model). Labelled Estimate.
 */
export type PhysicalAnswer = { has: boolean; locations?: number; visitors_month?: number; basis?: "per_location" | "total" };
export const IN_LOCATION = {
  key: "in_location",
  name: "In-location display",
  unit: "in-person visits / month",
  pricing: "Priced by IO, like Street Team",
  source: "Estimate · from your numbers",
} as const;

const whole = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined);
const MAX_LOCATIONS = 100_000;
const MAX_VISITS = 1_000_000_000;

/** Normalised answer (bounded whole numbers), or null when they said no / gave nothing usable. */
export function cleanPhysical(p: unknown): PhysicalAnswer | null {
  if (!p || typeof p !== "object") return null;
  const x = p as Record<string, unknown>;
  if (x.has !== true) return x.has === false ? { has: false } : null;
  const locations = whole(x.locations);
  const visitors_month = whole(x.visitors_month);
  return {
    has: true,
    ...(locations ? { locations: Math.min(locations, MAX_LOCATIONS) } : {}),
    ...(visitors_month ? { visitors_month: Math.min(visitors_month, MAX_VISITS) } : {}),
    basis: x.basis === "total" ? "total" : "per_location",
  };
}

/** Monthly in-person visits across all locations; null without both numbers (per location) or a total. */
export function inLocationReach(p: PhysicalAnswer | null | undefined): { locations: number | null; monthlyVisits: number } | null {
  if (!p?.has || !p.visitors_month) return null;
  if (p.basis === "total") return { locations: p.locations ?? null, monthlyVisits: Math.min(p.visitors_month, MAX_VISITS) };
  if (!p.locations) return null;
  return { locations: p.locations, monthlyVisits: Math.min(p.visitors_month * p.locations, MAX_VISITS) };
}

/** The labelled v1 blurb line (no v1 field for it yet; CONTRACT-GAPS.md §J). */
export function physicalBlurb(p: PhysicalAnswer | null | undefined): string | null {
  if (!p) return null;
  if (!p.has) return "Physical locations: no.";
  const r = inLocationReach(p);
  const bits = [
    p.locations ? `${p.locations} location${p.locations === 1 ? "" : "s"}` : null,
    p.visitors_month ? `${p.visitors_month} visitors / month ${p.basis === "total" ? "(total)" : "(per location)"}` : null,
    r ? `≈ ${r.monthlyVisits} in-person visits / month in total` : null,
  ].filter(Boolean);
  return `Physical locations (brand-reported): yes${bits.length ? `; ${bits.join("; ")}` : ""}. In-location display: priced by IO.`;
}
