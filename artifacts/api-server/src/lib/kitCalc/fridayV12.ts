/**
 * Friday brand-intake contract v1.2 (/workspace/birch-friday-contract/brand-intake-v1.2.md, Friday draft PR #213).
 * Shared by the Birch client (what it sends) and the Birch server proxy (which downgrades the body to strict v1
 * while Friday has not deployed v1.2). Pure TS, no I/O.
 */

/** §6 shared category keys (GET /api/public/brand-categories). Static copy; the live list replaces it when served. */
export const FRIDAY_CATEGORIES = [
  { key: "sports_nutrition", label: "Sports Nutrition & Supplements" },
  { key: "wearables_fitness_tech", label: "Wearables & Fitness Tech" },
  { key: "pain_relief_topicals", label: "Pain Relief & Topicals" },
  { key: "personal_care_skincare", label: "Personal Care & Skincare" },
  { key: "footwear_insoles_compression", label: "Footwear, Insoles & Compression" },
  { key: "recovery_devices", label: "Recovery Devices & Equipment" },
  { key: "wellness_marketplaces_retail", label: "Wellness Marketplaces & Retail" },
  { key: "active_apparel", label: "Active Apparel & Athleisure" },
  { key: "health_testing_longevity", label: "Health Testing & Longevity" },
  { key: "digital_health_telehealth", label: "Digital Health & Telehealth" },
  { key: "strength_home_fitness", label: "Strength & Home Fitness" },
  { key: "sleep_breathing", label: "Sleep & Breathing" },
] as const;
export type FridayCategoryKey = (typeof FRIDAY_CATEGORIES)[number]["key"];
export const isFridayCategory = (k: unknown): k is FridayCategoryKey => FRIDAY_CATEGORIES.some((c) => c.key === k);

/** Friday category → Birch's own demand/audience key (used for Birch-side hub fit and demand copy only). */
export const FRIDAY_TO_BIRCH: Record<FridayCategoryKey, string> = {
  sports_nutrition: "sports-nutrition",
  wearables_fitness_tech: "fitness",
  pain_relief_topicals: "recovery",
  personal_care_skincare: "sleep",
  footwear_insoles_compression: "recovery",
  recovery_devices: "recovery",
  wellness_marketplaces_retail: "supplements",
  active_apparel: "fitness",
  health_testing_longevity: "longevity",
  digital_health_telehealth: "longevity",
  strength_home_fitness: "fitness",
  sleep_breathing: "sleep",
};
/** Birch audience key → Friday category (for older stored payloads that still carry a Birch key). */
export const BIRCH_TO_FRIDAY: Record<string, FridayCategoryKey> = {
  recovery: "recovery_devices", supplements: "sports_nutrition", fitness: "wearables_fitness_tech", "sports-nutrition": "sports_nutrition",
  longevity: "health_testing_longevity", sleep: "sleep_breathing", physio: "pain_relief_topicals",
};
export const toFridayCategory = (k: string | undefined): FridayCategoryKey | undefined => (k ? (isFridayCategory(k) ? k : BIRCH_TO_FRIDAY[k]) : undefined);
export const toBirchCategory = (k: string): string => (isFridayCategory(k) ? FRIDAY_TO_BIRCH[k] : k);

/** §1 Birch margin keys are canonical in v1.2. Strict v1 only knows its own four: nearest midpoint, ties go lower. */
export const V12_MARGIN = ["lt_30", "30_50", "50_70", "70_plus"] as const;
export const V1_MARGIN_OF: Record<string, string> = { lt_30: "under_20", "30_50": "20_40", "50_70": "40_60", "70_plus": "60_plus" };
/** §2 repeat bands. */
export const V12_REPEAT = ["1", "2_3", "4_6", "7_plus"] as const;

/** Keys strict v1 rejects (it is `.strict()`), added by v1.1/v1.2. */
const V12_ONLY_TOP = ["geo", "company_name", "category"] as const;

/**
 * Downgrade a v1.2 body to strict v1 (Friday not on v1.2 yet). Proactive, not a retry: the proxy decides from a
 * capability probe (GET /api/public/brand-categories exists only on v1.2) before it sends anything.
 */
export function toV1Body(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body };
  for (const k of V12_ONLY_TOP) delete out[k];
  const c = out.calculator as Record<string, unknown> | undefined;
  if (c && typeof c === "object") {
    const { repeat_band: _rb, repeat: _r, margin_band, ...rest } = c;
    const m = typeof margin_band === "string" ? (V1_MARGIN_OF[margin_band] ?? (Object.values(V1_MARGIN_OF).includes(margin_band) ? margin_band : undefined)) : undefined;
    out.calculator = { ...rest, ...(m ? { margin_band: m } : {}) };
  }
  // v1 supplier/sponsor fields take labels; v1.2 keys are accepted as aliases only on v1.2.
  const label = (k: string) => FRIDAY_CATEGORIES.find((x) => x.key === k)?.label ?? k;
  const sp = out.sponsor as Record<string, unknown> | undefined;
  if (sp && Array.isArray(sp.categories)) out.sponsor = { ...sp, categories: (sp.categories as string[]).map(label) };
  return out;
}
