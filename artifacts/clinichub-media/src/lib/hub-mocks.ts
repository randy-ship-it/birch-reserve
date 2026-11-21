/** Live hubs used for "Illustrative mock" example ads. One source for every mock switcher on the site. */
export type HubKey = "drho" | "sole" | "effortless" | "calmjoints";
export type HubInfo = { key: HubKey; tab: string; name: string; host: string; img: string; surface: string; url: string; cardSide: "left" | "right" };
export const HUB_MOCKS: Record<HubKey, HubInfo> = {
  drho: { key: "drho", tab: "DR-HO'S", name: "DR-HO'S physio", host: "physio.drhonow.com", img: "/hub-gallery/drho.webp", surface: "Booking confirmation", url: "https://physio.drhonow.com", cardSide: "right" },
  sole: { key: "sole", tab: "SOLE", name: "SOLE", host: "scalehealth.ca/sole", img: "/hub-gallery/sole.webp", surface: "Hub home", url: "https://www.scalehealth.ca/sole", cardSide: "right" },
  effortless: { key: "effortless", tab: "Effortless", name: "Effortless Admin", host: "scalehealth.ca/effortlessadmin", img: "/hub-gallery/effortless.webp", surface: "Hub home", url: "https://www.scalehealth.ca/effortlessadmin", cardSide: "right" },
  calmjoints: { key: "calmjoints", tab: "Calm Joints", name: "Calm Joints", host: "scalehealth.ca/calmjoints", img: "/hub-gallery/calmjoints.webp", surface: "Hub home", url: "https://www.scalehealth.ca/calmjoints", cardSide: "left" },
};
export const HUB_KEYS: HubKey[] = ["drho", "sole", "effortless", "calmjoints"];
/** Rotate the default hub per placement so pages do not all show the same one. */
export function pickHub(seed: string): HubKey {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUB_KEYS[h % HUB_KEYS.length];
}
