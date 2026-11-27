/** Live hubs used for "Illustrative mock" example ads. One source for every mock switcher on the site. */
export type HubKey = "drho" | "sole" | "integrity" | "calmjoints" | "effortless" | "nutriprocan" | "jack" | "jill" | "roll" | "bird";
export type HubInfo = { key: HubKey; status: "Live" | "Activating"; tab: string; name: string; host: string; img: string; surface: string; url: string; card: { pos: string; pin3: "br" | "bl"; scale?: number; origin?: "bl" | "br" }; pin2: { left: string; top: string } };
const D = { card: { pos: "right-[2.5%] bottom-[3%]", pin3: "br" as const }, pin2: { left: "3%", top: "27%" }, surface: "Post-booking card" };
export const HUB_MOCKS: Record<HubKey, HubInfo> = {
  drho: { key: "drho", status: "Live", tab: "DR-HO'S", name: "DR-HO'S physio", host: "physio.drhonow.com", img: "/hub-gallery/drho.webp", surface: "Booking confirmation", url: "https://physio.drhonow.com", card: { pos: "right-[2.5%] bottom-[3%]", pin3: "br" }, pin2: { left: "62%", top: "19%" } },
  sole: { key: "sole", status: "Live", tab: "SOLE", name: "SOLE", host: "scalehealth.ca/sole", img: "/hub-gallery/sole.webp", surface: "Clinic layer home", url: "https://www.scalehealth.ca/sole", card: { pos: "right-[2.5%] bottom-[3%]", pin3: "br" }, pin2: { left: "3%", top: "27%" } },
  effortless: { key: "effortless", status: "Activating", tab: "Effortless", name: "Effortless Admin", host: "scalehealth.ca/effortlessadmin", img: "/hub-gallery/effortless.webp", surface: "Clinic layer home", url: "https://www.scalehealth.ca/effortlessadmin", card: { pos: "right-[1.2%] top-[27%]", pin3: "bl" }, pin2: { left: "1.5%", top: "74%" } },
  calmjoints: { key: "calmjoints", status: "Live", tab: "Calm Joints", name: "Calm Joints", host: "scalehealth.ca/calmjoints", img: "/hub-gallery/calmjoints.webp", surface: "Clinic layer home", url: "https://www.scalehealth.ca/calmjoints", card: { pos: "left-[5%] bottom-[4%]", pin3: "br", scale: 0.64, origin: "bl" }, pin2: { left: "3%", top: "22%" } },
  integrity: { key: "integrity", status: "Live", tab: "Integrity", name: "Integrity Fitness", host: "scalehealth.ca/integrity", img: "/hub-gallery/integrity.webp", url: "https://www.scalehealth.ca/integrity", ...D, surface: "Clinic layer home" },
  nutriprocan: { key: "nutriprocan", status: "Activating", tab: "NutriProCan", name: "NutriProCan", host: "scalehealth.ca/nutriprocan", img: "/hub-banners/nutriprocan.webp", url: "https://www.scalehealth.ca/nutriprocan", ...D },
  jack: { key: "jack", status: "Activating", tab: "Jack Health", name: "Jack Health", host: "scalehealth.ca/jack-health", img: "/hub-gallery/jack-health.webp", url: "https://www.scalehealth.ca/jack-health", ...D },
  jill: { key: "jill", status: "Activating", tab: "Jill Health", name: "Jill Health", host: "scalehealth.ca/jill-health", img: "/hub-gallery/jill-health.webp", url: "https://www.scalehealth.ca/jill-health", ...D },
  roll: { key: "roll", status: "Activating", tab: "Roll Recovery", name: "Roll Recovery", host: "scalehealth.ca/roll-recovery", img: "/hub-banners/roll-recovery.webp", url: "https://www.scalehealth.ca/roll-recovery", ...D, surface: "Post-purchase card" },
  bird: { key: "bird", status: "Activating", tab: "Bird & Be", name: "Bird & Be", host: "scalehealth.ca/bird-and-be", img: "/hub-banners/bird-and-be.webp", url: "https://www.scalehealth.ca/bird-and-be", ...D },
};/** Mock switchers cover the whole ladder (10 hubs, Live first). Activating hubs are labelled Example mockup. Keep in step with lib/hubLadder.ts. */
export const HUB_KEYS: HubKey[] = ["drho", "sole", "integrity", "calmjoints", "effortless", "nutriprocan", "jack", "jill", "roll", "bird"];
/** Live now hubs only (4). */
export const LIVE_MOCK_KEYS: HubKey[] = HUB_KEYS.filter((k) => HUB_MOCKS[k].status === "Live");
/** Badge for any mock: "live" only for Live hubs; Activating hubs say so. Never a real placement. */
export function mockBadgeFor(hub: HubKey): string {
  const H = HUB_MOCKS[hub];
  return H.status === "Live" ? `Illustrative mock · your ad on the live ${H.name} clinic layer` : `Example mockup · ${H.name} is Activating, not a live placement`;
}
/** Rotate the default hub per placement so pages do not all show the same one. */
export function pickHub(seed: string): HubKey {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LIVE_MOCK_KEYS[h % LIVE_MOCK_KEYS.length];
}
