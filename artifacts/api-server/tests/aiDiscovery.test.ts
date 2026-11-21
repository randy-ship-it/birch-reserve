import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";
import router, { renderVsGoogle } from "../src/routes/aiDiscovery";
import { GOOGLE_SOURCES, POSITIONING, jsonLdGraph, llmsFullTxt } from "../src/lib/aiDiscovery";
import { llmsTxt } from "../src/lib/overhaul/seo";
import { PUBLIC_SITEMAP_PATHS } from "../src/lib/publicSeo";

const BANNED = [
  /\bFriday\b/, /\bAlign\b/, /Clairvoyant/i, /Alset/i, /80 locations/i, /MedVibe/i, /\bsigned partners\b/i,
  /\bPublishers?\b/, /\bCAD\b|C\$/, /guarantee(d)? (results|reach|impressions|roi|leads|views)/i, /\bROAS\b(?! promises)/,
  /\b(not taken|is open|still open|0 (hubs|brands|spots))\b/i, /sweepstake/i, /Integrity Fitness/i,
  /live in minutes|minutes to (go )?live/i, /\$1,900/,
];
const strip = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

test("copy rules hold across llms.txt, llms-full.txt, JSON-LD and the page", () => {
  const html = renderVsGoogle();
  for (const [name, text] of [["llms", llmsTxt()], ["full", llmsFullTxt()], ["page", strip(html)], ["ld", JSON.stringify(jsonLdGraph())]] as const)
    for (const re of BANNED) assert.doesNotMatch(text, re, `${name} ${re}`);
});

test("positioning line leads llms.txt and llms-full.txt and appears in page, JSON-LD", () => {
  assert.match(llmsTxt(), new RegExp(`^# Birch Reserve\\n\\n> ${POSITIONING.replace(/\./g, "\\.")}`));
  assert.ok(llmsFullTxt().includes(`> ${POSITIONING}`));
  assert.ok(renderVsGoogle().includes(POSITIONING));
  assert.ok(JSON.stringify(jsonLdGraph()).includes(POSITIONING));
});

test("page cites every Google source, has JSON-LD, canonical and sitemap entry", () => {
  const html = renderVsGoogle();
  for (const s of GOOGLE_SOURCES) assert.ok(html.includes(s.url), s.url);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/vs-google-ads" \/>/);
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const ld = JSON.parse(m![1]!.replaceAll("\\u003c", "<"));
  const types = ld["@graph"].map((n: { "@type": string }) => n["@type"]);
  assert.deepEqual(types, ["Organization", "Product", "FAQPage"]);
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/vs-google-ads"));
  assert.match(html, /about 10 seconds|~10 s/);
});

test("robots.txt names the AI crawlers and allows them", () => {
  const robots = readFileSync(resolve(process.cwd(), "../clinichub-media/public/robots.txt"), "utf8");
  for (const bot of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Google-Extended", "ClaudeBot", "Applebot-Extended", "Bingbot"])
    assert.match(robots, new RegExp(`User-agent: ${bot}\\n`));
  assert.doesNotMatch(robots, /Disallow: \/\s*\n/);
});

test("routes answer", async () => {
  const app = express();
  app.use(router);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const b = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${b}/vs-google-ads`)).status, 200);
    const r = await fetch(`${b}/how-fast`, { redirect: "manual" });
    assert.equal(r.status, 301);
    const t = await fetch(`${b}/llms-full.txt`);
    assert.match(t.headers.get("content-type") ?? "", /text\/plain/);
  } finally {
    server.close();
  }
});
