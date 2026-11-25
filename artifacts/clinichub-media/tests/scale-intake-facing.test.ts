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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

test("agency partner checkbox uses Randy's exact wording, optional and unchecked by default", () => {
  const exact = "Do you want to know about any of our trusted agency partners that can help with things like creative new distribution channels, traditional full-service ad buying and end-to-end campaign management?";
  const here = dirname(fileURLToPath(import.meta.url));
  const brandIntake = readFileSync(join(here, "../../api-server/src/lib/overhaul/brandIntake.ts"), "utf8");
  const src = readFileSync(join(here, "../src/components/br/intake-short-form.tsx"), "utf8");
  assert.match(brandIntake, new RegExp(exact.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(src, /AGENCY_PARTNER_QUESTION/);
  assert.match(src, /data-testid="intake-agency-partner"/);
  assert.match(src, /data-testid="intake-agency-partner-checkbox"/);
  assert.match(src, /const \[agencyPartner, setAgencyPartner\] = useState\(false\)/);
  assert.match(src, /agency_partner_interest: agencyPartner/);
  assert.match(src, /type="checkbox"/);
  // Lives after the optional more-detail block, before the category/area locks link — always visible, not required.
  const agencyAt = src.indexOf('data-testid="intake-agency-partner"');
  const moreAt = src.indexOf('data-testid="intake-more-toggle"');
  const secondaryAt = src.indexOf('data-testid="intake-secondary"');
  assert.ok(moreAt > 0 && agencyAt > moreAt && secondaryAt > agencyAt);
  assert.doesNotMatch(src, /intake-agency-partner-checkbox"[^>]*required/);
});
