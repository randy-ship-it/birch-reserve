import test from "node:test";
import assert from "node:assert/strict";
import { estimateHub, DEFAULT_INPUTS, SELL_BAND } from "../src/lib/overhaul/hubEstimate";

test("typical hub earnings: email $12 per 1,000 opens, post-purchase $30-45, sold 20/40/60% (~$472 likely)", () => {
  const r = estimateHub(DEFAULT_INPUTS);
  assert.ok(Math.abs(r.earn.likely - 472) < 15);
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
  const a = estimateHub(DEFAULT_INPUTS), b = estimateHub({ ...DEFAULT_INPUTS, orders: 250000, list: 1200000 });
  assert.ok(Math.abs(a.earn.likely / a.views - b.earn.likely / b.views) < 1e-6);
  const pp = a.surfaces.find((s) => s.key === "post_purchase")!;
  assert.ok(pp.sales / (pp.earn / 0.35 / 0.4 * 0.4) >= 2.5);
});
