import test from "node:test";
import assert from "node:assert/strict";
import { extractSignals, emptySignals, scoreMatch, normalizeUrl, isPrivateAddress } from "../src/lib/overhaul/audienceMatch";
import { lookupArea, quoteAreaLock, areaLockGuaranteedViews, blendedHubCpmUsd, AREA_LOCK, BRAND_HUBS, SLOT_LADDER } from "../src/lib/overhaul/model";
import { buildAreaLockSession, checkoutGate } from "../src/lib/overhaul/checkout";
import { buildIntakePayload, sendIntake } from "../src/lib/overhaul/fridayIntake";
import { buildDepositSession, sponsorDepositsOpen, sponsorHtml } from "../src/routes/sponsorPage";

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

test("area lock math: $4,900 CAD / $3,500 USD, 25% off, 260,000 modelled views (starter rates), four placements", () => {
  assert.equal(AREA_LOCK.priceCad, 4900);
  assert.equal(AREA_LOCK.priceUsd, 3500);
  assert.ok(Math.abs(blendedHubCpmUsd() - 17.83) < 0.01);
  assert.equal(AREA_LOCK.launchRateUntil, "Dec 31, 2026");
  assert.equal(AREA_LOCK.followOnCapUsd, 100000);
  const g = areaLockGuaranteedViews();
  assert.equal(g.views, 260000);
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
  assert.equal(md.guaranteed_views_modelled, "260000");
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
  // Geo pricing (Randy, Nov 21 2026 3:34 PM): a CAD page charges the CAD table; anything else charges USD.
  const t = buildDepositSession({ tier: "sponsor-3000", currency: "cad", brand: "Acme", email: "a@acme.com", agree: true }, "https://birchreserve.net");
  assert.ok(t.ok && t.amountCents === 420000 && t.currency === "cad");
  const tu = buildDepositSession({ tier: "sponsor-3000", currency: "usd", brand: "Acme", email: "a@acme.com", agree: true }, "https://birchreserve.net");
  assert.ok(tu.ok && tu.amountCents === 300000 && tu.currency === "usd");
  const starter = buildDepositSession({ amount: 490, currency: "usd", brand: "Acme", email: "a@acme.com", agree: true }, "https://birchreserve.net");
  assert.ok(starter.ok && starter.amountCents === 49000);
});

test("sponsorship pack checkout: plain line item, SCALE ADS descriptor, USD, terms version (audit #6)", () => {
  for (const [tier, usd, bonus] of [["sponsor-1500", 1500, 5], ["sponsor-3000", 3000, 10], ["sponsor-6000", 6000, 15]] as const) {
    const r = buildDepositSession({ tier, brand: "Acme", email: "a@acme.com", agree: true }, "https://birchreserve.net");
    assert.ok(r.ok);
    const p = r.params as { line_items: Array<{ price_data: { currency: string; unit_amount: number; product_data: { name: string; description: string } } }>; payment_intent_data: { statement_descriptor_suffix: string }; metadata: Record<string, string> };
    const li = p.line_items[0]!.price_data;
    assert.equal(li.currency, "usd");
    assert.equal(li.unit_amount, usd * 100);
    assert.match(li.product_data.name, new RegExp(`sponsorship pack · \\$${usd.toLocaleString("en-US")} USD`));
    assert.match(li.product_data.description, new RegExp(`plus ${bonus}% bonus media credit`));
    assert.doesNotMatch(JSON.stringify(li), /seat|pool|sweep|draw|entry|guarantee/i);
    assert.equal(p.payment_intent_data.statement_descriptor_suffix, "SCALE ADS");
    assert.equal(p.metadata.terms_version, "sponsor-2026-11-20");
  }
});

test("Friday payload: org birchreserve, tags, and skipped without env", async () => {
  const p = buildIntakePayload({ kind: "match_tool", website: "https://rollrecovery.com", meta: { match_score: 92 } });
  assert.equal(p.org, "birchreserve");
  assert.equal(p.company, "rollrecovery.com");
  assert.deepEqual((p.tags as string[]).slice(-1), ["birch:match-tool"]);
  const r = await sendIntake({ kind: "hub_access", email: "a@b.co" }, {} as NodeJS.ProcessEnv);
  assert.equal(r.status, "skipped");
});

test("copy rules: every ladder brand hub (4 Live, 6 Activating), no do-not-pitch brands", () => {
  assert.deepEqual(BRAND_HUBS.map((h) => h.key).sort(), ["bird-and-be", "calm-joints", "dr-ho", "effortless-admin", "integrity-fitness", "jack-health", "jill-health", "nutriprocan", "roll-recovery", "sole"]);
  const all = JSON.stringify(BRAND_HUBS);
  assert.doesNotMatch(all, /kalaya|align|clairvoyant|80 locations|pier39|ankita/i);
});

// ---------------------------------------------------------------- item 9: AI buying agents
import express from "express";
import { agentCatalog, agentQuote, agentOpenApi, agentCard, slotOffers } from "../src/lib/overhaul/agent";
import { createAgentRouter } from "../src/routes/agent";
import { llmsTxt, slotProductsJsonLd } from "../src/lib/overhaul/seo";

test("agent catalog: the two media-kit offers in USD, only live hubs, agent checkout held", () => {
  const c = agentCatalog();
  assert.deepEqual(c.offers.map((o) => [o.offer_key, o.price_usd]), [["hold-190", 190], ["reserve-490", 490]]);
  assert.deepEqual(c.currencies, ["USD"]);
  assert.equal(c.inventory.surfaces.length, 4);
  assert.deepEqual(c.inventory.live_hubs.map((h) => h.name), ["DR-HO'S physio", "SOLE", "Integrity Fitness", "Calm Joints"]);
  assert.equal(c.agency.commission_pct_of_media_spend, 10);
  assert.equal(c.checkout_status.agent_checkout, "held");
  assert.doesNotMatch(JSON.stringify(c), /CAD|sponsor-|area-lock|live inventory/);
  assert.equal(slotProductsJsonLd().length, SLOT_LADDER.length);
  void slotOffers;
});

test("agent quote: public offers only, USD", () => {
  const q = agentQuote({ offer: "reserve-490" });
  assert.equal(q.ok && q.amount, 490);
  assert.equal(q.ok && q.currency, "usd");
  assert.equal(agentQuote({ offer: "sponsor-3000" }).ok, false);
  assert.equal(agentQuote({ offer: "nope" }).ok, false);
  assert.ok(agentOpenApi().paths["/v1/agent/checkout"]);
  assert.equal(agentCard().skills.length, 3);
  const llms = llmsTxt();
  assert.match(llms, /\/v1\/agent\/catalog\.json/);
  assert.match(llms, /\$190 USD/);
  assert.match(llms, /\$490 USD/);
  // CAD appears only on the $1,900 CAD exclusive display reserve lines (Randy, voice, Nov 21 2026).
  assert.doesNotMatch(llms.replace(/^.*exclusive.*$/gim, ""), /CAD|sponsor-|All eight/);
  assert.match(llms, /exclusive-reserve-1900-cad · \$1,900 CAD/);
  assert.match(llms, /Based on signed partnership contracts, not a commitment/);
});

test("agent checkout always holds (202, no charge) and points to the human checkout", async () => {
  process.env.SPONSOR_DEPOSITS_ENABLED = "true";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  let called = 0;
  const app = express().use(createAgentRouter({ createSession: async () => { called++; return { url: "x", livemode: false }; } }));
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/v1/agent/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offer: "reserve-490", brand: "Acme", email: "a@acme.com", agree: true }) });
    assert.equal(r.status, 202);
    const j = (await r.json()) as { status: string; amount: number; human_checkout: string };
    assert.equal(j.status, "held");
    assert.equal(j.amount, 490);
    assert.match(j.human_checkout, /\/buycalc\?sku=reserve-490$/);
    assert.equal(called, 0);
    const bad = await fetch(`http://127.0.0.1:${port}/v1/agent/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offer: "sponsor-3000", brand: "Acme", email: "a@acme.com", agree: true }) });
    assert.equal(bad.status, 400);
    const noAgree = await fetch(`http://127.0.0.1:${port}/v1/agent/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ offer: "hold-190", email: "a@acme.com" }) });
    assert.equal(noAgree.status, 400);
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
import { MEDIA_KIT_EXAMPLES, MEDIA_KIT_NETWORK_FALLBACK, agencyCash, kitExample, millions, mm, parseCockpit, usd } from "../src/lib/overhaul/mediaKit";
import { createOverhaulRouter } from "../src/routes/overhaul";
import { OVERHAUL_ROUTES } from "../src/lib/overhaul/seo";

test("media kit math: $490 seat and $25K–$50K premium, no assumed bonus; credit / CPM x 1000 = modelled impressions", () => {
  const [seat, lo, hi] = MEDIA_KIT_EXAMPLES;
  assert.deepEqual(seat, kitExample(490, 0));
  assert.deepEqual(lo, kitExample(25_000, 0));
  assert.deepEqual(hi, kitExample(50_000, 0));
  assert.equal(seat.spend, 490);
  assert.equal(lo.spend, 25_000);
  assert.equal(hi.spend, 50_000);
  for (const e of MEDIA_KIT_EXAMPLES) {
    assert.equal(e.bonusPct, 0);
    assert.ok(Math.abs(e.credit - e.spend * (1 + e.bonusPct / 100)) < 0.01);
    assert.ok(Math.abs(e.imprLo - (e.credit / 12) * 1000) <= 0.5);
    assert.ok(Math.abs(e.imprHi - (e.credit / 8) * 1000) <= 0.5);
  }
  assert.equal(usd(seat.credit), "$490");
  assert.equal(usd(lo.credit), "$25,000");
  assert.equal(usd(hi.credit), "$50,000");
  assert.equal(agencyCash(490), 49);
  assert.equal(agencyCash(25_000), 2500);
  assert.equal(agencyCash(50_000), 5000);
  assert.equal(kitExample(1000, 0).imprHi, 125000);
  assert.equal(kitExample(10_000, 10).credit, 11000);
});

test("media kit network: live cockpit values, static fallback on bad data", () => {
  const live = parseCockpit({ orders_yr: 20000000, monthly_views: 127890000, listed_partners: 42, as_of: "2026-11-12" });
  assert.equal(live.live, true);
  assert.equal(mm(live.ordersYr), "20MM");
  assert.equal(mm(live.monthlyViews), "128MM");
  assert.equal(live.listedPartners, 42);
  assert.equal(parseCockpit({ orders_yr: 20000000, monthly_views: 127890000, signed: { value: 0, listed: 42 } }).listedPartners, 42);
  // listed_partners absent (Friday public JSON no longer guarantees it): still live, listed falls back to the static count.
  const noListed = parseCockpit({ orders_yr: 20000000, monthly_views: 127890000 });
  assert.equal(noListed.live, true);
  assert.equal(noListed.listedPartners, MEDIA_KIT_NETWORK_FALLBACK.listedPartners);
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

test("path aliases: /sellads -> /sell-ads; /buy-ads and /buyads -> /advertise/brands", async () => {
  const app = express();
  app.use(createOverhaulRouter());
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const cases: Array<[string, string]> = [
      ["/sellads?utm_source=sms", "/sell-ads?utm_source=sms"],
      ["/sellads/", "/sell-ads"],
      ["/buy-ads?utm_source=sms", "/advertise/brands?utm_source=sms"],
      ["/buy-ads/", "/advertise/brands"],
      ["/buyads?utm_source=sms", "/advertise/brands?utm_source=sms"],
      ["/buyads/", "/advertise/brands"],
    ];
    for (const [path, location] of cases) {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" });
      assert.equal(r.status, 301, path);
      assert.equal(r.headers.get("location"), location, path);
    }
  } finally {
    server.close();
  }
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
  for (const must of [/Media credit until IO/, /Modelled volumes/, /fully refundable until 14 days before your launch date/, /Aggregate UTM reporting only/, /No personal data/, /share of display space across the hub network/, /No impression guarantees/, /guarantees of reach, clicks or sales/, /Estimates are modelled; terms on IO/, /Randy Gilling, Founder/, /randy@scalehealth\.ca/, /curated as hubs launch/, /FaceBeforeFlight/, /CategoryRequestForm/, /AvailabilityStrip/, /Small business package/, /Premium slots/, /from \$25K/i, /\$25K–\$50K/, /Inquire only/, /UPGRADE_PATH_LINE/, /Exclusivity/, /larger display share/, /priority placement/]) {
    assert.match(src, must);
  }
  for (const banned of [/Align/, /Clairvoyant/i, /80 locations/i, /Kalaya/i, /we sell them customers/i, /\bsigned partner\b/i, /\bCTR\b/, /guarantee(d)? (reach|delivery|results)/i, /Test Rail/, /Category Lock/, /\$10K Test Rail/, /\$35K[–-]\$75K/, /8 self-serve seats/, /Eight categories/, /seats open/]) {
    assert.doesNotMatch(src, banned);
  }
});

test("media kit share image: /media-kit head uses its own OG image, other routes keep the default", async () => {
  const { withRouteSeo } = await import("../src/lib/publicSeo");
  const shell = `<html><head><title>x</title><meta property="og:image" content="old" /><meta name="twitter:image" content="old" /></head><body></body></html>`;
  const kit = withRouteSeo(shell, "/media-kit");
  assert.match(kit, /<meta property="og:image" content="https:\/\/birchreserve\.net\/og-media-kit-usd\.png" \/>/);
  assert.match(kit, /<meta name="twitter:image" content="https:\/\/birchreserve\.net\/og-media-kit-usd\.png" \/>/);
  const rates = withRouteSeo(shell, "/rates");
  assert.doesNotMatch(rates, /og-media-kit/);
});

test("media kit dual sales motion: programs callout under the tiers, one FAQ, shared seats (Nov 17 2026)", async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) => {
    for (const base of [resolve(here, "../../clinichub-media/src"), resolve(process.cwd(), "../clinichub-media/src"), resolve(process.cwd(), "artifacts/clinichub-media/src")]) {
      try { return readFileSync(resolve(base, rel), "utf8"); } catch { /* next */ }
    }
    throw new Error(`missing ${rel}`);
  };
  const kit = read("pages/br/media-kit.tsx");
  const comp = read("components/br/buyer-comfort.tsx");
  assert.ok(kit.indexOf("<ProgramsCallout />") > kit.indexOf('data-testid="mk-rate-cards"'));
  assert.ok(kit.indexOf("<ProgramsCallout />") < kit.indexOf("The math <Tag>Modelled</Tag>"));
  assert.equal((kit.match(/<BuyerFaq \/>/g) ?? []).length, 1);
  assert.doesNotMatch(comp, /Request a call back/);
  assert.match(comp, /href=\{SAMPLE_IO_HREF\}[^>]*data-testid="programs-sample-io"/);
  const { DUAL_MOTION, BUYER_FAQ, BUYER_FAQ_TITLE, REPLY_LINE } = await import("../src/lib/buyerComfort");
  assert.equal(BUYER_FAQ_TITLE, "Questions buyers ask.");
  assert.equal(BUYER_FAQ.length, 8);
  assert.match(DUAL_MOTION.sharedKit, /shared, not exclusive/);
  assert.doesNotMatch(DUAL_MOTION.sharedBuycalc, /exclusiv/i);
  assert.equal(REPLY_LINE, "We reply within 1 business day.");
  for (const s of [JSON.stringify(DUAL_MOTION), JSON.stringify(BUYER_FAQ)]) {
    assert.doesNotMatch(s, /\bCAD\b|deposit|guarantee(d)? (reach|delivery|results)|seats open|sales@birchreserve/i);
  }
});

test("street-team door section: est. 2026 headline from the census file, inquire-only, area-level, home + media kit only", async () => {
  const { readFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { DOOR_ROUTE, DOOR_HEADLINE, DOOR_DETAIL_ROWS } = await import("../src/lib/doorRoute");
  const { DOOR_ROUTE_DATA: D } = await import("../src/lib/doorRouteData");
  const web = (rel: string) => readFileSync(resolve(process.cwd(), "../clinichub-media", rel), "utf8");

  // est. 2026 incomes are the 2021 Census (2020 income) figures x the CPI factor, nearest $100.
  const r100 = (n: number) => Math.round((n * D.incomeFactor) / 100) * 100;
  assert.equal(D.est2026.avgHouseholdIncomeCad, r100(D.census2021.avgHouseholdIncome2020Cad));
  assert.deepEqual([...D.est2026.medianHouseholdIncomeCadRange], D.census2021.medianHouseholdIncome2020CadRange.map(r100));
  assert.equal(D.est2026.label, "est. 2026");

  // Collapsed row: 3–4 est. 2026 stats, never the 2021 actuals.
  assert.ok(DOOR_HEADLINE.length >= 3 && DOOR_HEADLINE.length <= 4);
  assert.deepEqual(DOOR_HEADLINE.map((s) => s.value), ["$327K", "$166–206K", "71%", "68%"]);
  assert.doesNotMatch(JSON.stringify(DOOR_HEADLINE), /267K|266,900|135|168/);
  assert.match(DOOR_ROUTE.censusQualifier, /est\. 2026 · CAD/);
  // Expanded view carries the 2021 actuals and the method.
  assert.equal(DOOR_DETAIL_ROWS[0]!.census, "$266,900 (2020 income)");
  assert.equal(DOOR_DETAIL_ROWS[1]!.census, "$135,000–$168,000");
  assert.match(DOOR_ROUTE.censusMethod, /1\.226/);
  assert.match(DOOR_ROUTE.censusMethod, /not a forecast/);
  assert.match(DOOR_ROUTE.censusMethod, /carried forward/);

  // Copy rules.
  const copy = JSON.stringify({ DOOR_ROUTE, DOOR_HEADLINE, DOOR_DETAIL_ROWS, D });
  assert.match(DOOR_ROUTE.title, /^Day 1: lead ambassador testing areas around our private network\.$/);
  assert.match(DOOR_ROUTE.body, /sought-after door-to-door display and performance-based placements, targeted by neighbourhood/);
  assert.match(DOOR_ROUTE.body, /limited by route/);
  assert.match(DOOR_ROUTE.goal, /1MM\+ consumers now.*3MM\+ in 2027/);
  assert.match(DOOR_ROUTE.goalNote, /target, modelled, not a guarantee/);
  assert.match(DOOR_ROUTE.inquireNote, /by inquiry only/);
  assert.doesNotMatch(copy, /exclusiv|USD|\bguaranteed\b|deposit/i);
  // Area-level only: no postal codes, street names, house numbers or door counts.
  assert.doesNotMatch(copy, /\b[A-Z]\d[A-Z] ?\d[A-Z]\d\b|\b[A-Z][a-z]+ (Avenue|Road|Street)\b|Deloraine|Melrose|Golfdale|doors (hit|knocked)|\b\d+ doors\b/);
  for (const href of [DOOR_ROUTE.sourceHref, DOOR_ROUTE.cpiHref]) assert.match(href, /^https:\/\//);

  // Placement: home and media kit, not /buycalc; map with webp + jpg fallback; collapsed expander.
  assert.match(web("src/pages/br/home.tsx"), /<DoorRoute [^>]*testId="home-doors"/);
  assert.match(web("src/pages/br/media-kit.tsx"), /<DoorRoute [^>]*testId="mk-doors"/);
  assert.doesNotMatch(readFileSync(resolve(process.cwd(), "src/routes/publicBuying.ts"), "utf8"), /doorRoute|street team|ambassador/i);
  const comp = web("src/components/br/door-route.tsx");
  assert.match(comp, /<details className="group/);
  assert.doesNotMatch(comp, /<details[^>]* open/);
  assert.match(comp, /type="image\/webp"/);
  for (const f of [DOOR_ROUTE.mapWebp, DOOR_ROUTE.mapJpg]) assert.ok(existsSync(resolve(process.cwd(), "../clinichub-media/public" + f)), f);
});

test("sponsor deposits gate + /sponsor packs page (audit #6)", () => {
  const E = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
  assert.equal(sponsorDepositsOpen(E({ SPONSOR_DEPOSITS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_x" })), false);
  assert.equal(sponsorDepositsOpen(E({ SPONSOR_DEPOSITS_ENABLED: "true", SPONSOR_DEPOSITS_LIVE: "true", STRIPE_SECRET_KEY: "sk_live_x" })), true);
  assert.equal(sponsorDepositsOpen(E({ SPONSOR_DEPOSITS_ENABLED: "true", SPONSOR_DEPOSITS_LIVE: "true", STRIPE_SECRET_KEY: "sk_live_x", STRIPE_CHECKOUT_DISABLED: "true" })), false);
  assert.equal(sponsorDepositsOpen(E({ STRIPE_SECRET_KEY: "sk_test_x" })), false);
  const html = sponsorHtml("cad", { open: true, pack: "sponsor-6000", prefill: { email: "a@acme.com", company: "Acme <x>" } });
  // Guided form (Nov 21 2026): every pack is priced on its card; one primary button pays for the picked pack.
  // Geo pricing: a CAD visitor sees the CAD table and is charged in CAD.
  for (const [k, n] of [["1500", "2,100"], ["3000", "4,200"], ["6000", "8,400"]]) assert.match(html, new RegExp(`data-testid="pack-sponsor-${k}"[^]*?\\$${n} CAD`));
  assert.match(html, /id="sp-go"[^>]*>Prepay \$8,400/);
  assert.match(html, /currency:'cad'/);
  for (const n of ["1,500", "3,000", "6,000"]) assert.match(sponsorHtml("usd", { open: true }), new RegExp(`\\$${n} USD`));
  assert.match(html, /Step 1 of 2[^]*Step 2 of 2/);
  assert.match(html, /value="sponsor-6000" checked/);
  assert.match(html, /value="Acme &lt;x&gt;"/);
  assert.match(html, /counts in full toward any sponsorship pack bought within 30 days/);
  assert.match(html, /refundable until 14 days before the launch date in your IO/);
  assert.doesNotMatch(html, /CAD 1|C\$|paused right now/);
  assert.match(sponsorHtml("usd", { open: false }), /paused right now/);
});

import { setSalesAlertDepsForTests } from "../src/lib/salesAlert";
test("GTM bot lead: validated, honeypotted, tagged SBG, alert to randy@silverbirchgrowth.com only", async () => {
  const sent: Array<{ to: string[]; subject: string; html: string }> = [];
  setSalesAlertDepsForTests({ send: async (m) => { sent.push({ to: m.to as string[], subject: m.subject, html: m.html }); return { id: "x" }; }, ready: () => true });
  const app = express();
  app.use(createOverhaulRouter());
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const post = (b: unknown) => fetch(`http://127.0.0.1:${port}/v1/gtm-bot-lead`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `9.9.9.${Math.floor(Math.random() * 200)}` }, body: JSON.stringify(b) });
  try {
    const good = { name: "QA", company: "Acme TEST", email: "qa+gtmbot@silverbirchgrowth.com", fields: { what_they_sell: "a product", stage: "Growing", bots_preference: "Our bots (we run)" } };
    const r = await post(good);
    assert.equal(r.status, 200);
    const j = (await r.json()) as { ok: boolean; alert: string };
    assert.equal(j.alert, "sent");
    assert.deepEqual(sent[0].to, ["randy@silverbirchgrowth.com"]);
    assert.match(sent[0].subject, /^\[TEST\] \[SBG GTM BOT\]/);
    assert.match(sent[0].html, /Business line[^]*SBG/);
    assert.equal((await post({ ...good, email: "bad" })).status, 400);
    assert.equal((await post({ ...good, company: "" })).status, 400);
    assert.equal((await post({ ...good, fields: { ...good.fields, stage: "x" } })).status, 400);
    const n = sent.length;
    const hp = await post({ ...good, company_url: "http://spam" });
    assert.equal(hp.status, 200);
    assert.equal(sent.length, n);
  } finally {
    server.close();
    setSalesAlertDepsForTests({ send: null, ready: null });
  }
});
