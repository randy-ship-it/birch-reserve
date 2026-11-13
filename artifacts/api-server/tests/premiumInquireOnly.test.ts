import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {
  PREMIUM_INQUIRE_ONLY,
  inquireOnlyResponse,
  isInquireOnly,
  isPremiumFormat,
  isPremiumOffer,
  isPremiumPlacement,
  isPremiumViewBlock,
} from "../src/lib/premiumInquireOnly";
import { createAgentRouter } from "../src/routes/agent";
import { createOverhaulRouter } from "../src/routes/overhaul";
import publicBuyingRouter from "../src/routes/publicBuying";

const ALLOWED_FORMATS = ["recovery_plan", "scheduled_service", "member_hub"] as const; // Hub Home, Product/Services, Member Dashboard
const ALLOWED_PLACEMENTS = ["hub_home", "product_services", "member_dashboard"] as const;
const SKUS = ["hold-190", "reserve-490"] as const;

async function withServer<T>(app: express.Express, fn: (base: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("PREMIUM_INQUIRE_ONLY lists Post-Purchase, the 100K/250K/1M blocks and the locks", () => {
  assert.deepEqual([...PREMIUM_INQUIRE_ONLY.formats], ["post_checkout"]);
  assert.deepEqual([...PREMIUM_INQUIRE_ONLY.placements], ["post_purchase"]);
  assert.deepEqual([...PREMIUM_INQUIRE_ONLY.viewBlocks], [100_000, 250_000, 1_000_000]);
  for (const o of ["area-lock", "category-lock", "block-100k", "block-250k", "block-1m"]) assert.ok(isPremiumOffer(o), o);
});

test("helper: each premium type is inquire-only; the allowed placements and $190/$490 are not", () => {
  assert.ok(isPremiumFormat("post_checkout"));
  assert.ok(isPremiumPlacement("post_purchase"));
  for (const b of [100_000, 250_000, 1_000_000, "250000"]) assert.ok(isPremiumViewBlock(b), String(b));
  assert.ok(isInquireOnly({ areaLock: true }));
  assert.ok(isInquireOnly({ categoryLock: true }));
  assert.ok(isInquireOnly({ offer: "area-lock" }));
  assert.ok(isInquireOnly({ block: 1_000_000 }));
  for (const f of ALLOWED_FORMATS) for (const sku of SKUS) assert.equal(isInquireOnly({ format: f, offer: sku }), false, `${f} ${sku}`);
  for (const p of ALLOWED_PLACEMENTS) assert.equal(isInquireOnly({ placement: p }), false, p);
  assert.equal(isPremiumOffer("reserve-490"), false);
  assert.equal(isPremiumOffer("hold-190"), false);
  assert.equal(inquireOnlyResponse().inquire_only, true);
});

const checkoutBody = (sku: string, format_pref?: string) => ({
  sku,
  email: "buyer@example.com",
  brand: "Example Brand (test)",
  idempotency_key: `test-${sku}-${format_pref ?? "none"}-${Math.random().toString(36).slice(2)}`,
  currency: "usd",
  ...(format_pref ? { format_pref } : {}),
});

test("/v1/checkout rejects Post-Purchase card checkout for $190 and $490 (409, inquire_only, no session)", async () => {
  const app = express().use(express.json()).use(publicBuyingRouter);
  await withServer(app, async (base) => {
    for (const sku of SKUS) {
      const r = await post(`${base}/v1/checkout`, checkoutBody(sku, "post_checkout"));
      assert.equal(r.status, 409, sku);
      const j = (await r.json()) as { inquire_only?: boolean; checkout_url: string | null; error?: string };
      assert.equal(j.inquire_only, true);
      assert.equal(j.checkout_url, null);
      assert.match(j.error ?? "", /inquire-only/);
    }
  });
});

test("/v1/checkout lets the allowed placements at $190/$490 past the premium guard", async () => {
  // No database in this unit test: past the guard the seat claim fails, so we only assert the guard did not fire.
  const app = express().use(express.json()).use(publicBuyingRouter);
  await withServer(app, async (base) => {
    for (const f of [...ALLOWED_FORMATS, undefined]) {
      for (const sku of SKUS) {
        const r = await post(`${base}/v1/checkout`, checkoutBody(sku, f));
        const j = (await r.json().catch(() => ({}))) as { inquire_only?: boolean };
        assert.notEqual(j.inquire_only, true, `${f ?? "omitted"} ${sku}`);
        assert.notEqual(r.status, 409, `${f ?? "omitted"} ${sku}`);
        assert.notEqual(r.status, 400, `${f ?? "omitted"} ${sku} passed validation`);
      }
    }
  });
});

test("/v1/area/checkout never opens card checkout for an area lock, even with the gate open", async () => {
  process.env.AREA_LOCK_ENABLED = "true";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  let called = 0;
  const app = express().use(createOverhaulRouter({ createSession: async () => { called++; return { url: "x", livemode: false }; } }));
  try {
    await withServer(app, async (base) => {
      const status = (await (await fetch(`${base}/v1/overhaul/status`)).json()) as { areaLockCheckout: boolean; areaLockInquireOnly: boolean };
      assert.equal(status.areaLockCheckout, false);
      assert.equal(status.areaLockInquireOnly, true);
      const r = await post(`${base}/v1/area/checkout`, { postal: "L4C 3G5", term: 3, category: "Physio", business: "Example Studio (test)", email: "owner@example.com", agree: true, currency: "cad" });
      const j = (await r.json()) as { held?: boolean; inquire_only?: boolean; url?: string };
      assert.equal(j.inquire_only, true);
      assert.equal(j.held, true);
      assert.equal(j.url, undefined);
      assert.equal(called, 0);
    });
  } finally {
    delete process.env.AREA_LOCK_ENABLED;
    delete process.env.STRIPE_SECRET_KEY;
  }
});

test("/v1/agent/checkout: area lock is inquire-only; a $490 starter slot still opens card checkout", async () => {
  process.env.AREA_LOCK_ENABLED = "true";
  process.env.SPONSOR_DEPOSITS_ENABLED = "true";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  let called = 0;
  const app = express().use(createAgentRouter({ createSession: async () => { called++; return { url: "x", livemode: false }; } }));
  try {
    await withServer(app, async (base) => {
      const cat = (await (await fetch(`${base}/v1/agent/catalog.json`)).json()) as Record<string, unknown>;
      assert.ok(JSON.stringify(cat).includes('"area_lock":"held"'));
      const area = await post(`${base}/v1/agent/checkout`, { offer: "area-lock", postal: "L4C 3G5", term: 3, category: "Physio", business: "Example Studio (test)", email: "owner@example.com", agree: true });
      const aj = (await area.json()) as { status: string; inquire_only?: boolean; checkout_url?: string };
      assert.equal(area.status, 202);
      assert.equal(aj.inquire_only, true);
      assert.equal(aj.checkout_url, undefined);
      assert.equal(called, 0);
      const slot = await post(`${base}/v1/agent/checkout`, { offer: "slot-490", currency: "usd", brand: "Example Brand (test)", email: "buyer@example.com", agree: true });
      const sj = (await slot.json()) as { status: string; amount: number };
      assert.equal(sj.status, "open");
      assert.equal(sj.amount, 490);
      assert.equal(called, 1);
    });
  } finally {
    delete process.env.AREA_LOCK_ENABLED;
    delete process.env.SPONSOR_DEPOSITS_ENABLED;
    delete process.env.STRIPE_SECRET_KEY;
  }
});
