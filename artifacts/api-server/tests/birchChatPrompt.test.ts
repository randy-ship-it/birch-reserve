/** Site-chat prompt builder + reply guard (Randy, Nov 17 2026). Pure: no network, no DB. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BIRCH_LINKS,
  buildBirchChatSystemPrompt,
  findBannedContent,
  softenReply,
} from "../src/lib/birchChatPrompt";
import { buildGrokRequest, GROK_MAX_TOKENS, GROK_TEMPERATURE, requestIsAllowed } from "../src/routes/randyChat";
import { birchFaqAnswer } from "../src/lib/birchFaq";

const live = { reserve: true, areaLock: false, deposits: false };

test("prompt carries the site offer in USD with CAD for Canadian visitors", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live });
  assert.match(p, /\$190 USD/);
  assert.match(p, /\$490 USD/);
  assert.match(p, /\$25,000 to \$1.5M USD/);
  assert.match(p, /USD base prices; Canadian visitors pay CAD/);
  assert.match(p, /\$270 CAD/);
  assert.match(p, /\$690 CAD/);
  assert.match(p, /Integrity Fitness/); // Live now on the hub ladder (Randy, Nov 23 2026)
  assert.match(p, /DR-HO'S physio/);
  assert.match(p, /Activating/);
  assert.ok(p.includes(BIRCH_LINKS.reserve490) && p.includes(BIRCH_LINKS.look190) && p.includes(BIRCH_LINKS.request));
  assert.match(p, /\[\[CALLBACK\]\]/);
});

test("prompt never carries banned content or internal numbers", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live, pagePath: "/for/acme", chipId: "how_seats" });
  // Randy Nov 19 2026: the prompt names neither the partner nor its legal company, not even in a rule line.
  assert.doesNotMatch(p, /Clairvoyant|\bAlign\b|alignwellness/i);
  // CAD and $899 appear only inside the rule lines that forbid them.
  const withoutRules = p.replace(/^.*Never mention \$899.*$/gm, "");
  assert.doesNotMatch(withoutRules, /\$899/);
  assert.doesNotMatch(p, /\b(grok|xai|openai|gpt)\b/i);
  assert.doesNotMatch(p, /Hi there(?!")/);
  assert.doesNotMatch(p, /seats_open|seats_paid|8 of 8|\b8 seats\b|184,176|46,044|42 listed|20MM|128MM|8\.7/);
  assert.doesNotMatch(p, /\u2014|\u2013/);
});

test("prompt follows checkout state and turn context", () => {
  const off = buildBirchChatSystemPrompt({ checkout: { reserve: false, areaLock: false, deposits: false } });
  assert.match(off, /Card checkout is OFF/);
  assert.ok(!off.includes(BIRCH_LINKS.reserve490));
  const forPage = buildBirchChatSystemPrompt({ checkout: live, pagePath: "/for/acme" });
  assert.match(forPage, /private brand-fit page/);
  const hear = buildBirchChatSystemPrompt({ checkout: live, mode: "hear", chipId: "talk_human" });
  assert.match(hear, /spoken-friendly/);
  assert.match(hear, /Buy ads now/);
});

test("grok request: one system prompt, full recent history, tuned sampling, GROK_MODEL respected", () => {
  const body = {
    messages: [
      { role: "assistant" as const, content: "Hey, what brings you to Birch Reserve?" },
      { role: "user" as const, content: "We sell a TENS device." },
      { role: "assistant" as const, content: "Nice. Pain relief fits. Budget?" },
      { role: "user" as const, content: "About $500." },
    ],
  };
  const req = buildGrokRequest(body, "grok-test-model");
  assert.equal(req.model, "grok-test-model");
  assert.equal(req.temperature, GROK_TEMPERATURE);
  assert.equal(req.max_tokens, GROK_MAX_TOKENS);
  assert.equal(req.messages.filter((m) => m.role === "system").length, 1);
  assert.deepEqual(req.messages.slice(1).map((m) => m.role), ["assistant", "user", "assistant", "user"]);
  assert.equal(req.messages.at(-1)!.content, "About $500.");
});

test("reply guard catches the hard bans and lets good replies through", () => {
  for (const bad of [
    "We're powered by Grok from xAI.",
    "That's C$700 for Canadian buyers.",
    "It's $300 CAD for the look.",
    "Use code STREET100 at checkout.",
    "We guarantee 1MM impressions.",
    "Uber for wellness, basically.",
    "Right now $0 booked so far, 8 of 8 seats open.",
    "There are 3 seats left in your category.",
    "0 of 42 partners signed so far.",
    "Birch share is 20% on direct sales.",
    "Clairvoyant runs the hubs.",
    "The legacy reserve was $899.",
  ]) assert.ok(findBannedContent(bad), bad);
  for (const good of [
    "Prices are in USD for every buyer, including Canadian brands: $190 USD and $490 USD.",
    "Start with a $490 USD category placement at https://birchreserve.net/buycalc?sku=reserve-490",
    "Four placements in every hub, right after a member books or buys.",
    "Agencies buy at a standard written 10% discount off the published rate card.",
  ]) assert.equal(findBannedContent(good), null, good);
  assert.equal(softenReply("Hi there! Happy to help."), "Hi! Happy to help.");
});

test("fallback FAQ answers the five buyer questions usefully, in USD, with no banned content", () => {
  const qs: Array<[string, string]> = [
    ["How much does it cost?", "price"],
    ["How does it work?", "how"],
    ["Who is the audience?", "audience"],
    ["Is anyone else in my category?", "competition"],
    ["Can I pay in CAD?", "currency"],
  ];
  for (const [q, intent] of qs) {
    const a = birchFaqAnswer([{ role: "user", content: q }]);
    assert.equal(a.intent, intent, q);
    assert.equal(findBannedContent(a.text), null, q);
    if (intent !== "currency") assert.doesNotMatch(a.text, /\bCAD\b/);
    assert.match(a.text, /https:\/\/birchreserve\.net\/buycalc|physio\.drhonow\.com/);
  }
  const general = birchFaqAnswer([{ role: "user", content: "hello" }]);
  assert.match(general.text, /\$490 USD/);
  assert.match(general.text, /buycalc#request/);
});

test("area lock is a launch price, never a deposit, everywhere the chat and phone agent read (Randy, Nov 17 2026)", async () => {
  const { birchCanonicalFacts } = await import("../src/lib/birchFacts");
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const facts = birchCanonicalFacts();
  const prompt = buildBirchChatSystemPrompt({ checkout: live });
  const here = dirname(fileURLToPath(import.meta.url));
  const knowledge = ["birch-chat.prompt.txt", "birch-phone.prompt.txt"].map((f) => {
    for (const base of [join(here, "../src/knowledge"), join(process.cwd(), "src/knowledge"), join(process.cwd(), "artifacts/api-server/src/knowledge")]) {
      try { return readFileSync(join(base, f), "utf8"); } catch { /* next */ }
    }
    throw new Error(`missing ${f}`);
  });
  for (const text of [facts, prompt, ...knowledge]) {
    const areaLines = text.split("\n").filter((l) => /lock down my area|area lock|area placement/i.test(l) && /3,500/.test(l));
    assert.ok(areaLines.length > 0);
    for (const l of areaLines) {
      assert.match(l, /\$3,500 USD launch price/);
      assert.doesNotMatch(l.replace(/never (call it )?a deposit/gi, ""), /deposit/i);
      assert.doesNotMatch(l, /CAD/);
    }
  }
  assert.doesNotMatch(prompt, /same-day/i);
  assert.match(prompt, /within 1 business day/);
});

// Nov 20 2026 8:28 AM ET: "How long until ads would be live." on scalehealth.ca/intake got the error card (403 Origin not allowed).
const fakeReq = (origin: string | undefined, host = "birchreserve.net") => ({
  get: (h: string) => (h.toLowerCase() === "origin" ? origin : h.toLowerCase() === "host" ? host : undefined),
}) as unknown as Parameters<typeof requestIsAllowed>[0];

test("chat origin check: the scalehealth.ca/intake mirror is allowed, strangers are not", () => {
  assert.equal(requestIsAllowed(fakeReq("https://www.scalehealth.ca")), true);
  assert.equal(requestIsAllowed(fakeReq("https://scalehealth.ca")), true);
  assert.equal(requestIsAllowed(fakeReq("https://birchreserve.net")), true);
  assert.equal(requestIsAllowed(fakeReq(undefined)), true);
  assert.equal(requestIsAllowed(fakeReq("https://evil.example")), false);
  assert.equal(requestIsAllowed(fakeReq("https://scalehealth.ca.evil.example")), false);
  assert.equal(requestIsAllowed(fakeReq("https://notscalehealth.ca")), false);
});

test("timing question: prompt and FAQ fallback answer it without dates, counts or guarantees", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live });
  assert.match(p, /How long until ads would be live/);
  assert.match(p, /launch date on the IO/);
  const faq = birchFaqAnswer([{ role: "user", content: "How long until ads would be live." }]);
  assert.equal(faq.intent, "timing");
  assert.equal(findBannedContent(faq.text), null);
  assert.doesNotMatch(faq.text, /guarantee|\bopen\b|seats? (left|remaining)|\b\d+ (seats|categories)\b|CAD/i);
  assert.match(faq.text, /USD/);
  assert.equal(birchFaqAnswer([{ role: "user", content: "How long until I get a refund?" }]).intent, "refund");
});

test("network explainer: what the private display network is, spend-down, packs, exclusive link (Nov 21 2026)", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live });
  assert.match(p, /THE PRIVATE DISPLAY NETWORK/);
  assert.match(p, /distribution platform that started in Recovery/);
  assert.match(p, /Never call it gig, on-demand or Uber-like/);
  assert.match(p, /up to 6 months once your IO starts/);
  assert.match(p, /\$1,500, \$3,000 or \$6,000 USD/);
  assert.ok(p.includes("https://birchreserve.net/starter"));
  assert.doesNotMatch(p, /\bsigned partners\b|unclaimed|\bAlign\b/i);
  assert.match(p, /\$1,900/);
});

test("prompt explains the performance-only path without rejecting anyone or quoting rates", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live });
  assert.match(p, /not every brand is a fit for the clinic hub program/i);
  assert.match(p, /performance-based and set at onboarding/);
  assert.match(p, /intake\?program=performance-only/);
  assert.match(p, /never that anyone was rejected/);
});

test("visitor currency: one price per reply, no bracketed restatement (Randy, Nov 23 2026)", () => {
  const cad = buildBirchChatSystemPrompt({ checkout: live, currency: "cad" });
  assert.match(cad, /prices are shown in CAD/);
  assert.match(cad, /no USD figure and no bracketed equivalent/);
  const usd = buildBirchChatSystemPrompt({ checkout: live, currency: "usd" });
  assert.match(usd, /prices are shown in USD/);
  const none = buildBirchChatSystemPrompt({ checkout: live });
  assert.doesNotMatch(none, /prices are shown in (CAD|USD)/);
});
