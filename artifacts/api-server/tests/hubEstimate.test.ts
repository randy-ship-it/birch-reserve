import test from "node:test";
import assert from "node:assert/strict";
import { estimateHub, DEFAULT_INPUTS, SELL_BAND } from "../src/lib/overhaul/hubEstimate";

test("typical hub reconciles with the media model (~$1,080 likely, 530-1,650 range)", () => {
  const r = estimateHub(DEFAULT_INPUTS);
  assert.ok(Math.abs(r.earn.likely - 1084) < 15);
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
