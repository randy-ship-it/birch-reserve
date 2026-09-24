import assert from "node:assert/strict";
import test from "node:test";
import { BIRCH_GUIDE_SYSTEM_PROMPT, classifyGuideQuestion } from "../src/components/birch-guide-knowledge.ts";

for (const question of [
  "We are a recovery clinic and need bookings.",
  "We run a wellness clinic.",
  "We are a pelvic clinic in Markham.",
  "Our MSK clinic wants to join.",
  "We are a physio provider.",
]) {
  test(`routes a new provider correctly: ${question}`, () => {
    assert.equal(
      classifyGuideQuestion(question).intent,
      "join_provider_network",
    );
  });
}

test("routes an existing Clinic Hubs clinic to Performance", () => {
  const result = classifyGuideQuestion(
    "We are a physio clinic already in the Clinic Hubs network and can take bookings.",
  );
  assert.equal(result.intent, "performance_fit");
  assert.equal(result.signals.bookingIntent, true);
});

test("Birch Guide prompt states public prices and refuses reach claims", () => {
  assert.match(BIRCH_GUIDE_SYSTEM_PROMPT, /\$190 = 7-day look/);
  assert.match(BIRCH_GUIDE_SYSTEM_PROMPT, /\$490 = category seat/);
  assert.match(BIRCH_GUIDE_SYSTEM_PROMPT, /do not hero it/);
  assert.match(BIRCH_GUIDE_SYSTEM_PROMPT, /We do not sell a guaranteed impression count/);
  assert.match(BIRCH_GUIDE_SYSTEM_PROMPT, /Never state 50MM, 1MM, CTR/);
  assert.equal(
    classifyGuideQuestion("How many people will see my ad?").intent,
    "audience_or_metrics",
  );
  assert.equal(
    classifyGuideQuestion("What about Align’s 80 locations?").intent,
    "align_on_request",
  );
});

test("keeps a recovery product brand in the Display lane", () => {
  assert.equal(
    classifyGuideQuestion("We sell recovery electrolytes.").intent,
    "display_fit",
  );
});