/**
 * Ads-only inventory signup: validation, lead upsert ads:{id}, Friday payload shape.
 * Bot gate coverage lives in publicGuards (path added to fakeReceipts / GUARDED_POSTS).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import adsInventorySignupRouter from "../src/routes/adsInventorySignup";
import { MemoryLeadStore, setLeadStoreForTests } from "../src/lib/leads";
import {
  buildFridayPayload,
  setFridayDepsForTests,
  type FridayFetch,
} from "../src/lib/fridayPush";
import { isGuardedPost } from "../src/lib/publicGuards";

let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;
let leadStore = new MemoryLeadStore();
const fetchCalls: Array<Record<string, unknown>> = [];

const mockFetch: FridayFetch = async (_url, init) => {
  fetchCalls.push(JSON.parse(init.body) as Record<string, unknown>);
  return { ok: true, status: 201, text: async () => JSON.stringify({ contactId: 11, dealId: 22 }) };
};

before(async () => {
  delete process.env["FRIDAY_API_URL"];
  delete process.env["FRIDAY_API_KEY"];
  setFridayDepsForTests({ fetch: mockFetch, sleep: async () => undefined });

  const app = express();
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", adsInventorySignupRouter);
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
  fetchCalls.length = 0;
  delete process.env["FRIDAY_API_URL"];
  delete process.env["FRIDAY_API_KEY"];
});

function post(body: unknown) {
  return fetch(`${baseUrl}/launch/ads-inventory-signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const GOOD = {
  company: "Example Clinic Group",
  name: "Alex Nguyen",
  email: "ops@exampleclinic.com",
  phone: "+1-416-555-0142",
  audienceEstimate: "~8k email list; ~25k monthly site visits",
  inventoryTypes: ["site", "email", "waiting_room"],
  notes: "Ontario physio clinics; no CBD creatives.",
  idempotencyKey: "7c2e9f1a-4b8d-4e2a-9c11-0a1b2c3d4e5f",
  path: "/sell-ads",
};

test("bot gate: ads-inventory-signup is a guarded public POST", () => {
  assert.equal(isGuardedPost("/api/launch/ads-inventory-signup"), true);
});

test("validation: rejects missing required fields and empty inventoryTypes", async () => {
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ ...GOOD, company: "" })).status, 400);
  assert.equal((await post({ ...GOOD, email: "not-an-email" })).status, 400);
  assert.equal((await post({ ...GOOD, inventoryTypes: [] })).status, 400);
  assert.equal((await post({ ...GOOD, inventoryTypes: ["billboard"] })).status, 400);
  assert.equal(leadStore.rows.size, 0);
});

test("happy path: upserts inventory_signup lead and Friday payload shape", async () => {
  process.env["FRIDAY_API_URL"] = "https://friday.example";
  process.env["FRIDAY_API_KEY"] = "friday-key-test";
  const res = await post(GOOD);
  assert.equal(res.status, 201);
  const json = (await res.json()) as { ok: boolean; leadId: string };
  assert.equal(json.ok, true);
  assert.equal(json.leadId, "ads:7c2e9f1a-4b8d-4e2a-9c11-0a1b2c3d4e5f");

  const lead = leadStore.rows.get(json.leadId)!;
  assert.equal(lead.source, "inventory_signup");
  assert.equal(lead.sourceRef, GOOD.idempotencyKey);
  assert.equal(lead.name, "Alex Nguyen");
  assert.equal(lead.company, "Example Clinic Group");
  assert.equal(lead.email, "ops@exampleclinic.com");
  assert.equal(lead.phone, "+1-416-555-0142");
  assert.equal(lead.size, GOOD.audienceEstimate);
  assert.match(lead.need ?? "", /^site,email,waiting_room/);
  assert.match(lead.need ?? "", /Notes: Ontario physio/);
  assert.equal(lead.pagePath, "/sell-ads");
  assert.equal(lead.meta.friday_external_id, "birch-ads-7c2e9f1a-4b8d-4e2a-9c11-0a1b2c3d4e5f");
  assert.equal(lead.isTest, false);
  // Do not attach sku/paid for this door.
  assert.equal(lead.meta.sku, undefined);
  assert.equal(lead.meta.paid, undefined);

  const payload = buildFridayPayload(lead, { workspace: "birchreserve", stage: "Birch inbound" });
  assert.equal(payload["externalId"], "birch-ads-7c2e9f1a-4b8d-4e2a-9c11-0a1b2c3d4e5f");
  assert.equal(payload["org"], "birchreserve");
  assert.equal(payload["site"], "birchreserve.net");
  assert.equal(payload["path"], "/sell-ads");
  assert.equal(payload["source"], "Birch ads-only inventory signup");
  assert.equal(payload["kind"], "form");
  assert.equal(payload["firstName"], "Alex");
  assert.equal(payload["lastName"], "Nguyen");
  const meta = payload["meta"] as Record<string, unknown>;
  assert.equal(meta["source"], "form");
  assert.equal(meta["need"], "site,email,waiting_room");
  assert.equal(meta["size"], GOOD.audienceEstimate);
  assert.equal("sku" in meta, false);
  assert.equal("paid" in meta, false);
  assert.equal("value" in payload, false);
  const tags = payload["tags"] as string[];
  assert.ok(tags.includes("birch-inbound"));
  assert.ok(tags.includes("birch:inventory-signup"));
  assert.ok(tags.includes("door:sell-ads"));
  const message = String(payload["message"]);
  assert.match(message, /Audience estimate:/);
  assert.match(message, /Inventory: site,email,waiting_room/);
  assert.match(message, /Notes: Ontario physio/);
  assert.doesNotMatch(message, /Need:/);
});

test("idempotency: same key upserts same lead id", async () => {
  const first = await post(GOOD);
  assert.equal(first.status, 201);
  const second = await post({ ...GOOD, notes: "Updated note only." });
  assert.equal(second.status, 201);
  const j1 = (await first.json()) as { leadId: string };
  const j2 = (await second.json()) as { leadId: string };
  assert.equal(j1.leadId, j2.leadId);
  assert.equal(leadStore.rows.size, 1);
  assert.match(leadStore.rows.get(j1.leadId)!.need ?? "", /Updated note only/);
});

test("is_test identity: stored and marked test", async () => {
  const res = await post({
    ...GOOD,
    idempotencyKey: "ads-qa-probe-key-001",
    email: "qa+inventory@silverbirchgrowth.com",
  });
  assert.equal(res.status, 201);
  const j = (await res.json()) as { leadId: string };
  assert.equal(leadStore.rows.get(j.leadId)!.isTest, true);
});
