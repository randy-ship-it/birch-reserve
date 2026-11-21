/**
 * Branded paid confirmation (Randy, Nov 21 2026 6:12 PM): every paid SKU, Birch vs Scale layout, one email per paid session
 * (webhook retries and replays included), no retro-sends, no promo codes or banned terms. PGlite, no network, no Stripe.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import * as store from "../src/lib/adserver/store";
import { draftCampaignFromCheckoutSafe } from "../src/lib/adserver/service";
import { buildPaidConfirmationEmail, creditSplit, dashboardUrlFor, PAID_CONFIRMATION_SINCE, sendPaidConfirmationSafe, setPaidConfirmationDepsForTests } from "../src/lib/paidConfirmationEmail";
import { setSalesAlertDepsForTests } from "../src/lib/salesAlert";
import { processStripeEvent } from "../src/routes/splashAdReservations";
import { resendSend, setSiteMailFetchForTests } from "../src/lib/siteMail";

type Sent = { from: string; to: string[]; subject: string; text: string; html?: string };
const sent: Sent[] = [];
let failNext = false;
setPaidConfirmationDepsForTests({ enabled: () => true, send: async (m) => { if (failNext) { failNext = false; throw new Error("resend down"); } sent.push(m as Sent); return { id: "re_1" }; } });
setSalesAlertDepsForTests({ ready: () => false });

const AFTER = PAID_CONFIRMATION_SINCE + 60;
const session = (id: string, md: Record<string, string>, amount: number, o: { currency?: string; email?: string; created?: number } = {}) =>
  ({ id, object: "checkout.session", payment_status: "paid", status: "complete", livemode: true, amount_total: amount, currency: o.currency ?? "usd", created: o.created ?? AFTER, customer_details: { email: o.email ?? "buyer@acmebrand.com", name: "Acme" }, metadata: md, payment_intent: `pi_${id}` }) as never;
const BANNED = /\bAlign\b|Clairvoyant|[Gg]uarantee|[Oo]wnership|\b[Oo]wn\b|\d[\d,]*\+? (locations|members|viewers|hubs)|STREET100|[Ss]treet ?100/;
const visible = (html: string) => html.replace(/<[^>]+>/g, " ");

function fresh(schema: string) {
  const db = new PGlite();
  store.setAdPoolForTests(db as unknown as store.Queryable, schema);
  sent.length = 0;
  return db;
}

test("every paid SKU gets one Birch email with paid amount, credit (bonus + media credit), dashboard link, next steps, support", async () => {
  fresh("ads_pc_birch");
  const cases = [
    { s: session("cs_live_look", { sku: "hold-190", reservationId: "r1", site: "birch", sold_by: "birch", promo: "STREET100", promo_net_cents: "10000" }, 9000), paid: "$90 USD", label: /7-day look/ },
    { s: session("cs_live_res", { sku: "reserve-490", reservationId: "r2" }, 69000, { currency: "cad" }), paid: "$690 CAD", label: /Category reserve/ },
    { s: session("cs_live_exc", { kind: "exclusive_reserve", sku: "exclusive-reserve-1900-cad", brand: "Acme" }, 190000, { currency: "cad" }), paid: "$1,900 CAD", label: /Exclusive display reserve/ },
    { s: session("cs_live_pack", { kind: "sponsorship_credit", tier: "sponsor-1500", credit_cents: "157500", brand: "Acme" }, 150000), paid: "$1,500 USD", label: /Sponsor pack \(\$1,500 pack\)/ },
  ];
  for (const c of cases) {
    await draftCampaignFromCheckoutSafe(c.s, { isTest: false });
    assert.deepEqual(await sendPaidConfirmationSafe(c.s), { status: "sent" });
  }
  assert.equal(sent.length, 4);
  for (const [n, c] of cases.entries()) {
    const m = sent[n]!;
    assert.match(m.text, new RegExp(`Paid: \\${c.paid}`));
    assert.match(m.text, c.label);
    assert.match(m.html!, /cid:br-mark/);
    assert.doesNotMatch(m.html!, /cid:scale-logo/);
    assert.match(m.text, /Open your ad dashboard: https:\/\/birchreserve\.net\/account\/login\?session_id=cs_live_/);
    assert.match(m.text, /randy@scalehealth\.ca/);
    assert.match(m.text, /\(647\) 931-6278/);
    assert.match(m.text, /Next steps:/);
    assert.doesNotMatch(m.subject + m.text + visible(m.html!), BANNED, "no promo code, partner names, counts or guarantees");
    assert.equal(m.to[0], "buyer@acmebrand.com");
  }
  assert.match(sent[3]!.text, /Ad credit booked: \$1,575 USD \(includes \$75 USD bonus credit\)/);
  assert.match(sent[2]!.text, /We email your insertion order within 1 business day/);
  assert.match(sent[2]!.text, /Campaign dates: Set in your insertion order/);
  assert.match(sent[0]!.text, /Campaign dates: Confirmed when your ad is approved/);
});

test("Scale mirror checkouts get the ScaleHealth logo, Scale green button, Scale sender name and the mirror dashboard link", async () => {
  fresh("ads_pc_scale");
  const s = session("cs_live_scale", { sku: "hold-190", reservationId: "r9", site: "scale", sold_by: "scale" }, 19000);
  await draftCampaignFromCheckoutSafe(s, { isTest: false });
  assert.deepEqual(await sendPaidConfirmationSafe(s), { status: "sent" });
  const m = sent[0]!;
  assert.match(m.html!, /cid:scale-logo/);
  assert.doesNotMatch(m.html!, /cid:br-mark|Birch Reserve/);
  assert.match(m.html!, /background:#1D875C/);
  assert.match(m.from, /^ScaleHealth Ads </);
  assert.match(m.text, /https:\/\/www\.scalehealth\.ca\/intake\/_m\/account\/login\?session_id=cs_live_scale/);
  assert.match(m.text, /booked with ScaleHealth/);
});

test("idempotent: webhook retries, completed + async_payment_succeeded and replays send exactly one email", async () => {
  fresh("ads_pc_dupe");
  const s = session("cs_live_dupe", { kind: "sponsorship_credit", tier: "sponsor-3000", credit_cents: "330000", brand: "Dupe Co" }, 300000);
  await processStripeEvent({ id: "evt_a", type: "checkout.session.completed", data: { object: s } } as never);
  await processStripeEvent({ id: "evt_a", type: "checkout.session.completed", data: { object: s } } as never);
  await processStripeEvent({ id: "evt_b", type: "checkout.session.async_payment_succeeded", data: { object: s } } as never);
  await Promise.all([sendPaidConfirmationSafe(s), sendPaidConfirmationSafe(s)]);
  assert.equal(sent.length, 1);
  const log = await store.auditLog(50);
  assert.equal(log.filter((l) => l.action === "buyer.paid_confirmation").length, 1);
});

test("a failed send gives the claim back so a replay can retry; then it is still once", async () => {
  fresh("ads_pc_retry");
  const s = session("cs_live_retry", { sku: "hold-190", reservationId: "r3" }, 19000);
  failNext = true;
  assert.deepEqual(await sendPaidConfirmationSafe(s), { status: "error" });
  assert.equal(sent.length, 0);
  assert.deepEqual(await sendPaidConfirmationSafe(s), { status: "sent" });
  assert.deepEqual(await sendPaidConfirmationSafe(s), { status: "duplicate" });
  assert.equal(sent.length, 1);
});

test("never retro-sends, never to test identities (except our own qa+ inbox, marked TEST), never unpaid", async () => {
  fresh("ads_pc_skip");
  assert.deepEqual(await sendPaidConfirmationSafe(session("cs_live_calm", { sku: "hold-190" }, 19000, { created: 1795300000 - 10_000 })), { status: "skipped", reason: "before_launch" });
  assert.deepEqual(await sendPaidConfirmationSafe(session("cs_live_t1", { sku: "hold-190" }, 19000, { email: "qa+x@example.com" })), { status: "skipped", reason: "test_identity" });
  assert.deepEqual(await sendPaidConfirmationSafe({ ...(session("cs_live_t2", { sku: "hold-190" }, 19000) as object), payment_status: "unpaid" } as never), { status: "skipped", reason: "not_paid" });
  assert.deepEqual(await sendPaidConfirmationSafe(session("cs_live_qa", { sku: "hold-190" }, 19000, { email: "qa+pc@silverbirchgrowth.com" })), { status: "sent" });
  assert.match(sent[0]!.subject, /^\[TEST\] /);
  setPaidConfirmationDepsForTests({ enabled: () => false });
  assert.deepEqual(await sendPaidConfirmationSafe(session("cs_live_off", { sku: "hold-190" }, 19000)), { status: "skipped", reason: "disabled" });
  setPaidConfirmationDepsForTests({ enabled: () => true, send: async (m) => (sent.push(m as Sent), { id: "re_1" }) });
});

test("campaign dates show when set; promo media credit shows separately; Resend attaches the Scale logo inline", async () => {
  const m = buildPaidConfirmationEmail({ brand: "birch", sku: "reserve-490", amountPaidCents: 39000, currency: "usd", creditCents: 49000, bonusCents: 0, mediaCreditCents: 10000, flightStart: new Date("2026-11-24T17:00:00Z"), flightEnd: new Date("2026-12-01T17:00:00Z"), dashboardUrl: dashboardUrlFor("birch", "cs_live_x") });
  assert.match(m.text, /Campaign dates: November 24, 2026 to December 1, 2026/);
  assert.match(m.text, /Ad credit booked: \$490 USD \(includes \$100 USD media credit\)/);
  assert.deepEqual(creditSplit({ amount_total: 39000, metadata: { promo: "X" } } as never, { budgetMicros: 490 * 1e6 }), { creditCents: 49000, bonusCents: 0, mediaCreditCents: 10000 });
  process.env.RESEND_API_KEY = "re_test_only";
  let body: { attachments?: Array<{ content_id: string }> } = {};
  setSiteMailFetchForTests(async (_u, init) => { body = JSON.parse(String(init.body)); return { ok: true, status: 200, text: async () => JSON.stringify({ id: "re_x" }) }; });
  const sm = buildPaidConfirmationEmail({ brand: "scale", sku: "hold-190", amountPaidCents: 19000, currency: "usd", creditCents: 19000, bonusCents: 0, mediaCreditCents: 0, dashboardUrl: dashboardUrlFor("scale", "cs_live_y") });
  await resendSend({ from: "a@b.co", to: ["c@d.co"], ...sm });
  assert.deepEqual(body.attachments?.map((a) => a.content_id), ["scale-logo"]);
  setSiteMailFetchForTests(null);
  delete process.env.RESEND_API_KEY;
});
