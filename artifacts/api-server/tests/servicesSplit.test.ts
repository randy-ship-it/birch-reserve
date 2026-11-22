import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { servicesSplit } from "../src/lib/overhaul/servicesNet";
import { SERVICES_SPLIT, PUBLISHER_ASSUMPTIONS } from "../src/lib/overhaul/brandIntake";

test("services split worked example: $150 one-hour session", () => {
  const a = servicesSplit({ revenueUsd: 150, hours: 1 });
  assert.deepEqual([a.labor, a.management, a.net, a.hubNew, a.hubOld], [70, 15, 65, 32.5, 40]);
  const b = servicesSplit({ revenueUsd: 150, hours: 1, managementOn: "grossProfit" });
  assert.deepEqual([b.management, b.net, b.hubNew], [8, 72, 36]);
});

test("public copy says only '50% of net': no labor rate, management cost or net formula in public sources", () => {
  assert.equal(SERVICES_SPLIT.hubPct, 50);
  assert.match(SERVICES_SPLIT.line, /50% of net/);
  const pub = [readFileSync("src/lib/overhaul/brandIntake.ts", "utf8"), readFileSync("../clinichub-media/src/pages/br/intake-publisher.tsx", "utf8")].join("\n");
  assert.doesNotMatch(pub, /labou?r|\$70\b|management (cost|fee)|servicesNet/i);
  assert.doesNotMatch(PUBLISHER_ASSUMPTIONS.join(" "), /labou?r|\$70\b|management|gross profit|revenue minus/i);
  const walk = (d: string): string[] => []; void walk;
  for (const f of ["../clinichub-media/src/pages/br/intake-publisher.tsx", "../clinichub-media/src/components/br/report-views.tsx"]) assert.doesNotMatch(readFileSync(f, "utf8"), /overhaul\/servicesNet/);
});
