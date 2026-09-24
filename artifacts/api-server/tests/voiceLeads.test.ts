import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import { getTableConfig } from "drizzle-orm/pg-core";
import { leadsTable, voiceCallsTable } from "@workspace/db/schema";
import voiceRouter, { secretMatches } from "../src/routes/voiceCallEnded";
import randyChatRouter from "../src/routes/randyChat";
import {
  MemoryVoiceCallStore,
  normalizeVoicePayload,
  renderVoiceEmail,
  setVoiceDepsForTests,
  VOICE_CALLS_DDL,
} from "../src/lib/voiceCalls";
import { LEADS_DDL, MemoryLeadStore, mergeLead, setLeadStoreForTests } from "../src/lib/leads";
import {
  buildFridayPayload,
  fridayConfig,
  fridayIntakeUrl,
  pushLeadToFriday,
  retryFridayPushes,
  setFridayDepsForTests,
  type FridayFetch,
} from "../src/lib/fridayPush";
import { captureAdvertiserIntakeLead } from "../src/lib/leadCapture";
import { MemoryTranscriptStore, setTranscriptDepsForTests, type RenderedEmail } from "../src/lib/randyChatTranscripts";
import { logger } from "../src/lib/logger";

const SECRET = "test-voice-secret-4f9c1b7e";
const FRIDAY_KEY = "friday-intake-key-9d2a77";
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;

let voiceStore = new MemoryVoiceCallStore();
let leadStore = new MemoryLeadStore();
const transcriptStore = new MemoryTranscriptStore();
const sentEmails: RenderedEmail[] = [];
let mailerFailures = 0;
const logLines: Array<Record<string, unknown>> = [];
type FetchCall = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
const fetchCalls: FetchCall[] = [];
let fetchResponses: Array<{ status: number; body: string } | Error> = [];

const mockFetch: FridayFetch = async (url, init) => {
  fetchCalls.push({ url, headers: init.headers, body: JSON.parse(init.body) as Record<string, unknown> });
  const next = fetchResponses.shift() ?? { status: 201, body: JSON.stringify({ contactId: 11, dealId: 22 }) };
  if (next instanceof Error) throw next;
  return { ok: next.status >= 200 && next.status < 300, status: next.status, text: async () => next.body };
};

const origInfo = logger.info.bind(logger);

before(async () => {
  process.env["VOICE_WEBHOOK_SECRET"] = SECRET;
  delete process.env["FRIDAY_API_URL"];
  delete process.env["FRIDAY_API_KEY"];
  setTranscriptDepsForTests({ store: transcriptStore, mailer: async () => undefined, mailerReady: () => false });
  setFridayDepsForTests({ fetch: mockFetch, sleep: async () => undefined });
  (logger as unknown as { info: (...a: unknown[]) => void }).info = (...args: unknown[]) => {
    if (args[0] && typeof args[0] === "object") logLines.push(args[0] as Record<string, unknown>);
  };

  const app = express();
  app.use("/api/voice/call-ended", express.json({ limit: "1mb" }));
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", voiceRouter);
  app.use("/api", randyChatRouter);
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  closeServer = () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

after(async () => {
  (logger as unknown as { info: typeof origInfo }).info = origInfo;
  await closeServer?.();
});

beforeEach(() => {
  voiceStore = new MemoryVoiceCallStore();
  leadStore = new MemoryLeadStore();
  sentEmails.length = 0;
  fetchCalls.length = 0;
  fetchResponses = [];
  logLines.length = 0;
  mailerFailures = 0;
  process.env["VOICE_WEBHOOK_SECRET"] = SECRET;
  delete process.env["FRIDAY_API_URL"];
  delete process.env["FRIDAY_API_KEY"];
  setLeadStoreForTests(leadStore);
  setVoiceDepsForTests({
    store: voiceStore,
    mailer: async (email) => {
      if (mailerFailures > 0) {
        mailerFailures -= 1;
        throw new Error("Resend HTTP 500");
      }
      sentEmails.push(email);
    },
    mailerReady: () => true,
  });
});

function post(body: unknown, headers: Record<string, string> = { "x-voice-webhook-secret": SECRET }) {
  return fetch(`${baseUrl}/voice/call-ended`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const flush = () => new Promise((r) => setTimeout(r, 20));

const FLAT = {
  call_id: "call_flat_001",
  from: "+14165550142",
  to: "+15045046526",
  started_at: "2026-09-24T21:00:00Z",
  ended_at: "2026-09-24T21:04:30Z",
  end_reason: "caller_hangup",
  transcript: [
    { role: "assistant", content: "Hey, it's Randy's AI. Who am I speaking with?" },
    { role: "user", content: "Dana Whitlock from Northwind Physio, I need a category seat." },
  ],
  extracted: { name: "Dana Whitlock", company: "Northwind Physio", email: "dana@northwind.example", need: "Category seat" },
};

/* ---------------- auth ---------------- */

test("auth: 503 when VOICE_WEBHOOK_SECRET is unset", async () => {
  delete process.env["VOICE_WEBHOOK_SECRET"];
  const res = await post(FLAT);
  assert.equal(res.status, 503);
  assert.equal(voiceStore.rows.size, 0);
});

test("auth: 401 when the header is missing or wrong; Bearer also accepted", async () => {
  assert.equal((await post(FLAT, {})).status, 401);
  assert.equal((await post(FLAT, { "x-voice-webhook-secret": "nope" })).status, 401);
  assert.equal((await post(FLAT, { "x-voice-webhook-secret": `${SECRET}x` })).status, 401);
  assert.equal((await post(FLAT, { authorization: "Bearer wrong" })).status, 401);
  assert.equal(voiceStore.rows.size, 0);
  assert.equal((await post(FLAT, { authorization: `Bearer ${SECRET}` })).status, 200);
  assert.equal(secretMatches("", SECRET), false);
  assert.equal(secretMatches(SECRET, SECRET), true);
});

test("auth: responses never echo the secret or any contact value", async () => {
  for (const headers of [{}, { "x-voice-webhook-secret": "bad" }, { "x-voice-webhook-secret": SECRET }]) {
    const res = await post(FLAT, headers);
    const text = await res.text();
    assert.doesNotMatch(text, new RegExp(SECRET));
    assert.doesNotMatch(text, /Dana|Whitlock|Northwind|dana@|5550142|category seat/i);
  }
  const bad = await post({ nothing: true });
  assert.equal(bad.status, 400);
  assert.doesNotMatch(await bad.text(), new RegExp(SECRET));
  for (const line of logLines) assert.doesNotMatch(JSON.stringify(line), new RegExp(SECRET));
});

/* ---------------- storage, idempotency, email, log ---------------- */

test("stores voice_calls (raw payload kept) and ONE leads row; emails Randy + Jon once", async () => {
  const res = await post(FLAT);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, duplicate: false });
  const row = voiceStore.rows.get("call_flat_001")!;
  assert.deepEqual(row.rawPayload, FLAT);
  assert.equal(row.callerNumber, "+14165550142");
  assert.equal(row.durationSeconds, 270);
  assert.equal(row.endReason, "caller_hangup");
  assert.equal(row.turns.length, 2);
  assert.equal(row.leadId, "voice:call_flat_001");
  const lead = leadStore.rows.get("voice:call_flat_001")!;
  assert.equal(lead.source, "voice");
  assert.equal(lead.phone, "+14165550142");
  assert.equal(lead.email, "dana@northwind.example");
  assert.equal(lead.company, "Northwind Physio");
  assert.equal(sentEmails.length, 1);
  const email = sentEmails[0]!;
  assert.match(email.subject, /Birch voice call: Northwind Physio/);
  assert.match(email.text, /Name: Dana Whitlock/);
  assert.match(email.text, /Phone: \+14165550142/);
  assert.match(email.text, /Caller: Dana Whitlock from Northwind Physio/);
  assert.match(email.text, /Randy AI: Hey, it's Randy's AI/);
  assert.equal(email.replyTo, "dana@northwind.example");
  const intake = logLines.find((l) => l["kind"] === "voice_call_intake" && l["reason"] === "before_send");
  assert.ok(intake, "structured safety-net log line written before send");
  assert.equal((intake!["intake"] as Record<string, unknown>)["phone"], "+14165550142");
  assert.ok(Array.isArray(intake!["transcript"]));
});

test("idempotent on call id: redelivery updates the row, never duplicates lead or email", async () => {
  await post(FLAT);
  const res = await post({ ...FLAT, extracted: { timing: "Next month" } });
  assert.deepEqual(await res.json(), { ok: true, duplicate: true });
  assert.equal(voiceStore.rows.size, 1);
  const row = voiceStore.rows.get("call_flat_001")!;
  assert.equal(row.receivedCount, 2);
  assert.equal(row.extracted.name, "Dana Whitlock", "later deliveries never blank earlier fields");
  assert.equal(row.extracted.timing, "Next month");
  assert.equal(leadStore.rows.size, 1);
  assert.equal(leadStore.rows.get("voice:call_flat_001")!.timing, "Next month");
  assert.equal(sentEmails.length, 1);
});

test("email failure is logged and retried on the next delivery of the same call", async () => {
  mailerFailures = 1;
  await post(FLAT);
  assert.equal(sentEmails.length, 0);
  assert.ok(logLines.some((l) => l["kind"] === "voice_call_intake" && l["reason"] === "send_failed"));
  assert.match(voiceStore.rows.get("call_flat_001")!.notifyError ?? "", /Resend HTTP 500/);
  await post(FLAT);
  assert.equal(sentEmails.length, 1);
});

/* ---------------- schema tolerance ---------------- */

test("tolerant: Standard Webhooks envelope + SIP headers + OpenAI-style content parts + epoch seconds", () => {
  const parsed = normalizeVoicePayload({
    object: "event",
    id: "evt_123",
    type: "realtime.call.ended",
    created_at: 1790000000,
    data: {
      call_id: "00000000-0000-0000-0000-000000000abc",
      sip_headers: [
        { name: "From", value: "\"Caller\" <sip:+16475550111@pstn.example>;tag=1" },
        { name: "To", value: "<sip:+15045046526@sip.x.ai>" },
      ],
      start_time: 1790000000,
      end_time: 1790000125,
      hangup_reason: "agent_ended",
      items: [
        { type: "message", role: "assistant", content: [{ type: "output_text", text: "Randy's AI here." }] },
        { type: "function_call", name: "lookup", arguments: "{}" },
        { type: "message", role: "user", content: [{ type: "input_audio", transcript: "Hi, Sam at Harbour Clinics." }] },
      ],
      data_collection: {
        caller_name: { value: "Sam Ortiz" },
        business_name: { value: "Harbour Clinics" },
        email_address: { value: "sam@harbour.example" },
        interest: { value: "Sponsor the recovery hubs" },
      },
    },
  });
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const c = parsed.call;
  assert.equal(c.callId, "00000000-0000-0000-0000-000000000abc");
  assert.equal(c.callerNumber, "+16475550111");
  assert.equal(c.calledNumber, "+15045046526");
  assert.equal(c.durationSeconds, 125);
  assert.equal(c.endReason, "agent_ended");
  assert.deepEqual(c.turns.map((t) => t.role), ["agent", "caller"]);
  assert.equal(c.extracted.name, "Sam Ortiz");
  assert.equal(c.extracted.company, "Harbour Clinics");
  assert.equal(c.extracted.email, "sam@harbour.example");
  assert.equal(c.extracted.need, "Sponsor the recovery hubs");
});

test("tolerant: camelCase, transcript as a string, first/last name, invalid email dropped", () => {
  const parsed = normalizeVoicePayload({
    callId: "abc-789",
    callerNumber: "(416) 555-0177",
    startedAt: "2026-09-24T20:00:00-04:00",
    durationMs: 61000,
    endedReason: "customer-ended-call",
    transcript: "Agent: Hi there\nCaller: It's Pat from Lakeview.\nCaller: Call me tomorrow.",
    analysis: { structuredData: { firstName: "Pat", lastName: "Nguyen", company: "Lakeview", email: "not-an-email", timeline: "Q1" }, summary: "Wants a callback." },
  });
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const c = parsed.call;
  assert.equal(c.callId, "abc-789");
  assert.equal(c.callerNumber, "4165550177");
  assert.equal(c.durationSeconds, 61);
  assert.equal(c.endReason, "customer-ended-call");
  assert.match(c.transcript ?? "", /Pat from Lakeview/);
  assert.equal(c.turns.length, 3);
  assert.equal(c.turns[1]!.role, "caller");
  assert.equal(c.extracted.name, "Pat Nguyen");
  assert.equal(c.extracted.company, "Lakeview");
  assert.equal(c.extracted.email, undefined);
  assert.equal(c.extracted.timing, "Q1");
  assert.equal(c.extracted.summary, "Wants a callback.");
});

test("tolerant: turns under {speaker,text}; minimal payload with only a call id is accepted", async () => {
  const p = normalizeVoicePayload({ call: { id: "nested-1" }, conversation: { turns: [{ speaker: "customer", text: "hello" }] } });
  assert.ok(p.ok && p.call.callId === "nested-1" && p.call.turns[0]!.role === "caller");
  const res = await post({ call_id: "bare-call-1" });
  assert.equal(res.status, 200);
  const email = renderVoiceEmail(voiceStore.rows.get("bare-call-1")!);
  assert.match(email.text, /no transcript in the webhook/);
  assert.equal(leadStore.rows.size, 0, "no contact at all → call row only, no lead");
});

test("tolerant but strict where it matters: missing call id / non-object → 400", async () => {
  assert.equal(normalizeVoicePayload({ transcript: "hi" }).ok, false);
  assert.equal(normalizeVoicePayload("nope").ok, false);
  assert.equal(normalizeVoicePayload({ call_id: "bad id with spaces" }).ok, false);
  assert.equal((await post([1, 2])).status, 400);
});

test("large transcripts (> 32kb) are accepted on this route", async () => {
  const turns = Array.from({ length: 400 }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: `turn ${i} ${"x".repeat(100)}` }));
  const res = await post({ call_id: "big-1", transcript: turns });
  assert.equal(res.status, 200);
  assert.equal(voiceStore.rows.get("big-1")!.turns.length, 400);
});

/* ---------------- one system of record: chat + advertiser ---------------- */

test("chat callback intake lands in the same leads table (chat:<session>), no contact echo", async () => {
  const q = await fetch(`${baseUrl}/launch/randy-chat/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: "rc_lead_0001", type: "qualified", qualify: { company: "Acme Rehab", need: "Partnership" } }),
  });
  assert.equal(q.status, 200);
  assert.equal(leadStore.rows.get("chat:rc_lead_0001")!.source, "chat_intake");
  const res = await fetch(`${baseUrl}/launch/randy-chat/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: "rc_lead_0001",
      type: "callback_request",
      messages: [{ role: "user", content: "call me" }],
      contact: { phone: "416 555 0199", name: "Lee Park", email: "lee@acme.example", role: "COO" },
    }),
  });
  assert.equal(res.status, 200);
  assert.doesNotMatch(await res.text(), /0199|Lee Park|lee@acme|COO/);
  const lead = leadStore.rows.get("chat:rc_lead_0001")!;
  assert.equal(leadStore.rows.size, 1);
  assert.equal(lead.source, "chat_callback");
  assert.equal(lead.phone, "416 555 0199");
  assert.equal(lead.company, "Acme Rehab");
  assert.equal(lead.need, "Partnership");
  await flush();
  assert.equal(lead.fridayStatus === "skipped" || leadStore.rows.get("chat:rc_lead_0001")!.fridayStatus === "skipped", true);
});

test("chat events without any contact or company do not create leads", async () => {
  await fetch(`${baseUrl}/launch/randy-chat/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: "rc_lead_empty", type: "tel_click" }),
  });
  assert.equal(leadStore.rows.size, 0);
});

test("advertiser follow-up form mirrors into leads (intake:<id>)", async () => {
  const lead = await captureAdvertiserIntakeLead({ id: "5b0c", email: "buyer@brand.example", advertisingIntent: "sponsor", advertiserSize: "national" });
  assert.equal(lead?.id, "intake:5b0c");
  assert.equal(lead?.source, "advertiser_intake");
  assert.equal(leadStore.rows.get("intake:5b0c")!.size, "national");
});

test("mergeLead: empty values never erase; callback is never downgraded", () => {
  const now = new Date();
  const a = mergeLead(undefined, { id: "chat:x", source: "chat_callback", sourceRef: "x", phone: "1", name: "A" }, now).lead;
  const b = mergeLead(a, { id: "chat:x", source: "chat_intake", sourceRef: "x", phone: "", name: undefined, company: "Co" }, now);
  assert.equal(b.lead.source, "chat_callback");
  assert.equal(b.lead.phone, "1");
  assert.equal(b.lead.company, "Co");
  assert.equal(b.changed, true);
});

/* ---------------- Friday push (mocked; never the real API) ---------------- */

function setFriday(): void {
  process.env["FRIDAY_API_URL"] = "https://friday.test.invalid";
  process.env["FRIDAY_API_KEY"] = FRIDAY_KEY;
}

test("Friday: unset env → skipped cleanly and recorded on the lead, no HTTP", async () => {
  await post(FLAT);
  await flush();
  assert.equal(fetchCalls.length, 0);
  const lead = leadStore.rows.get("voice:call_flat_001")!;
  assert.equal(lead.fridayStatus, "skipped");
  assert.equal(lead.fridayLastError, "friday_not_configured");
  assert.equal(fridayConfig({}), null);
});

test("Friday: pushes contact + deal to /api/intake with Bearer auth; records ids", async () => {
  setFriday();
  await post(FLAT);
  await flush();
  assert.equal(fetchCalls.length, 1);
  const call = fetchCalls[0]!;
  assert.equal(call.url, "https://friday.test.invalid/api/intake");
  assert.equal(call.headers["authorization"], `Bearer ${FRIDAY_KEY}`);
  assert.equal(call.body["externalId"], "birch-voice:call_flat_001");
  assert.equal(call.body["org"], "birchreserve");
  assert.equal(call.body["site"], "birchreserve.net");
  assert.equal(call.body["firstName"], "Dana");
  assert.equal(call.body["lastName"], "Whitlock");
  assert.equal(call.body["company"], "Northwind Physio");
  assert.equal(call.body["stage"], "Birch inbound");
  assert.ok((call.body["tags"] as string[]).includes("birch-inbound"));
  assert.doesNotMatch(JSON.stringify(call.body), new RegExp(FRIDAY_KEY));
  const lead = leadStore.rows.get("voice:call_flat_001")!;
  assert.equal(lead.fridayStatus, "sent");
  assert.equal(lead.fridayContactId, "11");
  assert.equal(lead.fridayDealId, "22");
});

test("Friday: retries 5xx / network errors inline, then succeeds", async () => {
  setFriday();
  fetchResponses = [{ status: 502, body: "bad gateway" }, new Error("ECONNRESET"), { status: 200, body: JSON.stringify({ contactId: 5, dealId: 6 }) }];
  await leadStore.upsert({ id: "chat:r1", source: "chat_callback", sourceRef: "r1", phone: "123-456-7890" });
  const result = await pushLeadToFriday("chat:r1");
  assert.equal(result?.status, "sent");
  assert.equal(fetchCalls.length, 3);
  assert.equal(leadStore.rows.get("chat:r1")!.fridayAttempts, 1);
});

test("Friday: 4xx fails without retry; stored error never contains the key", async () => {
  setFriday();
  fetchResponses = [{ status: 401, body: JSON.stringify({ error: `Invalid intake secret ${FRIDAY_KEY}` }) }];
  await leadStore.upsert({ id: "chat:r2", source: "chat_callback", sourceRef: "r2", email: "x@y.example" });
  const result = await pushLeadToFriday("chat:r2");
  assert.equal(result?.status, "failed");
  assert.equal(fetchCalls.length, 1);
  const lead = leadStore.rows.get("chat:r2")!;
  assert.equal(lead.fridayStatus, "failed");
  assert.match(lead.fridayLastError ?? "", /Friday HTTP 401/);
  assert.doesNotMatch(lead.fridayLastError ?? "", new RegExp(FRIDAY_KEY));
});

test("Friday: retry sweep pushes skipped leads once env is set; new info re-pushes a sent lead", async () => {
  await leadStore.upsert({ id: "chat:r3", source: "chat_intake", sourceRef: "r3", company: "Later Co" });
  await pushLeadToFriday("chat:r3");
  assert.equal(leadStore.rows.get("chat:r3")!.fridayStatus, "skipped");
  setFriday();
  assert.equal(await retryFridayPushes(), 1);
  assert.equal(leadStore.rows.get("chat:r3")!.fridayStatus, "sent");
  await leadStore.upsert({ id: "chat:r3", source: "chat_callback", sourceRef: "r3", phone: "555-555-1212" });
  assert.equal(leadStore.rows.get("chat:r3")!.fridayStatus, "pending");
  await pushLeadToFriday("chat:r3");
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[1]!.body["externalId"], "birch-chat:r3", "same externalId → Friday updates, never clones");
});

test("Friday: URL normalization and payload limits", () => {
  assert.equal(fridayIntakeUrl("https://fridayapp.org"), "https://fridayapp.org/api/intake");
  assert.equal(fridayIntakeUrl("https://fridayapp.org/"), "https://fridayapp.org/api/intake");
  assert.equal(fridayIntakeUrl("https://fridayapp.org/api"), "https://fridayapp.org/api/intake");
  assert.equal(fridayIntakeUrl("https://fridayapp.org/api/intake"), "https://fridayapp.org/api/intake");
  const now = new Date();
  const lead = mergeLead(undefined, { id: "voice:z", source: "voice", sourceRef: "z", email: "bad-email", phone: "1".repeat(60) }, now).lead;
  const p = buildFridayPayload(lead, { workspace: "birchreserve", stage: "Birch inbound" });
  assert.equal(p["email"], undefined);
  assert.equal((p["phone"] as string).length, 40);
  assert.equal(p["kind"], "bot");
});

/* ---------------- additive schema ---------------- */

function sqlFile(): string {
  for (const base of [path.resolve(process.cwd(), "../.."), process.cwd()]) {
    try {
      return readFileSync(path.join(base, "scripts/sql/2026-09-24-leads-voice-calls.sql"), "utf8");
    } catch {
      /* try next */
    }
  }
  throw new Error("dev-DB SQL file not found");
}
const squash = (x: string) => x.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();

test("schema: dev-DB SQL file is additive-only and identical to the runtime DDL", () => {
  const sql = sqlFile();
  const body = squash(sql);
  assert.doesNotMatch(body, /\b(DROP|RENAME|TRUNCATE|DELETE)\b/i);
  assert.doesNotMatch(body, /\bALTER\b/i);
  const stmts = body.split(";").map((x) => x.trim()).filter(Boolean);
  assert.deepEqual(stmts, [...LEADS_DDL, ...VOICE_CALLS_DDL].map(squash));
  for (const st of stmts) assert.match(st, /^CREATE (TABLE|INDEX) IF NOT EXISTS /);
});

test("schema: drizzle tables match the SQL columns and indexes (publish never proposes drops)", () => {
  for (const [table, ddl] of [
    [leadsTable, LEADS_DDL],
    [voiceCallsTable, VOICE_CALLS_DDL],
  ] as const) {
    const cfg = getTableConfig(table);
    const create = squash(ddl[0]);
    const cols = create
      .slice(create.indexOf("(") + 1, create.lastIndexOf(")"))
      .split(",")
      .map((c) => c.trim().split(" ")[0]);
    assert.deepEqual(cfg.columns.map((c) => c.name).sort(), [...cols].sort());
    const idx = ddl.slice(1).map((d) => squash(d).split(" ")[5]);
    assert.deepEqual(cfg.indexes.map((i) => i.config.name).sort(), [...idx].sort());
  }
});
