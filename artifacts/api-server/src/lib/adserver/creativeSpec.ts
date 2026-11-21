/**
 * Creative spec standard for the ad machine (Randy voice, Nov 21 2026 2:37 PM ET). Single source of truth:
 * upload validation (/account, /ads/admin), the public /ads/specs page, the downloadable templates, the embed's
 * format choice and docs/ads/CREATIVE-SPECS.md all read from here. Pure module: no Node-only or DB imports
 * besides Buffer.
 *
 * Basis: IAB New Ad Portfolio + LEAN (file weight, 50%/1s display and 50%/2s video viewability), Google Display
 * and Meta creative guidance (2x assets, short muted video with captions, sRGB), adapted to the slots the embed
 * actually renders today. No performance claims live here.
 */
import { sniffImage } from "../buyFlow";
import type { Placement } from "./config";

export type CreativeKind = "image" | "video";
export type FormatKey = "hero_wide" | "hero_phone" | "leaderboard" | "splash" | "vertical" | "card" | "mrec" | "video_vertical" | "video_landscape";

export type CreativeFormat = {
  key: FormatKey;
  kind: CreativeKind;
  label: string;
  /** Display size in CSS px (1x). The embed renders at the container width, never wider than the file. */
  size: readonly [number, number];
  ratio: string;
  /** What to export: 2x the display size (sharp on retina / phone screens). */
  upload: readonly [number, number];
  /** Smallest file we accept for this format. */
  min: readonly [number, number];
  placements: readonly Placement[];
  where: string;
  /** Keep logos, text and the offer inside this inset (CSS px at 1x) from every edge. */
  safe: number;
  /** Recommended weight; the hard cap is MAX_IMAGE_BYTES / MAX_VIDEO_BYTES. */
  targetBytes: number;
};

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Vercel functions take request bodies up to 4.5 MB, so the video cap sits under it. */
export const MAX_VIDEO_BYTES = 4 * 1024 * 1024;
export const MAX_SIDE_PX = 4000;
export const RATIO_TOLERANCE = 0.02;
export const VIDEO_SECONDS = { min: 3, max: 15, ideal: [6, 10] as const };
export const VIDEO_VIEWABILITY_MS = 2000; // IAB/MRC video: 50% in view for 2 continuous seconds
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const VARIANT_ROLES = ["webp", "avif", "poster"] as const;
export type VariantRole = (typeof VARIANT_ROLES)[number];
export const MAX_VARIANTS = 8;

export const COPY = {
  alt: { min: 5, max: 125 },
  headline: { max: 40 },
  cta: ["Shop now", "Learn more", "Book now", "Get offer", "See how", "Try it"] as const,
} as const;

const KB = 1024;
export const FORMATS: readonly CreativeFormat[] = [
  { key: "hero_wide", kind: "image", label: "Wide banner", size: [1200, 300], ratio: "4:1", upload: [2400, 600], min: [1200, 300], placements: ["landing"], where: "Top of the hub home page (desktop and tablet).", safe: 24, targetBytes: 150 * KB },
  { key: "hero_phone", kind: "image", label: "Phone banner", size: [640, 320], ratio: "2:1", upload: [1280, 640], min: [640, 320], placements: ["landing", "dashboard"], where: "Hub home on phones, and the member dashboard.", safe: 20, targetBytes: 150 * KB },
  { key: "leaderboard", kind: "image", label: "Leaderboard", size: [728, 90], ratio: "728:90", upload: [1456, 180], min: [728, 90], placements: ["landing"], where: "Partner pages with a classic banner row (IAB 728×90).", safe: 8, targetBytes: 150 * KB },
  { key: "splash", kind: "image", label: "Thank-you splash", size: [656, 280], ratio: "82:35", upload: [1312, 560], min: [656, 280], placements: ["post_purchase"], where: "Order and booking confirmation pages, right after a member pays.", safe: 20, targetBytes: 300 * KB },
  { key: "vertical", kind: "image", label: "Vertical", size: [360, 640], ratio: "9:16", upload: [1080, 1920], min: [360, 640], placements: ["post_purchase", "dashboard"], where: "Full-height card on phones after checkout and on hub screens.", safe: 24, targetBytes: 500 * KB },
  { key: "card", kind: "image", label: "Sponsored card", size: [600, 400], ratio: "3:2", upload: [1200, 800], min: [600, 400], placements: ["dashboard", "products", "services"], where: "Member dashboard tile, product and booking pages.", safe: 20, targetBytes: 300 * KB },
  { key: "mrec", kind: "image", label: "Medium rectangle", size: [300, 250], ratio: "6:5", upload: [600, 500], min: [300, 250], placements: ["products", "services"], where: "Sidebar or in-list unit on product and booking pages (IAB 300×250).", safe: 10, targetBytes: 150 * KB },
  { key: "video_vertical", kind: "video", label: "Vertical video", size: [360, 640], ratio: "9:16", upload: [1080, 1920], min: [720, 1280], placements: ["post_purchase", "dashboard"], where: "Hub screens and phones: thank-you page and member dashboard.", safe: 24, targetBytes: 3 * 1024 * KB },
  { key: "video_landscape", kind: "video", label: "Landscape video", size: [640, 360], ratio: "16:9", upload: [1920, 1080], min: [1280, 720], placements: ["landing", "products", "services"], where: "Hub home, product and booking pages, partner pages.", safe: 24, targetBytes: 3 * 1024 * KB },
] as const;

export const findFormat = (key: string | null | undefined): CreativeFormat | undefined => FORMATS.find((f) => f.key === key);
export const formatsForPlacement = (p: Placement): CreativeFormat[] => FORMATS.filter((f) => f.placements.includes(p));
/** A creative with no format (uploaded before the standard) fits anywhere: the embed renders any shape without cropping. */
export const fitsPlacement = (format: string | null | undefined, p: Placement): boolean => !format || Boolean(findFormat(format)?.placements.includes(p));

/** Best format for a shape: same kind, aspect ratio within 2%. */
export function matchFormat(kind: CreativeKind, w: number, h: number): CreativeFormat | undefined {
  if (!w || !h) return undefined;
  const r = w / h;
  let best: { f: CreativeFormat; d: number } | undefined;
  for (const f of FORMATS) {
    if (f.kind !== kind) continue;
    const d = Math.abs(r / (f.size[0] / f.size[1]) - 1);
    if (d <= RATIO_TOLERANCE && (!best || d < best.d)) best = { f, d };
  }
  return best?.f;
}

const sizeList = (kind: CreativeKind) => FORMATS.filter((f) => f.kind === kind).map((f) => `${f.upload[0]}×${f.upload[1]}`).join(", ");
const mb = (n: number) => `${Math.round((n / 1024 / 1024) * 10) / 10} MB`;

/* ------------------------------------------------------------------ sniffing */
export type Sniffed =
  | { kind: "image"; mime: (typeof IMAGE_TYPES)[number]; width: number; height: number }
  | { kind: "video"; mime: (typeof VIDEO_TYPES)[number]; width: number; height: number; durationMs: number; codec: string; faststart: boolean };

/** AVIF: ftyp brand avif/avis, size from the first ispe box. */
function sniffAvif(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 32 || buf.toString("ascii", 4, 8) !== "ftyp") return null;
  const ftypLen = buf.readUInt32BE(0);
  const brands = buf.toString("ascii", 8, Math.min(ftypLen, 64));
  if (!/avi[fs]/.test(brands)) return null;
  const at = buf.indexOf("ispe", 0, "ascii");
  if (at < 0 || at + 16 > buf.length) return { width: 0, height: 0 };
  return { width: buf.readUInt32BE(at + 8), height: buf.readUInt32BE(at + 12) };
}

type Box = { type: string; start: number; end: number; body: number };
function boxes(buf: Buffer, from: number, to: number): Box[] {
  const out: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    let size = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    let body = i + 8;
    if (size === 1 && i + 16 <= to) {
      size = Number(buf.readBigUInt64BE(i + 8));
      body = i + 16;
    } else if (size === 0) size = to - i;
    if (size < 8 || i + size > to + 0) {
      if (i + size > to && type === "mdat") out.push({ type, start: i, end: to, body }); // truncated mdat is fine for sniffing
      break;
    }
    out.push({ type, start: i, end: i + size, body });
    i += size;
  }
  return out;
}
const child = (buf: Buffer, b: Box | undefined, type: string, skip = 0) => (b ? boxes(buf, b.body + skip, b.end).find((x) => x.type === type) : undefined);

function sniffMp4(buf: Buffer): Extract<Sniffed, { kind: "video" }> | null {
  if (buf.length < 16 || buf.toString("latin1", 4, 8) !== "ftyp") return null;
  const brands = buf.toString("latin1", 8, Math.min(buf.readUInt32BE(0), 64));
  if (/avi[fs]|heic|heix|mif1/.test(brands) && !/isom|mp4[12]|avc1|iso[2-9]|M4V|dash/.test(brands)) return null;
  const top = boxes(buf, 0, buf.length);
  const moov = top.find((b) => b.type === "moov");
  if (!moov) return { kind: "video", mime: "video/mp4", width: 0, height: 0, durationMs: 0, codec: "", faststart: false };
  const mdat = top.find((b) => b.type === "mdat");
  const faststart = !mdat || moov.start < mdat.start;
  let durationMs = 0;
  const mvhd = child(buf, moov, "mvhd");
  if (mvhd) {
    const v = buf[mvhd.body]!;
    const ts = v === 1 ? buf.readUInt32BE(mvhd.body + 20) : buf.readUInt32BE(mvhd.body + 12);
    const dur = v === 1 ? Number(buf.readBigUInt64BE(mvhd.body + 24)) : buf.readUInt32BE(mvhd.body + 16);
    if (ts > 0) durationMs = Math.round((dur / ts) * 1000);
  }
  let width = 0, height = 0, codec = "";
  for (const trak of boxes(buf, moov.body, moov.end).filter((b) => b.type === "trak")) {
    const mdia = child(buf, trak, "mdia");
    const hdlr = child(buf, mdia, "hdlr");
    if (!hdlr || buf.toString("latin1", hdlr.body + 8, hdlr.body + 12) !== "vide") continue;
    const tkhd = child(buf, trak, "tkhd");
    if (tkhd) {
      const v = buf[tkhd.body]!;
      const off = tkhd.body + (v === 1 ? 88 : 76);
      if (off + 8 <= tkhd.end) {
        width = Math.round(buf.readUInt32BE(off) / 65536);
        height = Math.round(buf.readUInt32BE(off + 4) / 65536);
      }
    }
    const stsd = child(buf, child(buf, child(buf, mdia, "minf"), "stbl"), "stsd");
    if (stsd && stsd.body + 16 <= stsd.end) codec = buf.toString("latin1", stsd.body + 12, stsd.body + 16);
    break;
  }
  return { kind: "video", mime: "video/mp4", width, height, durationMs, codec, faststart };
}

/* WebM / Matroska (EBML). Lenient walk: Segment → Info (TimecodeScale, Duration) and Tracks → Video (PixelWidth/Height). */
function vint(buf: Buffer, i: number, keepMarker: boolean): { v: number; len: number } | null {
  const b = buf[i];
  if (b === undefined || b === 0) return null;
  let len = 1;
  while (len <= 8 && !(b & (0x80 >> (len - 1)))) len++;
  if (len > 8 || i + len > buf.length) return null;
  let v = keepMarker ? b : b & (0xff >> len);
  for (let k = 1; k < len; k++) v = v * 256 + buf[i + k]!;
  return { v, len };
}
function sniffWebm(buf: Buffer): Extract<Sniffed, { kind: "video" }> | null {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x1a45dfa3) return null;
  const out = { kind: "video" as const, mime: "video/webm" as const, width: 0, height: 0, durationMs: 0, codec: "", faststart: true };
  let scale = 1_000_000, dur = 0, isWebm = false;
  const CONTAINERS = new Set([0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0xe0, 0x1a45dfa3]);
  const walk = (from: number, to: number, depth: number) => {
    let i = from;
    while (i < to && depth < 8) {
      const id = vint(buf, i, true);
      if (!id) return;
      const sz = vint(buf, i + id.len, false);
      if (!sz) return;
      const body = i + id.len + sz.len;
      const unknown = sz.v === Math.pow(2, 7 * sz.len) - 1;
      const end = unknown ? to : Math.min(to, body + sz.v);
      if (CONTAINERS.has(id.v)) walk(body, end, depth + 1);
      else if (id.v === 0x4282) isWebm = buf.toString("ascii", body, end).startsWith("webm");
      else if (id.v === 0x2ad7b1) { let n = 0; for (let k = body; k < end; k++) n = n * 256 + buf[k]!; scale = n || scale; }
      else if (id.v === 0x4489) dur = end - body === 8 ? buf.readDoubleBE(body) : end - body === 4 ? buf.readFloatBE(body) : 0;
      else if (id.v === 0xb0) { let n = 0; for (let k = body; k < end; k++) n = n * 256 + buf[k]!; if (!out.width) out.width = n; }
      else if (id.v === 0xba) { let n = 0; for (let k = body; k < end; k++) n = n * 256 + buf[k]!; if (!out.height) out.height = n; }
      else if (id.v === 0x86 && !out.codec) { const c = buf.toString("ascii", body, end); if (c.startsWith("V_")) out.codec = c; }
      else if (id.v === 0x1f43b675) return; // first Cluster: headers are done
      if (unknown && !CONTAINERS.has(id.v)) return;
      i = end;
    }
  };
  walk(0, buf.length, 0);
  if (!isWebm) return null;
  out.durationMs = Math.round((dur * scale) / 1_000_000);
  return out;
}

export function sniffMedia(buf: Buffer): Sniffed | null {
  const img = sniffImage(buf);
  if (img) return { kind: "image", ...img };
  const avif = sniffAvif(buf);
  if (avif) return { kind: "image", mime: "image/avif", ...avif };
  return sniffMp4(buf) ?? sniffWebm(buf);
}

/** CMYK JPEGs render wrong in browsers; wide-gamut ICC profiles shift colour on sRGB screens. */
export function colourIssue(buf: Buffer, mime: string): "cmyk" | "wide-gamut" | null {
  if (mime === "image/jpeg") {
    let i = 2;
    while (i + 9 < buf.length && buf[i] === 0xff) {
      const m = buf[i + 1]!;
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return buf[i + 9] === 4 ? "cmyk" : wide(buf.subarray(0, i));
      i += 2 + len;
    }
    return wide(buf.subarray(0, Math.min(buf.length, 65536)));
  }
  if (mime === "image/png" || mime === "image/webp" || mime === "image/avif") return wide(buf.subarray(0, Math.min(buf.length, 65536)));
  return null;
}
function wide(head: Buffer): "wide-gamut" | null {
  const s = head.toString("latin1");
  return /Adobe RGB|ProPhoto|Display P3|DCI-P3|Rec\.? ?2020|BT\.?2020/i.test(s) ? "wide-gamut" : null;
}

/* ------------------------------------------------------------------ validation */
export type UploadMeta = { alt?: unknown; headline?: unknown; cta?: unknown; declaredType?: string | null };
export type CheckedCreative = {
  kind: CreativeKind; mime: string; width: number; height: number; bytes: number; format: FormatKey | null;
  durationMs: number | null; alt: string; headline: string | null; cta: string | null; warnings: string[];
};
export type Checked = { ok: true; value: CheckedCreative } | { ok: false; error: string; field?: string };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

/** Copy fields: alt text is required; headline and CTA are optional. */
export function checkCopy(meta: UploadMeta): { ok: true; alt: string; headline: string | null; cta: string | null } | { ok: false; error: string; field: string } {
  const alt = clean(meta.alt, COPY.alt.max);
  if (alt.length < COPY.alt.min) return { ok: false, field: "alt", error: `Add alt text: say what the ad shows in ${COPY.alt.min}–${COPY.alt.max} characters (screen readers read it out).` };
  if (alt.length > COPY.alt.max) return { ok: false, field: "alt", error: `Alt text is too long. Keep it under ${COPY.alt.max} characters.` };
  const headline = clean(meta.headline, COPY.headline.max);
  if (headline.length > COPY.headline.max) return { ok: false, field: "headline", error: `Headline is too long. Keep it to ${COPY.headline.max} characters.` };
  const ctaRaw = clean(meta.cta, 30);
  const cta = ctaRaw ? COPY.cta.find((c) => c.toLowerCase() === ctaRaw.toLowerCase()) : undefined;
  if (ctaRaw && !cta) return { ok: false, field: "cta", error: `Pick a button label from the list: ${COPY.cta.join(", ")}.` };
  return { ok: true, alt, headline: headline || null, cta: cta ?? null };
}

/**
 * Server-side check of an uploaded creative: real type from the bytes (not the file name or header), weight, pixel size,
 * aspect ratio against the formats, video length and streaming layout, colour space, plus the copy fields.
 * `force` (admin only) accepts a shape that matches no format; type, weight and safety checks still apply.
 */
export function checkUpload(buf: Buffer, meta: UploadMeta = {}, opts: { force?: boolean } = {}): Checked {
  if (!buf.length) return { ok: false, field: "file", error: "Choose an image or video to upload." };
  const m = sniffMedia(buf);
  if (!m) {
    if (/^\s*<(\?xml|svg)/i.test(buf.subarray(0, 256).toString("utf8"))) return { ok: false, field: "file", error: "SVG files can carry scripts, so we don't run them as ads. Export a PNG or WebP instead." };
    if (buf.toString("latin1", 4, 8) === "ftyp" && /heic|heix|mif1|qt {2}/.test(buf.toString("latin1", 8, 32))) return { ok: false, field: "file", error: "That's an iPhone HEIC photo or a MOV video. Export it as JPG/PNG (image) or MP4 (video)." };
    return { ok: false, field: "file", error: "We couldn't read that file. Use JPG, PNG, WebP or AVIF for images, MP4 (H.264) or WebM for video." };
  }
  const copy = checkCopy(meta);
  if (!copy.ok) return copy;
  const warnings: string[] = [];
  if (m.kind === "image") {
    if (buf.length > MAX_IMAGE_BYTES) return { ok: false, field: "file", error: `That image is ${mb(buf.length)}. The limit is 2 MB: export it again as WebP or JPG at quality 80.` };
    if (!m.width || !m.height) return { ok: false, field: "file", error: "We couldn't read the image size. Export it again as PNG, JPG or WebP." };
    if (m.width > MAX_SIDE_PX || m.height > MAX_SIDE_PX) return { ok: false, field: "file", error: `That image is ${m.width}×${m.height}. Keep each side under ${MAX_SIDE_PX} px (2× the slot size is plenty).` };
    const c = colourIssue(buf, m.mime);
    if (c === "cmyk") return { ok: false, field: "file", error: "That JPG is CMYK (print colours). Export it as sRGB so the colours look right on screens." };
    if (c === "wide-gamut") warnings.push("Wide-gamut colour profile found. Export as sRGB so colours match on every screen.");
    if (m.mime === "image/gif") warnings.push("GIF: fine for a still. For motion, a short MP4 is smaller and sharper.");
  } else {
    if (buf.length > MAX_VIDEO_BYTES) return { ok: false, field: "file", error: `That video is ${mb(buf.length)}. The limit is 4 MB: shorten it to 6–10 seconds or export at about 2 Mbps.` };
    if (m.mime === "video/mp4" && m.codec && m.codec !== "avc1" && m.codec !== "avc3") return { ok: false, field: "file", error: `That MP4 uses ${m.codec === "hvc1" || m.codec === "hev1" ? "HEVC (H.265)" : m.codec}, which many browsers can't play. Export it as H.264.` };
    if (m.mime === "video/mp4" && !m.faststart) return { ok: false, field: "file", error: "That MP4 isn't set up to stream (the index is at the end). Re-export with \"Fast start\" / \"Web optimized\" on, or run: ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4" };
    if (!m.width || !m.height) return { ok: false, field: "file", error: "We couldn't read the video size. Export it again as MP4 (H.264)." };
    if (!m.durationMs) return { ok: false, field: "file", error: "We couldn't read how long the video is. Export it again as MP4 (H.264)." };
    const s = m.durationMs / 1000;
    if (s < VIDEO_SECONDS.min - 0.25) return { ok: false, field: "file", error: `That video is ${s.toFixed(1)} seconds. Make it at least ${VIDEO_SECONDS.min} seconds (6–10 is best).` };
    if (s > VIDEO_SECONDS.max + 0.5) return { ok: false, field: "file", error: `That video is ${s.toFixed(1)} seconds. Keep it to ${VIDEO_SECONDS.max} seconds or less (6–10 is best).` };
    if (m.width > MAX_SIDE_PX || m.height > MAX_SIDE_PX) return { ok: false, field: "file", error: `That video is ${m.width}×${m.height}. Export at 1080×1920 (vertical) or 1920×1080 (landscape).` };
    if (m.mime === "video/webm") warnings.push("WebM doesn't play on some iPhones. An MP4 (H.264) copy plays everywhere; the poster shows where WebM can't.");
  }
  const f = matchFormat(m.kind, m.width, m.height);
  if (!f && !opts.force) {
    return { ok: false, field: "file", error: `${m.width}×${m.height} doesn't match a slot shape. Use one of these ${m.kind === "image" ? "image" : "video"} sizes: ${sizeList(m.kind)}. Templates: /ads/specs` };
  }
  if (f && (m.width < f.min[0] || m.height < f.min[1])) {
    return { ok: false, field: "file", error: `${m.width}×${m.height} is too small for a ${f.label.toLowerCase()}. Use at least ${f.min[0]}×${f.min[1]} (best: ${f.upload[0]}×${f.upload[1]}).` };
  }
  if (f && m.width < f.size[0] * 2 && f.kind === "image") warnings.push(`Looks soft on sharp screens. ${f.upload[0]}×${f.upload[1]} (2×) is best.`);
  if (f && buf.length > f.targetBytes) warnings.push(`Heavier than the ${Math.round(f.targetBytes / 1024)} KB target; it will still run, but loads slower on phones.`);
  return {
    ok: true,
    value: { kind: m.kind, mime: m.mime, width: m.width, height: m.height, bytes: buf.length, format: f?.key ?? null, durationMs: m.kind === "video" ? m.durationMs : null, alt: copy.alt, headline: copy.headline, cta: copy.cta, warnings },
  };
}

/** Responsive variant or poster made by the uploader's browser: right type, same shape, never larger than the original. */
export function checkVariant(buf: Buffer, role: VariantRole, parent: { kind: string; width: number; height: number }): { ok: true; value: { mime: string; width: number; height: number; bytes: number } } | { ok: false; error: string } {
  if (!buf.length) return { ok: false, error: "Empty file." };
  if (buf.length > MAX_IMAGE_BYTES) return { ok: false, error: "Variant is over 2 MB." };
  const m = sniffMedia(buf);
  if (!m || m.kind !== "image") return { ok: false, error: "A variant must be an image." };
  if (role === "webp" && m.mime !== "image/webp") return { ok: false, error: "Expected a WebP image." };
  if (role === "avif" && m.mime !== "image/avif") return { ok: false, error: "Expected an AVIF image." };
  if (role === "poster" && parent.kind !== "video") return { ok: false, error: "Only videos take a poster frame." };
  if (role === "poster" && !["image/jpeg", "image/webp", "image/png"].includes(m.mime)) return { ok: false, error: "Poster must be JPG, WebP or PNG." };
  if (role !== "poster" && parent.kind !== "image") return { ok: false, error: "Only images take responsive variants." };
  if (!m.width || !m.height) return { ok: false, error: "Couldn't read the variant size." };
  if (Math.abs(m.width / m.height / (parent.width / parent.height) - 1) > RATIO_TOLERANCE) return { ok: false, error: "Variant shape doesn't match the original." };
  if (m.width > parent.width || m.height > parent.height) return { ok: false, error: "Variant is larger than the original." };
  return { ok: true, value: { mime: m.mime, width: m.width, height: m.height, bytes: buf.length } };
}

/* ------------------------------------------------------------------ templates */
/** Safe-zone overlay (SVG, no scripts): trim box, safe area, label strip note. Same file is converted to PNG for /ads/specs. */
export function templateSvg(f: CreativeFormat): string {
  const [W, H] = f.upload;
  const k = W / f.size[0];
  const s = f.safe * k;
  const line1 = `${f.label} ${W}×${H}`;
  const line2 = `Keep logo, text and offer inside the dashed box (${f.safe * k}px from each edge)`;
  const room = (W - 2 * s) * 0.92;
  const fs = Math.max(14, Math.round(Math.min(H / 5, room / (line1.length * 0.52))));
  const small = Math.max(10, Math.round(Math.min(fs * 0.55, room / (line2.length * 0.5))));
  const title = `${f.label} · ${W}×${H} (${f.ratio}) · export at this size`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>${title}</title>
<rect width="${W}" height="${H}" fill="#F9F8F6"/>
<rect x="${s}" y="${s}" width="${W - 2 * s}" height="${H - 2 * s}" fill="#C8F55A" fill-opacity="0.18" stroke="#071A39" stroke-width="${Math.max(2, Math.round(k))}" stroke-dasharray="${8 * k} ${6 * k}"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="${12 * k}" fill="none" stroke="#071A39" stroke-opacity="0.35" stroke-width="2"/>
<g font-family="Georgia, 'Times New Roman', serif" fill="#071A39" text-anchor="middle">
<text x="${W / 2}" y="${H / 2 - (H > fs * 3 ? fs * 0.2 : 0)}" font-size="${fs}" dominant-baseline="middle">${line1}</text>
${H > fs * 3 ? `<text x="${W / 2}" y="${H / 2 + fs * 0.95}" font-size="${small}" font-family="Arial, sans-serif" fill-opacity="0.75">${line2}</text>` : ""}
</g>
</svg>`;
}
