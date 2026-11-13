import test from "node:test";
import assert from "node:assert/strict";
import { extractSignals, emptySignals, scoreMatch, normalizeUrl, isPrivateAddress } from "../src/lib/overhaul/audienceMatch";
import { lookupArea, quoteAreaLock, areaLockGuaranteedViews, blendedHubCpmUsd, AREA_LOCK, BRAND_HUBS, SLOT_LADDER } from "../src/lib/overhaul/model";
import { buildAreaLockSession, checkoutGate } from "../src/lib/overhaul/checkout";
import { buildIntakePayload, sendIntake } from "../src/lib/overhaul/fridayIntake";
import { buildDepositSession } from "../src/routes/sponsorPage";

const page = (title: string, desc: string, body: string) => `<html><head><title>${title}</title><meta name="description" content="${desc}"></head><body><h1>${title}</h1><p>${body}</p></body></html>`;

test("health / wellness / fitness / food / local service pages land 70-95", () => {
  const cases = [
    page("Peak Physio & Recovery", "Physiotherapy, massage therapy and sports injury rehab in Toronto", "Book online. Back pain, knee pain, posture and mobility programs. Registered massage therapy."),
    page("Iron Studio Pilates", "Reformer pilates and yoga classes", "Class schedule, membership, strength workouts, stretching and recovery. Book now. Ontario."),
    page("Greens Daily", "Plant-based protein and greens supplements", "Shop now. Add to cart. Collagen, electrolyte hydration, gut health, vitamins. Free shipping in Canada."),
    page("Harvest Meal Kits", "Healthy meal kits delivered", "Recipes, meal prep, dietitian-approved nutrition, protein bowls. Order in Vancouver and Calgary."),
    page("Calm Mind Naturopathic Clinic", "Naturopath and acupuncture clinic", "Book an appointment. Sleep, hormones, menopause and healthy aging care."),
  ];
  for (const html of cases) {
    const r = scoreMatch(extractSignals("https://example.ca", html), "");
    assert.ok(r.score >= 70 && r.score <= 95, `${r.score} for ${html.slice(13, 60)}`);
    assert.equal(r.reasons.length, 3);
    assert.ok(r.recommended.href.startsWith("/"));
  }
});

test("unrelated pages score lower but never brutally", () => {
  const r = scoreMatch(extractSignals("https://acme-software.com", page("Acme Cloud ERP", "Enterprise resource planning software", "Invoices, ledgers, API, SOC 2, pricing for teams.")), "");
  assert.ok(r.score >= 38 && r.score < 65, String(r.score));
  const blocked = scoreMatch(emptySignals("https://unknown-site.com", "blocked"), "");
  assert.ok(blocked.score >= 38 && blocked.score <= 72);
});

test("local businesses are pointed at Lock down my area", () => {
  const r = scoreMatch(extractSignals("https://studio.ca", page("Flow Yoga Studio", "Yoga classes in Ottawa", "Class schedule. Book now. Our location and hours. Directions. Stretching, mobility and recovery.")), "");
  assert.equal(r.businessType, "local");
  assert.equal(r.recommended.product, "area_lock");
});

test("url normalisation and SSRF guard", () => {
  assert.equal(normalizeUrl("rollrecovery.com"), "https://rollrecovery.com/");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("localhost"), null);
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.20.0.1", "169.254.169.254", "::1"]) assert.ok(isPrivateAddress(ip), ip);
  assert.ok(!isPrivateAddress("76.76.21.21"));
});

test("area lookup: 50% standard, 25% dense downtown cores, rural FSAs", () => {
  assert.equal((lookupArea("L4C 3G5") as { sharePct: number }).sharePct, 50);
  for (const p of ["M5V 2T6", "M5H", "H3B 1A1", "H2Y", "V6B 1A1", "V6E", "T2P 1J9", "10001", "60601", "94105"]) {
    const a = lookupArea(p);
    assert.ok(a.ok && a.density === "dense_core" && a.sharePct === 25, p);
  }
  const rural = lookupArea("K0A 1A0");
  assert.ok(rural.ok && rural.density === "rural" && rural.sharePct === 50);
  assert.equal(lookupArea("hello").ok, false);
});

test("area lock math: $4,900 CAD / $3,500 USD, 25% off, 360,000 modelled views (starter rates), four placements", () => {
  assert.equal(AREA_LOCK.priceCad, 4900);
  assert.equal(AREA_LOCK.priceUsd, 3500);
  assert.ok(Math.abs(blendedHubCpmUsd() - 12.78) < 0.01);
  assert.equal(AREA_LOCK.launchRateUntil, "Dec 31, 2026");
  assert.equal(AREA_LOCK.followOnCapUsd, 100000);
  const g = areaLockGuaranteedViews();
  assert.equal(g.views, 360000);
  const q = quoteAreaLock("L4C 3G5", 9);
  assert.ok(q.ok);
  if (q.ok) {
    assert.equal(q.termMonths, 6); // clamped 1-6
    assert.equal(q.currency, "cad");
    assert.equal(q.price, 4900);
    assert.equal(q.creditAtRateCard, 6533);
  }
  const us = quoteAreaLock("98052", 0);
  assert.ok(us.ok && us.currency === "usd" && us.price === 3500 && us.termMonths === 1);
});

test("area lock Stripe session: price_data in the visitor currency, metadata, no live objects", () => {
  const built = buildAreaLockSession({ postal: "M5V 2T6", term: 3, category: "Physiotherapy", business: "Peak Physio", email: "owner@peak.ca", agree: true }, "https://birchreserve.net");
  assert.ok(built.ok);
  if (!built.ok) return;
  const li = (built.params.line_items as Array<{ price_data: { currency: string; unit_amount: number } }>)[0]!;
  assert.equal(li.price_data.currency, "cad");
  assert.equal(li.price_data.unit_amount, 490000);
  const md = built.params.metadata as Record<string, string>;
  assert.equal(md.kind, "area_lock");
  assert.equal(md.share_pct, "25");
  assert.equal(md.guaranteed_views_modelled, "360000");
  assert.equal(buildAreaLockSession({ postal: "M5V", category: "x", business: "b", email: "a@b.co" }, "https://x").ok, false); // no agree
});

test("checkout gate: live key needs the live flag", () => {
  assert.equal(checkoutGate({ AREA_LOCK_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_x" } as NodeJS.ProcessEnv, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE").open, false);
  assert.equal(checkoutGate({ AREA_LOCK_ENABLED: "true", AREA_LOCK_LIVE: "true", STRIPE_SECRET_KEY: "sk_live_x" } as NodeJS.ProcessEnv, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE").open, true);
  assert.equal(checkoutGate({ AREA_LOCK_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_x" } as NodeJS.ProcessEnv, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE").open, true);
  assert.equal(checkoutGate({ STRIPE_SECRET_KEY: "sk_test_x" } as NodeJS.ProcessEnv, "AREA_LOCK_ENABLED", "AREA_LOCK_LIVE").open, false);
});

test("deposit ladder sessions (non-exclusive slots buy down the rate)", () => {
  assert.deepEqual(SLOT_LADDER.map((s) => s.usd), [490, 1500, 3000, 6000]);
  const t = buildDepositSession({ tier: "sponsor-3000", currency: "cad", brand: "Acme", email: "a@acme.com", agree: true }, "https://birchreserve.net");
  assert.ok(t.ok && t.amountCents === 420000);
  const starter = buildDepositSession({ amount: 490, currency: "usd", brand: "Acme", email: "a@acme.com", agree: true }, "https://birchreserve.net");
  assert.ok(starter.ok && starter.amountCents === 49000);
});

test("Friday payload: org birchreserve, tags, and skipped without env", async () => {
  const p = buildIntakePayload({ kind: "match_tool", website: "https://rollrecovery.com", meta: { match_score: 92 } });
  assert.equal(p.org, "birchreserve");
  assert.equal(p.company, "rollrecovery.com");
  assert.deepEqual((p.tags as string[]).slice(-1), ["birch:match-tool"]);
  const r = await sendIntake({ kind: "hub_access", email: "a@b.co" }, {} as NodeJS.ProcessEnv);
  assert.equal(r.status, "skipped");
});

test("copy rules: the eight queued brand hubs, no do-not-pitch brands", () => {
  assert.deepEqual(BRAND_HUBS.map((h) => h.key).sort(), ["bird-and-be", "dr-ho", "effortless-admin", "jack-health", "jill-health", "nutriprocan", "roll-recovery", "sole"]);
  const all = JSON.stringify(BRAND_HUBS);
  assert.doesNotMatch(all, /kalaya|align|clairvoyant|80 locations|pier39|ankita/i);
});

// ---------------------------------------------------------------- item 9: AI buying agents
import express from "express";
import { agentCatalog, agentQuote, agentOpenApi, agentCard, slotOffers } from "../src/lib/overhaul/agent";
import { createAgentRouter } from "../src/routes/agent";
import { llmsTxt, slotProductsJsonLd } from "../src/lib/overhaul/seo";

test("agent catalog lists every slot + area lock with prices and modelled views", () => {
  const c = agentCatalog({ slotsCheckout: false, areaLockCheckout: false });
  assert.deepEqual(c.offers.map((o) => o.offer_key), ["slot-490", ...SLOT_LADDER.slice(1).map((s) => s.key), "area-lock"]);
  assert.equal(c.inventory.modelled, true);
  assert.equal(c.inventory.surfaces.length, 4);
  assert.ok(c.inventory.surfaces.some((x) => /dashboard/i.test(x.label)));
  assert.equal(c.agency.commission_pct_of_media_spend, 10);
  assert.ok(c.inventory.live_hubs.every((h) => h.status === "live inventory"));
  assert.equal(c.checkout_status.spend_commits, "held");
  const s3000 = slotOffers().find((o) => o.prices.usd === 3000)!;
  assert.equal(s3000.media_credit.usd, 3300);
  assert.equal(s3000.modelled_hub_page_views, 258100);
  assert.equal(slotProductsJsonLd().length, SLOT_LADDER.length);
});

test("agent quote: slots, area lock, unknown offer", () => {
  const q = agentQuote({ offer: SLOT_LADDER[3]!.key, currency: "cad" });
  assert.equal(q.ok, true);
  if (q.ok) assert.equal(q.amount, 8400);
  const a = agentQuote({ offer: "area-lock", postal: "M5V 2T6", term: 3 });
  assert.equal(a.ok && a.amount, 4900);
  assert.equal(agentQuote({ offer: "nope" }).ok, false);
  assert.ok(agentOpenApi().paths["/v1/agent/checkout"]);
  assert.equal(agentCard().skills.length, 4);
  assert.match(llmsTxt(), /\/v1\/agent\/catalog\.json/);
});

test("agent checkout holds (202, no charge) when the env gate is closed", async () => {
  delete process.env.SPONSOR_DEPOSITS_ENABLED;
  let called = 0;
  const app = express().use(createAgentRouter({ createSession: async () => { called++; return { url: "x", livemode: false }; } }));
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/v1/agent/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offer: SLOT_LADDER[2]!.key, brand: "Acme", email: "a@acme.com", agree: true }) });
    assert.equal(r.status, 202);
    const j = (await r.json()) as { status: string; amount: number };
    assert.equal(j.status, "held");
    assert.equal(j.amount, 3000);
    assert.equal(called, 0);
    const bad = await fetch(`http://127.0.0.1:${port}/v1/agent/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offer: "slot-490", brand: "Acme", email: "a@acme.com" }) });
    assert.equal(bad.status, 400);
    process.env.SPONSOR_DEPOSITS_ENABLED = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    const open = await fetch(`http://127.0.0.1:${port}/v1/agent/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offer: "slot-490", currency: "cad", brand: "Acme", email: "a@acme.com", agree: true }) });
    const oj = (await open.json()) as { status: string; amount: number };
    assert.equal(oj.status, "open");
    assert.equal(oj.amount, 690);
    assert.equal(called, 1);
  } finally {
    delete process.env.SPONSOR_DEPOSITS_ENABLED;
    delete process.env.STRIPE_SECRET_KEY;
    server.close();
  }
});

// ── Media kit (/media-kit), Randy Nov 12 2026 7:12 PM ET ─────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { MEDIA_KIT_EXAMPLES, MEDIA_KIT_NETWORK_FALLBACK, agencyCredit, kitExample, millions, mm, parseCockpit, usd } from "../src/lib/overhaul/mediaKit";
import { createOverhaulRouter } from "../src/routes/overhaul";
import { OVERHAUL_ROUTES } from "../src/lib/overhaul/seo";

test("media kit math: spend + bonus = credit, credit / CPM x 1000 = modelled impressions", () => {
  const [rail, lo, hi] = MEDIA_KIT_EXAMPLES;
  assert.deepEqual(rail, { spend: 10000, bonusPct: 10, credit: 11000, imprLo: 916667, imprHi: 1375000 });
  assert.deepEqual(lo, { spend: 35000, bonusPct: 15, credit: 40250, imprLo: 3354167, imprHi: 5031250 });
  assert.deepEqual(hi, { spend: 75000, bonusPct: 15, credit: 86250, imprLo: 7187500, imprHi: 10781250 });
  for (const e of MEDIA_KIT_EXAMPLES) {
    assert.ok(Math.abs(e.credit - e.spend * (1 + e.bonusPct / 100)) < 0.01);
    assert.ok(Math.abs(e.imprLo - (e.credit / 12) * 1000) <= 0.5);
    assert.ok(Math.abs(e.imprHi - (e.credit / 8) * 1000) <= 0.5);
  }
  assert.equal(millions(rail.imprLo), "0.92M");
  assert.equal(millions(rail.imprHi), "1.375M");
  assert.equal(millions(lo.imprLo), "3.35M");
  assert.equal(millions(hi.imprHi), "10.8M");
  assert.equal(usd(lo.credit), "$40,250");
  assert.equal(usd(hi.credit), "$86,250");
  assert.deepEqual(agencyCredit(35000), { lo: 3500, hi: 4200 });
  assert.equal(kitExample(1000, 0).imprHi, 125000);
});

test("media kit network: live cockpit values, static fallback on bad data", () => {
  const live = parseCockpit({ orders_yr: 20000000, monthly_views: 127890000, listed_partners: 42, as_of: "2026-11-12" });
  assert.equal(live.live, true);
  assert.equal(mm(live.ordersYr), "20MM");
  assert.equal(mm(live.monthlyViews), "128MM");
  assert.equal(live.listedPartners, 42);
  assert.equal(parseCockpit({ orders_yr: 20000000, monthly_views: 127890000, signed: { value: 0, listed: 42 } }).listedPartners, 42);
  for (const bad of [null, {}, { orders_yr: "x" }, { orders_yr: 0, monthly_views: 1, listed_partners: 1 }]) {
    const f = parseCockpit(bad);
    assert.equal(f.live, false);
    assert.equal(f.ordersYr, MEDIA_KIT_NETWORK_FALLBACK.ordersYr);
    assert.equal(mm(f.monthlyViews), "128MM");
    assert.equal(f.listedPartners, 42);
  }
});

test("media kit: /mediakit 301s to /media-kit (query kept), head meta set", async () => {
  const app = express();
  app.use(createOverhaulRouter());
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/mediakit?utm_source=email`, { redirect: "manual" });
    assert.equal(r.status, 301);
    assert.equal(r.headers.get("location"), "/media-kit?utm_source=email");
    const r2 = await fetch(`http://127.0.0.1:${port}/mediakit/`, { redirect: "manual" });
    assert.equal(r2.headers.get("location"), "/media-kit");
  } finally {
    server.close();
  }
  const meta = OVERHAUL_ROUTES["/media-kit"]!;
  assert.match(meta.title, /Media kit/);
  assert.match(meta.description, /prepaid media credit/i);
  assert.match(meta.description, /no guarantees/i);
});

test("media kit page copy: required language in, banned words out", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../clinichub-media/src/pages/br/media-kit.tsx"),
    resolve(process.cwd(), "../clinichub-media/src/pages/br/media-kit.tsx"),
    resolve(process.cwd(), "artifacts/clinichub-media/src/pages/br/media-kit.tsx"),
  ];
  const path = candidates.find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  assert.ok(path, "media-kit.tsx not found");
  const src = readFileSync(path!, "utf8");
  for (const must of [/Prepaid credit/, /Modelled volumes/, /Refundable until IO activation/, /Aggregate UTM reporting only/, /No personal data/, /One exclusive seat per category/, /No guarantees of reach, clicks or sales/, /Estimates are modelled; terms on IO/, /Randy Gilling, Founder/, /sales@silverbirchgrowth\.com/, /\(647\) 931-6278/, /one brand each/, /first come/]) {
    assert.match(src, must);
  }
  for (const banned of [/Align/, /Clairvoyant/i, /80 locations/i, /Kalaya/i, /we sell them customers/i, /signed partner/i, /\bCTR\b/, /guarantee(d)? (reach|delivery|results)/i]) {
    assert.doesNotMatch(src, banned);
  }
});
