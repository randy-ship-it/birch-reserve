/**
 * Hub matching rules (Randy via Emma, Nov 19 2026 10:21 AM ET; bug: Hyperice.ca, a product company, was shown DR-HO'S,
 * a competing product company).
 *
 *   - Product companies get SERVICE hubs first (benefits admin, clinics, women's / men's health, nutrition), then only
 *     product hubs that do not compete with them. Network channels (Retail Network, Calm Joints, Street Team) are shown
 *     separately and are always on.
 *   - Service companies are never paired with service hubs chasing the same leads (hormonal and GLP-1 are the key
 *     overlap); they get product hubs first.
 *   - Conflict scoring at SKU + category level: same SKU / same lead type = 1 (conflict), same category without a SKU
 *     match = 0.5 (not confident), nothing shared = 0. Score ≥ 0.5 → flagged hidden (kept, never deleted).
 *   - Not confident about the brand (unknown category / kind) → service hubs only.
 *   - An approver can unflag a pair (HUB_MATCH_APPROVED below; Friday's own approval wins when it exists).
 * Authoritative matching belongs to Friday (spec: /workspace/br-intake/FRIDAY-MATCH-RULES.md). Birch applies the same
 * rules wherever it picks or shows hubs: the live preview kit, the preview mock report and Friday reports it renders.
 */
import { isFridayCategory, BIRCH_TO_FRIDAY, type FridayCategoryKey } from "../kitCalc/fridayV12";

export type Kind = "product" | "service";
type HubProfile = { kind: Kind; skus: string[]; leads: string[]; cats: FridayCategoryKey[] };

/** Proposed anchor hubs (PROPOSED_ANCHOR_HUBS keys): what each one sells (SKUs) or which leads it chases. */
export const HUB_PROFILES: Record<string, HubProfile> = {
  "dr-ho": { kind: "product", skus: ["tens_device", "massage_device", "pain_relief_device", "compression"], leads: [], cats: ["recovery_devices", "pain_relief_topicals"] },
  "roll-recovery": { kind: "product", skus: ["massage_gun", "foam_roller", "recovery_tools", "compression"], leads: [], cats: ["recovery_devices", "strength_home_fitness"] },
  sole: { kind: "product", skus: ["insoles", "footwear"], leads: [], cats: ["footwear_insoles_compression"] },
  kalaya: { kind: "product", skus: ["topical_pain_relief"], leads: [], cats: ["pain_relief_topicals"] },
  "jill-health": { kind: "service", skus: [], leads: ["hormonal", "menopause", "glp1", "womens_health"], cats: ["digital_health_telehealth", "health_testing_longevity"] },
  "jack-health": { kind: "service", skus: [], leads: ["hormonal", "trt", "glp1", "mens_health"], cats: ["digital_health_telehealth", "health_testing_longevity"] },
  nutriprocan: { kind: "service", skus: [], leads: ["dietitian", "nutrition_coaching", "glp1"], cats: ["sports_nutrition"] },
  "integrity-fitness": { kind: "service", skus: [], leads: ["gym_membership", "physio"], cats: [] },
  "calm-joints": { kind: "service", skus: [], leads: ["physio", "digital_physio"], cats: [] },
  "bird-and-be": { kind: "service", skus: [], leads: ["womens_health", "postpartum"], cats: [] },
  "effortless-admin": { kind: "service", skus: [], leads: ["benefits_admin"], cats: [] },
};

/** What a brand in each Friday category usually is and sells. Telehealth / testing brands are service companies. */
const CATEGORY_PROFILE: Record<FridayCategoryKey, { kind: Kind; skus: string[]; leads: string[] }> = {
  recovery_devices: { kind: "product", skus: ["massage_gun", "massage_device", "recovery_tools", "compression", "pain_relief_device", "tens_device"], leads: [] },
  pain_relief_topicals: { kind: "product", skus: ["topical_pain_relief"], leads: [] },
  footwear_insoles_compression: { kind: "product", skus: ["insoles", "footwear", "compression"], leads: [] },
  sports_nutrition: { kind: "product", skus: ["supplements", "protein"], leads: [] },
  wearables_fitness_tech: { kind: "product", skus: ["wearable"], leads: [] },
  personal_care_skincare: { kind: "product", skus: ["skincare"], leads: [] },
  wellness_marketplaces_retail: { kind: "product", skus: ["marketplace"], leads: [] },
  active_apparel: { kind: "product", skus: ["apparel"], leads: [] },
  strength_home_fitness: { kind: "product", skus: ["home_fitness", "foam_roller"], leads: [] },
  sleep_breathing: { kind: "product", skus: ["sleep_aid"], leads: [] },
  health_testing_longevity: { kind: "service", skus: ["lab_testing"], leads: ["hormonal", "testing", "longevity"] },
  digital_health_telehealth: { kind: "service", skus: [], leads: ["hormonal", "glp1", "telehealth"] },
};

/** Known brands (by domain) where the category alone is too coarse. SKU-level, public product lines only. */
export const KNOWN_BRANDS: Record<string, { kind: Kind; skus: string[]; leads: string[]; cats: FridayCategoryKey[] }> = {
  "hyperice.ca": { kind: "product", skus: ["massage_gun", "compression", "recovery_tools", "massage_device"], leads: [], cats: ["recovery_devices"] },
  "hyperice.com": { kind: "product", skus: ["massage_gun", "compression", "recovery_tools", "massage_device"], leads: [], cats: ["recovery_devices"] },
  "therabody.com": { kind: "product", skus: ["massage_gun", "compression", "recovery_tools", "massage_device"], leads: [], cats: ["recovery_devices"] },
};

/** Approver overrides (brand domain or Friday category → hub keys allowed despite a flag). Empty until an approver signs off. */
export const HUB_MATCH_APPROVED: Record<string, string[]> = {};

export type BrandCtx = { domain?: string | null; category?: string | null; kind?: Kind | null; skus?: string[] | null; approved?: string[] };
export type HubDecision = { key: string; kind: Kind; score: number; hidden: boolean; reason: string | null; approved: boolean; order: number };

const host = (d?: string | null) => (d ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] ?? "";
const fcat = (c?: string | null): FridayCategoryKey | null => (!c ? null : isFridayCategory(c) ? c : (BIRCH_TO_FRIDAY[c] ?? null));

export function brandProfile(ctx: BrandCtx): { kind: Kind | null; skus: string[]; leads: string[]; cats: FridayCategoryKey[]; confident: boolean } {
  const known = KNOWN_BRANDS[host(ctx.domain)];
  const cat = fcat(ctx.category);
  const base = known ?? (cat ? { ...CATEGORY_PROFILE[cat], cats: [cat] } : null);
  if (!base) return { kind: ctx.kind ?? null, skus: ctx.skus ?? [], leads: [], cats: [], confident: false };
  return { kind: ctx.kind ?? base.kind, skus: [...new Set([...(base.skus ?? []), ...(ctx.skus ?? [])])], leads: base.leads, cats: base.cats, confident: true };
}

/** Score and order every hub for this brand. Hidden ones stay in the list, flagged, for an approver. */
export function matchHubs(hubKeys: readonly string[], ctx: BrandCtx): HubDecision[] {
  const b = brandProfile(ctx);
  const approved = new Set([...(ctx.approved ?? []), ...(HUB_MATCH_APPROVED[host(ctx.domain)] ?? []), ...(HUB_MATCH_APPROVED[fcat(ctx.category) ?? ""] ?? [])]);
  const out = hubKeys.map((key, i): HubDecision => {
    const h = HUB_PROFILES[key];
    if (!h) return { key, kind: "product", score: 0.5, hidden: !approved.has(key), reason: "unknown hub profile", approved: approved.has(key), order: i };
    let score = 0;
    let reason: string | null = null;
    if (!b.confident || !b.kind) {
      // Not confident about the brand: service hubs only.
      if (h.kind === "product") (score = 0.5), (reason = "brand not classified yet: service hubs only");
    } else if (b.kind === h.kind) {
      const same = b.kind === "product" ? b.skus.filter((s) => h.skus.includes(s)) : b.leads.filter((l) => h.leads.includes(l));
      const catOverlap = b.cats.some((c) => h.cats.includes(c));
      if (same.length) (score = 1), (reason = `${b.kind === "product" ? "same SKUs" : "same leads"}: ${same.join(", ")}`);
      else if (catOverlap) (score = 0.5), (reason = "same category, not confident it doesn't compete");
    }
    const ok = approved.has(key);
    return { key, kind: h.kind, score, hidden: score >= 0.5 && !ok, reason, approved: ok && score >= 0.5, order: i };
  });
  // Opposite kind first (service hubs for product brands, product hubs for service brands); unknown → service first.
  const first: Kind = b.kind === "service" ? "product" : "service";
  return out.sort((x, y) => Number(x.hidden) - Number(y.hidden) || Number(x.kind !== first) - Number(y.kind !== first) || x.order - y.order).map((d, i) => ({ ...d, order: i }));
}

/**
 * Apply the rules to any hub list Birch shows (Friday's or Birch's own): drops items Friday already flagged
 * (hidden / excluded / competes) and known hubs this brand conflicts with; orders the opposite kind first.
 * Hubs Birch has no profile for are Friday's call (authoritative) and keep their place.
 */
export function visibleHubs<T extends { key?: string; hidden?: boolean; excluded?: boolean; competes?: boolean }>(hubs: readonly T[], ctx: BrandCtx): T[] {
  const known = hubs.map((h) => h.key).filter((k): k is string => !!k && !!HUB_PROFILES[k]);
  const dec = new Map(matchHubs(known, ctx).map((d) => [d.key, d]));
  const b = brandProfile(ctx);
  const first: Kind = b.kind === "service" ? "product" : "service";
  const rank = (h: T) => { const d = h.key ? dec.get(h.key) : undefined; return !d ? 1 : d.kind === first ? 0 : 2; };
  return hubs
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => !h.hidden && !h.excluded && !h.competes && !(h.key && dec.get(h.key)?.hidden))
    .sort((a, b2) => rank(a.h) - rank(b2.h) || a.i - b2.i)
    .map(({ h }) => h);
}
