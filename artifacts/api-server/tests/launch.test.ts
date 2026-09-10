import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  advertiserIntakeReviewEventsTable,
  advertiserIntakesTable,
  commercialInquiriesTable,
  db,
  pilotWaitlistEntriesTable,
  salesStaffAccessEventsTable,
  salesStaffAccessTable,
} from "@workspace/db";
import { inArray, sql } from "drizzle-orm";
import app from "../src/app";
import { buildPublicCategoryInsight } from "../src/routes/launch";
import { setSalesStaffIdentityProviderForTests } from "../src/lib/salesStaffAccess";

const testEmails: string[] = [];
const testCommercialEmails: string[] = [];
const testAdvertiserIntakeEmails: string[] = [];
const testSalesStaffEmails: string[] = [];
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;

before(async () => {
  setSalesStaffIdentityProviderForTests(async (req) => {
    const clerkUserId = req.get("x-test-clerk-user-id");
    const normalizedEmail = req.get("x-test-staff-email");
    const displayName = req.get("x-test-staff-name");
    if (!clerkUserId || !normalizedEmail || !displayName) {
      return null;
    }
    return { clerkUserId, normalizedEmail, displayName };
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
  if (testEmails.length > 0) {
    await db
      .delete(pilotWaitlistEntriesTable)
      .where(inArray(pilotWaitlistEntriesTable.normalizedEmail, testEmails));
  }
  if (testCommercialEmails.length > 0) {
    await db
      .delete(commercialInquiriesTable)
      .where(
        inArray(
          commercialInquiriesTable.normalizedEmail,
          testCommercialEmails,
        ),
      );
  }
  if (testAdvertiserIntakeEmails.length > 0) {
    await db
      .delete(advertiserIntakesTable)
      .where(
        inArray(
          advertiserIntakesTable.normalizedEmail,
          testAdvertiserIntakeEmails,
        ),
      );
  }
  if (testSalesStaffEmails.length > 0) {
    await db
      .delete(salesStaffAccessTable)
      .where(
        inArray(
          salesStaffAccessTable.normalizedEmail,
          testSalesStaffEmails,
        ),
      );
  }
  await closeServer?.();
});

test("pilot waitlist persists, deduplicates, and preserves creation order", async () => {
  const token = randomUUID();
  const firstEmail = `launch-${token}-first@example.com`;
  const secondEmail = `launch-${token}-second@example.com`;
  testEmails.push(firstEmail, secondEmail);

  const submit = (email: string) =>
    fetch(`${baseUrl}/launch/waitlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        interestType: "advertiser",
        category: "Healthcare",
        company: "Launch test",
        businessSize: "small",
        marketingConsent: false,
      }),
    });

  const firstResponse = await submit(firstEmail.toUpperCase());
  assert.equal(firstResponse.status, 202);
  const first = (await firstResponse.json()) as {
    status: string;
    requestId: string;
  };
  assert.equal(first.status, "received");
  assert.ok(first.requestId.length > 0);
  assert.deepEqual(Object.keys(first).sort(), ["requestId", "status"]);

  const duplicateResponse = await submit(` ${firstEmail} `);
  assert.equal(duplicateResponse.status, 202);
  const duplicate = (await duplicateResponse.json()) as {
    status: string;
    requestId: string;
  };
  assert.equal(duplicate.status, "received");
  assert.ok(duplicate.requestId.length > 0);
  assert.notEqual(duplicate.requestId, first.requestId);
  assert.deepEqual(Object.keys(duplicate).sort(), ["requestId", "status"]);

  const secondResponse = await submit(secondEmail);
  assert.equal(secondResponse.status, 202);
  const second = (await secondResponse.json()) as {
    status: string;
    requestId: string;
  };
  assert.equal(second.status, "received");
  assert.ok(second.requestId.length > 0);

  const rows = await db
    .select({
      normalizedEmail: pilotWaitlistEntriesTable.normalizedEmail,
      queueSequence: pilotWaitlistEntriesTable.queueSequence,
    })
    .from(pilotWaitlistEntriesTable)
    .where(
      inArray(pilotWaitlistEntriesTable.normalizedEmail, [
        firstEmail,
        secondEmail,
      ]),
    );
  assert.equal(rows.length, 2);
  const firstRow = rows.find((row) => row.normalizedEmail === firstEmail);
  const secondRow = rows.find((row) => row.normalizedEmail === secondEmail);
  assert.ok(firstRow);
  assert.ok(secondRow);
  assert.ok(firstRow.queueSequence < secondRow.queueSequence);
});

test("concurrent waitlist inserts serialize into one durable order", async () => {
  const token = randomUUID();
  const concurrentEmails = Array.from(
    { length: 6 },
    (_, index) => `launch-${token}-concurrent-${index}@example.com`,
  );
  testEmails.push(...concurrentEmails);

  const submit = (email: string) =>
    fetch(`${baseUrl}/launch/waitlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        interestType: "insights",
        marketingConsent: false,
      }),
    });

  let pendingRequests: Promise<Response[]> | undefined;
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('pilot_waitlist_entries_queue', 0))`,
    );
    pendingRequests = Promise.all(concurrentEmails.map(submit));
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  const responses = await pendingRequests;
  assert.ok(responses);
  assert.equal(responses.length, concurrentEmails.length);
  assert.ok(responses.every((response) => response.status === 202));

  const rows = await db
    .select({
      normalizedEmail: pilotWaitlistEntriesTable.normalizedEmail,
      queueSequence: pilotWaitlistEntriesTable.queueSequence,
      createdAt: pilotWaitlistEntriesTable.createdAt,
    })
    .from(pilotWaitlistEntriesTable)
    .where(
      inArray(
        pilotWaitlistEntriesTable.normalizedEmail,
        concurrentEmails,
      ),
    );
  assert.equal(rows.length, concurrentEmails.length);

  const ordered = rows.toSorted(
    (left, right) => left.queueSequence - right.queueSequence,
  );
  assert.equal(
    new Set(ordered.map((row) => row.queueSequence)).size,
    concurrentEmails.length,
  );
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(
      ordered[index - 1]!.createdAt.getTime() <=
        ordered[index]!.createdAt.getTime(),
    );
  }
});

test("pilot waitlist rejects invalid contact data", async () => {
  const response = await fetch(`${baseUrl}/launch/waitlist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "not-an-email",
      interestType: "insights",
      website: "javascript:alert(1)",
      marketingConsent: true,
    }),
  });

  assert.equal(response.status, 400);
});

test("commercial inquiries persist one request per email and inquiry type", async () => {
  const email = `commercial-${randomUUID()}@example.com`;
  testCommercialEmails.push(email);

  const submit = (
    inquiryType: "branded_hub" | "fulfillment",
    details: string,
  ) =>
    fetch(`${baseUrl}/launch/commercial-inquiries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inquiryType,
        name: "Commercial Test",
        email,
        company: "Commercial Test Co",
        website: "https://example.com",
        category: "Wellness",
        coverageRegion: "canada_and_united_states",
        details,
        transactionConsent: true,
        marketingConsent: false,
      }),
    });

  const hubResponse = await submit(
    "branded_hub",
    "We want to launch a branded clinical hub for our members.",
  );
  assert.equal(hubResponse.status, 202);
  const hubReceipt = (await hubResponse.json()) as {
    status: string;
    requestId: string;
  };
  assert.equal(hubReceipt.status, "received");
  assert.equal(hubReceipt.requestId.length, 36);

  const updatedHubResponse = await submit(
    "branded_hub",
    "We want a branded clinical hub with a custom customer journey.",
  );
  assert.equal(updatedHubResponse.status, 202);
  const updatedHubReceipt = (await updatedHubResponse.json()) as {
    requestId: string;
  };
  assert.equal(updatedHubReceipt.requestId, hubReceipt.requestId);

  const fulfillmentResponse = await submit(
    "fulfillment",
    "We need coordinated in-person customer fulfillment across Canada.",
  );
  assert.equal(fulfillmentResponse.status, 202);

  const rows = await db
    .select({
      inquiryType: commercialInquiriesTable.inquiryType,
      details: commercialInquiriesTable.details,
      transactionConsent: commercialInquiriesTable.transactionConsent,
      marketingConsent: commercialInquiriesTable.marketingConsent,
    })
    .from(commercialInquiriesTable)
    .where(
      inArray(commercialInquiriesTable.normalizedEmail, [email]),
    );

  assert.equal(rows.length, 2);
  assert.equal(
    rows.find((row) => row.inquiryType === "branded_hub")?.details,
    "We want a branded clinical hub with a custom customer journey.",
  );
  assert.ok(rows.every((row) => row.transactionConsent));
  assert.ok(rows.every((row) => row.marketingConsent === false));
});

test("commercial inquiries require transaction consent and valid URLs", async () => {
  const response = await fetch(`${baseUrl}/launch/commercial-inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      inquiryType: "fulfillment",
      name: "Commercial Test",
      email: "commercial@example.com",
      company: "Commercial Test Co",
      website: "javascript:alert(1)",
      category: "Wellness",
      coverageRegion: "canada",
      details: "We need a valid fulfillment conversation.",
      transactionConsent: false,
      marketingConsent: true,
    }),
  });

  assert.equal(response.status, 400);

  const whitespaceEmail = `commercial-whitespace-${randomUUID()}@example.com`;
  testCommercialEmails.push(whitespaceEmail);
  const whitespaceResponse = await fetch(
    `${baseUrl}/launch/commercial-inquiries`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inquiryType: "branded_hub",
        name: "Commercial Test",
        email: whitespaceEmail,
        company: "Commercial Test Co",
        website: "https://example.com",
        category: "Wellness",
        coverageRegion: "canada",
        details: "          ",
        transactionConsent: true,
        marketingConsent: false,
      }),
    },
  );

  assert.equal(whitespaceResponse.status, 400);
});

test("advertiser intake persists only structured follow-up context", async () => {
  const email = `guide-${randomUUID()}@example.com`;
  testAdvertiserIntakeEmails.push(email);

  const response = await fetch(`${baseUrl}/launch/advertiser-intake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: email.toUpperCase(),
      visitorType: "online_product",
      advertisingIntent: "interested",
      advertiserSize: "small_business",
      operatingScope: "national",
      adInterest: "display",
      source: "guide",
      followUpConsent: true,
    }),
  });

  assert.equal(response.status, 202);
  const receipt = (await response.json()) as {
    intakeId: string;
    status: string;
  };
  assert.equal(receipt.status, "received");
  assert.equal(receipt.intakeId.length, 36);

  const [row] = await db
    .select({
      normalizedEmail: advertiserIntakesTable.normalizedEmail,
      visitorType: advertiserIntakesTable.visitorType,
      advertisingIntent: advertiserIntakesTable.advertisingIntent,
      advertiserSize: advertiserIntakesTable.advertiserSize,
      operatingScope: advertiserIntakesTable.operatingScope,
      adInterest: advertiserIntakesTable.adInterest,
      source: advertiserIntakesTable.source,
      followUpConsent: advertiserIntakesTable.followUpConsent,
    })
    .from(advertiserIntakesTable)
    .where(inArray(advertiserIntakesTable.normalizedEmail, [email]));

  assert.deepEqual(row, {
    normalizedEmail: email,
    visitorType: "online_product",
    advertisingIntent: "interested",
    advertiserSize: "small_business",
    operatingScope: "national",
    adInterest: "display",
    source: "guide",
    followUpConsent: true,
  });
});

test("advertiser intake rejects transcripts, health text, and missing consent", async () => {
  for (const payload of [
    {
      email: "guide@example.com",
      visitorType: "wellness_audience",
      advertisingIntent: "learning",
      source: "guide",
      followUpConsent: true,
      transcript: "A raw chat transcript must never be accepted.",
    },
    {
      email: "guide@example.com",
      visitorType: "online_service",
      advertisingIntent: "interested",
      source: "site_form",
      followUpConsent: false,
    },
    {
      email: "guide@example.com",
      visitorType: "patient_record",
      advertisingIntent: "interested",
      source: "guide",
      followUpConsent: true,
    },
    {
      email: "guide@example.com",
      visitorType: "online_product",
      advertisingIntent: "interested",
      source: "guide",
      followUpConsent: true,
    },
    {
      email: "guide@example.com",
      visitorType: "online_service",
      advertisingIntent: "learning",
      advertiserSize: "small_business",
      source: "guide",
      followUpConsent: true,
    },
    {
      email: "guide@example.com",
      visitorType: "other",
      advertisingIntent: "not_now",
      operatingScope: "local",
      adInterest: "guidance",
      source: "site_form",
      followUpConsent: true,
    },
  ]) {
    const response = await fetch(`${baseUrl}/launch/advertiser-intake`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 400);
  }
});

test("advertiser intake queue requires staff access and supports review states", async () => {
  const email = `sales-queue-${randomUUID()}@example.com`;
  testAdvertiserIntakeEmails.push(email);
  const token = randomUUID();
  const primaryEmail = `sales-primary-${token}@example.com`;
  const secondaryEmail = `sales-secondary-${token}@example.com`;
  const revokedEmail = `sales-revoked-${token}@example.com`;
  const supportEmail = `sales-support-${token}@example.com`;
  testSalesStaffEmails.push(
    primaryEmail,
    secondaryEmail,
    revokedEmail,
    supportEmail,
  );

  const [primaryStaff, secondaryStaff] = await db
    .insert(salesStaffAccessTable)
    .values([
      {
        normalizedEmail: primaryEmail,
        displayName: "Alex Sales",
        role: "sales",
        accessStatus: "active",
      },
      {
        normalizedEmail: secondaryEmail,
        displayName: "Morgan Sales",
        role: "sales",
        accessStatus: "active",
      },
      {
        normalizedEmail: revokedEmail,
        displayName: "Former Sales",
        role: "sales",
        accessStatus: "revoked",
        revokedAt: new Date(),
      },
      {
        normalizedEmail: supportEmail,
        displayName: "Support Teammate",
        role: "support",
        accessStatus: "active",
      },
    ])
    .returning();
  assert.ok(primaryStaff);
  assert.ok(secondaryStaff);

  const staffHeaders = (
    clerkUserId: string,
    staffEmail: string,
    staffName: string,
  ) => ({
    "x-test-clerk-user-id": clerkUserId,
    "x-test-staff-email": staffEmail,
    "x-test-staff-name": staffName,
  });
  const primaryHeaders = staffHeaders(
    `user_primary_${token}`,
    primaryEmail,
    "Alex Sales",
  );
  const secondaryHeaders = staffHeaders(
    `user_secondary_${token}`,
    secondaryEmail,
    "Morgan Sales",
  );

  const createResponse = await fetch(`${baseUrl}/launch/advertiser-intake`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      visitorType: "online_service",
      advertisingIntent: "interested",
      advertiserSize: "enterprise",
      operatingScope: "international",
      adInterest: "both",
      source: "site_form",
      followUpConsent: true,
    }),
  });
  assert.equal(createResponse.status, 202);
  const created = (await createResponse.json()) as { intakeId: string };

  const unauthenticatedResponse = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
  );
  assert.equal(unauthenticatedResponse.status, 401);
  assert.deepEqual(await unauthenticatedResponse.json(), {
    error: "Staff authentication failed.",
  });

  const unassignedResponse = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    {
      headers: staffHeaders(
        `user_unassigned_${token}`,
        `unassigned-${token}@example.com`,
        "Unassigned User",
      ),
    },
  );
  assert.equal(unassignedResponse.status, 403);

  const wrongRoleResponse = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    {
      headers: staffHeaders(
        `user_support_${token}`,
        supportEmail,
        "Support Teammate",
      ),
    },
  );
  assert.equal(wrongRoleResponse.status, 403);

  const revokedResponse = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    {
      headers: staffHeaders(
        `user_revoked_${token}`,
        revokedEmail,
        "Former Sales",
      ),
    },
  );
  assert.equal(revokedResponse.status, 403);

  const listResponse = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    {
      headers: primaryHeaders,
    },
  );
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.headers.get("cache-control"), "no-store");
  const queue = (await listResponse.json()) as Array<Record<string, unknown>>;
  const queued = queue.find((item) => item.id === created.intakeId);
  assert.deepEqual(queued, {
    id: created.intakeId,
    email,
    visitorType: "online_service",
    advertisingIntent: "interested",
    advertiserSize: "enterprise",
    operatingScope: "international",
    adInterest: "both",
    source: "site_form",
    reviewStatus: "new",
    lastReviewedBy: null,
    lastReviewedAt: null,
    createdAt: queued?.createdAt,
  });
  assert.equal("transcript" in queued!, false);
  assert.equal("normalizedEmail" in queued!, false);

  const hostileOriginList = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    {
      headers: {
        ...primaryHeaders,
        origin: "https://malicious.example",
        "sec-fetch-site": "cross-site",
      },
    },
  );
  assert.equal(hostileOriginList.status, 403);
  assert.equal(hostileOriginList.headers.get("cache-control"), "no-store");
  assert.equal(hostileOriginList.headers.get("access-control-allow-origin"), null);

  const hostileOriginUpdate = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes/${created.intakeId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...primaryHeaders,
        origin: "https://malicious.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ reviewStatus: "reviewed" }),
    },
  );
  assert.equal(hostileOriginUpdate.status, 403);

  const updateResponse = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes/${created.intakeId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...primaryHeaders,
      },
      body: JSON.stringify({ reviewStatus: "closed" }),
    },
  );
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.headers.get("cache-control"), "no-store");
  const updated = (await updateResponse.json()) as {
    id: string;
    reviewStatus: string;
    reviewedBy: string;
    reviewedAt: string;
  };
  assert.equal(updated.id, created.intakeId);
  assert.equal(updated.reviewStatus, "closed");
  assert.equal(updated.reviewedBy, "Alex Sales");
  assert.ok(Number.isFinite(Date.parse(updated.reviewedAt)));
  assert.deepEqual(Object.keys(updated).sort(), [
    "id",
    "reviewStatus",
    "reviewedAt",
    "reviewedBy",
  ]);

  const [firstEvent] = await db
    .select()
    .from(advertiserIntakeReviewEventsTable)
    .where(
      inArray(advertiserIntakeReviewEventsTable.advertiserIntakeId, [
        created.intakeId,
      ]),
    );
  assert.equal(firstEvent?.staffAccessId, primaryStaff.id);
  assert.equal(firstEvent?.actorClerkUserId, `user_primary_${token}`);
  assert.equal(firstEvent?.actorName, "Alex Sales");
  assert.equal(firstEvent?.previousStatus, "new");
  assert.equal(firstEvent?.nextStatus, "closed");
  assert.ok(firstEvent);

  const isImmutableAuditError = (error: unknown): boolean => {
    if (!(error instanceof Error) || !("cause" in error)) {
      return false;
    }
    return (
      error.cause instanceof Error && /immutable/.test(error.cause.message)
    );
  };

  await assert.rejects(
    db
      .update(advertiserIntakeReviewEventsTable)
      .set({ actorName: "Altered Actor" })
      .where(inArray(advertiserIntakeReviewEventsTable.id, [firstEvent.id])),
    isImmutableAuditError,
  );
  await assert.rejects(
    db
      .delete(advertiserIntakeReviewEventsTable)
      .where(inArray(advertiserIntakeReviewEventsTable.id, [firstEvent.id])),
    isImmutableAuditError,
  );

  await db
    .update(salesStaffAccessTable)
    .set({
      accessStatus: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      inArray(salesStaffAccessTable.normalizedEmail, [primaryEmail]),
    );

  const primaryRevokedList = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    { headers: primaryHeaders },
  );
  assert.equal(primaryRevokedList.status, 403);

  const primaryRevokedUpdate = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes/${created.intakeId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...primaryHeaders,
      },
      body: JSON.stringify({ reviewStatus: "reviewed" }),
    },
  );
  assert.equal(primaryRevokedUpdate.status, 403);

  const secondaryUpdate = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes/${created.intakeId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...secondaryHeaders,
      },
      body: JSON.stringify({ reviewStatus: "reviewed" }),
    },
  );
  assert.equal(secondaryUpdate.status, 200);
  const secondaryUpdated = (await secondaryUpdate.json()) as {
    reviewedBy: string;
    reviewedAt: string;
  };
  assert.equal(secondaryUpdated.reviewedBy, "Morgan Sales");
  assert.ok(Number.isFinite(Date.parse(secondaryUpdated.reviewedAt)));

  const events = await db
    .select()
    .from(advertiserIntakeReviewEventsTable)
    .where(
      inArray(advertiserIntakeReviewEventsTable.advertiserIntakeId, [
        created.intakeId,
      ]),
    );
  assert.equal(events.length, 2);
  assert.equal(
    events.some(
      (event) =>
        event.staffAccessId === secondaryStaff.id &&
        event.actorClerkUserId === `user_secondary_${token}` &&
        event.nextStatus === "reviewed",
    ),
    true,
  );

  const secondaryList = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    { headers: secondaryHeaders },
  );
  assert.equal(secondaryList.status, 200);
  const latestQueue = (await secondaryList.json()) as Array<
    Record<string, unknown>
  >;
  const latestItem = latestQueue.find(
    (item) => item.id === created.intakeId,
  );
  assert.equal(latestItem?.lastReviewedBy, "Morgan Sales");
  assert.equal(
    Number.isFinite(Date.parse(String(latestItem?.lastReviewedAt))),
    true,
  );
});

test("sales managers can auditably grant and revoke one teammate at a time", async () => {
  const token = randomUUID();
  const managerEmail = `sales-manager-${token}@example.com`;
  const salesEmail = `sales-member-${token}@example.com`;
  const newSalesEmail = `sales-new-${token}@example.com`;
  const secondManagerEmail = `sales-manager-protected-${token}@example.com`;
  testSalesStaffEmails.push(
    managerEmail,
    salesEmail,
    newSalesEmail,
    secondManagerEmail,
  );

  const [manager, salesMember, secondManager] = await db
    .insert(salesStaffAccessTable)
    .values([
      {
        normalizedEmail: managerEmail,
        displayName: "Taylor Manager",
        role: "sales_manager",
        accessStatus: "active",
      },
      {
        normalizedEmail: salesEmail,
        displayName: "Jordan Sales",
        role: "sales",
        accessStatus: "active",
      },
      {
        normalizedEmail: secondManagerEmail,
        displayName: "Protected Manager",
        role: "sales_manager",
        accessStatus: "active",
      },
    ])
    .returning();
  assert.ok(manager);
  assert.ok(salesMember);
  assert.ok(secondManager);

  const staffHeaders = (
    clerkUserId: string,
    staffEmail: string,
    staffName: string,
  ) => ({
    "x-test-clerk-user-id": clerkUserId,
    "x-test-staff-email": staffEmail,
    "x-test-staff-name": staffName,
  });
  const managerClerkUserId = `user_manager_${token}`;
  const managerHeaders = staffHeaders(
    managerClerkUserId,
    managerEmail,
    "Taylor Manager",
  );
  const salesHeaders = staffHeaders(
    `user_sales_${token}`,
    salesEmail,
    "Jordan Sales",
  );

  const unauthenticatedResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff`,
  );
  assert.equal(unauthenticatedResponse.status, 401);
  assert.equal(unauthenticatedResponse.headers.get("cache-control"), "no-store");

  const salesOnlyResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff`,
    { headers: salesHeaders },
  );
  assert.equal(salesOnlyResponse.status, 403);
  assert.equal(salesOnlyResponse.headers.get("cache-control"), "no-store");

  const managerQueueResponse = await fetch(
    `${baseUrl}/launch/admin/advertiser-intakes`,
    { headers: managerHeaders },
  );
  assert.equal(managerQueueResponse.status, 200);

  const initialListResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff`,
    { headers: managerHeaders },
  );
  assert.equal(initialListResponse.status, 200);
  assert.equal(initialListResponse.headers.get("cache-control"), "no-store");
  const initialRoster = (await initialListResponse.json()) as Array<
    Record<string, unknown>
  >;
  assert.ok(initialRoster.some((entry) => entry.id === salesMember.id));
  assert.equal(initialRoster.some((entry) => entry.id === manager.id), false);
  assert.equal(
    initialRoster.some((entry) => entry.id === secondManager.id),
    false,
  );
  assert.ok(
    initialRoster.every(
      (entry) =>
        !("advertiserIntakes" in entry) &&
        !("visitorType" in entry) &&
        !("adInterest" in entry),
    ),
  );

  const hostileGrantResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...managerHeaders,
        origin: "https://malicious.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({
        email: newSalesEmail,
        displayName: "Casey Sales",
      }),
    },
  );
  assert.equal(hostileGrantResponse.status, 403);

  const grantResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...managerHeaders,
      },
      body: JSON.stringify({
        email: ` ${newSalesEmail.toUpperCase()} `,
        displayName: " Casey Sales ",
      }),
    },
  );
  assert.equal(grantResponse.status, 200);
  assert.equal(grantResponse.headers.get("cache-control"), "no-store");
  const granted = (await grantResponse.json()) as Record<string, unknown>;
  assert.equal(granted.email, newSalesEmail);
  assert.equal(granted.displayName, "Casey Sales");
  assert.equal(granted.role, "sales");
  assert.equal(granted.accessStatus, "active");
  assert.equal(granted.identityBound, false);
  assert.equal(granted.lastChangedBy, "Taylor Manager");
  assert.ok(Number.isFinite(Date.parse(String(granted.lastChangedAt))));
  assert.equal("clerkUserId" in granted, false);

  const duplicateGrantResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...managerHeaders,
      },
      body: JSON.stringify({
        email: newSalesEmail,
        displayName: "Casey Sales",
      }),
    },
  );
  assert.equal(duplicateGrantResponse.status, 409);

  const protectedManagerResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...managerHeaders,
      },
      body: JSON.stringify({
        email: secondManagerEmail,
        displayName: "Protected Manager",
      }),
    },
  );
  assert.equal(protectedManagerResponse.status, 409);

  const revokeResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff/${granted.id}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...managerHeaders,
      },
      body: JSON.stringify({ accessStatus: "revoked" }),
    },
  );
  assert.equal(revokeResponse.status, 200);
  assert.equal(revokeResponse.headers.get("cache-control"), "no-store");
  const revoked = (await revokeResponse.json()) as Record<string, unknown>;
  assert.equal(revoked.id, granted.id);
  assert.equal(revoked.accessStatus, "revoked");
  assert.equal(revoked.lastChangedBy, "Taylor Manager");
  assert.ok(Number.isFinite(Date.parse(String(revoked.revokedAt))));

  const duplicateRevokeResponse = await fetch(
    `${baseUrl}/launch/admin/sales-staff/${granted.id}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...managerHeaders,
      },
      body: JSON.stringify({ accessStatus: "revoked" }),
    },
  );
  assert.equal(duplicateRevokeResponse.status, 409);

  const events = await db
    .select()
    .from(salesStaffAccessEventsTable)
    .where(
      inArray(salesStaffAccessEventsTable.targetStaffAccessId, [
        String(granted.id),
      ]),
    );
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => event.action).sort(),
    ["grant", "revoke"],
  );
  assert.ok(
    events.every(
      (event) =>
        event.managerStaffAccessId === manager.id &&
        event.actorClerkUserId === managerClerkUserId &&
        event.actorName === "Taylor Manager" &&
        event.targetNormalizedEmail === newSalesEmail &&
        event.targetDisplayName === "Casey Sales",
    ),
  );
  const revokeEvent = events.find((event) => event.action === "revoke");
  assert.equal(revokeEvent?.previousStatus, "active");
  assert.equal(revokeEvent?.nextStatus, "revoked");
  assert.ok(revokeEvent);

  const isImmutableAccessAuditError = (error: unknown): boolean => {
    if (!(error instanceof Error) || !("cause" in error)) {
      return false;
    }
    return (
      error.cause instanceof Error && /immutable/.test(error.cause.message)
    );
  };
  await assert.rejects(
    db
      .update(salesStaffAccessEventsTable)
      .set({ actorName: "Altered Manager" })
      .where(inArray(salesStaffAccessEventsTable.id, [revokeEvent.id])),
    isImmutableAccessAuditError,
  );
});

test("public launch status reports pilot mode", async () => {
  const response = await fetch(`${baseUrl}/launch/status`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    mode: string;
  };
  assert.equal(body.mode, "pilot");
});

test("category insight thresholds hide small samples and publish aggregates", () => {
  const collecting = buildPublicCategoryInsight({
    category: "Healthcare",
    campaigns: 4,
    placements: 3,
    impressions: 500,
    clicks: 25,
  });
  assert.equal(collecting.status, "collecting");
  assert.equal(collecting.impressions, null);
  assert.equal(collecting.clickThroughRateBps, null);

  const published = buildPublicCategoryInsight({
    category: "Healthcare",
    campaigns: 5,
    placements: 3,
    impressions: 200,
    clicks: 7,
  });
  assert.equal(published.status, "published");
  assert.equal(published.impressions, 200);
  assert.equal(published.clicks, 7);
  assert.equal(published.clickThroughRateBps, 350);
});