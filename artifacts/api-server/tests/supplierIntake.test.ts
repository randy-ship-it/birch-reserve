/** /intake/supplier: own hub request is always pending_approval, stripped before Friday, tagged in blurb + BR leads meta. */
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HUB_PENDING_TAG, createBrandIntakeProxy, hubPendingOf, hubRequestOf, prepareStage, type IntakeLeadEvent } from "../src/routes/brandIntakeProxy";
import { cleanLeadMeta } from "../src/lib/leads";
import { toFridayBody } from "../../clinichub-media/src/lib/fridayBrandIntake";
import { brandFromParam, hubSlugOf, pathsFromParam, presetOf, rolesForPaths, verticalCats, SUPPLIER_FEES, VERTICALS_NOTE } from "../../clinichub-media/src/components/br/supplier-mode";

const ENV = { FRIDAY_API_URL: "https://friday.example", FRIDAY_API_KEY: "test-only-not-a-real-secret-value" } as NodeJS.ProcessEnv;
const HUB = { role: "supplier", status: "pending_approval", hub_name: "Crossover Symmetry", hub_slug: "crossover-symmetry" };

test("hub_request is Birch-only: stripped before Friday, first blurb line tagged pending_approval", () => {
  const p = prepareStage({ roles: ["supplier", "publisher"], email: "a@b.co", submit: true, hub_request: HUB, blurb: "Intake choice: supplier + hub." });
  assert.equal("hub_request" in p.body, false);
  const first = String(p.body.blurb).split("\n")[0]!;
  assert.ok(first.startsWith(HUB_PENDING_TAG));
  assert.match(first, /role=supplier status=pending_approval hub_slug=crossover-symmetry hub_name="Crossover Symmetry"/);
  assert.match(first, /Randy or Jon/);
  assert.deepEqual(hubPendingOf(p.body), { hub_status: "pending_approval", hub_slug: "crossover-symmetry" });
  // idempotent on re-submit of an already-tagged blurb
  const again = prepareStage({ ...p.body, hub_request: HUB });
  assert.equal(String(again.body.blurb).split(HUB_PENDING_TAG).length - 1, 1);
});

test("the browser can never approve: status is always pending_approval; bad slugs dropped; non-supplier ignored", () => {
  assert.equal(hubRequestOf({ ...HUB, status: "approved" })!.status, "pending_approval");
  assert.equal(hubRequestOf({ ...HUB, hub_slug: "../x" })!.hub_slug, null);
  assert.equal(hubRequestOf({ ...HUB, role: "publisher" }), null);
  assert.equal(hubRequestOf("x"), null);
  assert.equal(prepareStage({ roles: ["brand"] }).body.blurb, undefined, "plain /intake bodies are untouched");
});

test("client body carries hub_request only for the supplier page", () => {
  const base = { schema: "birch-brand-intake/v1-draft", role: "supplier", site: "birchreserve.net", terms_version: "t" } as const;
  assert.equal(toFridayBody({ ...base }).hub_request, undefined);
  const b = toFridayBody({ ...base, roles: ["supplier", "publisher"], hub_request: { role: "supplier", status: "pending_approval", hub_name: "Crossover Symmetry", hub_slug: "crossover-symmetry" } });
  assert.deepEqual(b.hub_request, { role: "supplier", status: "pending_approval", hub_name: "Crossover Symmetry", hub_slug: "crossover-symmetry" });
});

test("fast submit: Friday never sees hub_request; BR leads event carries pending hub + /intake/supplier path", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const leads: IntakeLeadEvent[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/api/public/brand-categories")) return new Response("{}", { status: 404 });
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify({ ok: true, id: "bi_abc12345", status: "submitted", version: 1, editToken: "e".repeat(20), reportToken: "r".repeat(20), approvals: { review: "pending_review" } }), { status: 201 });
  }) as unknown as typeof fetch;
  const app = express();
  app.use(createBrandIntakeProxy({ env: ENV, fetchImpl: f, recordLead: async (e) => void leads.push(e) }));
  const srv = app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const r = await fetch(`${base}/v1/brand-intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: ["supplier", "publisher"], company_url: "", email: "test+cs@silverbirchgrowth.com", website: "crossoversymmetry.com", submit_mode: "fast", submit: true, hub_request: HUB }) });
  await r.text();
  await new Promise((res) => setTimeout(res, 20));
  srv.close();
  const body = sent.find((b) => "roles" in b)!;
  assert.ok(body, "forwarded");
  assert.equal("hub_request" in body, false);
  assert.ok(String(body.blurb).includes(HUB_PENDING_TAG), String(body.blurb));
  assert.equal(leads.length, 1);
  assert.equal(leads[0]!.path, "/intake/supplier");
  assert.deepEqual(leads[0]!.hub, { hub_status: "pending_approval", hub_slug: "crossover-symmetry" });
});

test("BR leads meta keeps intake_role / hub_status / hub_slug", () => {
  assert.deepEqual(cleanLeadMeta({ intake_role: "supplier", hub_status: "pending_approval", hub_slug: "crossover-symmetry", junk: 1 }), { intake_role: "supplier", hub_status: "pending_approval", hub_slug: "crossover-symmetry" });
});

test("brand prefill, slug, alias, fees", () => {
  assert.equal(brandFromParam("crossover-symmetry"), "Crossover Symmetry");
  assert.equal(brandFromParam("Crossover Symmetry"), "Crossover Symmetry");
  assert.equal(brandFromParam(null), "");
  assert.equal(hubSlugOf("Crossover Symmetry"), "crossover-symmetry");
  assert.equal(presetOf("?role=supplier&brand=crossover-symmetry"), "supplier");
  assert.equal(presetOf(""), undefined, "plain /intake unchanged");
  assert.equal(presetOf("?resume=demo&mock=1"), undefined);
  // paths (Nov 26 2026): pick some or all; nothing forced on; display / ads → kit; nothing picked → supplier
  assert.deepEqual(pathsFromParam(""), { supply: true, hub: false, display: false, ads: false });
  assert.deepEqual(pathsFromParam("hub,ads,bogus"), { supply: false, hub: true, display: false, ads: true });
  assert.deepEqual(rolesForPaths({ supply: true, hub: true, display: true, ads: false }), ["supplier", "publisher", "kit"]);
  assert.deepEqual(rolesForPaths({ supply: false, hub: false, display: false, ads: true }), ["kit"]);
  assert.deepEqual(rolesForPaths({ supply: false, hub: false, display: false, ads: false }), ["supplier"]);
  assert.deepEqual(verticalCats(["recovery", "nutrition"]), ["recovery_devices", "sports_nutrition"]);
  assert.match(VERTICALS_NOTE, /recovery-focused today/);
  assert.ok(!/\b20\d\d\b|soon|by (q\d|spring|summer|fall|winter)/i.test(VERTICALS_NOTE), "no timelines");
  assert.equal(SUPPLIER_FEES.standUpUsd, 5000);
  assert.deepEqual(SUPPLIER_FEES.lines.map((l) => l.v), ["10%", "~35%"]);
});

test("supplier preset copy: hard rules; /intake/supplier is the shared intake, not a separate form", () => {
  const page = readFileSync(resolve(process.cwd(), "../clinichub-media/src/pages/br/intake-supplier.tsx"), "utf8");
  assert.match(page, /<BrIntake preset="supplier" \/>/);
  assert.match(readFileSync(resolve(process.cwd(), "../clinichub-media/src/components/br/intake-short-form.tsx"), "utf8"), /preset\?: IntakePreset/);
  const c = readFileSync(resolve(process.cwd(), "../clinichub-media/src/components/br/supplier-mode.tsx"), "utf8");
  const visible = c.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const bad of [/\bAlign\b/i, /clairvoyant/i, /alset/i, /80 locations/i, /medvibe/i, /friday/i, /integrity/i, /\bsigned partners\b/i, /\bpublisher\b(?!")/i, /\badvertiser\b(?!")/i, /\bCAD\b/, /guarantee/i, /\bROAS\b/, /\bCTR\b/, /\bdeposit\b/i, /not taken/i, /\b0 (sold|signed|holds?)\b/i]) {
    assert.ok(!bad.test(visible.replace(/fridayIntake|fridayBrandIntake|fridayV12|FRIDAY_CATEGORIES|"advertiser"|"publisher"/g, "")), `found ${bad}`);
  }
  assert.match(visible, /Your clinic layer is created and goes live once our team approves it\./);
  for (const t of ["Supply", "Your own clinic layer", "Display / CPC", "Ads only", "200+ brick-and-mortar locations", "Needed for max CPC exposure"]) assert.ok(visible.includes(t), t);
  assert.ok(!/Start performance-only/.test(readFileSync(resolve(process.cwd(), "../clinichub-media/src/pages/br/intake.tsx"), "utf8")), "no forced 'say you are a supplier' step");
});

test("network figures (2:27 PM): shared constants site-wide, no homes figure, no override", async () => {
  const bi = await import("../src/lib/overhaul/brandIntake");
  const act = await import("../src/lib/kitCalc/activation");
  assert.equal(bi.RETAIL_COPY, "200+ locations, 500+ soon · 1MM+ captive recovery consumers · Canada + USA");
  assert.equal(bi.RETAIL_TAG, "private network of digital and brick-and-mortar fitness & recovery retailers");
  assert.equal(bi.AUDIENCE_LINE, "~128MM modelled page views a month (estimate) · 200+ retail locations (500+ soon) with 1MM+ captive recovery consumers · 1MM+ consumers now through our provider network and Street Team, expanding to an estimated 3MM+ in 2027");
  assert.equal(bi.STREET_REACH_LINE, "reaching 1MM+ consumers now, expanding to an estimated 3MM+ in 2027");
  const s = JSON.stringify([bi.CHANNEL_TILES, bi.EXPOSURE_CHANNELS, act]);
  assert.ok(!/500K|homes in reach/.test(s));
  assert.match(s, /500\+ soon/);
  assert.match(s, /1MM\+ consumers now, 3MM\+ est\. in 2027/);
  assert.ok(!/\bAlign\b/i.test(s));
  const fs = await import("node:fs");
  assert.ok(!fs.existsSync(`${process.cwd()}/../clinichub-media/src/lib/networkCopy.tsx`), "supplier-only override removed");
});
