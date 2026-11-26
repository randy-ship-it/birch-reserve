/**
 * Scale voice for server-rendered HTML (Randy, Nov 21-22 2026: Scale pages speak as Scale Health; "Birch Reserve"
 * only in the ad-partner disclosure line). Renames visible prose only. Tags, attributes, script, style, pre, code
 * and footer (legal seller line + disclosure) are left alone. "Silver Birch Growth" is never touched.
 */
export function scaleText(html: string): string {
  let skip = 0;
  return html.replace(/(<[^>]*>)|([^<]+)/g, (_m, tag: string | undefined, text: string | undefined) => {
    if (tag) {
      const t = /^<(\/?)(script|style|pre|code|footer|textarea)\b/i.exec(tag);
      if (t) skip += t[1] ? -1 : 1;
      return tag;
    }
    if (skip > 0 || !text) return text ?? "";
    return text
      .replace(/Birch Reserve is operated by Silver Birch Growth Inc\./g, "\u0001SELLER\u0001")
      .replace(/Buy Scale Health ads through Birch Reserve\./g, "Buy Scale Health ads.")
      .replace(/Birch Reserve(?!, a Silver Birch)/g, "Scale Health")
      .replace(/(?<!Silver )\bBirch\b(?! Growth)/g, "Scale Health")
      .replace(/Scale Health's Scale Health/g, "Scale Health's")
      .replace(/Scale Health Scale Health/g, "Scale Health")
      .replace(/\u0001SELLER\u0001/g, SCALE_SELLER_LINE);
  });
}

/** Terms line on Scale pages: Birch ad inventory is sold by Silver Birch Growth Inc. (no ownership claim either way). */
export const SCALE_SELLER_LINE = "Birch ad inventory shown on Scale Health is sold by Silver Birch Growth Inc. (Birch Reserve).";

/** The one place Birch Reserve is named on Scale pages. */
export const SCALE_AD_PARTNER_LINE = "Ad placements are sold with our ad partner Birch Reserve (Silver Birch Growth Inc.).";
