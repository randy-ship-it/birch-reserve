/** Hub matching rules (Randy via Emma, Nov 19 2026 10:21 AM ET): no competing hubs, service hubs first for product brands. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { matchHubs, visibleHubs, brandProfile, HUB_PROFILES } from "../src/lib/overhaul/hubMatch";
import { PROPOSED_ANCHOR_HUBS } from "../src/lib/overhaul/brandIntake";

const ALL = Object.keys(HUB_PROFILES);
const shown = (d: ReturnType<typeof matchHubs>) => d.filter((x) => !x.hidden).map((x) => x.key);
const hidden = (d: ReturnType<typeof matchHubs>) => d.filter((x) => x.hidden).map((x) => x.key);

test("Hyperice.ca (product, recovery devices): DR-HO'S and Roll Recovery hidden (flagged, not deleted); service hubs first", () => {
  const d = matchHubs(ALL, { domain: "https://www.hyperice.ca/" });
  assert.equal(d.length, ALL.length, "conflicts stay in the list, flagged");
  assert.ok(hidden(d).includes("dr-ho") && hidden(d).includes("roll-recovery"));
  assert.match(d.find((x) => x.key === "dr-ho")!.reason ?? "", /same SKUs/);
  const vis = shown(d);
  assert.ok(vis.includes("effortless-admin"));
  const firstProduct = d.findIndex((x) => !x.hidden && x.kind === "product");
  const lastService = d.map((x) => !x.hidden && x.kind === "service").lastIndexOf(true);
  assert.ok(firstProduct === -1 || lastService < firstProduct, "service hubs come before any product hub");
  assert.ok(!vis.includes("dr-ho"));
});

test("approver can unflag a hidden hub for one brand", () => {
  const d = matchHubs(ALL, { domain: "hyperice.ca", approved: ["dr-ho"] });
  const dr = d.find((x) => x.key === "dr-ho")!;
  assert.deepEqual([dr.hidden, dr.approved], [false, true]);
});

test("service brand chasing hormonal / GLP-1 leads never sees a service hub chasing the same leads", () => {
  const d = matchHubs(ALL, { category: "digital_health_telehealth" });
  const b = brandProfile({ category: "digital_health_telehealth" });
  assert.equal(b.kind, "service");
  for (const k of ["jill-health", "jack-health"]) assert.ok(hidden(d).includes(k), `${k} hidden`);
  assert.equal(d.find((x) => !x.hidden)!.kind, "product", "product hubs first for a service brand");
});

test("unknown brand (not confident) → service hubs only", () => {
  const d = matchHubs(ALL, { domain: "unknown-brand.example" });
  assert.ok(shown(d).every((k) => HUB_PROFILES[k]!.kind === "service"));
  assert.ok(hidden(d).length > 0);
});

test("visibleHubs keeps Friday's unknown hubs in place, drops Friday-flagged and conflicting ones", () => {
  const list = [{ key: "dr-ho" }, { key: "friday-only-hub" }, { key: "effortless-admin" }, { key: "sole", competes: true }];
  const v = visibleHubs(list, { domain: "hyperice.ca" }).map((h) => h.key);
  assert.ok(!v.includes("dr-ho") && !v.includes("sole"));
  assert.deepEqual(v, ["effortless-admin", "friday-only-hub"]);
});

test("every proposed anchor hub has a profile (rules cover the whole Birch list)", () => {
  for (const h of PROPOSED_ANCHOR_HUBS) assert.ok(HUB_PROFILES[h.key], h.key);
});
