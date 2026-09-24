import assert from "node:assert/strict";
import test from "node:test";
import { birchOrderPresentation } from "../src/lib/birch-order-status.ts";

test("a paid recycled order preserves payment without showing a spinner", () => {
  const presentation = birchOrderPresentation({
    status: "recycled",
    payment_status: "paid",
    amountCents: 49000,
    currency: "usd",
  });
  assert.equal(presentation.kind, "paid_recycled");
  assert.match(presentation.title, /Payment Preserved/);
  assert.match(presentation.description, /payment remains recorded/i);
  assert.match(presentation.description, /\$490 USD/);
});

test("an expired unpaid hold is terminal and does not imply a charge", () => {
  const presentation = birchOrderPresentation({
    status: "recycled",
    payment_status: "not_paid",
    amountCents: 19000,
    currency: "usd",
  });
  assert.equal(presentation.kind, "expired");
  assert.match(presentation.title, /Expired/);
  assert.match(presentation.description, /No payment was recorded/);
});