/** Live hubs used for "Illustrative mock" example ads. One source for every mock switcher on the site. */
export type HubKey = "drho" | "sole" | "effortless" | "calmjoints";
export type HubInfo = { key: HubKey; tab: string; name: string; host: string; img: string; surface: string; url: string; card: { pos: string; pin3: "br" | "bl" }; pin2: { left: string; top: string } };
export const HUB_MOCKS: Record<HubKey, HubInfo> = {
  drho: { key: "drho", tab: "DR-HO'S", name: "DR-HO'S physio", host: "physio.drhonow.com", img: "/hub-gallery/drho.webp", surface: "Booking confirmation", url: "https://physio.drhonow.com", card: { pos: "right-[2.5%] bottom-[3%]", pin3: "br" }, pin2: { left: "62%", top: "19%" } },
  sole: { key: "sole", tab: "SOLE", name: "SOLE", host: "scalehealth.ca/sole", img: "/hub-gallery/sole.webp", surface: "Hub home", url: "https://www.scalehealth.ca/sole", card: { pos: "right-[2.5%] bottom-[3%]", pin3: "br" }, pin2: { left: "3%", top: "27%" } },
  effortless: { key: "effortless", tab: "Effortless", name: "Effortless Admin", host: "scalehealth.ca/effortlessadmin", img: "/hub-gallery/effortless.webp", surface: "Hub home", url: "https://www.scalehealth.ca/effortlessadmin", card: { pos: "right-[1.2%] top-[27%]", pin3: "bl" }, pin2: { left: "1.5%", top: "74%" } },
  calmjoints: { key: "calmjoints", tab: "Calm Joints", name: "Calm Joints", host: "scalehealth.ca/calmjoints", img: "/hub-gallery/calmjoints.webp", surface: "Hub home", url: "https://www.scalehealth.ca/calmjoints", card: { pos: "left-[57%] bottom-[24%]", pin3: "bl" }, pin2: { left: "3%", top: "22%" } },
};
export const HUB_KEYS: HubKey[] = ["drho", "sole", "effortless", "calmjoints"];
/** Rotate the default hub per placement so pages do not all show the same one. */
export function pickHub(seed: string): HubKey {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUB_KEYS[h % HUB_KEYS.length];
}
