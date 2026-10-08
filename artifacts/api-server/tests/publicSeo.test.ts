/**
 * Public sitemap, per-route head tags, and autolinks that keep sentence punctuation
 * out of the href.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import app from "../src/app";
import { PUBLIC_INSIGHT_ARTICLES } from "@workspace/db";
import {
  PUBLIC_OG_IMAGE,
  PUBLIC_SITEMAP_PATHS,
  autolinkPlainUrl,
  publicCanonical,
} from "../src/lib/publicSeo";

let origin = "";
let closeApp: (() => Promise<void>) | undefined;

before(async () => {
  const live = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    live.once("listening", () => resolveReady());
    live.once("error", rejectReady);
  });
  const address = live.address();
  if (!address || typeof address === "string") throw new Error("App server did not bind.");
  origin = `http://127.0.0.1:${address.port}`;
  closeApp = () => new Promise<void>((resolveClose, rejectClose) => live.close((error) => (error ? rejectClose(error) : resolveClose())));
});

after(async () => {
  await closeApp?.();
});

const SITEMAP_XML = /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">(?:<url><loc>[^<]+<\/loc>(?:<lastmod>[^<]+<\/lastmod>)?<\/url>)*<\/urlset>$/;

test("GET /sitemap.xml is XML and lists public pages without API, inventory, or noindex paths", async () => {
  const res = await fetch(`${origin}/sitemap.xml`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /^application\/xml/);
  const xml = await res.text();
  assert.match(xml, SITEMAP_XML);
  for (const path of PUBLIC_SITEMAP_PATHS) {
    assert.match(xml, new RegExp(`<loc>${publicCanonical(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>`));
  }
  for (const article of PUBLIC_INSIGHT_ARTICLES) {
    assert.match(xml, new RegExp(`<loc>${publicCanonical(`/insights/${article.slug}`).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>`));
  }
  assert.doesNotMatch(xml, /\/inventory/);
  assert.doesNotMatch(xml, /\/api\//);
  assert.doesNotMatch(xml, /\/v1\//);
  assert.doesNotMatch(xml, /llms\.txt/);
  assert.doesNotMatch(xml, /openapi\.yaml/);
  assert.doesNotMatch(xml, /\/ops\//);
  assert.doesNotMatch(xml, /\/sales\//);
  assert.doesNotMatch(xml, /\/sign-in/);
  assert.doesNotMatch(xml, /www\.birchreserve\.net/);
  assert.doesNotMatch(xml, /<loc>https:\/\/birchreserve\.net\/about\/<\/loc>/);
});

test("server HTML and SPA shells expose canonical, og:url, og:image, and twitter:card", async () => {
  const pages: Array<[string, string]> = [
    ["/kit", "https://birchreserve.net/kit"],
    ["/terms", "https://birchreserve.net/terms"],
    ["/privacy", "https://birchreserve.net/privacy"],
    ["/sample-io", "https://birchreserve.net/sample-io"],
    ["/about", "https://birchreserve.net/about"],
    ["/sell-ads", "https://birchreserve.net/sell-ads"],
    ["/list-inventory", "https://birchreserve.net/list-inventory"],
    ["/marketplace", "https://birchreserve.net/marketplace"],
    ["/success", "https://birchreserve.net/success"],
    ["/splash/activation", "https://birchreserve.net/splash/activation"],
  ];
  for (const [path, canonical] of pages) {
    const res = await fetch(`${origin}${path}`);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical}"\\s*/>`));
    assert.match(html, new RegExp(`<meta property="og:url" content="${canonical}"\\s*/>`));
    assert.match(html, new RegExp(`<meta property="og:image" content="${PUBLIC_OG_IMAGE}"\\s*/>`));
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"\s*\/>/);
    assert.equal(html.includes('id="root"') || html.includes("<h1>"), true, path);
  }

  const home = await readFile(resolve(process.cwd(), "../clinichub-media/index.html"), "utf8");
  assert.match(home, /<link rel="canonical" href="https:\/\/birchreserve\.net\/" \/>/);
  assert.match(home, /<meta property="og:url" content="https:\/\/birchreserve\.net\/" \/>/);
  assert.match(home, new RegExp(`<meta property="og:image" content="${PUBLIC_OG_IMAGE}" />`));
  assert.match(home, /<meta name="twitter:card" content="summary_large_image" \/>/);

  const robots = await readFile(resolve(process.cwd(), "../clinichub-media/public/robots.txt"), "utf8");
  assert.match(robots, /^Sitemap: https:\/\/birchreserve\.net\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /api\/editorial\/sitemap\.xml/);

  const build = await readFile(resolve(process.cwd(), "../../scripts/vercel-build.mjs"), "utf8");
  assert.match(build, /\/sitemap\\\\\.xml/);
  assert.match(build, /\/about\/\?/);
  assert.match(build, /spa-index\.html/);
});

test("autolinks drop sentence punctuation from the href and keep it in the text", () => {
  const cases: Array<[string, string]> = [
    ["https://birchreserve.net.", "https://birchreserve.net"],
    ["https://physio.drhonow.com.", "https://physio.drhonow.com"],
    ["https://physio.drhonow.com/dr-ho/portal.", "https://physio.drhonow.com/dr-ho/portal"],
  ];
  for (const [before, afterHref] of cases) {
    const html = autolinkPlainUrl(before);
    assert.match(html, new RegExp(`^<a href="${afterHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}">${afterHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</a>\\.$`));
    assert.equal(html.replace(/<[^>]+>/g, ""), before);
  }
  assert.equal(
    autolinkPlainUrl("https://birchreserve.net"),
    '<a href="https://birchreserve.net">https://birchreserve.net</a>',
  );
});

test("published insight HTML keeps sentence periods outside autolink hrefs", async () => {
  const res = await fetch(`${origin}/insights/the-shelf-after-the-receipt`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/the-shelf-after-the-receipt"\s*\/>/);
  assert.match(html, /<a href="https:\/\/birchreserve\.net">https:\/\/birchreserve\.net<\/a>\./);
  assert.match(html, /<a href="https:\/\/physio\.drhonow\.com\/dr-ho\/portal">https:\/\/physio\.drhonow\.com\/dr-ho\/portal<\/a>\./);
  assert.doesNotMatch(html, /href="https:\/\/birchreserve\.net\."/);
  assert.doesNotMatch(html, /href="https:\/\/physio\.drhonow\.com\/dr-ho\/portal\."/);
});

test("GET /advertise stays a 301 to /buycalc", async () => {
  const res = await fetch(`${origin}/advertise`, { redirect: "manual" });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "/buycalc");
});
