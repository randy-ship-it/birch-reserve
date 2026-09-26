/**
 * Local Biz → Birch Neon shared lead write path.
 * Auth (503/401), happy path with MemoryLeadStore, Friday externalId reuse, notify skip for is_test.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import localBizLeadRouter, { LOCAL_BIZ_SECRET_ENV, localBizSecretMatches } from "../src/routes/localBizLead";
import { MemoryLeadStore, setLeadStoreForTests } from "../src/lib/leads";
import {
  buildFridayPayload,
  setFridayDepsForTests,
  type FridayFetch,
} from "../src/lib/fridayPush";
import { sanitizeLocalBizExternalId } from "../src/lib/leadCapture";
import {
  renderLocalBizLeadEmail,
  setLocalBizLeadNotifyDepsForTests,
} from "../src/lib/localBizLeadNotify";
import type { RenderedEmail } from "../src/lib/randyChatTranscripts";

const SECRET = "test-local-biz-secret-a1b2c3d4";
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;
let leadStore = new MemoryLeadStore();
const sentEmails: RenderedEmail[] = [];
const fetchCalls: Array<Record<string, unknown>> = [];

const mockFetch: FridayFetch = async (_url, init) => {
  fetchCalls.push(JSON.parse(init.body) as Record<string, unknown>);
  return { ok: true, status: 201, text: async () => JSON.stringify({ contactId: 11, dealId: 22 }) };
};

before(async () => {
  process.env[LOCAL_BIZ_SECRET_ENV] = SECRET;
  delete process.env["FRIDAY_API_URL"];
  delete process.env["FRIDAY_API_KEY"];
  setFridayDepsForTests({ fetch: mockFetch, sleep: async () => undefined });
  setLocalBizLeadNotifyDepsForTests({
    mailer: async (email) => {
      sentEmails.push(email);
    },
    mailerReady: () => true,
  });

  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", localBizLeadRouter);
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
  await closeServer?.();
});

beforeEach(() => {
  leadStore = new MemoryLeadStore();
  setLeadStoreForTests(leadStore);
  sentEmails.length = 0;
  fetchCalls.length = 0;
  process.env[LOCAL_BIZ_SECRET_ENV] = SECRET;
  delete process.env["FRIDAY_API_URL"];
  delete process.env["FRIDAY_API_KEY"];
  setLocalBizLeadNotifyDepsForTests({
    mailer: async (email) => {
      sentEmails.push(email);
    },
    mailerReady: () => true,
  });
});

function post(body: unknown, headers: Record<string, string> = { "x-birch-local-biz-secret": SECRET }) {
  return fetch(`${baseUrl}/launch/local-biz-lead`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const GOOD = {
  externalId: "localbiz-ext-20260926-a1",
  email: "dana@northwind.example",
  firstName: "Dana",
  lastName: "Whitlock",
  company: "Northwind Physio",
  role: "Owner",
  phone: "+14165550142",
  need: "Category seat",
  size: "3 clinics",
  timing: "This quarter",
  pagePath: "/local-biz",
  category: "physio",
  hubs: "GTA",
  website: "https://northwind.example",
};

test("sanitizeLocalBizExternalId: safe chars, max 160", () => {
  assert.equal(sanitizeLocalBizExternalId("  localbiz-ok_1:2.3  "), "localbiz-ok_1:2.3");
  assert.equal(sanitizeLocalBizExternalId("bad<!>/chars"), "badchars");
  assert.equal(sanitizeLocalBizExternalId(""), null);
  assert.equal(sanitizeLocalBizExternalId("   "), null);
  const long = "x".repeat(200);
  assert.equal(sanitizeLocalBizExternalId(long)!.length, 160);
});

test("auth: 503 when BIRCH_LOCAL_BIZ_SECRET is unset", async () => {
  delete process.env[LOCAL_BIZ_SECRET_ENV];
  const res = await post(GOOD);
  assert.equal(res.status, 503);
  assert.equal(leadStore.rows.size, 0);
});

test("auth: 401 when header missing/wrong; Bearer also accepted", async () => {
  assert.equal((await post(GOOD, {})).status, 401);
  assert.equal((await post(GOOD, { "x-birch-local-biz-secret": "nope" })).status, 401);
  assert.equal((await post(GOOD, { authorization: "Bearer wrong" })).status, 401);
  assert.equal(leadStore.rows.size, 0);
  assert.equal((await post(GOOD, { authorization: `Bearer ${SECRET}` })).status, 200);
  assert.equal(localBizSecretMatches("", SECRET), false);
  assert.equal(localBizSecretMatches(SECRET, SECRET), true);
});

test("auth: responses never echo the secret or contact PII", async () => {
  for (const headers of [{}, { "x-birch-local-biz-secret": "bad" }, { "x-birch-local-biz-secret": SECRET }]) {
    const res = await post(GOOD, headers);
    const text = await res.text();
    assert.doesNotMatch(text, new RegExp(SECRET));
    assert.doesNotMatch(text, /Dana|Whitlock|Northwind|dana@|5550142/i);
  }
});

test("validation: require externalId + email or phone; reject unknown fields", async () => {
  assert.equal((await post({ email: "a@b.co" })).status, 400);
  assert.equal((await post({ externalId: "x" })).status, 400);
  assert.equal((await post({ ...GOOD, evil: true })).status, 400);
  assert.equal(leadStore.rows.size, 0);
});

test("happy path: upserts local_biz lead, emails Randy+Jon, Friday externalId reused", async () => {
  process.env["FRIDAY_API_URL"] = "https://friday.example";
  process.env["FRIDAY_API_KEY"] = "friday-key-test";
  const res = await post(GOOD);
  assert.equal(res.status, 200);
  const json = (await res.json()) as { ok: boolean; leadId: string; created: boolean };
  assert.equal(json.ok, true);
  assert.equal(json.created, true);
  assert.equal(json.leadId, "localbiz:localbiz-ext-20260926-a1");
  assert.doesNotMatch(JSON.stringify(json), /dana@|Northwind|5550142/i);

  const lead = leadStore.rows.get(json.leadId)!;
  assert.equal(lead.source, "local_biz");
  assert.equal(lead.sourceRef, "localbiz-ext-20260926-a1");
  assert.equal(lead.name, "Dana Whitlock");
  assert.equal(lead.company, "Northwind Physio");
  assert.equal(lead.email, "dana@northwind.example");
  assert.equal(lead.phone, "+14165550142");
  assert.match(lead.need ?? "", /Category seat/);
  assert.match(lead.need ?? "", /Website: https:\/\/northwind.example/);
  assert.equal(lead.meta.friday_external_id, "localbiz-ext-20260926-a1");
  assert.equal(lead.meta.category, "physio");
  assert.equal(lead.isTest, false);

  // Allow fire-and-forget Friday push to settle.
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(sentEmails.length, 1);
  const email = sentEmails[0]!;
  assert.match(email.subject, /Local Biz lead: Northwind Physio/);
  assert.equal(email.replyTo, "dana@northwind.example");
  assert.match(email.text, /Lead id: localbiz:localbiz-ext-20260926-a1/);

  const payload = buildFridayPayload(lead, { workspace: "birchreserve", stage: "Birch inbound" });
  assert.equal(payload["externalId"], "localbiz-ext-20260926-a1");
  assert.equal(payload["source"], "Local Biz lead");
  assert.equal((payload["meta"] as Record<string, unknown>)["source"], "form");
  assert.ok((payload["tags"] as string[]).includes("birch:local-biz"));
});

test("idempotent re-post: same externalId does not re-email", async () => {
  const first = await post(GOOD);
  assert.equal(first.status, 200);
  assert.equal(((await first.json()) as { created: boolean }).created, true);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sentEmails.length, 1);

  const second = await post({ ...GOOD, role: "Clinic Director" });
  assert.equal(second.status, 200);
  const j = (await second.json()) as { created: boolean; leadId: string };
  assert.equal(j.created, false);
  assert.equal(leadStore.rows.get(j.leadId)!.role, "Clinic Director");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sentEmails.length, 1);
});

test("is_test: stored, no email, Friday skipped", async () => {
  process.env["FRIDAY_API_URL"] = "https://friday.example";
  process.env["FRIDAY_API_KEY"] = "friday-key-test";
  const res = await post({
    ...GOOD,
    externalId: "localbiz-qa-probe-1",
    email: "qa+localbiz@silverbirchgrowth.com",
    isTest: true,
  });
  assert.equal(res.status, 200);
  const j = (await res.json()) as { leadId: string };
  const lead = leadStore.rows.get(j.leadId)!;
  assert.equal(lead.isTest, true);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(sentEmails.length, 0);
  assert.equal(fetchCalls.length, 0);
});

test("renderLocalBizLeadEmail subject prefers company then email", () => {
  const lead = {
    id: "localbiz:x",
    source: "local_biz" as const,
    sourceRef: "x",
    name: "Pat",
    company: null,
    role: null,
    phone: null,
    email: "pat@ex.com",
    need: null,
    size: null,
    timing: null,
    pagePath: null,
    fridayStatus: "pending" as const,
    fridayAttempts: 0,
    fridayLastError: null,
    fridayContactId: null,
    fridayDealId: null,
    fridayPushedAt: null,
    fridayAttemptedAt: null,
    isTest: false,
    meta: {},
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    referrer: null,
    landingPage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  assert.match(renderLocalBizLeadEmail(lead).subject, /Local Biz lead: pat@ex.com/);
});
