import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MIRROR_PREFIX, SCALE_FAVICON, mirrorHtml, stripMirrorPrefix } from "../src/middlewares/mirrorHost";

test("mirror prefix: /intake/_m/<path> strips to /<path>, other URLs untouched", () => {
  assert.equal(stripMirrorPrefix("/intake/_m/assets/index-abc.js"), "/assets/index-abc.js");
  assert.equal(stripMirrorPrefix("/intake/_m/v1/brand-intake?x=1"), "/v1/brand-intake?x=1");
  assert.equal(stripMirrorPrefix("/intake/_m"), "/");
  assert.equal(stripMirrorPrefix("/intake/_m?__fresh=1"), "/?__fresh=1");
  assert.equal(stripMirrorPrefix("/intake/_more"), null);
  assert.equal(stripMirrorPrefix("/intake"), null);
  assert.equal(stripMirrorPrefix("/v1/brand-intake"), null);
});

test("mirror shell: boot script first, assets through the prefix, links to Birch, canonical kept", () => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="canonical" href="https://birchreserve.net/intake" /><link rel="icon" href="/favicon.svg?v=3" /><script defer src="/br-t.js"></script><script type="module" crossorigin src="/assets/index-a.js"></script><link rel="stylesheet" href="/assets/index-a.css"><link rel="preconnect" href="https://fonts.googleapis.com"></head><body><a href="/media-kit">kit</a><a href="/intake?ref=nav">go</a><a href="https://scalehealth.ca">s</a><img src="//cdn.example.com/x.png"></body></html>`;
  const out = mirrorHtml(html, "scale_mirror");
  assert.ok(out.indexOf("window.__BR_MIRROR") < out.indexOf("<meta charset"), "boot script runs first");
  assert.match(out, /"src":"scale_mirror"/);
  assert.match(out, new RegExp(`src="${MIRROR_PREFIX}/assets/index-a\\.js"`));
  assert.match(out, new RegExp(`href="${MIRROR_PREFIX}/assets/index-a\\.css"`));
  assert.match(out, new RegExp(`src="${MIRROR_PREFIX}/br-t\\.js"`));
  assert.ok(out.includes(`href="${MIRROR_PREFIX}${SCALE_FAVICON}"`), "scale mirror swaps in Scale's favicon");
  assert.match(out, /<link rel="canonical" href="https:\/\/birchreserve\.net\/intake" \/>/);
  assert.match(out, /<a href="https:\/\/birchreserve\.net\/media-kit">/);
  assert.match(out, /<a href="\/intake\?ref=nav">/);
  assert.match(out, /<a href="https:\/\/scalehealth\.ca">/);
  assert.match(out, /src="\/\/cdn\.example\.com\/x\.png"/);
  assert.match(out, /href="https:\/\/fonts\.googleapis\.com"/);
});

test("scale skin: boot sets data-skin=scale, head re-branded to Scale Health, canonical + form untouched", () => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Get your Monetization Kit | Birch Reserve</title><meta property="og:title" content="Birch Reserve | Ads" /><meta name="twitter:title" content="Birch Reserve | Ads" /><meta name="theme-color" content="#071A39" /><link rel="canonical" href="https://birchreserve.net/intake" /><link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3" /></head><body><form id="f"></form></body></html>`;
  const out = mirrorHtml(html, "scale_mirror");
  assert.match(out, /"skin":"scale"/);
  assert.match(out, /setAttribute\("data-skin",M\.skin\)/);
  assert.match(out, /<title>Get your Monetization Kit \| Scale Health<\/title>/);
  assert.match(out, /og:title" content="Scale Health \| Ads"/);
  assert.match(out, /twitter:title" content="Scale Health \| Ads"/);
  assert.match(out, /theme-color" content="#0d1426"/);
  assert.ok(out.includes(`href="${MIRROR_PREFIX}${SCALE_FAVICON}"`), "Scale favicon through the mirror prefix");
  assert.ok(!out.includes("favicon.svg?v=birch-reserve-3"), "Birch favicon gone on the Scale skin");
  assert.match(out, /Plus\+Jakarta\+Sans/);
  assert.match(out, /<link rel="canonical" href="https:\/\/birchreserve\.net\/intake" \/>/);
  assert.match(out, /<form id="f"><\/form>/, "body (the form) is not touched by the skin");
  assert.match(out, /data-mirror-keep/, "host-site links can opt out of the Birch redirect");
});

test("unknown or no mirror tag: no skin", () => {
  const html = `<html><head><title>X | Birch Reserve</title></head><body></body></html>`;
  assert.ok(!mirrorHtml(html, "other_mirror").includes('"skin"'));
  assert.ok(mirrorHtml(html, "other_mirror").includes("<title>X | Birch Reserve</title>"));
});

test("Scale assets are byte-identical copies of silverbirchgrowth/scalehealthnew (git blob ids pinned)", () => {
  const root = path.resolve(process.cwd(), "../..");
  const blob = (p: string) => {
    const b = readFileSync(path.join(root, p));
    return createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest("hex");
  };
  // scalehealthnew main 43048bfd: public/home-assets/scalehealth-logo-srgb-v2.png (the logo scalehealth.ca's header serves)
  assert.equal(blob("attached_assets/brand/scalehealth-logo-srgb-v2.png"), "ba03c818b3d7d2175f65815260d311ebd2eb4516");
  // scalehealthnew main 43048bfd: public/favicon.svg
  assert.equal(blob("artifacts/clinichub-media/public/brand/scale/favicon.svg"), "48d4a36c7ccf58d96af84652ee961f35f76c565b");
});

test("mirror links: DOM <a href> that leave /intake are rewritten to Birch; absolute + data-mirror-keep links stay", () => {
  const out = mirrorHtml("<html><head></head><body></body></html>", "scale_mirror");
  assert.match(out, /function raw\(v\)/, "raw-relative check exists");
  assert.match(out, /MutationObserver/, "dynamic links are rewritten as React renders them");
  assert.match(out, /attributeFilter:\["href"\]/);
  assert.match(out, /hasAttribute\("data-mirror-keep"\)\|\|a\.hasAttribute\("download"\)\)return;var p=raw/);
  assert.match(out, /var p=raw\(a\.getAttribute\("href"\)\);if\(p===null\|\|own\(p\)\)return;e\.preventDefault/, "click handler ignores absolute same-origin links");
});

test("any Birch page opened through /intake/_m with the Scale tag gets the mirror-aware fetch base (buycalc, hub-proof)", async () => {
  const { default: express } = await import("express");
  const { mirrorHost } = await import("../src/middlewares/mirrorHost");
  const app = express();
  app.use(mirrorHost());
  app.get("/buycalc", (_q, r) => r.type("html").send(`<!doctype html><html><head><title>Buy | Birch Reserve</title></head><body></body></html>`));
  const srv = app.listen(0);
  try {
    const port = (srv.address() as { port: number }).port;
    const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`).then((r) => r.text());
    assert.match(await get("/intake/_m/buycalc?br_mirror=scale"), /window\.__BR_MIRROR/);
    assert.doesNotMatch(await get("/buycalc"), /__BR_MIRROR/);
    assert.doesNotMatch(await get("/intake/_m/buycalc"), /__BR_MIRROR/);
  } finally {
    srv.close();
  }
});
