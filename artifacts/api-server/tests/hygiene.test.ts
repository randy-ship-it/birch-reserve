/**
 * Randy 6:50pm: test-traffic hygiene (is_test), humans-only guards (bot UA block,
 * honeypots, rate limits, Turnstile gate), attribution + linger email capture.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express, { Router } from "express";
import { getTableConfig } from "drizzle-orm/pg-core";
import { randyChatSessionsTable, splashAdReservationsTable, leadsTable } from "@workspace/db/schema";
import voiceRouter from "../src/routes/voiceCallEnded";
import randyChatRouter, { randyChatJsonParser } from "../src/routes/randyChat";
import humanGateRouter from "../src/routes/humanGate";
import { publicPostGuards, voiceStartGuards, isBotUserAgent, isGuardedPost, sanitizeAttribution } from "../src/lib/publicGuards";
import {
  HUMAN_TOKEN_TTL_MS,
  issueHumanToken,
  requireHuman,
  setSiteverifyFetchForTests,
  verifyHumanToken,
} from "../src/lib/humanGate";
import { resetRateLimitsForTests, FRIENDLY_429 } from "../src/lib/rateLimit";
import { hasValidQaHeader, isTestIdentity } from "../src/lib/testTraffic";
import { MemoryVoiceCallStore, setVoiceDepsForTests, VOICE_CALLS_HYGIENE_DDL } from "../src/lib/voiceCalls";
import { LEADS_HYGIENE_DDL, MemoryLeadStore, mergeLead, setLeadStoreForTests } from "../src/lib/leads";
import { setFridayDepsForTests, type FridayFetch } from "../src/lib/fridayPush";
import {
  MemoryTranscriptStore,
  RANDY_CHAT_SESSIONS_HYGIENE_DDL,
  setTranscriptDepsForTests,
  stopTranscriptSweepTimerForTests,
  type RenderedEmail,
} from "../src/lib/randyChatTranscripts";
import { setEmailCaptureDepsForTests } from "../src/lib/emailCapture";
import { emailCaptureLeadId } from "../src/lib/leadCapture";
import { applyAdditiveColumns, parseAdditiveColumn, SPLASH_HYGIENE_DDL } from "../src/lib/schemaEnsure";

const VOICE_SECRET = "voice-secret-for-tests-7c1d";
const QA_SECRET = "qa-secret-for-tests-19ab";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;
let voiceStore = new MemoryVoiceCallStore();
let leadStore = new MemoryLeadStore();
let transcriptStore = new MemoryTranscriptStore();
const voiceEmails: RenderedEmail[] = [];
const transcriptEmails: RenderedEmail[] = [];
const captureEmails: RenderedEmail[] = [];
const fridayCalls: Array<Record<string, unknown>> = [];
let waitlistReached = 0;

const mockFriday: FridayFetch = async (_url, init) => {
  fridayCalls.push(JSON.parse(init.body) as Record<string, unknown>);
  return { ok: true, status: 201, text: async () => JSON.stringify({ contactId: 1, dealId: 2 }) };
};

const flush = () => new Promise((r) => setTimeout(r, 30));

before(async () => {
  setFridayDepsForTests({ fetch: mockFriday, sleep: async () => undefined });
  setEmailCaptureDepsForTests({ mailer: async (e) => void captureEmails.push(e), mailerReady: () => true });

  // Mirrors app.ts ordering (minus Clerk): parsers → guards → Turnstile on chat → routers.
  const app = express();
  app.set("trust proxy", false);
  app.use("/api/launch/randy-chat", randyChatJsonParser());
  app.use("/api/voice/call-ended", express.json({ limit: "1mb" }));
  app.use(express.json({ limit: "32kb" }));
  app.use(publicPostGuards());
  app.use(voiceStartGuards());
  app.post("/api/launch/randy-chat", requireHuman());
  const sentinel = Router();
  sentinel.post("/launch/waitlist", (_req, res) => {
    waitlistReached += 1;
    res.status(202).json({ status: "received", requestId: "real" });
  });
  sentinel.post("/voice/start", (_req, res) => void res.json({ started: true }));
  app.use("/api", sentinel);
  app.use("/api", voiceRouter);
  app.use("/api", randyChatRouter);
  app.use("/api", humanGateRouter);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  closeServer = () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

after(async () => {
  stopTranscriptSweepTimerForTests();
  await closeServer?.();
});

beforeEach(() => {
  process.env["RANDY_CHAT_AI_DISABLED"] = "true";
  process.env["VOICE_WEBHOOK_SECRET"] = VOICE_SECRET;
  process.env["BIRCH_QA_SECRET"] = QA_SECRET;
  process.env["FRIDAY_API_URL"] = "https://friday.example";
  process.env["FRIDAY_API_KEY"] = "friday-key-test";
  delete process.env["TURNSTILE_SITE_KEY"];
  delete process.env["TURNSTILE_SECRET_KEY"];
  resetRateLimitsForTests();
  voiceStore = new MemoryVoiceCallStore();
  leadStore = new MemoryLeadStore();
  transcriptStore = new MemoryTranscriptStore();
  voiceEmails.length = 0;
  transcriptEmails.length = 0;
  captureEmails.length = 0;
  fridayCalls.length = 0;
  waitlistReached = 0;
  setLeadStoreForTests(leadStore);
  setVoiceDepsForTests({ store: voiceStore, mailer: async (e) => void voiceEmails.push(e), mailerReady: () => true });
  setTranscriptDepsForTests({ store: transcriptStore, mailer: async (e) => void transcriptEmails.push(e), mailerReady: () => true });
});

function post(p: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${p}`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": BROWSER_UA, ...headers },
    body: JSON.stringify(body),
  });
}

/* ---------------- is_test rules ---------------- */

test("is_test identity rules: qa+ email, QA Test / Pulse Probe name, qa-/emma-qa call ids, emma-qa sessions", () => {
  assert.equal(isTestIdentity({ email: "qa+birch1@silverbirchgrowth.com" }), true);
  assert.equal(isTestIdentity({ email: "QA+x@example.com" }), true);
  assert.equal(isTestIdentity({ email: "qa@example.com" }), false);
  assert.equal(isTestIdentity({ email: "aqua+x@example.com" }), false);
  assert.equal(isTestIdentity({ name: "QA Test 6:50" }), true);
  assert.equal(isTestIdentity({ name: "Birch Pulse Probe" }), true);
  assert.equal(isTestIdentity({ callId: "qa-replitbot-1234" }), true);
  assert.equal(isTestIdentity({ callId: "qa-1" }), true);
  assert.equal(isTestIdentity({ callId: "emma-qa-77" }), true);
  assert.equal(isTestIdentity({ sessionId: "emma-qa-chat-1" }), true);
  assert.equal(isTestIdentity({ label: "emma-qa run" }), true);
  assert.equal(isTestIdentity({ name: "Dana Whitlock", email: "dana@northwind.example", callId: "call_1", sessionId: "abcdefgh12" }), false);
});

test("X-Birch-QA: BIRCH_QA_SECRET, falls back to VOICE_WEBHOOK_SECRET, wrong/missing header is not QA", () => {
  const req = (v?: string) => ({ get: (h: string) => (h.toLowerCase() === "x-birch-qa" ? v : undefined) }) as never;
  assert.equal(hasValidQaHeader(req(QA_SECRET)), true);
  assert.equal(hasValidQaHeader(req(VOICE_SECRET)), false);
  assert.equal(hasValidQaHeader(req("nope")), false);
  assert.equal(hasValidQaHeader(req(undefined)), false);
  delete process.env["BIRCH_QA_SECRET"];
  assert.equal(hasValidQaHeader(req(VOICE_SECRET)), true);
  delete process.env["VOICE_WEBHOOK_SECRET"];
  assert.equal(hasValidQaHeader(req("")), false);
});

const CALL = (callId: string, extracted: Record<string, string> = { name: "Dana Whitlock", company: "Northwind Physio", email: "dana@northwind.example" }) => ({
  call_id: callId,
  from: "+14165550142",
  transcript: [{ role: "user", content: "I need a category seat." }],
  extracted,
});

test("voice: X-Birch-QA call is stored as is_test, never emailed, lead is_test and Friday skipped", async () => {
  const res = await post("/voice/call-ended", CALL("call_live_77"), { "x-voice-webhook-secret": VOICE_SECRET, "x-birch-qa": QA_SECRET });
  assert.equal(res.status, 200);
  await flush();
  const row = await voiceStore.get("call_live_77");
  assert.equal(row?.isTest, true);
  assert.equal(voiceEmails.length, 0);
  const lead = await leadStore.get("voice:call_live_77");
  assert.equal(lead?.isTest, true);
  assert.equal(lead?.fridayStatus, "skipped");
  assert.equal(lead?.fridayLastError, "is_test");
  assert.equal(fridayCalls.length, 0);
});

test("voice: qa-replitbot / emma-qa call ids and Pulse Probe names are is_test; real calls unchanged", async () => {
  for (const id of ["qa-replitbot-9", "emma-qa-3"]) {
    assert.equal((await post("/voice/call-ended", CALL(id), { "x-voice-webhook-secret": VOICE_SECRET })).status, 200);
  }
  assert.equal(
    (await post("/voice/call-ended", CALL("call_pp", { name: "Pulse Probe", phone: "+14165550100" }), { "x-voice-webhook-secret": VOICE_SECRET })).status,
    200,
  );
  await flush();
  assert.equal(voiceEmails.length, 0);
  assert.equal(fridayCalls.length, 0);
  for (const id of ["qa-replitbot-9", "emma-qa-3", "call_pp"]) assert.equal((await voiceStore.get(id))?.isTest, true);

  assert.equal((await post("/voice/call-ended", CALL("call_real_1"), { "x-voice-webhook-secret": VOICE_SECRET })).status, 200);
  await flush();
  assert.equal((await voiceStore.get("call_real_1"))?.isTest, false);
  assert.equal(voiceEmails.length, 1);
  assert.equal(fridayCalls.length, 1);
  assert.equal((await leadStore.get("voice:call_real_1"))?.isTest, false);
});

test("voice: call-ended is secret-authed and NOT subject to the bot-UA block", async () => {
  const res = await post("/voice/call-ended", CALL("call_curl_1"), { "x-voice-webhook-secret": VOICE_SECRET, "user-agent": "curl/8.5.0" });
  assert.equal(res.status, 200);
  assert.equal(isGuardedPost("/api/voice/call-ended"), false);
  assert.equal(isGuardedPost("/api/stripe/webhook"), false);
  assert.equal(isGuardedPost("/v1/checkout"), false);
});

test("chat: emma-qa session and X-Birch-QA sessions are stored but never emailed; real sessions still email", async () => {
  const intake = (sessionId: string) => ({
    sessionId,
    type: "callback_request",
    messages: [{ role: "user", content: "call me" }],
    contact: { phone: "+1 416 555 0142", name: "Dana Whitlock" },
    qualify: { company: "Northwind" },
  });
  assert.equal((await post("/launch/randy-chat/event", intake("emma-qa-session-1"))).status, 200);
  assert.equal((await post("/launch/randy-chat/event", intake("qaheadersession1"), { "x-birch-qa": QA_SECRET })).status, 200);
  await flush();
  assert.equal(transcriptEmails.length, 0);
  assert.equal((await transcriptStore.get("emma-qa-session-1"))?.isTest, true);
  assert.equal((await transcriptStore.get("qaheadersession1"))?.isTest, true);
  assert.equal((await leadStore.get("chat:emma-qa-session-1"))?.isTest, true);
  assert.equal(fridayCalls.length, 0);

  assert.equal((await post("/launch/randy-chat/event", intake("realsession0001"))).status, 200);
  await flush();
  assert.equal(transcriptEmails.length, 1);
  assert.equal((await transcriptStore.get("realsession0001"))?.isTest, false);
  assert.equal(fridayCalls.length, 1);
});

test("chat: QA Test name typed into the callback form flags the session", async () => {
  await post("/launch/randy-chat/event", {
    sessionId: "anothersession1",
    type: "callback_request",
    messages: [{ role: "user", content: "hi" }],
    contact: { phone: "+1 416 555 0199", name: "QA Test Bot" },
  });
  await flush();
  assert.equal((await transcriptStore.get("anothersession1"))?.isTest, true);
  assert.equal(transcriptEmails.length, 0);
});

/* ---------------- humans only ---------------- */

test("bot UA block: curl / python-requests / HeadlessChrome / wget / scrapy / empty UA → 403 on chat + forms", async () => {
  assert.equal(isBotUserAgent("curl/8.5.0"), true);
  assert.equal(isBotUserAgent("python-requests/2.32"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0 Safari/537.36"), true);
  assert.equal(isBotUserAgent("Wget/1.21"), true);
  assert.equal(isBotUserAgent("Scrapy/2.11 (+https://scrapy.org)"), true);
  assert.equal(isBotUserAgent(""), true);
  assert.equal(isBotUserAgent(BROWSER_UA), false);
  assert.equal(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), false);

  for (const [p, body] of [
    ["/launch/randy-chat", { messages: [{ role: "user", content: "hi" }] }],
    ["/launch/randy-chat/event", { sessionId: "abcdefgh12", type: "activity" }],
    ["/launch/email-capture", { email: "dana@northwind.example" }],
    ["/launch/waitlist", { email: "dana@northwind.example" }],
  ] as const) {
    const res = await post(p, body, { "user-agent": "curl/8.5.0" });
    assert.equal(res.status, 403, p);
  }
  assert.equal(waitlistReached, 0);
  // A valid X-Birch-QA header is let through (QA automation).
  const qa = await post("/launch/waitlist", { email: "qa+1@example.com" }, { "user-agent": "curl/8.5.0", "x-birch-qa": QA_SECRET });
  assert.equal(qa.status, 202);
  assert.equal(waitlistReached, 1);
  // Normal browser passes.
  assert.equal((await post("/launch/waitlist", { email: "dana@northwind.example" })).status, 202);
  assert.equal(waitlistReached, 2);
});

test("honeypot: a filled `fax` field is silently accepted and dropped (route never runs, nothing stored)", async () => {
  const w = await post("/launch/waitlist", { email: "bot@spam.example", fax: "555-0100" });
  assert.equal(w.status, 202);
  assert.equal(((await w.json()) as { status: string }).status, "received");
  assert.equal(waitlistReached, 0);

  const e = await post("/launch/email-capture", { email: "bot@spam.example", fax: "x" });
  assert.equal(e.status, 202);
  assert.equal(leadStore.rows.size, 0);
  assert.equal(captureEmails.length, 0);

  const c = await post("/launch/randy-chat/event", {
    sessionId: "botsession01",
    type: "callback_request",
    contact: { phone: "+1 416 555 0100" },
    fax: "1",
  });
  assert.equal(c.status, 200);
  assert.equal(transcriptStore.rows.size, 0);

  // Empty honeypot (real person) is stripped and the strict parser still accepts the body.
  assert.equal((await post("/launch/waitlist", { email: "dana@northwind.example", fax: "" })).status, 202);
  assert.equal(waitlistReached, 1);
});

test("rate limits: 20 chat msgs/min per session, 60 per 10 min per IP → 429 with a friendly message", async () => {
  const msg = (sessionId?: string) => ({ messages: [{ role: "user", content: "hi" }], ...(sessionId ? { sessionId } : {}) });
  for (let i = 0; i < 20; i += 1) assert.equal((await post("/launch/randy-chat", msg("ratesession01"))).status, 503);
  const limited = await post("/launch/randy-chat", msg("ratesession01"));
  assert.equal(limited.status, 429);
  const body = (await limited.json()) as { error: string };
  assert.equal(body.error, FRIENDLY_429);
  assert.ok(limited.headers.get("retry-after"));
  // Other sessions from the same IP continue until the per-IP cap (60 / 10 min).
  let status = 0;
  let sent = 21;
  for (let s = 0; sent < 61; s += 1) {
    for (let i = 0; i < 19 && sent < 61; i += 1, sent += 1) {
      status = (await post("/launch/randy-chat", msg(`ipsession${String(s).padStart(4, "0")}`))).status;
    }
  }
  assert.equal(status, 429);
  // QA header bypasses the limiter.
  assert.equal((await post("/launch/randy-chat", msg("ratesession01"), { "x-birch-qa": QA_SECRET })).status, 503);
});

test("Turnstile: unset keys → gate skipped; set → 401 until verified once, then a signed token passes", async () => {
  const cfgOff = (await (await fetch(`${baseUrl}/launch/human/config`)).json()) as { enabled: boolean; siteKey: string | null };
  assert.deepEqual(cfgOff, { enabled: false, siteKey: null });
  assert.equal((await post("/launch/randy-chat", { messages: [{ role: "user", content: "hi" }] })).status, 503);

  process.env["TURNSTILE_SITE_KEY"] = "0x4AAAAAAA-site";
  process.env["TURNSTILE_SECRET_KEY"] = "0x4AAAAAAA-secret-test";
  const cfgOn = (await (await fetch(`${baseUrl}/launch/human/config`)).json()) as { enabled: boolean; siteKey: string | null };
  assert.deepEqual(cfgOn, { enabled: true, siteKey: "0x4AAAAAAA-site" });

  const blocked = await post("/launch/randy-chat", { messages: [{ role: "user", content: "hi" }] });
  assert.equal(blocked.status, 401);
  assert.equal(((await blocked.json()) as { humanRequired: boolean }).humanRequired, true);

  let seenBody = "";
  setSiteverifyFetchForTests(async (_url, init) => {
    seenBody = init.body;
    const ok = new URLSearchParams(init.body).get("response") === "good-token";
    return { ok: true, json: async () => ({ success: ok, "error-codes": ok ? [] : ["invalid-input-response"] }) };
  });
  const bad = await post("/launch/human/verify", { token: "bad-token" });
  assert.equal(bad.status, 403);
  const good = await post("/launch/human/verify", { token: "good-token" });
  assert.equal(good.status, 200);
  assert.match(seenBody, /secret=0x4AAAAAAA-secret-test/);
  const { humanToken } = (await good.json()) as { humanToken: string };
  assert.ok(humanToken && !humanToken.includes("0x4AAAAAAA-secret-test"));

  assert.equal((await post("/launch/randy-chat", { messages: [{ role: "user", content: "hi" }] }, { "x-birch-human": humanToken })).status, 503);
  const tampered = humanToken.slice(0, -2) + (humanToken.endsWith("A") ? "BB" : "AA");
  assert.equal((await post("/launch/randy-chat", { messages: [{ role: "user", content: "hi" }] }, { "x-birch-human": tampered })).status, 401);
  // QA header passes the gate.
  assert.equal((await post("/launch/randy-chat", { messages: [{ role: "user", content: "hi" }] }, { "x-birch-qa": QA_SECRET })).status, 503);

  setSiteverifyFetchForTests(async () => {
    throw new Error("network down");
  });
  assert.equal((await post("/launch/human/verify", { token: "good-token" })).status, 503);
});

test("Turnstile tokens: signed, expire after 2h, bound to the secret", () => {
  const now = Date.now();
  const { token } = issueHumanToken("s1", now);
  assert.equal(verifyHumanToken(token, "s1", now + 1000), true);
  assert.equal(verifyHumanToken(token, "s2", now + 1000), false);
  assert.equal(verifyHumanToken(token, "s1", now + HUMAN_TOKEN_TTL_MS + 1000), false);
  assert.equal(verifyHumanToken("h1.99999999999.x.y", "s1", now), false);
  assert.equal(verifyHumanToken(undefined, "s1", now), false);
});

test("voice start endpoints: Turnstile pass + rate limits; call-ended untouched", async () => {
  assert.equal((await post("/voice/start", {})).status, 200);
  process.env["TURNSTILE_SITE_KEY"] = "site";
  process.env["TURNSTILE_SECRET_KEY"] = "secret";
  assert.equal((await post("/voice/start", {})).status, 401);
  const { token } = issueHumanToken("secret");
  // 1 call above + 9 here = the 10-per-10-min IP cap.
  for (let i = 0; i < 9; i += 1) assert.equal((await post("/voice/start", {}, { "x-birch-human": token })).status, 200);
  assert.equal((await post("/voice/start", {}, { "x-birch-human": token })).status, 429);
  assert.equal((await post("/voice/start", {}, { "user-agent": "python-requests/2.32", "x-birch-human": token })).status, 403);
  assert.equal((await post("/voice/call-ended", CALL("call_after_gate"), { "x-voice-webhook-secret": VOICE_SECRET })).status, 200);
});

/* ---------------- attribution + email capture ---------------- */

test("attribution: sanitized, first-touch on the leads row, never counts as a lead change", () => {
  assert.deepEqual(
    sanitizeAttribution({ utm_source: " linkedin ", utm_medium: "social\u0000", bogus: "x", referrer: 5, landing_page: "/?utm_source=linkedin" }),
    { utmSource: "linkedin", utmMedium: "social", landingPage: "/?utm_source=linkedin" },
  );
  const now = new Date();
  const first = mergeLead(undefined, { id: "email:1", source: "email_capture", sourceRef: "1", email: "a@b.co", utmSource: "linkedin" }, now);
  const second = mergeLead(first.lead, { id: "email:1", source: "email_capture", sourceRef: "1", utmSource: "google", referrer: "https://www.google.com/" }, now);
  assert.equal(second.lead.utmSource, "linkedin");
  assert.equal(second.lead.referrer, "https://www.google.com/");
  assert.equal(second.changed, false);
});

test("email capture: leads row (email_capture) with attribution, Friday push, Randy + Jon email once; no email echo", async () => {
  const body = {
    email: "Dana@Northwind.example",
    company: "Northwind Physio",
    pagePath: "/",
    fax: "",
    attribution: { utm_source: "linkedin", utm_medium: "social", utm_campaign: "fall-seats", referrer: "https://www.linkedin.com/", landing_page: "/?utm_source=linkedin" },
  };
  const res = await post("/launch/email-capture", body);
  assert.equal(res.status, 202);
  const text = await res.text();
  assert.doesNotMatch(text, /northwind/i);
  await flush();
  const lead = await leadStore.get(emailCaptureLeadId("dana@northwind.example"));
  assert.equal(lead?.source, "email_capture");
  assert.equal(lead?.email, "dana@northwind.example");
  assert.equal(lead?.company, "Northwind Physio");
  assert.equal(lead?.utmSource, "linkedin");
  assert.equal(lead?.utmCampaign, "fall-seats");
  assert.equal(lead?.referrer, "https://www.linkedin.com/");
  assert.equal(lead?.landingPage, "/?utm_source=linkedin");
  assert.equal(lead?.isTest, false);
  assert.equal(captureEmails.length, 1);
  assert.match(captureEmails[0]!.subject, /Birch email capture/);
  assert.doesNotMatch(captureEmails[0]!.text, /\$899/);
  assert.equal(fridayCalls.length, 1);
  assert.equal(fridayCalls[0]!["source"], "Birch email capture");
  assert.match(String(fridayCalls[0]!["message"]), /UTM: linkedin \/ social \/ fall-seats/);

  // Same email again: no second email.
  assert.equal((await post("/launch/email-capture", { email: "dana@northwind.example" })).status, 202);
  await flush();
  assert.equal(captureEmails.length, 1);
});

test("email capture: qa+ email or X-Birch-QA → stored is_test, no email, Friday skipped", async () => {
  assert.equal((await post("/launch/email-capture", { email: "qa+linger@silverbirchgrowth.com" })).status, 202);
  assert.equal((await post("/launch/email-capture", { email: "real.looking@example.com" }, { "x-birch-qa": QA_SECRET })).status, 202);
  await flush();
  assert.equal(captureEmails.length, 0);
  assert.equal(fridayCalls.length, 0);
  assert.equal((await leadStore.get(emailCaptureLeadId("qa+linger@silverbirchgrowth.com")))?.isTest, true);
  const qaLead = await leadStore.get(emailCaptureLeadId("real.looking@example.com"));
  assert.equal(qaLead?.isTest, true);
  assert.equal(qaLead?.fridayLastError, "is_test");
});

test("email capture: strict validation", async () => {
  assert.equal((await post("/launch/email-capture", { email: "nope" })).status, 400);
  assert.equal((await post("/launch/email-capture", { email: "a@b.co", phone: "1" })).status, 400);
  assert.equal((await post("/launch/email-capture", { email: "a@b.co", company: "x".repeat(201) })).status, 400);
});

/* ---------------- additive schema ---------------- */

function repoFile(rel: string): string {
  for (const base of [path.resolve(process.cwd(), "../.."), process.cwd()]) {
    try {
      return readFileSync(path.join(base, rel), "utf8");
    } catch {
      /* next */
    }
  }
  throw new Error(`${rel} not found`);
}
const squash = (x: string) => x.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();

test("schema SQL: additive only (ADD COLUMN IF NOT EXISTS) and identical to the runtime safety net", () => {
  const body = squash(repoFile("scripts/sql/2026-09-24-test-hygiene-attribution.sql"));
  assert.doesNotMatch(body, /\b(DROP|RENAME|TRUNCATE|DELETE|UPDATE|TYPE|SET DEFAULT)\b/i);
  const stmts = body.split(";").map((x) => x.trim()).filter(Boolean);
  for (const st of stmts) assert.match(st, /^ALTER TABLE IF EXISTS \w+ ADD COLUMN IF NOT EXISTS \w+ /);
  assert.deepEqual(stmts, [...LEADS_HYGIENE_DDL, ...VOICE_CALLS_HYGIENE_DDL, RANDY_CHAT_SESSIONS_HYGIENE_DDL, ...SPLASH_HYGIENE_DDL].map(squash));
});

test("backfill SQL: only sets is_test = true, never deletes / unsets / alters", () => {
  const body = squash(repoFile("scripts/sql/2026-09-24-test-hygiene-backfill.sql"));
  assert.doesNotMatch(body, /\b(DROP|RENAME|TRUNCATE|DELETE|ALTER|INSERT)\b/i);
  assert.doesNotMatch(body, /is_test\s*=\s*false/i);
  const updates = body.match(/UPDATE \w+ SET [^;]*?WHERE/g) ?? [];
  assert.equal(updates.length, 5);
  for (const u of updates) assert.match(u, /^UPDATE \w+ SET is_test = true WHERE$/);
  for (const needle of ["name ILIKE 'QA Test%'", "'%Pulse Probe%'", "email ILIKE 'qa+%'", "LIKE 'emma-qa%'", "LIKE 'qa-%'"]) {
    assert.ok(body.includes(needle), needle);
  }
});

test("drizzle: is_test on randy_chat_sessions + splash_ad_reservations; leads attribution columns", () => {
  for (const [table, stmts] of [
    [randyChatSessionsTable, [RANDY_CHAT_SESSIONS_HYGIENE_DDL]],
    [splashAdReservationsTable, SPLASH_HYGIENE_DDL],
    [leadsTable, LEADS_HYGIENE_DDL],
  ] as const) {
    const cols = getTableConfig(table).columns;
    for (const st of stmts) {
      const { column } = parseAdditiveColumn(st)!;
      const col = cols.find((c) => c.name === column);
      assert.ok(col, column);
      if (column === "is_test") {
        assert.equal(col!.notNull, true);
        assert.equal(col!.default, false);
      }
    }
  }
});

test("runtime column ensure only ALTERs when a column is missing (no lock on warm boots)", async () => {
  const ran: string[] = [];
  const fake = (have: string[]) => ({
    query: async (sql: string) => {
      if (sql.startsWith("SELECT column_name")) return { rows: have.map((c) => ({ column_name: c })) };
      ran.push(sql);
      return { rows: [] };
    },
  });
  assert.equal(await applyAdditiveColumns(fake(["id", "is_test", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "landing_page", "meta"]), LEADS_HYGIENE_DDL), 0);
  assert.equal(await applyAdditiveColumns(fake(["id"]), LEADS_HYGIENE_DDL), LEADS_HYGIENE_DDL.length);
  assert.equal(await applyAdditiveColumns(fake([]), SPLASH_HYGIENE_DDL), 0);
  assert.equal(ran.length, LEADS_HYGIENE_DDL.length);
});
