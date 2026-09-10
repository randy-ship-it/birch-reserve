import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  db,
  marketplaceAdvertisersTable,
  marketplaceCampaignsTable,
  marketplaceCategoryLocksTable,
  marketplaceDeliveriesTable,
  marketplaceDeliveryEventsTable,
  marketplaceHostsTable,
  marketplacePlacementsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  encryptMarketplaceSecret,
  hashPrivateKey,
  marketplaceEventSignature,
} from "../src/lib/marketplaceSecurity";
import { startMarketplaceTestServer } from "./helpers/marketplaceTestServer";

type PlacementFixture = {
  id: string;
  key: string;
  signingSecret: string;
};

type CampaignFixture = {
  id: string;
};

type DeliveryResult = {
  fill: boolean;
  campaignId: string | null;
  deliveryToken: string | null;
};

const testServer = await startMarketplaceTestServer();
const hostKey = `host_${randomUUID()}`;
const advertiserKey = `advertiser_${randomUUID()}`;
let hostId: string | undefined;
let advertiserId: string | undefined;

function uniqueCategory(prefix: string): string {
  return `${prefix}-${randomUUID()}`.toLowerCase();
}

async function createPlacement(category: string): Promise<PlacementFixture> {
  assert.ok(hostId);
  const key = `placement_${randomUUID()}`;
  const signingSecret = `signing_${randomUUID()}_${randomUUID()}`;
  const [placement] = await db
    .insert(marketplacePlacementsTable)
    .values({
      hostId,
      name: `Safety placement ${randomUUID()}`,
      floorCpmCents: 1000,
      allowedCategories: [category],
      width: 728,
      height: 90,
      exclusivityHours: 1,
      status: "approved",
      accessKeyHash: hashPrivateKey(key),
      eventSigningSecretEncrypted: encryptMarketplaceSecret(signingSecret),
    })
    .returning();

  return { id: placement.id, key, signingSecret };
}

async function createCampaign(
  category: string,
  overrides: Partial<typeof marketplaceCampaignsTable.$inferInsert> = {},
): Promise<CampaignFixture> {
  assert.ok(advertiserId);
  const [campaign] = await db
    .insert(marketplaceCampaignsTable)
    .values({
      advertiserId,
      name: `Safety campaign ${randomUUID()}`,
      category,
      creativeUrl: "https://example.com/creative.png",
      destinationUrl: "https://example.com",
      width: 728,
      height: 90,
      bidCpmCents: 1000,
      budgetCents: 1,
      status: "approved",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 86_400_000),
      ...overrides,
    })
    .returning();

  return { id: campaign.id };
}

async function requestDelivery(
  placement: PlacementFixture,
): Promise<DeliveryResult> {
  const response = await fetch(`${testServer.baseUrl}/marketplace/delivery`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-marketplace-placement-key": placement.key,
    },
    body: JSON.stringify({ placementId: placement.id }),
  });
  assert.equal(response.status, 200);
  return (await response.json()) as DeliveryResult;
}

async function reportImpression({
  placement,
  campaignId,
  deliveryToken,
  eventId = `event_${randomUUID()}`,
  signatureOverride,
}: {
  placement: PlacementFixture;
  campaignId: string;
  deliveryToken: string;
  eventId?: string;
  signatureOverride?: string;
}): Promise<Response> {
  const body = {
    eventId,
    placementId: placement.id,
    campaignId,
    deliveryToken,
    eventType: "impression" as const,
    occurredAt: new Date().toISOString(),
  };
  const signature =
    signatureOverride ??
    marketplaceEventSignature(body, placement.signingSecret);

  return fetch(`${testServer.baseUrl}/marketplace/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-marketplace-signature": signature,
    },
    body: JSON.stringify(body),
  });
}

async function issueToken(categoryPrefix: string): Promise<{
  placement: PlacementFixture;
  campaign: CampaignFixture;
  delivery: DeliveryResult & {
    campaignId: string;
    deliveryToken: string;
  };
}> {
  const category = uniqueCategory(categoryPrefix);
  const placement = await createPlacement(category);
  const campaign = await createCampaign(category);
  const delivery = await requestDelivery(placement);
  assert.equal(delivery.fill, true);
  assert.equal(delivery.campaignId, campaign.id);
  assert.ok(delivery.deliveryToken);

  return {
    placement,
    campaign,
    delivery: {
      ...delivery,
      campaignId: delivery.campaignId,
      deliveryToken: delivery.deliveryToken,
    },
  };
}

try {
  const [host] = await db
    .insert(marketplaceHostsTable)
    .values({
      name: `Marketplace safety host ${randomUUID()}`,
      status: "approved",
      accessKeyHash: hashPrivateKey(hostKey),
    })
    .returning();
  hostId = host.id;

  const [advertiser] = await db
    .insert(marketplaceAdvertisersTable)
    .values({
      name: `Marketplace safety advertiser ${randomUUID()}`,
      status: "approved",
      accessKeyHash: hashPrivateKey(advertiserKey),
    })
    .returning();
  advertiserId = advertiser.id;

  {
    const category = uniqueCategory("one-impression-budget");
    const placement = await createPlacement(category);
    const campaign = await createCampaign(category);
    const deliveries = await Promise.all(
      Array.from({ length: 8 }, () => requestDelivery(placement)),
    );
    assert.equal(
      deliveries.filter((delivery) => delivery.fill).length,
      1,
      "parallel requests may reserve a one-impression budget only once",
    );
    const [storedCampaign] = await db
      .select()
      .from(marketplaceCampaignsTable)
      .where(eq(marketplaceCampaignsTable.id, campaign.id));
    const storedDeliveries = await db
      .select()
      .from(marketplaceDeliveriesTable)
      .where(eq(marketplaceDeliveriesTable.campaignId, campaign.id));
    assert.equal(storedCampaign.spentMilliCents, 1000);
    assert.equal(storedDeliveries.length, 1);
  }

  {
    const category = uniqueCategory("reservation-release");
    const placement = await createPlacement(category);
    const campaign = await createCampaign(category);
    const firstDelivery = await requestDelivery(placement);
    assert.equal(firstDelivery.fill, true);
    assert.ok(firstDelivery.deliveryToken);

    const [issued] = await db
      .select()
      .from(marketplaceDeliveriesTable)
      .where(eq(marketplaceDeliveriesTable.campaignId, campaign.id));
    await db
      .update(marketplaceDeliveriesTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(marketplaceDeliveriesTable.id, issued.id));

    const secondDelivery = await requestDelivery(placement);
    assert.equal(
      secondDelivery.fill,
      true,
      "an expired reservation must release enough budget for a replacement",
    );
    const storedDeliveries = await db
      .select()
      .from(marketplaceDeliveriesTable)
      .where(eq(marketplaceDeliveriesTable.campaignId, campaign.id));
    const [storedCampaign] = await db
      .select()
      .from(marketplaceCampaignsTable)
      .where(eq(marketplaceCampaignsTable.id, campaign.id));
    assert.equal(
      storedDeliveries.filter((delivery) => delivery.status === "expired")
        .length,
      1,
    );
    assert.equal(
      storedDeliveries.filter((delivery) => delivery.status === "issued")
        .length,
      1,
    );
    assert.equal(storedCampaign.spentMilliCents, 1000);
  }

  {
    const category = uniqueCategory("category-exclusivity");
    const placement = await createPlacement(category);
    const preferred = await createCampaign(category, {
      bidCpmCents: 2000,
      budgetCents: 2,
    });
    const competing = await createCampaign(category);
    const deliveries = await Promise.all([
      requestDelivery(placement),
      requestDelivery(placement),
    ]);
    const fills = deliveries.filter((delivery) => delivery.fill);
    assert.equal(
      fills.length,
      1,
      "competing campaigns must not race into the same category lock",
    );
    assert.equal(fills[0]?.campaignId, preferred.id);
    const [lock] = await db
      .select()
      .from(marketplaceCategoryLocksTable)
      .where(
        and(
          eq(marketplaceCategoryLocksTable.placementId, placement.id),
          eq(marketplaceCategoryLocksTable.category, category),
        ),
      );
    const [competingCampaign] = await db
      .select()
      .from(marketplaceCampaignsTable)
      .where(eq(marketplaceCampaignsTable.id, competing.id));
    assert.equal(lock.campaignId, preferred.id);
    assert.equal(competingCampaign.spentMilliCents, 0);
  }

  {
    const { placement, campaign, delivery } =
      await issueToken("signed-reporting");
    const badSignature = await reportImpression({
      placement,
      campaignId: campaign.id,
      deliveryToken: delivery.deliveryToken,
      signatureOverride: "0".repeat(64),
    });
    assert.equal(badSignature.status, 401);

    const eventId = `event_${randomUUID()}`;
    const accepted = await reportImpression({
      placement,
      campaignId: campaign.id,
      deliveryToken: delivery.deliveryToken,
      eventId,
    });
    assert.equal(accepted.status, 201);
    const duplicate = await reportImpression({
      placement,
      campaignId: campaign.id,
      deliveryToken: delivery.deliveryToken,
      eventId,
    });
    assert.equal(duplicate.status, 409);

    const second = await issueToken("duplicate-event-id");
    const duplicateAcrossDeliveries = await reportImpression({
      placement: second.placement,
      campaignId: second.campaign.id,
      deliveryToken: second.delivery.deliveryToken,
      eventId,
    });
    assert.equal(
      duplicateAcrossDeliveries.status,
      409,
      "an event ID already accepted for another delivery must be rejected",
    );
    const [secondStoredDelivery] = await db
      .select()
      .from(marketplaceDeliveriesTable)
      .where(eq(marketplaceDeliveriesTable.campaignId, second.campaign.id));
    const storedEvents = await db
      .select()
      .from(marketplaceDeliveryEventsTable)
      .where(eq(marketplaceDeliveryEventsTable.externalEventId, eventId));
    assert.equal(
      secondStoredDelivery.status,
      "issued",
      "duplicate event rejection must roll back the second reservation claim",
    );
    assert.equal(storedEvents.length, 1);
  }

  {
    const { placement, campaign, delivery } = await issueToken(
      "campaign-revocation",
    );
    await db
      .update(marketplaceCampaignsTable)
      .set({ status: "paused" })
      .where(eq(marketplaceCampaignsTable.id, campaign.id));
    const response = await reportImpression({
      placement,
      campaignId: campaign.id,
      deliveryToken: delivery.deliveryToken,
    });
    assert.equal(response.status, 401);
  }

  {
    const { placement, campaign, delivery } = await issueToken(
      "advertiser-revocation",
    );
    await db
      .update(marketplaceAdvertisersTable)
      .set({ status: "suspended" })
      .where(eq(marketplaceAdvertisersTable.id, advertiserId!));
    const response = await reportImpression({
      placement,
      campaignId: campaign.id,
      deliveryToken: delivery.deliveryToken,
    });
    assert.equal(response.status, 401);
    await db
      .update(marketplaceAdvertisersTable)
      .set({ status: "approved" })
      .where(eq(marketplaceAdvertisersTable.id, advertiserId!));
  }

  {
    const { placement, campaign, delivery } = await issueToken(
      "placement-revocation",
    );
    await db
      .update(marketplacePlacementsTable)
      .set({ status: "suspended" })
      .where(eq(marketplacePlacementsTable.id, placement.id));
    const response = await reportImpression({
      placement,
      campaignId: campaign.id,
      deliveryToken: delivery.deliveryToken,
    });
    assert.equal(response.status, 401);
  }

  {
    const { placement, campaign, delivery } =
      await issueToken("host-revocation");
    await db
      .update(marketplaceHostsTable)
      .set({ status: "suspended" })
      .where(eq(marketplaceHostsTable.id, hostId!));
    const response = await reportImpression({
      placement,
      campaignId: campaign.id,
      deliveryToken: delivery.deliveryToken,
    });
    assert.equal(response.status, 401);
    await db
      .update(marketplaceHostsTable)
      .set({ status: "approved" })
      .where(eq(marketplaceHostsTable.id, hostId!));
  }

  console.log(
    "Marketplace safety tests passed: budget and category races are serialized, expired reservations release budget, revocations invalidate tokens, and signed duplicate reporting is rejected.",
  );
} finally {
  if (advertiserId) {
    await db
      .delete(marketplaceCampaignsTable)
      .where(eq(marketplaceCampaignsTable.advertiserId, advertiserId));
  }
  if (hostId) {
    await db
      .delete(marketplaceHostsTable)
      .where(eq(marketplaceHostsTable.id, hostId));
  }
  if (advertiserId) {
    await db
      .delete(marketplaceAdvertisersTable)
      .where(eq(marketplaceAdvertisersTable.id, advertiserId));
  }
  await testServer.close();
}

process.exit(0);
