import { test } from "node:test";
import assert from "node:assert/strict";
import { MIRROR_PREFIX, mirrorHtml, stripMirrorPrefix } from "../src/middlewares/mirrorHost";

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
  assert.match(out, new RegExp(`href="${MIRROR_PREFIX}/favicon\\.svg\\?v=3"`));
  assert.match(out, /<link rel="canonical" href="https:\/\/birchreserve\.net\/intake" \/>/);
  assert.match(out, /<a href="https:\/\/birchreserve\.net\/media-kit">/);
  assert.match(out, /<a href="\/intake\?ref=nav">/);
  assert.match(out, /<a href="https:\/\/scalehealth\.ca">/);
  assert.match(out, /src="\/\/cdn\.example\.com\/x\.png"/);
  assert.match(out, /href="https:\/\/fonts\.googleapis\.com"/);
});
