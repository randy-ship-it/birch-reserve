import assert from "node:assert/strict";
import { test } from "node:test";
import { STREET_TEAM, STREET_TEAM_BUDGET, STREET_TEAM_FACT, STREET_TEAM_LLMS, STREET_TEAM_TIERS, STREET_TEAM_TODAY } from "../src/lib/overhaul/streetTeam";
import { OVERHAUL_ROUTES } from "../src/lib/overhaul/seo";
import { PUBLIC_SITEMAP_PATHS } from "../src/lib/publicSeo";

const ALL = JSON.stringify([STREET_TEAM, STREET_TEAM_TIERS, STREET_TEAM_TODAY, STREET_TEAM_FACT, STREET_TEAM_LLMS, STREET_TEAM_BUDGET]);

test("street team copy rules (Nov 21 2026)", () => {
  assert.equal(STREET_TEAM_TIERS.length, 3);
  assert.doesNotMatch(ALL, /\b(gig|uber|on-demand|on demand|align|clairvoyant|alset|medvibe|friday)\b/i);
  assert.doesNotMatch(ALL, /\b(guarantee[ds]? (impressions|ctr|roas)|slots? (is|are) open)\b/i);
  assert.match(STREET_TEAM.minimum, /minimum campaign size applies/i);
  assert.match(STREET_TEAM_TODAY.sub, /Calm Joints/);
  assert.match(STREET_TEAM_TODAY.sub, /Scale Health street team/);
  assert.match(STREET_TEAM.outside, /2027/);
  assert.doesNotMatch(JSON.stringify([STREET_TEAM, STREET_TEAM_FACT]), /minimum (of )?\$/i);
});

test("street team routes: meta + sitemap", () => {
  assert.ok(OVERHAUL_ROUTES["/street-team"]);
  assert.ok(OVERHAUL_ROUTES["/intake/street-team"]);
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/street-team"));
  assert.ok(!(PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/intake/street-team"));
});
