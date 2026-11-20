import test from "node:test";
import assert from "node:assert/strict";
import { chatTopic, memoryPulseStore, pulseFeed, recordPulse, setPulseStoreForTests, toFeed } from "../src/lib/activityPulse";
import { PULSE_SEED } from "../src/lib/activityPulseSeed";

test("pulse hides under 3 real events and never pads", () => {
  const f = toFeed([], Date.parse("2026-11-20T20:00:00Z"));
  assert.equal(f.show, false);
  assert.equal(f.events.length, 0);
  assert.equal(toFeed(PULSE_SEED, Date.parse("2027-01-15T00:00:00Z")).show, false); // seed ages out of the 30-day window
});

test("test traffic is dropped; feed carries no names, emails or free text", async () => {
  setPulseStoreForTests(memoryPulseStore());
  await recordPulse("kit_request", "nutrition", { isTest: true });
  await recordPulse("kit_request", "nutrition", { region: "Ontario", who: "Jane Doe" });
  const f = await pulseFeed(Date.parse("2026-11-20T20:00:00Z"));
  const json = JSON.stringify(f);
  assert.equal(f.show, true);
  assert.doesNotMatch(json, /@|Jane|Doe|http/);
  assert.equal(f.events.filter((e) => e.source === "site").length, 1);
  assert.equal(f.events[0]!.who, "Nutrition brand");
  setPulseStoreForTests(null);
});

test("chat topic is a fixed key", () => {
  assert.equal(chatTopic("How much is a view block?"), "chat_pricing");
  assert.equal(chatTopic("hello"), "chat_question");
});
