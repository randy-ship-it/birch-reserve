import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";
import { mirrorHost } from "../src/middlewares/mirrorHost";
import router, { rateCheck } from "../src/routes/agentSearch";
import { agentSearch, agentSearchIndex, AGENT_SEARCH_BLOCKED } from "../src/lib/agentSearch";
import { agentDiscovery, agentDiscoveryEligible } from "../src/middlewares/agentDiscovery";
import { llmsTxt } from "../src/lib/overhaul/seo";
import { llmsFullTxt } from "../src/lib/aiDiscovery";
import { agentCard } from "../src/lib/overhaul/agent";

const GATED_OR_BANNED = [
  /\bAlign\b/, /Clairvoyant/i, /Alset/i, /80 locations/i, /MedVibe/i, /\bFriday\b/, /pier ?39/i, /Ankita/i, /Kalaya/i,
  /access[- ]?code/i, /insider/i, /\b0 (hubs|brands|spots|seats)\b/i,
];

async function withServer(fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(mirrorHost());
  app.use(router);
  app.use(agentDiscovery());
  app.get("/media-kit", (_req, res) => void res.type("html").send("<html><head><title>x</title></head><body>hi</body></html>"));
  app.get("/inventory", (_req, res) => void res.type("html").send("<html><head></head></html>"));
  const server = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test("index is public copy only and clean", () => {
  const idx = agentSearchIndex();
  assert.ok(idx.length > 40, `index size ${idx.length}`);
  for (const d of idx) {
    assert.match(d.url, /^https:\/\/birchreserve\.net\//);
    assert.doesNotMatch(d.url, /\/(inventory|tam|advertise\/brands|sales|ads|account)(\/|$)/, d.url);
    for (const re of GATED_OR_BANNED) assert.doesNotMatch(`${d.title} ${d.text}`, re, `${d.url} ${re}`);
    assert.doesNotMatch(d.text, /2027 ad inventory/i);
  }
  assert.ok(AGENT_SEARCH_BLOCKED.length > 5);
});

test("search finds the buy path and rate pages", () => {
  const r = agentSearch("how do I buy a category reserve", 5);
  assert.ok(r.length >= 3);
  assert.ok(r.every((h) => h.title && h.url && h.snippet));
  assert.equal(new Set(r.map((h) => h.url)).size, r.length);
  assert.ok(r[0]!.score === 1);
  assert.ok(agentSearch("agency discount rate card").some((h) => /agencies|rates|media-kit|buyers/.test(h.url)));
  assert.deepEqual(agentSearch("the of a"), []);
});

test("GET, QUERY (text + JSON), markdown, errors and headers", async () => {
  await withServer(async (b) => {
    const g = await fetch(`${b}/.well-known/search?q=${encodeURIComponent("hold look")}`);
    assert.equal(g.status, 200);
    assert.match(g.headers.get("content-type") ?? "", /json/);
    assert.match(g.headers.get("cache-control") ?? "", /s-maxage/);
    assert.equal(g.headers.get("access-control-allow-origin"), "*");
    assert.match(g.headers.get("accept-query") ?? "", /application\/json/);
    assert.ok(g.headers.get("ratelimit-remaining"));
    const j = (await g.json()) as { query: string; results: { title: string; url: string; snippet: string }[] };
    assert.equal(j.query, "hold look");
    assert.ok(j.results.length > 0);
    assert.ok(j.results[0]!.url.startsWith("https://birchreserve.net"));

    const alias = await fetch(`${b}/api/search?q=agencies`);
    assert.equal(alias.status, 200);

    const qt = await fetch(`${b}/.well-known/search`, { method: "QUERY", body: "how does an agency buy" });
    assert.equal(qt.status, 200);
    assert.ok(((await qt.json()) as { results: unknown[] }).results.length > 0);

    const qj = await fetch(`${b}/.well-known/search`, { method: "QUERY", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: "reserve", limit: 2 }) });
    assert.equal(qj.status, 200);
    assert.ok(((await qj.json()) as { results: unknown[] }).results.length <= 2);

    const bad = await fetch(`${b}/.well-known/search`, { method: "QUERY", headers: { "content-type": "application/json" }, body: "{nope" });
    assert.equal(bad.status, 400);
    assert.equal((await fetch(`${b}/.well-known/search`)).status, 400);
    assert.equal((await fetch(`${b}/.well-known/search`, { method: "POST", body: "x" })).status, 405);
    assert.equal((await fetch(`${b}/.well-known/search`, { method: "OPTIONS" })).status, 204);

    const md = await fetch(`${b}/.well-known/search?q=reserve`, { headers: { accept: "text/markdown" } });
    assert.match(md.headers.get("content-type") ?? "", /text\/markdown/);
    assert.match(await md.text(), /^# Search results for: "reserve"/);
  });
});

test("rate limiter caps one key per window", () => {
  const now = Date.now();
  let last = rateCheck("k", now);
  for (let i = 0; i < 60; i++) last = rateCheck("k", now);
  assert.equal(last.ok, false);
  assert.ok(last.retryAfter >= 1);
  assert.equal(rateCheck("k", now + 61_000).ok, true);
});

test("agent meta + Link header on public pages, not on gated or mirror paths", async () => {
  await withServer(async (b) => {
    const h = await fetch(`${b}/media-kit`);
    const html = await h.text();
    assert.match(html, /<meta name="agent:endpoint" content="https:\/\/birchreserve\.net\/\.well-known\/search\?q=\{query\}">/);
    assert.match(html, /<meta name="agent:method" content="GET">/);
    assert.match(h.headers.get("link") ?? "", /rel="search"/);
    const inv = await (await fetch(`${b}/inventory`)).text();
    assert.doesNotMatch(inv, /agent:/);
    const mirror = await (await fetch(`${b}/media-kit?br_mirror=scale`)).text();
    assert.doesNotMatch(mirror, /agent:/);
    const viaPrefix = await fetch(`${b}/intake/_m/media-kit`);
    assert.doesNotMatch(await viaPrefix.text(), /agent:/);
    assert.equal(viaPrefix.headers.get("link"), null);
  });
  assert.equal(agentDiscoveryEligible("/advertise/brands"), false);
  assert.equal(agentDiscoveryEligible("/intake/_m/agencies"), false);
  assert.equal(agentDiscoveryEligible("/agencies"), true);
});

test("llms.txt, llms-full.txt, agent card and robots advertise the endpoint", () => {
  for (const t of [llmsTxt(), llmsFullTxt()]) assert.match(t, /\.well-known\/search\?q=\{query\}/);
  assert.match(llmsTxt(), /## Search for agents/);
  assert.match(llmsTxt(), /## When to use Birch Reserve/);
  assert.match(JSON.stringify(agentCard()), /\.well-known\/search/);
  const robots = readFileSync(resolve(process.cwd(), "../clinichub-media/public/robots.txt"), "utf8");
  assert.match(robots, /Allow: \/\.well-known\/search/);
  assert.match(robots, /Sitemap: https:\/\/birchreserve\.net\/sitemap\.xml/);
  for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "Bingbot"]) assert.match(robots, new RegExp(`User-agent: ${bot}\\n`));
  const vb = readFileSync(resolve(process.cwd(), "../../scripts/vercel-build.mjs"), "utf8");
  assert.match(vb, /well-known\/search/);
});
