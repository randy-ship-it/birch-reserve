/**
 * Randy (Nov 27 2026 7:14 PM ET): the Integrity Fitness example is gone from birchreserve.net and the Scale mirror
 * everywhere. This fails if "Integrity" shows up in user-facing copy, example data, asset names or chat knowledge.
 * Allowed: the never-mention guard in pulseIngest.ts and the unrelated db "marketplace integrity" check (not scanned).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { HUB_LADDER, liveHubs } from "../src/lib/hubLadder";
import { BRAND_HUBS } from "../src/lib/overhaul/model";
import { PROPOSED_ANCHOR_HUBS } from "../src/lib/overhaul/brandIntake";
import { CLINIC_LAYER_POOL, pickClinicLayerExamples } from "../../clinichub-media/src/components/br/clinic-layer-term";

const ROOT = resolve(process.cwd(), "..");
const TEXT = /\.(tsx?|jsx?|mjs|cjs|json|md|txt|html|css|svg|xml)$/i;
const ALLOW = new Set([resolve(ROOT, "api-server/src/lib/pulseIngest.ts")]);
const walk = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === "dist" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const SCAN = ["clinichub-media/src", "clinichub-media/public", "clinichub-media/index.html", "api-server/src"].map((d) => resolve(ROOT, d));
const files = SCAN.flatMap((d) => (statSync(d).isDirectory() ? walk(d) : [d]));

test("no 'Integrity' in user-facing copy, chat knowledge or example data", () => {
  const hits: string[] = [];
  for (const f of files) {
    if (/integrity/i.test(f.slice(ROOT.length))) hits.push(`file name: ${f.slice(ROOT.length)}`);
    if (ALLOW.has(f) || !TEXT.test(f)) continue;
    readFileSync(f, "utf8").split("\n").forEach((line, i) => { if (/integrity/i.test(line)) hits.push(`${f.slice(ROOT.length)}:${i + 1}`); });
  }
  assert.deepEqual(hits, []);
});

test("hub lists and the clinic layer pop-up carry no Integrity, Kalaya or Align example", () => {
  const names = [...HUB_LADDER, ...liveHubs(), ...BRAND_HUBS, ...PROPOSED_ANCHOR_HUBS, ...CLINIC_LAYER_POOL].map((h) => `${h.key} ${h.name}`);
  for (const n of names) assert.doesNotMatch(n, /integrity/i, n);
  for (const x of CLINIC_LAYER_POOL) assert.doesNotMatch(`${x.key} ${x.name} ${x.img}`, /integrity|kalaya|\balign\b/i);
  assert.ok(CLINIC_LAYER_POOL.some((x) => x.key === "dima-lates"), "Dima-lates stays in the pool");
});

test("pop-up rotates: two examples, different pairs across page views", () => {
  const seen = new Set<string>();
  for (let s = 0; s < 40; s++) {
    let x = s + 1; const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
    const pick = pickClinicLayerExamples(2, rand);
    assert.equal(pick.length, 2); assert.notEqual(pick[0]!.key, pick[1]!.key);
    seen.add(pick.map((p) => p.key).sort().join("+"));
  }
  assert.ok(seen.size >= 2, [...seen].join(", "));
});
