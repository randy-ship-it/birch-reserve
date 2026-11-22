import test from "node:test";
import assert from "node:assert/strict";
import { estimateHub, DEFAULT_INPUTS, SELL_BAND } from "../src/lib/overhaul/hubEstimate";

test("typical hub earnings: email $12 per 1,000 opens, post-purchase $30-45, sold 20/40/60% (~$940 likely at 70% share)", () => {
  const r = estimateHub(DEFAULT_INPUTS);
  assert.ok(Math.abs(r.earn.likely - 940) < 30);
  assert.ok(r.earn.low < r.earn.likely && r.earn.likely < r.earn.high);
  assert.equal(Math.round(r.year), Math.round(r.earn.likely * 12));
});
test("chain is consistent: shown = views x sell-through; sales = orders x cart; earnings ignore sales", () => {
  const r = estimateHub({ ...DEFAULT_INPUTS, cart: 100 });
  assert.ok(Math.abs(r.shown - (r.views * SELL_BAND[1]) / 100) < 1);
  assert.ok(Math.abs(r.sales - r.orders * 100) < 0.01);
  assert.equal(estimateHub({ ...DEFAULT_INPUTS, cart: 500 }).earn.likely, r.earn.likely);
});
test("bigger inputs give bigger outputs; level moves clicks/orders but not earnings", () => {
  const small = estimateHub({ ...DEFAULT_INPUTS, orders: 3000, list: 10000 });
  const big = estimateHub({ ...DEFAULT_INPUTS, orders: 150000, list: 600000, visitors: 400000 });
  assert.ok(big.earn.likely > small.earn.likely * 20);
  const lo = estimateHub({ ...DEFAULT_INPUTS, level: "low" }), hi = estimateHub({ ...DEFAULT_INPUTS, level: "high" });
  assert.ok(hi.orders > lo.orders * 4);
  assert.equal(hi.earn.likely, lo.earn.likely);
});
test("no newsletter and zero inputs give no zero-division or NaN", () => {
  const r = estimateHub({ ...DEFAULT_INPUTS, newsletter: false, orders: 0, visitors: 0 });
  assert.ok(Number.isFinite(r.earn.likely) && r.earn.likely === 0 && r.views === 0);
});
test("email views are opens, email has its own click band, and every surface blended click rate is plausible", () => {
  const r = estimateHub(DEFAULT_INPUTS);
  const mail = r.surfaces.find((s) => s.key === "newsletter")!;
  assert.ok(mail.views < DEFAULT_INPUTS.list * 4 * 0.5 && mail.views > DEFAULT_INPUTS.list * 4 * 0.19);
  assert.ok(mail.clicks / mail.shown > 0.003 && mail.clicks / mail.shown < 0.02);
  const pp = r.surfaces.find((s) => s.key === "post_purchase")!;
  assert.ok(pp.clicks / pp.shown >= 0.015 && pp.clicks / pp.shown <= 0.04);
  assert.ok(r.ctrPct > 0.5 && r.ctrPct < 3);
});
test("effective RPM is flat with scale and post-purchase brand return holds at 2.5x", () => {
  const a = estimateHub(DEFAULT_INPUTS), b = estimateHub({ ...DEFAULT_INPUTS, orders: 50000, list: 240000 });
  assert.ok(Math.abs(a.earn.likely / a.views - b.earn.likely / b.views) < 1e-6);
  const pp = a.surfaces.find((s) => s.key === "post_purchase")!;
  assert.ok(pp.sales / (pp.earn / (a.sharePct / 100)) >= 2.5);
});

test("publisher page and hub calculator agree: 20/40/60 sold, 70% share, same typical hub", async () => {
  const { projectPublisher, PUBLISHER_SURFACES } = await import("../src/lib/overhaul/brandIntake");
  const all = Object.fromEntries(PUBLISHER_SURFACES.map((s) => [s.key, s.key !== "social"])) as Record<string, boolean>;
  const p = projectPublisher({ on: all, mode: "cpm", sizeX: 1, conversionPct: 0, valuePerConversionUsd: 0 });
  const h = estimateHub(DEFAULT_INPUTS);
  assert.ok(Math.abs(p.mediaLikelyUsd - h.earn.likely) <= 4, `${p.mediaLikelyUsd} vs ${h.earn.likely}`);
  assert.ok(Math.abs(p.mediaPayoutUsd[0] - h.earn.low) <= 4);
  assert.ok(Math.abs(p.mediaPayoutUsd[1] - h.earn.high) <= 4);
  assert.equal(h.sharePct, 70);
  assert.equal(p.payoutPct, 70);
  assert.deepEqual([...p.sellBand], [20, 40, 60]);
});

test("hub share tiers: 70% under 1MM views, 75% at 1MM+, 80% at 3MM+, 85% at 5MM+; brand sales unchanged by the share", () => {
  const at = (views: number) => { const k = views / estimateHub(DEFAULT_INPUTS).views; return estimateHub({ ...DEFAULT_INPUTS, orders: 25000 * k, list: 120000 * k }); };
  assert.deepEqual([500_000, 1_000_000, 3_000_000, 5_000_000].map((v) => at(v).sharePct), [70, 75, 80, 85]);
  const a = at(1_000_000), b = at(1_200_000);
  assert.ok(Math.abs(a.earn.likely / a.views - b.earn.likely / b.views) < 1e-6, "same tier, same RPM");
  assert.ok(at(5_000_000).earn.likely / 5_000_000 > at(500_000).earn.likely / 500_000);
  assert.ok(Math.abs(at(5_000_000).sales / 5_000_000 - at(500_000).sales / 500_000) < 1e-6, "sales per view do not depend on the share");
});
