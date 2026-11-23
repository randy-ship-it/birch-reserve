/**
 * Simar's referral credit (Randy, Nov 23 2026 12:23 PM): 10% of ad sales, via the existing street-team attribution.
 * Seeded by the store migration (member + recipient + QR links). Card orders, first-touch fallback, EFT pending → paid.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import * as store from "../src/lib/adserver/store";
import * as promo from "../src/lib/adserver/promo";
import { listReferralOrders, markEftPaid, recordEftOrder, touchKeys } from "../src/lib/adserver/referrals";
import { draftCampaignFromCheckoutSafe } from "../src/lib/adserver/service";
import { splitReferralOrders, type RecipientRow, type RateRow } from "../src/lib/adserver/payoutSplit";

const session = (id: string, md: Record<string, string>, amount: number, email: string) =>
  ({ id, livemode: true, payment_status: "paid", status: "complete", currency: "usd", amount_total: amount, created: Math.floor(Date.now() / 1000), customer_details: { email, name: "Buyer" }, customer_email: email, metadata: md, mode: "payment" }) as never;

async function fresh(schema: string) {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, schema);
  promo.resetMemberCache();
  await store.listCampaigns(); // runs migrations
}

test("seed: Simar is a member with a 10%-of-sale recipient, and both site links are registered; other members untouched", async () => {
  await fresh("ads_simar_seed");
  assert.equal(await promo.resolveMember("simar"), "simar");
  const r = (await store.recipientHistory()).find((x) => x.rkey === "ref-simar")!;
  assert.equal(r.scopeReferrer, "simar");
  assert.equal(r.pctBps, 1000);
  assert.equal(r.basis, "gross");
  assert.equal((await store.recipientHistory()).filter((x) => x.scopeReferrer && x.scopeReferrer !== "simar").length, 0, "no other ambassador gets Simar's rate");
  const qrs = (await promo.listQrs()).filter((q) => q.member === "simar");
  assert.deepEqual(qrs.map((q) => q.url).sort(), ["https://birchreserve.net/intake?st=simar&qr=birch-intake", "https://scalehealth.ca/intake?st=simar&qr=scale-intake"]);
  assert.ok(qrs.every((q) => !/code=|c=/i.test(q.url)), "no promo code in his links");
  store.setAdPoolForTests(null);
});

test("card: Birch and Scale-mirror orders both pay Simar 10% of the sale; statement line is calculated, not hub-gated", async () => {
  await fresh("ads_simar_card");
  await draftCampaignFromCheckoutSafe(session("cs_live_simar_birch", { sku: "reserve-490", brand: "Birch Buyer", st: "simar", st_qr: "birch-intake", site: "birch" }, 100_000, "ops@birchbuyer.co"));
  await draftCampaignFromCheckoutSafe(session("cs_live_simar_scale", { sku: "reserve-490", brand: "Scale Buyer", st: "simar", st_qr: "scale-intake", site: "scale", sold_by: "scale" }, 100_000, "ops@scalebuyer.co"));
  const rows = await listReferralOrders();
  assert.deepEqual(rows.map((r) => r.member), ["simar", "simar"]);
  const { detail } = splitReferralOrders(rows.map((o) => ({ sessionId: o.sessionId, campaignId: o.campaignId, member: o.member, at: o.paidAt, currency: o.currency, amountMicros: o.amountCents * 10_000, channel: o.channel })), await store.rateHistory(), await store.recipientHistory(), await store.channelRateHistory());
  for (const d of detail) assert.equal(d.commissions[0]!.micros, 100_000_000, "$1,000 sale → $100");
  const line = (await store.statements(13)).lines.find((l) => l.partner === "ref:ref-simar")!;
  assert.equal(line.status, "calculated");
  assert.equal(line.payableMicros, 200_000_000);
  store.setAdPoolForTests(null);
});

test("first touch: intake on Scale credits Simar when the same buyer later pays on Birch with no referral on the checkout; first touch is never overwritten", async () => {
  await fresh("ads_simar_touch");
  await promo.onIntakeSubmitted({ st: "simar", code: null, site: "scale", qr: "scale-intake" }, "Pat@NewBrand.co", "https://www.newbrand.co/shop");
  await promo.onIntakeSubmitted({ st: "mona", code: null, site: "birch", qr: "birch-intake" }, "pat@newbrand.co", null);
  assert.deepEqual(touchKeys("pat@gmail.com"), ["e:pat@gmail.com"], "free-mail domains are never a company key");
  await draftCampaignFromCheckoutSafe(session("cs_live_touch_1", { sku: "reserve-490", brand: "NewBrand", site: "birch" }, 49_000, "colleague@newbrand.co"));
  const rows = await listReferralOrders();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.member, "simar", "credited through the company domain");
  assert.equal(rows[0]!.via, "first_touch");
  assert.equal(rows[0]!.qr, "scale-intake");
  await draftCampaignFromCheckoutSafe(session("cs_live_touch_none", { sku: "hold-190", site: "birch" }, 19_000, "x@stranger.co"));
  assert.equal((await listReferralOrders()).length, 1, "strangers are not credited");
  store.setAdPoolForTests(null);
});

test("EFT: recorded pending (no commission line) → admin marks paid → commission line; IO ref beats first touch; unknown referrer and strangers refused", async () => {
  await fresh("ads_simar_eft");
  await promo.onIntakeSubmitted({ st: "simar", code: null, site: "scale", qr: "scale-intake" }, "buyer@eftbrand.co", null);
  const bad = await recordEftOrder({ ref: "INV-1", brand: "Stranger", email: "a@nobody.co", amountCents: 100_000, currency: "usd" }, "randy");
  assert.equal(bad.ok, false);
  const nope = await recordEftOrder({ ref: "INV-2", brand: "X", email: "a@nobody.co", amountCents: 100_000, currency: "usd", member: "ghost" }, "randy");
  assert.equal(nope.ok, false);
  const ok = await recordEftOrder({ ref: "INV-3", brand: "EFT Brand", email: "later@eftbrand.co", amountCents: 250_000, currency: "cad" }, "randy");
  assert.ok(ok.ok && ok.member === "simar" && ok.via === "first_touch");
  assert.equal((await recordEftOrder({ ref: "INV-3", brand: "EFT Brand", email: "later@eftbrand.co", amountCents: 250_000, currency: "cad" }, "randy")).ok && true, true);
  assert.equal((await listReferralOrders()).length, 0, "pending orders are not commissionable");
  assert.equal((await listReferralOrders({ includePending: true })).length, 1, "recorded once (idempotent)");
  assert.equal((await store.statements(13)).lines.filter((l) => l.source === "referral").length, 0);
  assert.equal((await markEftPaid("INV-3", "etransfer-9981", "randy")).ok, true);
  assert.equal((await markEftPaid("INV-3", "again", "randy")).message, "Already marked paid.");
  const line = (await store.statements(13)).lines.find((l) => l.partner === "ref:ref-simar")!;
  assert.equal(line.currency, "cad");
  assert.equal(line.payableMicros, 250_000_000, "10% of CAD 2,500 = CAD 250");
  const io = await recordEftOrder({ ref: "INV-4", brand: "Named", email: "z@elsewhere.co", amountCents: 50_000, currency: "usd", member: "simar" }, "randy");
  assert.ok(io.ok && io.via === "io_ref");
  store.setAdPoolForTests(null);
});
