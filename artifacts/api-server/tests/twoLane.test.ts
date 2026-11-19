import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BLOCK_BANDS,
  LIVE_TERMS,
  PAYMENT_METHODS_LINE,
  REMIT_LINE,
  TERM_CHIPS,
  TWO_LANE_CATEGORIES,
  agencyCashLabel,
  agencyTestLeadPayload,
  bandAmountLabel,
  blockLeadPayload,
  draftRef,
  quickReserveCheckoutBody,
  quickReserveHref,
  validFlight,
} from "../src/lib/twoLane";
import { BUYCALC_CATEGORIES, renderBuycalcHtml } from "../src/routes/publicBuying";
import { isIntakeEvent } from "../src/lib/intakeEvents";

const read = (f: string) => readFileSync(resolve(process.cwd(), f), "utf8");
const UI = read("../clinichub-media/src/components/br/two-lane.tsx");
const IO = read("../clinichub-media/src/lib/ioDraft.ts");
const PAGE = read("../clinichub-media/src/pages/br/intake.tsx");
const PAGES = read("src/routes/publicPages.ts");
const CHECKOUT = read("src/routes/publicBuying.ts");
const OVERHAUL = read("src/routes/overhaul.ts");

test("categories match the checkout's BUYCALC_CATEGORIES exactly", () => {
  assert.deepEqual(TWO_LANE_CATEGORIES.map((c) => [c.slug, c.label]), BUYCALC_CATEGORIES.map((c) => [c.slug, c.label]));
});

test("Lane A hands off to the existing /buycalc card checkout, USD, no personal data in the URL", () => {
  const href = quickReserveHref("hold-190", "sleep");
  assert.match(href, /^\/buycalc\?sku=hold-190&currency=usd&category=sleep&utm_source=birchreserve&utm_medium=intake&utm_campaign=two-lane-hold-190#reserve$/);
  assert.equal(quickReserveHref("reserve-490", "nope"), "/buycalc?sku=reserve-490&currency=usd&utm_source=birchreserve&utm_medium=intake&utm_campaign=two-lane-reserve-490#reserve");
  assert.doesNotMatch(href, /email|brand|@/);
  // The checkout page reads the sku + category from the query and prefills brand/email from sessionStorage.
  const html = renderBuycalcHtml({ seatsOpen: 3, seatsTotal: 8, sku: "hold-190", category: "sleep" });
  assert.match(html, /<option value="hold-190" selected>/);
  assert.match(html, /<input type="hidden" name="category" value="sleep">/);
  assert.match(html, /sessionStorage\.getItem\("br_quick_reserve"\)/);
  assert.match(html, /sessionStorage\.removeItem\("br_quick_reserve"\)/);
  assert.match(html, /id="terms" type="checkbox" required/);
});

test("checkout body uses only keys the /v1/checkout handler allows", () => {
  const body = quickReserveCheckoutBody({ sku: "reserve-490", email: " A@B.co ", brand: " Acme ", category: "sleep", idempotencyKey: "abcdefgh12" });
  assert.deepEqual(body, { sku: "reserve-490", email: "a@b.co", brand: "Acme", currency: "usd", idempotency_key: "abcdefgh12", category: "sleep" });
  const allowed = /const allowedKeys = new Set\(\[([\s\S]*?)\]\)/.exec(CHECKOUT)![1]!;
  for (const k of Object.keys(body)) assert.ok(allowed.includes(`"${k}"`), k);
});

test("refund lines are the live /terms wording, unchanged", () => {
  assert.ok(PAGES.includes(LIVE_TERMS.look));
  assert.ok(PAGES.includes(LIVE_TERMS.reserve));
  assert.ok(PAGES.includes(LIVE_TERMS.io));
  for (const chip of TERM_CHIPS) assert.ok(/Fully refundable until 14 days before|100% (display|media) credit|Nothing runs until/.test(chip), chip);
});

test("Lane B: bands, lead payload on the existing /v1/leads kinds, draft IO says cheque/wire/EFT and no bank details", () => {
  assert.deepEqual(BLOCK_BANDS.map((b) => b.label), ["$10K", "$25K–$50K", "$100K+"]);
  assert.equal(bandAmountLabel("category_lock"), "$25,000–$50,000 USD");
  assert.equal(bandAmountLabel("network_100k"), "$100,000+ USD");
  assert.equal(agencyCashLabel("category_lock"), "$2,500–$5,000 USD");
  assert.equal(agencyCashLabel("test_10k"), "$1,000 USD");
  const p = blockLeadPayload({ band: "test_10k", flightStart: "2027-01-05", flightEnd: "2027-02-05", client: "Acme", agency: "Ad Co", email: "x@y.co" }, "BR-IO-1");
  assert.equal(p.kind, "premium_inquiry");
  assert.equal(p.fields.lane, "big_block");
  assert.equal(p.company, "Ad Co for Acme");
  for (const k of Object.keys(p.fields)) assert.match(k, /^[a-z_]{2,40}$/);
  const a = agencyTestLeadPayload({ email: "x@y.co", agency: "Ad Co", client: "Acme" });
  assert.equal(a.kind, "agency_inquiry");
  for (const kind of [p.kind, a.kind]) assert.ok(OVERHAUL.includes(`"${kind}"`), kind);
  assert.equal(PAYMENT_METHODS_LINE, "Payment by cheque, wire or EFT to Silver Birch Growth Inc.");
  assert.equal(REMIT_LINE, "Remit details on signed IO.");
  assert.doesNotMatch(IO + UI, /\btransit\b|institution number|account (no|number)|\bswift\b|routing number/i);
  assert.equal(draftRef("Acme Labs!", new Date("2026-11-19T17:00:00Z")), "BR-IO-20261119-ACMELABS");
  assert.ok(validFlight("2027-01-01", "2027-01-01"));
  assert.ok(!validFlight("2027-02-01", "2027-01-01"));
  assert.ok(!validFlight("", "2027-01-01"));
});

test("?mock=1 never posts: every fetch in the lanes sits behind the explicit mock check", () => {
  assert.match(UI, /if \(mock\) \{ setState\("sent"\); return; \}/);
  assert.match(UI, /if \(!mock\) \{\s*try \{\s*const res = await fetch\("\/v1\/leads"/);
  assert.match(UI, /if \(!mock\) window\.location\.assign\(href\)/);
  assert.equal((UI.match(/fetch\(/g) ?? []).length, 2);
  assert.doesNotMatch(UI.replace(/\/\*\*[\s\S]*?\*\//g, ""), /\/v1\/checkout/); // no direct checkout calls from the intake
});

test("visitor copy rules: no zero-demand words, no Publisher/sponsor/advertiser labels, no CTR/ROAS/guarantee, no partner names", () => {
  const visible = (UI + IO + PAGE).replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(visible, /still open|\bnot taken\b|unclaimed|\bopen (seats?|slots?|categor)|\b0 (signed|seats|slots|purchases)|None signed/i);
  assert.doesNotMatch(visible, />[^<]*\b(Publisher|Advertiser|Sponsor(ed)?)\b[^<]*</);
  const mine = (UI + IO).replace(/\/\*\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(mine, /\bCTR\b|\bROAS\b|guarantee/i);
  assert.doesNotMatch(visible, /Integrity|Align|Clairvoyant|Friday/);
  assert.match(UI, /Early placements are limited\./);
});

test("lane analytics events are on the fixed list", () => {
  for (const d of ["lane_card", "lane_block", "agency_test", "big_block", "io_pdf", "look_190", "reserve_490"]) {
    assert.ok(isIntakeEvent(`intake.advertiser.cta_click.${d}`), d);
  }
});
