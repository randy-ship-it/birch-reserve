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
import { recordClick, recordConversion, recordView, resetServeCacheForTests, serve } from "../src/lib/adserver/service";
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
  // Royalties: computed from delivered spend; approve needs a share and records only.
  let roy = (await store.royalties()).find((r) => r.partner === "SOLE")!;
  assert.equal(roy.grossMicros, 36_000);
  assert.equal(roy.payableMicros, null);
  assert.equal(await store.approvePayout("SOLE", roy.month, "usd", "randy"), null);
  await store.setPartnerShare("SOLE", 2500, "randy");
  roy = (await store.royalties()).find((r) => r.partner === "SOLE")!;
  assert.equal(roy.payableMicros, 9_000);
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
