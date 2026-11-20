import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { cadToApproxUsd, payoutAmount, payoutRegionForCountry, PAYOUT_USD_PER_CAD } from "../src/lib/payoutCurrency";
import sponsorRouter from "../src/routes/sponsorPage";
import { withPayoutRegion } from "../src/lib/publicSeo";
import { HUBS } from "../src/lib/sponsorKit";

test("only an explicit US country selects USD", () => {
  assert.equal(payoutRegionForCountry("US"), "us");
  assert.equal(payoutRegionForCountry("us"), "us");
  for (const c of ["CA", "GB", "", undefined, null, "XX", "T1"]) assert.equal(payoutRegionForCountry(c as string), "ca");
});

test("conversion is fixed and rounded to US$5", () => {
  assert.equal(PAYOUT_USD_PER_CAD, 0.72);
  assert.deepEqual([500, 700, 750, 1050, 1000, 1500].map(cadToApproxUsd), [360, 505, 540, 755, 720, 1080]);
  assert.equal(payoutAmount(500, "ca"), "$500 CAD");
  assert.equal(payoutAmount(700, "ca", true), "$700+ CAD");
  assert.equal(payoutAmount(500, "us"), "≈ US$360");
  assert.equal(payoutAmount(1500, "us"), "≈ US$1,080");
});

test("shell script is only added for US", () => {
  const html = "<html><head></head><body></body></html>";
  assert.equal(withPayoutRegion(html, "ca"), html);
  assert.match(withPayoutRegion(html, "us"), /__BR_PAYOUT_REGION__="us"/);
});

test("hub label no longer says pooled", () => {
  assert.ok(HUBS.some((h) => h.name === "Clinic hub network"));
  assert.ok(!HUBS.some((h) => /pooled/i.test(h.name)));
});

test("/sponsor payout table varies by country and says Vary", async () => {
  const app = express();
  app.use(sponsorRouter);
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const get = async (country?: string) => {
      const r = await fetch(`http://127.0.0.1:${port}/sponsor`, { headers: country ? { "x-vercel-ip-country": country } : {} });
      return { html: await r.text(), vary: r.headers.get("vary") ?? "", cc: r.headers.get("cache-control") ?? "" };
    };
    for (const c of [undefined, "CA", "DE"]) {
      const { html, vary, cc } = await get(c);
      assert.match(html, /\$500 CAD cash/);
      assert.doesNotMatch(html, /≈ US\$/);
      assert.match(vary, /x-vercel-ip-country/i);
      assert.match(cc, /private/);
    }
    const us = await get("US");
    assert.match(us.html, /≈ US\$360 cash/);
    assert.match(us.html, /≈ US\$505 ad credit/);
    assert.doesNotMatch(us.html, /\$500 CAD cash/);
    // Buyer prices stay USD in both.
    for (const h of [us.html, (await get("CA")).html]) {
      assert.match(h, /\$1,500/);
      assert.match(h, /\$6,000/);
    }
  } finally {
    server.close();
  }
});
