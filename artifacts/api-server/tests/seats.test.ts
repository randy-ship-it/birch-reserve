import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { IMPRESSION_BLOCKS, SEAT_CATEGORIES, SEAT_SKUS, FOUNDER, NETWORK, seatsJsonLd } from "../src/lib/seats/catalog";
import { SEAT_LEDGER } from "../src/lib/seats/ledger";
import { clearAvailabilityCacheForTests, fridaySeatsUrl, getSeatAvailability, ledgerAvailability, parseFridaySeats } from "../src/lib/seats/availability";
import { SEAT_ALERT_TO, renderSeatAlert, sendSeatAlert, setSeatAlertSenderForTests } from "../src/lib/seats/alerts";
import { buildSeatSession, seatsGate } from "../src/lib/seats/checkout";
import { createSeatsRouter } from "../src/routes/seats";
import { agentCatalog, agentQuote } from "../src/lib/overhaul/agent";
import { llmsTxt } from "../src/lib/overhaul/seo";
import { renderSeatsSectionHtml, renderSeatsStripHtml } from "../src/lib/seats/buycalcHtml";
import { recordPaidSeatSafe } from "../src/lib/seats/paid";

const NOV12 = Date.parse("2026-11-12T20:00:00Z");
const fridayBody = (over: Record<string, string> = {}) => ({
  org: "birchreserve",
  as_of: "2026-11-12T19:55:00Z",
  categories: SEAT_CATEGORIES.map((c) => ({ slug: c.slug, status: over[c.slug] ?? "open" })),
});

test("packaging: $190 hold-190 look, $490 reserve-490 seat, blocks at starter low CPM", () => {
  assert.deepEqual(SEAT_SKUS.map((s) => [s.sku, s.usd, s.cad]), [["hold-190", 190, 270], ["reserve-490", 490, 690]]);
  assert.equal(SEAT_CATEGORIES.length, 8);
  const dash = IMPRESSION_BLOCKS.find((b) => b.key === "block-dashboard-250k")!;
  assert.equal(dash.views, 250_000);
  assert.equal(dash.starterCpmUsd, 10);
  assert.equal(dash.usd, 2500);
  assert.equal(IMPRESSION_BLOCKS.find((b) => b.key === "block-products-100k")!.usd, 1200);
  assert.equal(IMPRESSION_BLOCKS.find((b) => b.key === "block-post-purchase-100k")!.usd, 1800);
  assert.match(NETWORK.line, /already >100 retailers \/ clinics on the map, rolling out/);
  assert.equal(FOUNDER.videoUrl, null);
});

test("ledger: fresh -> 8 of 8 open; stale -> null (call to confirm), never a fake count", () => {
  const fresh = ledgerAvailability(SEAT_LEDGER, NOV12)!;
  assert.equal(fresh.source, "ledger");
  assert.equal(fresh.open, 8);
  assert.equal(ledgerAvailability(SEAT_LEDGER, NOV12 + 30 * 86_400_000), null);
  const held = ledgerAvailability({ ...SEAT_LEDGER, seats: { ...SEAT_LEDGER.seats, sleep: { status: "held", until: "2026-11-10T00:00:00Z" } } }, NOV12)!;
  assert.equal(held.categories.find((c) => c.slug === "sleep")!.status, "unknown");
  assert.equal(held.open, null);
});

test("friday payload: strict parse, stale/malformed rejected", () => {
  const ok = parseFridaySeats(fridayBody({ sleep: "locked", nutrition: "held" }), NOV12)!;
  assert.equal(ok.source, "friday");
  assert.equal(ok.open, 6);
  assert.equal(parseFridaySeats({ ...fridayBody(), as_of: "2026-11-01T00:00:00Z" }, NOV12), null);
  assert.equal(parseFridaySeats({ as_of: "2026-11-12T19:55:00Z", categories: [{ slug: "sleep", status: "sold" }] }, NOV12), null);
  assert.equal(parseFridaySeats({ ...fridayBody(), categories: fridayBody().categories.slice(1) }, NOV12), null);
});

test("getSeatAvailability: Friday first, ledger on Friday 404, unknown on stale ledger", async () => {
  const env = { FRIDAY_API_URL: "https://fridayapp.org", FRIDAY_API_KEY: "k" } as NodeJS.ProcessEnv;
  assert.equal(fridaySeatsUrl(env), "https://fridayapp.org/api/birch/seats?org=birchreserve");
  clearAvailabilityCacheForTests();
  let seen = "";
  const a = await getSeatAvailability(env, { now: () => NOV12, fetch: async (u, init) => ((seen = `${u} ${init.headers.authorization}`), { ok: true, status: 200, json: async () => fridayBody({ sleep: "locked" }) }) });
  assert.equal(a.source, "friday");
  assert.equal(a.open, 7);
  assert.equal(seen, "https://fridayapp.org/api/birch/seats?org=birchreserve Bearer k");
  clearAvailabilityCacheForTests();
  const b = await getSeatAvailability(env, { now: () => NOV12, fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }) });
  assert.equal(b.source, "ledger");
  clearAvailabilityCacheForTests();
  const c = await getSeatAvailability({ SEAT_LEDGER_JSON: JSON.stringify({ ...SEAT_LEDGER, as_of: "2026-09-01" }) } as NodeJS.ProcessEnv, { now: () => NOV12 });
  assert.equal(c.source, "none");
  assert.equal(c.open, null);
  assert.equal(c.confirm_by_phone, true);
  clearAvailabilityCacheForTests();
});

test("alert body: buyer, category, SKU, action, Toronto time; TEST prefix; no '--'", () => {
  const { subject, text } = renderSeatAlert({ action: "hold", brand: "Acme Recovery", email: "jo@acme.com", category: "Sleep", sku: "hold-190", amount: "$190 USD", at: new Date("2026-11-12T20:05:00Z"), test: true, message: "call me -- soon" });
  assert.match(subject, /^\[TEST\] Birch buyer: HOLD \(\$190 7-day look\) · Sleep · Acme Recovery$/);
  for (const re of [/Buyer: Acme Recovery/, /Email: jo@acme.com/, /Category: Sleep/, /SKU: hold-190/, /Action: HOLD/, /3:05\s?p\.m\. EST \(America\/Toronto\)/]) assert.match(text, re);
  assert.doesNotMatch(text, /--/);
  assert.match(text, /^TEST ALERT/);
});

test("alerts go ONLY to the three internal addresses, Reply-To the buyer; skipped without a key", async () => {
  assert.deepEqual([...SEAT_ALERT_TO], ["randy@scalehealth.ca", "randy@silverbirchgrowth.com", "sales@silverbirchgrowth.com"]);
  const skipped = await sendSeatAlert({ action: "lock", email: "a@b.co" }, {} as NodeJS.ProcessEnv);
  assert.equal(skipped.status, "skipped");
  const sent: { to: string[]; replyTo?: string; from: string }[] = [];
  setSeatAlertSenderForTests(async (m) => (sent.push(m), { id: "re_1" }));
  try {
    const r = await sendSeatAlert({ action: "lock", email: "buyer@brand.com", brand: "Brand" }, {} as NodeJS.ProcessEnv);
    assert.equal(r.status, "sent");
    assert.deepEqual(sent[0]!.to, [...SEAT_ALERT_TO]);
    assert.ok(!sent[0]!.to.includes("buyer@brand.com"));
    assert.equal(sent[0]!.replyTo, "buyer@brand.com");
    assert.equal(sent[0]!.from, "Birch Reserve <care@scalehealth.ca>");
    assert.equal((await sendSeatAlert({ action: "lock" }, { SEAT_ALERTS_DISABLED: "true" } as NodeJS.ProcessEnv)).status, "skipped");
  } finally {
    setSeatAlertSenderForTests(null);
  }
});

test("seat checkout builder + gate (SEATS_ENABLED / SEATS_LIVE)", () => {
  const b = buildSeatSession({ sku: "reserve-490", category: "sleep", brand: "Acme", email: "a@acme.com", currency: "cad" }, "https://birchreserve.net");
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(b.amountCents, 69_000);
  const md = b.params.metadata as Record<string, string>;
  assert.equal(md.kind, "category_seat");
  assert.equal(md.sku, "reserve-490");
  assert.equal(md.category, "sleep");
  assert.match(String((b.params.line_items as { price_data: { product_data: { description: string } } }[])[0]!.price_data.product_data.description), /No impression guarantee/);
  assert.equal(buildSeatSession({ sku: "hold-190", category: "nope", brand: "A", email: "a@a.co" }, "x").ok, false);
  assert.equal(seatsGate({} as NodeJS.ProcessEnv).open, false);
  assert.equal(seatsGate({ SEATS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_live_x" } as NodeJS.ProcessEnv).open, false);
  assert.equal(seatsGate({ SEATS_ENABLED: "true", SEATS_LIVE: "true", STRIPE_SECRET_KEY: "sk_live_x" } as NodeJS.ProcessEnv).open, true);
  assert.equal(seatsGate({ SEATS_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_x" } as NodeJS.ProcessEnv).open, true);
});

async function withServer(router: express.Router, fn: (origin: string) => Promise<void>) {
  const app = express();
  app.use(router);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test("POST /v1/seats/request: held -> Friday intake + alert; honeypot silent; open gate -> checkout url", async () => {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  const friday: Record<string, unknown>[] = [];
  const alerts: { subject: string; to: string[] }[] = [];
  process.env.FRIDAY_API_URL = "https://friday.test";
  process.env.FRIDAY_API_KEY = "secret";
  process.env.FRIDAY_SEATS_DISABLED = "true";
  delete process.env.SEATS_ENABLED;
  clearAvailabilityCacheForTests();
  globalThis.fetch = (async (u: string | URL | Request, init?: RequestInit) => {
    if (String(u).startsWith("https://friday.test")) {
      friday.push(JSON.parse(String(init!.body)));
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    }
    return realFetch(u, init);
  }) as typeof fetch;
  setSeatAlertSenderForTests(async (m) => (alerts.push({ subject: m.subject, to: m.to }), { id: "re_x" }));
  const sessions: Record<string, unknown>[] = [];
  try {
    await withServer(createSeatsRouter({ createSession: async (p) => (sessions.push(p), { url: "https://checkout.stripe.test/s", livemode: false }) }), async (origin) => {
      const post = (b: Record<string, unknown>) => fetch(`${origin}/v1/seats/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
      const av = await (await fetch(`${origin}/v1/seats/availability.json`)).json();
      assert.equal(av.checkout, "held");

      const r = await post({ action: "hold", category: "sleep", brand: "Acme", email: "jo@acme.com", phone: "416-555-0100" });
      const j = await r.json();
      assert.equal(r.status, 200);
      assert.equal(j.held, true);
      assert.equal(j.message, "Reserved by inquiry; we'll confirm within 1 business day.");
      assert.equal(j.stored, "sent");
      assert.equal(j.alerted, "sent");
      const p = friday.at(-1)!;
      assert.equal(p.org, "birchreserve");
      assert.deepEqual((p.meta as Record<string, unknown>).sku, "hold-190");
      assert.deepEqual((p.meta as Record<string, unknown>).category, "sleep");
      assert.equal((p.meta as Record<string, unknown>).paid, false);
      assert.match(String(p.message), /time_toronto: .*America\/Toronto/);
      assert.match(alerts.at(-1)!.subject, /HOLD .* · Sleep · Acme/);
      assert.equal(sessions.length, 0);

      const w = await (await post({ action: "waitlist", category: "nutrition", brand: "B", email: "b@b.co" })).json();
      assert.match(w.message, /waitlist for Nutrition/);
      const blk = await (await post({ action: "block_request", block: "block-dashboard-250k", brand: "C", email: "c@c.co" })).json();
      assert.equal(blk.sku, "block-dashboard-250k");
      assert.match(alerts.at(-1)!.subject, /IMPRESSION BLOCK REQUEST/);
      const lr = await (await post({ action: "lock_request", category: "sleep", brand: "D", email: "d@d.co", timing: "This month", waitlist_if_taken: true })).json();
      assert.match(lr.message, /Lock request saved for Sleep/);

      const before = alerts.length;
      const hp = await (await post({ action: "hold", category: "sleep", brand: "Bot", email: "bot@x.co", company_url: "http://spam" })).json();
      assert.equal(hp.held, true);
      assert.equal(alerts.length, before);

      assert.equal((await post({ action: "hold", category: "sleep", brand: "", email: "x@y.co" })).status, 400);
      assert.equal((await post({ action: "hold", category: "zzz", brand: "A", email: "x@y.co" })).status, 400);

      process.env.SEATS_ENABLED = "true";
      process.env.STRIPE_SECRET_KEY = "sk_test_unit";
      const open = await (await post({ action: "lock", category: "sleep", brand: "E", email: "e@e.co" })).json();
      assert.equal(open.checkout_url, "https://checkout.stripe.test/s");
      assert.equal((sessions[0]!.metadata as Record<string, string>).sku, "reserve-490");
    });
  } finally {
    globalThis.fetch = realFetch;
    setSeatAlertSenderForTests(null);
    process.env = saved;
    clearAvailabilityCacheForTests();
  }
});

test("paid webhook session -> Friday paid=true + RESERVATION alert", async () => {
  const alerts: string[] = [];
  setSeatAlertSenderForTests(async (m) => (alerts.push(m.subject + "\n" + m.text), { id: "x" }));
  try {
    await recordPaidSeatSafe({ id: "cs_test_1", payment_status: "paid", amount_total: 49000, currency: "usd", livemode: false, customer_details: { email: "p@brand.com" }, metadata: { kind: "category_seat", sku: "reserve-490", category: "sleep", category_label: "Sleep", brand: "Brand" } });
    assert.match(alerts[0]!, /\[TEST\] Birch buyer: RESERVATION/);
    assert.match(alerts[0]!, /PAID \(Stripe test cs_test_1\)/);
  } finally {
    setSeatAlertSenderForTests(null);
  }
});

test("agent catalog, quote, llms.txt and JSON-LD carry the seat SKUs and availability", () => {
  const a = ledgerAvailability(SEAT_LEDGER, NOV12)!;
  const cat = agentCatalog({ slotsCheckout: false, areaLockCheckout: false, seatsCheckout: false }, a);
  assert.deepEqual(cat.category_seats.skus.map((s) => s.sku), ["hold-190", "reserve-490"]);
  assert.equal(cat.category_seats.availability.open, 8);
  assert.equal(cat.checkout_status.category_seats, "held");
  assert.ok(cat.category_seats.impression_blocks.every((b) => b.guaranteed === false));
  const q = agentQuote({ offer: "reserve-490", currency: "cad" });
  assert.ok(q.ok && q.amount === 690);
  const bq = agentQuote({ offer: "block-dashboard-250k" });
  assert.ok(bq.ok && bq.amount === 2500);
  const llms = llmsTxt();
  assert.match(llms, /## Category seats \(lead offer\)/);
  assert.match(llms, /\/v1\/seats\/availability\.json/);
  const ld = seatsJsonLd(a.categories, "usd");
  assert.equal(ld.itemListElement.length, 8 + IMPRESSION_BLOCKS.length);
  assert.equal(JSON.stringify(ld).includes("SoldOut"), false);
});

test("buycalc blocks: strip + 8 cards + form + network; unknown shows call to confirm", () => {
  const a = ledgerAvailability(SEAT_LEDGER, NOV12)!;
  assert.match(renderSeatsStripHtml(a), /8 of 8<\/b> categories open/);
  const html = renderSeatsSectionHtml(a, "usd");
  assert.equal((html.match(/data-testid="seat-card-/g) ?? []).length, 8);
  assert.match(html, /lock-request-form/);
  assert.match(html, /scalehealth\.ca\/localdemand/);
  assert.match(html, /tel:\+16479316278/);
  const unknown = renderSeatsStripHtml({ ...a, open: null, source: "none", categories: a.categories.map((c) => ({ ...c, status: "unknown" as const })) });
  assert.match(unknown, /Call to confirm/);
  assert.doesNotMatch(unknown, /of 8<\/b> categories open/);
  for (const banned of [/Align/, /Clairvoyant/, /80 locations/, /Kalaya/i, /we sell them customers/i]) assert.doesNotMatch(html, banned);
});
