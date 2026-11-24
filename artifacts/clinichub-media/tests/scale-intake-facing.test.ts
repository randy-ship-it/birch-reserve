import assert from "node:assert/strict";
import test from "node:test";
import { HUB_DEFINITION, isScaleFacing } from "../src/lib/siteSkin.ts";

test("isScaleFacing is true for the Scale Brands CTA (?ref=scale) and the Scale skin", () => {
  assert.equal(isScaleFacing("?ref=scale", false), true);
  assert.equal(isScaleFacing("?ref=scale&mock=1", false), true);
  assert.equal(isScaleFacing("ref=scale", false), true);
  assert.equal(isScaleFacing("", true), true);
  assert.equal(isScaleFacing("?ref=scale", true), true);
});

test("isScaleFacing is false for the default Birch intake", () => {
  assert.equal(isScaleFacing("", false), false);
  assert.equal(isScaleFacing("?ref=home_tile", false), false);
  assert.equal(isScaleFacing("?role=supplier", false), false);
  assert.equal(isScaleFacing("?ref=scale_intake", false), false);
});

test("HUB_DEFINITION is a short, plain Scale Hub line with no economics or banned terms", () => {
  assert.match(HUB_DEFINITION, /co-branded Scale clinic storefront/i);
  assert.match(HUB_DEFINITION, /books care and buys products/i);
  assert.match(HUB_DEFINITION, /earn from day 1/i);
  assert.match(HUB_DEFINITION, /costs nothing to host/i);
  assert.doesNotMatch(HUB_DEFINITION, /Align|Clairvoyant|Uber|gig|marketplace|margin|split|%|\$|every sale/i);
  assert.ok(HUB_DEFINITION.length < 220);
});
