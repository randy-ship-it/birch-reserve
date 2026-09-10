import assert from "node:assert/strict";
import test from "node:test";
import { classifyGuideQuestion } from "../src/components/birch-guide-knowledge.ts";

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

test("keeps a recovery product brand in the Display lane", () => {
  assert.equal(
    classifyGuideQuestion("We sell recovery electrolytes.").intent,
    "display_fit",
  );
});