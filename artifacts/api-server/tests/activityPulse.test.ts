import test from "node:test";
import assert from "node:assert/strict";
import { chatTopic, memoryPulseStore, pulseFeed, recordPulse, setPulseStoreForTests, toFeed } from "../src/lib/activityPulse";
import { PULSE_SEED } from "../src/lib/activityPulseSeed";

test("pulse hides under 3 real events and never pads", () => {
  const f = toFeed([], Date.parse("2026-11-20T20:00:00Z"));
  assert.equal(f.show, false);
  assert.equal(f.events.length, 0);
  assert.equal(toFeed(PULSE_SEED, Date.parse("2027-03-01T00:00:00Z")).show, false); // seed ages out of the 90-day window
});

test("test traffic is dropped; feed carries no names, emails or free text", async () => {
  setPulseStoreForTests(memoryPulseStore());
  await recordPulse("kit_request", "nutrition", { isTest: true });
  await recordPulse("kit_request", "nutrition", { region: "Ontario", who: "Jane Doe" });
  const f = await pulseFeed(Date.now() + 60000);
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

test("instantly ingest keeps positive or curious replies only, stores no free text, dedupes", async () => {
  const { classifyReply, ingestInstantly, whoForCampaign } = await import("../src/lib/pulseIngest");
  assert.equal(classifyReply("Thanks, samples are on the way this week."), "samples_confirmed");
  assert.equal(classifyReply("What CPM do you charge for the hub screens?"), "ask_cpc");
  assert.equal(classifyReply("How do placements perform for brands like ours?"), "ask_performance");
  assert.equal(classifyReply("Sounds great, Tuesday works for me for a call."), "call_booked");
  assert.equal(classifyReply("Interesting concept, lots of potential here."), "compliment");
  assert.equal(classifyReply("Not interested, please remove me."), null);
  assert.equal(classifyReply("Thank you for contacting us, we received your message."), null);
  assert.equal(classifyReply("ok"), null);
  assert.equal(classifyReply("Thanks for reaching out! We've received your message and will get back to you within 1 business day."), null);
  assert.equal(classifyReply("Thanks for reaching out- we can set up some time to chat further."), "call_booked");
  assert.equal(whoForCampaign("Providers CA curation v1"), "Physio clinic");
  assert.equal(whoForCampaign("Untitled Campaign"), null);
  setPulseStoreForTests(memoryPulseStore());
  const now = Date.parse("2026-11-21T12:00:00Z");
  const fetcher = async (path: string) =>
    path.startsWith("/campaigns")
      ? { items: [{ id: "c1", name: "Cold-75 FR (QC)" }, { id: "c2", name: "Untitled Campaign" }] }
      : {
          items: [
            { id: "e1", campaign_id: "c1", from_address_email: "owner@studio.example", timestamp_email: "2026-11-21T10:00:00Z", subject: "Re: hub", body: { text: "Jane here at Studio X. Sounds great, happy to book a call Thursday." } },
            { id: "e2", campaign_id: "c2", from_address_email: "pal@friend.example", timestamp_email: "2026-11-21T09:00:00Z", body: { text: "Sounds great, call me" } },
            { id: "e3", campaign_id: "c1", from_address_email: "x@y.example", timestamp_email: "2026-11-21T08:00:00Z", body: { text: "Pas intéressé, merci" } },
          ],
        };
  const r1 = await ingestInstantly({ fetcher, now });
  const r2 = await ingestInstantly({ fetcher, now });
  assert.deepEqual(r1, { ok: true, fetched: 3, appended: 1, skipped: 2 });
  assert.equal(r2.ok, true);
  const f = await pulseFeed(now);
  const ingested = f.events.filter((e) => e.who === "Studio");
  assert.equal(ingested.length, 1);
  assert.equal(ingested[0]!.region, "Quebec");
  assert.doesNotMatch(JSON.stringify(f), /Jane|Studio X|@|Thursday/);
  setPulseStoreForTests(null);
});

test("chat 'what are people asking' uses aggregate themes only", async () => {
  const { pulseThemes } = await import("../src/lib/activityPulse");
  const { buildBirchChatSystemPrompt } = await import("../src/lib/birchChatPrompt");
  const themes = pulseThemes(PULSE_SEED, Date.parse("2026-11-21T00:00:00Z"));
  assert.ok(themes.length >= 4);
  assert.ok(themes.includes("booking a quick intro call"));
  const p = buildBirchChatSystemPrompt({ checkout: { reserve: true, areaLock: false } as never, chipId: "asking_now", pulseThemes: themes });
  assert.match(p, /WHAT PEOPLE ARE ASKING/);
  assert.match(p, /never give counts/);
  assert.match(p, /What are brands asking/);
});

test("launch events: highlighted kind, 180-day window, no names", async () => {
  const f = toFeed(PULSE_SEED.map((e) => ({ ...e, source: "inbox" as const })), Date.parse("2026-11-21T00:00:00Z"));
  const launches = f.events.filter((e) => e.kind === "launch");
  assert.equal(launches.length, 2);
  assert.ok(launches.every((e) => /^New (physio|recovery) hub$/.test(e.who) && e.action === "launched"));
  assert.match(launches.find((e) => e.who === "New physio hub")!.ago, /mo ago$/);
  assert.doesNotMatch(JSON.stringify(f), /DR-HO|SOLE|Align|Clairvoyant/i);
});
