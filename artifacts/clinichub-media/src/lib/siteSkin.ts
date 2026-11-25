/**
 * Site skin (Randy, Nov 20 2026 8:20 AM ET): scalehealth.ca/intake must look and feel like Scale Health while being the
 * SAME intake as birchreserve.net/intake. There is one deployment and one form: Scale's vercel.json rewrites its /intake
 * namespace to birchreserve.net/intake?br_mirror=scale, and the server (api-server middlewares/mirrorHost.ts) puts
 * { skin: "scale" } on window.__BR_MIRROR and data-skin="scale" on <html> before the bundle runs.
 *
 * Only chrome reads the skin: header, footer, logo, colours, type and the brand NAME in visible copy. Fields, logic,
 * validation, payloads, endpoints and tracking stay identical, so any intake change ships to both sites at once.
 */
export type SiteSkin = "birch" | "scale";

export function siteSkin(): SiteSkin {
  if (typeof window === "undefined") return "birch";
  const m = (window as { __BR_MIRROR?: { skin?: string } }).__BR_MIRROR;
  return m?.skin === "scale" ? "scale" : "birch";
}

export const isScaleSkin = () => siteSkin() === "scale";

/** True on the Scale-skinned mirror (scalehealth.ca/intake) and on the Scale homepage Brands CTA landing (?ref=scale).
 *  Used for Scale-facing intake copy only (hub definition, simpler hero). Form fields, submit and tracking stay identical. */
export function isScaleFacing(search: string = typeof window === "undefined" ? "" : window.location.search, skin: boolean = typeof window === "undefined" ? false : isScaleSkin()): boolean {
  if (skin) return true;
  try {
    const q = search.startsWith("?") || search === "" ? search : `?${search}`;
    return new URLSearchParams(q).get("ref") === "scale";
  } catch {
    return false;
  }
}

/** Plain definition of a Scale Hub, drawn from the Scale home and intake copy: a co-branded clinic storefront,
 *  audience books care and buys products, earn from day 1, costs nothing to host. No splits, margins or prices. */
export const HUB_DEFINITION =
  "A hub is your own co-branded Scale clinic storefront. Your audience books care and buys products through it, and you earn from day 1. It costs nothing to host.";

/** The brand name a visitor should see on this host. */
/** Absolute URL of a Birch page. On the Scale skin it stays on scalehealth.ca (the same page served at /intake/_m/<path>, Scale skin);
 *  on birchreserve.net it is the Birch URL, unchanged. */
export const siteUrl = (path: string) =>
  isScaleSkin() && typeof window !== "undefined" ? `${window.location.origin}/intake/_m${path}` : `https://birchreserve.net${path}`;

export const siteName = () => (isScaleSkin() ? "Scale Health" : "Birch Reserve");

/** Swap the Birch brand name for the host's brand name in visible copy (titles, eyebrows, review lines). */
export const skinText = (s: string) => (isScaleSkin() ? s.replace(/Birch Reserve/g, "Scale Health").replace(/(?<!Silver )\bBirch\b/g, "Scale Health") : s);

/** Chat/visitor copy written in Birch voice -> Scale voice on the Scale skin (name, squirrel, links). Birch is untouched. */
export const skinChat = (s: string) =>
  isScaleSkin()
    ? s
        .replace(/https:\/\/(?:www\.)?birchreserve\.net(\/intake(?:[/?#][^\s)\]"'<>]*)?)?/g, (_m, p?: string) => `https://www.scalehealth.ca${p ?? "/intake"}`)
        .replace(/https:\/\/(?:www\.)?birchreserve\.net(\/[^\s)\]"'<>]*)/g, "https://www.scalehealth.ca/intake/_m$1")
        .replace(/Birch Q&A Squirrel/g, SCALE_SQUIRREL_NAME)
        .replace(/\bBirch (results?|ad server)\b/g, "Scale Health $1")
        .replace(/Birch Reserve/g, "Scale Health")
        .replace(/\bBirch team\b/g, "Scale Health team")
    : s;

/** Scale Health's public site (header/footer links on the Scale skin). Links carry data-mirror-keep so the mirror
 *  boot script leaves them on scalehealth.ca instead of sending them to birchreserve.net. */
export const SCALE_HOME = "https://www.scalehealth.ca";

/** Chat name on the Scale skin (Randy, Nov 20 2026 9:34 AM ET). birchreserve.net keeps "Birch Q&A Squirrel". */
export const SCALE_SQUIRREL_NAME = "Scale Squirrel";
