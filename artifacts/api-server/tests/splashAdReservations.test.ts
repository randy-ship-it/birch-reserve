import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  db,
  salesStaffAccessTable,
  splashAdReservationsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../src/app";
import {
  appendReservationToPipeline,
  processStripeEvent,
  sendReservationSlackAlert,
  setReservationAlertSenderForTests,
  syncReservationToPipeline,
  updateReservationInPipeline,
} from "../src/routes/splashAdReservations";
import {
  approveSplashReservationWithCapacity,
  cleanupSplashReservations,
  getSplashSeatCounts,
  recordSplashCreativeReceipt,
} from "../src/lib/splashReservationLifecycle";
import { sendCreativeDeadlineSlackWarning } from "../src/lib/splashAdReserveAlerts";
import { setStripeCheckoutFunctionsForTests } from "../src/lib/stripeClient";
import { setSalesStaffIdentityProviderForTests } from "../src/lib/salesStaffAccess";

const createdReservationIds: string[] = [];
const createdStaffEmails: string[] = [];
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;

before(async () => {
  setSalesStaffIdentityProviderForTests(async (req) => {
    const clerkUserId = req.get("x-test-clerk-user-id");
    const normalizedEmail = req.get("x-test-staff-email");
    const displayName = req.get("x-test-staff-name");
    return clerkUserId && normalizedEmail && displayName
      ? { clerkUserId, normalizedEmail, displayName }
      : null;
  });
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }

  baseUrl = `http://127.0.0.1:${address.port}/api`;
  closeServer = () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
});

after(async () => {
  if (createdReservationIds.length > 0) {
    await db
      .delete(splashAdReservationsTable)
      .where(inArray(splashAdReservationsTable.id, createdReservationIds));
  }
  if (createdStaffEmails.length > 0) {
    await db
      .delete(salesStaffAccessTable)
      .where(inArray(salesStaffAccessTable.normalizedEmail, createdStaffEmails));
  }
  await closeServer?.();
});

async function waitForAlertStatus(
  reservationId: string,
  status: "sent" | "failed",
  timeoutMs = 1_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [row] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservationId));
    if (row?.alertDeliveryStatus === status) return row;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Reservation alert did not become ${status}.`);
}

test("public reserve stores the canonical $990 offer and holds the seat without Stripe", async () => {
  const email = `splash-${randomUUID()}@example.com`;
  const brandName = "Northstar Recovery";
  const websiteUrl = "https://northstar.example.com";
  const previousAlertsDisabled = process.env.SPLASH_RESERVE_ALERTS_DISABLED;
  delete process.env.SPLASH_RESERVE_ALERTS_DISABLED;
  let alertedReservationId = "";
  setReservationAlertSenderForTests(async (reservation) => {
    alertedReservationId = reservation.id;
  });
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/launch/splash/reserve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandName,
        email: ` ${email.toUpperCase()} `,
        websiteUrl,
        expectedAmountCents: 99000,
        expectedCurrency: "usd",
        offer: "reserve-990",
      }),
    });
  } finally {
    setReservationAlertSenderForTests();
    if (previousAlertsDisabled === undefined) {
      delete process.env.SPLASH_RESERVE_ALERTS_DISABLED;
    } else {
      process.env.SPLASH_RESERVE_ALERTS_DISABLED = previousAlertsDisabled;
    }
  }

  assert.equal(response.status, 202);
  const receipt = (await response.json()) as {
    reservationId: string;
    status: string;
    checkoutUrl: string | null;
    amountCents: number;
    currency: string;
    offer: string;
  };
  createdReservationIds.push(receipt.reservationId);

  assert.equal(receipt.status, "held_pending_payments");
  assert.equal(receipt.checkoutUrl, null);
  assert.equal(receipt.amountCents, 99000);
  assert.equal(receipt.currency, "usd");
  assert.equal(receipt.offer, "reserve-990");

  const row = await waitForAlertStatus(receipt.reservationId, "sent");
  assert.ok(row);
  assert.equal(row.brandName, brandName);
  assert.equal(row.email, email);
  assert.equal(row.websiteUrl, websiteUrl);
  assert.equal(row.adInterest, "display");
  assert.equal(
    row.promotedOffer,
    "Birch Reserve Access Reserve",
  );
  assert.equal(row.launchWindow, null);
  assert.equal(row.status, "seat_held");
  assert.equal(row.offerKey, "reserve-990");
  assert.equal(row.amountCents, 99000);
  assert.equal(row.currency, "usd");
  assert.equal(row.source, "birch_reserve_public_checkout");
  assert.equal(row.sheetSyncStatus, "disabled");
  assert.equal(alertedReservationId, receipt.reservationId);
  assert.equal(row.alertDeliveryStatus, "sent");
  assert.ok(row.alertDeliveredAt);
});

test("legacy USD reservations remain readable and payable, without being public offers", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.SPLASH_AD_PUBLIC_URL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.SPLASH_AD_PUBLIC_URL = "https://reserve.example.com";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  const activationToken = randomUUID();
  const [legacy] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `legacy-readable-${randomUUID()}@example.com`,
      status: "approved",
      offerKey: "splash-1900",
      amountCents: 190000,
      currency: "usd",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      activationToken,
      inventoryHeldAt: new Date(),
      followUpBy: new Date(),
    })
    .returning();
  assert.ok(legacy);
  createdReservationIds.push(legacy.id);
  let captured: Record<string, unknown> | undefined;
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      const item = params.line_items?.[0]?.price_data;
      captured = {
        amount: item?.unit_amount,
        currency: item?.currency,
        metadata: params.metadata,
      };
      return {
        id: `cs_test_legacy_${randomUUID()}`,
        url: "https://checkout.stripe.test/legacy",
        currency: "usd",
        amount_total: 190000,
      } as never;
    },
  });
  try {
    const readable = await fetch(
      `${new URL(baseUrl).origin}/v1/orders/${legacy.id}`,
    );
    assert.equal(readable.status, 200);
    const order = (await readable.json()) as Record<string, unknown>;
    assert.equal(order.offer_key, "splash-1900");
    assert.equal(order.amountCents, 190000);

    const checkout = await fetch(`${baseUrl}/launch/splash/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activationToken }),
    });
    assert.equal(checkout.status, 200);
    assert.equal(captured?.amount, 190000);
    assert.equal(captured?.currency, "usd");
    assert.equal(
      (captured?.metadata as Record<string, string>).offerKey,
      "splash-1900",
    );
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.SPLASH_AD_PUBLIC_URL;
    else process.env.SPLASH_AD_PUBLIC_URL = previousPublicUrl;
  }
});

test("human reserve checkout uses the exact selected tier and Stripe line item", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.SPLASH_AD_PUBLIC_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.SPLASH_AD_PUBLIC_URL = "https://reserve.example.com";
  process.env.SEATS_TOTAL = "100";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";
  const expected = [
    ["reserve-990", 99000],
    ["pilot-4900", 490000],
    ["network-9900", 990000],
  ] as const;
  const captured: Array<{ amount: number | undefined; offer: unknown }> = [];
  setStripeCheckoutFunctionsForTests({
    create: async (params) => {
      const item = params.line_items?.[0]?.price_data;
      captured.push({ amount: item?.unit_amount, offer: params.metadata?.offerKey });
      return {
        id: `cs_test_human_${captured.length}`,
        url: `https://checkout.stripe.test/human-${captured.length}`,
        currency: "usd",
        amount_total: item?.unit_amount,
      } as never;
    },
  });
  try {
    for (const [offer, amount] of expected) {
      const response = await fetch(`${baseUrl}/launch/splash/reserve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandName: `Human ${offer}`,
          email: `human-${offer}-${randomUUID()}@example.com`,
          expectedAmountCents: amount,
          expectedCurrency: "usd",
          offer,
        }),
      });
      assert.equal(response.status, 200);
      const receipt = (await response.json()) as { reservationId: string };
      createdReservationIds.push(receipt.reservationId);
    }
    assert.deepEqual(
      captured.map((session) => [session.offer, session.amount]),
      expected,
    );
  } finally {
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.SPLASH_AD_PUBLIC_URL;
    else process.env.SPLASH_AD_PUBLIC_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("pipeline records the selected advertising interest and marks sync successful", async () => {
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `raw-${randomUUID()}@example.com`,
      adInterest: "both",
      status: "interest_captured",
      followUpBy: new Date(),
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  let capturedPath = "";
  let capturedBody = "";
  const status = await syncReservationToPipeline(reservation, {
    append: (row) =>
      appendReservationToPipeline(row, async (path, options) => {
        capturedPath = path;
        capturedBody = options?.body ?? "";
        return new Response(JSON.stringify({ updates: { updatedRows: 1 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
  });

  assert.equal(status, "synced");
  assert.match(capturedPath, /valueInputOption=RAW/);
  const requestBody = JSON.parse(capturedBody) as { values: string[][] };
  assert.equal(requestBody.values[0]?.[4], "both");

  const [syncedRow] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(syncedRow?.sheetSyncStatus, "synced");
  assert.equal(syncedRow?.sheetSyncError, null);
});

test("pipeline failures keep the request and mark it for operational recovery", async () => {
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `failed-${randomUUID()}@example.com`,
      adInterest: "performance",
      status: "interest_captured",
      followUpBy: new Date(),
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const status = await syncReservationToPipeline(reservation, {
    append: async () => {
      throw new Error("Simulated Sheets outage");
    },
  });

  assert.equal(status, "failed");
  const [failedRow] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(failedRow?.sheetSyncStatus, "failed");
  assert.match(failedRow?.sheetSyncError ?? "", /Simulated Sheets outage/);
});

test("pipeline updates the existing staff row with the cancellation reason", async () => {
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `pipeline-canceled-${randomUUID()}@buyer.invalid`,
      adInterest: "post_checkout",
      status: "expired",
      offerKey: "reserve-990",
      amountCents: 99000,
      currency: "usd",
      source: "birch_reserve_v1_checkout",
      followUpBy: new Date(),
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      lifecycleReason: "buyer_agent_canceled",
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const requests: Array<{
    path: string;
    method: string | undefined;
    body: string | undefined;
  }> = [];
  const status = await updateReservationInPipeline(
    reservation,
    async (path, options) => {
      requests.push({
        path,
        method: options?.method,
        body: options?.body,
      });
      if (!options?.method) {
        return new Response(
          JSON.stringify({
            values: [["Reservation ID"], ["other"], [reservation.id]],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ updatedRows: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );

  assert.equal(status, "synced");
  assert.match(requests[0]?.path ?? "", /Reservations!B%3AB/);
  assert.equal(requests[1]?.method, "PUT");
  assert.match(
    requests[1]?.path ?? "",
    /Reservations!A3%3AL3\?valueInputOption=RAW/,
  );
  const updateBody = JSON.parse(requests[1]?.body ?? "") as {
    values: string[][];
  };
  assert.equal(updateBody.values[0]?.[2], "expired");
  assert.equal(updateBody.values[0]?.[11], "buyer_agent_canceled");
});

test("Slack reserve alerts include the buyer details staff need", async () => {
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      brandName: "Northstar Recovery",
      email: `alert-${randomUUID()}@example.com`,
      websiteUrl: "https://northstar.example.com",
      adInterest: "auto_buy",
      status: "seat_held",
      paymentStatus: "unpaid",
      followUpBy: new Date(),
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  let capturedBody = "";
  await sendReservationSlackAlert(reservation, async (_path, options) => {
    capturedBody = options?.body ?? "";
    return new Response(JSON.stringify({ ok: true, ts: "123.456" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  const payload = JSON.parse(capturedBody) as { channel: string; text: string };
  assert.equal(payload.channel, "C0AUSTA1V9D");
  assert.match(payload.text, /Northstar Recovery/);
  assert.match(payload.text, new RegExp(reservation.email));
  assert.match(payload.text, /https:\/\/northstar\.example\.com/);
  assert.match(payload.text, /Buying path: auto_buy/);
  assert.match(payload.text, /Payment: unpaid/);
});

test("Slack failures do not block the reservation receipt and record a private recovery error", async () => {
  const email = `alert-failed-${randomUUID()}@example.com`;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.SEATS_TOTAL = "100";
  const previousAlertsDisabled = process.env.SPLASH_RESERVE_ALERTS_DISABLED;
  delete process.env.SPLASH_RESERVE_ALERTS_DISABLED;
  setReservationAlertSenderForTests(async () => {
    throw new Error("Simulated Slack outage");
  });
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/launch/splash/reserve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandName: "Saved Brand",
        email,
        expectedAmountCents: 99000,
        expectedCurrency: "usd",
        offer: "reserve-990",
      }),
    });
  } finally {
    setReservationAlertSenderForTests();
    if (previousAlertsDisabled === undefined) {
      delete process.env.SPLASH_RESERVE_ALERTS_DISABLED;
    } else {
      process.env.SPLASH_RESERVE_ALERTS_DISABLED = previousAlertsDisabled;
    }
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }

  assert.equal(response.status, 202);
  const receipt = (await response.json()) as { reservationId: string };
  createdReservationIds.push(receipt.reservationId);
  const failedRow = await waitForAlertStatus(receipt.reservationId, "failed");
  assert.ok(failedRow);
  assert.equal(failedRow.email, email);
  assert.equal(failedRow.alertDeliveryStatus, "failed");
  assert.match(failedRow.alertDeliveryError ?? "", /Simulated Slack outage/);
  assert.equal(failedRow.alertDeliveredAt, null);
});

test("a stalled Slack request never delays the saved reservation receipt", async () => {
  const email = `alert-timeout-${randomUUID()}@example.com`;
  const previousAlertsDisabled = process.env.SPLASH_RESERVE_ALERTS_DISABLED;
  const previousAlertTimeout = process.env.SPLASH_RESERVE_ALERT_TIMEOUT_MS;
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.SEATS_TOTAL = "100";
  delete process.env.SPLASH_RESERVE_ALERTS_DISABLED;
  process.env.SPLASH_RESERVE_ALERT_TIMEOUT_MS = "3000";
  setReservationAlertSenderForTests(
    async () => new Promise<void>(() => undefined),
  );

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/launch/splash/reserve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandName: "Slow Alert Brand",
        email,
        expectedAmountCents: 99000,
        expectedCurrency: "usd",
        offer: "reserve-990",
      }),
    });
  } finally {
    setReservationAlertSenderForTests();
    if (previousAlertsDisabled === undefined) {
      delete process.env.SPLASH_RESERVE_ALERTS_DISABLED;
    } else {
      process.env.SPLASH_RESERVE_ALERTS_DISABLED = previousAlertsDisabled;
    }
    if (previousAlertTimeout === undefined) {
      delete process.env.SPLASH_RESERVE_ALERT_TIMEOUT_MS;
    } else {
      process.env.SPLASH_RESERVE_ALERT_TIMEOUT_MS = previousAlertTimeout;
    }
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }

  assert.equal(response.status, 202);
  assert.ok(
    Date.now() - startedAt < 1_000,
    "The route waited for the stalled Slack request.",
  );
  const receipt = (await response.json()) as { reservationId: string };
  createdReservationIds.push(receipt.reservationId);
  const failedRow = await waitForAlertStatus(
    receipt.reservationId,
    "failed",
    4_000,
  );
  assert.match(failedRow.alertDeliveryError ?? "", /timed out/);
});

test("public reserve rejects a price that differs from the fixed offer", async () => {
  const email = `quote-changed-${randomUUID()}@example.com`;
  const response = await fetch(`${baseUrl}/launch/splash/reserve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brandName: "Quoted Brand",
      email,
      expectedAmountCents: 98900,
      expectedCurrency: "usd",
      offer: "reserve-990",
    }),
  });
  assert.equal(response.status, 409);
  const rows = await db
    .select({ id: splashAdReservationsTable.id })
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.email, email));
  assert.equal(rows.length, 0);
});

test("public reserve rejects missing and invalid checkout details", async () => {
  for (const payload of [
    {
      brandName: "Northstar Recovery",
      email: "not-an-email",
        expectedAmountCents: 99000,
      expectedCurrency: "usd",
        offer: "reserve-990",
    },
    {
      email: "buyer@example.com",
        expectedAmountCents: 99000,
      expectedCurrency: "usd",
        offer: "reserve-990",
    },
    {
      brandName: "Northstar Recovery",
      email: "buyer@example.com",
      websiteUrl: "not-a-url",
        expectedAmountCents: 99000,
      expectedCurrency: "usd",
        offer: "reserve-990",
    },
    {
      brandName: "Northstar Recovery",
      email: "buyer@example.com",
      expectedAmountCents: 99000,
      expectedCurrency: "usd",
      offer: "invented-offer",
      expectedStatus: 400,
    },
    {
      brandName: "Northstar Recovery",
      email: "buyer@example.com",
      expectedAmountCents: 99000,
      expectedCurrency: "eur",
      offer: "reserve-990",
      expectedStatus: 400,
    },
    {
      brandName: "Northstar Recovery",
      email: "buyer@example.com",
      expectedAmountCents: 490000,
      expectedCurrency: "usd",
      offer: "reserve-990",
      expectedStatus: 409,
    },
  ]) {
    const response = await fetch(`${baseUrl}/launch/splash/reserve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(
      response.status,
      (payload as { expectedStatus?: number }).expectedStatus ?? 400,
    );
  }
});

test("private activation status never makes a pending review payable", async () => {
  const activationToken = randomUUID();
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `approved-${randomUUID()}@example.com`,
      promotedOffer: "Approved recovery launch",
      launchWindow: "within_30_days",
      status: "pending_review",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      amountCents: 190000,
      currency: "usd",
      activationToken,
      followUpBy: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const statusResponse = await fetch(
    `${baseUrl}/launch/splash/status?token=${encodeURIComponent(activationToken)}`,
  );
  assert.equal(statusResponse.status, 200);
  const status = (await statusResponse.json()) as Record<string, unknown>;
  assert.equal(status.checkoutAvailable, false);
  assert.equal("checkoutUrl" in status, false);

  const pendingCheckout = await fetch(`${baseUrl}/launch/splash/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activationToken }),
  });
  assert.equal(pendingCheckout.status, 409);
});

test("activation status returns expired and recycled terminal reservations", async () => {
  const expiredToken = randomUUID();
  const recycledToken = randomUUID();
  const [expired, recycled] = await db
    .insert(splashAdReservationsTable)
    .values([
      {
        email: `expired-status-${randomUUID()}@example.com`,
        status: "expired",
        paymentStatus: "unpaid",
        creativeStatus: "locked",
        activationToken: expiredToken,
        expiredAt: new Date(),
        followUpBy: new Date(),
      },
      {
        email: `recycled-status-${randomUUID()}@example.com`,
        status: "recycled",
        paymentStatus: "paid",
        creativeStatus: "awaiting_upload",
        activationToken: recycledToken,
        paidAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
        recycledAt: new Date(),
        followUpBy: new Date(),
      },
    ])
    .returning();
  assert.ok(expired && recycled);
  createdReservationIds.push(expired.id, recycled.id);

  for (const [token, expectedStatus] of [
    [expiredToken, "expired"],
    [recycledToken, "recycled"],
  ] as const) {
    const response = await fetch(
      `${baseUrl}/launch/splash/status?token=${encodeURIComponent(token)}`,
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as Record<string, unknown>;
    assert.equal(payload.status, expectedStatus);
    assert.equal(payload.checkoutAvailable, false);
  }
});

test("staff approval and a public buyer cannot both claim the final seat", async () => {
  const previousTotal = process.env.SEATS_TOTAL;
  const previousAdminSecret = process.env.SPLASH_AD_ADMIN_SECRET;
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const [candidate] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `approval-race-${randomUUID()}@example.com`,
      status: "pending_review",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      followUpBy: new Date(),
    })
    .returning();
  assert.ok(candidate);
  createdReservationIds.push(candidate.id);
  const counts = await getSplashSeatCounts();
  process.env.SEATS_TOTAL = String(counts.seats_paid + counts.seats_held + 1);
  process.env.SPLASH_AD_ADMIN_SECRET = "approval-race-secret";
  process.env.STRIPE_CHECKOUT_DISABLED = "true";

  try {
    const [approvalResponse, publicResponse] = await Promise.all([
      fetch(`${baseUrl}/launch/admin/splash/${candidate.id}/review`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-splash-ad-admin-secret": "approval-race-secret",
        },
        body: JSON.stringify({ status: "approved" }),
      }),
      fetch(`${new URL(baseUrl).origin}/v1/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "reserve-990",
          email: `approval-race-buyer-${randomUUID()}@example.com`,
          brand: "Final Seat Buyer",
          idempotency_key: randomUUID(),
        }),
      }),
    ]);
    const publicReceipt = (await publicResponse.json()) as Record<string, unknown>;
    if (publicReceipt.order_id) {
      createdReservationIds.push(String(publicReceipt.order_id));
    }
    assert.equal(
      Number(approvalResponse.status === 200) + Number(publicResponse.status === 503),
      1,
    );
    assert.ok([200, 409].includes(approvalResponse.status));
    assert.ok([409, 503].includes(publicResponse.status));
    const after = await getSplashSeatCounts();
    assert.ok(after.seats_paid + after.seats_held <= after.seats_total);
  } finally {
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
    if (previousAdminSecret === undefined) delete process.env.SPLASH_AD_ADMIN_SECRET;
    else process.env.SPLASH_AD_ADMIN_SECRET = previousAdminSecret;
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
  }
});

test("a supported legacy reservation consumes the final seat", async () => {
  const previousTotal = process.env.SEATS_TOTAL;
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const before = await getSplashSeatCounts();
  process.env.SEATS_TOTAL = String(before.seats_paid + before.seats_held + 1);
  process.env.STRIPE_CHECKOUT_DISABLED = "true";
  const [legacy] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `legacy-held-${randomUUID()}@example.com`,
      status: "approved",
      offerKey: "splash_ad_1900_cad",
      amountCents: 190000,
      currency: "usd",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      inventoryHeldAt: new Date(),
      activationToken: randomUUID(),
      followUpBy: new Date(),
    })
    .returning();
  assert.ok(legacy);
  createdReservationIds.push(legacy.id);

  try {
    const counts = await getSplashSeatCounts();
    assert.equal(counts.seats_open, 0);
    const historicalStatus = await fetch(
      `${baseUrl}/launch/splash/status?token=${encodeURIComponent(legacy.activationToken ?? "")}`,
    );
    assert.equal(historicalStatus.status, 200);
    const status = (await historicalStatus.json()) as Record<string, unknown>;
    assert.equal(status.offer, "splash_ad_1900_cad");
    assert.equal(status.checkoutAvailable, false);
    const historicalCheckout = await fetch(`${baseUrl}/launch/splash/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activationToken: legacy.activationToken }),
    });
    assert.equal(historicalCheckout.status, 409);
    const response = await fetch(`${new URL(baseUrl).origin}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sku: "reserve-990",
        email: `legacy-competitor-${randomUUID()}@example.com`,
        brand: "Competing Buyer",
        idempotency_key: randomUUID(),
      }),
    });
    assert.equal(response.status, 409);
  } finally {
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
  }
});

test("approval starts a fresh hold clock without resetting it on repeated review", async () => {
  const previousTotal = process.env.SEATS_TOTAL;
  process.env.SEATS_TOTAL = "100";
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const [candidate] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `old-review-${randomUUID()}@example.com`,
      status: "pending_review",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      createdAt: old,
      followUpBy: old,
    })
    .returning();
  assert.ok(candidate);
  createdReservationIds.push(candidate.id);

  try {
    const first = await approveSplashReservationWithCapacity(
      candidate.id,
      randomUUID(),
    );
    assert.equal(first.kind, "approved");
    if (first.kind !== "approved") return;
    assert.ok(first.reservation.inventoryHeldAt);
    assert.ok(first.reservation.inventoryHeldAt.getTime() > old.getTime());

    const repeated = await approveSplashReservationWithCapacity(
      candidate.id,
      randomUUID(),
    );
    assert.equal(repeated.kind, "approved");
    if (repeated.kind !== "approved") return;
    assert.equal(
      repeated.reservation.inventoryHeldAt?.getTime(),
      first.reservation.inventoryHeldAt.getTime(),
    );

    const cleanup = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [candidate.id],
    });
    assert.equal(cleanup.expiredUnpaid, 0);
    const [current] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, candidate.id));
    assert.equal(current?.status, "approved");
  } finally {
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("interest captures cannot enter checkout even if operational state is changed", async () => {
  const activationToken = randomUUID();
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `interest-only-${randomUUID()}@example.com`,
      adInterest: "performance",
      status: "approved",
      offerKey: "clinic_hubs_ad_interest",
      amountCents: 0,
      source: "splash_ad_interest_capture",
      activationToken,
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      followUpBy: new Date(),
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const response = await fetch(`${baseUrl}/launch/splash/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activationToken }),
  });
  assert.equal(response.status, 409);
});

test("duplicate payment attempts are rejected once payment is recorded", async () => {
  const activationToken = randomUUID();
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `paid-${randomUUID()}@example.com`,
      promotedOffer: "Paid recovery launch",
      launchWindow: "within_30_days",
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      activationToken,
      paidAt: new Date(),
      followUpBy: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const response = await fetch(`${baseUrl}/launch/splash/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activationToken }),
  });
  assert.equal(response.status, 409);
});

test("Stripe success, cancellation, and webhook retries preserve the correct handoff state", async () => {
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `webhook-${randomUUID()}@example.com`,
      promotedOffer: "Webhook recovery launch",
      launchWindow: "within_2_weeks",
      status: "payment_pending",
      paymentStatus: "checkout_created",
      creativeStatus: "locked",
      offerKey: "splash-1900",
      amountCents: 190000,
      currency: "usd",
      activationToken: randomUUID(),
      stripeCheckoutSessionId: `cs_test_${randomUUID().replaceAll("-", "")}`,
      followUpBy: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const session = {
    id: reservation.stripeCheckoutSessionId,
    metadata: { reservationId: reservation.id, offerKey: "splash-1900" },
    currency: "usd",
    amount_total: 190000,
    payment_status: "paid",
    payment_intent: "pi_test_splash",
  };
  await processStripeEvent({
    type: "checkout.session.completed",
    data: { object: session },
  } as never);

  const [paid] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(paid?.status, "paid");
  assert.equal(paid?.paymentStatus, "paid");
  assert.equal(paid?.creativeStatus, "awaiting_upload");
  assert.equal(paid?.stripePaymentIntentId, "pi_test_splash");
  const paidAt = paid?.paidAt?.getTime();

  // Stripe retries completed events; the conditional write keeps the first
  // confirmed payment timestamp and never reopens the creative state.
  await processStripeEvent({
    type: "checkout.session.completed",
    data: { object: session },
  } as never);
  const [retried] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(retried?.paidAt?.getTime(), paidAt);
  assert.equal(retried?.creativeStatus, "awaiting_upload");

  const [asyncReservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `async-${randomUUID()}@example.com`,
      promotedOffer: "Async payment recovery launch",
      launchWindow: "within_30_days",
      status: "payment_pending",
      paymentStatus: "checkout_created",
      creativeStatus: "locked",
      offerKey: "splash-1900",
      amountCents: 190000,
      currency: "usd",
      activationToken: randomUUID(),
      stripeCheckoutSessionId: `cs_test_${randomUUID().replaceAll("-", "")}`,
      followUpBy: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning();
  assert.ok(asyncReservation);
  createdReservationIds.push(asyncReservation.id);
  const asyncSession = {
    id: asyncReservation.stripeCheckoutSessionId,
    metadata: { reservationId: asyncReservation.id, offerKey: "splash-1900" },
    currency: "usd",
    amount_total: 190000,
    payment_status: "unpaid",
  };
  await processStripeEvent({
    type: "checkout.session.completed",
    data: { object: asyncSession },
  } as never);
  const [processing] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, asyncReservation.id));
  assert.equal(processing?.paymentStatus, "checkout_created");
  assert.equal(processing?.status, "payment_pending");

  // A later async success remains attributable to the original session.
  await processStripeEvent({
    type: "checkout.session.async_payment_succeeded",
    data: { object: { ...asyncSession, payment_status: "paid" } },
  } as never);
  const [asyncPaid] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, asyncReservation.id));
  assert.equal(asyncPaid?.paymentStatus, "paid");
  assert.equal(asyncPaid?.creativeStatus, "awaiting_upload");

  const [recoverableReservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `recoverable-${randomUUID()}@example.com`,
      promotedOffer: "Recoverable checkout launch",
      launchWindow: "within_30_days",
      status: "payment_pending",
      paymentStatus: "checkout_creating",
      creativeStatus: "locked",
      offerKey: "splash-1900",
      amountCents: 190000,
      currency: "usd",
      activationToken: randomUUID(),
      checkoutAttempt: 1,
      followUpBy: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning();
  assert.ok(recoverableReservation);
  createdReservationIds.push(recoverableReservation.id);
  const recoverableSessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
  // If Stripe created a session but the database attachment failed and Stripe
  // could not expire it, the signed success event must still reconcile it.
  await processStripeEvent({
    type: "checkout.session.async_payment_succeeded",
    data: {
      object: {
        id: recoverableSessionId,
        metadata: {
          reservationId: recoverableReservation.id,
          offerKey: "splash-1900",
        },
        currency: "usd",
        amount_total: 190000,
        payment_status: "paid",
        payment_intent: "pi_test_recoverable",
      },
    },
  } as never);
  const [recovered] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, recoverableReservation.id));
  assert.equal(recovered?.paymentStatus, "paid");
  assert.equal(recovered?.stripeCheckoutSessionId, recoverableSessionId);
  assert.equal(recovered?.creativeStatus, "awaiting_upload");

  const [cancelledReservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `cancelled-${randomUUID()}@example.com`,
      promotedOffer: "Cancelled recovery launch",
      launchWindow: "planning_ahead",
      status: "payment_pending",
      paymentStatus: "checkout_created",
      creativeStatus: "locked",
      activationToken: randomUUID(),
      stripeCheckoutSessionId: `cs_test_${randomUUID().replaceAll("-", "")}`,
      followUpBy: new Date(Date.now() + 48 * 60 * 60 * 1000),
    })
    .returning();
  assert.ok(cancelledReservation);
  createdReservationIds.push(cancelledReservation.id);
  await processStripeEvent({
    type: "checkout.session.async_payment_failed",
    data: {
      object: {
        id: cancelledReservation.stripeCheckoutSessionId,
        metadata: { reservationId: cancelledReservation.id },
      },
    },
  } as never);
  const [cancelled] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, cancelledReservation.id));
  assert.equal(cancelled?.status, "approved");
  assert.equal(cancelled?.paymentStatus, "failed");
  assert.equal(cancelled?.creativeStatus, "locked");
});

test("an earlier attempt failure cannot release a newer unresolved checkout claim", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `stale-failure-${randomUUID()}@example.com`,
      status: "payment_pending",
      paymentStatus: "checkout_creating",
      creativeStatus: "locked",
      checkoutAttempt: 2,
      inventoryHeldAt: old,
      createdAt: old,
      updatedAt: old,
      followUpBy: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  await processStripeEvent({
    type: "checkout.session.async_payment_failed",
    data: {
      object: {
        id: `cs_test_attempt_1_${randomUUID().replaceAll("-", "")}`,
        metadata: {
          reservationId: reservation.id,
          checkoutAttempt: "1",
        },
      },
    },
  } as never);

  const [stillCreating] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(stillCreating?.status, "payment_pending");
  assert.equal(stillCreating?.paymentStatus, "checkout_creating");
  assert.equal(stillCreating?.checkoutAttempt, 2);

  let stripeReconciliationCalls = 0;
  const cleanup = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
    retrieveSession: async () => {
      stripeReconciliationCalls += 1;
      throw new Error("No session is attached to the unresolved attempt.");
    },
  });
  assert.equal(cleanup.expiredUnpaid, 0);
  assert.equal(cleanup.skippedProcessing, 1);
  assert.equal(stripeReconciliationCalls, 0);
  const [protectedReservation] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(protectedReservation?.status, "payment_pending");
  assert.equal(protectedReservation?.paymentStatus, "checkout_creating");
  assert.equal(
    protectedReservation?.lifecycleReason,
    "checkout_reconciliation_required",
  );
});

test("cleanup recovers a lost Stripe response once and preserves payment during recovery", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const checkoutRequest = {
    mode: "payment",
    client_reference_id: "",
    customer_email: `recovery-${randomUUID()}@example.com`,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: 190000,
          product_data: { name: "Birch Reserve Display Reserve" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      reservationId: "",
      offerKey: "splash-1900",
      checkoutAttempt: "1",
    },
    success_url: "https://reserve.example.com/success",
    cancel_url: "https://reserve.example.com/cancel",
    allow_promotion_codes: false,
  };
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: checkoutRequest.customer_email,
      status: "payment_pending",
      offerKey: "splash-1900",
      amountCents: 190000,
      paymentStatus: "checkout_creating",
      creativeStatus: "locked",
      checkoutAttempt: 1,
      checkoutIdempotencyKey: `recovery:${randomUUID()}`,
      checkoutAttemptStartedAt: old,
      inventoryHeldAt: old,
      createdAt: old,
      updatedAt: old,
      followUpBy: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);
  checkoutRequest.client_reference_id = reservation.id;
  checkoutRequest.metadata.reservationId = reservation.id;
  await db
    .update(splashAdReservationsTable)
    .set({ checkoutRequest, updatedAt: old })
    .where(eq(splashAdReservationsTable.id, reservation.id));

  let createCalls = 0;
  let recoveredKey = "";
  setStripeCheckoutFunctionsForTests({
    create: async (params, idempotencyKey) => {
      createCalls += 1;
      recoveredKey = idempotencyKey;
      assert.deepEqual(params, checkoutRequest);
      return {
        id: `cs_recovered_${reservation.id}`,
        url: "https://checkout.stripe.test/recovered",
        status: "open",
        payment_status: "unpaid",
        currency: "usd",
        amount_total: 190000,
        metadata: checkoutRequest.metadata,
      } as never;
    },
    retrieve: async () =>
      ({
        id: `cs_recovered_${reservation.id}`,
        url: "https://checkout.stripe.test/recovered",
        status: "open",
        payment_status: "unpaid",
        currency: "usd",
        amount_total: 190000,
        metadata: checkoutRequest.metadata,
      }) as never,
  });
  try {
    const first = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
    });
    assert.equal(first.reconciledCheckouts, 1);
    assert.equal(createCalls, 1);
    assert.equal(recoveredKey, reservation.checkoutIdempotencyKey);

    const second = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
    });
    assert.equal(second.reconciledCheckouts, 0);
    assert.equal(createCalls, 1);

    const [attached] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(attached?.paymentStatus, "checkout_created");
    assert.equal(attached?.stripeCheckoutUrl, "https://checkout.stripe.test/recovered");

    await db
      .update(splashAdReservationsTable)
      .set({
        paymentStatus: "checkout_creating",
        stripeCheckoutSessionId: null,
        stripeCheckoutUrl: null,
        lifecycleReason: "checkout_reconciliation_required",
        updatedAt: old,
      })
      .where(eq(splashAdReservationsTable.id, reservation.id));
    setStripeCheckoutFunctionsForTests({
      create: async () =>
        ({
          id: `cs_paid_${reservation.id}`,
          status: "open",
          payment_status: "unpaid",
          currency: "usd",
          amount_total: 190000,
          metadata: checkoutRequest.metadata,
        }) as never,
      retrieve: async () =>
        ({
          id: `cs_paid_${reservation.id}`,
          status: "complete",
          payment_status: "paid",
          payment_intent: "pi_recovered",
          currency: "usd",
          amount_total: 190000,
          metadata: checkoutRequest.metadata,
        }) as never,
    });
    const paid = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
    });
    assert.equal(paid.reconciledCheckouts, 1);
    const [paidReservation] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(paidReservation?.paymentStatus, "paid");
    assert.equal(paidReservation?.stripePaymentIntentId, "pi_recovered");
  } finally {
    setStripeCheckoutFunctionsForTests();
  }
});

test("checkout recovery releases confirmed cancellation and records the latest error for staff", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `cancel-recovery-${randomUUID()}@example.com`,
      status: "payment_pending",
      offerKey: "splash-1900",
      amountCents: 190000,
      paymentStatus: "checkout_creating",
      creativeStatus: "locked",
      checkoutAttempt: 1,
      checkoutRequest: {
        mode: "payment",
        client_reference_id: "cancel-recovery",
        customer_email: `cancel-recovery-${randomUUID()}@example.com`,
        success_url: "https://reserve.example.com/success",
        cancel_url: "https://reserve.example.com/cancel",
      },
      checkoutIdempotencyKey: `cancel-recovery:${randomUUID()}`,
      checkoutAttemptStartedAt: old,
      lifecycleReason: "checkout_reconciliation_required",
      inventoryHeldAt: old,
      createdAt: old,
      updatedAt: old,
      followUpBy: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  setStripeCheckoutFunctionsForTests({
    create: async () =>
      ({
        id: `cs_unresolved_${reservation.id}`,
        status: "open",
        payment_status: "unpaid",
        currency: "usd",
        amount_total: 190000,
        metadata: {
          reservationId: reservation.id,
          offerKey: "splash-1900",
          checkoutAttempt: "1",
        },
      }) as never,
    retrieve: async () => {
      throw new Error("Latest recovery failure");
    },
  });
  try {
    const failed = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
    });
    assert.equal(failed.skippedProcessing, 1);
    const [unresolved] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(unresolved?.checkoutRecoveryError, "Latest recovery failure");
    assert.ok(unresolved?.checkoutRecoveryAttemptedAt);

    const unauthenticated = await fetch(
      `${baseUrl}/launch/admin/splash/${reservation.id}/checkout-recovery`,
    );
    assert.equal(unauthenticated.status, 401);

    const staffEmail = `recovery-staff-${randomUUID()}@example.com`;
    const clerkUserId = `user_${randomUUID()}`;
    createdStaffEmails.push(staffEmail);
    await db.insert(salesStaffAccessTable).values({
      normalizedEmail: staffEmail,
      displayName: "Recovery Staff",
      clerkUserId,
    });
    const staffResponse = await fetch(
      `${baseUrl}/launch/admin/splash/${reservation.id}/checkout-recovery`,
      {
        headers: {
          "x-test-clerk-user-id": clerkUserId,
          "x-test-staff-email": staffEmail,
          "x-test-staff-name": "Recovery Staff",
        },
      },
    );
    assert.equal(staffResponse.status, 200);
    const staffView = (await staffResponse.json()) as Record<string, unknown>;
    assert.equal(staffView.reconciliationRequired, true);
    assert.equal(staffView.recoveryError, "Latest recovery failure");
    const unresolvedResponse = await fetch(
      `${baseUrl}/launch/admin/splash/checkout-recovery`,
      {
        headers: {
          "x-test-clerk-user-id": clerkUserId,
          "x-test-staff-email": staffEmail,
          "x-test-staff-name": "Recovery Staff",
        },
      },
    );
    assert.equal(unresolvedResponse.status, 200);
    const unresolvedView = (await unresolvedResponse.json()) as {
      unresolved: Array<Record<string, unknown>>;
    };
    assert.equal(
      unresolvedView.unresolved.some(
        (entry) =>
          entry.reservationId === reservation.id &&
          entry.recoveryError === "Latest recovery failure",
      ),
      true,
    );

    await db
      .update(splashAdReservationsTable)
      .set({ updatedAt: old })
      .where(eq(splashAdReservationsTable.id, reservation.id));
    setStripeCheckoutFunctionsForTests({
      create: async () =>
        ({
          id: `cs_expired_${reservation.id}`,
          status: "open",
          payment_status: "unpaid",
          currency: "usd",
          amount_total: 190000,
          metadata: {
            reservationId: reservation.id,
            offerKey: "splash-1900",
            checkoutAttempt: "1",
          },
        }) as never,
      retrieve: async () =>
        ({
          id: `cs_expired_${reservation.id}`,
          status: "expired",
          payment_status: "unpaid",
          currency: "usd",
          amount_total: 190000,
          metadata: {
            reservationId: reservation.id,
            offerKey: "splash-1900",
            checkoutAttempt: "1",
          },
        }) as never,
    });
    const cancelled = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
    });
    assert.equal(cancelled.reconciledCheckouts, 1);
    const [released] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(released?.status, "expired");
    assert.equal(released?.paymentStatus, "failed");
    assert.equal(released?.checkoutRecoveryError, null);

    await processStripeEvent({
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: `cs_expired_${reservation.id}`,
          status: "complete",
          payment_status: "paid",
          payment_intent: "pi_after_recovery_expiry",
          currency: "usd",
          amount_total: 190000,
          metadata: {
            reservationId: reservation.id,
            offerKey: "splash-1900",
            checkoutAttempt: "1",
          },
        },
      },
    } as never);
    const [latePaid] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(latePaid?.status, "paid");
    assert.equal(latePaid?.paymentStatus, "paid");
    assert.equal(latePaid?.stripePaymentIntentId, "pi_after_recovery_expiry");
  } finally {
    setStripeCheckoutFunctionsForTests();
  }
});

test("payment that lands during checkout recovery wins over a cancellation result", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `payment-race-${randomUUID()}@example.com`,
      status: "payment_pending",
      offerKey: "splash-1900",
      paymentStatus: "checkout_creating",
      creativeStatus: "locked",
      amountCents: 190000,
      currency: "usd",
      checkoutAttempt: 1,
      checkoutRequest: {
        mode: "payment",
        client_reference_id: "payment-race",
        customer_email: `payment-race-${randomUUID()}@example.com`,
        success_url: "https://reserve.example.com/success",
        cancel_url: "https://reserve.example.com/cancel",
      },
      checkoutIdempotencyKey: `payment-race:${randomUUID()}`,
      checkoutAttemptStartedAt: old,
      lifecycleReason: "checkout_reconciliation_required",
      inventoryHeldAt: old,
      createdAt: old,
      updatedAt: old,
      followUpBy: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  let releaseReplay: (() => void) | undefined;
  let replayStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    replayStarted = resolve;
  });
  const continueReplay = new Promise<void>((resolve) => {
    releaseReplay = resolve;
  });
  setStripeCheckoutFunctionsForTests({
    create: async () => {
      replayStarted?.();
      await continueReplay;
      return {
        id: `cs_race_${reservation.id}`,
        status: "open",
        payment_status: "unpaid",
        currency: "usd",
        amount_total: 190000,
        metadata: {
          reservationId: reservation.id,
          offerKey: "splash-1900",
          checkoutAttempt: "1",
        },
      } as never;
    },
    retrieve: async () =>
      ({
        id: `cs_race_${reservation.id}`,
        status: "expired",
        payment_status: "unpaid",
        currency: "usd",
        amount_total: 190000,
        metadata: {
          reservationId: reservation.id,
          offerKey: "splash-1900",
          checkoutAttempt: "1",
        },
      }) as never,
  });
  try {
    const cleanup = cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
    });
    await started;
    await processStripeEvent({
      type: "checkout.session.async_payment_succeeded",
      data: {
        object: {
          id: `cs_race_${reservation.id}`,
          status: "complete",
          payment_status: "paid",
          payment_intent: "pi_recovery_race",
          currency: "usd",
          amount_total: 190000,
          metadata: {
            reservationId: reservation.id,
            offerKey: "splash-1900",
            checkoutAttempt: "1",
          },
        },
      },
    } as never);
    releaseReplay?.();
    await cleanup;

    const [paid] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(paid?.status, "paid");
    assert.equal(paid?.paymentStatus, "paid");
    assert.equal(paid?.stripePaymentIntentId, "pi_recovery_race");
  } finally {
    releaseReplay?.();
    setStripeCheckoutFunctionsForTests();
  }
});

test("checkout recovery never replays beyond Stripe's idempotency retention window", async () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `old-recovery-${randomUUID()}@example.com`,
      status: "payment_pending",
      paymentStatus: "checkout_creating",
      creativeStatus: "locked",
      checkoutAttempt: 1,
      checkoutRequest: {
        mode: "payment",
        client_reference_id: "old-recovery",
        customer_email: `old-recovery-${randomUUID()}@example.com`,
        success_url: "https://reserve.example.com/success",
        cancel_url: "https://reserve.example.com/cancel",
      },
      checkoutIdempotencyKey: `old-recovery:${randomUUID()}`,
      checkoutAttemptStartedAt: old,
      lifecycleReason: "checkout_reconciliation_required",
      inventoryHeldAt: old,
      createdAt: old,
      updatedAt: old,
      followUpBy: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  let createCalls = 0;
  setStripeCheckoutFunctionsForTests({
    create: async () => {
      createCalls += 1;
      throw new Error("An expired idempotency key must never be replayed.");
    },
  });
  try {
    const result = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
    });
    assert.equal(result.reconciledCheckouts, 0);
    assert.equal(result.skippedProcessing, 1);
    assert.equal(createCalls, 0);
    const [unresolved] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(unresolved?.paymentStatus, "checkout_creating");
    assert.match(unresolved?.checkoutRecoveryError ?? "", /retention may have expired/i);
  } finally {
    setStripeCheckoutFunctionsForTests();
  }
});

test("cleanup expires abandoned holds but preserves unresolved payment claims", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const [abandoned, processing, staleProcessing, live, completed] = await db
    .insert(splashAdReservationsTable)
    .values([
      {
        email: `abandoned-${randomUUID()}@example.com`,
        status: "seat_held",
        paymentStatus: "unpaid",
        creativeStatus: "locked",
        followUpBy: old,
        createdAt: old,
      },
      {
        email: `processing-${randomUUID()}@example.com`,
        status: "payment_pending",
        paymentStatus: "checkout_creating",
        creativeStatus: "locked",
        followUpBy: old,
        createdAt: old,
        updatedAt: new Date(),
      },
      {
        email: `stale-processing-${randomUUID()}@example.com`,
        status: "payment_pending",
        paymentStatus: "checkout_creating",
        creativeStatus: "locked",
        followUpBy: old,
        createdAt: old,
        updatedAt: old,
      },
      {
        email: `live-${randomUUID()}@example.com`,
        status: "live",
        paymentStatus: "paid",
        creativeStatus: "awaiting_upload",
        paidAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
        followUpBy: old,
        createdAt: old,
      },
      {
        email: `completed-${randomUUID()}@example.com`,
        status: "completed",
        paymentStatus: "paid",
        creativeStatus: "awaiting_upload",
        paidAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
        followUpBy: old,
        createdAt: old,
      },
    ])
    .returning();
  assert.ok(abandoned && processing && staleProcessing && live && completed);
  createdReservationIds.push(
    abandoned.id,
    processing.id,
    staleProcessing.id,
    live.id,
    completed.id,
  );

  const reservationIds = [
    abandoned.id,
    processing.id,
    staleProcessing.id,
    live.id,
    completed.id,
  ];
  const first = await cleanupSplashReservations({ now: new Date(), reservationIds });
  const second = await cleanupSplashReservations({ now: new Date(), reservationIds });
  assert.equal(first.expiredUnpaid, 1);
  assert.equal(first.skippedProcessing, 1);
  assert.equal(second.expiredUnpaid, 0);

  const rows = await db
    .select()
    .from(splashAdReservationsTable)
    .where(inArray(splashAdReservationsTable.id, reservationIds));
  assert.equal(rows.find((row) => row.id === abandoned.id)?.status, "expired");
  assert.equal(rows.find((row) => row.id === processing.id)?.status, "payment_pending");
  assert.equal(
    rows.find((row) => row.id === staleProcessing.id)?.status,
    "payment_pending",
  );
  assert.equal(
    rows.find((row) => row.id === staleProcessing.id)?.lifecycleReason,
    "checkout_reconciliation_required",
  );
  assert.equal(rows.find((row) => row.id === live.id)?.status, "live");
  assert.equal(rows.find((row) => row.id === completed.id)?.status, "completed");
});

test("cleanup releases a completed checkout only after Stripe reports final failure", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const sessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `async-failed-${randomUUID()}@example.com`,
      status: "approved",
      paymentStatus: "failed",
      creativeStatus: "locked",
      stripeCheckoutSessionId: sessionId,
      followUpBy: old,
      createdAt: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const result = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
    retrieveSession: async () =>
      ({ id: sessionId, status: "complete", payment_status: "unpaid" }) as never,
  });
  assert.equal(result.expiredUnpaid, 1);
  const [expired] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(expired?.status, "expired");
});

test("a fresh checkout claim made after candidate selection defeats stale cleanup", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `selection-race-${randomUUID()}@example.com`,
      status: "seat_held",
      paymentStatus: "unpaid",
      creativeStatus: "locked",
      followUpBy: old,
      createdAt: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const result = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
    afterCandidatesSelected: async () => {
      await db
        .update(splashAdReservationsTable)
        .set({
          status: "payment_pending",
          paymentStatus: "checkout_creating",
          checkoutAttempt: 1,
          updatedAt: new Date(),
        })
        .where(eq(splashAdReservationsTable.id, reservation.id));
    },
  });
  assert.equal(result.expiredUnpaid, 0);
  const [claimed] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(claimed?.status, "payment_pending");
  assert.equal(claimed?.paymentStatus, "checkout_creating");
});

test("cleanup and a replacement buyer defeat an in-flight checkout renewal", async () => {
  const previousDisabled = process.env.STRIPE_CHECKOUT_DISABLED;
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const previousPublicUrl = process.env.SPLASH_AD_PUBLIC_URL;
  const previousTotal = process.env.SEATS_TOTAL;
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const sessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
  const activationToken = randomUUID();
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `renewal-race-${randomUUID()}@example.com`,
      status: "payment_pending",
      paymentStatus: "checkout_created",
      creativeStatus: "locked",
      offerKey: "reserve-990",
      amountCents: 99000,
      currency: "usd",
      activationToken,
      stripeCheckoutSessionId: sessionId,
      stripeCheckoutUrl: "https://checkout.stripe.test/renewal-race",
      followUpBy: old,
      createdAt: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);
  const counts = await getSplashSeatCounts();
  process.env.SEATS_TOTAL = String(counts.seats_paid + counts.seats_held);
  process.env.STRIPE_CHECKOUT_DISABLED = "false";
  process.env.SPLASH_AD_PUBLIC_URL = "https://reserve.example.com";
  process.env.STRIPE_SECRET_KEY = "sk_test_birch_checkout_wiring_only";

  let signalRetrieval!: () => void;
  let releaseRetrieval!: () => void;
  const retrievalStarted = new Promise<void>((resolve) => {
    signalRetrieval = resolve;
  });
  const retrievalRelease = new Promise<void>((resolve) => {
    releaseRetrieval = resolve;
  });
  setStripeCheckoutFunctionsForTests({
    retrieve: async () => {
      signalRetrieval();
      await retrievalRelease;
      return {
        id: sessionId,
        status: "expired",
        payment_status: "unpaid",
      } as never;
    },
  });

  try {
    const renewalRequest = fetch(`${baseUrl}/launch/splash/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activationToken }),
    });
    await retrievalStarted;

    const cleanup = await cleanupSplashReservations({
      now: new Date(),
      reservationIds: [reservation.id],
      retrieveSession: async () =>
        ({ id: sessionId, status: "open", payment_status: "unpaid" }) as never,
      expireSession: async () => undefined,
    });
    assert.equal(cleanup.expiredUnpaid, 1);

    process.env.STRIPE_CHECKOUT_DISABLED = "true";
    const replacementResponse = await fetch(
      `${new URL(baseUrl).origin}/v1/checkout`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: "reserve-990",
          email: `replacement-${randomUUID()}@example.com`,
          brand: "Replacement Buyer",
          idempotency_key: randomUUID(),
        }),
      },
    );
    const replacement = (await replacementResponse.json()) as Record<string, unknown>;
    assert.equal(replacementResponse.status, 503);
    createdReservationIds.push(String(replacement.order_id));

    releaseRetrieval();
    const renewalResponse = await renewalRequest;
    assert.equal(renewalResponse.status, 409);
    const [stillExpired] = await db
      .select()
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, reservation.id));
    assert.equal(stillExpired?.status, "expired");
  } finally {
    releaseRetrieval();
    setStripeCheckoutFunctionsForTests();
    if (previousDisabled === undefined) delete process.env.STRIPE_CHECKOUT_DISABLED;
    else process.env.STRIPE_CHECKOUT_DISABLED = previousDisabled;
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    if (previousPublicUrl === undefined) delete process.env.SPLASH_AD_PUBLIC_URL;
    else process.env.SPLASH_AD_PUBLIC_URL = previousPublicUrl;
    if (previousTotal === undefined) delete process.env.SEATS_TOTAL;
    else process.env.SEATS_TOTAL = previousTotal;
  }
});

test("a verified Stripe payment arriving after cleanup restores an expired hold", async () => {
  const old = new Date(Date.now() - 21 * 60 * 1000);
  const sessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `cutoff-${randomUUID()}@example.com`,
      status: "payment_pending",
      paymentStatus: "checkout_created",
      creativeStatus: "locked",
      offerKey: "splash-1900",
      amountCents: 190000,
      currency: "usd",
      stripeCheckoutSessionId: sessionId,
      stripeCheckoutUrl: "https://checkout.stripe.test/session",
      followUpBy: old,
      createdAt: old,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const cleanup = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
    retrieveSession: async () =>
      ({ id: sessionId, status: "open", payment_status: "unpaid" }) as never,
    expireSession: async () => undefined,
  });
  assert.equal(cleanup.expiredUnpaid, 1);

  await processStripeEvent({
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        metadata: {
          reservationId: reservation.id,
          offerKey: "splash-1900",
        },
        currency: "usd",
        amount_total: 190000,
        payment_status: "paid",
        payment_intent: "pi_cutoff",
      },
    },
  } as never);
  const [paid] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(paid?.status, "paid");
  assert.equal(paid?.paymentStatus, "paid");
});

test("paid reservations missing creative for 72 hours recycle without losing payment history", async () => {
  const paidAt = new Date(Date.now() - 73 * 60 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `recycle-${randomUUID()}@example.com`,
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      stripeCheckoutSessionId: `cs_test_${randomUUID().replaceAll("-", "")}`,
      stripePaymentIntentId: `pi_${randomUUID().replaceAll("-", "")}`,
      paidAt,
      followUpBy: paidAt,
      createdAt: paidAt,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const first = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
  });
  const second = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
  });
  assert.equal(first.recycledPaid, 1);
  assert.equal(second.recycledPaid, 0);
  const [recycled] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(recycled?.status, "recycled");
  assert.equal(recycled?.paymentStatus, "paid");
  assert.equal(recycled?.paidAt?.getTime(), paidAt.getTime());
  assert.equal(
    recycled?.stripePaymentIntentId,
    reservation.stripePaymentIntentId,
  );
});

test("paid reservations receive one staff warning in the 24 hours before the creative deadline", async () => {
  const now = new Date();
  const paidAt = new Date(now.getTime() - 49 * 60 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      brandName: "Deadline Brand",
      email: `warning-${randomUUID()}@example.com`,
      websiteUrl: "https://deadline.example.com",
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      paidAt,
      followUpBy: paidAt,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const deliveries: Array<{
    reservationId: string;
    deadline: Date;
    creative: string;
  }> = [];
  const send = async (row: typeof reservation, deadline: Date) => {
    deliveries.push({
      reservationId: row.id,
      deadline,
      creative: row.creativeStatus,
    });
  };
  const first = await cleanupSplashReservations({
    now,
    reservationIds: [reservation.id],
    sendCreativeDeadlineWarning: send,
  });
  const second = await cleanupSplashReservations({
    now,
    reservationIds: [reservation.id],
    sendCreativeDeadlineWarning: send,
  });

  assert.equal(first.creativeWarningsSent, 1);
  assert.equal(second.creativeWarningsSent, 0);
  assert.deepEqual(deliveries, [
    {
      reservationId: reservation.id,
      deadline: new Date(paidAt.getTime() + 72 * 60 * 60 * 1000),
      creative: "awaiting_upload",
    },
  ]);
  const [warned] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(warned?.creativeDeadlineWarningStatus, "sent");
  assert.ok(warned?.creativeDeadlineWarningDeliveredAt);
});

test("creative deadline Slack warnings include reference, buyer context, deadline, and state", async () => {
  const paidAt = new Date();
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      brandName: "Warning Details Brand",
      email: `warning-details-${randomUUID()}@example.com`,
      websiteUrl: "https://warning-details.example.com",
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      paidAt,
      followUpBy: paidAt,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);
  const deadline = new Date(paidAt.getTime() + 72 * 60 * 60 * 1000);
  let capturedBody = "";

  await sendCreativeDeadlineSlackWarning(
    reservation,
    deadline,
    async (_path, options) => {
      capturedBody = options?.body ?? "";
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );

  const payload = JSON.parse(capturedBody) as {
    client_msg_id: string;
    text: string;
  };
  assert.equal(payload.client_msg_id, reservation.id);
  assert.match(payload.text, new RegExp(reservation.id));
  assert.match(payload.text, /Warning Details Brand/);
  assert.match(payload.text, new RegExp(reservation.email));
  assert.match(payload.text, /https:\/\/warning-details\.example\.com/);
  assert.match(payload.text, new RegExp(deadline.toISOString()));
  assert.match(payload.text, /Creative state: awaiting_upload/);
});

test("creative uploaded before the warning run suppresses the deadline warning", async () => {
  const now = new Date();
  const paidAt = new Date(now.getTime() - 49 * 60 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `warning-creative-${randomUUID()}@example.com`,
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      paidAt,
      followUpBy: paidAt,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);
  await recordSplashCreativeReceipt(reservation.id, "submitted");

  let deliveries = 0;
  const result = await cleanupSplashReservations({
    now,
    reservationIds: [reservation.id],
    sendCreativeDeadlineWarning: async () => {
      deliveries += 1;
    },
  });
  assert.equal(result.creativeWarningsSent, 0);
  assert.equal(deliveries, 0);
});

test("creative warning failures remain retryable and never block later recycling", async () => {
  const warningNow = new Date();
  const paidAt = new Date(warningNow.getTime() - 49 * 60 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `warning-failed-${randomUUID()}@example.com`,
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      paidAt,
      followUpBy: paidAt,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const failed = await cleanupSplashReservations({
    now: warningNow,
    reservationIds: [reservation.id],
    sendCreativeDeadlineWarning: async () => {
      throw new Error("Simulated warning outage");
    },
  });
  assert.equal(failed.creativeWarningsFailed, 1);
  const [failedRow] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(failedRow?.creativeDeadlineWarningStatus, "failed");
  assert.match(
    failedRow?.creativeDeadlineWarningError ?? "",
    /Simulated warning outage/,
  );

  let retryDeliveries = 0;
  const retried = await cleanupSplashReservations({
    now: new Date(warningNow.getTime() + 60_000),
    reservationIds: [reservation.id],
    sendCreativeDeadlineWarning: async () => {
      retryDeliveries += 1;
    },
  });
  const duplicate = await cleanupSplashReservations({
    now: new Date(warningNow.getTime() + 120_000),
    reservationIds: [reservation.id],
    sendCreativeDeadlineWarning: async () => {
      retryDeliveries += 1;
    },
  });
  assert.equal(retried.creativeWarningsSent, 1);
  assert.equal(duplicate.creativeWarningsSent, 0);
  assert.equal(retryDeliveries, 1);

  const recycled = await cleanupSplashReservations({
    now: new Date(paidAt.getTime() + 73 * 60 * 60 * 1000),
    reservationIds: [reservation.id],
    sendCreativeDeadlineWarning: async () => {
      throw new Error("Warning delivery must not gate recycling");
    },
  });
  assert.equal(recycled.recycledPaid, 1);
});

test("recording paid creative is idempotent and prevents 72-hour recycling", async () => {
  const paidAt = new Date(Date.now() - 73 * 60 * 60 * 1000);
  const [reservation] = await db
    .insert(splashAdReservationsTable)
    .values({
      email: `creative-received-${randomUUID()}@example.com`,
      status: "paid",
      paymentStatus: "paid",
      creativeStatus: "awaiting_upload",
      paidAt,
      followUpBy: paidAt,
      createdAt: paidAt,
    })
    .returning();
  assert.ok(reservation);
  createdReservationIds.push(reservation.id);

  const first = await recordSplashCreativeReceipt(reservation.id, "submitted");
  const second = await recordSplashCreativeReceipt(reservation.id, "submitted");
  assert.equal(first.kind, "recorded");
  assert.equal(second.kind, "recorded");

  const cleanup = await cleanupSplashReservations({
    now: new Date(),
    reservationIds: [reservation.id],
  });
  assert.equal(cleanup.recycledPaid, 0);
  const [current] = await db
    .select()
    .from(splashAdReservationsTable)
    .where(eq(splashAdReservationsTable.id, reservation.id));
  assert.equal(current?.status, "paid");
  assert.equal(current?.paymentStatus, "paid");
  assert.equal(current?.creativeStatus, "submitted");

  const unauthorized = await fetch(
    `${baseUrl}/launch/admin/splash/${reservation.id}/creative`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ creativeStatus: "approved" }),
    },
  );
  assert.ok([401, 403].includes(unauthorized.status));
});
