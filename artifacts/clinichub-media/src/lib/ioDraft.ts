/**
 * Draft IO / pro-forma for the "Big block / agency" lane (Randy t227u, Nov 19 2026 ET). One SVG page (1200×1600),
 * exported with the kit PDF writer (lib/kitRender.ts). Not an invoice and not a signed IO: payment by cheque, wire or
 * EFT to Silver Birch Growth Inc.; no bank details exist in config, so it says "Remit details on signed IO".
 */
import { KIT_H, KIT_W } from "./kitRender";
import {
  AGENCY_TEST,
  BLOCK_BANDS,
  LIVE_TERMS,
  PAYMENT_METHODS_LINE,
  REMIT_LINE,
  agencyCashLabel,
  bandAmountLabel,
  type BlockRequest,
} from "../../../api-server/src/lib/twoLane";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SANS = "-apple-system, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
const SERIF = "'Iowan Old Style', Charter, Georgia, 'Times New Roman', serif";
const FOREST = "#0E3B2A";
const MINT = "#BFF3D6";
const INK = "#0B1A13";
const MUTE = "#5E6B64";

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > max) {
      if (line) out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

const longDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
};

export function ioDraftSvg(r: BlockRequest, ref: string, opts: { issued?: Date; mock?: boolean } = {}): string {
  const issued = (opts.issued ?? new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const band = BLOCK_BANDS.find((b) => b.key === r.band)!;
  const rows: Array<[string, string]> = [
    ["Client (brand)", r.client || "[Brand legal name]"],
    ["Agency of record", r.agency || "None (direct)"],
    ["Contact", [r.name, r.email].filter(Boolean).join(" · ")],
    ["Budget", `${bandAmountLabel(r.band)} · ${band.sub}`],
    ["Flight", `${longDate(r.flightStart)} – ${longDate(r.flightEnd)}`],
    ["Placements", "Retail hubs named on the signed IO"],
    ...(r.agency ? ([["Agency discount", `Written ${AGENCY_TEST.cashPct}% off the published rate card · discount est. ${agencyCashLabel(r.band)}`]] as Array<[string, string]>) : []),
  ];
  let y = 470;
  const rowSvg = rows
    .map(([k, v]) => {
      const lines = wrap(v, 46);
      const block = `<text x="96" y="${y}" font-family="${SANS}" font-size="19" font-weight="700" letter-spacing="2" fill="${MUTE}">${esc(k.toUpperCase())}</text>
      ${lines.map((l, i) => `<text x="420" y="${y + i * 36}" font-family="${SANS}" font-size="27" fill="${INK}">${esc(l)}</text>`).join("")}
      <line x1="96" x2="1104" y1="${y + 26 + (lines.length - 1) * 36}" y2="${y + 26 + (lines.length - 1) * 36}" stroke="#E6E2D8" stroke-width="2"/>`;
      y += 72 + (lines.length - 1) * 36;
      return block;
    })
    .join("");
  const payY = Math.max(y + 30, 1010);
  const terms = wrap(`${LIVE_TERMS.io} Reporting is aggregate only. No PHI. No clinical pixels. Views are modelled estimates.`, 78);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${KIT_W}" height="${KIT_H}" viewBox="0 0 ${KIT_W} ${KIT_H}">
  <rect width="${KIT_W}" height="${KIT_H}" fill="#FAF8F3"/>
  <rect width="${KIT_W}" height="300" fill="${FOREST}"/>
  <text x="96" y="104" font-family="${SANS}" font-size="20" font-weight="800" letter-spacing="5" fill="${MINT}">BIRCH RESERVE</text>
  <text x="1104" y="104" text-anchor="end" font-family="${SANS}" font-size="18" font-weight="700" letter-spacing="3" fill="#fff" opacity=".7">${esc(ref)}</text>
  <text x="96" y="200" font-family="${SERIF}" font-size="68" fill="#fff">Draft insertion order</text>
  <text x="96" y="250" font-family="${SANS}" font-size="24" fill="#fff" opacity=".8">Pro-forma · ${esc(issued)} · USD</text>
  <g><rect x="96" y="340" rx="18" width="300" height="40" fill="#FFF4DB"/><text x="116" y="367" font-family="${SANS}" font-size="17" font-weight="800" letter-spacing="2" fill="#8A5A00">DRAFT · NOT AN INVOICE</text></g>
  ${opts.mock ? `<g><rect x="410" y="340" rx="18" width="210" height="40" fill="#ede9fe"/><text x="430" y="367" font-family="${SANS}" font-size="17" font-weight="800" letter-spacing="2" fill="#4c1d95">PREVIEW · MOCK</text></g>` : ""}
  <text x="1104" y="367" text-anchor="end" font-family="${SANS}" font-size="19" fill="${MUTE}">Seller: Silver Birch Growth Inc. · Toronto, Ontario</text>
  ${rowSvg}
  <rect x="96" y="${payY}" width="1008" height="210" rx="24" fill="${FOREST}"/>
  <text x="136" y="${payY + 62}" font-family="${SANS}" font-size="19" font-weight="800" letter-spacing="3" fill="${MINT}">PAYMENT</text>
  <text x="136" y="${payY + 114}" font-family="${SERIF}" font-size="36" fill="#fff">${esc(PAYMENT_METHODS_LINE)}</text>
  <text x="136" y="${payY + 164}" font-family="${SANS}" font-size="24" fill="#fff" opacity=".85">${esc(REMIT_LINE)} Terms are set on the signed IO.</text>
  ${terms.map((l, i) => `<text x="96" y="${payY + 290 + i * 32}" font-family="${SANS}" font-size="21" fill="${MUTE}">${esc(l)}</text>`).join("")}
  <text x="96" y="1430" font-family="${SANS}" font-size="20" font-weight="700" fill="${INK}">Signatures</text>
  <line x1="96" x2="560" y1="1500" y2="1500" stroke="${INK}" stroke-width="2"/><line x1="640" x2="1104" y1="1500" y2="1500" stroke="${INK}" stroke-width="2"/>
  <text x="96" y="1530" font-family="${SANS}" font-size="18" fill="${MUTE}">Client / agency</text><text x="640" y="1530" font-family="${SANS}" font-size="18" fill="${MUTE}">Silver Birch Growth Inc.</text>
  <text x="600" y="1580" text-anchor="middle" font-family="${SANS}" font-size="16" fill="${MUTE}">Draft for discussion. Not binding until signed by both parties. randy@scalehealth.ca · (647) 931-6278</text>
</svg>`;
}
