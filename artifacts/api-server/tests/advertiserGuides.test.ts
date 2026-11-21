import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import router, { renderGuide, renderGuidesIndex } from "../src/routes/advertiserGuides";
import { ADVERTISER_GUIDES, GUIDE_PATHS, GUIDES_INDEX_PATH } from "../src/lib/advertiserGuides";
import { PUBLIC_SITEMAP_PATHS } from "../src/lib/publicSeo";

const BANNED = [/\bAlign\b/, /Clairvoyant/i, /80 locations/i, /Kalaya/i, /\bsigned partners\b/i, /guarantee(d)? (results|reach|impressions|roi|leads)/i, /bypass|get around|evade|workaround|loophole/i, /\$\s?\d[\d,]*\s?(K|k)?\s*(test rail|category lock|seat)/i];

test("every guide is self-canonical, titled, described, cited and links to /buy-ads and /media-kit", () => {
  assert.ok(ADVERTISER_GUIDES.length >= 3 && ADVERTISER_GUIDES.length <= 5);
  for (const g of ADVERTISER_GUIDES) {
    const html = renderGuide(g);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://birchreserve\\.net/${g.slug}" />`));
    assert.match(html, /<title>[^<]{20,}<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{60,}">/);
    assert.match(html, /href="\/buy-ads"/);
    assert.match(html, /href="\/media-kit"/);
    assert.ok(g.sources.length >= 2, `${g.slug} cites sources`);
    for (const s of g.sources) assert.match(s.url, /^https:\/\//);
    assert.match(html, /prescription-drug promotion/);
    assert.match(html, /modelled/);
    for (const re of BANNED) assert.doesNotMatch(html, re, `${g.slug} ${re}`);
  }
});

test("guides index lists every guide and is in the sitemap", () => {
  const html = renderGuidesIndex();
  for (const g of ADVERTISER_GUIDES) assert.ok(html.includes(`href="/${g.slug}"`));
  const sitemap = PUBLIC_SITEMAP_PATHS as readonly string[];
  assert.ok(sitemap.includes(GUIDES_INDEX_PATH));
  for (const p of GUIDE_PATHS) assert.ok(sitemap.includes(p), p);
});

test("routes answer 200 HTML", async () => {
  const app = express();
  app.use(router);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    for (const p of [GUIDES_INDEX_PATH, ...GUIDE_PATHS]) {
      const res = await fetch(`http://127.0.0.1:${port}${p}`);
      assert.equal(res.status, 200, p);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    }
  } finally {
    server.close();
  }
});
