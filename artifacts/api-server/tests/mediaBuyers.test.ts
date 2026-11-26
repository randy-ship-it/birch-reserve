import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MB_BUY_CHECKLIST, MB_BUY_PATHS, MEASUREMENT_STEPS, MEDIA_BUYER_FAQ, MIX_ROWS } from "../src/lib/overhaul/mediaBuyers";
import { OVERHAUL_ROUTES, llmsTxt } from "../src/lib/overhaul/seo";
import { PUBLIC_SITEMAP_PATHS, SPA_SHELL_PATHS } from "../src/lib/publicSeo";

const read = (f: string) => readFileSync(resolve(process.cwd(), f), "utf8");
const PAGE = "../clinichub-media/src/pages/br/media-buyers.tsx";

/** Everything a visitor can read on /media-buyers, page source plus shared copy. */
function allCopy(): string {
  return [
    read(PAGE),
    JSON.stringify(MIX_ROWS),
    JSON.stringify(MB_BUY_PATHS),
    JSON.stringify(MB_BUY_CHECKLIST),
    JSON.stringify(MEASUREMENT_STEPS),
    JSON.stringify(MEDIA_BUYER_FAQ),
    JSON.stringify(OVERHAUL_ROUTES["/media-buyers"]),
  ].join("\n");
}

test("/media-buyers (Nov 18 2026): routed, indexable, crawlable shell, linked from /agencies, /media-kit and llms.txt", () => {
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/media-buyers"));
  assert.ok((SPA_SHELL_PATHS as readonly string[]).includes("/media-buyers"));
  assert.match(read("../clinichub-media/src/App.tsx"), /<Route path="\/media-buyers">/);
  assert.match(read("../../scripts/vercel-build.mjs"), /"\/media-buyers\/\?"/);
  assert.match(read("../clinichub-media/src/pages/br/agencies.tsx"), /href="\/media-buyers#display-mix"/);
  assert.match(read("../clinichub-media/src/pages/br/media-kit.tsx"), /href="\/media-buyers"/);
  assert.match(llmsTxt(), /birchreserve\.net\/media-buyers/);
});

test("/media-buyers: same two USD offers and the same refund / IO rules; USD only", () => {
  const copy = allCopy();
  assert.match(copy, /\$190 USD 7-day look/);
  assert.match(copy, /\$490 USD/);
  assert.match(copy, /fully refundable until 14 days before/);
  assert.match(copy, /nothing runs until (the|an) insertion order/i);
  assert.match(read(PAGE), /<BuyPaths\b/);
  assert.doesNotMatch(copy, /\bCAD\b|C\$/);
  assert.doesNotMatch(copy, /\$(?!190\b|490\b)\d[\d,]*/, "no new price points on /media-buyers");
});

test("/media-buyers: no impression guarantees, CTR or ROAS claims, partner counts or off-limits names", () => {
  const copy = allCopy();
  assert.match(copy, /No impression guarantees/);
  assert.match(copy, /Modelled/);
  assert.doesNotMatch(copy, /guaranteed (views|impressions|delivery)/i);
  assert.doesNotMatch(copy, /\d+(\.\d+)?\s*%\s*(CTR|click-through|ROAS|lift|conversion)/i);
  assert.doesNotMatch(copy, /\d+(\.\d+)?x\s*ROAS/i);
  assert.doesNotMatch(copy, /\bsigned partners?\b/i);
  assert.doesNotMatch(copy, /20MM\+|\b42\b|80 locations/);
  assert.doesNotMatch(copy, /Align|Clairvoyant|Alset|Kalaya/);
});

test("/media-buyers: one server-side FAQPage plus Service and the two Offers", () => {
  const meta = OVERHAUL_ROUTES["/media-buyers"].jsonld as { "@graph": Array<Record<string, unknown>> };
  const graph = meta["@graph"];
  assert.equal(graph.filter((n) => n["@type"] === "FAQPage").length, 1);
  assert.equal(graph.filter((n) => n["@type"] === "Service").length, 1);
  const skus = graph.filter((n) => n["@type"] === "Product").map((n) => n.sku);
  assert.deepEqual(skus, ["hold-190", "reserve-490"]);
  const faq = graph.find((n) => n["@type"] === "FAQPage") as { mainEntity: unknown[] };
  assert.equal(faq.mainEntity.length, MEDIA_BUYER_FAQ.length);
  assert.match(read(PAGE), /<Faq items=\{MEDIA_BUYER_FAQ\} schema=\{false\} \/>/);
});

test("/media-buyers (Nov 25 2026): 'Two ways to buy' compare replaces the duplicate offers block; no agency row", () => {
  const page = read(PAGE);
  assert.doesNotMatch(page, /Same two offers as every buyer/);
  assert.doesNotMatch(page, /<StarterOffers /);
  assert.match(page, /Two ways to buy\./);
  assert.match(page, /insertion order \(IO\)/);
  assert.deepEqual(MB_BUY_PATHS.rows.map((r) => r.k), ["Best for", "Pay", "Before it runs", "Refunds"]);
  assert.doesNotMatch(JSON.stringify(MB_BUY_PATHS), /agency|discount|client/i);
  assert.match(MB_BUY_PATHS.io.kicker, /insertion order \(IO\)/);
});

test("/media-buyers: 'What to check before you buy' is six published answers under Two ways to buy", () => {
  assert.equal(MB_BUY_CHECKLIST.length, 6);
  assert.deepEqual(
    MB_BUY_CHECKLIST.map((r) => r.label),
    ["Where it shows", "Controls", "Cost", "Refunds", "Tracking", "Reporting"],
  );
  const byLabel = Object.fromEntries(MB_BUY_CHECKLIST.map((r) => [r.label, r.answer]));
  assert.equal(byLabel["Where it shows"], "Four placements: post-purchase (premium, by IO), hub home page, product / services pages, member dashboard behind login. The IO names the hub, surface, format and dates.");
  assert.equal(byLabel["Controls"], "Nothing runs until you approve an insertion order naming the hub, placement and flight dates. No open web, no user-generated content, no programmatic resale.");
  assert.equal(byLabel["Cost"], "From {look} for a 7-day look, or the {reserve} category placement by card. Premium and several hubs by IO.");
  assert.equal(byLabel["Refunds"], "The category placement is media credit, fully refundable until 14 days before the launch date on the IO. The look converts in full to the category placement within 7 days, or it's refunded.");
  assert.equal(byLabel["Tracking"], "Your UTM links and promo codes. No clinical pixels and no patient data on hub pages.");
  assert.equal(byLabel["Reporting"], "Aggregate views and clicks per hub and surface, plus UTM visits and redemptions. Pre-launch figures are labelled Modelled. No impression guarantees.");

  const published = JSON.stringify(MB_BUY_CHECKLIST);
  const claims = published.replaceAll("No impression guarantees", "");
  assert.doesNotMatch(claims, /guarantee/i);
  assert.doesNotMatch(published, /signed partner/i);
  assert.doesNotMatch(published, /Align|Clairvoyant|80 locations/);
  assert.doesNotMatch(published, /\$(?!190\b|490\b|270\b|690\b)\d[\d,]*/);
  assert.doesNotMatch(published, /\$\d/, "checklist copy names no price; the page fills {look} and {reserve} from the live price labels");

  const page = read(PAGE);
  const buy = page.indexOf("Two ways to buy.");
  const paths = page.indexOf('testId="mb-buy-paths"');
  const check = page.indexOf('data-testid="mb-buy-checklist"');
  const steps = page.indexOf("Six steps. Nothing runs before the IO.");
  assert.ok(buy !== -1 && paths !== -1 && check !== -1 && steps !== -1);
  assert.ok(buy < paths && paths < check && check < steps);
  const openTag = page.slice(page.lastIndexOf("<details", check), check);
  assert.doesNotMatch(openTag, /\bopen\b/);
  assert.match(page, /priceLabel\("hold-190", currency, prices\)/);
  assert.match(page, /priceLabel\("reserve-490", currency, prices\)/);
  assert.match(page, /replaceAll\("\{look\}", look\)/);
  assert.match(page, /replaceAll\("\{reserve\}", reserve\)/);
});
