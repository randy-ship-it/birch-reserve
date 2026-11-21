import test from "node:test";
import assert from "node:assert/strict";
import { buildExclusiveReserveSession, EXCLUSIVE_RESERVE, EXCLUSIVE_RESERVE_TERMS } from "../src/lib/exclusiveReserve";
import { PACING_ROWS, TAM_2027, tam2027Headline, tam2027Text } from "../src/lib/inventoryPlan";

test("exclusive reserve session is CAD 1,900 with a plain description and the RESERVE suffix", () => {
  const r = buildExclusiveReserveSession({ brand: "Acme", email: "a@acme.com", category: "Sleep", agree: true }, "https://birchreserve.net");
  assert.ok(r.ok);
  const p = r.params as any;
  assert.equal(p.line_items[0].price_data.currency, "cad");
  assert.equal(p.line_items[0].price_data.unit_amount, 190000);
  assert.match(p.line_items[0].price_data.product_data.description, /\$5K–\$50K exclusive display package/);
  assert.equal(p.metadata.kind, EXCLUSIVE_RESERVE.kind);
  assert.equal(p.payment_intent_data.statement_descriptor_suffix, "RESERVE");
  assert.ok(("BIRCHRSV* " + p.payment_intent_data.statement_descriptor_suffix).length <= 22);
  assert.match(p.success_url, /\/exclusive\?reserve=success&session_id=\{CHECKOUT_SESSION_ID\}/);
});

test("exclusive reserve needs brand, email and agreement", () => {
  assert.equal(buildExclusiveReserveSession({ brand: "", email: "a@b.co", agree: true }, "x").ok, false);
  assert.equal(buildExclusiveReserveSession({ brand: "A", email: "a@b.co", agree: false }, "x").ok, false);
});

test("terms keep IO-first, refund window and no guarantees", () => {
  const t = EXCLUSIVE_RESERVE_TERMS.join(" ");
  assert.match(t, /14 days before the launch date/);
  assert.match(t, /Nothing runs before then/);
  assert.match(t, /No impression guarantees/);
  assert.match(t, /up to 6 months/);
});

test("pacing and 2027 figure are modelled and never zero", () => {
  assert.equal(PACING_ROWS.length, 6);
  for (const r of PACING_ROWS) assert.match(r.perMonth, /\/mo$/);
  for (const c of TAM_2027.cases) assert.ok(c.usdYear > 0 && c.viewsYear > 0);
  assert.match(tam2027Headline(), /^\$\d/);
  const txt = tam2027Text();
  assert.match(txt, /Modelled 2027 estimate, not a commitment/);
  assert.doesNotMatch(txt, /signed partners|Align|Clairvoyant|Alset|MedVibe|Friday|80 locations|Integrity Fitness|CTR|ROAS/i);
});

test("e2e (local): /exclusive renders, checkout is held when deposits are off, signed checkout.session.completed records the order", async () => {
  const Stripe = (await import("stripe")).default;
  const express = (await import("express")).default;
  const { MemoryLeadStore, setLeadStoreForTests } = await import("../src/lib/leads");
  const { handleStripeWebhook } = await import("../src/routes/splashAdReservations");
  const router = (await import("../src/routes/exclusiveReserve")).default;
  const store = new MemoryLeadStore();
  setLeadStoreForTests(store);
  delete process.env.SPONSOR_DEPOSITS_ENABLED;
  process.env.SALES_ALERTS_DISABLED = "true";
  const app = express().use(router);
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const page = await (await fetch(`http://127.0.0.1:${port}/exclusive`)).text();
    assert.match(page, /Reserve \$1,900 CAD\. Lock your category/);
    assert.match(page, /25% below the regular rate/);
    assert.match(page, /\$833–\$8,333 CAD\/mo/);
    const held = await fetch(`http://127.0.0.1:${port}/v1/exclusive/reserve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand: "QA Test", email: "qa+exclusive@example.com", agree: true }) });
    assert.equal(held.status, 200);
    assert.equal(((await held.json()) as { held: boolean }).held, true);
  } finally {
    server.close();
  }
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_local_only";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_local_e2e";
  const session = { id: "cs_test_localE2E000001", object: "checkout.session", livemode: false, payment_status: "paid", amount_total: 190000, currency: "cad", customer_details: { email: "buyer@acme.com" }, metadata: { kind: "exclusive_reserve", sku: "exclusive-reserve-1900-cad", brand: "Acme", category: "Sleep" } };
  const payload = JSON.stringify({ id: "evt_local_1", object: "event", type: "checkout.session.completed", data: { object: session } });
  const sig = new Stripe("sk_test_local_only").webhooks.generateTestHeaderString({ payload, secret: "whsec_local_e2e" });
  await handleStripeWebhook(Buffer.from(payload), sig);
  const lead = await store.get("reserve:cs_test_localE2E000001");
  assert.ok(lead, "paid reserve recorded");
  assert.equal(lead!.meta.sku, "exclusive-reserve-1900-cad");
  assert.equal(lead!.meta.value, 1900);
  assert.equal(lead!.meta.currency, "cad");
  assert.equal(lead!.isTest, true);
  await assert.rejects(handleStripeWebhook(Buffer.from(payload), "t=1,v1=bad"));
});
