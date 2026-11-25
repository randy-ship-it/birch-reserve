import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBirchChatSystemPrompt, findBannedContent } from "../src/lib/birchChatPrompt";
import {
  ALLOWED_CAD_AMOUNTS, brandUrl, buildOnboardingModule, chatBrandFor, offTableCadAmounts, swapForBrand, swapLinks,
} from "../src/lib/chatOnboarding";
import { birchFaqAnswer } from "../src/lib/birchFaq";
import { parseBody, polishReply } from "../src/routes/randyChat";
// @ts-expect-error plain .mjs eval module shared with the live runner
import { QUESTIONS, checkAnswer, extractLinks } from "./chat-eval/questions.mjs";

const live = { reserve: true, areaLock: false, deposits: false };

test("brand links: Scale stays on scalehealth.ca (/intake* direct, everything else through /intake/_m)", () => {
  assert.equal(brandUrl("birch", "/intake"), "https://birchreserve.net/intake");
  assert.equal(brandUrl("scale", "/intake"), "https://www.scalehealth.ca/intake");
  assert.equal(brandUrl("scale", "/intake/supplier"), "https://www.scalehealth.ca/intake/supplier");
  assert.equal(brandUrl("scale", "/buycalc?sku=hold-190"), "https://www.scalehealth.ca/intake/_m/buycalc?sku=hold-190");
  assert.equal(brandUrl("scale", "/media-kit#hub-alerts"), "https://www.scalehealth.ca/intake/_m/media-kit#hub-alerts");
  assert.equal(swapLinks("See https://birchreserve.net/intake. Then https://birchreserve.net/terms, ok", "scale"), "See https://www.scalehealth.ca/intake. Then https://www.scalehealth.ca/intake/_m/terms, ok");
  assert.equal(swapLinks("[Kit](https://birchreserve.net/intake/gtm)", "scale"), "[Kit](https://www.scalehealth.ca/intake/gtm)");
  assert.equal(swapForBrand("Birch Reserve", "birch"), "Birch Reserve");
  assert.equal(chatBrandFor("scale", null), "scale");
  assert.equal(chatBrandFor(undefined, "https://www.scalehealth.ca"), "scale");
  assert.equal(chatBrandFor(undefined, "https://birchreserve.net"), "birch");
});

test("one module, two brands: identical facts, only name, logo and links swap", () => {
  const b = buildBirchChatSystemPrompt({ brand: "birch", checkout: live });
  const s = buildBirchChatSystemPrompt({ brand: "scale", checkout: live });
  assert.doesNotMatch(s, /birchreserve\.net/i);
  assert.doesNotMatch(s, /Birch Q&A|Birch Reserve|BIRCH RESERVE/);
  assert.match(s, /Scale Squirrel/);
  assert.match(s, /https:\/\/www\.scalehealth\.ca\/intake\/supplier/);
  assert.doesNotMatch(b, /Scale Squirrel/);
  assert.doesNotMatch(b, /scalehealth\.ca\/intake/);
  // Same prompt once names and links are normalised back.
  const norm = (t: string) => t.replace(/https:\/\/(www\.)?(birchreserve\.net|scalehealth\.ca\/intake(\/_m)?)/g, "<HOST>").replace(/Scale Squirrel|Birch Q&A Squirrel/g, "<SQ>").replace(/Scale Health|Birch Reserve|SCALE HEALTH|BIRCH RESERVE/g, "<NAME>").replace(/scalehealth\.ca\/intake|birchreserve\.net/g, "<HOST>").replace(/<HOST>\/(intake|intake\/)/g, "<HOST>/intake");
  assert.equal(norm(s).split("\n").length, norm(b).split("\n").length);
});

test("onboarding module carries every path, price, currency and term from the live tables", () => {
  const m = buildOnboardingModule();
  for (const re of [
    /\/intake\b/, /\/intake\/supplier/, /\/buy\b/, /\/sponsor/, /\/exclusive/, /\/partners/, /\/terms/, /\/intake\/gtm/, /\/street-team/, /hub-alerts/, /ads\/specs/, /sample-io/,
    /\$190 USD/, /\$270 CAD/, /\$490 USD/, /\$690 CAD/, /\$1,500 USD \(\$2,100 CAD\)/, /\$3,000 USD \(\$4,200 CAD\)/, /\$6,000 USD \(\$8,400 CAD\)/, /\+5%/, /\+10%/, /\+15%/,
    /\$1,900/, /25% below/, /Silver Birch Growth Inc\./, /intake\/activate/, /5\.4x/, /Step 2 of 2/, /30 days/, /14 days/, /60 days/, /IO before flight|IO|insertion order/, /aggregate only/i, /Calm Joints/, /door-to-door/, /signed partnership contracts/,
  ]) assert.match(m, re);
  assert.doesNotMatch(m, /STREET100|Align|Clairvoyant|Alset|MedVibe|pier39|Friday/i);
  assert.doesNotMatch(m, /\u2014|\u2013/);
});

test("CAD guard: only real table amounts pass", () => {
  for (const n of [270, 690, 2100, 4200, 8400, 1900, 2205, 4620, 9660]) assert.ok(ALLOWED_CAD_AMOUNTS.has(n), String(n));
  assert.deepEqual(offTableCadAmounts("$270 CAD for the look, CAD $690 to reserve, packs from $2,100 CAD."), []);
  assert.deepEqual(offTableCadAmounts("That's C$700 or $300 CAD."), [700, 300]);
  assert.equal(findBannedContent("The look is $270 CAD."), null);
  assert.equal(findBannedContent("The look is $300 CAD."), "cad_price");
});

test("guard blocks promo codes, internal names, gig positioning, guarantees, zero counts, hub-open claims", () => {
  for (const bad of ["Use code STREET100.", "Alset manages this.", "We're pier39.ai powered.", "It's like Uber for wellness.", "We guarantee results.", "We have 0 clinics.", "The Toronto hub is now live."]) {
    assert.ok(findBannedContent(bad), bad);
  }
  assert.ok(findBannedContent("Align isn't referenced in our materials."));
  assert.equal(findBannedContent("Scale Health is a distribution platform, never gig, Uber-type or on-demand."), null);
  assert.equal(findBannedContent("Align your ad with the hub."), null);
  assert.equal(birchFaqAnswer([{ role: "user", content: "is this like uber for health?" }]).intent, "positioning");
  assert.equal(birchFaqAnswer([{ role: "user", content: "is Align a client?" }]).intent, "confidential");
  for (const ok of ["No, the Toronto hub is not live; only DR-HO'S and SOLE are live today.", "No guarantees: any figure is modelled.", "Toronto is in queue; get launch alerts.", "Based on signed partnership contracts, 200+ locations."]) {
    assert.equal(findBannedContent(ok), null, ok);
  }
});

test("Scale identity: reply polish names the Scale Squirrel, the request skin is accepted", () => {
  assert.match(polishReply("I'm Randy from Scale Health.", [{ role: "user", content: "who are you" }], "scale"), /Scale Squirrel/);
  const p = parseBody({ messages: [{ role: "user", content: "hi" }], skin: "scale" });
  assert.ok(p.ok && p.body.skin === "scale");
  assert.equal(parseBody({ messages: [{ role: "user", content: "hi" }], skin: "evil" }).ok, false);
});

test("FAQ fallback: the get-started path and CAD for Canadians, swapped for Scale", () => {
  const a = birchFaqAnswer([{ role: "user", content: "how do I get started?" }]);
  assert.equal(a.intent, "start");
  assert.match(a.text, /birchreserve\.net\/intake/);
  const sc = swapForBrand(a.text, "scale");
  assert.doesNotMatch(sc, /birchreserve\.net/);
  assert.match(sc, /scalehealth\.ca\/intake/);
  assert.equal(findBannedContent(birchFaqAnswer([{ role: "user", content: "can I pay in CAD?" }]).text), null);
});

test("eval set: 25+ questions, unique ids, and the checker catches real failures", () => {
  assert.ok(QUESTIONS.length >= 25);
  assert.equal(new Set(QUESTIONS.map((q: { id: string }) => q.id)).size, QUESTIONS.length);
  const promo = QUESTIONS.find((q: { id: string }) => q.id === "promo");
  assert.deepEqual(checkAnswer(promo, "No code to share here; the price on the page is the price. Want the request form or a person to call you?", "birch"), []);
  assert.ok(checkAnswer(promo, "Yes, use code STREET100 for a discount.", "birch").some((f: string) => f.startsWith("rule:no-promo-code")));
  const start = QUESTIONS.find((q: { id: string }) => q.id === "start-brand");
  const good = "Here's the path:\n1. [Get the free kit](https://www.scalehealth.ca/intake)\n2. Take the $190 look. Want the request form?";
  assert.deepEqual(checkAnswer(start, good, "scale"), []);
  assert.ok(checkAnswer(start, good.replace("scalehealth.ca", "birchreserve.net"), "scale").some((f: string) => /scale-links|off-domain/.test(f)));
  assert.deepEqual(extractLinks("[A](https://x.com/a) and https://y.com/b."), ["https://x.com/a", "https://y.com/b"]);
});

test("QA marker: the BirchQA/1 user-agent token (or the secret header) marks a chat as QA", async () => {
  const { isQaMarked } = await import("../src/lib/testTraffic");
  const req = (ua: string) => ({ get: (h: string) => (h.toLowerCase() === "user-agent" ? ua : undefined) });
  assert.equal(isQaMarked(req("Mozilla/5.0 Chrome/124 BirchQA/1")), true);
  assert.equal(isQaMarked(req("Mozilla/5.0 Chrome/124")), false);
});
