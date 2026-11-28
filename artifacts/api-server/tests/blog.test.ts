import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import router, { postPath, renderBlogIndex, renderPost } from "../src/routes/blog";
import { BLOG_INDEX_PATH, BLOG_PATHS, BLOG_POSTS } from "../src/lib/blogPosts";
import { PUBLIC_SITEMAP_PATHS } from "../src/lib/publicSeo";

// Copy rules (Randy, Nov 2026). Kalaya is never mentioned to visitors (Nov 27 2026).
const BANNED = [
  /\bFriday\b/, /\bAlign\b/, /Clairvoyant/i, /Alset/i, /80 locations/i, /MedVibe/i, /Kalaya/i, /\bsigned partners\b/i,
  /\bPublisher\b/, /\bCAD\b|C\$/, /guarantee(d)? (results|reach|impressions|roi|leads|views)/i, /\bROAS\b/, /\bCTR\b/,
  /\b(not taken|is open|still open|0 (hubs|brands|spots))\b/i, /—/,
];

function bodyText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
}

test("every post is self-canonical, has meta/OG, Article JSON-LD, an Inspired-by link and an /intake CTA", () => {
  assert.ok(BLOG_POSTS.length >= 5 && BLOG_POSTS.length <= 8);
  const slugs = new Set<string>();
  for (const p of BLOG_POSTS) {
    assert.ok(!slugs.has(p.slug), `dup ${p.slug}`);
    slugs.add(p.slug);
    const html = renderPost(p);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://birchreserve\\.net${postPath(p)}" />`));
    assert.match(html, /<title>[^<]{20,}<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{60,}">/);
    assert.match(html, /<meta property="og:title" content="[^"]+" \/>/);
    assert.match(html, /<meta property="og:type" content="article">/);
    assert.match(html, /"@type":"Article"/);
    assert.match(html, /href="\/intake"/);
    assert.match(html, /Inspired by [^<]+<a href="https:\/\//);
    assert.match(p.inspired.url, /^https:\/\//);
    assert.match(html, /<blockquote class="q">/);
    assert.match(html, /modelled estimate/i);
    for (const re of BANNED) assert.doesNotMatch(bodyText(html), re, `${p.slug} ${re}`);
  }
});

test("index lists every post, and every post is in the sitemap", () => {
  const html = renderBlogIndex();
  for (const p of BLOG_POSTS) assert.ok(html.includes(`href="${postPath(p)}"`));
  for (const re of BANNED) assert.doesNotMatch(bodyText(html), re, `index ${re}`);
  const sitemap = PUBLIC_SITEMAP_PATHS as readonly string[];
  assert.ok(sitemap.includes(BLOG_INDEX_PATH));
  for (const p of BLOG_PATHS) assert.ok(sitemap.includes(p), p);
});

test("routes answer 200 HTML", async () => {
  const app = express();
  app.use(router);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    for (const p of [BLOG_INDEX_PATH, ...BLOG_PATHS]) {
      const res = await fetch(`http://127.0.0.1:${port}${p}`);
      assert.equal(res.status, 200, p);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    }
  } finally {
    server.close();
  }
});
