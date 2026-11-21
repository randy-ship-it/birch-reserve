/**
 * Ad system: pure pacing / eligibility, and the full serve → view → click → conversion → ledger → royalty flow on an
 * in-memory Postgres (PGlite). No network, no Stripe, no production data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { AD_SLOTS, findSlot } from "../src/lib/adserver/config";
import { allowedSpendMicros, canSpend, eligibility, eventCostMicros, landingUrl, pacingState, pickAd, type Campaign } from "../src/lib/adserver/engine";
import * as store from "../src/lib/adserver/store";
import { draftCampaignFromCheckoutSafe, recordClick, recordConversion, recordView, resetServeCacheForTests, serve } from "../src/lib/adserver/service";
import { buyStore } from "../src/lib/buyFlow";
import { pixelId, verify, visitorHash } from "../src/lib/adserver/auth";
import { EMBED_JS, PIXEL_JS } from "../src/lib/adserver/embed";
import { campaignPayload } from "../src/lib/adserver/friday";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const DAY = 864e5;
const T0 = Date.UTC(2026, 10, 21, 15, 0, 0);

function camp(p: Partial<Campaign> = {}): Campaign {
  return {
    id: "00000000-0000-4000-8000-000000000001", accountEmail: "a@brand.com", brand: "Brand", category: null, orderRef: null, orderKind: null, currency: "usd",
    budgetMicros: 1000 * 1e6, spentMicros: 0, pricing: "cpm", primaryPlacement: "post_purchase", hubs: [], allowSubstitute: true, rateMultiplierBps: 10000,
    flightStart: new Date(T0 - DAY), flightEnd: new Date(T0 + 99 * DAY), status: "active", clickUrl: "https://brand.com/x", freqCapPerDay: 6, clickWindowDays: 7,
    viewWindowDays: 1, exclusive: false, isTest: false, notes: null, createdAt: new Date(T0), ...p,
  };
}

test("rate card: CPM bills viewable impressions at the slot's own rate; exclusive is 25% off; CAD uses the 1.4 ladder", () => {
  const pp = findSlot("sole.post_purchase")!;
  const land = findSlot("sole.landing")!;
  assert.equal(eventCostMicros(camp(), pp, "view"), 18_000); // $18 CPM → $0.018
  assert.equal(eventCostMicros(camp(), land, "view"), 4_000); // substitute slot billed at its own $4 CPM
  assert.equal(eventCostMicros(camp(), pp, "click"), 0);
  assert.equal(eventCostMicros(camp({ rateMultiplierBps: 7500 }), pp, "view"), 13_500);
  assert.equal(eventCostMicros(camp({ currency: "cad" }), pp, "view"), 25_200);
  assert.equal(eventCostMicros(camp({ pricing: "cpc" }), pp, "click"), 1_200_000);
});

test("eligibility: primary, equal-or-lower substitutes only, hub filter, not-live hubs never fill", () => {
  const c = camp({ primaryPlacement: "products" }); // $12 CPM
  assert.equal(eligibility(c, findSlot("sole.products")!), "primary");
  assert.equal(eligibility(c, findSlot("sole.dashboard")!), "substitute"); // $10
  assert.equal(eligibility(c, findSlot("sole.services")!), null); // $15 > $12
  assert.equal(eligibility(camp({ allowSubstitute: false }), findSlot("sole.landing")!), null);
  assert.equal(eligibility(camp({ hubs: ["dr-ho"] }), findSlot("sole.post_purchase")!), null);
  const queued = AD_SLOTS.find((s) => !s.live)!;
  assert.equal(eligibility(camp({ primaryPlacement: queued.placement }), queued), null);
});

test("pacing: even plan, at most one day ahead, never past budget", () => {
  const c = camp({ flightStart: new Date(T0), flightEnd: new Date(T0 + 100 * DAY) });
  assert.equal(allowedSpendMicros(c, T0), 10 * 1e6); // day 0: one day's budget
  assert.equal(allowedSpendMicros(c, T0 + 49 * DAY), 500 * 1e6);
  assert.equal(allowedSpendMicros(c, T0 + 200 * DAY), 1000 * 1e6);
  assert.equal(canSpend({ ...c, spentMicros: 10 * 1e6 }, 1, T0), false);
  assert.equal(canSpend({ ...c, spentMicros: 999.99 * 1e6 }, 20_000, T0 + 200 * DAY), false);
  assert.equal(pacingState({ ...c, spentMicros: 100 * 1e6 }, T0 + 50 * DAY), "behind");
  assert.equal(pacingState({ ...c, spentMicros: 500 * 1e6 }, T0 + 50 * DAY), "on_pace");
});

test("pick: primary first, then the campaign furthest behind; exclusive holds its category; test isolation; freq cap", () => {
  const slot = findSlot("sole.landing")!;
  const a = camp({ id: "a", primaryPlacement: "landing", spentMicros: 5 * 1e6 });
  const b = camp({ id: "b", primaryPlacement: "post_purchase", spentMicros: 0 }); // substitute, far behind
  assert.equal(pickAd(slot, [{ campaign: a, creativeIds: ["x"] }, { campaign: b, creativeIds: ["y"] }], T0, { rand: () => 0 })!.campaign.id, "a");
  assert.equal(pickAd(slot, [{ campaign: b, creativeIds: ["y"] }], T0, { rand: () => 0 })!.eligibility, "substitute");
  const ex = camp({ id: "ex", exclusive: true, category: "Sleep", primaryPlacement: "post_purchase" });
  const other = camp({ id: "o", category: "Sleep", primaryPlacement: "landing" });
  assert.equal(pickAd(slot, [{ campaign: ex, creativeIds: ["1"] }, { campaign: other, creativeIds: ["2"] }], T0, { rand: () => 0 })!.campaign.id, "ex");
  assert.equal(pickAd(slot, [{ campaign: camp({ isTest: true }), creativeIds: ["1"] }], T0), null);
  assert.equal(pickAd(slot, [{ campaign: camp(), creativeIds: ["1"] }], T0, { test: true }), null);
  assert.equal(pickAd(slot, [{ campaign: camp(), creativeIds: ["1"], viewsToday: 6 }], T0), null);
  assert.equal(pickAd(slot, [{ campaign: camp({ status: "draft" }), creativeIds: ["1"] }], T0), null);
});

test("landing URL keeps brand UTMs, adds ours and the click id", () => {
  const u = new URL(landingUrl("https://brand.com/p?utm_source=keep", { campaignId: "abcdef12-x", slot: findSlot("sole.landing")!, clickId: "CLICK123456", brand: "B" }));
  assert.equal(u.searchParams.get("utm_source"), "keep");
  assert.equal(u.searchParams.get("utm_medium"), "display");
  assert.equal(u.searchParams.get("utm_content"), "sole.landing");
  assert.equal(u.searchParams.get("br_click"), "CLICK123456");
  assert.equal(landingUrl("javascript:alert(1)", { campaignId: "x", slot: findSlot("sole.landing")!, clickId: "c", brand: "b" }), "https://birchreserve.net/");
});

test("visitor hash rotates daily and rejects junk; scripts honour DNT/GPC", () => {
  const a = visitorHash("abcdefabcdefabcdef", T0)!;
  assert.equal(a, visitorHash("abcdefabcdefabcdef", T0 + 1000));
  assert.notEqual(a, visitorHash("abcdefabcdefabcdef", T0 + DAY));
  assert.equal(visitorHash("x"), null);
  for (const js of [EMBED_JS, PIXEL_JS]) assert.match(js, /doNotTrack[\s\S]*globalPrivacyControl/);
  assert.doesNotMatch(EMBED_JS, /document\.cookie/);
  assert.doesNotMatch(PIXEL_JS, /document\.cookie/);
});

test("full flow on Postgres: serve → viewable → click → conversion, ledger, no overspend, royalties, purge", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_test");
  resetServeCacheForTests();
  const now = Date.now();
  const { campaign, created } = await store.createCampaign({ accountEmail: "Buyer@Brand.com", brand: "Brand Co", orderRef: "cs_test_1", orderKind: "sponsor pack", budgetMicros: 50_000, currency: "usd", primaryPlacement: "post_purchase", actor: "test" });
  assert.equal(created, true);
  assert.equal((await store.createCampaign({ accountEmail: "x@y.z", brand: "dup", orderRef: "cs_test_1", budgetMicros: 1 })).created, false); // idempotent per order
  // Draft: nothing serves.
  assert.equal((await serve({ slot: "sole.post_purchase", ua: UA, origin: "https://birchreserve.net", now })).fill, false);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000001f4000001f40806000000", "hex");
  const cr = await store.addCreative({ campaignId: campaign.id, mime: "image/png", width: 500, height: 500, data: png, alt: "Sale", uploadedBy: "test" });
  await store.setCreativeStatus(cr.id, "approved", "test");
  await store.updateCampaign(campaign.id, { status: "active", flightStart: new Date(now - 19 * DAY), flightEnd: new Date(now + DAY), clickUrl: "https://brand.com/offer" }, "test");
  resetServeCacheForTests();
  // Bots never fill.
  assert.equal((await serve({ slot: "sole.post_purchase", ua: "Googlebot/2.1 (+http://www.google.com/bot.html)", origin: "https://birchreserve.net", now })).fill, false);
  const s = await serve({ slot: "sole.post_purchase", vid: "abcdefabcdefabcdef12", ua: UA, origin: "https://birchreserve.net", now });
  assert.equal(s.fill, true);
  if (!s.fill) return;
  const token = new URL(s.view).searchParams.get("t")!;
  assert.equal((await recordView(token, UA, now + 100)).reason, "too_fast");
  const v1 = await recordView(token, UA, now + 1500);
  assert.deepEqual(v1, { counted: true, billed: true });
  assert.equal((await recordView(token, UA, now + 2000)).reason, "duplicate");
  // Click: too fast is dropped but still redirects; a real one counts once and carries UTMs + click id.
  const ct = new URL(s.click).searchParams.get("t")!;
  const fast = await recordClick(ct, UA, now + 50);
  assert.equal(fast.counted, false);
  const click = await recordClick(ct, UA, now + 3000);
  assert.equal(click.counted, true);
  const loc = new URL(click.location);
  assert.equal(loc.host, "brand.com");
  const clickId = loc.searchParams.get("br_click")!;
  assert.ok(clickId);
  assert.equal((await recordClick(ct, UA, now + 4000)).reason, "duplicate");
  // Conversion: wrong pixel is ignored; right pixel attributes once per order.
  assert.equal((await recordConversion({ source: "pixel", pixel: "px_wrong", clickId, orderId: "o1", now: now + 5000 })).attributed, false);
  assert.deepEqual(await recordConversion({ source: "pixel", pixel: pixelId("buyer@brand.com"), clickId, value: 49.99, currency: "USD", orderId: "o1", now: now + 5000 }), { attributed: true, via: "click" });
  assert.equal((await recordConversion({ source: "postback", accountEmail: "buyer@brand.com", clickId, orderId: "o1", now: now + 6000 })).duplicate, true);
  // View-through on a same-site hub cart.
  assert.equal((await recordConversion({ source: "pixel", pixel: pixelId("buyer@brand.com"), viewIds: [s.id], orderId: "o2", now: now + 7000 })).via, "view");
  const t = (await store.totalsByCampaign([campaign.id])).get(campaign.id)!;
  assert.deepEqual([t.serves, t.views, t.clicks, t.convs], [1, 1, 1, 2]);
  assert.equal(t.spendMicros, 18_000);
  assert.equal(t.convValueMicros, 49_990_000);
  // No overspend: budget 50,000 micros = 2 more views at $18 CPM, then it stops and completes.
  let billed = 0;
  for (let i = 0; i < 6; i += 1) {
    resetServeCacheForTests();
    const r = await serve({ slot: "sole.post_purchase", vid: `visitor${i}abcdefgh12`, ua: UA, origin: "https://birchreserve.net", now });
    if (!r.fill) break;
    if ((await recordView(new URL(r.view).searchParams.get("t"), UA, now + 1500)).billed) billed += 1;
  }
  assert.equal(billed, 1);
  const after = (await store.getCampaign(campaign.id))!;
  assert.ok(after.spentMicros <= after.budgetMicros);
  assert.equal(after.spentMicros, 36_000);
  // Ledger: one credit, hourly charge lines that net to spend.
  const led = await store.ledger({ campaignId: campaign.id });
  assert.equal(led.filter((l) => l.kind === "credit").length, 1);
  assert.equal(-led.filter((l) => l.kind === "charge").reduce((a, l) => a + l.amountMicros, 0), after.spentMicros);
  // Royalties: seeded default (20% override, hub 35% of net); held until the hub's payout gate passes; approve records only.
  let roy = (await store.royalties()).find((r) => r.partner === "SOLE")!;
  assert.equal(roy.grossMicros, 36_000);
  assert.equal(roy.payableMicros, 10_080);
  assert.equal(roy.status, "held");
  assert.equal(await store.approvePayout("SOLE", roy.month, "usd", "randy"), null);
  await store.setGate("SOLE", { live: true, hasTransactions: false, audienceActivated: false, override: true, note: "test release" }, "randy");
  roy = (await store.royalties()).find((r) => r.partner === "SOLE")!;
  assert.equal((await store.approvePayout("SOLE", roy.month, "usd", "randy"))!.status, "approved");
  // Friday payload is aggregate only.
  const payload = campaignPayload(after, t, { workspace: "w", stage: "s" });
  assert.doesNotMatch(JSON.stringify(payload), /vid|abcdefabcdef/);
  // Test campaigns: only on test requests, and purgeable; real ones are not.
  const tc = (await store.createCampaign({ accountEmail: "qa+ads@silverbirchgrowth.com", brand: "QA Test", budgetMicros: 1e6, isTest: true, primaryPlacement: "landing" })).campaign;
  const tcr = await store.addCreative({ campaignId: tc.id, mime: "image/png", width: 500, height: 500, data: png, alt: "", uploadedBy: "t", status: "approved" });
  assert.ok(tcr);
  await store.updateCampaign(tc.id, { status: "active", flightStart: new Date(now - DAY), flightEnd: new Date(now + DAY), clickUrl: "https://example.com" }, "t");
  // The real campaign still has $0.014 left: too little for an $18 CPM view, enough for a $4 CPM substitute slot.
  resetServeCacheForTests();
  const sub = await serve({ slot: "sole.landing", ua: UA, origin: "https://birchreserve.net", now });
  assert.equal(sub.fill && sub.brand, "Brand Co");
  await store.updateCampaign(campaign.id, { status: "paused" }, "t");
  resetServeCacheForTests();
  assert.equal((await serve({ slot: "sole.landing", ua: UA, origin: "https://birchreserve.net", now })).fill, false);
  const ts = await serve({ slot: "sole.landing", ua: UA, origin: "https://birchreserve.net", now, test: true });
  assert.equal(ts.fill && ts.test, true);
  assert.equal(await store.purgeTestCampaign(campaign.id, "t"), false);
  assert.equal(await store.purgeTestCampaign(tc.id, "t"), true);
  assert.equal(await store.getCampaign(tc.id), null);
  // Serve tokens are signed.
  assert.equal(verify("s", token.replace(/.$/, token.endsWith("A") ? "B" : "A")), null);
  store.setAdPoolForTests(null);
});

test("ad creatives accept banner shapes; the /buy upload rule is unchanged", async () => {
  const { checkCreative } = await import("../src/lib/buyFlow");
  const { AD_CREATIVE_MIN } = await import("../src/routes/adserver");
  const png = (w: number, h: number) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  for (const [w, h] of [[728, 90], [320, 50], [656, 280], [300, 250]]) assert.equal(checkCreative(png(w, h), AD_CREATIVE_MIN).ok, true, `${w}x${h}`);
  assert.equal(checkCreative(png(200, 200), AD_CREATIVE_MIN).ok, false);
  assert.equal(checkCreative(png(728, 90)).ok, false);
  assert.equal(checkCreative(png(656, 300)).ok, true);
});

test("hub on contract: becomes sellable at card rates, QA hub carries test campaigns only, reject reason, test royalty line, manual payout", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_hub_test");
  resetServeCacheForTests();
  const now = Date.now();
  assert.equal(findSlot("calm-qa.post_purchase"), null);
  await store.upsertContractHub({ key: "calm-qa", name: "QA Hub", category: "Recovery hardware", url: "https://example.com/qa", partner: "QA Partner", contractRef: "QA contract", status: "live", isTest: true }, "test");
  const slot = findSlot("calm-qa.post_purchase")!;
  assert.ok(slot && slot.live && slot.test);
  assert.equal(slot.cpmUsd, findSlot("sole.post_purchase")!.cpmUsd);
  // Real campaigns never fill a QA hub; test campaigns do on test requests.
  assert.equal(eligibility(camp(), slot), null);
  assert.equal(eligibility(camp({ isTest: true }), slot), "primary");
  const { campaign } = await store.createCampaign({ accountEmail: "qa@birchreserve.test", brand: "QA Brand", orderRef: "cs_test_qa", orderKind: "sponsor pack", budgetMicros: 100_000_000, currency: "usd", primaryPlacement: "post_purchase", hubs: ["calm-qa"], isTest: true, actor: "test" });
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000001f4000001f40806000000", "hex");
  const bad = await store.addCreative({ campaignId: campaign.id, mime: "image/png", width: 500, height: 500, data: png, alt: "x", uploadedBy: "test" });
  await store.setCreativeStatus(bad.id, "rejected", "test", "Logo too small");
  assert.equal((await store.listCreatives({ campaignId: campaign.id }))[0]!.reviewNote, "Logo too small");
  const ok = await store.addCreative({ campaignId: campaign.id, mime: "image/png", width: 500, height: 500, data: png, alt: "y", uploadedBy: "test" });
  await store.setCreativeStatus(ok.id, "approved", "test");
  await store.updateCampaign(campaign.id, { status: "active", flightStart: new Date(now - DAY), flightEnd: new Date(now + 30 * DAY), clickUrl: "https://example.com/offer" }, "test");
  resetServeCacheForTests();
  assert.equal((await serve({ slot: slot.key, ua: UA, origin: "https://birchreserve.net", now })).fill, false); // not a test request
  const s = await serve({ slot: slot.key, ua: UA, origin: "https://birchreserve.net", test: true, now });
  assert.equal(s.fill, true);
  if (!s.fill) return;
  const v = await recordView(new URL(s.view).searchParams.get("t"), UA, now + 1500);
  assert.equal(v.billed, true);
  assert.equal((await store.getCampaign(campaign.id))!.spentMicros, 18_000);
  const tr = await store.royalties(1, { testOnly: true });
  assert.equal(tr[0]!.partner, "QA Partner");
  assert.equal(tr[0]!.shareBps, 3500); // default hub share of net
  assert.equal(tr[0]!.status, "held"); // gate not passed
  assert.equal((await store.royalties(1)).length, 0); // never in real statements
  // QA rows show the real status after approve / batch / mark paid, and the real Pay batch never takes them.
  await store.setGate("QA Partner", { live: false, hasTransactions: false, audienceActivated: false, override: true, note: "QA release" }, "test");
  assert.equal((await store.royalties(1, { testOnly: true }))[0]!.status, "calculated");
  assert.ok(await store.approvePayout("QA Partner", tr[0]!.month, "usd", "test"));
  let qa = (await store.royalties(1, { testOnly: true }))[0]!;
  assert.equal(qa.status, "approved");
  assert.equal(qa.batchId, null);
  assert.equal((await store.createPayoutBatch("test")).rows.length, 0); // real batch skips test-hub lines
  const qb = await store.createPayoutBatch("test", ["QA Partner"]);
  assert.equal(qb.rows.length, 1);
  qa = (await store.royalties(1, { testOnly: true }))[0]!;
  assert.equal(qa.status, "approved");
  assert.equal(qa.batchId, qb.batchId);
  assert.ok(await store.markPayoutPaid("QA Partner", tr[0]!.month, "usd", "qa-ref", "test"));
  qa = (await store.royalties(1, { testOnly: true }))[0]!;
  assert.equal(qa.status, "paid");
  assert.equal(qa.paidRef, "qa-ref");
  await store.purgeTestPayouts("QA Partner");
  // Paused hub stops serving.
  await store.setHubStatus("calm-qa", "paused", "test");
  assert.equal(findSlot(slot.key)!.live, false);
  assert.equal(await store.purgeTestCampaign(campaign.id, "test"), true);
  assert.equal(await store.purgeTestHub("calm-qa", "test"), true);
  assert.equal(findSlot(slot.key), null);
  store.setAdPoolForTests(null);
});

test("payout split: 20% override off the top, hub 35% of net, recipients share the pool, tiers progressive, dated rates", async () => {
  const { splitCharges, workedExample, maxPoolAllocationBps, dueDate } = await import("../src/lib/adserver/payoutSplit");
  const ex = workedExample(2000, 3500, []);
  assert.deepEqual([ex.override, ex.net, ex.hub, ex.retained], [200, 800, 280, 520]);
  const t0 = new Date(Date.UTC(2026, 10, 1));
  const rates = [{ partner: null, overrideBps: 2000, hubBps: 3500, effectiveAt: t0 }];
  const recips = [{ rkey: "b", name: "Broker", kind: "brokerage" as const, pctBps: 5000, scopePartner: null, scopeCampaign: null, active: true, payoutRef: null, effectiveAt: t0 }];
  const line = (at: number, gross: number) => ({ partner: "SOLE", campaignId: "c1", at: new Date(at), currency: "usd", grossMicros: gross });
  const r = splitCharges([line(t0.getTime() + 1000, 1_000_000_000)], rates, recips);
  const hub = r.payees.find((p) => p.kind === "hub")!;
  const br = r.payees.find((p) => p.kind === "brokerage")!;
  assert.equal(hub.payable, 280_000_000);
  assert.equal(br.payable, 100_000_000); // 50% of the $200 pool
  assert.equal(Math.round(r.months[0]!.gross - r.months[0]!.override - r.months[0]!.hub), 520_000_000);
  // Not retroactive: a later rate change leaves earlier delivery alone.
  const later = [...rates, { partner: "SOLE", overrideBps: null, hubBps: 5000, effectiveAt: new Date(t0.getTime() + 864e5) }];
  assert.equal(splitCharges([line(t0.getTime() + 1000, 1_000_000_000)], later, []).payees[0]!.payable, 280_000_000);
  assert.equal(splitCharges([line(t0.getTime() + 2 * 864e5, 1_000_000_000)], later, []).payees[0]!.payable, 400_000_000);
  // Tiers: first $500 at 35%, rest at 50% (of net).
  const tiered = [...rates, { partner: "SOLE", overrideBps: null, hubBps: null, tiers: [{ fromMicros: 500_000_000, hubBps: 5000 }], effectiveAt: t0 }];
  assert.equal(splitCharges([line(t0.getTime() + 1000, 1_000_000_000)], tiered, []).payees[0]!.payable, 140_000_000 + 200_000_000);
  // No rate in effect = pending.
  assert.equal(splitCharges([line(t0.getTime() - 1000, 1_000_000)], rates, []).payees[0]!.pending, true);
  assert.equal(maxPoolAllocationBps([...recips, { ...recips[0]!, rkey: "c", pctBps: 6000, scopePartner: "SOLE" }], ["SOLE", "DR-HO’S"], []), 11_000);
  assert.equal(dueDate("2026-11", "monthly", 30).toISOString().slice(0, 10), "2026-12-31");
  assert.equal(dueDate("2026-11", "quarterly", 0).toISOString().slice(0, 10), "2027-01-01");
});

test("statements: promo delivery earns nothing, gate holds until live+transactions+audience or override, approve freezes", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_split_test");
  resetServeCacheForTests();
  const now = Date.now();
  await store.addRate({ partner: null, overrideBps: 2000, hubBps: 3500, tiers: null, effectiveAt: new Date(now - 864e5) }, "test");
  const { campaign } = await store.createCampaign({ accountEmail: "b@brand.com", brand: "Paid", orderRef: "cs_x", orderKind: "sponsor pack", budgetMicros: 100_000_000, currency: "usd", primaryPlacement: "post_purchase", actor: "test" });
  const promo = (await store.createCampaign({ accountEmail: "p@brand.com", brand: "Promo", orderRef: "promo:1", orderKind: "promo STREET100", budgetMicros: 100_000_000, currency: "usd", primaryPlacement: "post_purchase", actor: "test" })).campaign;
  for (const c of [campaign, promo]) {
    const id = await store.insertEvent({ kind: "view", campaignId: c.id, slotKey: "sole.post_purchase", dedupeKey: `v:${c.id}`, isTest: false, at: new Date(now) });
    assert.ok(await store.chargeEvent(id!, c, "sole.post_purchase", 18_000, new Date(now)));
  }
  let rows = await store.royalties(1);
  assert.equal(rows.length, 1); // promo delivery excluded
  assert.equal(rows[0]!.status, "held");
  assert.equal(await store.approvePayout(rows[0]!.partner, rows[0]!.month, "usd", "test"), null);
  await store.setGate("SOLE", { live: true, hasTransactions: true, audienceActivated: true, override: false, note: null }, "test");
  rows = await store.royalties(1);
  assert.equal(rows[0]!.status, "calculated");
  assert.equal(rows[0]!.payableMicros, Math.floor(18_000 * 0.8 * 0.35));
  assert.ok(await store.approvePayout(rows[0]!.partner, rows[0]!.month, "usd", "test"));
  const b = await store.createPayoutBatch("test");
  assert.equal(b.rows.length, 1);
  assert.ok(await store.markPayoutPaid(rows[0]!.partner, rows[0]!.month, "usd", "ref-1", "test"));
  assert.equal((await store.royalties(1))[0]!.status, "paid");
  store.setAdPoolForTests(null);
});

test("channel override: Birch brokerage 20%, Scale direct 5%, internal 5% (internal wins); dated, never retroactive; label per line", async () => {
  const { splitCharges, channelOf, overrideLabel } = await import("../src/lib/adserver/payoutSplit");
  assert.equal(channelOf("birch", false), "brokerage");
  assert.equal(channelOf(undefined, undefined), "brokerage");
  assert.equal(channelOf("scale", false), "scale_direct");
  assert.equal(channelOf("scale", true), "internal");
  assert.equal(channelOf("birch", true), "internal");
  const t0 = new Date(Date.UTC(2026, 10, 1));
  const rates = [{ partner: null, overrideBps: 2000, hubBps: 3500, effectiveAt: t0 }];
  const ch = [{ channel: "scale_direct" as const, overrideBps: 500, effectiveAt: t0 }, { channel: "internal" as const, overrideBps: 500, effectiveAt: t0 }];
  const recips = [{ rkey: "b", name: "Broker", kind: "brokerage" as const, pctBps: 5000, scopePartner: null, scopeCampaign: null, active: true, payoutRef: null, effectiveAt: t0 }];
  const at = t0.getTime() + 1000;
  const line = (channel: "brokerage" | "scale_direct" | "internal", when = at) => ({ partner: "SOLE", campaignId: channel, at: new Date(when), currency: "usd", grossMicros: 1_000_000_000, channel });
  const one = (c: "brokerage" | "scale_direct" | "internal", chRates = ch, when = at) => {
    const r = splitCharges([line(c, when)], rates, recips, chRates);
    const m = r.months[0]!;
    return { override: m.override, hub: r.payees.find((p) => p.kind === "hub")!.payable, broker: r.payees.find((p) => p.kind === "brokerage")!.payable, retained: Math.round(m.gross - m.override - m.hub), label: overrideLabel(r.payees.find((p) => p.kind === "hub")!.overrides) };
  };
  // $1,000 brokerage: $200 override, $800 net, $280 hub, $520 retained.
  assert.deepEqual(one("brokerage"), { override: 200_000_000, hub: 280_000_000, broker: 100_000_000, retained: 520_000_000, label: "20% Birch brokerage" });
  // $1,000 Scale direct / internal: $50 fee, $950 net, $332.50 hub, $617.50 retained.
  for (const c of ["scale_direct", "internal"] as const) {
    const r = one(c);
    assert.deepEqual([r.override, r.hub, r.broker, r.retained], [50_000_000, 332_500_000, 25_000_000, 617_500_000]);
  }
  assert.equal(one("scale_direct").label, "5% Scale direct");
  assert.equal(one("internal").label, "5% Internal (cost accounting)");
  // No channel rate in effect yet: falls back to the 5% default.
  assert.equal(one("scale_direct", []).override, 50_000_000);
  // Dated: Scale direct goes to 8% from day 2; day-1 delivery keeps 5%.
  const later = [...ch, { channel: "scale_direct" as const, overrideBps: 800, effectiveAt: new Date(t0.getTime() + 864e5) }];
  assert.equal(one("scale_direct", later).override, 50_000_000);
  assert.equal(one("scale_direct", later, t0.getTime() + 2 * 864e5).override, 80_000_000);
  // Changing the channel rate never touches brokerage.
  assert.equal(one("brokerage", later, t0.getTime() + 2 * 864e5).override, 200_000_000);
  // Mixed month on one hub: label shows both rates.
  const mixed = splitCharges([line("brokerage"), line("scale_direct")], rates, [], ch);
  const hub = mixed.payees.find((p) => p.kind === "hub")!;
  assert.equal(hub.payable, 280_000_000 + 332_500_000);
  assert.equal(overrideLabel(hub.overrides), "20% Birch brokerage · 5% Scale direct");
  assert.deepEqual(Object.keys(mixed.months[0]!.byChannel).sort(), ["brokerage", "scale_direct"]);
});

test("channel override on Postgres: seeded 5%, channel stamped at charge time (seller edit not retroactive), override note on the royalty line", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_channel_test");
  resetServeCacheForTests();
  const now = Date.now();
  await store.addRate({ partner: null, overrideBps: 2000, hubBps: 3500, tiers: null, effectiveAt: new Date(now - 864e5) }, "test");
  const seeded = await store.channelRateHistory();
  assert.deepEqual(seeded.map((r) => `${r.channel}:${r.overrideBps}`).sort(), ["internal:500", "scale_direct:500"]);
  await store.setGate("SOLE", { live: true, hasTransactions: true, audienceActivated: true, override: false, note: null }, "test");
  const mk = async (brand: string, seller: "birch" | "scale", internal: boolean) =>
    (await store.createCampaign({ accountEmail: `${brand}@brand.com`, brand, orderRef: `cs_${brand}`, orderKind: "sponsor pack", budgetMicros: 100_000_000, currency: "usd", primaryPlacement: "post_purchase", seller, internal, actor: "test" })).campaign;
  const scale = await mk("ScaleCo", "scale", false);
  assert.equal((await store.getCampaign(scale.id))!.internal, false);
  const id = await store.insertEvent({ kind: "view", campaignId: scale.id, slotKey: "sole.post_purchase", dedupeKey: `v:${scale.id}`, isTest: false, at: new Date(now) });
  assert.ok(await store.chargeEvent(id!, scale, "sole.post_purchase", 100_000, new Date(now)));
  let rows = await store.royalties(1);
  assert.equal(rows[0]!.payableMicros, Math.floor(100_000 * 0.95 * 0.35));
  assert.equal(rows[0]!.overrideNote, "5% Scale direct");
  // Flip the campaign to Birch brokerage afterwards: the earlier charge keeps its channel.
  await store.updateCampaign(scale.id, { seller: "birch", internal: false }, "test");
  rows = await store.royalties(1);
  assert.equal(rows[0]!.payableMicros, Math.floor(100_000 * 0.95 * 0.35));
  assert.equal((await store.getCampaign(scale.id))!.seller, "birch");
  // A future-dated internal change does not touch today's lines.
  await store.addChannelRate({ channel: "scale_direct", overrideBps: 1000, effectiveAt: new Date(now + 864e5) }, "test");
  rows = await store.royalties(1);
  assert.equal(rows[0]!.overrideNote, "5% Scale direct");
  const internal = await mk("InHouse", "birch", true);
  assert.equal((await store.getCampaign(internal.id))!.internal, true);
  store.setAdPoolForTests(null);
});

test("QA guard + alt text: creativeTestFlag tells real from TEST creatives; alt is editable", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_guard_test");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const mk = async (isTest: boolean) => {
    const { campaign } = await store.createCampaign({ accountEmail: "g@brand.com", brand: isTest ? "QA Co" : "Calm Joints Inc.", orderRef: `cs_${isTest}`, orderKind: "sponsor pack", budgetMicros: 1_000_000, currency: "usd", primaryPlacement: "post_purchase", isTest, actor: "test" });
    await store.addCreative({ campaignId: campaign.id, mime: "image/png", width: 1, height: 1, data: png, alt: "Randall Gilling (sponsored)", uploadedBy: "t", status: "pending" });
    return (await store.listCreatives({ campaignId: campaign.id }))[0]!;
  };
  const real = await mk(false);
  const qa = await mk(true);
  assert.deepEqual(await store.creativeTestFlag(real.id), { isTest: false });
  assert.deepEqual(await store.creativeTestFlag(qa.id), { isTest: true });
  assert.equal(await store.creativeTestFlag("00000000-0000-0000-0000-000000000000"), null);
  assert.ok(await store.setCreativeAlt(real.id, "Calm Joints ad", "test"));
  const after = (await store.listCreatives({ campaignId: real.campaignId }))[0]!;
  assert.equal(after.alt, "Calm Joints ad");
  assert.equal(after.status, "pending");
  store.setAdPoolForTests(null);
});

test("stripe replay helpers: claimOnce is one-shot; hold-190 confirmation has no URLs and quotes the terms", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_once_test");
  assert.equal(await store.claimOnce("stripe.replay:evt_1", "t"), true);
  assert.equal(await store.claimOnce("stripe.replay:evt_1", "t"), false);
  store.setAdPoolForTests(null);
  const { buildHoldConfirmationEmail } = await import("../src/lib/prepayConfirmationEmail");
  const m = buildHoldConfirmationEmail({ brandName: "Calm Joints Inc.", amountCents: 19000, currency: "usd", format: "Member dashboard (post-login)" });
  assert.match(m.subject, /Calm Joints Inc\./);
  assert.match(m.text, /\$190 USD payment for the 7-day look/);
  assert.match(m.text, /100% credit if you convert within 7 days\. Otherwise it is a cash refund\. It does not lock a category\./);
  assert.match(m.text, /not an impression guarantee/);
  assert.doesNotMatch(m.text + m.html.replace(/<[^>]+>/g, ""), /https?:\/\/|www\./);
});

test("new-hub alert: never says open/unclaimed, one per hub per email, unsubscribe turns alerts off", async () => {
  const { hubAlertEmail } = await import("../src/lib/adserver/mail");
  const m = hubAlertEmail({ hubName: "SOLE", category: "Recovery hardware", hubUrl: "https://scalehealth.ca/sole", unsubscribeUrl: "https://birchreserve.net/account/alerts/off?t=x" });
  for (const t of [m.subject, m.text, m.html]) assert.ok(!/\bopen(ed|ing)?\b|unclaimed/i.test(t.replace(/Open my dashboard/g, "")), t);
  assert.ok(m.html.includes("/account/alerts/off?t=x"));
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_alert_test");
  await store.setAlertPrefs("A@b.co", ["Recovery hardware"], true);
  assert.equal(await store.claimHubAlert("sole", "a@b.co"), true);
  assert.equal(await store.claimHubAlert("sole", "A@b.co"), false);
  await store.alertsOff("a@b.co");
  assert.deepEqual(await store.alertSubscribers(), []);
});

test("paid /buy checkout: draft campaign takes the order's company + format, and the uploaded ad waits in the approval queue (never approved)", async () => {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, "ads_buy_link_test");
  const bs = buyStore();
  const t0 = Date.now();
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  await bs.putCreative({ id: "cr-old", accountId: "a", email: "buyer@brand.co", mime: "image/png", width: 1200, height: 628, bytes: 8, sha256: "x", data: png, createdAt: new Date(t0 - 3_600_000) });
  await bs.putCreative({ id: "cr-new", accountId: "a", email: "buyer@brand.co", mime: "image/png", width: 1200, height: 628, bytes: 8, sha256: "y", data: png, createdAt: new Date(t0 - 60_000) });
  const base = { accountId: "a", name: "Card Name", email: "buyer@brand.co", website: "https://brand.co", domainCheck: "match" as const, plan: "hold-190", reviewStatus: "pending_review" as const, ip: "1" };
  await bs.putOrder({ ...base, id: "ord-old", company: "Old Co", format: "scheduled_service", creativeId: "cr-old", createdAt: new Date(t0 - 3_600_000) });
  await bs.putOrder({ ...base, id: "ord-new", company: "Brand Co Inc.", format: "member_hub", creativeId: "cr-new", createdAt: new Date(t0 - 60_000) });
  const session = { id: "cs_live_buylink", livemode: true, payment_status: "paid", status: "complete", currency: "usd", amount_total: 19_000, created: Math.floor(t0 / 1000),
    customer_details: { email: "buyer@brand.co", name: "Card Name" }, metadata: { reservationId: "res-1", sku: "hold-190", offerKey: "hold-190" } } as never;
  assert.equal(await draftCampaignFromCheckoutSafe(session), "created");
  const c = (await store.listCampaigns()).find((x) => x.orderRef === "cs_live_buylink")!;
  assert.equal(c.brand, "Brand Co Inc.");
  assert.equal(c.primaryPlacement, "dashboard");
  assert.equal(c.clickUrl, "https://brand.co"); // landing URL = the website the buyer gave
  assert.equal(c.status, "draft");
  const crs = await store.listCreatives({ campaignId: c.id });
  assert.equal(crs.length, 1);
  assert.equal(crs[0]!.status, "pending");
  assert.equal(crs[0]!.sourceRef, "buy:ord-new");
  assert.equal(await draftCampaignFromCheckoutSafe(session), "exists"); // webhook retry: no second campaign or creative
  assert.equal((await store.listCreatives({ campaignId: c.id })).length, 1);
  store.setAdPoolForTests(null);
});
