import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SERVICES_SPLIT, PUBLISHER_ASSUMPTIONS } from "../src/lib/overhaul/brandIntake";

test("clinic services: hub keeps half of what Scale Health charges ($49 assessment, $29 session)", () => {
  assert.equal(SERVICES_SPLIT.hubPct, 50);
  assert.equal(SERVICES_SPLIT.hubAssessment, (SERVICES_SPLIT.assessmentPrice * SERVICES_SPLIT.hubPct) / 100);
  assert.equal(SERVICES_SPLIT.hubSession, (SERVICES_SPLIT.sessionPrice * SERVICES_SPLIT.hubPct) / 100);
  for (const l of [SERVICES_SPLIT.line, SERVICES_SPLIT.birchLine]) {
    assert.match(l, /half of what Scale Health charges, \$24\.50 per \$49 assessment and \$14\.50 per \$29 session\./);
    assert.doesNotMatch(l, /guarantee|net|labou?r|gross|profit/i);
  }
  assert.match(SERVICES_SPLIT.birchLine, /^Scale Health clinic services booked through your hub/);
  assert.match(SERVICES_SPLIT.line, /^Clinic services booked through your hub/);
  assert.ok(PUBLISHER_ASSUMPTIONS.some((a) => a.includes(SERVICES_SPLIT.line)));
});

test("no labor rate, management cost or net formula in public sources", () => {
  for (const f of ["src/lib/overhaul/brandIntake.ts", "../clinichub-media/src/pages/br/intake-publisher.tsx"]) assert.doesNotMatch(readFileSync(f, "utf8"), /labou?r|\$70\b|management (cost|fee)|servicesNet|50% of net/i);
});
