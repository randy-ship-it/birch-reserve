import assert from "node:assert/strict";
import test from "node:test";
import { OVERHAUL_ROUTES, buyerDiscoveryJsonLd } from "../src/lib/overhaul/seo";

const BANNED = /align|clairvoyant|alset|80 locations|medvibe|friday|pier39|ankita|kalaya|peer39|guarantee/i;

test("buyer discovery JSON-LD: one Organization and one WebSite, no banned names or guarantee language", () => {
  const nodes = buyerDiscoveryJsonLd();
  assert.deepEqual(nodes.map((n) => n["@type"]), ["Organization", "WebSite"]);
  assert.ok(!BANNED.test(JSON.stringify(nodes)));
  const site = nodes[1] as { potentialAction: { target: { urlTemplate: string } } };
  assert.ok(site.potentialAction.target.urlTemplate.startsWith("https://birchreserve.net/.well-known/search?q="));
});

test("buyer discovery JSON-LD is in the buyer route graphs, and /media-buyers keeps exactly one Service", () => {
  for (const path of ["/advertise/brands", "/buyers", "/media-buyers"]) {
    const graph = (OVERHAUL_ROUTES[path].jsonld as { "@graph": Array<Record<string, unknown>> })["@graph"];
    assert.equal(graph.filter((n) => n["@type"] === "Organization").length, 1, path);
    assert.equal(graph.filter((n) => n["@type"] === "WebSite").length, 1, path);
  }
  const mb = (OVERHAUL_ROUTES["/media-buyers"].jsonld as { "@graph": Array<Record<string, unknown>> })["@graph"];
  assert.equal(mb.filter((n) => n["@type"] === "Service").length, 1);
});
