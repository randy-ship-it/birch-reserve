/**
 * "Get hub launch alerts" (Randy t422u, Nov 21 2026): email + categories (+ optional brand) so people hear when hubs launch
 * in the categories they care about. One list shared by the browser and the server allowlist.
 * Never says a hub is open: "Recovery" is just a category name here.
 */
export const HUB_ALERT_CATEGORIES = [
  "Recovery", "Longevity", "Sleep", "Fitness", "Food & Nutrition", "Medi/Spa", "Mental Health", "Pets", "Other",
] as const;
export type HubAlertCategory = (typeof HUB_ALERT_CATEGORIES)[number];

export const HUB_ALERT_SOURCE = "hub_alerts" as const;

/** Keeps only known category names, de-duplicated, in list order. Returns null when anything is unknown or the list is empty/too long. */
export function cleanHubAlertCategories(raw: unknown): HubAlertCategory[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > HUB_ALERT_CATEGORIES.length) return null;
  const set = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string" || !(HUB_ALERT_CATEGORIES as readonly string[]).includes(v)) return null;
    set.add(v);
  }
  return HUB_ALERT_CATEGORIES.filter((c) => set.has(c));
}
