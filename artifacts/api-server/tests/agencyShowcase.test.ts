import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGENCY_EXAMPLES, AGENCY_SHARE, BRAND_BONUS_LINE, INVENTORY_LINE, SELL_ASSUMPTION_LINE, SELL_ASSUMPTION_PCT, SPEC_ROWS } from "../src/lib/overhaul/agencyShowcase";
import { AGENCY_CASH_PCT, agencyCash } from "../src/lib/overhaul/mediaKit";
import { AGENCY, DEPOSIT_TIERS, SURFACES } from "../src/lib/overhaul/model";

const read = (f: string) => readFileSync(resolve(process.cwd(), f), "utf8");

test("agency cut: 10% of media spend, paid in cash to the agency of record (Randy 8:14 PM ET)", () => {
  assert.equal(AGENCY_SHARE.pct, 10);
  assert.equal(AGENCY_CASH_PCT, AGENCY.commissionPct);
  assert.match(AGENCY_SHARE.line, /10% of media spend, paid in cash/);
  assert.match(AGENCY_SHARE.line, /agency of record/);
  assert.equal(AGENCY_SHARE.timing, "Paid to the agency of record per the IO.");
  assert.deepEqual(AGENCY_EXAMPLES.map((e) => [e.spend, e.cash]), [[490, 49], [25000, 2500]]);
  assert.equal(agencyCash(25000), 2500);
  assert.equal(agencyCash(50000), 5000);
});

test("/agencies: 10% paid in cash; brand bonus credit is the client's, separate from the agency cash", () => {
  const page = read("../clinichub-media/src/pages/br/agencies.tsx");
  assert.match(page, /10% of media spend, paid in cash to the agency of record/);
  assert.match(page, /Brand bonus credit is the client's \(the brand's\), separate from the agency's 10% cash/);
  assert.doesNotMatch(page, /Agency prepay also earns the same bonus credit tiers as brands/);
  assert.equal(AGENCY.line, "10% of media spend, paid in cash to the agency of record.");
  assert.match(AGENCY.bonusNote, /Brand bonus credit is the client's \(the brand's\), separate from the agency's 10% cash/);
});

test("brand bonus credit is labelled as the brand's and kept separate from the 10% cash", () => {
  assert.match(BRAND_BONUS_LINE, /^Brand bonus credit/);
  assert.match(BRAND_BONUS_LINE, /separate from your 10% cash/);
  for (const t of DEPOSIT_TIERS) assert.ok(BRAND_BONUS_LINE.includes(`+${t.bonusPct}% from $${t.usd.toLocaleString("en-US")}`));
  assert.match(read("../clinichub-media/src/pages/br/advertise-brands.tsx"), /\+5% at \$1,500 USD, \+10% at \$3,000 and \+15% at \$6,000/);
});

test("spec sheet: four placements at the published starting CPMs, Post-Purchase is Inquire", () => {
  assert.equal(SPEC_ROWS.length, 4);
  for (const r of SPEC_ROWS) assert.equal(r.cpmFloorUsd, SURFACES.find((s) => s.key === r.key)!.cpmUsd);
  assert.deepEqual(SPEC_ROWS.filter((r) => r.inquire).map((r) => r.key), ["post_purchase"]);
});

test("20% sell assumption is labelled an assumption; orders say 20MM+, never 8.7", () => {
  assert.equal(SELL_ASSUMPTION_PCT, 20);
  assert.match(SELL_ASSUMPTION_LINE, /assumption/i);
  assert.match(INVENTORY_LINE, /20MM\+ orders/);
  assert.match(INVENTORY_LINE, /modelled/);
});

test("quick-buy preselects Hub Home, matching the server and /buycalc default", () => {
  assert.match(read("../clinichub-media/src/components/br/quick-buy.tsx"), /QUICK_BUY_DEFAULT_PLACEMENT: PlacementKey = "hub_home"/);
});

test("copy scan: agency sections, home and media kit carry no banned or retired wording", () => {
  const files = [
    "../clinichub-media/src/components/br/agency-showcase.tsx",
    "../clinichub-media/src/pages/br/home.tsx",
    "../clinichub-media/src/pages/br/media-kit.tsx",
    "../clinichub-media/src/pages/br/agencies.tsx",
    "./src/lib/overhaul/agencyShowcase.ts",
    "./src/lib/overhaul/mediaKit.ts",
    "./src/lib/overhaul/seo.ts",
  ].map(read).join("\n");
  for (const re of [/Scale Health Connect/i, /Clairvoyant/i, /\bAlign\b/, /8\.7\s?(mm|M)\b/i, /gross profit/i, /\bCIM\b/, /10\s*[–-]\s*12/, /\b12%/, /exclusive (category )?seat/i, /AGENCY_CREDIT_PCT|agencyCredit/, /Placeholder:/]) {
    assert.doesNotMatch(files, re, String(re));
  }
  const agencyOnly = ["../clinichub-media/src/components/br/agency-showcase.tsx", "./src/lib/overhaul/agencyShowcase.ts"].map(read).join("\n");
  assert.doesNotMatch(agencyOnly, /\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/);
  assert.doesNotMatch(agencyOnly, /fridayapp|cockpit/i);
  assert.doesNotMatch(agencyOnly, /keeps?[^.\n]{0,30}as media credit/i);
  // Nov 13 2026: "Lock a seat — $490" locks one of 8 shared seats, never the category.
  assert.match(files, /Lock a seat — \$490/);
  assert.doesNotMatch(files, /\$490[^.\n]{0,40}(lock(s|ed)? (the|your) category|exclusive)/i);
});
