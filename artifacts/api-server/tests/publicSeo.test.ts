/**
 * Public sitemap, per-route head tags, and autolinks that keep sentence punctuation
 * out of the href.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import app from "../src/app";
import { renderBuycalcHtml } from "../src/routes/publicBuying";
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
  assert.doesNotMatch(xml, /\/list-inventory/);
  assert.doesNotMatch(xml, /\/success/);
  assert.doesNotMatch(xml, /\/splash\/activation/);
  assert.doesNotMatch(xml, /\/oatmeal/);
  assert.doesNotMatch(xml, /\/advertise/);
  assert.doesNotMatch(xml, /\/ad-examples/);
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
    ["/list-inventory", "https://birchreserve.net/sell-ads"],
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
    if (html.includes("<h1>")) {
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
      const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
      assert.match(html, new RegExp(`<meta property="og:title" content="${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*/>`));
      assert.match(html, new RegExp(`<meta property="og:description" content="${description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*/>`));
    }
    if (path === "/success" || path === "/splash/activation") {
      assert.match(html, /<meta name="robots" content="noindex"\s*\/>/);
    }
    if (path === "/about") {
      assert.match(html, /The \$190 look does not burn a seat/);
      assert.match(html, /The \$490 seat is the named category/);
      assert.match(html, /The insertion order names the hub before anything runs/);
      assert.match(html, /<meta property="og:image" content="https:\/\/birchreserve\.net\/og-birch-reserve\.png"\s*\/>/);
      assert.doesNotMatch(html, /8\.7M|56M monthly views|20M\+|100M\+ orders/);
    }
  }

  const home = await readFile(resolve(process.cwd(), "../clinichub-media/index.html"), "utf8");
  assert.match(home, /<link rel="canonical" href="https:\/\/birchreserve\.net\/" \/>/);
  assert.match(home, /<meta property="og:url" content="https:\/\/birchreserve\.net\/" \/>/);
  assert.match(home, new RegExp(`<meta property="og:image" content="${PUBLIC_OG_IMAGE}" />`));
  assert.match(home, /<meta name="twitter:card" content="summary_large_image" \/>/);

  const og = await readFile(resolve(process.cwd(), "../clinichub-media/public/og-birch-reserve.png"));
  assert.equal(og.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(og.readUInt32BE(16), 1200);
  assert.equal(og.readUInt32BE(20), 630);
  assert.equal(PUBLIC_OG_IMAGE, "https://birchreserve.net/og-birch-reserve.png");

  const homeSource = await readFile(resolve(process.cwd(), "../clinichub-media/src/pages/home.tsx"), "utf8");
  assert.match(homeSource, /On-prem surfaces in Align's network of health and wellness businesses and in Scale hubs are a separate insertion-order line\./);
  assert.doesNotMatch(homeSource, /clinic and studio surfaces via Align/);
  assert.match(homeSource, /href="https:\/\/www\.scalehealth\.ca\/"/);
  assert.doesNotMatch(homeSource, /embedded-recovery-clinic/);
  assert.match(homeSource, /For product and wellness brands seeking an embedded clinic layer across checkout or loyalty\./);

  const robots = await readFile(resolve(process.cwd(), "../clinichub-media/public/robots.txt"), "utf8");
  assert.match(robots, /^Sitemap: https:\/\/birchreserve\.net\/sitemap\.xml$/m);
  assert.doesNotMatch(robots, /api\/editorial\/sitemap\.xml/);

  const build = await readFile(resolve(process.cwd(), "../../scripts/vercel-build.mjs"), "utf8");
  assert.match(build, /\/sitemap\\\\\.xml/);
  assert.match(build, /\/about\/\?/);
  assert.match(build, /\/ad-examples\/\?/);
  assert.match(build, /spa-index\.html/);
  assert.match(build, /src: "\/\(\.\*\)", dest: "\/api"/);
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
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  assert.match(html, new RegExp(`<meta property="og:title" content="${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*/>`));
  assert.match(html, new RegExp(`<meta property="og:description" content="${description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*/>`));
  assert.match(html, /<a href="https:\/\/birchreserve\.net">https:\/\/birchreserve\.net<\/a>\./);
  assert.match(html, /<a href="https:\/\/physio\.drhonow\.com\/dr-ho\/portal">https:\/\/physio\.drhonow\.com\/dr-ho\/portal<\/a>\./);
  assert.doesNotMatch(html, /href="https:\/\/birchreserve\.net\."/);
  assert.doesNotMatch(html, /href="https:\/\/physio\.drhonow\.com\/dr-ho\/portal\."/);
});

test("buycalc HTML keeps the category facts and drops the price-rise line", () => {
  const html = renderBuycalcHtml({ seatsOpen: 3, seatsTotal: 8, sku: "hold-190", format: "post_checkout" });
  assert.match(html, /\$490 USD/);
  assert.match(html, /\$190 USD/);
  assert.match(html, /One unit inside the hub\. Not a stack of banners\. The category names the card\./);
  assert.match(html, /The zone is the category\. You can open a signed hub before the look\. The look does not serve\./);
  assert.match(html, /The \$190 look is a draft you build\. It does not serve until the insertion order names the hub\./);
  assert.match(html, /One brand header on the category the customer already opened\. Not a second page\./);
  assert.match(html, /The unit matches the page the customer already opened\. It is not a banner beside the letter\./);
  assert.match(html, /data-sku="hold-190"[\s\S]*<a href="\/kit">What you send is on the creative brief<\/a>/);
  assert.match(html, /data-sku="reserve-490"[\s\S]*You buy the category header\. You do not bid on a search\./);
  assert.match(html, /<a href="https:\/\/physio\.drhonow\.com"/);
  assert.match(html, /Lock one category inside signed health hubs\. Not an open auction\./);
  assert.match(html, /No impression guarantee/);
  assert.doesNotMatch(html, /exclusiv/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/buycalc"\s*\/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/birchreserve\.net\/og-birch-reserve\.png"\s*\/>/);
  assert.doesNotMatch(html, /Lock in your slot before the minimum goes up/);
  assert.doesNotMatch(html, /8\.7M|56M monthly views|20M\+|100M\+ orders/);
  assert.doesNotMatch(html, /reserve-899/);
  const skuOptions = html.match(/<select name="sku">([\s\S]*?)<\/select>/)?.[1] ?? "";
  assert.equal((skuOptions.match(/<option /g) ?? []).length, 2);
  assert.match(skuOptions, /value="hold-190"/);
  assert.match(skuOptions, /value="reserve-490"/);
});

test("GET /advertise stays a 301 to /buycalc", async () => {
  const res = await fetch(`${origin}/advertise`, { redirect: "manual" });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "/buycalc");
});

test("GET /ad-examples redirects home", async () => {
  const res = await fetch(`${origin}/ad-examples`, { redirect: "manual" });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "/");
  const withQuery = await fetch(`${origin}/ad-examples?sku=hold-190`, { redirect: "manual" });
  assert.equal(withQuery.status, 301);
  assert.equal(withQuery.headers.get("location"), "/?sku=hold-190");
});

test("GET /oatmeal stays a 301 to /buycalc", async () => {
  const res = await fetch(`${origin}/oatmeal`, { redirect: "manual" });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "/buycalc");
});

test("unknown paths return 404 with the SPA shell", async () => {
  for (const path of ["/reserve", "/made-up-xyz"]) {
    const res = await fetch(`${origin}${path}`);
    assert.equal(res.status, 404, path);
    const html = await res.text();
    assert.match(html, /id="root"/);
    assert.match(html, /<meta name="robots" content="noindex"\s*\/>/);
    assert.match(html, /<script type="module"/);
  }
  const kit = await fetch(`${origin}/kit`);
  assert.equal(kit.status, 200);
});
