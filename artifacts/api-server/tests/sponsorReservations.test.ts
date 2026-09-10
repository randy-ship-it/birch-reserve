import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { db, sponsorReservationsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../src/app";

const createdReservationIds: string[] = [];
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;

before(async () => {
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
      .delete(sponsorReservationsTable)
      .where(inArray(sponsorReservationsTable.id, createdReservationIds));
  }
  await closeServer?.();
});

function validRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    packageType: "brand",
    accessRoute: "open_market",
    buyerEmail: `sponsor-${randomUUID()}@example.com`,
    buyerName: "Test Buyer",
    companyName: "Test Company",
    companyWebsite: "https://example.com",
    requestedCategory: "Wellness",
    advertisingObjective: "product_discovery",
    preferredPlacement: "post_checkout",
    investmentRange: "5k_to_10k",
    launchTimeline: "within_30_days",
    creativeStatus: "creative_ready",
    additionalNotes: "Interested in a recovery-focused launch.",
    termsAccepted: true,
    marketingConsent: false,
    ...overrides,
  };
}

async function createRequest(
  overrides: Record<string, unknown> = {},
): Promise<{
  reservationId: string;
  status: string;
  lookupToken: string;
}> {
  const response = await fetch(`${baseUrl}/launch/sponsor/reserve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validRequest(overrides)),
  });
  assert.equal(response.status, 202);

  const body = (await response.json()) as {
    reservationId: string;
    status: string;
    lookupToken: string;
  };
  createdReservationIds.push(body.reservationId);
  return body;
}

test("offer is request-only and exposes no payment integration fields", async () => {
  const response = await fetch(`${baseUrl}/launch/sponsor/offer`);
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    offerStatus: string;
    packages: Array<Record<string, unknown>>;
  };

  assert.equal(body.offerStatus, "reserve_only");
  assert.equal(body.packages.length, 2);
  for (const sponsorPackage of body.packages) {
    assert.equal("checkoutAvailable" in sponsorPackage, false);
  }

});

test("every sponsor package creates a durable request-only record", async () => {
  for (const packageType of [
    "brand",
    "retail",
    "other",
    "clinic",
    "physio",
    "test_pilot",
  ]) {
    const receipt = await createRequest({
      packageType,
      accessRoute: packageType === "test_pilot" ? "test_pilot" : "open_market",
      buyerEmail: `${packageType}-${randomUUID()}@example.com`,
      marketingConsent: true,
    });

    assert.equal(receipt.status, "reserve_only");
    assert.deepEqual(Object.keys(receipt).sort(), [
      "lookupToken",
      "reservationId",
      "status",
    ]);

    const [row] = await db
      .select()
      .from(sponsorReservationsTable)
      .where(eq(sponsorReservationsTable.id, receipt.reservationId));

    assert.ok(row);
    assert.equal(row.status, "reserve_only");
    assert.equal(row.accessRoute, packageType === "test_pilot" ? "test_pilot" : "open_market");
    assert.equal(row.contributorVerificationStatus, "not_applicable");
    assert.equal(row.marketingConsent, true);
    assert.equal(row.advertisingObjective, "product_discovery");
    assert.equal(row.preferredPlacement, "post_checkout");
    assert.equal(row.investmentRange, "5k_to_10k");
    assert.equal(row.launchTimeline, "within_30_days");
    assert.equal(row.creativeStatus, "creative_ready");
    assert.equal(row.additionalNotes, "Interested in a recovery-focused launch.");
    assert.equal(row.metadata?.["qualification_schema_version"], 2);
    assert.equal(row.metadata?.["payment_collection"], "not_available_in_app");

    if (packageType === "test_pilot") {
      assert.equal(row.packageKey, "test_pilot_10k_cad");
      assert.equal(row.amountCents, "1000000");
    } else if (packageType === "clinic" || packageType === "physio") {
      assert.equal(row.packageKey, "founding_sponsor_clinic_5k_cad");
    } else {
      assert.equal(row.packageKey, "founding_sponsor_brand_5k_cad");
    }
  }
});

test("contributor access is recorded as pending verification and cannot self-grant priority", async () => {
  const contributorReceipt = await createRequest({
    accessRoute: "ecosystem_contributor",
    packageType: "brand",
  });
  const [contributorRow] = await db
    .select()
    .from(sponsorReservationsTable)
    .where(eq(sponsorReservationsTable.id, contributorReceipt.reservationId));

  assert.ok(contributorRow);
  assert.equal(contributorRow.accessRoute, "ecosystem_contributor");
  assert.equal(contributorRow.contributorVerificationStatus, "pending");

  const openMarketReceipt = await createRequest({
    accessRoute: "open_market",
    packageType: "brand",
  });
  const [openMarketRow] = await db
    .select()
    .from(sponsorReservationsTable)
    .where(eq(sponsorReservationsTable.id, openMarketReceipt.reservationId));

  assert.ok(openMarketRow);
  assert.equal(openMarketRow.accessRoute, "open_market");
  assert.equal(openMarketRow.contributorVerificationStatus, "not_applicable");
});

test("reservation terms and trimmed required content are enforced", async () => {
  for (const overrides of [
    { termsAccepted: false },
    { termsAccepted: undefined },
    { packageType: "unknown" },
    { accessRoute: "verified_contributor" },
    { packageType: "test_pilot", accessRoute: "open_market" },
    { packageType: "brand", accessRoute: "test_pilot" },
    { buyerName: "  " },
    { companyName: "  " },
    { requestedCategory: "  " },
    { companyWebsite: "not-a-url" },
    { advertisingObjective: "guaranteed_sales" },
    { preferredPlacement: "homepage_takeover" },
    { investmentRange: "unlimited" },
    { launchTimeline: "tomorrow" },
    { creativeStatus: "unknown" },
    { additionalNotes: "x".repeat(1001) },
  ]) {
    const response = await fetch(`${baseUrl}/launch/sponsor/reserve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validRequest(overrides)),
    });
    assert.equal(response.status, 400);
  }
});

test("private status lookup returns request-only state", async () => {
  const receipt = await createRequest();
  const response = await fetch(
    `${baseUrl}/launch/sponsor/status?token=${encodeURIComponent(receipt.lookupToken)}`,
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    reservationId: string;
    status: string;
    packageKey: string;
    amountCents: number;
    currency: string;
  };

  assert.equal(body.reservationId, receipt.reservationId);
  assert.equal(body.status, "reserve_only");
  assert.equal(body.packageKey, "founding_sponsor_brand_5k_cad");
  assert.equal(body.amountCents, 500_000);
  assert.equal(body.currency, "cad");
});

test("invalid status tokens reveal nothing", async () => {
  const response = await fetch(
    `${baseUrl}/launch/sponsor/status?token=${randomUUID()}-${randomUUID()}`,
  );
  assert.equal(response.status, 404);
});
