/** Site-chat prompt builder + reply guard (Randy, Nov 17 2026). Pure: no network, no DB. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BIRCH_LINKS,
  buildBirchChatSystemPrompt,
  findBannedContent,
  softenReply,
} from "../src/lib/birchChatPrompt";
import { buildGrokRequest, GROK_MAX_TOKENS, GROK_TEMPERATURE } from "../src/routes/randyChat";
import { birchFaqAnswer } from "../src/lib/birchFaq";

const live = { reserve: true, areaLock: false, deposits: false };

test("prompt carries the site offer in USD only", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live });
  assert.match(p, /\$190 USD/);
  assert.match(p, /\$490 USD/);
  assert.match(p, /\$25,000 to \$50,000 USD/);
  assert.match(p, /USD only, for every buyer including Canadian brands/);
  assert.doesNotMatch(p, /Integrity/i);
  assert.match(p, /DR-HO'S physio/);
  assert.match(p, /In queue/);
  assert.ok(p.includes(BIRCH_LINKS.reserve490) && p.includes(BIRCH_LINKS.look190) && p.includes(BIRCH_LINKS.request));
  assert.match(p, /\[\[CALLBACK\]\]/);
});

test("prompt never carries banned content or internal numbers", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live, pagePath: "/for/acme", chipId: "how_seats" });
  // Randy Nov 19 2026: the prompt names neither the partner nor its legal company, not even in a rule line.
  assert.doesNotMatch(p, /Clairvoyant|\bAlign\b|alignwellness/i);
  // CAD and $899 appear only inside the rule lines that forbid them.
  const withoutRules = p.replace(/^.*(Can I pay in CAD|Never mention \$899).*$/gm, "");
  assert.doesNotMatch(withoutRules, /\bCAD\b|C\$|\$270|\$690|\$899/);
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
  assert.match(hear, /Talk to a human/);
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
    "That's C$690 for Canadian buyers.",
    "It's $270 for the look.",
    "Right now $0 booked so far, 8 of 8 seats open.",
    "There are 3 seats left in your category.",
    "0 of 42 partners signed so far.",
    "Birch share is 20% on direct sales.",
    "Clairvoyant runs the hubs.",
    "The legacy reserve was $899.",
  ]) assert.ok(findBannedContent(bad), bad);
  for (const good of [
    "Prices are in USD for every buyer, including Canadian brands: $190 USD and $490 USD.",
    "Reserve for $490 USD at https://birchreserve.net/buycalc?sku=reserve-490",
    "Four placements in every hub, right after a member books or buys.",
    "The agency of record earns 10% of media spend, paid in cash.",
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
    assert.doesNotMatch(a.text, /\bCAD\b/);
    assert.match(a.text, /https:\/\/birchreserve\.net\/buycalc|physio\.drhonow\.com/);
  }
  const general = birchFaqAnswer([{ role: "user", content: "hello" }]);
  // 2026-11-19: the general fallback no longer pitches the $490 reserve or a checkout link.
  assert.doesNotMatch(general.text, /\$490|buycalc/);
  assert.match(general.text, /place ads, or earn with us/);
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
    const areaLines = text.split("\n").filter((l) => /lock down my area|area lock/i.test(l) && /3,500/.test(l));
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

test("2026-11-19: suppliers and hubs knowledge, no Publisher label, no 42 brands / 20MM orders", () => {
  const p = buildBirchChatSystemPrompt({ checkout: live, pagePath: "/intake" });
  assert.match(p, /performance-only/i);
  assert.match(p, /no CPC and no CPM/);
  assert.match(p, /35% of media revenue, escalating by tier/);
  assert.match(p, /Max exposure/);
  assert.match(p, /Scale Hubs/);
  assert.match(p, /Calm Joints/);
  assert.match(p, /Street Team/);
  assert.match(p, /500K to 1MM homes/);
  assert.match(p, /Retail Network/);
  assert.match(p, /200\+ locations across Canada/);
  assert.match(p, /100\+ providers/);
  assert.match(p, /300\+ by year-end/);
  assert.match(p, /Wednesday, December 9, 11 AM to 12 PM ET/);
  assert.match(p, /display and CPC ad space/);
  assert.match(p, /Monetization Kit form on this page|form on this page/);
  assert.doesNotMatch(p, /\bAlign\b|MedVibe|Clairvoyant|Integrity Fitness/i);
  // Left out until Randy confirms: brand fee template, phone bonus, hub launcher, 42 brands / 20MM orders.
  assert.doesNotMatch(p, /10% on post-purchase|~35%|about 35%|\$500 CAD|42 brands|20MM orders/);
  assert.doesNotMatch(p, /\u2014|\u2013/);
});

test("page notes differ per page and stop pitching the reserve everywhere", () => {
  const intake = buildBirchChatSystemPrompt({ checkout: live, pagePath: "/intake" });
  const home = buildBirchChatSystemPrompt({ checkout: live, pagePath: "/" });
  const kit = buildBirchChatSystemPrompt({ checkout: live, pagePath: "/media-kit" });
  assert.match(intake, /Monetization Kit form \(\/intake\)/);
  assert.match(home, /place ads or earn with us/);
  assert.match(kit, /advertiser evaluating rates/);
  const p = buildBirchChatSystemPrompt({ checkout: live });
  assert.match(p, /Never put a checkout link on every reply/);
  assert.doesNotMatch(p, /sharp media seller/);
});

test("reply guard blocks Align, MedVibe, Friday, Uber/gig/marketplace and Publisher; allows the public 35% line", () => {
  assert.equal(findBannedContent("Align is not listed among our hubs."), "align");
  assert.equal(findBannedContent("Align hubs are great."), "align");
  assert.equal(findBannedContent("We work with MedVibe."), "medvibe");
  assert.equal(findBannedContent("Friday App tracks it."), "friday");
  assert.equal(findBannedContent("We are the Uber for clinics."), "uber_gig");
  assert.equal(findBannedContent("It's a gig platform."), "uber_gig");
  assert.equal(findBannedContent("We are a marketplace."), "uber_gig");
  assert.equal(findBannedContent("Sign up as a publisher."), "publisher_label");
  assert.equal(findBannedContent("Clairvoyant owns it."), "clairvoyant");
  // Allowed
  assert.equal(findBannedContent("Hubs earn 35% of media revenue, escalating by tier."), null);
  assert.equal(findBannedContent("Align your brand with the right hubs."), null);
  assert.equal(findBannedContent("Retail hubs in Canada and the USA."), null);
  // Still blocked
  assert.equal(findBannedContent("Birch keeps 65% to Birch."), "revenue_split");
});

test("faq fallback: performance-only, CPM, Dec 9, Align, hub earn", () => {
  const ask = (q: string) => birchFaqAnswer([{ role: "user", content: q }]);
  assert.match(ask("What does performance-only mean").text, /no CPC and no CPM/);
  assert.match(ask("Do advertisers pay CPM?").text, /display and CPC ad space/);
  assert.match(ask("What's Dec 9?").text, /December 9, 11 AM to 12 PM ET/);
  const a = ask("Is Align a hub?").text;
  assert.match(a, /retail hubs/);
  assert.equal(findBannedContent(a), null);
  assert.match(ask("How does a physio group earn?").text, /35% of media revenue/);
});
