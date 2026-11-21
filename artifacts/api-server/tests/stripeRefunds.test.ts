/**
 * Stripe audit (Nov 21 2026): refunds and chargebacks take the ad credit back and alert sales; a repeated paid event records one
 * order and sends one alert; every Checkout Session carries site / sold_by / currency and mirrors its order keys onto the
 * PaymentIntent. In-memory Postgres (PGlite), no network, no Stripe.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import * as store from "../src/lib/adserver/store";
import { draftCampaignFromCheckoutSafe } from "../src/lib/adserver/service";
import { creditRatio, handleChargeRefundedSafe, handleDisputeCreatedSafe, setStripeRefundDepsForTests } from "../src/lib/stripeRefunds";
import { setSalesAlertDepsForTests } from "../src/lib/salesAlert";
import { promoContext, withPromoMetadata } from "../src/lib/adserver/promoContext";
import { processStripeEvent } from "../src/routes/splashAdReservations";
import { STREET_COUPON_NAME } from "../src/lib/adserver/promoNet";

const sent: string[] = [];
setSalesAlertDepsForTests({ ready: () => true, send: async (m) => (sent.push(m.subject), { id: "x" }) });

const session = (id: string, md: Record<string, string>, amount: number, currency = "usd") =>
  ({ id, object: "checkout.session", payment_status: "paid", status: "complete", livemode: true, amount_total: amount, currency, created: 1795300000, customer_details: { email: "buyer@brand.com", name: "Brand" }, metadata: md, payment_intent: `pi_${id}` }) as never;

test("refunds: partial then full refund cut the credit (never below spend), pause, shrink the referral basis, alert once per step", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_refund_test");
  const s = session("cs_live_pack", { kind: "sponsorship_credit", tier: "sponsor-1500", credit_cents: "157500", brand: "Brand" }, 150000);
  setStripeRefundDepsForTests({ findSession: async (pi) => (pi === "pi_cs_live_pack" ? s : null) });
  assert.equal(await draftCampaignFromCheckoutSafe(s, { isTest: false }), "created");
  const [c0] = await store.listCampaigns({ includeTest: true });
  assert.equal(c0.budgetMicros, 157_500 * 10_000, "sponsor pack books its bonus credit");
  await db.query(`INSERT INTO ads_refund_test.ad_referral_orders (session_id, campaign_id, member, site, amount_cents, currency, is_test, paid_at) VALUES ('cs_live_pack', $1, 'mona', 'birch', 150000, 'usd', false, now())`, [c0.id]);
  await db.query(`UPDATE ads_refund_test.ad_campaigns SET spent_micros = $2, status = 'active' WHERE id = $1`, [c0.id, 20_000 * 10_000]);
  assert.equal(creditRatio(s), 1.05);

  sent.length = 0;
  const partial = { id: "ch_1", object: "charge", amount: 150000, amount_refunded: 50000, refunded: false, currency: "usd", livemode: true, payment_intent: "pi_cs_live_pack" } as never;
  assert.equal(await handleChargeRefundedSafe(partial, { amount_refunded: 0 }), "applied");
  assert.equal(await handleChargeRefundedSafe(partial, { amount_refunded: 0 }), "duplicate", "same refund step twice is applied once");
  let c = (await store.getCampaign(c0.id))!;
  assert.equal(c.budgetMicros, (157_500 - 52_500) * 10_000, "a third of the money back takes a third of the credit (bonus included)");
  assert.equal(c.status, "active", "partial refund keeps serving");
  assert.equal(sent.length, 1);
  assert.match(sent[0], /\[BIRCH REFUND\] Partial refund: 500\.00 USD/);

  const full = { ...(partial as object), amount_refunded: 150000, refunded: true } as never;
  assert.equal(await handleChargeRefundedSafe(full, { amount_refunded: 50000 }), "applied");
  c = (await store.getCampaign(c0.id))!;
  assert.equal(c.budgetMicros, 20_000 * 10_000, "full refund leaves only what already served");
  assert.equal(c.status, "paused");
  const { rows } = await db.query<{ amount_cents: number }>(`SELECT amount_cents FROM ads_refund_test.ad_referral_orders WHERE session_id = 'cs_live_pack'`);
  assert.equal(Number(rows[0].amount_cents), 0, "no commission on refunded money");
  assert.equal(sent.length, 2);
  const log = await store.auditLog(20);
  assert.ok(log.some((l) => l.action === "stripe.refund_full") && log.some((l) => l.action === "stripe.refund_partial"));

  // A refund on a payment with no order still alerts (and says so).
  assert.equal(await handleChargeRefundedSafe({ id: "ch_x", amount: 100, amount_refunded: 100, refunded: true, currency: "usd", livemode: true, payment_intent: "pi_none" } as never, null), "no_order");
  assert.equal(sent.length, 3);
});

test("disputes: chargeback pauses the campaign and alerts once", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_dispute_test");
  const s = session("cs_live_hold", { sku: "hold-190" }, 19000);
  setStripeRefundDepsForTests({ findSession: async () => s, findCharge: async () => ({ id: "ch_2", payment_intent: "pi_cs_live_hold" }) as never });
  await draftCampaignFromCheckoutSafe(s, { isTest: false });
  const [c0] = await store.listCampaigns({ includeTest: true });
  await store.updateCampaign(c0.id, { status: "active" }, "test");
  sent.length = 0;
  const d = { id: "dp_1", object: "dispute", amount: 19000, currency: "usd", reason: "fraudulent", livemode: true, charge: "ch_2", evidence_details: { due_by: 1796000000 } } as never;
  assert.equal(await handleDisputeCreatedSafe(d), "applied");
  assert.equal(await handleDisputeCreatedSafe(d), "duplicate");
  assert.equal((await store.getCampaign(c0.id))!.status, "paused");
  assert.equal((await store.getCampaign(c0.id))!.budgetMicros, 19000 * 10_000, "a dispute pauses, it does not move money");
  assert.equal(sent.length, 1);
  assert.match(sent[0], /\[BIRCH DISPUTE\] Chargeback opened: 190\.00 USD/);
});

test("webhook: the same paid sponsor-pack event twice books one order and emails sales once; refund events route", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_dupe_test");
  sent.length = 0;
  const s = session("cs_live_dupe", { kind: "sponsorship_credit", tier: "sponsor-3000", credit_cents: "330000", brand: "Dupe Co" }, 300000);
  const ev = { id: "evt_1", type: "checkout.session.completed", data: { object: s } } as never;
  await processStripeEvent(ev);
  await processStripeEvent(ev);
  assert.equal((await store.listCampaigns({ includeTest: true })).length, 1);
  assert.equal(sent.filter((x) => /\[BIRCH PAID\]/.test(x)).length, 1);
  setStripeRefundDepsForTests({ findSession: async () => s });
  await processStripeEvent({ id: "evt_2", type: "charge.refunded", data: { object: { id: "ch_d", amount: 300000, amount_refunded: 300000, refunded: true, currency: "usd", livemode: true, payment_intent: "pi_x" }, previous_attributes: { amount_refunded: 0 } } } as never);
  assert.equal((await store.listCampaigns({ includeTest: true }))[0].status, "paused");
  setStripeRefundDepsForTests({});
});

test("metadata: every session says site + sold_by + currency, and the PaymentIntent carries the order keys (never the promo code)", async () => {
  const mw = promoContext();
  const req = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()], query: {} });
  const run = <T,>(h: Record<string, string>, f: () => T) => new Promise<T>((resolve) => mw(req(h) as never, {} as never, () => resolve(f())));
  const birch = await run({}, () => withPromoMetadata({ mode: "payment", line_items: [{ price_data: { currency: "cad" } }], metadata: { reservationId: "r1", sku: "hold-190" } }) as any);
  assert.deepEqual(birch.metadata, { reservationId: "r1", sku: "hold-190", site: "birch", sold_by: "birch", currency: "cad" });
  assert.deepEqual(birch.payment_intent_data.metadata, { reservationId: "r1", sku: "hold-190", site: "birch", sold_by: "birch", currency: "cad" });
  const scale = await run({ cookie: "br_st=mona; br_pc=SECRETCODE", origin: "https://scalehealth.ca" }, () => withPromoMetadata({ mode: "payment", currency: "usd", metadata: { kind: "exclusive_reserve" }, payment_intent_data: { metadata: { kind: "exclusive_reserve" }, statement_descriptor_suffix: "RESERVE" } }) as any);
  assert.equal(scale.metadata.sold_by, "scale");
  assert.equal(scale.metadata.promo, "SECRETCODE", "the session keeps the code for the webhook");
  assert.equal(scale.payment_intent_data.metadata.promo, undefined, "the PaymentIntent never carries the code");
  assert.equal(scale.payment_intent_data.metadata.st, "mona");
  assert.equal(scale.payment_intent_data.statement_descriptor_suffix, "RESERVE", "existing payment_intent_data is kept");
  assert.deepEqual(withPromoMetadata({ metadata: { a: "1" } }), { metadata: { a: "1" } }, "outside a request nothing is added");
  const sub = await run({}, () => withPromoMetadata({ mode: "subscription", metadata: {} }) as any);
  assert.equal(sub.payment_intent_data, undefined, "no payment_intent_data outside payment mode");
});

test("the Stripe discount label never spells out the promo code", () => {
  assert.doesNotMatch(STREET_COUPON_NAME, /street|code/i);
  assert.match(STREET_COUPON_NAME, /\$100 media credit/);
});
