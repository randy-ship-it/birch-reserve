import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SERVICES_SPLIT, PUBLISHER_ASSUMPTIONS, HUB_ONBOARDING, onboardingWaived } from "../src/lib/overhaul/brandIntake";

test("clinic services: hub keeps half of what Scale Health charges ($49 assessment, $29 session)", () => {
  assert.equal(SERVICES_SPLIT.hubPct, 50);
  assert.equal(SERVICES_SPLIT.hubAssessment, (SERVICES_SPLIT.assessmentPrice * SERVICES_SPLIT.hubPct) / 100);
  assert.equal(SERVICES_SPLIT.hubSession, (SERVICES_SPLIT.sessionPrice * SERVICES_SPLIT.hubPct) / 100);
  for (const l of [SERVICES_SPLIT.line, SERVICES_SPLIT.birchLine]) {
    assert.match(l, /half of what Scale Health charges, \$24\.50 per \$49 assessment and \$14\.50 per \$29 session\./);
    assert.doesNotMatch(l, /guarantee|net|labou?r|gross|profit/i);
  }
  assert.match(SERVICES_SPLIT.birchLine, /^Scale Health clinic services booked through your clinic layer/);
  assert.match(SERVICES_SPLIT.line, /^Clinic services booked through your clinic layer/);
  assert.ok(PUBLISHER_ASSUMPTIONS.some((a) => a.includes(SERVICES_SPLIT.line)));
});

test("no labor rate, management cost or net formula in public sources", () => {
  for (const f of ["src/lib/overhaul/brandIntake.ts", "../clinichub-media/src/pages/br/intake-publisher.tsx"]) assert.doesNotMatch(readFileSync(f, "utf8"), /labou?r|\$70\b|management (cost|fee)|servicesNet|50% of net/i);
});

test("hub onboarding fee: $5,000 USD (same as the supplier stand-up fee), waived from 1MM+ views, never a guarantee or a penalty", () => {
  assert.equal(HUB_ONBOARDING.feeUsd, 5000);
  assert.deepEqual([0, 999_999, 1_000_000, 5_000_000].map(onboardingWaived), [false, false, true, true]);
  for (const s of [HUB_ONBOARDING.target, HUB_ONBOARDING.smaller, HUB_ONBOARDING.larger, HUB_ONBOARDING.chipLarge, HUB_ONBOARDING.chipSmall]) assert.doesNotMatch(s, /guarantee|penalt|must pay|Align|Clairvoyant/i);
  assert.match(HUB_ONBOARDING.larger, /free to launch/);
  assert.match(HUB_ONBOARDING.smaller, /may apply/);
});
