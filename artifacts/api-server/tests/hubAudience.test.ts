/**
 * Hub-reported audience profiles (Friday). Uses tests/fixtures/hub-audience.EXAMPLE.json: an EXAMPLE fixture with
 * invented values, because the live feed had 0 hubs with profiles on Nov 18 2026. The fixture is test-only.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";
import fixture from "./fixtures/hub-audience.EXAMPLE.json";
import {
  AUDIENCE_PRICING_RULE,
  audienceMode,
  audienceUpliftPct,
  hubAudiences,
  ioRateGuidance,
  publicSummary,
  sanitizeAudience,
  setHubAudienceSourceForTests,
} from "../src/lib/overhaul/hubAudience";
import { createAgentRouter } from "../src/routes/agent";
import { publicOffers } from "../src/lib/overhaul/agent";
import { SPEC_ROWS } from "../src/lib/overhaul/agencyShowcase";

const FORBIDDEN = ["EXAMPLE Person", "example-person@example.com", "raw free text", "M4W", "M5R", "M6G", "M5V", "416-555", "Ottawa"];

async function withServer(env: Record<string, string | undefined>, fn: (base: string) => Promise<void>) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  setHubAudienceSourceForTests(async () => fixture.records);
  const app = express();
  app.use(createAgentRouter());
  const srv = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${(srv.address() as AddressInfo).port}`);
  } finally {
    srv.close();
    process.env = saved;
    setHubAudienceSourceForTests(null);
  }
}

test("fixture is clearly labelled EXAMPLE", () => {
  assert.match(fixture._EXAMPLE, /^EXAMPLE FIXTURE FOR TESTS ONLY/);
});

test("sanitize keeps aggregates only and drops names, emails, blurbs, postal geography", () => {
  const jill = sanitizeAudience(fixture.records[0]!.audience)!;
  const s = JSON.stringify(jill);
  for (const bad of ["EXAMPLE Person", "example-person@example.com", "raw free text", "submitter", "blurb"]) assert.ok(!s.includes(bad), bad);
  assert.deepEqual(jill.fsas, ["M4W", "M5R", "M6G"]);
  const drho = sanitizeAudience(fixture.records[1]!.audience)!;
  assert.equal(drho.geography, "", "a postal code is not a city/region");
  assert.ok(!JSON.stringify(drho).includes("416-555"));
  assert.equal(sanitizeAudience({ label: "something-else", geography: "Toronto" }), null);
  assert.equal(sanitizeAudience(null), null);
});

test("public summary is one aggregate line and never shows FSAs or sizes", () => {
  const jill = publicSummary(sanitizeAudience(fixture.records[0]!.audience));
  assert.equal(jill, "Mostly women 25–44 · Toronto · $100K+ HHI · also buys sleep, meal kits · hub-reported");
  const drho = publicSummary(sanitizeAudience(fixture.records[1]!.audience))!;
  assert.equal(drho, "Women and men 45+ · $50K–$100K HHI · also buys insoles · hub-reported");
  for (const line of [jill!, drho]) for (const bad of ["M4W", "M5V", "1200", "1,200", "@"]) assert.ok(!line.includes(bad));
  assert.equal(publicSummary(null), null);
});

test("mode flag defaults to private; query override only off production", () => {
  assert.equal(audienceMode({}), "private");
  assert.equal(audienceMode({ VERCEL_ENV: "production" }, "summary"), "private");
  assert.equal(audienceMode({ NODE_ENV: "production" }, "summary"), "private");
  assert.equal(audienceMode({ VERCEL_ENV: "preview", NODE_ENV: "production" }, "summary"), "summary");
  assert.equal(audienceMode({ BIRCH_HUB_AUDIENCE_PUBLIC: "summary", VERCEL_ENV: "production" }), "summary");
  assert.equal(audienceMode({ BIRCH_HUB_AUDIENCE_PUBLIC: "off" }), "private");
});

test("only listed hubs with a profile are matched", async () => {
  setHubAudienceSourceForTests(async () => fixture.records);
  const map = await hubAudiences();
  assert.deepEqual([...map.keys()].sort(), ["dr-ho", "jill-health"]);
  assert.ok(!map.has("sole"), "hub without a profile shows nothing");
  setHubAudienceSourceForTests(async () => {
    throw new Error("feed down");
  });
  assert.equal((await hubAudiences()).size, 0, "feed errors never break the site");
  setHubAudienceSourceForTests(null);
});

test("pricing rule: capped uplift on IO lines only; SKUs unchanged", () => {
  const jill = sanitizeAudience(fixture.records[0]!.audience)!;
  const drho = sanitizeAudience(fixture.records[1]!.audience)!;
  assert.deepEqual(audienceUpliftPct(null), { pct: 0, reasons: [] });
  assert.equal(audienceUpliftPct(jill).pct, 5);
  assert.equal(audienceUpliftPct(jill, "sleep products").pct, 10);
  assert.equal(audienceUpliftPct(drho, "furniture").pct, 0);
  assert.equal(audienceUpliftPct(drho, "insoles").pct, 5);
  assert.ok(audienceUpliftPct(jill, "sleep meal kits supplements").pct <= AUDIENCE_PRICING_RULE.capPct);
  const g = ioRateGuidance(jill, "sleep");
  assert.equal(g.currency, "usd");
  for (const l of g.lines) {
    const row = SPEC_ROWS.find((r) => r.key === l.surface)!;
    assert.equal(l.cpm_from_usd, row.cpmFloorUsd, "published floor unchanged");
    assert.ok(l.io_cpm_usd <= Math.round(row.cpmFloorUsd * 1.1 * 100) / 100 + 0.001);
  }
  assert.deepEqual(publicOffers().map((o) => [o.offer_key, o.price_usd]), [["hold-190", 190], ["reserve-490", 490]]);
});

test("private mode: summaries endpoint empty; quote has audience for pricing but no public line or FSAs", async () => {
  await withServer({ BIRCH_HUB_AUDIENCE_PUBLIC: undefined, VERCEL_ENV: "production" }, async (base) => {
    const s = await (await fetch(`${base}/v1/hubs/audience-summaries?audience_mode=summary`)).json();
    assert.equal(s.mode, "private");
    assert.deepEqual(s.items, []);
    const q = await (await fetch(`${base}/v1/agent/quote?offer=reserve-490&hub=jill-health&category=sleep`)).json();
    assert.equal(q.amount, 490);
    assert.equal(q.currency, "usd");
    assert.equal(q.audience_mode, "private");
    assert.ok(!("public_summary" in q));
    assert.equal(q.hub_audience.fsas_on_file, 3);
    assert.equal(q.io_rate_guidance.uplift_pct, 10);
    const raw = JSON.stringify(q);
    for (const bad of FORBIDDEN) assert.ok(!raw.includes(bad), bad);
    const none = await (await fetch(`${base}/v1/agent/quote?offer=hold-190&hub=sole`)).json();
    assert.equal(none.amount, 190);
    assert.equal(none.hub_audience, null);
    assert.equal(none.io_rate_guidance.uplift_pct, 0);
    const plain = await (await fetch(`${base}/v1/agent/quote?offer=hold-190`)).json();
    assert.ok(!("hub_audience" in plain), "existing quote shape unchanged without ?hub");
  });
});

test("summary mode: one line per profiled hub only, nothing individual", async () => {
  await withServer({ BIRCH_HUB_AUDIENCE_PUBLIC: "summary" }, async (base) => {
    const s = await (await fetch(`${base}/v1/hubs/audience-summaries`)).json();
    assert.equal(s.mode, "summary");
    assert.deepEqual(s.items.map((i: { hub_key: string }) => i.hub_key).sort(), ["dr-ho", "jill-health"]);
    const raw = JSON.stringify(s);
    for (const bad of FORBIDDEN) assert.ok(!raw.includes(bad), bad);
    assert.ok(!/booked|sold|signed|guarantee|CTR|ROAS|CAD/i.test(raw));
    const q = await (await fetch(`${base}/v1/agent/quote?offer=reserve-490&hub=jill-health`)).json();
    assert.match(q.public_summary, /hub-reported$/);
    assert.equal(q.amount, 490);
  });
});

test("the EXAMPLE fixture is never imported by site code", () => {
  const roots = [resolve(process.cwd(), "src"), resolve(process.cwd(), "../clinichub-media/src")];
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|json)$/.test(f) ? [p] : [];
    });
  for (const r of roots) for (const f of walk(r)) assert.ok(!readFileSync(f, "utf8").includes("hub-audience.EXAMPLE"), f);
});
