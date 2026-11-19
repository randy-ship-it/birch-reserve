/**
 * Two-sided personalized media kit: one SVG per side (1200×1600), shown on screen as-is and exported to
 * PNG (both sides, side by side) and a 2-page PDF. No dependencies: canvas + a minimal JPEG-in-PDF writer.
 */
import { KIT_FIT_FINE } from "../../../api-server/src/lib/overhaul/brandIntake";
import type { KitView } from "./kitView";

export const KIT_W = 1200;
export const KIT_H = 1600;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const $ = (n: number) => (Number.isFinite(n) ? `$${Math.round(n).toLocaleString("en-US")}` : "n/a");
const $r = (r: readonly [number, number]) => `${$(r[0])}–${$(r[1])}`;
const n = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString("en-US") : "n/a");
const SANS = "Helvetica Neue, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const NAVY = "#0b1f3a";
const LIME = "#c6f06b";

export type KitData = KitView;
const srcLabel = (d: KitData) => (d.source === "sample" ? "Sample · example values" : d.source === "friday" ? (d.mock ? "From Friday (mock on preview)" : "From Friday") : "Live preview");
const watermark = (d: KitData, dark: boolean) =>
  d.source === "sample" ? `<text x="600" y="900" text-anchor="middle" transform="rotate(-28 600 900)" font-family="${SANS}" font-size="220" font-weight="800" letter-spacing="20" fill="${dark ? "#ffffff" : NAVY}" opacity=".06">SAMPLE</text>` : "";

const pill = (x: number, y: number, label: string, fill = "#fde68a", color = "#78350f") =>
  `<g><rect x="${x}" y="${y}" rx="16" width="${label.length * 9.5 + 28}" height="32" fill="${fill}"/><text x="${x + 14}" y="${y + 21}" font-family="${SANS}" font-size="14" font-weight="700" letter-spacing="1.5" fill="${color}">${esc(label.toUpperCase())}</text></g>`;

function header(side: "A" | "B", title: string, d: KitData, dark: boolean) {
  const fg = dark ? "#ffffff" : NAVY;
  return `
  <text x="72" y="96" font-family="${SANS}" font-size="18" font-weight="700" letter-spacing="4" fill="${dark ? LIME : NAVY}">BIRCH RESERVE · POWERED BY FRIDAY</text>
  <text x="1128" y="96" text-anchor="end" font-family="${SANS}" font-size="18" font-weight="700" letter-spacing="3" fill="${fg}" opacity=".6">SIDE ${side}</text>
  <text x="72" y="150" font-family="${SANS}" font-size="22" fill="${fg}" opacity=".75">Prepared for ${esc(d.brand || "your brand")} · ${esc(d.categoryLabel)}</text>
  <text x="72" y="238" font-family="${SERIF}" font-size="78" fill="${fg}">${esc(title)}</text>
  ${pill(72, 268, "Estimate")}
  ${d.source === "sample" ? pill(dark ? 232 : 560, 268, "Sample · example values", "#ede9fe", "#4c1d95") : ""}
  ${watermark(d, dark)}
  <text x="1128" y="150" text-anchor="end" font-family="${SANS}" font-size="16" font-weight="700" fill="${fg}" opacity=".6">${esc(srcLabel(d).toUpperCase())}</text>`;
}

export function kitSideA(d: KitData): string {
  const c = d;
  const bars = [
    { l: "Modelled views", v: c.scale.modelledViews, t: n(c.scale.modelledViews) },
    { l: "Scale visits", v: c.scale.visits[1], t: `${n(c.scale.visits[0])}–${n(c.scale.visits[1])}` },
    { l: "New customers", v: c.scale.newCustomers[1], t: `${c.scale.newCustomers[0]}–${c.scale.newCustomers[1]}` },
  ];
  const max = Math.max(1, ...bars.map((b) => b.v));
  const barSvg = bars
    .map((b, i) => {
      const w = Math.max(40, (Math.log10(b.v + 1) / Math.log10(max + 1)) * 640);
      const y = 1010 + i * 92;
      return `<text x="72" y="${y - 14}" font-family="${SANS}" font-size="20" fill="#fff" opacity=".75">${esc(b.l)}</text>
      <rect x="72" y="${y}" width="${w}" height="40" rx="20" fill="url(#lime)"/>
      <text x="${72 + w + 16}" y="${y + 29}" font-family="${SANS}" font-size="26" font-weight="700" fill="#fff">${esc(b.t)}</text>`;
    })
    .join("");
  const chips = d.chips;
  let cx = 72;
  const chipSvg = chips
    .map((t) => {
      const w = t.length * 11 + 32;
      const s = `<rect x="${cx}" y="1330" width="${w}" height="40" rx="20" fill="#ffffff" fill-opacity=".1" stroke="#fff" stroke-opacity=".25"/><text x="${cx + 16}" y="1356" font-family="${SANS}" font-size="18" fill="#fff">${esc(t)}</text>`;
      cx += w + 10;
      return s;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${KIT_W}" height="${KIT_H}" viewBox="0 0 ${KIT_W} ${KIT_H}">
  <defs>
    <radialGradient id="glowA" cx="85%" cy="8%" r="70%"><stop offset="0" stop-color="${LIME}" stop-opacity=".55"/><stop offset="1" stop-color="${NAVY}" stop-opacity="0"/></radialGradient>
    <linearGradient id="lime" x1="0" x2="1"><stop offset="0" stop-color="#a3e635"/><stop offset="1" stop-color="${LIME}"/></linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${NAVY}"/><rect width="100%" height="100%" fill="url(#glowA)"/>
  ${header("A", "Your revenue opportunity", d, true)}
  <text x="72" y="380" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="2" fill="${LIME}">GROSS-PROFIT LTV PER CUSTOMER</text>
  <text x="72" y="490" font-family="${SERIF}" font-size="120" fill="#fff">${esc(c.ltvGp ? $r(c.ltvGp) : "Needs inputs")}</text>
  <text x="72" y="532" font-family="${SANS}" font-size="20" fill="#fff" opacity=".7">${esc(c.ltvNote.slice(0, 96))}</text>
  <rect x="72" y="580" width="1056" height="300" rx="28" fill="#ffffff" fill-opacity=".07" stroke="#fff" stroke-opacity=".15"/>
  <text x="112" y="640" font-family="${SANS}" font-size="20" font-weight="700" letter-spacing="2" fill="#fff" opacity=".75">FROM A ${esc($(c.scale.spendUsd))} USD SCALE TEST</text>
  <text x="112" y="740" font-family="${SERIF}" font-size="76" fill="${LIME}">${esc($r(c.revenueOpp))}</text>
  <text x="112" y="784" font-family="${SANS}" font-size="20" fill="#fff" opacity=".75">revenue opportunity from Scale-driven demand</text>
  <text x="112" y="842" font-family="${SANS}" font-size="24" fill="#fff">${esc(c.gpOpp && c.breakEven ? `Gross profit ${$r(c.gpOpp)} · break-even at ${n(c.breakEven[0])}–${n(c.breakEven[1])} new customers` : "Gross profit shown once LTV inputs are complete")}</text>
  <text x="72" y="960" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="2" fill="${LIME}">HOW SCALE DEMAND REACHES YOU</text>
  ${barSvg}
  ${chipSvg}
  ${d.formula
    .map((f, i) => `<text x="72" y="${1430 + i * 26}" font-family="${SANS}" font-size="16" fill="#fff" opacity=".6">${esc(f)}</text>`)
    .join("")}
  <text x="72" y="1540" font-family="${SANS}" font-size="15" fill="#fff" opacity=".55">Estimates from your inputs and Birch Reserve modelled figures. Not a guarantee of views, clicks, sales or returns. USD.</text>
</svg>`;
}

export function kitSideB(d: KitData): string {
  const hubs = d.hubs;
  const hubCards = hubs
    .map((h, i) => {
      const x = 72 + (i % 3) * 356;
      const y = 420 + Math.floor(i / 3) * 196;
      const likely = /good|likely|strong/i.test(h.fitLabel);
      return `<g><rect x="${x}" y="${y}" width="336" height="176" rx="24" fill="#fff" stroke="${NAVY}" stroke-opacity="${likely ? 0.9 : 0.15}" stroke-width="${likely ? 3 : 1.5}"/>
      <text x="${x + 24}" y="${y + 52}" font-family="${SERIF}" font-size="32" fill="${NAVY}">${esc(h.name)}</text>
      <text x="${x + 24}" y="${y + 86}" font-family="${SANS}" font-size="17" fill="${NAVY}" opacity=".7">${esc(h.what ?? h.status)}</text>
      <rect x="${x + 24}" y="${y + 112}" width="${h.fitLabel.length * 8.6 + 32}" height="36" rx="18" fill="${likely ? LIME : "#eef2f7"}"/>
      <text x="${x + 40}" y="${y + 136}" font-family="${SANS}" font-size="16" font-weight="700" fill="${NAVY}">${esc(h.fitLabel)}</text>
      ${h.status === "Live" ? `<text x="${x + 312}" y="${y + 136}" text-anchor="end" font-family="${SANS}" font-size="15" font-weight="700" fill="#15803d">● Live</text>` : `<text x="${x + 312}" y="${y + 136}" text-anchor="end" font-family="${SANS}" font-size="15" fill="${NAVY}" opacity=".55">${esc(h.status)}</text>`}</g>`;
    })
    .join("");
  const others = d.channels;
  const chCards = others
    .map((c, i) => {
      const x = 72 + i * 356;
      const y = 1010;
      const img = c.key === "street-team" && d.mapDataUrl ? `<clipPath id="clip${i}"><rect x="${x}" y="${y}" width="336" height="150" rx="24"/></clipPath><image href="${d.mapDataUrl}" x="${x}" y="${y}" width="336" height="150" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip${i})"/>` : `<rect x="${x}" y="${y}" width="336" height="150" rx="24" fill="url(#ch${i})"/>`;
      return `<defs><linearGradient id="ch${i}" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${["#99f6e4", "#c6f06b", "#fde68a"][i]}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
      <rect x="${x}" y="${y}" width="336" height="330" rx="24" fill="${NAVY}"/>${img}
      <text x="${x + 24}" y="${y + 200}" font-family="${SERIF}" font-size="32" fill="#fff">${esc(c.name)}</text>
      ${c.fitLabel ? `<rect x="${x + 16}" y="${y + 16}" width="${c.fitLabel.length * 8.4 + 28}" height="32" rx="16" fill="#fff"/><text x="${x + 30}" y="${y + 38}" font-family="${SANS}" font-size="15" font-weight="700" fill="${NAVY}">${esc(c.fitLabel)}</text>` : ""}
      ${wrap(c.figures.join(" · ") || "Figures to come", 30)
        .slice(0, 2)
        .map((l, k) => `<text x="${x + 24}" y="${y + 236 + k * 24}" font-family="${SANS}" font-size="18" fill="${LIME}">${esc(l)}</text>`)
        .join("")}
      <text x="${x + 24}" y="${y + 306}" font-family="${SANS}" font-size="16" fill="#fff" opacity=".7">${esc(c.geo ? `${c.geo} · ${c.rateNote}`.slice(0, 44) : c.rateNote)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${KIT_W}" height="${KIT_H}" viewBox="0 0 ${KIT_W} ${KIT_H}">
  <defs><radialGradient id="glowB" cx="10%" cy="0%" r="80%"><stop offset="0" stop-color="${LIME}" stop-opacity=".45"/><stop offset="1" stop-color="#f7f5f0" stop-opacity="0"/></radialGradient></defs>
  <rect width="100%" height="100%" fill="#f7f5f0"/><rect width="100%" height="100%" fill="url(#glowB)"/>
  ${header("B", "Your exposure opportunity", d, false)}
  ${pill(232, 268, "Network figures / targets", "#e0f2fe", "#0c4a6e")}
  <text x="72" y="384" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="2" fill="${NAVY}">1 · ANCHOR HUBS (UNCONFIRMED)</text>
  <text x="1128" y="384" text-anchor="end" font-family="${SANS}" font-size="16" fill="${NAVY}" opacity=".6">${esc(d.fitHeader)}</text>
  ${hubCards}
  <rect x="72" y="824" width="1056" height="110" rx="24" fill="${NAVY}"/>
  <text x="104" y="870" font-family="${SANS}" font-size="18" font-weight="700" letter-spacing="2" fill="${LIME}">HUB RATES · ESTIMATE</text>
  <text x="104" y="906" font-family="${SANS}" font-size="28" font-weight="700" fill="#fff">CPM $${d.hubRates.cpm[0]}–$${d.hubRates.cpm[1]} · CPC $${d.hubRates.cpc[0].toFixed(2)}–$${d.hubRates.cpc[1].toFixed(2)} USD</text>
  <text x="1096" y="906" text-anchor="end" font-family="${SANS}" font-size="20" fill="${LIME}">${esc(d.hubRates.fitLabel ? `Hubs: ${d.hubRates.fitLabel}` : ">20MM unique customers (network figure)")}</text>
  <text x="72" y="990" font-family="${SANS}" font-size="22" font-weight="700" letter-spacing="2" fill="${NAVY}">2 · CALM JOINTS + STREET TEAM   3 · RETAIL NETWORK</text>
  ${chCards}
  ${wrap(KIT_FIT_FINE, 120)
    .map((l, k) => `<text x="72" y="${1410 + k * 24}" font-family="${SANS}" font-size="16" fill="${NAVY}" opacity=".7">${esc(l)}</text>`)
    .join("")}
  <text x="72" y="1540" font-family="${SANS}" font-size="15" fill="${NAVY}" opacity=".55">Rates: Birch rate card starter ranges (illustrative 2026 planning estimates). Street Team image: day-1 route areas, area-level only.</text>
</svg>`;
}

function wrap(s: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of s.split(" ")) {
    if ((line + " " + w).trim().length > max) {
      out.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

/* ---------------------------------- export ---------------------------------- */

async function svgToCanvas(svg: string, scale = 1): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.decoding = "async";
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg_load"));
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = KIT_W * scale;
    c.height = KIT_H * scale;
    const ctx = c.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function kitPngBlob(sides: string[]): Promise<Blob> {
  const canvases = await Promise.all(sides.map((s) => svgToCanvas(s, 1)));
  const out = document.createElement("canvas");
  const gap = 40;
  out.width = KIT_W * canvases.length + gap * (canvases.length + 1);
  out.height = KIT_H + gap * 2;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#e8e6e1";
  ctx.fillRect(0, 0, out.width, out.height);
  canvases.forEach((c, i) => ctx.drawImage(c, gap + i * (KIT_W + gap), gap));
  return new Promise((res) => out.toBlob((b) => res(b!), "image/png"));
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Minimal PDF: one full-bleed JPEG per page (3:4 page, 612×816 pt). */
export function pdfFromJpegs(pages: Array<{ jpeg: Uint8Array; w: number; h: number }>): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array | string) => {
    const u = typeof b === "string" ? enc.encode(b) : b;
    chunks.push(u);
    len += u.length;
  };
  const obj = (id: number, body: () => void) => {
    offsets[id] = len;
    push(`${id} 0 obj\n`);
    body();
    push("\nendobj\n");
  };
  const PW = 612, PH = 816;
  const n = pages.length;
  // ids: 1 catalog, 2 pages, then per page: page, content, image
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
  pages.forEach((p, i) => {
    const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
    const content = `q ${PW} 0 0 ${PH} 0 0 cm /Im${i} Do Q`;
    obj(cid, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    obj(iid, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      push("\nendstream");
    });
  });
  const total = 3 + n * 3;
  const xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info << /Title (Birch Reserve media kit) /Producer (Birch Reserve) >> >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

export async function kitPdfBlob(sides: string[]): Promise<Blob> {
  const pages = [];
  for (const s of sides) {
    const c = await svgToCanvas(s, 1.5);
    const b64 = c.toDataURL("image/jpeg", 0.92).split(",")[1]!;
    pages.push({ jpeg: b64ToBytes(b64), w: c.width, h: c.height });
  }
  return pdfFromJpegs(pages);
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export async function imageToDataUrl(src: string): Promise<string | undefined> {
  try {
    const r = await fetch(src);
    if (!r.ok) return undefined;
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => res(undefined);
      fr.readAsDataURL(b);
    });
  } catch {
    return undefined;
  }
}
