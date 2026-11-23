import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { HUB_LADDER, liveHubs, activatingHubs, ladderLine, ladderMarkdown, hubHref, publicHubs } from "../src/lib/hubLadder";
import { hubLadderHtml } from "../src/lib/hubLadderHtml";
import { IO_EXPLAIN_JS, IO_EXPLAINER } from "../src/lib/ioExplain";
import { BRAND_HUBS, INVENTORY } from "../src/lib/overhaul/model";
import { llmsTxt } from "../src/lib/overhaul/seo";

const BANNED = /align|clairvoyant|alset|80 locations|medvibe|friday|pier39|ankita/i;

test("one ladder: Live now, Activating, and more launching", () => {
  assert.deepEqual(liveHubs().map((h) => h.name), ["DR-HO'S physio", "SOLE", "Integrity Fitness", "Calm Joints"]);
  assert.deepEqual(activatingHubs().map((h) => h.name), ["Effortless Admin", "NutriProCan", "Jack Health", "Jill Health", "Roll Recovery", "Bird & Be"]);
  assert.match(ladderLine(), /Live now: DR-HO'S physio, SOLE, Integrity Fitness and Calm Joints\. Activating: .*Bird & Be, and more launching\./);
  assert.ok(publicHubs().every((h) => h.audience.length > 10));
  assert.doesNotMatch(ladderLine(), BANNED);
});

test("a hub with no real page is not linked; Scale links stay on scalehealth.ca", () => {
  for (const h of HUB_LADDER) {
    if (h.tier === "activating") assert.equal(h.href, undefined);
    const scale = hubHref(h, true);
    if (scale) assert.match(scale, /^https:\/\/www\.scalehealth\.ca\//);
  }
});

test("every surface reads the ladder: model, llms.txt, server html", () => {
  assert.match(INVENTORY.line, /Live now: DR-HO'S physio, SOLE, Integrity Fitness and Calm Joints/);
  for (const h of BRAND_HUBS) assert.notEqual(h.bannerStatus, "In queue", h.key);
  const txt = llmsTxt();
  assert.match(txt, /- Live now: DR-HO'S physio; SOLE; Integrity Fitness; Calm Joints/);
  assert.match(txt, /- Coming: and more launching/);
  assert.match(txt, /Insertion order \(IO\): the short document/);
  assert.doesNotMatch(txt, /DR-HO'S physio and SOLE\./);
  const html = hubLadderHtml();
  assert.match(html, /Live now/);
  assert.match(html, /and more launching/);
  assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/, ""), BANNED);
});

test("IO script parses and carries the buyer explainer", () => {
  assert.doesNotThrow(() => new vm.Script(IO_EXPLAIN_JS));
  assert.match(IO_EXPLAINER, /media credit until the IO is signed and approved\. Nothing runs without it\./);
});
