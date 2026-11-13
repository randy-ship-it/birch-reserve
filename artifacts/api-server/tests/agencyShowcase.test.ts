import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AGENCY_EXAMPLES, AGENCY_PLACEHOLDERS, AGENCY_SHARE, INVENTORY_LINE, SELL_ASSUMPTION_LINE, SELL_ASSUMPTION_PCT, SPEC_ROWS } from "../src/lib/overhaul/agencyShowcase";
import { AGENCY_CREDIT_PCT } from "../src/lib/overhaul/mediaKit";
import { AGENCY, SURFACES } from "../src/lib/overhaul/model";

test("agency share re-uses the stated site figures, no new terms", () => {
  assert.deepEqual([AGENCY_SHARE.lo, AGENCY_SHARE.hi], [AGENCY_CREDIT_PCT.lo, AGENCY_CREDIT_PCT.hi]);
  assert.equal(AGENCY_SHARE.lo, AGENCY.commissionPct);
  for (const e of AGENCY_EXAMPLES) {
    assert.equal(e.lo, Math.round(e.spend * AGENCY_SHARE.lo) / 100);
    assert.equal(e.hi, Math.round(e.spend * AGENCY_SHARE.hi) / 100);
  }
  for (const p of AGENCY_PLACEHOLDERS) assert.match(p.value, /^Placeholder:/);
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

test("agency showcase copy has no banned terms and seat copy never says lock/exclusive for the $490", () => {
  const files = [
    "../clinichub-media/src/components/br/agency-showcase.tsx",
    "../clinichub-media/src/pages/br/home.tsx",
    "./src/lib/overhaul/agencyShowcase.ts",
  ].map((f) => readFileSync(resolve(process.cwd(), f), "utf8")).join("\n");
  for (const re of [/Scale Health Connect/i, /Clairvoyant/i, /\bAlign\b/, /8\.7\s?(mm|M)\b/i, /gross profit/i, /\bCIM\b/, /fridayapp/i, /\(\d{3}\)\s?\d{3}-\d{4}|\b\d{3}-\d{3}-\d{4}\b/]) {
    assert.doesNotMatch(files, re, String(re));
  }
  assert.doesNotMatch(files, /\$490[^.\n]{0,40}(lock|exclusive)/i);
});
