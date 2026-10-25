import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
  buildPrepayConfirmationEmail,
  sendPrepayConfirmationSafe,
  setPrepayEmailDepsForTests,
} from "../src/lib/prepayConfirmationEmail";
import { PREPAY_REFUND_CUTOFF_DAYS } from "../src/lib/reserveOffers";

const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|ca|io|org|co)\b)/i;
const paidSession = (reservationId = "r1") =>
  ({ id: "cs_test_x", payment_status: "paid", metadata: { reservationId } }) as unknown as Stripe.Checkout.Session;

test("prepay email: no URLs, states the refund cutoff, asks for artwork, copy and links, in the charged currency", () => {
  for (const [cents, cur, label] of [
    [49000, "usd", "$490 USD"],
    [69000, "cad", "$690 CAD"],
  ] as const) {
    const mail = buildPrepayConfirmationEmail({ brandName: "Acme Wellness", amountCents: cents, currency: cur });
    assert.ok(mail.text.includes(label));
    assert.ok(mail.subject.includes("Acme Wellness"));
    assert.doesNotMatch(mail.subject, URL_RE);
    assert.doesNotMatch(mail.text, URL_RE);
    assert.match(mail.text, new RegExp(`fully refundable until ${PREPAY_REFUND_CUTOFF_DAYS} days before your launch date`));
    assert.match(mail.text, /Artwork/);
    assert.match(mail.text, /Copy/);
    assert.match(mail.text, /Links/);
    assert.match(mail.text, /reply/i);
    assert.doesNotMatch(mail.text, /Align|Clairvoyant|80 locations/i);
  }
});

test("prepay email: disabled by default, never sends for tests or hold-190, sends once for a real paid reserve-490", async () => {
  const sent: Array<{ to: string[]; subject: string; text: string }> = [];
  const reservation = {
    id: "r1",
    email: "buyer@brand.example",
    brandName: "Brand",
    offerKey: "reserve-490",
    isTest: false,
    amountCents: 69000,
    currency: "cad",
  };
  let enabled = false;
  let current = { ...reservation };
  setPrepayEmailDepsForTests({
    enabled: () => enabled,
    loadReservation: async () => current,
    send: async (m) => {
      sent.push(m);
      return { id: "msg_1" };
    },
  });
  try {
    assert.deepEqual(await sendPrepayConfirmationSafe(paidSession()), { status: "skipped", reason: "disabled" });
    enabled = true;
    current = { ...reservation, isTest: true };
    assert.deepEqual(await sendPrepayConfirmationSafe(paidSession()), { status: "skipped", reason: "test_identity" });
    current = { ...reservation, email: "qa+x@brand.example" };
    assert.deepEqual(await sendPrepayConfirmationSafe(paidSession()), { status: "skipped", reason: "test_identity" });
    current = { ...reservation, offerKey: "hold-190", amountCents: 27000 };
    assert.deepEqual(await sendPrepayConfirmationSafe(paidSession()), { status: "skipped", reason: "not_prepay_offer" });
    const unpaid = { id: "cs", payment_status: "unpaid", metadata: { reservationId: "r1" } } as unknown as Stripe.Checkout.Session;
    current = { ...reservation };
    assert.deepEqual(await sendPrepayConfirmationSafe(unpaid), { status: "skipped", reason: "not_paid" });
    assert.equal(sent.length, 0);
    const ok = await sendPrepayConfirmationSafe(paidSession());
    assert.equal(ok.status, "sent");
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0]!.to, ["buyer@brand.example"]);
    assert.ok(sent[0]!.text.includes("$690 CAD"));
    // a provider failure never throws
    setPrepayEmailDepsForTests({
      enabled: () => true,
      loadReservation: async () => current,
      send: async () => {
        throw new Error("Resend HTTP 500");
      },
    });
    assert.equal((await sendPrepayConfirmationSafe(paidSession())).status, "error");
  } finally {
    setPrepayEmailDepsForTests(null);
  }
});
