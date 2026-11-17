import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as A from "../src/lib/overhaul/audiences";
import { OVERHAUL_ROUTES } from "../src/lib/overhaul/seo";
import { PUBLIC_SITEMAP_PATHS, SPA_SHELL_PATHS } from "../src/lib/publicSeo";

const page = readFileSync(resolve(process.cwd(), "../clinichub-media/src/pages/br/audiences.tsx"), "utf8");
const data = readFileSync(resolve(process.cwd(), "src/lib/overhaul/audiences.ts"), "utf8");
const all = page + data;

test("copy rules: no order or partner counts (Nov 16 2026), no 8.7mm, no AI matching, no gross profit, no phone numbers", () => {
  assert.doesNotMatch(A.AUDIENCE_SNAPSHOT.ordersLine, /\d/);
  assert.doesNotMatch(page, /20\s*mm|listed partner/i);
  assert.doesNotMatch(all, /8\.7\s*mm/i);
  assert.doesNotMatch(page, /\bAI\b|machine learning|algorithm/i);
  assert.doesNotMatch(all, /gross profit/i);
  assert.doesNotMatch(page, /\(\d{3}\)\s?\d{3}-\d{4}|\btel:/);
});

test("every segment profile carries a basis and shares add up", () => {
  for (const s of A.SEGMENTS) assert.ok(["measured", "modelled", "estimated"].includes(s.profileBasis));
  assert.equal(A.REGION_MIX.reduce((a, r) => a + r.pct, 0), 100);
  assert.equal(A.ARRIVAL_MIX.reduce((a, r) => a + r.pct, 0), 100);
  assert.ok(A.SEGMENTS.some((s) => s.pillar === "Sleep"));
});

test("route is registered for crawlers and the sitemap", () => {
  assert.ok(OVERHAUL_ROUTES["/audiences"]);
  assert.ok((SPA_SHELL_PATHS as readonly string[]).includes("/audiences"));
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/audiences"));
});

test("formatters", () => {
  assert.equal(A.fmtOrdersShort(6_068_909), "~6.1MM");
  assert.equal(A.fmtOrdersShort(65_880), "~66K");
  assert.equal(A.fmtPctBand(0.015, 0.04), "1.5%–4%");
  assert.equal(A.fmtPctBand(0.0025, 0.006), "0.25%–0.6%");
});

test("sample benefits profile is labelled sample, has no named partners, and stays aggregated", () => {
  const profile = readFileSync(resolve(process.cwd(), "src/lib/overhaul/sampleBenefitsProfile.ts"), "utf8");
  const component = readFileSync(resolve(process.cwd(), "../clinichub-media/src/components/br/sample-benefits-profile.tsx"), "utf8");
  const subpage = readFileSync(resolve(process.cwd(), "../clinichub-media/src/pages/br/sample-profile.tsx"), "utf8");
  const all = page + profile + component + subpage;
  assert.match(component, /SAMPLE_PROFILE_BADGE/);
  assert.match(profile, /Sample profile, illustrative/);
  assert.match(profile, /Benefits partner \(sample\)/);
  assert.match(profile, /No customer-level data is ever shared with brands/);
  assert.doesNotMatch(all, /effortless|\bmint\b/i);
  assert.doesNotMatch(all, /8\.7\s*mm/i);
  assert.doesNotMatch(profile, /\bAI\b|ad-matching/);
  assert.ok((SPA_SHELL_PATHS as readonly string[]).includes("/audiences/sample-profile"));
  assert.ok(OVERHAUL_ROUTES["/audiences/sample-profile"]);
  assert.ok(page.includes("SampleBenefitsProfile"));
});

test("market context (Nov 16 2026): every public-research figure is cited, dated and framed as population context, not Birch reach", () => {
  assert.ok(A.MARKET_CONTEXT.length >= 3);
  for (const m of A.MARKET_CONTEXT) {
    assert.match(m.url, /^https:\/\//);
    assert.ok(m.source.length > 10 && /\d{4}/.test(m.year), m.key);
    assert.doesNotMatch(m.line + m.stat, /Birch|our (audience|reach|network)|guarantee|reach(es)? \d/i, m.key);
  }
  assert.match(page, /data-testid="market-context"/);
  assert.match(page, /not the size of our audience, our reach or what a campaign will deliver/);
  assert.ok(A.SOURCES.some((s) => /Public research/.test(s.source)));
});

test("market context (Nov 17 2026): queued categories added with citations; Pets marked in queue", () => {
  for (const k of ["fruit-veg", "pets-ca", "pets-us"]) assert.ok(A.MARKET_CONTEXT.some((m) => m.key === k), k);
  assert.ok(A.MARKET_CONTEXT.filter((m) => /Pets/.test(m.pillar)).every((m) => /in queue/.test(m.pillar)));
  assert.equal(new Set(A.MARKET_CONTEXT.map((m) => m.key)).size, A.MARKET_CONTEXT.length);
});
