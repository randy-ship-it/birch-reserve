/**
 * Emma 7:21pm: Friday intake `meta` + `value`, paid-checkout re-post (idempotent, never
 * throws, skips is_test), and the secret-authed QA Friday test lead.
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import type Stripe from "stripe";
import { MemoryLeadStore, setLeadStoreForTests, upsertLeadSafe, type LeadInput } from "../src/lib/leads";
import {
  DEFAULT_FRIDAY_WORKSPACE,
  buildFridayPayload,
  fridayConfig,
  pushLeadToFriday,
  setFridayDepsForTests,
  type FridayFetch,
} from "../src/lib/fridayPush";
import { recordPaidCheckoutSafe, setCheckoutLeadDepsForTests, type CheckoutReservation } from "../src/lib/checkoutLead";
import { chatLeadInput } from "../src/lib/leadCapture";
import qaFridayRouter from "../src/routes/qaFriday";
import opsMailTestRouter, { MAIL_TEST_SUBJECT, MAIL_TEST_TO } from "../src/routes/opsMailTest";
import { DEFAULT_BIRCH_REPLY_TO, birchReplyTo, sendBuyerEmail, setSiteMailFetchForTests, type ResendFetch } from "../src/lib/siteMail";
import { resendMailer } from "../src/lib/randyChatTranscripts";
import { resetRateLimitsForTests } from "../src/lib/rateLimit";

const QA_SECRET = "qa-secret-for-friday-tests-5e2f";
const CFG = { workspace: "birchreserve", stage: "Birch inbound" };
let store = new MemoryLeadStore();
const fridayCalls: Array<Record<string, unknown>> = [];
const queued: string[] = [];
let reservations = new Map<string, CheckoutReservation>();
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;

const mockFriday: FridayFetch = async (_url, init) => {
  fridayCalls.push(JSON.parse(init.body) as Record<string, unknown>);
  return { ok: true, status: 201, text: async () => JSON.stringify({ contactId: 11, dealId: 22 }) };
};

function session(id: string, reservationId: string, sku = "reserve-490", paid = true): Stripe.Checkout.Session {
  return {
    id,
    object: "checkout.session",
    payment_status: paid ? "paid" : "unpaid",
    metadata: { reservationId, sku, offerKey: sku },
    customer_details: null,
    customer_email: null,
  } as unknown as Stripe.Checkout.Session;
}

before(async () => {
  setFridayDepsForTests({ fetch: mockFriday, sleep: async () => undefined });
  const app = express();
  app.use(express.json());
  app.use("/api", qaFridayRouter);
  app.use("/api", opsMailTestRouter);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${a.port}/api`;
  closeServer = () => new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
});

after(async () => {
  setCheckoutLeadDepsForTests(null);
  setSiteMailFetchForTests(null);
  await closeServer?.();
});

beforeEach(() => {
  process.env["FRIDAY_API_URL"] = "https://friday.example";
  process.env["FRIDAY_API_KEY"] = "friday-key-test";
  delete process.env["FRIDAY_WORKSPACE"];
  process.env["BIRCH_QA_SECRET"] = QA_SECRET;
  store = new MemoryLeadStore();
  setLeadStoreForTests(store);
  fridayCalls.length = 0;
  queued.length = 0;
  reservations = new Map();
  resetRateLimitsForTests();
  setCheckoutLeadDepsForTests({
    loadReservation: async (id) => reservations.get(id),
    queuePush: (leadId) => void queued.push(leadId),
  });
});

const base: LeadInput = { id: "chat:sess-1", source: "chat_intake", sourceRef: "sess-1", email: "pat@clinic.example", name: "Pat Lee" };

test("FRIDAY_WORKSPACE unset → org defaults to birchreserve", () => {
  assert.equal(DEFAULT_FRIDAY_WORKSPACE, "birchreserve");
  assert.equal(fridayConfig()?.workspace, "birchreserve");
  process.env["FRIDAY_WORKSPACE"] = "other";
  assert.equal(fridayConfig()?.workspace, "other");
});

test("meta: known keys only (no empty strings), source bucket, is_test; value + sku tag when sku known", async () => {
  const lead = await upsertLeadSafe({ ...base, need: "Physio referrals", timing: "", utmSource: "linkedin" });
  assert.ok(lead);
  const p = buildFridayPayload(lead, CFG);
  assert.deepEqual(p["meta"], { source: "chat", utm_source: "linkedin", need: "Physio referrals", is_test: false });
  assert.equal("value" in p, false);
  assert.equal(p["externalId"], "birch-chat:sess-1");

  const withSku = await upsertLeadSafe({ ...base, meta: { category: "Orthotics", hubs: "Toronto East", sku: "hold-190", category_bad: "" } as never });
  const q = buildFridayPayload(withSku!, CFG);
  const meta = q["meta"] as Record<string, unknown>;
  assert.equal(meta["category"], "Orthotics");
  assert.equal(meta["hubs"], "Toronto East");
  assert.equal(meta["sku"], "hold-190");
  assert.equal(q["value"], 190);
  assert.ok((q["tags"] as string[]).includes("birch:hold-190"));
  for (const v of Object.values(meta)) assert.notEqual(v, "");
});

test("chat lead carries qualify category + reach as meta.category / meta.hubs", () => {
  const input = chatLeadInput(
    {
      id: "s1",
      qualify: { category: "Massage", reach: "Downtown hubs" },
      contact: { email: "x@y.example" },
      pagePath: null,
      isTest: false,
      lastHandoff: null,
    } as never,
    "qualified",
  );
  assert.deepEqual(input.meta, { category: "Massage", hubs: "Downtown hubs" });
});

test("paid checkout joins the prior lead's externalId, value 490, reserve tag, paid meta; idempotent per session", async () => {
  await upsertLeadSafe({ ...base, meta: { category: "Physio" }, utmCampaign: "fall" });
  reservations.set("r-1", { id: "r-1", email: "PAT@clinic.example", brandName: "Pat Clinic", offerKey: "reserve-490", isTest: false });

  const first = await recordPaidCheckoutSafe(session("cs_1", "r-1"));
  assert.equal(first.status, "recorded");
  assert.equal(first.status === "recorded" && first.externalId, "birch-chat:sess-1");
  assert.deepEqual(queued, ["checkout:r-1"]);

  const lead = await store.get("checkout:r-1");
  assert.ok(lead);
  assert.equal(lead.source, "checkout");
  const p = buildFridayPayload(lead, CFG);
  assert.equal(p["externalId"], "birch-chat:sess-1");
  assert.equal(p["value"], 490);
  assert.ok((p["tags"] as string[]).includes("birch:reserve-490"));
  const meta = p["meta"] as Record<string, unknown>;
  assert.equal(meta["paid"], true);
  assert.equal(meta["sku"], "reserve-490");
  assert.equal(meta["stripe_session_id"], "cs_1");
  assert.equal(meta["category"], "Physio");
  assert.equal(meta["source"], "checkout");
  assert.equal(meta["utm_campaign"], "fall");

  // Push once, then a duplicate webhook delivery for the same session: no second Friday post.
  await pushLeadToFriday("checkout:r-1");
  assert.equal(fridayCalls.length, 1);
  const again = await recordPaidCheckoutSafe(session("cs_1", "r-1"));
  assert.equal(again.status === "recorded" && again.created, false);
  await pushLeadToFriday("checkout:r-1");
  assert.equal(fridayCalls.length, 1, "same session never re-posts");
  assert.equal((await store.get("checkout:r-1"))?.fridayStatus, "sent");
});

test("paid checkout with no prior lead → birch-checkout-<reservationId>, hold-190 → value 190", async () => {
  reservations.set("r-2", { id: "r-2", email: "new@brand.example", brandName: "New Brand", offerKey: "hold-190", isTest: false });
  const out = await recordPaidCheckoutSafe(session("cs_2", "r-2", "hold-190"));
  assert.equal(out.status === "recorded" && out.externalId, "birch-checkout-r-2");
  const p = buildFridayPayload((await store.get("checkout:r-2"))!, CFG);
  assert.equal(p["value"], 190);
  assert.ok((p["tags"] as string[]).includes("birch:hold-190"));
});

test("paid checkout from QA (qa+ email / QA name / reservation is_test) is stored but never pushed", async () => {
  reservations.set("r-3", { id: "r-3", email: "qa+buyer@birchreserve.net", brandName: "Brand", offerKey: "hold-190", isTest: false });
  reservations.set("r-4", { id: "r-4", email: "real@brand.example", brandName: "QA Test Brand", offerKey: "hold-190", isTest: false });
  reservations.set("r-5", { id: "r-5", email: "real2@brand.example", brandName: "Brand", offerKey: "hold-190", isTest: true });
  for (const id of ["r-3", "r-4", "r-5"]) {
    const out = await recordPaidCheckoutSafe(session(`cs_${id}`, id, "hold-190"));
    assert.equal(out.status === "recorded" && out.isTest, true);
    await pushLeadToFriday(`checkout:${id}`);
  }
  assert.deepEqual(queued, []);
  assert.equal(fridayCalls.length, 0);
});

test("checkout → Friday never throws (DB error, unpaid, missing reservation)", async () => {
  setCheckoutLeadDepsForTests({
    loadReservation: async () => {
      throw new Error("db down");
    },
    queuePush: () => undefined,
  });
  const out = await recordPaidCheckoutSafe(session("cs_x", "r-x"));
  assert.equal(out.status, "error");
  setCheckoutLeadDepsForTests({ loadReservation: async () => undefined, queuePush: () => undefined });
  assert.deepEqual(await recordPaidCheckoutSafe(session("cs_y", "r-y")), { status: "ignored", reason: "reservation_not_found" });
  assert.deepEqual(await recordPaidCheckoutSafe(session("cs_z", "r-z", "hold-190", false)), { status: "ignored", reason: "not_paid" });
});

test("QA Friday test lead: 404 without the X-Birch-QA secret; with it, one is_test lead reaches Friday with meta", async () => {
  const denied = await fetch(`${baseUrl}/launch/qa/friday-test-lead`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(denied.status, 404);
  const wrong = await fetch(`${baseUrl}/launch/qa/friday-test-lead`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-birch-qa": "nope" },
    body: "{}",
  });
  assert.equal(wrong.status, 404);
  assert.equal(fridayCalls.length, 0);

  const res = await fetch(`${baseUrl}/launch/qa/friday-test-lead`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-birch-qa": QA_SECRET },
    body: JSON.stringify({ source: "checkout", sku: "reserve-490", category: "Physio (QA)" }),
  });
  assert.equal(res.status, 201);
  const body = (await res.json()) as { leadId: string; friday: { status: string }; payload: Record<string, unknown> };
  assert.equal(body.friday.status, "sent");
  assert.equal(fridayCalls.length, 1);
  const sent = fridayCalls[0]!;
  assert.match(String(sent["firstName"]), /^QA$/);
  assert.match(String(sent["email"]), /^qa\+friday-/);
  assert.equal(sent["org"], "birchreserve");
  assert.equal(sent["value"], 490);
  const meta = sent["meta"] as Record<string, unknown>;
  assert.equal(meta["is_test"], true);
  assert.equal(meta["category"], "Physio (QA)");
  assert.equal(meta["paid"], true);
  assert.equal(meta["source"], "checkout");
  assert.ok((sent["tags"] as string[]).includes("birch:qa-test"));
  assert.ok((sent["tags"] as string[]).includes("birch:reserve-490"));
  assert.doesNotMatch(JSON.stringify(body), /friday-key-test/);
});

/* ---------------- Reply-To + ops mail test (Randy 7:27pm) ---------------- */

const resendCalls: Array<Record<string, unknown>> = [];
const mockResend: ResendFetch = async (_url, init) => {
  resendCalls.push(JSON.parse(init.body) as Record<string, unknown>);
  return { ok: true, status: 200, text: async () => JSON.stringify({ id: `re_${resendCalls.length}` }) };
};

function mailSetup() {
  resendCalls.length = 0;
  setSiteMailFetchForTests(mockResend);
  process.env["RESEND_API_KEY"] = "re_test_key_not_real";
  delete process.env["BIRCH_REPLY_TO"];
  delete process.env["RANDY_CHAT_TO"];
}

test("BIRCH_REPLY_TO: defaults to sales@, env-overridable, invalid values fall back", () => {
  assert.equal(DEFAULT_BIRCH_REPLY_TO, "sales@silverbirchgrowth.com");
  assert.equal(birchReplyTo({}), "sales@silverbirchgrowth.com");
  assert.equal(birchReplyTo({ BIRCH_REPLY_TO: "team@silverbirchgrowth.com" }), "team@silverbirchgrowth.com");
  assert.equal(birchReplyTo({ BIRCH_REPLY_TO: "not an email" }), "sales@silverbirchgrowth.com");
});

test("buyer email always carries Reply-To sales@; internal notifications still go TO randy@ + jon@ with visitor Reply-To", async () => {
  mailSetup();
  await sendBuyerEmail({ from: "Birch Reserve <care@scalehealth.ca>", to: ["buyer@brand.example"], subject: "s", text: "t" });
  assert.equal(resendCalls[0]!["reply_to"], "sales@silverbirchgrowth.com");
  await resendMailer({ subject: "lead", text: "x", html: "<p>x</p>", replyTo: "visitor@brand.example" });
  assert.deepEqual(resendCalls[1]!["to"], ["randy@silverbirchgrowth.com", "jon@silverbirchgrowth.com"]);
  assert.equal(resendCalls[1]!["reply_to"], "visitor@brand.example");
});

test("POST /api/ops/mail-test: secret required, fixed sales@ recipient + subject, Reply-To sales@, 3 per hour", async () => {
  mailSetup();
  const call = (headers: Record<string, string>, body: unknown = {}) =>
    fetch(`${baseUrl}/ops/mail-test`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.equal((await call({})).status, 401);
  assert.equal((await call({ "x-birch-qa": "wrong" })).status, 401);
  assert.equal(resendCalls.length, 0);

  const ok = await call({ "x-birch-qa": QA_SECRET }, { to: "attacker@evil.example", subject: "hijack" });
  assert.equal(ok.status, 200);
  const body = (await ok.json()) as { accepted: boolean; id: string; sentAt: string };
  assert.equal(body.accepted, true);
  assert.equal(body.id, "re_1");
  assert.ok(!Number.isNaN(Date.parse(body.sentAt)));
  assert.deepEqual(resendCalls[0]!["to"], [MAIL_TEST_TO]);
  assert.equal(MAIL_TEST_TO, "sales@silverbirchgrowth.com");
  assert.equal(resendCalls[0]!["subject"], MAIL_TEST_SUBJECT);
  assert.equal(MAIL_TEST_SUBJECT, "Birch site test — sales@ routing");
  assert.equal(resendCalls[0]!["reply_to"], "sales@silverbirchgrowth.com");
  assert.doesNotMatch(JSON.stringify(resendCalls[0]), /attacker|hijack/);

  assert.equal((await call({ "x-birch-qa": QA_SECRET })).status, 200);
  assert.equal((await call({ "x-birch-qa": QA_SECRET })).status, 200);
  const limited = await call({ "x-birch-qa": QA_SECRET });
  assert.equal(limited.status, 429);
  assert.equal(resendCalls.length, 3);
});

test("POST /api/ops/mail-test without a mail key → 503, nothing sent", async () => {
  mailSetup();
  delete process.env["RESEND_API_KEY"];
  const res = await fetch(`${baseUrl}/ops/mail-test`, { method: "POST", headers: { "x-birch-qa": QA_SECRET } });
  assert.equal(res.status, 503);
  assert.equal(resendCalls.length, 0);
});
