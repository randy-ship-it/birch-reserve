/** Brand intake → Friday server-to-server proxy: secret only in X-Intake-Secret, never echoed; fallbacks. */
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { createBrandIntakeProxy, markTest, publicGates } from "../src/routes/brandIntakeProxy";
import { isIntakeEvent } from "../src/lib/intakeEvents";

const SECRET = "test-only-not-a-real-secret-value";
const ENV = { FRIDAY_API_URL: "https://friday.example", FRIDAY_API_KEY: SECRET } as NodeJS.ProcessEnv;

/** Friday's v1.2 capability probe (GET /api/public/brand-categories) is answered here: 404 = strict v1 (live today). */
async function serve(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch, v12 = false) {
  const app = express();
  app.set("trust proxy", false);
  const wrapped = (async (url: string, init?: RequestInit) =>
    String(url).endsWith("/api/public/brand-categories")
      ? v12 ? new Response(JSON.stringify({ categories: [{ key: "recovery_devices", label: "Recovery Devices & Equipment" }] }), { status: 200 }) : new Response("{}", { status: 404 })
      : fetchImpl(url, init as RequestInit)) as unknown as typeof fetch;
  app.use(createBrandIntakeProxy({ env, fetchImpl: wrapped }));
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

test("v1 404 on a draft (no email) never pushes an anonymous lead", async () => {
  let pushed = 0;
  globalThis.fetch = (async () => (pushed++, new Response("{}", { status: 201 }))) as unknown as typeof fetch;
  try {
    const f = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
    const s = await serve(ENV, f);
    const r = await realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: ["brand"] }) });
    const d = await r.json();
    s.close();
    assert.equal(r.status, 202);
    assert.deepEqual([d.fallback, d.lead, d.draft], ["api_intake", false, "local"]);
    assert.equal(pushed, 0);
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

test("Friday match results never reach the browser (internal only per v1.1 §3)", () => {
  const out = JSON.parse(publicGates(JSON.stringify({ status: "submitted", approvals: { kit: "pending_review" }, partner_match: { status: "linked", partner_name: "Private Clinic" }, existing_hub_partner_lead: true, is_a_hub: true, report: { status: { existing_hub_partner_lead: true }, proposed_deltas: [{ target: "tam" }] } })));
  assert.equal(out.partner_match, undefined);
  assert.equal(out.existing_hub_partner_lead, undefined);
  assert.equal(out.is_a_hub, undefined);
  assert.equal(out.report.status.existing_hub_partner_lead, undefined);
  assert.equal(out.report.proposed_deltas, undefined);
  assert.deepEqual(out.approvals, { kit: "pending_review" });
  assert.ok(!/Private Clinic|linked/.test(JSON.stringify(out)));
});

test("no match badge copy anywhere in the client", () => {
  const dir = resolve(process.cwd(), "../clinichub-media/src");
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.(ts|tsx)$/.test(n) ? [join(d, n)] : []));
  const all = walk(dir).map((f) => readFileSync(f, "utf8")).join("\n").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.ok(!/Linked to an existing hub partner/i.test(all));
});

test("intake funnel events: fixed side/action/detail lists only, so no personal data can ride in an event name", () => {
  assert.ok(isIntakeEvent("intake.advertiser.view.intake"));
  assert.ok(isIntakeEvent("intake.publisher.submit"));
  assert.ok(isIntakeEvent("intake.advertiser.cta_click.look_190"));
  assert.ok(!isIntakeEvent("intake.advertiser.submit.growth_examplebrand_com"));
  assert.ok(!isIntakeEvent("intake.buyer.view"));
  assert.ok(!isIntakeEvent("intake.advertiser.email_typed.email"));
});

test("channel geography: Street Team is Ontario now, Canada later; a US-only brand doesn't see it as available", async () => {
  const { channelEligibility, CHANNEL_GEO } = await import("../src/lib/kitCalc/channelGeo");
  const { advertiserActivation } = await import("../src/lib/kitCalc/activation");
  assert.equal(CHANNEL_GEO.find((c) => c.key === "street-team")!.label, "Ontario now, Canada later");
  assert.equal(channelEligibility("street-team", { sells_in: ["US"], ships_to: ["US"] }), "not_available");
  assert.equal(channelEligibility("street-team", { sells_in: ["CA"], ships_to: ["CA"], regions: ["BC"] }), "later");
  assert.equal(channelEligibility("street-team", { sells_in: ["CA"], ships_to: ["CA"], regions: ["ON"] }), "now");
  for (const k of ["scale-hubs", "calm-joints", "retail-network"] as const) assert.equal(channelEligibility(k, { sells_in: ["US"], ships_to: ["US"] }), "now");
  const a = advertiserActivation([100, 400], { sells_in: ["CA"], ships_to: ["CA"], regions: ["BC"] });
  assert.deepEqual(a.now, { min: 75, max: 300 });
  assert.deepEqual(a.later, { min: 100, max: 400 });
});

test("TEST records: only test@/test+…@silverbirchgrowth.com submissions get the [TEST] blurb", () => {
  assert.match(String((markTest({ email: "test+br-preview@silverbirchgrowth.com" }) as { blurb: string }).blurb), /^\[TEST\]/);
  assert.equal((markTest({ email: "growth@examplebrand.com" }) as { blurb?: string }).blurb, undefined);
});

test("v1.2 body on strict v1 Friday: downgraded BEFORE sending (one call, no retry): no geo/company_name/category/repeat_band, v1 margin alias", async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const f = (async (_url: string, init: RequestInit) => (bodies.push(JSON.parse(String(init.body))), new Response(JSON.stringify({ ok: true, id: "bi_abc12345", status: "draft", version: 0, editToken: "e".repeat(20), reportToken: "r".repeat(20) }), { status: 201 }))) as unknown as typeof fetch;
  const v12 = { roles: ["brand"], geo: { sells: ["US"], ships: ["US"] }, company_name: "Example Co", category: "recovery_devices", calculator: { avg_cart_usd: 80, orders_per_month: 500, purchases_per_year: 2, margin_band: "30_50", repeat_band: "2_3" }, profile: { geography: "Sells in: USA" }, company_url: "" };
  const s1 = await serve(ENV, f);
  const r1 = await realFetch(`${s1.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v12) });
  s1.close();
  assert.equal(r1.status, 201);
  assert.equal(bodies.length, 1);
  for (const k of ["geo", "company_name", "category"]) assert.ok(!(k in bodies[0]!), k);
  assert.deepEqual(bodies[0]!.calculator, { avg_cart_usd: 80, orders_per_month: 500, purchases_per_year: 2, margin_band: "20_40" });
  assert.deepEqual(bodies[0]!.profile, { geography: "Sells in: USA" });
  // Friday on v1.2: the body goes through as sent (Birch margin keys are canonical, repeat_band + category kept).
  const s2 = await serve(ENV, f, true);
  await realFetch(`${s2.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v12) });
  s2.close();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1]!.category, "recovery_devices");
  assert.deepEqual(bodies[1]!.calculator, v12.calculator);
  assert.deepEqual(bodies[1]!.geo, v12.geo);
});

test("X-Client-IP: the visitor IP (first value, validated) goes to Friday server-side; junk is never forwarded", async () => {
  const hs: Array<Record<string, string>> = [];
  const f = (async (_u: string, init: RequestInit) => (hs.push(init.headers as Record<string, string>), new Response(JSON.stringify({ ok: true, id: "bi_abc12345", editToken: "e".repeat(20), reportToken: "r".repeat(20), version: 0 }), { status: 201 }))) as unknown as typeof fetch;
  const s = await serve(ENV, f);
  await realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, body: "{}" });
  await realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "not-an-ip" }, body: "{}" });
  s.close();
  assert.equal(hs[0]!["X-Client-IP"], "203.0.113.7");
  assert.ok(!("X-Forwarded-For" in hs[0]!));
  assert.notEqual(hs[1]!["X-Client-IP"], "not-an-ip");
});

test("v1.1 exposure: US-only brand gets no Street Team now or later; Canada outside Ontario gets a later value", async () => {
  const { mockExposure, readExposure } = await import("../src/lib/kitCalc/activation");
  const us = mockExposure({ sells_in: ["US"], ships_to: ["US"] }).channels.find((c) => c.key === "street_team")!;
  assert.equal(us.eligible_now, false);
  assert.equal(us.now, null);
  assert.equal(us.later, null);
  const bc = mockExposure({ sells_in: ["CA"], ships_to: ["CA"], regions: ["BC"] }).channels.find((c) => c.key === "street_team")!;
  assert.equal(bc.now, null);
  assert.ok(bc.later && bc.later.max > bc.later.min);
  assert.equal(readExposure({ channels: [] }), null);
  assert.equal(readExposure(null), null);
});

test("excluded competing hubs never reach the browser: keys, flagged items and never-mention names are stripped", () => {
  const raw = { report: { hubs: [{ key: "a", name: "Good Hub", fit: 80 }, { key: "b", name: "Rival Hub", excluded: true }, { key: "c", name: "Other", status: "excluded_competes" }, { key: "k", name: "Clairvoyant Hub" }, { key: "kalaya", name: "Kalaya" }], excluded: [{ name: "Rival Hub", reason: "competes" }], excluded_hubs: ["x"], demand_fit: { anchor_hubs: [{ key: "a", name: "Good Hub" }], excluded_count: 2 }, exposure: { channels: [{ key: "hubs", competes: true }] } } };
  const out = publicGates(JSON.stringify(raw));
  assert.doesNotMatch(out, /exclu|compet|Rival|Clairvoyant/i);
  const o = JSON.parse(out);
  assert.deepEqual(o.report.hubs.map((h: { key: string }) => h.key), ["a", "kalaya"]); // Kalaya may be named (Randy 11:34 PM)
  assert.equal(o.report.demand_fit.anchor_hubs.length, 1);
});

test("retail copy reads exactly '120+ retail locations · 1MM+ recovery customers · Canada + USA' everywhere", async () => {
  const { RETAIL_COPY, CHANNEL_TILES, EXPOSURE_CHANNELS } = await import("../src/lib/overhaul/brandIntake");
  assert.equal(RETAIL_COPY, "120+ retail locations · 1MM+ recovery customers · Canada + USA");
  assert.equal(CHANNEL_TILES.find((t) => t.key === "retail-network")!.line, RETAIL_COPY);
  assert.equal(EXPOSURE_CHANNELS.find((t) => t.key === "retail-network")!.reach, RETAIL_COPY);
  assert.doesNotMatch(JSON.stringify([CHANNEL_TILES, EXPOSURE_CHANNELS]), /across Canada/);
});

/* ---------------- 10:35 PM leak regression: drafts / autosave / PATCH never reach /api/intake ---------------- */
test("drafts, autosaves and PATCHes NEVER call Friday /api/intake, even when brand-intake v1 is missing (404)", async () => {
  const intake: string[] = [];
  globalThis.fetch = (async (url: string) => (intake.push(String(url)), new Response("{}", { status: 201 }))) as unknown as typeof fetch;
  try {
    const f = (async () => new Response(JSON.stringify({ ok: false, error: "not_found" }), { status: 404 })) as unknown as typeof fetch;
    const s = await serve(ENV, f);
    const post = (b: unknown) => realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    const patch = (b: unknown) => realFetch(`${s.base}/v1/brand-intake/bi_abc12345`, { method: "PATCH", headers: { "content-type": "application/json", "x-edit-token": "t".repeat(24) }, body: JSON.stringify(b) });
    const drafts = [
      {}, // first autosave create
      { roles: ["brand"], calculator: { avg_cart_usd: 80 } },
      { roles: ["brand"], email: "", submit: true }, // empty email
      { roles: ["brand"], email: "   ", submit: true },
      { roles: ["brand"], email: "not-an-email", submit: true },
      { roles: ["brand"], email: "growth@example.com" }, // email but not a submit (autosave after typing)
      { roles: ["brand"], email: "growth@example.com", submit: false },
      { roles: ["brand"], email: "growth@example.com", submit: "true" },
      { roles: ["publisher"], website: "example.com", submit: true }, // submit without email
    ];
    for (const d of drafts) {
      const r = await post(d);
      const j = await r.json();
      assert.equal(j.lead, false, JSON.stringify(d));
    }
    for (const d of [...drafts, { roles: ["brand"], email: "growth@example.com", submit: true }]) await patch(d); // PATCH never falls back, even a full submit
    await realFetch(`${s.base}/v1/brand-intake/bi_abc12345/kit`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "growth@example.com" }) });
    await realFetch(`${s.base}/v1/brand-kit/download`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reportToken: "r".repeat(20), format: "pdf" }) });
    s.close();
    assert.deepEqual(intake.filter((u) => /\/api\/intake/.test(u)), []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("sendIntake itself refuses a brand_intake draft or an email-less record (defence in depth)", async () => {
  const { sendIntake } = await import("../src/lib/overhaul/fridayIntake");
  let called = 0;
  globalThis.fetch = (async () => (called++, new Response("{}", { status: 201 }))) as unknown as typeof fetch;
  try {
    assert.equal((await sendIntake({ kind: "brand_intake", path: "/intake", meta: { submitted: false } }, ENV)).status, "skipped");
    assert.equal((await sendIntake({ kind: "brand_intake", email: "growth@example.com", path: "/intake", meta: { submitted: false } }, ENV)).status, "skipped");
    assert.equal((await sendIntake({ kind: "brand_intake", email: "", path: "/intake", meta: { submitted: true } }, ENV)).status, "skipped");
    assert.equal(called, 0);
    assert.equal((await sendIntake({ kind: "brand_intake", email: "growth@example.com", path: "/intake", meta: { submitted: true } }, ENV)).status, "sent");
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("v1.3 fast mode: website+email required (nothing sent otherwise); strict Friday → fast_unsupported; fast PATCH never forwarded", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let mode: "v13" | "strict" = "strict";
  const f = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body ?? "{}"));
    calls.push({ url, body });
    if (mode === "strict" && "submit_mode" in body) return new Response(JSON.stringify({ ok: false, error: "invalid", issues: [{ path: "submit_mode" }] }), { status: 400 });
    return new Response(JSON.stringify({ ok: true, id: "bi_abc12345", editToken: "e".repeat(20), reportToken: "r".repeat(20), version: 1, submit_mode: "fast", autofill: { fields: {}, needs_input: ["avg_cart_usd"] } }), { status: 201 });
  }) as unknown as typeof fetch;
  const s = await serve(ENV, f, true);
  const post = (b: unknown) => realFetch(`${s.base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const r0 = await post({ submit_mode: "fast", website: "example.com" });
  assert.equal(r0.status, 400);
  assert.equal((await r0.json()).error, "fast_needs_website_email");
  assert.equal(calls.length, 0);
  const r1 = await post({ submit_mode: "fast", website: "example.com", email: "growth@example.com" });
  assert.equal(r1.status, 409);
  assert.equal((await r1.json()).error, "fast_unsupported");
  assert.equal(calls[0]!.body.submit, true);
  mode = "v13";
  const r2 = await post({ submit_mode: "fast", website: "example.com", email: "growth@example.com" });
  assert.equal(r2.status, 201);
  assert.equal((await r2.json()).submit_mode, "fast");
  const n = calls.length;
  const p = await realFetch(`${s.base}/v1/brand-intake/bi_abc12345`, { method: "PATCH", headers: { "content-type": "application/json", "x-edit-token": "t".repeat(24) }, body: JSON.stringify({ submit_mode: "fast" }) });
  s.close();
  assert.equal(p.status, 400);
  assert.equal((await p.json()).error, "fast_create_only");
  assert.equal(calls.length, n);
});
