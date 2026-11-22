/**
 * Friday report design system v2 tokens (/workspace/birch-friday-contract/report-design-system.md, Friday PR #214).
 * Birch reuses them to render brand-report.v1; Birch's own site chrome (header, footer, CTA bands) stays Birch's.
 */
import { isScaleSkin } from "./siteSkin";

const BIRCH_RT = {
  ink: "#0B1A13", body: "#24332B", mute: "#5E6B64", line: "#E6E2D8", paper: "#FAF8F3", surface: "#FFFFFF",
  forest: "#0E3B2A", forest2: "#145A3F", mint: "#BFF3D6", mintInk: "#0B6B43", track: "#ECE8DF",
  gold: "#8A5A00", goldBg: "#FFF4DB", goldLine: "#F1D58F",
  // red / redBg / redLine exist in Friday's system for its INTERNAL "excluded: competes" card only. Never used on Birch.
} as const;
/** Scale skin (scalehealth.ca/intake): same keys, live scalehealth.ca palette (ink #0d1426, muted #607085, green #1d875c,
 *  page #f9fafb, border #e0e5eb, dark #0b1d16, soft #eceff3, mint #bfe8d4, amber from its CSS). Colours only. */
const SCALE_RT: { [K in keyof typeof BIRCH_RT]: string } = {
  ink: "#0D1426", body: "#0D1426", mute: "#607085", line: "#E0E5EB", paper: "#F9FAFB", surface: "#FFFFFF",
  forest: "#0B1D16", forest2: "#0B0F1D", mint: "#BFE8D4", mintInk: "#1D875C", track: "#ECEFF3",
  gold: "#B45309", goldBg: "#FFF9E8", goldLine: "#E3B84F",
};
export const RT: { [K in keyof typeof BIRCH_RT]: string } = isScaleSkin() ? SCALE_RT : BIRCH_RT;
export const RT_SERIF = "'Iowan Old Style', Charter, Georgia, 'Times New Roman', serif";
export const RT_SANS = "-apple-system, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
export const RT_SHADOW = isScaleSkin() ? "0 1px 2px rgba(13,20,38,.05), 0 8px 24px rgba(13,20,38,.06)" : "0 1px 2px rgba(11,26,19,.05), 0 8px 24px rgba(11,26,19,.06)";
export const fitLabelOf = (n: number) => (n >= 80 ? "Strong fit" : n >= 60 ? "Good fit" : n >= 40 ? "Possible fit" : "Early fit");
export function monogramBg(domain: string): string {
  if (isScaleSkin()) return "#1D875C"; // Scale skin: one palette green, not a per-domain hue
  let h = 0;
  for (const ch of domain) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 30%)`;
}
