/**
 * ONE hub status ladder for every page (Randy, Nov 23 2026 8:16 AM ET). Home, /hubs, /kit, /sponsor, /buycalc, the media
 * kit, llms.txt, the .md copies, the chat knowledge and the Scale mirror all read this file, so the list cannot drift.
 *
 *   Live now    -> open today
 *   Activating  -> going live
 *   Coming      -> "and more launching"
 *
 * Integrity Fitness: named Live by Randy (Nov 23 2026 8:16 AM ET), listed Live on the Scale site, real page at scalehealth.ca/integrity.
 * Rules: audience lines use only facts already on the site (model.ts hub audiences). A hub is linked only when it has a
 * real page. `public: false` keeps a hub out of every public surface until Randy confirms it (no hub is listed that has no
 * page and no approved public line). Visible reach or price figures are not stored here.
 */
export type HubTier = "live" | "activating";

export type LadderHub = {
  key: string;
  name: string;
  tier: HubTier;
  /** One line: who is on the hub and when they see the card. Real hub facts only. */
  audience: string;
  /** Real hub page. Absent = not linked. */
  href?: string;
  /** Scale-side page (always scalehealth.ca). Defaults to href. */
  scaleHref?: string;
  /** Small static capture in /hub-gallery/thumbs (live hubs that have one). */
  thumb?: string;
  /** Activating hubs: capture of the hub's co-branded page (existing site asset) used behind the example ad-card mockup. */
  banner?: string;
  /** Placement shown in the example mockup. */
  surface?: string;
  /** false = held back from every public surface until confirmed. */
  public?: boolean;
};

export const HUB_LADDER: readonly LadderHub[] = [
  { key: "dr-ho", name: "DR-HO'S physio", tier: "live", audience: "Physio patients, right after they book or buy", href: "https://physio.drhonow.com", scaleHref: "https://www.scalehealth.ca/dr-ho", thumb: "/hub-gallery/thumbs/drho.webp" },
  { key: "sole", name: "SOLE", tier: "live", audience: "Foot-pain and active-footwear buyers, right after they buy", href: "https://www.scalehealth.ca/sole", thumb: "/hub-gallery/thumbs/sole.webp" },
  { key: "integrity-fitness", name: "Integrity Fitness", tier: "live", audience: "Gym members, with recovery and physio built into the membership", href: "https://www.scalehealth.ca/integrity", thumb: "/hub-gallery/thumbs/integrity.webp" },
  { key: "calm-joints", name: "Calm Joints", tier: "live", audience: "Members of our own digital physio clinic", href: "https://www.scalehealth.ca/calmjoints", thumb: "/hub-gallery/thumbs/calmjoints.webp" },
  { key: "effortless-admin", name: "Effortless Admin", tier: "activating", audience: "Employees reaching care through their benefits", banner: "/hub-banners/effortless-admin.webp", surface: "Clinic layer home card" },
  { key: "nutriprocan", name: "NutriProCan", tier: "activating", audience: "Nutrition and dietitian-guided eating", banner: "/hub-banners/nutriprocan.webp", surface: "Post-booking card" },
  { key: "jack-health", name: "Jack Health", tier: "activating", audience: "Men's health and longevity members", banner: "/hub-banners/jack-health.webp", surface: "Post-booking card" },
  { key: "jill-health", name: "Jill Health", tier: "activating", audience: "Women's health, midlife and menopause members", banner: "/hub-banners/jill-health.webp", surface: "Post-booking card" },
  { key: "roll-recovery", name: "Roll Recovery", tier: "activating", audience: "Athletes and active adults buying recovery hardware", banner: "/hub-banners/roll-recovery.webp", surface: "Post-purchase card" },
  { key: "bird-and-be", name: "Bird & Be", tier: "activating", audience: "Postpartum recovery and pelvic-floor care", banner: "/hub-banners/bird-and-be.webp", surface: "Post-booking card" },
] as const;

/**
 * Retail micro-hubs: five signed clinic-counter hubs shown as GENERIC examples (Randy, Nov 23 2026 12:39 PM ET).
 * Never named, never located below province level, never shown with a real photo. Status is Activating.
 */
export type RetailMicroHub = { key: string; name: string; label: string; surface: string; scene: "shelf" | "counter" | "wall"; hue: number; audience: string };
export const RETAIL_MICRO_LABEL = "Retail micro clinic layer";
export const RETAIL_MICRO_HUBS: readonly RetailMicroHub[] = [
  { key: "retail-1", name: "Retail micro clinic layer #1", label: "Physio & recovery clinic · Ontario", surface: "Recovery shelf card", scene: "shelf", hue: 0, audience: "Patients and walk-ins at the clinic's recovery shelf" },
  { key: "retail-2", name: "Retail micro clinic layer #2", label: "Physio & recovery clinic · Ontario", surface: "Clinic counter card", scene: "counter", hue: 40, audience: "Patients paying at the clinic counter" },
  { key: "retail-3", name: "Retail micro clinic layer #3", label: "Physio & recovery clinic · Ontario", surface: "Wall display card", scene: "wall", hue: 80, audience: "Patients waiting for an appointment" },
  { key: "retail-4", name: "Retail micro clinic layer #4", label: "Physio & recovery clinic · Ontario", surface: "Recovery shelf card", scene: "shelf", hue: 150, audience: "Patients picking up recovery products after a visit" },
  { key: "retail-5", name: "Retail micro clinic layer #5", label: "Physio & recovery clinic · Ontario", surface: "Clinic counter card", scene: "counter", hue: 210, audience: "Patients and walk-ins buying at the counter" },
] as const;
export const retailSceneSrc = (h: RetailMicroHub): string => `/hub-gallery/retail-${h.scene}.svg`;
export const MOCK_LABEL = "Example mockup";

export const LABEL_LIVE = "Live now";
export const LABEL_ACTIVATING = "Activating";
export const LABEL_COMING = "Coming";
export const MORE_LAUNCHING = "and more launching";

export const publicHubs = (): LadderHub[] => HUB_LADDER.filter((h) => h.public !== false);
export const liveHubs = (): LadderHub[] => publicHubs().filter((h) => h.tier === "live");
export const activatingHubs = (): LadderHub[] => publicHubs().filter((h) => h.tier === "activating");
export const hubTier = (key: string): HubTier | undefined => publicHubs().find((h) => h.key === key)?.tier;
export const tierLabel = (t: HubTier | undefined): string => (t === "live" ? LABEL_LIVE : t === "activating" ? LABEL_ACTIVATING : "In queue");

export function joinNames(names: string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
/** "Live now: A, B and C." */
export const liveLine = (): string => `${LABEL_LIVE}: ${joinNames(liveHubs().map((h) => h.name))}.`;
/** "Activating: A, B and C, and more launching." */
export const activatingLine = (): string => `${LABEL_ACTIVATING}: ${joinNames(activatingHubs().map((h) => h.name))}, ${MORE_LAUNCHING}.`;
/** The whole ladder as one short paragraph. */
export const ladderLine = (): string => `${liveLine()} ${activatingLine()}`;
/** Markdown bullets for llms.txt and the .md copies. */
export const ladderMarkdown = (): string =>
  [
    `- ${LABEL_LIVE}: ${liveHubs().map((h) => h.name).join("; ")}`,
    `- ${LABEL_ACTIVATING}: ${activatingHubs().map((h) => h.name).join("; ")}`,
    `- ${LABEL_COMING}: ${MORE_LAUNCHING}`,
    "- Clinic layer audiences and any view figures are modelled estimates from listed partners, not delivered impressions, and not a guarantee.",
  ].join("\n");

/** Real hub pages for the Live hubs, per skin. Scale pages stay on scalehealth.ca. */
export const hubHref = (h: LadderHub, scale = false): string | undefined => (scale ? h.scaleHref ?? h.href : h.href);

/** Where the "Birch Reserve" word must not appear (Scale pages). Used by tests. */
export const SCALE_HUB_HOST = "scalehealth.ca";

/** Kit / report status word for an anchor hub: Live, Activating, or In queue (not on the ladder). */
export const kitStatus = (key: string, live: boolean): "Live" | "Activating" | "In queue" => (live || hubTier(key) === "live" ? "Live" : hubTier(key) === "activating" ? "Activating" : "In queue");
