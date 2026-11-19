import assert from "node:assert/strict";
import test from "node:test";
import { afterSave, buildPatch, clone, dirtyKeys, fieldMark, fromEditLink, linkHasPii, parsePrefillHash, pickFields, prefillLink, setPath, slugify, type PrefillFields } from "../src/lib/prefillDraft.ts";

const DRAFT: PrefillFields = {
  company_name: "Northline Recovery",
  website: "northlinerecovery.example",
  roles: ["supplier", "publisher"],
  category: "recovery_devices",
  geo: { sells: ["CA", "US"], ships: ["CA", "US"] },
  calculator: { avg_cart_usd: 120, orders_per_month: 1800, purchases_per_year: 2, margin_band: "50_70" },
  publisher: { surfaces: ["post_purchase", "home"], monthly_views: { home: 9000 } },
  profile: { geography: "Canada + USA", interests: "Recovery Devices", reach: { metrics: { web_visitors: { value: 45000, period: "per month" } } } },
  blurb: "Active adults buying recovery tools.",
};
/** What the backend does today: each top-level key replaces whole. */
const serverApply = (row: PrefillFields, body: Record<string, unknown>): PrefillFields => ({ ...row, ...pickFields(body) });

test("an untouched form never PATCHes", () => {
  const cur = clone(DRAFT);
  assert.equal(buildPatch(DRAFT, cur), null);
  assert.deepEqual(dirtyKeys(DRAFT, cur), []);
});

test("re-setting a field to the same value is not an edit", () => {
  const cur = setPath(clone(DRAFT), "calculator.avg_cart_usd", 120);
  assert.equal(buildPatch(DRAFT, cur), null);
});

test("a partial edit sends only that block, whole, and keeps every other prefilled field", () => {
  const cur = setPath(clone(DRAFT), "calculator.orders_per_month", 2500);
  const body = buildPatch(DRAFT, cur)!;
  assert.deepEqual(Object.keys(body), ["calculator"]);
  assert.deepEqual(body.calculator, { avg_cart_usd: 120, orders_per_month: 2500, purchases_per_year: 2, margin_band: "50_70" });
  const after = serverApply(DRAFT, body);
  assert.equal(after.calculator!.avg_cart_usd, 120);
  assert.equal(after.calculator!.margin_band, "50_70");
  assert.deepEqual(after.profile, DRAFT.profile);
  assert.deepEqual(after.publisher, DRAFT.publisher);
  assert.equal(after.blurb, DRAFT.blurb);
});

test("a nested profile edit keeps sibling keys the form never shows", () => {
  const cur = setPath(clone(DRAFT), "profile.geography", "Canada");
  const body = buildPatch(DRAFT, cur)!;
  const after = serverApply(DRAFT, body);
  assert.equal((after.profile as Record<string, unknown>).interests, "Recovery Devices");
  assert.deepEqual((after.profile as Record<string, unknown>).reach, DRAFT.profile!.reach);
  assert.equal((after.profile as Record<string, unknown>).geography, "Canada");
});

test("editing one key in a block keeps the hidden sibling the form never shows", () => {
  const cur = setPath(clone(DRAFT), "publisher.surfaces", ["home"]);
  const body = buildPatch(DRAFT, cur)!;
  assert.deepEqual(body.publisher, { surfaces: ["home"], monthly_views: { home: 9000 } });
});

test("after a save, only newer edits are sent", () => {
  const c1 = setPath(clone(DRAFT), "company_name", "Northline");
  const b1 = buildPatch(DRAFT, c1)!;
  const base = afterSave(DRAFT, b1);
  assert.equal(buildPatch(base, c1), null);
  const c2 = setPath(c1, "category", "strength_home_fitness");
  assert.deepEqual(buildPatch(base, c2), { category: "strength_home_fitness" });
});

test("marks: drafted, edited, added, none", () => {
  const cur = setPath(setPath(clone(DRAFT), "company_name", "Northline"), "calculator.purchases_per_year", 2);
  assert.equal(fieldMark(DRAFT, cur, "website"), "drafted");
  assert.equal(fieldMark(DRAFT, cur, "company_name"), "edited");
  const empty: PrefillFields = {};
  assert.equal(fieldMark(empty, { blurb: "x" }, "blurb"), "added");
  assert.equal(fieldMark(empty, {}, "blurb"), null);
});

test("link: unguessable key in the fragment, no PII, round-trips", () => {
  const ref = { id: "bi_ab12cd34ef", editToken: "e".repeat(32), reportToken: "r".repeat(32), version: 0 };
  const link = prefillLink("DR-HO'S", ref);
  assert.match(link, /^https:\/\/birchreserve\.net\/intake\/b\/dr-hos#edit=[A-Za-z0-9_-]+$/);
  assert.equal(link.split("#")[0]!.includes(ref.editToken), false, "token never in the path");
  assert.equal(linkHasPii(link), false);
  assert.deepEqual(parsePrefillHash(`#${link.split("#")[1]}`), ref);
  assert.equal(linkHasPii("https://birchreserve.net/intake/b/jane@brand.com#edit=x"), true);
});

test("a tampered or junk fragment is rejected", () => {
  assert.equal(parsePrefillHash("#edit=not-base64!!"), null);
  assert.equal(parsePrefillHash(`#edit=${btoa(JSON.stringify({ i: "x@y.com", e: "a", r: "b" }))}`), null);
  assert.equal(parsePrefillHash(""), null);
});

test("slugify keeps brand names readable", () => {
  assert.equal(slugify("DR-HO'S"), "dr-hos");
  assert.equal(slugify("  Roll Recovery  "), "roll-recovery");
  assert.equal(slugify("Kalaya"), "kalaya");
});

test("v1.4 merge: a cleared sub-field is sent as an explicit null (omitted would be kept)", () => {
  const cur = setPath(clone(DRAFT), "calculator.margin_band", undefined);
  const body = buildPatch(DRAFT, cur)!;
  assert.deepEqual(body.calculator, { avg_cart_usd: 120, orders_per_month: 1800, purchases_per_year: 2, margin_band: null });
  const cur2 = setPath(clone(DRAFT), "profile.reach.metrics.web_visitors", undefined);
  assert.equal((buildPatch(DRAFT, cur2)!.profile as any).reach.metrics.web_visitors, null);
  const cur3 = setPath(clone(DRAFT), "profile.geography", undefined);
  assert.equal((buildPatch(DRAFT, cur3)!.profile as any).geography, "", "profile text clears with an empty string");
  assert.equal(buildPatch(DRAFT, setPath(clone(DRAFT), "category", undefined))!.category, null);
});

test("v1.4 markers: only keys in prefill.fields not in prefill.edited say Drafted", () => {
  const m = { fields: ["company_name", "calculator"], edited: ["calculator"] };
  assert.equal(fieldMark(DRAFT, DRAFT, "company_name", m), "drafted");
  assert.equal(fieldMark(DRAFT, DRAFT, "calculator.avg_cart_usd", m), null, "edited on the backend earlier");
  assert.equal(fieldMark(DRAFT, DRAFT, "website", m), null, "not drafted by staff");
  assert.equal(fieldMark(DRAFT, setPath(clone(DRAFT), "website", "x.example"), "website", m), "edited");
});

test("the staff tool's /brand-kit#edit= link converts to the brand's /intake/b/<slug> link with the same key", () => {
  const ref = { id: "bi_ab12cd34ef", editToken: "e".repeat(32), reportToken: "r".repeat(32), version: 0 };
  const staff = `https://birchreserve.net/brand-kit${prefillLink("x", ref).slice(prefillLink("x", ref).indexOf("#"))}`;
  const out = fromEditLink(staff, "Roll Recovery")!;
  assert.match(out, /^https:\/\/birchreserve\.net\/intake\/b\/roll-recovery#edit=/);
  assert.deepEqual(parsePrefillHash(out.slice(out.indexOf("#"))), ref);
  assert.equal(fromEditLink("https://birchreserve.net/brand-kit", "x"), null);
});
