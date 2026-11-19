/**
 * Friday report design system v2 tokens (/workspace/birch-friday-contract/report-design-system.md, Friday PR #214).
 * Birch reuses them to render brand-report.v1; Birch's own site chrome (header, footer, CTA bands) stays Birch's.
 */
export const RT = {
  ink: "#0B1A13", body: "#24332B", mute: "#5E6B64", line: "#E6E2D8", paper: "#FAF8F3", surface: "#FFFFFF",
  forest: "#0E3B2A", forest2: "#145A3F", mint: "#BFF3D6", mintInk: "#0B6B43", track: "#ECE8DF",
  gold: "#8A5A00", goldBg: "#FFF4DB", goldLine: "#F1D58F",
  // red / redBg / redLine exist in Friday's system for its INTERNAL "excluded: competes" card only. Never used on Birch.
} as const;
export const RT_SERIF = "'Iowan Old Style', Charter, Georgia, 'Times New Roman', serif";
export const RT_SANS = "-apple-system, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
export const RT_SHADOW = "0 1px 2px rgba(11,26,19,.05), 0 8px 24px rgba(11,26,19,.06)";
export const fitLabelOf = (n: number) => (n >= 80 ? "Strong fit" : n >= 60 ? "Good fit" : n >= 40 ? "Possible fit" : "Early fit");
export function monogramBg(domain: string): string {
  let h = 0;
  for (const ch of domain) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 30%)`;
}
