import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MB_BUY_PATHS, MEASUREMENT_STEPS, MEDIA_BUYER_FAQ, MIX_ROWS } from "../src/lib/overhaul/mediaBuyers";
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
