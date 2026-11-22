import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import router from "../src/routes/aiMarkdown";
import { MD_PAGES, mdPathFor, renderMarkdown, mdAlternateLink } from "../src/lib/aiMarkdown";
import { classifyAiBot } from "../src/lib/aiBots";

const BANNED = [/\bFriday\b/, /\bAlign\b/, /Clairvoyant/i, /MedVibe/i, /performance brand/i];

test("every mirror renders clean Markdown without banned words", () => {
  for (const p of MD_PAGES) {
    const md = renderMarkdown(mdPathFor(p.path));
    assert.ok(md && md.startsWith("# "), p.path);
    assert.ok(md!.includes("https://birchreserve.net"), p.path);
    for (const re of BANNED) assert.doesNotMatch(md!, re, `${p.path} ${re}`);
  }
  assert.match(mdAlternateLink("/media-kit/") ?? "", /media-kit\.md/);
  assert.equal(mdAlternateLink("/sales"), null);
});

test("bot classifier", () => {
  assert.equal(classifyAiBot("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)")?.family, "anthropic");
  assert.equal(classifyAiBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)")?.agent, "GPTBot");
  assert.match(classifyAiBot("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/61.0.3163.100 Safari/537.36")?.suspect ?? "", /old-chrome-61/);
  assert.equal(classifyAiBot("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"), null);
});

test("routes serve text/markdown and negotiate", async () => {
  const app = express();
  app.use(router);
  app.use((_req, res) => void res.type("html").send("<html></html>"));
  const server = app.listen(0);
  const b = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const r = await fetch(`${b}/media-kit.md`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /text\/markdown/);
    const h = await fetch(`${b}/media-kit`);
    assert.match(h.headers.get("content-type") ?? "", /text\/html/);
    assert.match(h.headers.get("link") ?? "", /media-kit\.md/);
    const n = await fetch(`${b}/`, { headers: { accept: "text/markdown" } });
    assert.match(n.headers.get("content-type") ?? "", /text\/markdown/);
    const m = await fetch(`${b}/intake?br_mirror=scale`);
    assert.equal(m.headers.get("link"), null);
  } finally {
    server.close();
  }
});
