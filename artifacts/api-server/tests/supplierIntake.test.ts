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
import { brandFromParam, hubSlugOf, SUPPLIER_FEES } from "../../clinichub-media/src/pages/br/intake-supplier";
import { supplierAliasHref } from "../../clinichub-media/src/pages/br/intake";

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
  assert.equal(supplierAliasHref("?role=supplier&brand=crossover-symmetry"), "/intake/supplier?brand=crossover-symmetry");
  assert.equal(supplierAliasHref("?role=supplier"), "/intake/supplier");
  assert.equal(supplierAliasHref(""), null, "plain /intake unchanged");
  assert.equal(supplierAliasHref("?resume=demo&mock=1"), null);
  assert.equal(SUPPLIER_FEES.standUpUsd, 5000);
  assert.deepEqual(SUPPLIER_FEES.lines.map((l) => l.v), ["10%", "~35%"]);
});

test("supplier page copy: hard rules", () => {
  const c = readFileSync(resolve(process.cwd(), "../clinichub-media/src/pages/br/intake-supplier.tsx"), "utf8");
  const visible = c.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const bad of [/\bAlign\b/i, /clairvoyant/i, /alset/i, /80 locations/i, /medvibe/i, /friday/i, /integrity/i, /signed partners/i, /\bpublisher\b(?!")/i, /\badvertiser\b(?!")/i, /\bCAD\b/, /guarantee/i, /\bROAS\b/, /\bCTR\b/, /\bdeposit\b/i, /not taken/i, /\b0 (sold|signed|holds?)\b/i]) {
    assert.ok(!bad.test(visible.replace(/fridayIntake|fridayBrandIntake|fridayV12|FRIDAY_CATEGORIES|"advertiser"|"publisher"/g, "")), `found ${bad}`);
  }
  assert.match(visible, /Your hub is created and goes live once our team approves it\./);
  assert.match(visible, /RETAIL_COPY/);
});
