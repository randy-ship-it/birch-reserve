// node --test scripts/stripe-test-setup.test.mjs  (no network: fetch is stubbed)
import test from "node:test";
import assert from "node:assert/strict";
import { run, assertTestKey, PRICES } from "./stripe-test-setup.mjs";

function fakeStripe({ live = false } = {}) {
  const st = { prices: [], hooks: [], vercel: [], calls: [] };
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); const m = init.method ?? "GET"; st.calls.push(`${m} ${u.host}${u.pathname}`);
    const body = init.body ? Object.fromEntries(new URLSearchParams(init.body)) : {};
    const ok = (j) => ({ ok: true, status: 200, json: async () => ({ livemode: live, ...j }), text: async () => "" });
    if (u.host === "api.vercel.com") { st.vercel.push(JSON.parse(init.body)); return ok({}); }
    if (u.pathname === "/v1/prices" && m === "GET") return ok({ data: st.prices });
    if (u.pathname === "/v1/prices" && m === "POST") { const p = { id: `price_${st.prices.length + 1}`, lookup_key: body.lookup_key, unit_amount: Number(body.unit_amount), currency: body.currency, livemode: live }; st.prices.push(p); return ok(p); }
    if (u.pathname === "/v1/webhook_endpoints" && m === "GET") return ok({ data: st.hooks });
    if (u.pathname === "/v1/webhook_endpoints" && m === "POST") { const h = { id: `we_${st.hooks.length + 1}`, url: body.url, enabled_events: new URLSearchParams(init.body).getAll("enabled_events[]"), secret: "whsec_fake_secret_value", livemode: live }; st.hooks.push(h); return ok(h); }
    throw new Error(`unexpected ${m} ${url}`);
  };
  return { st, fetchImpl };
}
const ENV = { STRIPE_SECRET_KEY: "sk_test_fake", VERCEL_TOKEN: "vt" };
const ARGS = ["--webhook-url", "https://birch-reserve-git-x-sbg.vercel.app/api/stripe/webhook"];

test("refuses live keys and the production host", async () => {
  assert.throws(() => assertTestKey("sk_live_abc"), /not a TEST key/);
  assert.throws(() => assertTestKey(undefined), /not set/);
  await assert.rejects(run(ARGS, { STRIPE_SECRET_KEY: "sk_live_x" }, { log: () => {} }), /not a TEST key/);
  await assert.rejects(run(["--webhook-url", "https://birchreserve.net/api/stripe/webhook"], ENV, { log: () => {} }), /production host/);
});

test("dry run changes nothing", async () => {
  const { st, fetchImpl } = fakeStripe();
  await run(ARGS, ENV, { fetchImpl, log: () => {} });
  assert.ok(st.calls.every((c) => c.startsWith("GET ")));
  assert.equal(st.vercel.length, 0);
});

test("apply creates prices + webhook once, sets Preview envs only, and is idempotent; never prints the secret", async () => {
  const { st, fetchImpl } = fakeStripe();
  const lines = [];
  await run([...ARGS, "--apply", "--git-branch", "x"], ENV, { fetchImpl, log: (l) => lines.push(l) });
  assert.equal(st.prices.length, PRICES.length);
  assert.equal(st.hooks.length, 1);
  assert.ok(st.vercel.every((v) => JSON.stringify(v.target) === '["preview"]' && v.gitBranch === "x"));
  assert.ok(st.vercel.some((v) => v.key === "STRIPE_WEBHOOK_SECRET"));
  assert.ok(!lines.join("\n").includes("whsec_fake_secret_value"));
  st.vercel.length = 0;
  await run([...ARGS, "--apply"], ENV, { fetchImpl, log: () => {} });
  assert.equal(st.prices.length, PRICES.length); // reused
  assert.equal(st.hooks.length, 1); // reused
  assert.ok(!st.vercel.some((v) => v.key === "STRIPE_WEBHOOK_SECRET")); // unchanged unless rotated
});

test("aborts if Stripe ever answers livemode=true", async () => {
  const { fetchImpl } = fakeStripe({ live: true });
  await assert.rejects(run([...ARGS, "--apply"], ENV, { fetchImpl, log: () => {} }), /livemode=true/);
});
