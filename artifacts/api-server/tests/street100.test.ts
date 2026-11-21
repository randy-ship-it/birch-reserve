/** Street 100: server-validated $100 off a card order, amount checks, hub activation proof credit, public sample report (no test traffic, no zero counts). */
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import * as store from "../src/lib/adserver/store";
import * as promo from "../src/lib/adserver/promo";
import { expectedAmountTotal, setCouponEnsurerForTests, streetNetDiscount, withStreetNet } from "../src/lib/adserver/promoNet";
import * as hp from "../src/lib/adserver/hubProof";
import { publicSampleReport } from "../src/lib/adserver/publicReport";
import { HUNDRED_ROWS } from "../src/lib/overhaul/hundred";
import { RATE_SURFACES } from "../src/lib/overhaul/pricing";

const fresh = (n: string) => store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, n);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

test("STREET100 takes $100 off $190 and $490, server-validated, never below the floor", async () => {
  fresh("s100_a");
  setCouponEnsurerForTests(async (id, cents) => `${id}:${cents}`);
  const d190 = await streetNetDiscount({ email: "jane@acme.com", currency: "usd", amountCents: 19000, code: "street100" });
  assert.equal(d190?.cents, 10000);
  const d490 = await streetNetDiscount({ email: "jane@acme.com", currency: "usd", amountCents: 49000, code: "STREET 100" });
  assert.equal(d490?.cents, 10000);
  assert.equal(await streetNetDiscount({ email: "jane@acme.com", currency: "usd", amountCents: 19000, code: "nope" }), null);
  assert.equal(await streetNetDiscount({ email: "jane@acme.com", currency: "cad", amountCents: 27000, code: "street100" }), null);
  assert.equal(await streetNetDiscount({ email: "jane@acme.com", currency: "usd", amountCents: 12000, code: "street100" }), null);
  assert.equal(await streetNetDiscount({ email: "", currency: "usd", amountCents: 19000, code: "street100" }), null);
  const req = await withStreetNet({ mode: "payment", allow_promotion_codes: false, metadata: { sku: "hold-190" } }, 19000, "usd", "jane@acme.com", "street100");
  assert.deepEqual(req.discounts, [{ coupon: "street100-usd-10000:10000" }]);
  assert.equal(req.metadata?.promo_net_cents, "10000");
  assert.equal("allow_promotion_codes" in req, false);
  assert.equal(expectedAmountTotal({ metadata: { promo_net_cents: "10000" } }, 19000), 9000);
  assert.equal(expectedAmountTotal({ metadata: {} }, 19000), 19000);
  assert.equal(expectedAmountTotal({ metadata: { promo_net_cents: "99999" } }, 19000), 19000);
  // once used (claimed) by the business, the discount is gone
  await promo.claimCode({ code: "STREET100", email: "jane@acme.com" });
  assert.equal(await streetNetDiscount({ email: "bob@acme.com", currency: "usd", amountCents: 19000, code: "street100" }), null);
  setCouponEnsurerForTests();
});

test("STREET100 confirmation line; internal hub-proof code is not public", async () => {
  fresh("s100_b");
  const v = await promo.validateCode("STREET100");
  assert.ok(v.ok && v.message.startsWith("Code applied — $100 media credit. Use it to test the shelf after the receipt."));
  assert.equal((await promo.validateCode("HUBPROOF100")).ok, false);
  const c = await promo.claimCode({ code: "HUBPROOF100", email: "x@y.com", src: "intake" });
  assert.equal(c.ok, false);
});

test("hub proof: one per hub, review, approve issues the $100 credit once, reject issues nothing", async () => {
  fresh("s100_c");
  const base = { hubName: "Calm Hub", hubUrl: "https://calmhub.com", contactName: "Sam", email: "sam@calmhub.com", channel: "email", reach: 2500, note: "", file: png, site: "birch" as const };
  assert.equal((await hp.submitProof({ ...base, reach: 400 })).ok, false);
  assert.equal((await hp.submitProof({ ...base, file: Buffer.from("not an image") })).ok, false);
  const a = await hp.submitProof(base);
  assert.ok(a.ok);
  const dup = await hp.submitProof({ ...base, email: "other@calmhub.com" });
  assert.equal(dup.ok, false);
  const ok = await hp.reviewProof((a as { id: string }).id, "approve", "randy@silverbirchgrowth.com", "");
  assert.equal(ok.ok, true);
  const reds = await promo.redemptionForEmail("sam@calmhub.com");
  assert.equal(reds.length, 1);
  assert.equal(reds[0]!.status, "applied");
  assert.equal(reds[0]!.creditMicros, 100_000_000);
  assert.equal((await hp.reviewProof((a as { id: string }).id, "approve", "x", "")).ok, false);
  const b = await hp.submitProof({ ...base, hubName: "Other Hub", hubUrl: "https://otherhub.com", email: "z@otherhub.com" });
  assert.ok(b.ok);
  assert.equal((await hp.reviewProof((b as { id: string }).id, "reject", "randy@silverbirchgrowth.com", "blurry")).ok, true);
  assert.equal((await promo.redemptionForEmail("z@otherhub.com")).length, 0);
  assert.match(hp.hubProofAdminHtml(await hp.listProofs()), /Calm Hub/);
});

test("What $100 gets you is derived from the rate card", () => {
  for (const r of HUNDRED_ROWS) {
    const s = RATE_SURFACES.find((x) => x.short === r.label)!;
    assert.equal(r.cpm, s.cpmStarter[0]);
    assert.ok(Math.abs(r.views - (100 / s.cpmStarter[0]) * 1000) < 100);
  }
});

test("public sample report: real events only, no test traffic, no zero counts", async () => {
  fresh("s100_d");
  assert.equal((await publicSampleReport()).available, false);
});

test("new link token: opaque, maps to the street credit, never echoed; validate result has no canonical code", async () => {
  fresh("s100_tok");
  const tok = promo.memberToken("mona");
  assert.match(tok, /^sc[0-9a-f]{12}$/);
  assert.ok(!/street/i.test(tok));
  const f = await promo.findCode(tok);
  assert.equal(f?.codeKey, "street100");
  assert.equal(await promo.findCode("sc000000000000"), null);
  const url = promo.shareUrl("mona", "birch", null, "birch-intake");
  assert.ok(!/street100/i.test(url) && url.includes(`c=${tok}`) && url.includes("st=mona"));
  const v = await promo.validateCode(tok);
  assert.ok(v.ok && !/street100/i.test(v.message));
  const a = await promo.validateCode("streetteam100");
  assert.ok(a.ok && !/street100/i.test(a.message));
});
