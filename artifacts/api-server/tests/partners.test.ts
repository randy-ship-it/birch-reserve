import assert from "node:assert/strict";
import { test } from "node:test";
import { PARTNER_CATEGORIES, PARTNER_GROUPS, PARTNERS, PARTNER_TRACKS, partnerTrackKey } from "../src/lib/overhaul/partners";
import { OVERHAUL_ROUTES } from "../src/lib/overhaul/seo";
import { PUBLIC_SITEMAP_PATHS } from "../src/lib/publicSeo";
import { MemoryLeadStore } from "../src/lib/leads";

const ALL = JSON.stringify([PARTNERS, PARTNER_GROUPS, PARTNER_TRACKS, PARTNER_CATEGORIES]);

test("partners copy rules (Nov 21 2026)", () => {
  assert.equal(PARTNER_TRACKS.length, 5);
  assert.doesNotMatch(ALL, /\b(gig|uber|on-demand|on demand|align|clairvoyant|alset|medvibe|friday|80 locations)\b/i);
  assert.doesNotMatch(ALL, /\d/, "no invented numbers");
  assert.doesNotMatch(ALL, /\b(guarantee[ds]?|forecast|margin of|% )/i);
  assert.match(ALL, /Wholesale terms discussed directly/);
});

test("track keys accept the key or the display name", () => {
  assert.equal(partnerTrackKey("flyer"), "flyer");
  assert.equal(partnerTrackKey("Ad-buying and media experts"), "adbuying");
  assert.equal(partnerTrackKey("Inventory and reach partners"), "media");
  assert.equal(partnerTrackKey("nope"), "");
});

test("partners route meta + sitemap", () => {
  assert.ok(OVERHAUL_ROUTES["/partners"]);
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes("/partners"));
});

test("leads store lists partners rows newest first", async () => {
  const s = new MemoryLeadStore();
  await s.upsert({ id: "partners:a", source: "partners", sourceRef: "a", email: "a@x.co", meta: { partner_track: "flyer" }, now: new Date(1) });
  await s.upsert({ id: "partners:b", source: "partners", sourceRef: "b", email: "b@x.co", meta: { partner_track: "media" }, now: new Date(2) });
  await s.upsert({ id: "chat:c", source: "chat_intake", sourceRef: "c", email: "c@x.co" });
  const rows = await s.listBySource("partners", 10);
  assert.deepEqual(rows.map((r) => r.id), ["partners:b", "partners:a"]);
  assert.equal(rows[1]!.meta.partner_track, "flyer");
});
