/** Admin business views: Stripe session rows (QA excluded), commissions, leads CRM labels, site filter, Scale voice on docs and the reserve product name. Pure, no network. */
import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { commissionRates, commissionTotals, leadsHtml, leadSiteOf, reserveRowOf, reservesHtml, siteFilterOf } from "../src/lib/adserver/adminBusiness";
import { docsPage } from "../src/lib/adserver/docsPage";
import { buildExclusiveReserveSession } from "../src/lib/exclusiveReserve";

const NOW = new Date("2026-11-22T20:00:00Z");
const sess = (o: Partial<Stripe.Checkout.Session> & { md?: Record<string, string>; refunded?: number }): Stripe.Checkout.Session =>
  ({ id: "cs_live_" + Math.random().toString(36).slice(2, 14), livemode: true, created: Math.floor(NOW.getTime() / 1000) - 3600, amount_total: 190000, currency: "cad", status: "complete", payment_status: "paid",
    customer_details: { email: o.md?.email ?? "buyer@brand.com" }, success_url: "https://birchreserve.net/exclusive?reserve=success", metadata: { kind: "exclusive_reserve", brand: "Brand Co", ...(o.md ?? {}) },
    payment_intent: o.refunded ? { latest_charge: { amount_refunded: o.refunded } } : null, ...o }) as never;

test("QA, test-mode and unrelated sessions never show", () => {
  assert.equal(reserveRowOf(sess({ md: { brand: "QA Check (no purchase)" }, status: "open", payment_status: "unpaid" })), null);
  assert.equal(reserveRowOf(sess({ md: { email: "qa-adcheck@silverbirchgrowth.com" } })), null);
  assert.equal(reserveRowOf(sess({ livemode: false })), null);
  assert.equal(reserveRowOf(sess({ metadata: { note: "x" } })), null);
});

test("status, site and refunds", () => {
  assert.equal(reserveRowOf(sess({}))?.status, "paid");
  assert.equal(reserveRowOf(sess({ status: "open", payment_status: "unpaid" }))?.status, "open");
  assert.equal(reserveRowOf(sess({ status: "expired", payment_status: "unpaid" }))?.status, "expired");
  assert.equal(reserveRowOf(sess({ refunded: 190000 }))?.status, "refunded");
  assert.equal(reserveRowOf(sess({ refunded: 1000 }))?.status, "partly_refunded");
  assert.equal(reserveRowOf(sess({ success_url: "https://www.scalehealth.ca/intake/_m/exclusive" }))?.site, "scale");
  assert.equal(reserveRowOf(sess({ md: { site: "scale" } }))?.site, "scale");
});

test("commissions: rate x net paid, this month and to date, by channel", () => {
  const rows = [
    reserveRowOf(sess({}))!,
    reserveRowOf(sess({ success_url: "https://www.scalehealth.ca/intake/_m/exclusive", refunded: 90000 }))!,
    reserveRowOf(sess({ created: Math.floor(NOW.getTime() / 1000) - 90 * 86400 }))!,
    reserveRowOf(sess({ status: "open", payment_status: "unpaid" }))!,
  ];
  const t = commissionTotals(rows, commissionRates([], []), NOW);
  const b = t.find((x) => x.channel === "brokerage")!;
  const s = t.find((x) => x.channel === "scale_direct")!;
  assert.deepEqual([b.bps, b.monthNet, b.allNet], [2000, 190000, 380000]);
  assert.deepEqual([s.bps, s.monthNet, s.allNet], [500, 100000, 100000]);
});

test("leads: CRM label, site, QA excluded; reserves error shows no rows", () => {
  const lead = (o: Record<string, unknown>) => ({ id: "l", source: "brand_intake", createdAt: NOW, isTest: false, meta: {}, fridayStatus: "sent", name: "Pat", company: "Acme", email: "pat@acme.com", utmSource: null, landingPage: null, referrer: null, pagePath: null, ...o }) as never;
  const html = leadsHtml({ brand_intake: [lead({}), lead({ name: "Sam", fridayStatus: "failed", utmSource: "scale_mirror" }), lead({ isTest: true, name: "Zed" }), lead({ email: "qa+x@y.com", name: "Qa" })] }, "all");
  assert.match(html, /in CRM/); assert.match(html, /CRM push failed/); assert.doesNotMatch(html, /Zed|Friday/);
  assert.equal(leadSiteOf(lead({ utmSource: "scale_mirror" })), "scale");
  assert.doesNotMatch(leadsHtml({ brand_intake: [lead({})] }, "scale"), /Pat/);
  assert.match(reservesHtml(null, "all"), /Nothing is shown/);
  assert.equal(siteFilterOf("scale"), "scale"); assert.equal(siteFilterOf("x"), "all");
});

test("Scale voice: docs prose and slot names, not code; reserve product name", () => {
  const d = docsPage("https://birchreserve.net", "scale");
  assert.doesNotMatch(d.replace(/<(pre|code|script|footer)[\s\S]*?<\/\1>/g, ""), /Birch Reserve/);
  assert.match(d, /ads\/embed\.js/); assert.match(d, /birchreserve\.net\/ads\/embed\.js/);
  assert.match(docsPage("https://birchreserve.net"), /How Birch Reserve placements/);
  const mk = (site: "birch" | "scale") => JSON.stringify((buildExclusiveReserveSession({ brand: "B", email: "b@b.co", category: "c", agree: true, currency: "cad" }, "https://x.test", site) as { params: unknown }).params);
  assert.match(mk("scale"), /Scale Health — Exclusive display reserve \(\$1,900 CAD\)/);
  assert.doesNotMatch(mk("birch"), /Scale Health — Exclusive/);
});

test("admin page renders the Business tab with every new section, and no Friday label in the new sections", async () => {
  const { adminPage } = await import("../src/lib/adserver/adminPage");
  const { adminGlanceHtml } = await import("../src/lib/adserver/adminGlance");
  const { reservesHtml: rh, commissionsHtml, siteFilterHtml } = await import("../src/lib/adserver/adminBusiness");
  const zero = { serves: 0, views: 0, clicks: 0, convs: 0, convValueMicros: 0, spendMicros: 0 };
  const rows = [reserveRowOf(sess({}))!];
  const html = adminPage({
    who: "randy@silverbirchgrowth.com", campaigns: [], pending: [], creativesByCampaign: new Map(), slotTotals: new Map(), ledger: [], royalties: [], shares: new Map(), orders: [], alerts: [], audit: [], day: zero, friday: false, schema: "t",
    siteHtml: siteFilterHtml("scale"), glanceHtml: adminGlanceHtml({ leads: {}, orders: [], campaigns: [], week: new Map(), royalties: [] }),
    businessHtml: rh(rows, "all") + commissionsHtml(rows, commissionRates([], []), "all", NOW) + leadsHtml({}, "all"),
  } as never);
  for (const id of ['id="glance"', 'id="reserves"', 'id="commissions"', 'id="leads"', 'data-tab="business"']) assert.ok(html.includes(id), id);
  assert.match(html, /Site:/);
});
