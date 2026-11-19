/** Brand intake → Friday server-to-server proxy: secret only in X-Intake-Secret, never echoed; fallbacks. */
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { createBrandIntakeProxy } from "../src/routes/brandIntakeProxy";

const SECRET = "test-only-not-a-real-secret-value";
const ENV = { FRIDAY_API_URL: "https://friday.example", FRIDAY_API_KEY: SECRET } as NodeJS.ProcessEnv;

async function serve(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch) {
  const app = express();
  app.use(createBrandIntakeProxy({ env, fetchImpl }));
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  return { base, close: () => srv.close() };
}
const realFetch = globalThis.fetch;

test("create forwards to brand-intake-v1 POST with X-Intake-Secret + X-Org-Id; secret never in the response", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, id: "bi_abc12345", status: "draft", version: 0, editToken: "e".repeat(20), reportToken: "r".repeat(20) }), { status: 201 });
  }) as unknown as typeof fetch;
  const s = await serve(ENV, f);
  const r = await realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: ["brand"], company_url: "" }) });
  const text = await r.text();
  s.close();
  assert.equal(r.status, 201);
  assert.equal(calls[0]!.url, "https://friday.example/api/public/brand-intake");
  const h = calls[0]!.init.headers as Record<string, string>;
  assert.equal(h["X-Intake-Secret"], SECRET);
  assert.equal(h["X-Org-Id"], "birchreserve");
  assert.ok(!("Authorization" in h));
  assert.ok(!text.includes(SECRET));
  assert.equal(r.headers.get("cache-control"), "private, no-store");
});

test("PATCH passes X-Edit-Token through; bad ids never reach Friday", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response(JSON.stringify({ ok: true, status: "submitted", version: 1 }), { status: 200 }))) as unknown as typeof fetch;
  const s = await serve(ENV, f);
  const ok = await realFetch(`${s.base}/v1/brand-intake/bi_abc12345`, { method: "PATCH", headers: { "content-type": "application/json", "x-edit-token": "t".repeat(24) }, body: JSON.stringify({ submit: true, email: "a@b.co", website: "b.co", elapsed_ms: 3000 }) });
  const bad = await realFetch(`${s.base}/v1/brand-intake/..%2Fadmin`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
  s.close();
  assert.equal(ok.status, 200);
  assert.equal((calls[0]!.init.headers as Record<string, string>)["X-Edit-Token"], "t".repeat(24));
  assert.equal(bad.status, 404);
  assert.equal(calls.length, 1);
});

test("no Friday config → 503 friday_not_configured (client falls back to its labelled mock)", async () => {
  const s = await serve({} as NodeJS.ProcessEnv, (async () => assert.fail("must not call Friday")) as unknown as typeof fetch);
  const r = await realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  s.close();
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "friday_not_configured");
});

test("brand-intake-v1 not deployed (404) → lead still pushed to Friday /api/intake with the same secret", async () => {
  const pushed: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => (pushed.push({ url: String(url), init }), new Response("{}", { status: 201 }))) as unknown as typeof fetch;
  try {
    const f = (async () => new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404 })) as unknown as typeof fetch;
    const s = await serve(ENV, f);
    const r = await realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: ["brand", "sponsor"], email: "growth@example.com", website: "example.com", submit: true }) });
    const d = await r.json();
    s.close();
    assert.equal(r.status, 202);
    assert.deepEqual([d.fallback, d.lead], ["api_intake", true]);
    assert.equal(pushed[0]!.url, "https://friday.example/api/intake");
    const body = JSON.parse(String(pushed[0]!.init.body));
    assert.equal(body.org, "birchreserve");
    assert.match(body.source, /brand intake/i);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the secret's env names never appear in client sources; the browser only calls same-origin /v1 routes", () => {
  const root = resolve(process.cwd(), "../clinichub-media/src");
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.(ts|tsx)$/.test(n) ? [join(d, n)] : []));
  const all = walk(root).map((f) => readFileSync(f, "utf8")).join("\n");
  assert.ok(!/FRIDAY_API_KEY|INTAKE_WEBHOOK_SECRET|X-Intake-Secret/.test(all), "secret names in client");
  const a = readFileSync(join(root, "lib/fridayBrandIntake.ts"), "utf8");
  assert.ok(!/fridayapp\.org/.test(a), "browser never calls Friday directly");
  assert.match(a, /\/v1\/brand-intake/);
});
