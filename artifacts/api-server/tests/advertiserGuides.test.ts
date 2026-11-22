import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import router, { renderGuide, renderGuidesIndex } from "../src/routes/advertiserGuides";
import { ADVERTISER_GUIDES, GUIDE_PATHS, GUIDES_INDEX_PATH } from "../src/lib/advertiserGuides";
import { PUBLIC_SITEMAP_PATHS } from "../src/lib/publicSeo";

const BANNED = [/\bAlign\b/, /Clairvoyant/i, /80 locations/i, /Kalaya/i, /\bsigned partners\b/i, /guarantee(d)? (results|reach|impressions|roi|leads)/i, /bypass|get around|evade|workaround|loophole/i, /\$\s?\d[\d,]*\s?(K|k)?\s*(test rail|category lock|seat)/i];

test("every guide is self-canonical, titled, described, cited and links to the reserve and /media-kit", () => {
  assert.ok(ADVERTISER_GUIDES.length >= 5);
  for (const g of ADVERTISER_GUIDES) {
    const html = renderGuide(g);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://birchreserve\\.net/${g.slug}" />`));
    assert.match(html, /<title>[^<]{20,}<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{60,}">/);
    assert.match(html, /href="\/exclusive(\?category=[^"]+)?" data-cta="reserve"|data-cta="reserve" href="\/exclusive/);
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

import { BUYER_PAGES } from "../src/lib/buyerAnswers";
import { mirrorHtml } from "../src/middlewares/mirrorHost";
import { aiSourceOf, isAiRefEvent } from "../src/lib/aiReferral";

const SITE_BANNED = [/MedVibe/i, /Friday/, /pier39/i, /Ankita/i, /\bguarantee(d|s)?\b(?! (is|was) not)/i, /\bgig\b|on-demand|uber/i, /\bhub is open\b/i, /\bwe own\b|\bowned by\b/i, /promo code:/i];

test("buyer-answer + category pages: answer box, FAQPage schema, reserve CTA, Markdown mirror, no banned copy", async () => {
  assert.ok(BUYER_PAGES.length >= 9);
  for (const g of BUYER_PAGES) {
    const html = renderGuide(g);
    assert.match(html, /class="answer"/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /based on signed partnership contracts/i);
    assert.match(html, /data-cta="reserve"/);
    assert.match(html, /\$1,900/);
    assert.match(html, /rel="alternate" type="text\/markdown"/);
    for (const re of SITE_BANNED) assert.doesNotMatch(html.replace(/No impression guarantee/g, ""), re, `${g.slug} ${re}`);
  }
  const app = express();
  app.use(router);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const md = await fetch(`http://127.0.0.1:${port}/${BUYER_PAGES[0]!.slug}.md`);
    assert.equal(md.status, 200);
    assert.match(md.headers.get("content-type") ?? "", /text\/markdown/);
    assert.match(await md.text(), /\*\*Short answer:\*\*/);
  } finally {
    server.close();
  }
});

test("Scale mirror: server pages speak as Scale Health, Scale logo, Birch only in the ad-partner line", () => {
  const out = mirrorHtml(renderGuide(BUYER_PAGES[0]!), "scale_mirror");
  const body = out.slice(out.search(/<body\b/i)).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  const named = body.match(/Birch Reserve.{0,30}/g) ?? [];
  assert.equal(named.length, 1, named.join(" | "));
  assert.match(named[0]!, /^Birch Reserve \(Silver Birch Growth Inc\.\)/);
  assert.doesNotMatch(body.replace(/Birch Reserve \(Silver Birch Growth Inc\.\)/g, "").replace(/Silver Birch Growth/g, ""), /\bBirch\b/);
  assert.match(out, /alt="Scale Health"/);
  assert.match(out, /href="\/intake\/_m\/exclusive"/);
  assert.match(body, /Scale Health/);
});

test("AI referral: hosts and utm_source map to assistants; event names are fixed", () => {
  assert.equal(aiSourceOf({ utmSource: "chatgpt.com" }), "chatgpt");
  assert.equal(aiSourceOf({ referrer: "https://www.perplexity.ai/search?q=x" }), "perplexity");
  assert.equal(aiSourceOf({ referrer: "https://grok.com/" }), "grok");
  assert.equal(aiSourceOf({ referrer: "https://gemini.google.com/app" }), "gemini");
  assert.equal(aiSourceOf({ referrer: "https://copilot.microsoft.com/" }), "copilot");
  assert.equal(aiSourceOf({ referrer: "https://www.google.com/" }), null);
  assert.ok(isAiRefEvent("ai_ref.chatgpt.scale"));
  assert.ok(!isAiRefEvent("ai_ref.chatgpt.other"));
  assert.ok(!isAiRefEvent("ai_ref.myspace.birch"));
});
