/** Ad activation (Nov 21 2026): validation, lead row + meta, Friday payload, /ads/admin filter + internal roll-up, route. */
import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ACT_EXCLUSIONS, ACT_OPENNESS, ACT_REVIEW_NOTE, activationMeta, activationSummary, isNonCore, parseActivation } from "../src/lib/overhaul/adActivation";
import { MemoryLeadStore, cleanLeadMeta, setLeadStoreForTests } from "../src/lib/leads";
import { buildFridayPayload } from "../src/lib/fridayPush";
import { activationAdminHtml, activationRollup } from "../src/lib/adserver/activationAdmin";
import { createOverhaulRouter } from "../src/routes/overhaul";

const OK = { role: "supplier", pages: "50-250", views: "25-100k", list: "1-10k", openness: "premium", exclusions: ["alcohol", "gambling"], other: "receipt inserts", ack: true };

test("parse: ranges, openness and exclusions are validated; ack required; exclusions dropped when curated", () => {
  const r = parseActivation(OK);
  assert.ok(r.ok && r.v.exclusions.join() === "alcohol,gambling");
  assert.equal(parseActivation({ ...OK, ack: false }).ok, false, "review acknowledgement required");
  assert.equal(parseActivation({ ...OK, pages: "12345" }).ok, false, "exact numbers are not accepted");
  assert.equal(parseActivation({ ...OK, openness: "all" }).ok, false);
  assert.equal(parseActivation({ ...OK, exclusions: ["alcohol", "rm -rf"] }).ok, false);
  assert.equal(parseActivation({ ...OK, other: "x".repeat(400) }).ok, false);
  const c = parseActivation({ ...OK, openness: "curated" });
  assert.ok(c.ok && c.v.exclusions.length === 0);
  assert.deepEqual(ACT_OPENNESS.map((o) => o.label), ["Curated health & wellness only", "Open to other premium brands (non-wellness), with category exclusions", "Open to any approved ad"]);
  assert.ok(ACT_EXCLUSIONS.some((e) => e.key === "cannabis") && ACT_EXCLUSIONS.some((e) => e.key === "competitors"));
  assert.match(ACT_REVIEW_NOTE, /nothing runs without approval/);
  assert.match(ACT_REVIEW_NOTE, /Randy or Jon/);
  assert.equal(isNonCore("any"), true);
  assert.equal(isNonCore("curated"), false);
});

test("meta survives cleanLeadMeta (incl. numeric midpoints) and an empty exclusion list is stored as 'none'", () => {
  const r = parseActivation({ ...OK, exclusions: [] });
  assert.ok(r.ok);
  const m = cleanLeadMeta(activationMeta(r.v));
  assert.equal(m.act_excl, "none");
  assert.equal(m.act_pages_mid, 150);
  assert.equal(m.act_openness, "premium");
  assert.equal(cleanLeadMeta({ act_views_mid: -5 }).act_views_mid, undefined);
});

test("Friday payload carries ranges, ads allowed, exclusions and the open-to-non-core tag", async () => {
  const r = parseActivation(OK);
  assert.ok(r.ok);
  const s = new MemoryLeadStore();
  const { lead } = await s.upsert({ id: "activation:t", source: "activation", sourceRef: "t", email: "p@brand.co", company: "Brand", ...activationSummary(r.v), meta: activationMeta(r.v) } as never);
  const p = buildFridayPayload(lead, { workspace: "w", stage: "s" }) as { tags: string[]; message: string; meta: Record<string, unknown> };
  assert.ok(p.tags.includes("birch:open-non-core") && p.tags.includes("birch:activation"));
  assert.equal(p.meta["open_to_non_core"], true);
  assert.equal(p.meta["ads_excluded"], "alcohol,gambling");
  assert.match(p.message, /Pages\/screens 50–250/);
  assert.match(p.message, /Ads allowed: Open to other premium brands/);
});

test("admin: filter open-to-non-core; roll-up is real rows only and 'Not sure' adds 0", async () => {
  const s = new MemoryLeadStore();
  const add = async (id: string, o: Record<string, unknown>, isTest = false) => {
    const r = parseActivation({ ...OK, ...o });
    assert.ok(r.ok);
    await s.upsert({ id, source: "activation", sourceRef: id, email: `${id}@x.co`, company: id, isTest, ...activationSummary(r.v), meta: activationMeta(r.v) } as never);
  };
  await add("activation:a", {});
  await add("activation:b", { openness: "curated", pages: "unsure", views: "unsure", list: "none" });
  await add("activation:c", { openness: "any", pages: "1k+" }, true);
  const leads = await s.listBySource("activation", 50);
  const ro = activationRollup(leads);
  assert.equal(ro.partners, 2);
  assert.equal(ro.noncore, 1);
  assert.equal(ro.pages, 150);
  assert.equal(ro.views, 60000);
  assert.equal(ro.unsure, 1);
  const all = activationAdminHtml(leads, "");
  assert.match(all, /Internal inventory count \(admin only\)/);
  assert.match(all, /do(es)? ?n.t change the public inventory|Nothing here changes the public inventory figures/);
  const nc = activationAdminHtml(leads, "noncore");
  assert.match(nc, /activation:a/);
  assert.match(nc, /activation:c/, "test rows are listed (marked) but never counted");
  assert.doesNotMatch(nc, /activation:b/);
  assert.match(activationAdminHtml(leads, "curated"), /activation:b/);
});

test("POST /v1/activation stores the lead; rejects bad input; honeypot stores nothing", async () => {
  const store = new MemoryLeadStore();
  setLeadStoreForTests(store);
  const app = express();
  app.use(createOverhaulRouter());
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const post = (b: unknown) => fetch(`${base}/v1/activation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  try {
    const bad = await post({ ...OK, email: "nope" });
    assert.equal(bad.status, 400);
    assert.equal((await post({ ...OK, email: "a@brand.co", ack: false })).status, 400);
    const hp = await post({ ...OK, email: "a@brand.co", company_url: "spam.co" });
    assert.equal((await hp.json() as { stored: string }).stored, "skipped");
    assert.equal((await store.listBySource("activation", 10)).length, 0);
    const ok = await post({ ...OK, email: "Partner@Brand.co", company: "Brand", test: true });
    assert.equal(ok.status, 200);
    const rows = await store.listBySource("activation", 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.email, "partner@brand.co");
    assert.equal(rows[0]!.meta.act_openness, "premium");
    // re-submit with the same email + role updates the same row (no duplicates)
    await post({ ...OK, email: "partner@brand.co", openness: "curated", test: true });
    const again = await store.listBySource("activation", 10);
    assert.equal(again.length, 1);
    assert.equal(again[0]!.meta.act_openness, "curated");
    assert.equal(again[0]!.meta.act_excl, "none");
  } finally {
    srv.close();
  }
});

test("UI wiring: asked after intake submit (not at the start), standalone page, same labels as the shared constants", () => {
  const form = readFileSync(resolve(process.cwd(), "../clinichub-media/src/components/br/intake-short-form.tsx"), "utf8");
  const after = form.indexOf("if (done && quick)");
  assert.ok(after > 0 && form.indexOf("<AdActivation", after) > after, "activation step renders only in the post-submit state");
  assert.equal(form.slice(0, after).includes("<AdActivation"), false, "never at the start of intake");
  const comp = readFileSync(resolve(process.cwd(), "../clinichub-media/src/components/br/ad-activation.tsx"), "utf8");
  for (const t of ["Your inventory estimate", "Which ads can run on your hubs?", "Other ad data (optional)", "Pages or hub screens", "Monthly views or visitors"]) assert.ok(comp.includes(t), t);
  const app = readFileSync(resolve(process.cwd(), "../clinichub-media/src/App.tsx"), "utf8");
  assert.match(app, /path="\/intake\/activate"/);
});
