import assert from "node:assert/strict";
import { test } from "node:test";
import { channelFromRef, isProductionRuntime, memoryStore, parseShareEvent, referrerHost, shareStore, summarize } from "../src/lib/shareEvents";
import { oneFormFields } from "../../clinichub-media/src/lib/fridayBrandIntake";

test("share events: parse, sanitize, never store report tokens or full referrers", () => {
  const e = parseShareEvent({ kind: "share", channel: "linkedin", path: "/kit/r/abc123secret", sid: "a1b2c3d4e5" })!;
  assert.equal(e.path, "/kit/r/report");
  assert.equal(e.channel, "linkedin");
  const a = parseShareEvent({ kind: "arrival", path: "/intake", ref: "share_x", referrer: "https://t.co/abc?x=1", sid: "a1b2c3d4e5" })!;
  assert.equal(a.channel, "x");
  assert.equal(a.referrerHost, "t.co");
  assert.equal(parseShareEvent({ kind: "arrival", path: "/intake", ref: "hero_home" })!.channel, "cta");
  assert.equal(parseShareEvent({ kind: "share", channel: "fax", path: "/intake" }), null);
  assert.equal(parseShareEvent({ kind: "share", channel: "copy", path: "/intake", email: "a@b.co" }), null);
  assert.equal(parseShareEvent({ kind: "arrival", path: "/intake", ref: "<script>" }), null);
  assert.equal(referrerHost("not a url"), null);
  assert.equal(channelFromRef(null), "direct");
});

test("share events: previews and tests never use the production database", async () => {
  delete process.env.VERCEL_ENV;
  assert.equal(isProductionRuntime(), false);
  assert.equal(shareStore().name, "memory");
  const s = memoryStore();
  await s.add(parseShareEvent({ kind: "share", channel: "copy", path: "/intake" })!);
  await s.add(parseShareEvent({ kind: "arrival", path: "/intake", ref: "share_copy" })!);
  await s.add(parseShareEvent({ kind: "click", channel: "cta", path: "/", ref: "hero_home" })!);
  const sum = summarize(await s.list(30, 100), s.name, 30);
  assert.deepEqual(sum.totals, { share: 1, click: 1, arrival: 1 });
  assert.equal(sum.by_channel.find((c) => c.channel === "copy")!.arrival, 1);
  assert.equal(sum.by_ref.find((r) => r.ref === "hero_home")!.click, 1);
});

test("one form: supplier + hub map to v1 keys, extras to a labelled blurb, no names", () => {
  const body: Record<string, unknown> = {};
  oneFormFields({ schema: "birch-brand-intake/v1-draft", role: "supplier", roles: ["supplier", "publisher"], site: "birchreserve.net", terms_version: "t", company_name: "Glow Tonic", shared: { categories: ["recovery_devices"], skus: 12, audience_customers: 5000 }, hub: { type: "Studio / gym", locations: 3, email_list: 8000, web_visitors_month: 20000, page_views_month: 60000, screens: 2, surfaces: ["home"], cities: "Toronto", decision_maker_role: "Owner" } }, body);
  assert.equal(body.company_name, "Glow Tonic");
  assert.deepEqual((body.supplier as { first_look: Record<string, string> }).first_look, { "Recovery Devices & Equipment": "on" });
  assert.deepEqual((body.profile as { audience: unknown }).audience, { customers: 5000, emails: 8000 });
  assert.deepEqual((body.publisher as { surfaces: string[] }).surfaces, ["home"]);
  const blurb = String(body.blurb);
  assert.match(blurb, /Intake choice: supplier \+ hub/);
  assert.match(blurb, /60000 page views/);
  assert.match(blurb, /decision maker role: Owner/);
  const only: Record<string, unknown> = {};
  oneFormFields({ schema: "birch-brand-intake/v1-draft", role: "supplier", roles: ["supplier"], site: "birchreserve.net", terms_version: "t" }, only);
  assert.match(String(only.blurb), /supplier only \(performance, no advertising\)/);
});
