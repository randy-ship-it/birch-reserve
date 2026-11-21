/** Dependency-light QR rendering: SVG for pages, PNG (greyscale, zlib) for phones and print. */
import { deflateSync } from "node:zlib";
import qrcode from "qrcode-generator";

function matrix(text: string): boolean[][] {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

export function qrSvg(text: string, px = 320): string {
  const m = matrix(text);
  const n = m.length + 8;
  let d = "";
  m.forEach((row, r) => row.forEach((on, c) => on && (d += `M${c + 4} ${r + 4}h1v1h-1z`)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#071A39"/></svg>`;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Buffer) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function qrPng(text: string, scale = 12): Buffer {
  const m = matrix(text);
  const size = (m.length + 8) * scale;
  const raw = Buffer.alloc((size + 1) * size, 255);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size + 1)] = 0;
    const r = Math.floor(y / scale) - 4;
    for (let x = 0; x < size; x += 1) {
      const c = Math.floor(x / scale) - 4;
      if (r >= 0 && c >= 0 && r < m.length && c < m.length && m[r]![c]) raw[y * (size + 1) + 1 + x] = 0x10;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
