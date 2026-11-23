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

test("market context (Nov 18 2026): Longevity and Medi/Spa added with citations; Medi/Spa marked in queue", () => {
  for (const k of ["age-65-ca", "spa-visits-us"]) assert.ok(A.MARKET_CONTEXT.some((m) => m.key === k), k);
  const spa = A.MARKET_CONTEXT.find((m) => m.key === "spa-visits-us")!;
  assert.match(spa.pillar, /in queue/);
  assert.match(spa.url, /^https:\/\/experienceispa\.com\//);
  const age = A.MARKET_CONTEXT.find((m) => m.key === "age-65-ca")!;
  assert.match(age.url, /^https:\/\/www150\.statcan\.gc\.ca\//);
  assert.equal(age.stat, "20.0%");
  assert.equal(new Set(A.MARKET_CONTEXT.map((m) => m.key)).size, A.MARKET_CONTEXT.length);
});

test("market context (Nov 19 2026): Sleep 65+ and Medi/Spa added with citations; segment cards show cited context and a match CTA", () => {
  for (const k of ["sleep-65-ca", "screens-before-sleep", "medspa-us"]) assert.ok(A.MARKET_CONTEXT.some((m) => m.key === k), k);
  assert.match(A.MARKET_CONTEXT.find((m) => m.key === "medspa-us")!.pillar, /in queue/);
  assert.match(A.MARKET_CONTEXT.find((m) => m.key === "medspa-us")!.url, /^https:\/\/www\.americanmedspa\.org\//);
  assert.equal(new Set(A.MARKET_CONTEXT.map((m) => m.key)).size, A.MARKET_CONTEXT.length);
  for (const s of A.SEGMENTS) if (s.marketKey) assert.ok(A.segmentContext(s), `${s.key} -> ${s.marketKey}`);
  assert.ok(A.SEGMENTS.filter((s) => s.marketKey).length >= 3);
  assert.match(page, /segment-context-\$\{s\.key\}/);
  assert.match(page, /population-level, not our reach/);
  assert.match(page, /\/match\?audience=\$\{s\.key\}/);
  const match = readFileSync(resolve(process.cwd(), "../clinichub-media/src/pages/br/match.tsx"), "utf8");
  assert.match(match, /matchPrefill\(/);
  const p = A.matchPrefill("sleep")!;
  assert.equal(p.name, "Sleep");
  assert.doesNotMatch(p.blurb, /Birch|guarantee|\d/);
  assert.equal(A.matchPrefill("nope"), null);
  assert.equal(A.matchPrefill(null), null);
});

test("Nov 20: racquet and MD-referral cards carry cited, population-level context; no Birch-reach claims", () => {
  for (const k of ["pickleball-ca", "active-adults-ca", "postpartum-ca"]) assert.ok(A.MARKET_CONTEXT.some((m) => m.key === k), k);
  assert.equal(new Set(A.MARKET_CONTEXT.map((m) => m.key)).size, A.MARKET_CONTEXT.length);
  const seg = (k: string) => A.SEGMENTS.find((s) => s.key === k)!;
  assert.equal(A.segmentContext(seg("racquet"))!.key, "pickleball-ca");
  assert.equal(A.segmentContext(seg("md-referral"))!.key, "postpartum-ca");
  assert.ok(A.SEGMENTS.every((s) => A.segmentContext(s)), "every segment card has context");
  for (const k of ["pickleball-ca", "active-adults-ca", "postpartum-ca"]) {
    const m = A.MARKET_CONTEXT.find((x) => x.key === k)!;
    assert.match(m.url, /^https:\/\/(pickleballcanada\.org|www150\.statcan\.gc\.ca|www\.canada\.ca)\//);
    assert.doesNotMatch(m.line, /\b(our|Birch|reach|guarantee)\b/i);
  }
});

test("Nov 23: Physio card carries its own cited PHAC osteoarthritis line; population-level, no Birch-reach words", () => {
  const seg = A.SEGMENTS.find((s) => s.key === "physio")!;
  const m = A.segmentContext(seg)!;
  assert.equal(m.key, "osteoarthritis-ca");
  assert.match(m.url, /^https:\/\/www\.canada\.ca\//);
  assert.doesNotMatch(m.line, /\b(our|Birch|reach|guarantee)\b/i);
  assert.equal(new Set(A.MARKET_CONTEXT.map((x) => x.key)).size, A.MARKET_CONTEXT.length);
});
