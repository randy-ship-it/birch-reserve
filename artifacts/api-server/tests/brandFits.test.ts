import assert from "node:assert/strict";
import { test } from "node:test";
import { BRAND_FITS, getBrandFit, isBrandFitPath } from "../src/lib/overhaul/brandFits";

test("RAD Roller is registered and unknown slugs are rejected", () => {
  const fit = getBrandFit("rad-roller");
  assert.equal(fit?.name, "RAD Roller");
  assert.equal(fit?.slug, "rad-roller");
  assert.ok(fit?.bestFits.length && fit.bestFits.length >= 2 && fit.bestFits.length <= 4);
  assert.equal(getBrandFit("RAD-Roller")?.slug, "rad-roller");
  assert.equal(getBrandFit("not-a-brand"), undefined);
  assert.equal(getBrandFit("../secret"), undefined);
  assert.equal(isBrandFitPath("/for/rad-roller"), true);
  assert.equal(isBrandFitPath("/for/rad-roller/"), true);
  assert.equal(isBrandFitPath("/for/nope"), false);
  assert.equal(isBrandFitPath("/media-kit"), false);
  assert.ok(BRAND_FITS["rad-roller"]);
});
