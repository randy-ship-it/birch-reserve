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

test("GET /insights/what-you-send-for-a-seat publishes the handoff and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/what-you-send-for-a-seat`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>What you send for a seat \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>What you send for a seat<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/what-you-send-for-a-seat"\s*\/>/);
  assert.match(html, /Send four things\./);
  assert.match(html, /A 7-day look is \$190 USD\. It does not burn a seat\./);
  assert.match(html, /<a href="https:\/\/birchreserve\.net">https:\/\/birchreserve\.net<\/a>/);
  assert.doesNotMatch(html, /\$4,?900|\$9,?900|Align 80/);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
  assert.match(index, /What you send for a seat/);
});

test("GET /insights/the-face-before-the-flight publishes the preview and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/the-face-before-the-flight`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>The face before the flight \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>The face before the flight<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/the-face-before-the-flight"\s*\/>/);
  assert.match(html, /You see the face before the flight\. The square still is the preview\./);
  assert.match(html, /A 7-day look is \$190 USD\. It does not burn a seat\./);
  assert.match(html, /<a href="https:\/\/birchreserve\.net">https:\/\/birchreserve\.net<\/a>/);
  assert.doesNotMatch(html, /\$4,?900|\$9,?900|Align 80|reserve-899/);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.match(index, /href="\/insights\/the-face-before-the-flight"/);
  assert.match(index, /The face before the flight/);
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
  assert.match(index, /href="\/insights\/the-shelf-after-the-receipt"/);
  assert.match(index, /href="\/insights\/after-booking-category-seats-scale-hubs"/);
});

test("GET /insights/one-card-names-the-category publishes the supplied copy and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/one-card-names-the-category`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>One card names the category \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>One card names the category<\/h1>/);
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/one-card-names-the-category"\s*\/>/);
  assert.match(html, /Carbon places one native card on the page the reader already opened\. One image\. One short line\. Not a feed\./);
  assert.match(html, /Birch places one card inside a signed hub\. The category names the card\. It sits after checkout, on a plan, or at a booking\./);
  assert.match(html, /The \$190 look is that card for 7 days\. It does not burn a seat\. It does not start a flight\. You see the card before the insertion order names the hub\./);
  assert.match(html, /Nothing runs on the look alone\./);
  assert.match(html, /RDG Digital Holdings builds Scale Health\. Birch Reserve is the media seat on that network\./);
  assert.match(html, /Start with the \$190 look\./);
  assert.doesNotMatch(html, /the-look-starts-itself|the-unit-belongs-to-the-protocol|reserve-899/);
  assert.doesNotMatch(html, /\bCTR\b|reach/i);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.match(index, /href="\/insights\/one-card-names-the-category"/);
  assert.match(index, /One card names the category/);
  assert.match(index, /href="\/insights\/the-face-before-the-flight"/);
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
});

test("GET /insights/the-zone-has-a-price publishes the supplied copy and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/the-zone-has-a-price`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>The zone has a price \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>The zone has a price<\/h1>/);
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/the-zone-has-a-price"\s*\/>/);
  assert.match(html, /BuySellAds sells named zones at a fixed price\. You do not enter an auction\./);
  assert.match(html, /Birch Reserve sells named category seats at a fixed price\. The \$490 seat is the zone\. The insertion order names the hub and the category before anything runs\./);
  assert.match(html, /The \$190 look is that zone for 7 days\. It does not burn a seat\. You see the price before the insertion order names the hub\./);
  assert.match(html, /Nothing runs on the look alone\./);
  assert.match(html, /RDG Digital Holdings builds Scale Health\. Birch Reserve is the media seat on that network\./);
  assert.match(html, /Start with the \$190 look\./);
  assert.doesNotMatch(html, /the-look-starts-itself|the-unit-belongs-to-the-protocol|reserve-899/);
  assert.doesNotMatch(html, /\bCTR\b|reach/i);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.match(index, /href="\/insights\/the-zone-has-a-price"/);
  assert.match(index, /The zone has a price/);
  assert.match(index, /href="\/insights\/one-card-names-the-category"/);
  assert.match(index, /href="\/insights\/the-face-before-the-flight"/);
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
  assert.match(index, /href="\/insights\/the-shelf-after-the-receipt"/);
  assert.match(index, /href="\/insights\/after-booking-category-seats-scale-hubs"/);
});

test("GET /insights/the-look-assembles-on-the-brief publishes the supplied copy and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/the-look-assembles-on-the-brief`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>The look assembles on the brief\. \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>The look assembles on the brief\.<\/h1>/);
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/the-look-assembles-on-the-brief"\s*\/>/);
  assert.match(html, /You build the square still on the creative brief\. You do not wait for the seat\./);
  assert.match(html, /The brief is the place the look starts\. The insertion order is the place it flies\./);
  assert.match(html, /RDG Digital Holdings Inc\. builds Scale Health Network Inc\. Birch Reserve is the prepaid seat on the hubs Scale brands open for their customers\./);
  assert.match(html, /The \$190 look does not burn a seat\. It lets you assemble the square before you decide\./);
  assert.doesNotMatch(html, /the-look-starts-itself|the-unit-belongs-to-the-protocol|reserve-899/);
  assert.doesNotMatch(html, /\bCTR\b|reach/i);
  assert.doesNotMatch(html, /Align|\$4,?900|\$9,?900/);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.equal(index.match(/<h2><a href="\/insights\//g)?.length, 10);
  assert.match(index, /href="\/insights\/the-square-sits-inside-the-hub-already-open"/);
  assert.match(index, /href="\/insights\/the-category-is-already-open"/);
  assert.match(index, /href="\/insights\/the-look-assembles-on-the-brief"/);
  assert.match(index, /The look assembles on the brief\./);
  assert.match(index, /href="\/insights\/the-zone-has-a-price"/);
  assert.match(index, /href="\/insights\/one-card-names-the-category"/);
  assert.match(index, /href="\/insights\/the-face-before-the-flight"/);
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
  assert.match(index, /href="\/insights\/the-shelf-after-the-receipt"/);
  assert.match(index, /href="\/insights\/after-booking-category-seats-scale-hubs"/);
});

test("GET /insights/the-category-is-already-open publishes the supplied copy and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/the-category-is-already-open`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>The category is already open\. \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>The category is already open\.<\/h1>/);
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/the-category-is-already-open"\s*\/>/);
  assert.match(html, /Amazon, Instacart, and Walmart place the brand on the aisle the shopper already opened\. The header sits where the category is already shopped\./);
  assert.match(html, /Birch Reserve sells the same shape inside a signed hub\. You do not build a new page\. The insertion order names the hub and the category the member already has open\./);
  assert.match(html, /RDG Digital Holdings Inc\. builds Scale Health Network Inc\. Birch Reserve is the prepaid seat on the hubs Scale brands open for their customers\./);
  assert.match(html, /The \$190 look does not burn a seat\. It lets you see the open aisle before you decide\./);
  assert.doesNotMatch(html, /the-look-starts-itself|the-unit-belongs-to-the-protocol|reserve-899/);
  assert.doesNotMatch(html, /\bCTR\b|reach/i);
  assert.doesNotMatch(html, /Align|\$4,?900|\$9,?900/);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.equal(index.match(/<h2><a href="\/insights\//g)?.length, 10);
  assert.match(index, /href="\/insights\/the-square-sits-inside-the-hub-already-open"/);
  assert.match(index, /href="\/insights\/the-category-is-already-open"/);
  assert.match(index, /The category is already open\./);
  assert.match(index, /href="\/insights\/the-look-assembles-on-the-brief"/);
  assert.match(index, /The look assembles on the brief\./);
  assert.match(index, /href="\/insights\/the-zone-has-a-price"/);
  assert.match(index, /href="\/insights\/one-card-names-the-category"/);
  assert.match(index, /href="\/insights\/the-face-before-the-flight"/);
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
  assert.match(index, /href="\/insights\/the-shelf-after-the-receipt"/);
  assert.match(index, /href="\/insights\/after-booking-category-seats-scale-hubs"/);
  assert.doesNotMatch(index, /the-look-starts-itself/);
  const unpublished = await fetch(`${origin}/insights/the-look-starts-itself`);
  assert.equal(unpublished.status, 404);
});

test("GET /insights/the-square-sits-inside-the-hub-already-open publishes the supplied copy and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/the-square-sits-inside-the-hub-already-open`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>The square sits inside the hub already open\. \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>The square sits inside the hub already open\.<\/h1>/);
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/the-square-sits-inside-the-hub-already-open"\s*\/>/);
  assert.match(html, /LiveIntent places the unit inside the newsletter the reader already opened\. You do not open a new tab\./);
  assert.match(html, /Birch Reserve sells the same shape inside a signed hub\. The square sits on the page the member already has open\. After the booking\. On the plan\. In the category\./);
  assert.match(html, /RDG Digital Holdings Inc\. builds Scale Health Network Inc\. Birch Reserve is the prepaid seat on the hubs Scale brands open for their customers\./);
  assert.match(html, /The \$190 look does not burn a seat\. It lets you see the open hub before you decide\./);
  assert.doesNotMatch(html, /the-look-starts-itself|the-unit-belongs-to-the-protocol|reserve-899/);
  assert.doesNotMatch(html, /\bCTR\b|reach/i);
  assert.doesNotMatch(html, /Align|\$4,?900|\$9,?900/);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.equal(index.match(/<h2><a href="\/insights\//g)?.length, 10);
  assert.match(index, /href="\/insights\/the-square-sits-inside-the-hub-already-open"/);
  assert.match(index, /The square sits inside the hub already open\./);
  assert.match(index, /href="\/insights\/the-category-is-already-open"/);
  assert.match(index, /The category is already open\./);
  assert.match(index, /href="\/insights\/the-look-assembles-on-the-brief"/);
  assert.match(index, /The look assembles on the brief\./);
  assert.match(index, /href="\/insights\/the-zone-has-a-price"/);
  assert.match(index, /href="\/insights\/one-card-names-the-category"/);
  assert.match(index, /href="\/insights\/the-face-before-the-flight"/);
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
  assert.match(index, /href="\/insights\/the-shelf-after-the-receipt"/);
  assert.match(index, /href="\/insights\/after-booking-category-seats-scale-hubs"/);
  assert.doesNotMatch(index, /the-look-starts-itself/);
  const unpublished = await fetch(`${origin}/insights/the-look-starts-itself`);
  assert.equal(unpublished.status, 404);
  const categoryStillLive = await fetch(`${origin}/insights/the-category-is-already-open`);
  assert.equal(categoryStillLive.status, 200);
});

test("GET /insights/the-card-stays-on-the-page publishes the supplied copy and stays on the index", async () => {
  const articleRes = await fetch(`${origin}/insights/the-card-stays-on-the-page`);
  assert.equal(articleRes.status, 200);
  const html = await articleRes.text();
  assert.match(html, /<title>The card stays on the page\. \| Birch Reserve<\/title>/);
  assert.match(html, /<h1>The card stays on the page\.<\/h1>/);
  assert.equal(html.match(/<h1>/g)?.length, 1);
  assert.match(html, /October 26, 2026/);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/insights\/the-card-stays-on-the-page"\s*\/>/);
  assert.match(html, /Carbon places one native card on the page the reader already opened\. One square\. One short line\. Not a feed\./);
  assert.match(html, /Birch Reserve works the same way\. The unit is one card on the hub page the visitor already opened\. The card stays small enough that the hub remains the page\. You do not send them to a new tab\./);
  assert.match(html, /RDG Digital Holdings Inc\. builds Scale Health Network Inc\. Birch Reserve is the prepaid seat on the hubs Scale brands open for their customers\./);
  assert.match(html, /The \$190 look does not burn a seat\. It lets you see the card before you lock the category\./);
  assert.doesNotMatch(html, /the-still-starts-on-the-brief|the-unit-matches-the-recovery-already-open|the-look-starts-itself|the-unit-belongs-to-the-protocol|reserve-899/);
  assert.doesNotMatch(html, /\bCTR\b|reach/i);
  assert.doesNotMatch(html, /Align|\$4,?900|\$9,?900|\$49 ICA/);
  const index = await (await fetch(`${origin}/insights`)).text();
  assert.equal(index.match(/<h2><a href="\/insights\//g)?.length, 10);
  assert.match(index, /href="\/insights\/the-card-stays-on-the-page"/);
  assert.match(index, /The card stays on the page\./);
  assert.match(index, /October 26, 2026/);
  assert.match(index, /href="\/insights\/the-square-sits-inside-the-hub-already-open"/);
  assert.match(index, /The square sits inside the hub already open\./);
  assert.match(index, /href="\/insights\/the-category-is-already-open"/);
  assert.match(index, /href="\/insights\/the-look-assembles-on-the-brief"/);
  assert.match(index, /href="\/insights\/the-zone-has-a-price"/);
  assert.match(index, /href="\/insights\/one-card-names-the-category"/);
  assert.match(index, /href="\/insights\/the-face-before-the-flight"/);
  assert.match(index, /href="\/insights\/what-you-send-for-a-seat"/);
  assert.match(index, /href="\/insights\/the-shelf-after-the-receipt"/);
  assert.match(index, /href="\/insights\/after-booking-category-seats-scale-hubs"/);
  assert.doesNotMatch(index, /the-still-starts-on-the-brief|the-unit-matches-the-recovery-already-open|the-look-starts-itself/);
  const unpublishedStill = await fetch(`${origin}/insights/the-still-starts-on-the-brief`);
  assert.equal(unpublishedStill.status, 404);
  const unpublishedUnit = await fetch(`${origin}/insights/the-unit-matches-the-recovery-already-open`);
  assert.equal(unpublishedUnit.status, 404);
  const squareStillLive = await fetch(`${origin}/insights/the-square-sits-inside-the-hub-already-open`);
  assert.equal(squareStillLive.status, 200);
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
  assert.match(html, /This is the place\. Not a view chart\. Illustrative until the insertion order names the hub\./);
  assert.match(html, /The unit is one card on a page the visitor already opened\. You do not send them to a new feed\. The card stays small enough that the hub page remains the page\.<\/p>\s*<p class="sh-proof">The category is the named zone\. You do not buy an open slot\. The insertion order names the hub and the category before anything runs\.<\/p>\s*<p class="sh-proof">The look is the preview\. You assemble the square still on the creative brief\. Nothing on the hub changes until the insertion order names the hub\.<\/p>\s*<p class="sh-proof">The header is the placement\. You sit in the category the visitor already opened\. You do not create a new search\.<\/p>\s*<p class="sh-proof">You see the face before the flight\. The square still is the preview\. Nothing on the hub changes until the insertion order names the hub\.<\/p>\s*<p class="sh-proof">One card names the category\. The card sits on the hub page the visitor already opened\.<\/p>\s*<p class="sh-proof">The zone has a price\. You do not bid for the category\. The \$490 is the named seat\.<\/p>\s*<p class="sh-proof">The look assembles on the brief\. You do not wait for the \$490 to start the square\.<\/p>\s*<p class="sh-proof">The category is already open\. You sit where the member is already shopping\. The \$490 is the header on that aisle\.<\/p>\s*<p class="sh-proof">The square sits inside the hub already open\. You approve the still on the brief\. The \$490 names the category\.<\/p>\s*<p class="sh-proof">The card stays on the page the visitor already opened\. One square\. Not a feed\. The \$490 names the category\.<\/p>/);
  assert.match(html, /Lock one category inside signed health hubs\. Not an open auction\./);
  assert.match(html, /No impression guarantee/);
  assert.doesNotMatch(html, /exclusiv/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/buycalc"\s*\/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/birchreserve\.net\/og-birch-reserve\.png"\s*\/>/);
  assert.doesNotMatch(html, /minimum goes up/);
  assert.doesNotMatch(html, /today's minimum/);
  const openStrip = html.match(/<ul class="cat-strip"[^>]*>[\s\S]*?<\/ul>/)?.[0] ?? "";
  assert.match(openStrip, /data-source="\/availability\.json" data-seats-open="3"/);
  assert.equal((openStrip.match(/href="\/buycalc\?sku=hold-190"/g) ?? []).length, 8);
  const closed = renderBuycalcHtml({ seatsOpen: 0, seatsTotal: 8 });
  const closedStrip = closed.match(/<ul class="cat-strip"[^>]*>[\s\S]*?<\/ul>/)?.[0] ?? "";
  assert.match(closedStrip, /data-seats-open="0"/);
  assert.equal((closedStrip.match(/<li>/g) ?? []).length, 8);
  assert.doesNotMatch(closedStrip, /href=/);
  assert.doesNotMatch(html, /8\.7M|56M monthly views|20M\+|100M\+ orders/);
  assert.doesNotMatch(html, /reserve-899/);
  const skuOptions = html.match(/<select name="sku">([\s\S]*?)<\/select>/)?.[1] ?? "";
  assert.equal((skuOptions.match(/<option /g) ?? []).length, 2);
  assert.match(skuOptions, /value="hold-190"/);
  assert.match(skuOptions, /value="reserve-490"/);
});

test("catalog and llms.txt use plain lock language", async () => {
  const llms = await (await fetch(`${origin}/llms.txt`)).text();
  const catalog = JSON.stringify(await (await fetch(`${origin}/v1/catalog.json`)).json());
  for (const body of [llms, catalog]) {
    assert.match(body, /Lock in your slot\./);
    assert.doesNotMatch(body, /minimum goes up/);
    assert.doesNotMatch(body, /today's minimum/);
  }
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

test("availability and buycalc stay up when Postgres cannot answer the seat query", async () => {
  const availability = await fetch(`${origin}/v1/availability.json`);
  assert.equal(availability.status, 200);
  assert.match(availability.headers.get("content-type") ?? "", /application\/json/);
  const body = (await availability.json()) as Record<string, unknown>;
  assert.equal(body.seats_total, 8);
  assert.equal(body.seats_paid, 0);
  assert.equal(body.seats_held, 0);
  assert.equal(body.seats_open, 8);
  assert.equal(body.currency, "USD");
  assert.equal(body.default_sku, "reserve-490");
  assert.equal(body.inventory_model, "shared_reserve_pool");
  assert.deepEqual(body.skus, ["hold-190", "reserve-490"]);

  const buy = await fetch(`${origin}/buycalc`);
  assert.equal(buy.status, 200);
  assert.match(buy.headers.get("content-type") ?? "", /^text\/html/);
  const html = await buy.text();
  assert.match(html, /8 categories open/);
  assert.match(html, /The category is the named zone\. You do not buy an open slot\. The insertion order names the hub and the category before anything runs\./);
  assert.match(html, /The look is the preview\. You assemble the square still on the creative brief\. Nothing on the hub changes until the insertion order names the hub\./);
  assert.match(html, /The header is the placement\. You sit in the category the visitor already opened\. You do not create a new search\./);
  assert.match(html, /You see the face before the flight\. The square still is the preview\. Nothing on the hub changes until the insertion order names the hub\.<\/p>\s*<p class="sh-proof">One card names the category\. The card sits on the hub page the visitor already opened\.<\/p>\s*<p class="sh-proof">The zone has a price\. You do not bid for the category\. The \$490 is the named seat\.<\/p>\s*<p class="sh-proof">The look assembles on the brief\. You do not wait for the \$490 to start the square\.<\/p>\s*<p class="sh-proof">The category is already open\. You sit where the member is already shopping\. The \$490 is the header on that aisle\.<\/p>\s*<p class="sh-proof">The square sits inside the hub already open\. You approve the still on the brief\. The \$490 names the category\.<\/p>\s*<p class="sh-proof">The card stays on the page the visitor already opened\. One square\. Not a feed\. The \$490 names the category\./);
  assert.doesNotMatch(html, /reserve-899/);
  assert.doesNotMatch(html, /id="root"/);
});

test("GET /v1/placements stays 200 when Postgres cannot be reached", async () => {
  const res = await fetch(`${origin}/v1/placements?status=open`);
  assert.equal(res.status, 200);
  const rows = (await res.json()) as Array<{ id?: string; format?: string; reserve_url?: string }>;
  assert.deepEqual(rows.map((row) => row.format), [
    "post_checkout",
    "recovery_plan",
    "scheduled_service",
    "member_hub",
    "motion_15s",
  ]);
  assert.deepEqual(rows.map((row) => row.id), [
    "birch-reserve-post_checkout",
    "birch-reserve-recovery_plan",
    "birch-reserve-scheduled_service",
    "birch-reserve-member_hub",
    "birch-reserve-motion_15s",
  ]);
  assert.equal(rows.every((row) => row.reserve_url?.startsWith("/buycalc?format=")), true);
});

test("splash expiry cron answers 200 when Postgres cannot be reached", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "seo-cron-secret";
  try {
    const denied = await fetch(`${origin}/api/cron/splash-expiry`);
    assert.equal(denied.status, 401);
    const ok = await fetch(`${origin}/api/cron/splash-expiry`, {
      headers: { authorization: "Bearer seo-cron-secret" },
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { ok?: boolean; degraded?: boolean; expiredUnpaid?: number };
    assert.equal(body.ok, true);
    assert.equal(body.degraded, true);
    assert.equal(body.expiredUnpaid, 0);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
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
