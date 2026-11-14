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
import { FOLDED_INSIGHT_TARGET_SLUG, FOLDED_PUBLIC_INSIGHT_SLUGS, PUBLIC_INSIGHT_ARTICLES } from "@workspace/db";
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
  assert.doesNotMatch(xml, /\/advertise<\/loc>/);
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
  assert.doesNotMatch(xml, /the-zone-is-locked-by-the-buyer/);
});

test("server HTML and SPA shells expose canonical, og:url, og:image, and twitter:card", async () => {
  const pages: Array<[string, string]> = [
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
  // /kit is an alias of the one-link media kit (Randy, Nov 13 2026 9:41 PM ET).
  const kitRedirect = await fetch(`${origin}/kit?utm_source=email`, { redirect: "manual" });
  assert.equal(kitRedirect.status, 302);
  assert.equal(kitRedirect.headers.get("location"), "/media-kit?utm_source=email");
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
      assert.match(html, /The look does not burn a seat/);
      assert.match(html, /The seat is the named category/);
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

test("near-duplicate filler insights are folded: 301 to one article, off the index and the sitemap", async () => {
  assert.equal(FOLDED_PUBLIC_INSIGHT_SLUGS.length, 21);
  const index = await (await fetch(`${origin}/insights`)).text();
  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  for (const slug of FOLDED_PUBLIC_INSIGHT_SLUGS) {
    const res = await fetch(`${origin}/insights/${slug}`, { redirect: "manual" });
    assert.equal(res.status, 301, slug);
    assert.equal(res.headers.get("location"), `/insights/${FOLDED_INSIGHT_TARGET_SLUG}`);
    assert.doesNotMatch(index, new RegExp(`/insights/${slug}"`));
    assert.doesNotMatch(sitemap, new RegExp(`/insights/${slug}<`));
  }
  assert.doesNotMatch(index, /is the stamp|names the category|already opened/);
  for (const article of PUBLIC_INSIGHT_ARTICLES) {
    const res = await fetch(`${origin}/insights/${article.slug}`);
    assert.equal(res.status, 200, article.slug);
    assert.match(index, new RegExp(`href="/insights/${article.slug}"`));
  }
  const rejectedZone = await fetch(`${origin}/insights/the-zone-is-locked-by-the-buyer`);
  assert.equal(rejectedZone.status, 404);
});

test("buycalc HTML is one short, clean buy path with broad network copy and no price-rise line", () => {
  const html = renderBuycalcHtml({ seatsOpen: 3, seatsTotal: 8, sku: "hold-190", format: "post_checkout", category: "sleep" });
  assert.match(html, /\$490 USD/);
  assert.match(html, /\$190 USD/);
  assert.match(html, /<article class="offer is-selected" data-sku="hold-190">/);
  assert.match(html, /<article class="offer" data-sku="reserve-490">/);
  // Randy, Nov 14 2026: no public category picker; a ?category= deep link rides along as a hidden field.
  assert.match(html, /<input type="hidden" name="category" value="sleep">/);
  assert.doesNotMatch(html, /id="f-cat"|id="r-cat"|Pick a category|Request a category/);
  // PREMIUM_INQUIRE_ONLY (Nov 12 2026): Post-Purchase stays selectable but is marked inquire-only.
  assert.match(html, /<option value="post_checkout" selected data-inquire="1">After checkout · Inquire<\/option>/);
  assert.match(html, /id="inquire-note" hidden>This is a premium slot and is inquire-only/);
  assert.match(renderBuycalcHtml({ seatsOpen: 3, seatsTotal: 8 }), /<option value="recovery_plan" selected>/);
  assert.match(html, /<a href="https:\/\/physio\.drhonow\.com"/);
  assert.match(html, /Public benchmark<\/span>Not a Birch result/);
  // Randy, Nov 12 2026: the repeated filler lines and the raw quote JSON button are gone.
  assert.doesNotMatch(html, /sh-proof|is the stamp|names the category\.|the square|already opened|Copy quote JSON|id="seat-calc"/);
  assert.equal((html.match(/fully refundable until 14 days before your launch date/gi) ?? []).length, 2);
  assert.doesNotMatch(html, /The zone is locked by the buyer/);
  assert.match(html, /Put your brand inside private health and wellness hubs\. No bidding\./);
  assert.match(html, /Limited early placements/);
  assert.doesNotMatch(html, /seats open|8 categories|Eight categories|Recovery hardware|One of 8/i);
  assert.match(html, /id="catreq"/);
  assert.match(html, /href="tel:\+16479316278"/);
  assert.match(html, /No impression guarantee/);
  assert.doesNotMatch(html, /exclusiv/i);
  assert.doesNotMatch(html, /Align|Clairvoyant|Kalaya|80 locations/);
  assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/buycalc"\s*\/>/);
  assert.match(html, /<meta property="og:image" content="https:\/\/birchreserve\.net\/og-birch-reserve\.png"\s*\/>/);
  assert.doesNotMatch(html, /minimum goes up/);
  assert.doesNotMatch(html, /today's minimum/);
  const strip = html.match(/<ul class="cat-strip"[^>]*>[\s\S]*?<\/ul>/)?.[0] ?? "";
  assert.match(strip, /Scale Health/);
  assert.match(strip, /More hubs launching/);
  const closed = renderBuycalcHtml({ seatsOpen: 0, seatsTotal: 8 });
  assert.doesNotMatch(closed, /0 of 8|seats open/);
  assert.match(closed, /<article class="offer is-selected" data-sku="reserve-490">/);
  assert.doesNotMatch(html, /8\.7M|56M monthly views|20M\+|100M\+ orders/);
  assert.doesNotMatch(html, /reserve-899/);
  const skuOptions = html.match(/<select id="f-sku" name="sku">([\s\S]*?)<\/select>/)?.[1] ?? "";
  assert.equal((skuOptions.match(/<option /g) ?? []).length, 2);
  assert.match(skuOptions, /value="hold-190" selected/);
  assert.match(skuOptions, /value="reserve-490"/);
  // Checkout stays held unless the live flag says otherwise.
  assert.match(html, /Reserve my seat · no charge today/);
  assert.match(html, /No card is charged\./);
  const live = renderBuycalcHtml({ seatsOpen: 3, seatsTotal: 8, sku: "reserve-490", checkoutLive: true });
  assert.match(live, /Continue to secure checkout · \$490 USD/);
  const cad = renderBuycalcHtml({ seatsOpen: 3, seatsTotal: 8, sku: "reserve-490", currency: "cad" });
  assert.match(cad, /\$690 CAD/);
  assert.match(cad, /\$270 CAD/);
  assert.doesNotMatch(cad, /\$490|\$190/);
});

test("catalog and llms.txt use plain lock language", async () => {
  const llms = await (await fetch(`${origin}/llms.txt`)).text();
  const catalog = JSON.stringify(await (await fetch(`${origin}/v1/catalog.json`)).json());
  for (const body of [llms, catalog]) {
    assert.match(body, /Prepay your category\./);
    assert.doesNotMatch(body, /the-zone-is-locked-by-the-buyer/);
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
  assert.match(html, /Limited early placements/);
  assert.match(html, /The insertion order names the hub and placement before anything runs\./);
  assert.doesNotMatch(html, /sh-proof|is the stamp|Copy quote JSON/);
  assert.doesNotMatch(html, /The zone is locked by the buyer/);
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

function homeOffer(html: string): { price: string; priceCurrency: string } {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
  const block = blocks.find((b) => b.includes("reserve-490"));
  assert.ok(block, "home JSON-LD with the reserve-490 offer");
  const data = JSON.parse(block!);
  return data.itemListElement[0].item.offers;
}

test("GET / serves the Offer JSON-LD in the visitor's currency (CA -> CAD, else USD, ?currency wins)", async () => {
  const cases: Array<[string, Record<string, string>, string, string]> = [
    ["/", { "x-vercel-ip-country": "CA" }, "690", "CAD"],
    ["/", { "x-vercel-ip-country": "US" }, "490", "USD"],
    ["/", {}, "490", "USD"],
    ["/?currency=cad", { "x-vercel-ip-country": "US" }, "690", "CAD"],
    ["/?currency=usd", { "x-vercel-ip-country": "CA" }, "490", "USD"],
  ];
  for (const [path, headers, price, cur] of cases) {
    const res = await fetch(`${origin}${path}`, { headers });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("vary") ?? "", /x-vercel-ip-country/i);
    const html = await res.text();
    const offer = homeOffer(html);
    assert.equal(offer.price, price, `${path} ${JSON.stringify(headers)}`);
    assert.equal(offer.priceCurrency, cur);
    assert.doesNotMatch(html, /early placement/i);
  }
});

test("/buycalc seat picker: no public reach figure, no CTR, click or order assumptions, no 'signed' hubs", () => {
  for (const currency of ["usd", "cad"] as const) {
    const html = renderBuycalcHtml({ seatsOpen: 8, seatsTotal: 8, currency });
    assert.doesNotMatch(html, /id="seat-calc"|\/inventory\/api\/tam/);
    assert.doesNotMatch(html, /Modelled monthly views in your category surface|Illustrative 2027|128\s?MM|80% of listed partner surfaces/);
    assert.doesNotMatch(html, /CTR|click-to-order|Click-to-order|Scenario clicks|Scenario orders|sc-surf|sc-band/);
    assert.doesNotMatch(html, /0\.08|0\.25 \/ 0\.45|4\.00%/);
    assert.doesNotMatch(html, /\bsigned (?:Scale Health|hubs?|partner)/i);
    assert.doesNotMatch(html, /bonus-tier-draft/);
    assert.match(html, /refundable until 14 days before|14 days before your launch date/i);
  }
});

test("the volume-bonus draft renders only with the draft flag, in the page currency, and keeps the base price", () => {
  const off = renderBuycalcHtml({ seatsOpen: 8, seatsTotal: 8, currency: "cad" });
  assert.doesNotMatch(off, /Volume prepay bonus/);
  const cad = renderBuycalcHtml({ seatsOpen: 8, seatsTotal: 8, currency: "cad", draftBonus: true });
  assert.match(cad, /Draft · not for sale/);
  assert.match(cad, /\$2,100 CAD/);
  assert.match(cad, /\$2,205 CAD/);
  assert.match(cad, /\$9,660 CAD/);
  assert.match(cad, /\$690 CAD/);
  assert.match(cad, /<meta name="robots" content="noindex">/);
  const usd = renderBuycalcHtml({ seatsOpen: 8, seatsTotal: 8, currency: "usd", draftBonus: true });
  assert.match(usd, /\$1,575 USD/);
  assert.match(usd, /\$6,900 USD/);
  assert.match(usd, /13\.0%/);
  assert.match(usd, /\$490 USD/);
});
