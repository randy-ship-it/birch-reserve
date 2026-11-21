/**
 * Creative spec standard: format table, server-side upload checks (type sniffing, weight, size, shape, video length,
 * codec, fast start, colour, copy), browser-made variants, format-aware serving, Range for video, the public /ads/specs
 * and /ads/hub-kit pages, and the embed's drop-in contract. PGlite, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { sniffImage } from "../src/lib/buyFlow";
import { FORMATS, COPY, checkUpload, checkVariant, fitsPlacement, formatsForPlacement, matchFormat, templateSvg, MAX_IMAGE_BYTES } from "../src/lib/adserver/creativeSpec";
import { PLACEMENTS } from "../src/lib/adserver/config";
import * as store from "../src/lib/adserver/store";
import { resetServeCacheForTests, serve } from "../src/lib/adserver/service";
import { sign } from "../src/lib/adserver/auth";
import { EMBED_JS } from "../src/lib/adserver/embed";
import { CREATIVE_UPLOAD_JS } from "../src/lib/adserver/creativeUploadJs";
import { specsPage, hubKitPage } from "../src/lib/adserver/specsPage";

const FIX = path.resolve(process.cwd(), "tests/fixtures/creative");
const fx = (n: string) => readFileSync(path.join(FIX, n));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const png = (w: number, h: number, pad = 0) => { const b = Buffer.alloc(33 + pad); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const webp = (w: number, h: number) => { const b = Buffer.alloc(30); b.write("RIFF", 0); b.write("WEBP", 8); b.write("VP8X", 12); b.writeUIntLE(w - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };
const ALT = { alt: "Recovery cream, 20% off" };

test("format table: unique keys, distinct shapes per kind, every placement has a still format, templates match", () => {
  assert.equal(new Set(FORMATS.map((f) => f.key)).size, FORMATS.length);
  for (const f of FORMATS) {
    assert.equal(f.upload[0] / f.upload[1], f.size[0] / f.size[1], `${f.key} upload keeps the shape`);
    assert.ok(f.min[0] <= f.upload[0] && f.min[1] <= f.upload[1], f.key);
    assert.equal(matchFormat(f.kind, f.upload[0], f.upload[1])?.key, f.key, `${f.key} matches itself`);
    const svg = templateSvg(f);
    assert.match(svg, new RegExp(`width="${f.upload[0]}" height="${f.upload[1]}"`));
    assert.doesNotMatch(svg, /<script|on\w+=/i);
    const p = sniffImage(readFileSync(path.resolve(process.cwd(), `../clinichub-media/public/ads-specs/templates/${f.key}.png`)));
    assert.deepEqual([p?.width, p?.height], [...f.upload], `${f.key}.png is ${f.upload.join("x")} (run scripts/gen-creative-templates.sh)`);
  }
  for (const p of PLACEMENTS) assert.ok(formatsForPlacement(p).some((f) => f.kind === "image"), p);
  assert.equal(fitsPlacement(null, "landing"), true); // legacy creatives fit anywhere
  assert.equal(fitsPlacement("leaderboard", "post_purchase"), false);
});

test("upload check: real type from bytes, shapes, weight, colour, friendly errors", () => {
  for (const f of FORMATS.filter((x) => x.kind === "image")) {
    const r = checkUpload(png(...f.upload), ALT);
    assert.ok(r.ok && r.value.format === f.key && r.value.warnings.length === 0, f.key);
  }
  const soft = checkUpload(png(600, 400), ALT); // 1x card: accepted with a retina tip
  assert.ok(soft.ok && soft.value.format === "card" && /2×/.test(soft.value.warnings.join(" ")));
  const odd = checkUpload(png(1000, 1000), ALT);
  assert.ok(!odd.ok && /doesn't match a slot shape/.test(odd.error) && /1200×800/.test(odd.error));
  assert.equal(checkUpload(png(1000, 1000), ALT, { force: true }).ok, true); // admin override
  const small = checkUpload(png(300, 200), ALT);
  assert.ok(!small.ok && /too small for a sponsored card/.test(small.error));
  assert.ok(!checkUpload(png(5000, 1250), ALT).ok);
  const big = checkUpload(png(1200, 800, MAX_IMAGE_BYTES), ALT);
  assert.ok(!big.ok && /limit is 2 MB/.test(big.error));
  const svg = checkUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), ALT);
  assert.ok(!svg.ok && /SVG/.test(svg.error));
  assert.ok(!checkUpload(Buffer.from("not an image at all, just text bytes"), ALT).ok);
  assert.ok(!checkUpload(Buffer.alloc(0), ALT).ok);
  const cmyk = checkUpload(fx("cmyk-card.jpg"), ALT);
  assert.ok(!cmyk.ok && /CMYK/.test(cmyk.error));
  assert.equal(checkUpload(fx("card.jpg"), ALT).ok, true);
  const avif = checkUpload(fx("splash.avif"), ALT);
  assert.ok(avif.ok && avif.value.mime === "image/avif" && avif.value.format === "splash");
  assert.ok(checkUpload(fx("splash.webp"), ALT).ok);
});

test("upload check: copy fields (alt required, headline length, CTA from the list)", () => {
  const noAlt = checkUpload(png(1200, 800), {});
  assert.ok(!noAlt.ok && noAlt.field === "alt");
  assert.ok(!checkUpload(png(1200, 800), { alt: "x".repeat(COPY.alt.max + 1) }).ok);
  const longH = checkUpload(png(1200, 800), { ...ALT, headline: "h".repeat(41) });
  assert.ok(!longH.ok && longH.field === "headline");
  const badCta = checkUpload(png(1200, 800), { ...ALT, cta: "Buy before it's gone!!!" });
  assert.ok(!badCta.ok && badCta.field === "cta");
  const ok = checkUpload(png(1200, 800), { ...ALT, headline: "  Calm   in 10 minutes ", cta: "shop now" });
  assert.ok(ok.ok && ok.value.headline === "Calm in 10 minutes" && ok.value.cta === "Shop now");
});

test("upload check: video length, codec, fast start, shape", () => {
  const v = checkUpload(fx("vertical-4s.mp4"), ALT);
  assert.ok(v.ok && v.value.kind === "video" && v.value.format === "video_vertical" && v.value.durationMs === 4000);
  const w = checkUpload(fx("webm-landscape-4s.webm"), ALT);
  assert.ok(w.ok && w.value.mime === "video/webm" && w.value.format === "video_landscape" && w.value.warnings.length > 0);
  for (const [file, re] of [["short-2s.mp4", /at least 3 seconds/], ["long-20s.mp4", /15 seconds or less/], ["hevc.mp4", /HEVC/], ["slow-start.mp4", /faststart/], ["square.mp4", /doesn't match a slot shape/]] as const) {
    const r = checkUpload(fx(file), ALT);
    assert.ok(!r.ok && re.test(r.error), `${file}: ${r.ok ? "accepted" : r.error}`);
  }
});

test("variants: right type, same shape, never bigger; posters only for video", () => {
  const parent = { kind: "image", width: 1200, height: 800 };
  assert.ok(checkVariant(webp(600, 400), "webp", parent).ok);
  assert.ok(!checkVariant(webp(600, 400), "avif", parent).ok);
  assert.ok(!checkVariant(webp(2400, 1600), "webp", parent).ok);
  assert.ok(!checkVariant(webp(600, 600), "webp", parent).ok);
  assert.ok(!checkVariant(png(600, 400), "poster", parent).ok);
  assert.ok(checkVariant(png(720, 1280), "poster", { kind: "video", width: 720, height: 1280 }).ok);
});

test("serving: format-aware pick, variants and poster in the response, drop-in fmt filter, Range for video, upload routes", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_spec_test");
  resetServeCacheForTests();
  const now = Date.now();
  await store.upsertContractHub({ key: "spec-qa", name: "Spec QA", category: "Recovery", url: "https://example.com/qa", partner: "Spec QA", contractRef: "QA", status: "live", isTest: true }, "test");
  const { campaign } = await store.createCampaign({ accountEmail: "buyer@brand.test", brand: "Spec Brand", orderRef: "cs_test_spec", orderKind: "test", budgetMicros: 100_000_000, currency: "usd", primaryPlacement: "post_purchase", hubs: ["spec-qa"], isTest: true, actor: "test" });
  await store.updateCampaign(campaign.id, { status: "active", flightStart: new Date(now - 864e5), flightEnd: new Date(now + 9 * 864e5), clickUrl: "https://brand.test/x" }, "test");
  const leader = await store.addCreative({ campaignId: campaign.id, mime: "image/png", width: 1456, height: 180, data: png(1456, 180), alt: "Leaderboard", uploadedBy: "t", status: "approved", kind: "image", format: "leaderboard" });
  const splash = await store.addCreative({ campaignId: campaign.id, mime: "image/png", width: 1312, height: 560, data: png(1312, 560), alt: "Splash", uploadedBy: "t", status: "approved", kind: "image", format: "splash", headline: "Calm in 10 minutes", cta: "Shop now" });
  await store.addVariant({ creativeId: splash.id, role: "webp", mime: "image/webp", width: 656, height: 280, data: webp(656, 280), actor: "t" });
  for (let i = 0; i < 5; i++) {
    resetServeCacheForTests();
    const r = await serve({ slot: "spec-qa.post_purchase", ua: UA, origin: "https://birchreserve.net", now, test: true });
    assert.ok(r.fill, "fills");
    if (!r.fill) continue;
    assert.equal(r.creative.format, "splash"); // the leaderboard is not made for post-purchase
    assert.equal(r.creative.sources.length, 1);
    assert.equal(r.creative.sources[0]!.type, "image/webp");
    assert.equal(r.creative.headline, "Calm in 10 minutes");
    assert.equal(r.creative.cta, "Shop now");
  }
  resetServeCacheForTests();
  const none = await serve({ slot: "spec-qa.post_purchase", ua: UA, origin: "https://birchreserve.net", now, test: true, formats: ["video_vertical"] });
  assert.equal(none.fill, false); // drop-in slot that only takes vertical video
  resetServeCacheForTests();
  const lb = await serve({ slot: "spec-qa.post_purchase", ua: UA, origin: "https://birchreserve.net", now, test: true, formats: ["leaderboard"] });
  assert.ok(lb.fill && lb.creative.format === "leaderboard" && lb.creative.sources.length === 0);
  void leader;

  // HTTP: routes on an ephemeral port.
  const { default: router } = await import("../src/routes/adserver");
  const app = express();
  app.use(router);
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  try {
    const cookie = `br_ads_acct=${encodeURIComponent(sign("a", { e: "buyer@brand.test" }, 3600_000))}`;
    const up = (q: string, body: Buffer, type: string) => fetch(`${base}/account/creative?campaign=${campaign.id}&${q}`, { method: "POST", headers: { cookie, "content-type": type, "sec-fetch-site": "same-origin" }, body });
    let r = await up("alt=", png(1200, 800), "image/png");
    assert.equal(r.status, 400);
    assert.match(((await r.json()) as { message: string }).message, /alt text/i);
    r = await up("alt=Card%20ad", png(1000, 1000), "image/png");
    assert.equal(r.status, 400);
    r = await up("alt=Vertical%20video%20ad", fx("vertical-4s.mp4"), "video/mp4");
    const vj = (await r.json()) as { ok: boolean; id: string; kind: string; format: string };
    assert.equal(r.status, 200);
    assert.equal(vj.kind, "video");
    assert.equal(vj.format, "video_vertical");
    r = await up("alt=Too%20big", Buffer.alloc(5 * 1024 * 1024, 1), "video/mp4");
    assert.equal(r.status, 413);
    // Poster variant by the buyer while pending, then Range on the video bytes.
    r = await fetch(`${base}/account/creative/${vj.id}/variant?role=poster`, { method: "POST", headers: { cookie, "content-type": "image/png", "sec-fetch-site": "same-origin" }, body: png(720, 1280) });
    assert.equal(r.status, 200);
    r = await fetch(`${base}/account/creative/${vj.id}/variant?role=webp`, { method: "POST", headers: { cookie, "content-type": "image/webp", "sec-fetch-site": "same-origin" }, body: webp(360, 640) });
    assert.equal(r.status, 400); // videos don't take image variants
    r = await fetch(`${base}/v1/ads/cr/${vj.id}`, { headers: { cookie, range: "bytes=0-99" } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get("content-range"), `bytes 0-99/${fx("vertical-4s.mp4").length}`);
    assert.equal((await r.arrayBuffer()).byteLength, 100);
    r = await fetch(`${base}/v1/ads/cr/${vj.id}`); // pending: hidden from the public
    assert.equal(r.status, 404);
    // Public pages and templates.
    r = await fetch(`${base}/ads/specs`);
    assert.equal(r.status, 200);
    r = await fetch(`${base}/ads/specs/templates/card.svg`);
    assert.equal(r.headers.get("content-type")?.startsWith("image/svg+xml"), true);
    assert.equal((await fetch(`${base}/ads/specs/templates/nope.svg`)).status, 404);
    r = await fetch(`${base}/ads/hub-kit`);
    assert.equal(r.headers.get("x-robots-tag"), "noindex");
  } finally {
    srv.close();
  }
  assert.equal(await store.purgeTestCampaign(campaign.id, "test"), true);
  assert.equal((await store.listVariants([splash.id])).length, 0);
  store.setAdPoolForTests(null);
});

test("public pages: specs + hub kit follow the visitor copy rules and the drop-in contract", () => {
  const banned = /\bAlign\b|Clairvoyant|MedVibe|\bFriday\b|80 locations|signed partner|forecast|guarantee(d)? (impressions|clicks|results|sales)|\bROAS\b|\bCTR\b|Calm Joints|DR-HO|\bCAD\b/i;
  for (const skin of ["birch", "scale"] as const) {
    const s = specsPage({ skin });
    const k = hubKitPage({ skin });
    for (const html of [s, k]) {
      const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/g, " ");
      assert.doesNotMatch(text, banned, skin);
      assert.match(text, /No impression/);
    }
    for (const f of FORMATS) assert.ok(s.includes(`${f.upload[0]}×${f.upload[1]}`), f.key);
    assert.match(k, /data-br-slot=&quot;HUB\.dashboard&quot;/);
    assert.match(k, /br_ads=test/);
    assert.match(k, /media-src/);
  }
  assert.match(specsPage({ skin: "scale" }), /SCALE HEALTH/);
  assert.match(specsPage({ skin: "scale" }), /rel="canonical" href="https:\/\/birchreserve\.net\/ads\/specs"/);
});

test("embed v2: drop-in attributes, test mode from the page URL, video muted/playsinline/poster, no cookies; upload JS parses", () => {
  new Function(EMBED_JS);
  new Function(CREATIVE_UPLOAD_JS);
  for (const needle of ["data-br-format", "data-br-reserve", "data-br-text", "br_ads=test", "playsinline", "prefers-reduced-motion", "poster", "<picture>".slice(1, 8), "srcset", "aspect-ratio"]) assert.ok(EMBED_JS.includes(needle), needle);
  assert.doesNotMatch(EMBED_JS, /document\.cookie/);
  assert.match(EMBED_JS, /"video_vertical":\[360,640\]/);
});

test("1200×628 (1.91:1) matches the landscape format and fits landing + dashboard", async () => {
  const { matchFormat, fitsPlacement } = await import("../src/lib/adserver/creativeSpec");
  assert.equal(matchFormat("image", 1200, 628)?.key, "landscape");
  assert.equal(matchFormat("image", 1280, 640)?.key, "hero_phone");
  assert.ok(fitsPlacement("landscape", "landing") && fitsPlacement("landscape", "dashboard"));
});
