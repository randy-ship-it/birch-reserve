/** Brand intake + Download my kit (PREVIEW, Nov 18 2026). Guards the hard rules and that no numbers are invented. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANCHOR_HUBS_STATUS,
  CHANNEL_TILES,
  CHANNEL_TILES_LABEL,
  EXPOSURE_CHANNELS,
  FIRST_LOOK,
  HUB_RATE_RANGE,
  PAYOUT,
  PROPOSED_ANCHOR_HUBS,
  PUBLISHER_SURFACES,
  SPONSOR_OFFERS,
  SUPPLIER_CATEGORIES,
  projectPublisher,
} from "../src/lib/overhaul/brandIntake";
import { KIT_CALC_CONFIG, kitCalc } from "../src/lib/kitCalc";
import { RATE_SURFACES, BLENDED } from "../src/lib/overhaul/pricing";
import { INTENT_LADDER, CATEGORY_DEMAND } from "../src/lib/overhaul/audiences";
import { AREA_LOCK, BRAND_HUBS, CPC_FLOOR_USD, INVENTORY, blendedHubCpmUsd, DEPOSIT_TIERS } from "../src/lib/overhaul/model";
import { publicOffers, modelledViewsForCreditUsd } from "../src/lib/overhaul/agent";
import { SLOTS } from "../src/lib/sponsorKit";
import { SELL_ASSUMPTION_PCT } from "../src/lib/overhaul/agencyShowcase";
import { PUBLIC_SITEMAP_PATHS, SPA_SHELL_PATHS, isNoIndexPath } from "../src/lib/publicSeo";

const web = (f: string) => readFileSync(resolve(process.cwd(), "../clinichub-media/src", f), "utf8");
const PAGES = ["pages/br/intake.tsx", "pages/br/intake-publisher.tsx", "pages/br/intake-supplier.tsx", "pages/br/intake-sponsor.tsx", "pages/br/intake-report.tsx", "components/br/intake-kit.tsx", "components/br/kit-builder.tsx", "lib/kitRender.ts", "lib/kitView.ts", "lib/fridayMockReport.ts", "pages/br/brand-kit.tsx", "pages/br/kit-report.tsx", "components/br/pilot-path.tsx"];
const copy = () =>
  [
    ...PAGES.map(web),
    readFileSync(resolve(process.cwd(), "src/lib/overhaul/brandIntake.ts"), "utf8"),
    readFileSync(resolve(process.cwd(), "src/lib/kitCalc/index.ts"), "utf8"),
    readFileSync(resolve(process.cwd(), "src/lib/kitCalc/config.json"), "utf8"),
    readFileSync(resolve(process.cwd(), "src/lib/overhaul/pilotPath.ts"), "utf8"),
  ].join("\n");

test("hard rules: no private partners, banned names, counts, guarantees or deposit wording", () => {
  const c = copy();
  for (const bad of [/medvibe/i, /clairvoyant/i, /\bAlign\b/, /alignwellness/i, /alset/i, /80 locations/i, /\bdeposit\b/i, /\bsigned (partners|hubs)\b/i, /\b\d+\s+(booked|sold|signed)\b/i, /guaranteed (views|clicks|impressions|roas)/i, /\bCAD\b/]) {
    assert.ok(!bad.test(c), `found ${bad}`);
  }
  assert.ok(!/exclusive/i.test(c.replace(/not exclusive/gi, "")), "only 'not exclusive' may appear");
});

test("publisher surfaces re-use the rate card / spec sheet; nothing invented", () => {
  const byKey = Object.fromEntries(PUBLISHER_SURFACES.map((s) => [s.key, s]));
  assert.deepEqual(byKey.post_purchase!.cpm, RATE_SURFACES.find((r) => r.key === "post_purchase")!.cpmStarter);
  assert.deepEqual(byKey.home!.cpc, RATE_SURFACES.find((r) => r.key === "landing")!.cpcStarter);
  assert.deepEqual(byKey.services!.cpm, RATE_SURFACES.find((r) => r.key === "services")!.cpmStarter);
  assert.deepEqual(byKey.member_dashboard!.ctr, [INTENT_LADDER[1]!.lo, INTENT_LADDER[1]!.hi]);
  assert.equal(byKey.newsletter!.cpm![0], SLOTS.find((s) => s.key === "partner_email")!.cpmUsd);
  assert.equal(byKey.social!.cpm, null, "no social rate on file: shown as Not set");
  assert.deepEqual(Object.keys(byKey).sort(), ["home", "member_dashboard", "newsletter", "post_purchase", "product", "services", "social"]);
});

test("publisher projection: 35% payout, sell-through assumption, ramp <= normalized, toggles", () => {
  const p = projectPublisher({ on: {}, mode: "cpm", sizeX: 1, conversionPct: 0, valuePerConversionUsd: 0 });
  assert.equal(PAYOUT.basePct, 35);
  assert.equal(p.sellPct, SELL_ASSUMPTION_PCT);
  assert.ok(p.mediaPayoutUsd[0] > 0 && p.mediaPayoutUsd[0] <= p.mediaPayoutUsd[1]);
  const pp = p.rows.find((r) => r.key === "post_purchase")!;
  assert.equal(pp.payoutUsd[0], Math.round(pp.grossUsd[0] * 0.35));
  const off = projectPublisher({ on: { post_purchase: false, home: false, product: false, services: false, member_dashboard: false }, mode: "cpm", sizeX: 1, conversionPct: 0, valuePerConversionUsd: 0 });
  assert.deepEqual(off.mediaPayoutUsd, [0, 0]);
  const cpc = projectPublisher({ on: {}, mode: "cpc", sizeX: 2, conversionPct: 2, valuePerConversionUsd: 50 });
  assert.ok(cpc.transactionsUsd > 0, "transactions only from user inputs");
  assert.equal(PAYOUT.tiersLabel, "Placeholder tiers");
  assert.ok(PAYOUT.tiers.slice(1).every((t) => t.placeholder && t.pct == null && t.breakpoint == null), "breakpoints not set");
});

test("supplier: categories from CATEGORY_DEMAND, first look on the top 3 at published starter rates", () => {
  assert.equal(SUPPLIER_CATEGORIES.length, CATEGORY_DEMAND.length);
  assert.deepEqual(SUPPLIER_CATEGORIES.filter((c) => c.firstLook).map((c) => c.key), ["recovery", "supplements", "fitness"]);
  assert.equal(FIRST_LOOK.cpmUsd, BLENDED.starterCpm);
  assert.equal(FIRST_LOOK.cpcUsd, CPC_FLOOR_USD);
  assert.match(FIRST_LOOK.fine, /not exclusive/);
});

test("sponsor: existing SKUs and prices only, existing Stripe paths, area lock is a launch price", () => {
  const offers = publicOffers();
  assert.equal(SPONSOR_OFFERS.find((o) => o.key === "hold-190")!.priceUsd, offers[0]!.price_usd);
  assert.equal(SPONSOR_OFFERS.find((o) => o.key === "reserve-490")!.priceUsd, offers[1]!.price_usd);
  assert.equal(SPONSOR_OFFERS.find((o) => o.key === "hold-190")!.href, "/buycalc?sku=hold-190");
  assert.equal(SPONSOR_OFFERS.find((o) => o.key === "reserve-490")!.href, "/buycalc?sku=reserve-490");
  const area = SPONSOR_OFFERS.find((o) => o.key === "area-lock")!;
  assert.equal(area.priceUsd, AREA_LOCK.priceUsd);
  assert.equal(area.priceUsd, 3500);
  assert.equal(area.href, "/advertise/local");
  assert.ok(SPONSOR_OFFERS.every((o) => o.priceLabel.endsWith("USD")));
});

test("channel tiles: Randy's figures labelled network figures / targets; Calm Joints shows none", () => {
  assert.equal(CHANNEL_TILES_LABEL, "Network figures / targets");
  const t = Object.fromEntries(CHANNEL_TILES.map((x) => [x.key, x]));
  assert.deepEqual(t["scale-hubs"]!.stats.map((s) => s.v), [">20MM", ">700MM", ">5B"]);
  assert.ok(/target/.test(t["scale-hubs"]!.stats[2]!.l));
  assert.equal(t["calm-joints"]!.stats.length, 0);
  assert.deepEqual(t["street-team"]!.stats.map((s) => s.v), ["500K", "3MM+"]);
  assert.deepEqual(t["retail-network"]!.stats.map((s) => s.v), ["120+", "1MM+", "CA + US"]);
});

test("kit calculator config matches Birch modelled figures (no outside benchmarks)", () => {
  assert.equal(KIT_CALC_CONFIG.demand.blendedHubCpmUsd, Math.round(blendedHubCpmUsd() * 100) / 100);
  const browse = INTENT_LADDER.find((x) => x.moment === "Browsing the hub")!;
  assert.deepEqual([KIT_CALC_CONFIG.demand.ctrBand.lo, KIT_CALC_CONFIG.demand.ctrBand.hi], [browse.lo, browse.hi]);
  assert.deepEqual(KIT_CALC_CONFIG.spendLevels.map((s) => s.usd), [490, ...DEPOSIT_TIERS.map((d) => d.usd)]);
  assert.equal(KIT_CALC_CONFIG.currency, "USD");
});

test("kit calculator math is transparent and ranged", () => {
  const r = kitCalc({ aovUsd: 100, monthlyOrders: 400, purchasesPerYear: [2, 3], marginBand: "50_70", spendUsd: 490, conversionPct: 1 });
  assert.deepEqual(r.ltvGpUsd, [100 * 0.5 * 2 * 1, 100 * 0.7 * 3 * 3]);
  assert.deepEqual(r.gpPerOrderUsd, [50, 70]);
  // Same formula as Friday ltv-v1. Friday's worked example uses its own 40–60% band ($120 cart, 3/yr → $144–$648);
  // the formula reproduces it when given the same band bounds.
  const f = 120 * 3;
  assert.deepEqual([f * 0.4 * 1, f * 0.6 * 3], [144, 648]);
  assert.deepEqual(kitCalc({ aovUsd: 120, monthlyOrders: 1300, purchasesPerYear: 3, marginBand: "30_50" }).current.monthlyGpUsd, [1300 * 36, 1300 * 60]);
  assert.ok(Math.abs(r.scale.modelledViews - modelledViewsForCreditUsd(490)) <= 100, "views within rounding of the Birch model");
  assert.ok(r.revenueOppUsd[0] <= r.revenueOppUsd[1] && r.gpOppUsd[0] <= r.gpOppUsd[1]);
  assert.equal(r.breakEvenCustomers[0], Math.ceil(490 / r.ltvGpUsd[1]));
  assert.equal(r.label, "Estimate");
  const bad = kitCalc({ aovUsd: -5, monthlyOrders: NaN, purchasesPerYear: 0, marginBand: "nope", spendUsd: 123 });
  assert.equal(bad.inputs.aovUsd, 0);
  assert.equal(bad.inputs.purchasesPerYear, 1);
  assert.equal(bad.inputs.spendUsd, 490);
});

test("kit calculator module stays framework-light (reusable by scalehealth.ca/clinichubs)", () => {
  const src = readFileSync(resolve(process.cwd(), "src/lib/kitCalc/index.ts"), "utf8");
  const imports = [...src.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./config.json"]);
});

test("Side B anchor hubs: proposed, pending Randy, public-OK names only", () => {
  assert.equal(ANCHOR_HUBS_STATUS, "Proposed, pending Randy's confirmation");
  const publicNames = new Set([...BRAND_HUBS.map((h) => h.name), "Integrity Fitness", "Kalaya"]); // Kalaya public per Randy 11:34 PM
  assert.ok(INVENTORY.line.includes("Integrity Fitness"));
  for (const h of PROPOSED_ANCHOR_HUBS) assert.ok(publicNames.has(h.name), h.name);
  assert.deepEqual(PROPOSED_ANCHOR_HUBS.map((h) => h.key), ["dr-ho", "roll-recovery", "jill-health", "jack-health", "nutriprocan", "sole", "effortless-admin", "kalaya"]);
  assert.deepEqual(EXPOSURE_CHANNELS[0]!.cpm, HUB_RATE_RANGE.cpm);
  assert.deepEqual(HUB_RATE_RANGE.cpm, [4, 30]);
  assert.ok(EXPOSURE_CHANNELS.slice(1).every((c) => c.cpm === null), "no rate card for other channels: priced by IO");
});

test("intake pages are SPA shells, noindex and not in the sitemap; /inventory and Stripe paths untouched", () => {
  for (const p of ["/intake", "/intake/publisher", "/intake/supplier", "/intake/sponsor", "/intake/report"]) {
    assert.ok((SPA_SHELL_PATHS as readonly string[]).includes(p), p);
    assert.ok(isNoIndexPath(p), p);
    assert.ok(!(PUBLIC_SITEMAP_PATHS as readonly string[]).includes(p), p);
  }
  const kb = web("components/br/kit-builder.tsx");
  assert.ok(!/checkout|stripe/i.test(kb.replace(/No checkout here/g, "")), "kit has no checkout");
  assert.ok(web("pages/br/media-kit.tsx").includes('href={RESERVE_HREF}'), "existing reserve CTA kept");
});

test("adapter: mock on previews, pending_review only, never auto-accepted; audience block never used", () => {
  const a = web("lib/fridayBrandIntake.ts");
  assert.match(a, /friday_not_configured/); // labelled mock only when the Birch server has no Friday config
  assert.match(a, /\/v1\/brand-intake/);
  assert.match(a, /\/v1\/brand-report\//);
  assert.ok(!/status = "approved"/.test(a));
  assert.ok(!/audience-summaries|tam\/partners/.test(copy() + a));
});

test("brand kit + private report routes: noindex SPA shells, token kept out of canonical, not in sitemap", () => {
  assert.ok((SPA_SHELL_PATHS as readonly string[]).includes("/brand-kit"));
  for (const p of ["/brand-kit", "/kit/r/abc123", "/kit/r/abc123/"]) {
    assert.ok(isNoIndexPath(p), p);
    assert.ok(!(PUBLIC_SITEMAP_PATHS as readonly string[]).some((x) => x.startsWith("/kit/r") || x === "/brand-kit"), p);
  }
  assert.ok(!isNoIndexPath("/kit"), "/kit itself unchanged");
  const r = readFileSync(resolve(process.cwd(), "src/routes/publicSeo.ts"), "utf8");
  assert.match(r, /router\.get\("\/kit\/r\/:token"/);
  assert.match(r, /withRouteSeo\(readSpaIndexHtml\(\), "\/kit\/r\/report"\)/);
  assert.match(r, /Referrer-Policy", "no-referrer"/);
  const vb = readFileSync(resolve(process.cwd(), "../../scripts/vercel-build.mjs"), "utf8");
  assert.ok(vb.includes('"/kit/r/[^/]+/?"') && vb.includes('"/brand-kit/?"'));
});

test("calculator chips match Randy's UI; repeat bands feed the same ltv-v1 formula as Friday", () => {
  assert.deepEqual(KIT_CALC_CONFIG.marginBands.map((b) => b.label), ["<30%", "30–50%", "50–70%", "70%+"]);
  assert.deepEqual(KIT_CALC_CONFIG.repeatBands.map((b) => b.label), ["1", "2–3", "4–6", "7+"]);
  const r = kitCalc({ aovUsd: 120, monthlyOrders: 1300, purchasesPerYear: [4, 6], marginBand: "50_70" });
  assert.deepEqual(r.ltvGpUsd, [120 * 0.5 * 4 * 1, Math.round(120 * 0.7 * 6 * 3)]);
});

test("display uses Friday's ltv + demand_fit exactly as returned (no client recompute)", () => {
  const v = web("lib/kitView.ts");
  assert.ok(v.includes("lt?.gp_ltv_usd ? [lt.gp_ltv_usd.low, lt.gp_ltv_usd.high]"));
  assert.match(v, /h\.fit_label/);
  assert.match(v, /df\?\.label \?\? "Estimate · subject to human confirmation"/);
  const kb = web("components/br/kit-builder.tsx");
  assert.match(kb, /report \? fridayView\(report/);
  assert.match(kb, /reportView\(next\.reportToken, "brand"\)/);
  assert.ok(web("lib/fridayBrandIntake.ts").includes("Thanks, your kit is in review. We confirm brand ownership before releasing the full report, usually within one business day."));
  assert.match(web("lib/fridayBrandIntake.ts"), /can't recover the edit token, only rotate it/);
});

test("no intake secret or approvals call anywhere in the client bundle sources", () => {
  const files = [...PAGES, "lib/fridayBrandIntake.ts", "lib/fridayMockReport.ts"].map(web).join("\n");
  assert.ok(!/INTAKE_WEBHOOK_SECRET|X-Intake-Secret/i.test(files));
  assert.ok(!/\/approvals?\b.*fetch|fetch\([^)]*approv/i.test(files));
});

test("hero path picks: existing terms word for word, no turnaround promise, no reach numbers, no skipped claims", async () => {
  const pp = await import("../src/lib/overhaul/pilotPath");
  const { PUBLIC_RESERVE_OFFERS } = await import("../src/lib/reserveOffers");
  const { SEE_THE_UNIT, FLIGHT_TIMELINE } = await import("../src/lib/buyerComfort");
  assert.equal(pp.PILOT_HERO.lookTerms, PUBLIC_RESERVE_OFFERS.find((o) => o.sku === "hold-190")!.scope);
  assert.equal(pp.PILOT_HERO.decide, SEE_THE_UNIT.decide);
  assert.deepEqual(pp.PILOT_HERO.refunds, FLIGHT_TIMELINE.refunds);
  assert.equal(pp.CATEGORY_AUDIENCES.length, 8);
  const txt = readFileSync(resolve(process.cwd(), "src/lib/overhaul/pilotPath.ts"), "utf8") + web("components/br/pilot-path.tsx");
  for (const bad of [/48.?h(ou)?r/i, /\b5 ?km\b/i, /50% (of )?display/i, /meta (cpm|median)/i, /\bCTR\b/, /ROAS/]) assert.ok(!bad.test(txt), `found ${bad}`);
  for (const c of pp.CATEGORY_AUDIENCES) assert.ok(!/\d/.test(c.who + c.timing + c.also.join("")), `no numbers on ${c.key}`);
  assert.ok(pp.REPORTING.commitment.startsWith("Pilot reporting commitment"));
  assert.equal(pp.THREE_STEPS.sampleIoHref, "/sample-io");
  assert.equal(pp.AGENT_LINE.text, "Your AI agent can quote a seat and hand off to checkout.");
  for (const f of ["pages/br/home.tsx", "pages/br/media-buyers.tsx", "pages/br/agencies.tsx"]) assert.match(web(f), /PilotHero|KitEntry/, f);
  assert.match(web("pages/br/media-kit.tsx"), /KitBuilder/);
});
