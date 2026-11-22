/** Promo codes + street team on in-memory Postgres: normalisation, one per business, pending credit, regular-rate credit source, attribution. */
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import * as store from "../src/lib/adserver/store";
import * as promo from "../src/lib/adserver/promo";
import { PROMO_RATE_BPS, regularRateSummary } from "../src/lib/adserver/config";
import { eventCostMicros, pickAd, type Campaign } from "../src/lib/adserver/engine";
import { findSlot } from "../src/lib/adserver/config";
import { qrPng } from "../src/lib/adserver/qr";

const T0 = Date.UTC(2026, 10, 21, 15, 0, 0);
const DAY = 864e5;
function camp(p: Partial<Campaign>): Campaign {
  return {
    id: "00000000-0000-4000-8000-000000000001", accountEmail: "a@brand.com", brand: "Brand", category: null, orderRef: null, orderKind: null, currency: "usd", budgetMicros: 1000 * 1e6,
    spentMicros: 0, pricing: "cpm", primaryPlacement: "post_purchase", hubs: [], allowSubstitute: true, rateMultiplierBps: 10000, flightStart: new Date(T0 - DAY), flightEnd: new Date(T0 + 99 * DAY),
    status: "active", clickUrl: "https://b.com", freqCapPerDay: 6, clickWindowDays: 7, viewWindowDays: 1, exclusive: false, isTest: false, notes: null, createdAt: new Date(T0), ...p,
  };
}

test("code normalisation + aliases map to STREET100", async () => {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, "ads_promo_t");
  for (const v of ["STREET100", "street100", "Street100", " street 100 ", "STREETTEAM100", "street team hundred", "STREETTEAMHUNDRED", "Street Team 100"]) {
    const r = await promo.validateCode(v);
    assert.equal(r.ok, true, v);
    assert.equal(r.ok && r.code, "STREET100");
    assert.equal(r.ok && r.creditUsd, 100);
  }
  const bad = await promo.validateCode("nope");
  assert.equal(bad.ok, false);
  assert.match(bad.message, /keep going/i);
});

test("claim: pending per email, once per business domain, applies as its own regular-rate USD credit", async () => {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, "ads_promo_t2");
  promo.resetMemberCache();
  const a = await promo.claimCode({ code: "street team hundred", email: "Jane@Acme.com", st: "mona", site: "scale", src: "intake" });
  assert.equal(a.ok && a.created, true);
  assert.equal(a.ok && a.redemption.st, "mona");
  const again = await promo.claimCode({ code: "STREET100", email: "jane@acme.com" });
  assert.equal(again.ok && again.created, false);
  const other = await promo.claimCode({ code: "STREET100", email: "bob@acme.com" });
  assert.equal(other.ok, false);
  assert.equal((await promo.validateCode("STREET100", "bob@acme.com")).ok, false);
  const gmail1 = await promo.claimCode({ code: "STREET100", email: "x1@gmail.com" });
  const gmail2 = await promo.claimCode({ code: "STREET100", email: "x2@gmail.com" });
  assert.equal(gmail1.ok && gmail2.ok, true); // free-mail domains are per email only
  assert.equal(await promo.attachPendingForAccount("jane@acme.com"), 1);
  assert.equal(await promo.attachPendingForAccount("jane@acme.com"), 0); // idempotent
  const cs = await store.listCampaigns({ email: "jane@acme.com" });
  assert.equal(cs.length, 1);
  assert.equal(cs[0]!.budgetMicros, 100_000_000);
  assert.equal(cs[0]!.currency, "usd");
  assert.equal(cs[0]!.rateMultiplierBps, PROMO_RATE_BPS);
  assert.equal(cs[0]!.status, "draft");
  const led = await store.ledger({ campaignId: cs[0]!.id });
  assert.equal(led[0]!.amountMicros, 100_000_000);
  const s = (await promo.streetStats(true)).find((m) => m.id === "mona")!;
  assert.equal(s.redemptions, 1);
  assert.equal(s.applied, 1);
});

test("Mona's digital Scale intake QR is registered and audited", async () => {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, "ads_promo_t5");
  const q = (await promo.listQrs()).find((x) => x.member === "mona" && x.label === "scale-intake-digital")!;
  assert.equal(q.site, "scale");
  assert.equal(q.url, "https://scalehealth.ca/intake?code=STREET100&st=mona&qr=scale-intake-digital");
  assert.ok((await store.auditLog(20)).some((a) => a.action === "street.qr" && a.target === "mona/scale-intake-digital"));
});

test("disabled / expired / exhausted codes give a clear message", async () => {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, "ads_promo_t3");
  await promo.saveCode({ code: "ONEUSE", creditUsd: 25, maxRedemptions: 1 }, "t");
  assert.equal((await promo.claimCode({ code: "oneuse", email: "a@one.com" })).ok, true);
  const ex = await promo.validateCode("oneuse");
  assert.equal(!ex.ok && ex.reason, "exhausted");
  await promo.setCodeActive("street100", false, "t");
  const off = await promo.validateCode("STREET100");
  assert.equal(!off.ok && off.reason, "inactive");
  await promo.saveCode({ code: "OLDCODE", creditUsd: 5, expiresAt: new Date(Date.now() - 1000) }, "t");
  const old = await promo.validateCode("OLDCODE");
  assert.equal(!old.ok && old.reason, "expired");
});

test("street team: unknown member ignored; order attribution is real revenue", async () => {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, "ads_promo_t4");
  promo.resetMemberCache();
  assert.equal(await promo.resolveMember("nobody"), null);
  assert.equal(await promo.resolveMember("Bridget"), "bridget");
  await promo.createMember("Sam", "Sam", "t");
  const ev = { member: "sam", kind: "order" as const, amountCents: 49_000, currency: "usd", dedupeKey: "order:cs_1" };
  assert.equal(await promo.streetEvent(ev), true);
  assert.equal(await promo.streetEvent(ev), false); // dedupe
  const s = (await promo.streetStats()).find((m) => m.id === "sam")!;
  assert.deepEqual(s.revenue, [{ currency: "usd", cents: 49_000 }]);
  assert.equal(s.orders, 1);
});

test("promo credit charges the regular rate; same buyer's promo credit is spent before paid credit", () => {
  const slot = findSlot("sole.post_purchase")!;
  const paidEx = camp({ rateMultiplierBps: 7500 });
  const promoC = camp({ id: "00000000-0000-4000-8000-000000000002", orderKind: "promo STREET100", rateMultiplierBps: PROMO_RATE_BPS });
  assert.equal(eventCostMicros(paidEx, slot, "view"), 22_500);
  assert.equal(eventCostMicros(promoC, slot, "view"), 30_000);
  const pick = pickAd(slot, [{ campaign: paidEx, creativeIds: ["c1"] }, { campaign: promoC, creativeIds: ["c2"] }], T0, { rand: () => 0 });
  assert.equal(pick?.campaign.id, promoC.id);
  const other = camp({ id: "00000000-0000-4000-8000-000000000003", accountEmail: "z@other.com" });
  const p2 = pickAd(slot, [{ campaign: other, creativeIds: ["c3"] }, { campaign: promoC, creativeIds: ["c2"] }], T0, { rand: () => 0.99 });
  assert.ok(p2); // promo never forced ahead of another brand
  const r = regularRateSummary();
  assert.equal(r.cpmLow, 4);
  assert.equal(r.cpmHigh, 30);
  assert.match(r.compare, /25% below regular/);
});

test("QR PNG is a valid PNG", () => {
  const b = qrPng("https://scalehealth.ca/intake?code=STREET100&st=mona&qr=1");
  assert.equal(b.subarray(1, 4).toString(), "PNG");
  assert.ok(b.length > 500);
});
