import { Router, type IRouter, type Request } from "express";
import {
  db,
  marketplaceAdvertisersTable,
  marketplaceCategoryLocksTable,
  marketplaceCampaignsTable,
  marketplaceDeliveriesTable,
  marketplaceDeliveryEventsTable,
  marketplaceHostsTable,
  marketplacePlacementsTable,
} from "@workspace/db";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import {
  CreateMarketplaceAdvertiserBody,
  CreateMarketplaceAdvertiserResponse,
  CreateMarketplaceCampaignBody,
  CreateMarketplaceCampaignHeader,
  CreateMarketplaceCampaignResponse,
  CreateMarketplaceHostBody,
  CreateMarketplaceHostResponse,
  CreateMarketplacePlacementBody,
  CreateMarketplacePlacementHeader,
  CreateMarketplacePlacementResponse,
  GetMarketplaceAdvertiserHeader,
  GetMarketplaceAdvertiserParams,
  GetMarketplaceAdvertiserResponse,
  GetMarketplaceAdminOverviewHeader,
  GetMarketplaceAdminOverviewResponse,
  GetMarketplaceHostHeader,
  GetMarketplaceHostParams,
  GetMarketplaceHostResponse,
  ListMarketplaceCampaignsHeader,
  ListMarketplaceCampaignsQueryParams,
  ListMarketplaceCampaignsResponse,
  ListMarketplacePlacementsHeader,
  ListMarketplacePlacementsQueryParams,
  ListMarketplacePlacementsResponse,
  ReportMarketplaceEventBody,
  ReportMarketplaceEventHeader,
  ReportMarketplaceEventResponse,
  ReviewMarketplaceAdvertiserBody,
  ReviewMarketplaceAdvertiserParams,
  ReviewMarketplaceAdvertiserResponse,
  ReviewMarketplaceCampaignBody,
  ReviewMarketplaceCampaignParams,
  ReviewMarketplaceCampaignResponse,
  ReviewMarketplaceHostBody,
  ReviewMarketplaceHostParams,
  ReviewMarketplaceHostResponse,
  ReviewMarketplacePlacementBody,
  ReviewMarketplacePlacementParams,
  ReviewMarketplacePlacementResponse,
  SelectMarketplaceDeliveryBody,
  SelectMarketplaceDeliveryHeader,
  SelectMarketplaceDeliveryResponse,
} from "@workspace/api-zod";
import { expireIssuedReservations } from "../lib/marketplaceReservations";
import {
  adminSecretMatches,
  createDeliveryIdentity,
  createDeliveryToken,
  createPrivateKey,
  decryptMarketplaceSecret,
  encryptMarketplaceSecret,
  hashPrivateKey,
  marketplaceEventSignatureMatches,
  privateKeyMatches,
  verifyDeliveryToken,
} from "../lib/marketplaceSecurity";

const router: IRouter = Router();

function headerValue(req: Request, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hostView(row: typeof marketplaceHostsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function placementView(row: typeof marketplacePlacementsTable.$inferSelect) {
  return {
    id: row.id,
    hostId: row.hostId,
    name: row.name,
    floorCpmCents: row.floorCpmCents,
    currency: row.currency,
    allowedCategories: row.allowedCategories,
    width: row.width,
    height: row.height,
    vetoTerms: row.vetoTerms,
    exclusivityHours: row.exclusivityHours,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function advertiserView(row: typeof marketplaceAdvertisersTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function campaignView(row: typeof marketplaceCampaignsTable.$inferSelect) {
  return {
    id: row.id,
    advertiserId: row.advertiserId,
    name: row.name,
    category: row.category,
    creativeUrl: row.creativeUrl,
    creativeText: row.creativeText,
    destinationUrl: row.destinationUrl,
    width: row.width,
    height: row.height,
    bidCpmCents: row.bidCpmCents,
    budgetCents: row.budgetCents,
    currency: row.currency,
    spentCents: row.spentCents,
    status: row.status,
    reviewNote: row.reviewNote,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
  };
}

function requireAdmin(req: Request): boolean {
  const parsed = GetMarketplaceAdminOverviewHeader.safeParse({
    "x-marketplace-admin-secret": headerValue(
      req,
      "x-marketplace-admin-secret",
    ),
  });
  return (
    parsed.success &&
    adminSecretMatches(parsed.data["x-marketplace-admin-secret"])
  );
}

async function releaseExpiredDeliveryReservations(): Promise<void> {
  await db.transaction(async (tx) => {
    await expireIssuedReservations(
      tx,
      lte(marketplaceDeliveriesTable.expiresAt, new Date()),
    );
  });
}

router.post("/marketplace/hosts", async (req, res): Promise<void> => {
  const parsed = CreateMarketplaceHostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid host organization name." });
    return;
  }

  const partnerKey = createPrivateKey();
  const [host] = await db
    .insert(marketplaceHostsTable)
    .values({
      name: parsed.data.name.trim(),
      accessKeyHash: hashPrivateKey(partnerKey),
    })
    .returning();

  req.log.info({ hostId: host.id }, "Marketplace host submitted for review");
  res.status(201).json(
    CreateMarketplaceHostResponse.parse({
      ...hostView(host),
      partnerKey,
    }),
  );
});

router.get("/marketplace/hosts/:hostId", async (req, res): Promise<void> => {
  const params = GetMarketplaceHostParams.safeParse(req.params);
  const headers = GetMarketplaceHostHeader.safeParse({
    "x-marketplace-partner-key": headerValue(
      req,
      "x-marketplace-partner-key",
    ),
  });
  if (!params.success || !headers.success || !isUuid(params.data.hostId)) {
    res.status(400).json({ error: "Host request is invalid." });
    return;
  }

  const [host] = await db
    .select()
    .from(marketplaceHostsTable)
    .where(eq(marketplaceHostsTable.id, params.data.hostId))
    .limit(1);
  if (
    !host ||
    !privateKeyMatches(
      headers.data["x-marketplace-partner-key"],
      host.accessKeyHash,
    )
  ) {
    res.status(401).json({ error: "Host credentials are invalid." });
    return;
  }

  res.json(GetMarketplaceHostResponse.parse(hostView(host)));
});

router.get("/marketplace/placements", async (req, res): Promise<void> => {
  const query = ListMarketplacePlacementsQueryParams.safeParse(req.query);
  const headers = ListMarketplacePlacementsHeader.safeParse({
    "x-marketplace-partner-key": headerValue(
      req,
      "x-marketplace-partner-key",
    ),
  });
  if (!query.success || !headers.success || !isUuid(query.data.hostId)) {
    res.status(400).json({ error: "Placement list request is invalid." });
    return;
  }

  const [host] = await db
    .select()
    .from(marketplaceHostsTable)
    .where(eq(marketplaceHostsTable.id, query.data.hostId))
    .limit(1);
  if (
    !host ||
    !privateKeyMatches(
      headers.data["x-marketplace-partner-key"],
      host.accessKeyHash,
    )
  ) {
    res.status(401).json({ error: "Host credentials are invalid." });
    return;
  }

  const placements = await db
    .select()
    .from(marketplacePlacementsTable)
    .where(eq(marketplacePlacementsTable.hostId, host.id))
    .orderBy(desc(marketplacePlacementsTable.createdAt));
  res.json(
    ListMarketplacePlacementsResponse.parse(placements.map(placementView)),
  );
});

router.post("/marketplace/placements", async (req, res): Promise<void> => {
  const body = CreateMarketplacePlacementBody.safeParse(req.body);
  const headers = CreateMarketplacePlacementHeader.safeParse({
    "x-marketplace-partner-key": headerValue(
      req,
      "x-marketplace-partner-key",
    ),
  });
  if (
    !body.success ||
    !headers.success ||
    !isUuid(body.data.hostId)
  ) {
    res.status(400).json({ error: "Placement details are invalid." });
    return;
  }

  const [host] = await db
    .select()
    .from(marketplaceHostsTable)
    .where(eq(marketplaceHostsTable.id, body.data.hostId))
    .limit(1);
  if (
    !host ||
    !privateKeyMatches(
      headers.data["x-marketplace-partner-key"],
      host.accessKeyHash,
    )
  ) {
    res.status(401).json({ error: "Host credentials are invalid." });
    return;
  }
  if (host.status !== "approved") {
    res.status(409).json({
      error: "This host must be approved before adding placements.",
    });
    return;
  }

  const placementKey = createPrivateKey();
  const eventSigningSecret = createPrivateKey();
  const [placement] = await db
    .insert(marketplacePlacementsTable)
    .values({
      hostId: host.id,
      name: body.data.name.trim(),
      floorCpmCents: body.data.floorCpmCents,
      currency: body.data.currency,
      allowedCategories: normalizeList(body.data.allowedCategories),
      width: body.data.width,
      height: body.data.height,
      vetoTerms: normalizeList(body.data.vetoTerms ?? []),
      exclusivityHours: body.data.exclusivityHours,
      accessKeyHash: hashPrivateKey(placementKey),
      eventSigningSecretEncrypted:
        encryptMarketplaceSecret(eventSigningSecret),
    })
    .returning();

  req.log.info(
    { hostId: host.id, placementId: placement.id },
    "Marketplace placement submitted for review",
  );
  res.status(201).json(
    CreateMarketplacePlacementResponse.parse({
      ...placementView(placement),
      placementKey,
      eventSigningSecret,
    }),
  );
});

router.post("/marketplace/advertisers", async (req, res): Promise<void> => {
  const parsed = CreateMarketplaceAdvertiserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid advertiser name." });
    return;
  }

  const partnerKey = createPrivateKey();
  const [advertiser] = await db
    .insert(marketplaceAdvertisersTable)
    .values({
      name: parsed.data.name.trim(),
      accessKeyHash: hashPrivateKey(partnerKey),
    })
    .returning();

  req.log.info(
    { advertiserId: advertiser.id },
    "Marketplace advertiser submitted for review",
  );
  res.status(201).json(
    CreateMarketplaceAdvertiserResponse.parse({
      ...advertiserView(advertiser),
      partnerKey,
    }),
  );
});

router.get(
  "/marketplace/advertisers/:advertiserId",
  async (req, res): Promise<void> => {
    const params = GetMarketplaceAdvertiserParams.safeParse(req.params);
    const headers = GetMarketplaceAdvertiserHeader.safeParse({
      "x-marketplace-partner-key": headerValue(
        req,
        "x-marketplace-partner-key",
      ),
    });
    if (
      !params.success ||
      !headers.success ||
      !isUuid(params.data.advertiserId)
    ) {
      res.status(400).json({ error: "Advertiser request is invalid." });
      return;
    }

    const [advertiser] = await db
      .select()
      .from(marketplaceAdvertisersTable)
      .where(
        eq(marketplaceAdvertisersTable.id, params.data.advertiserId),
      )
      .limit(1);
    if (
      !advertiser ||
      !privateKeyMatches(
        headers.data["x-marketplace-partner-key"],
        advertiser.accessKeyHash,
      )
    ) {
      res.status(401).json({ error: "Advertiser credentials are invalid." });
      return;
    }

    res.json(
      GetMarketplaceAdvertiserResponse.parse(advertiserView(advertiser)),
    );
  },
);

router.get("/marketplace/campaigns", async (req, res): Promise<void> => {
  const query = ListMarketplaceCampaignsQueryParams.safeParse(req.query);
  const headers = ListMarketplaceCampaignsHeader.safeParse({
    "x-marketplace-partner-key": headerValue(
      req,
      "x-marketplace-partner-key",
    ),
  });
  if (
    !query.success ||
    !headers.success ||
    !isUuid(query.data.advertiserId)
  ) {
    res.status(400).json({ error: "Campaign list request is invalid." });
    return;
  }

  const [advertiser] = await db
    .select()
    .from(marketplaceAdvertisersTable)
    .where(
      eq(marketplaceAdvertisersTable.id, query.data.advertiserId),
    )
    .limit(1);
  if (
    !advertiser ||
    !privateKeyMatches(
      headers.data["x-marketplace-partner-key"],
      advertiser.accessKeyHash,
    )
  ) {
    res.status(401).json({ error: "Advertiser credentials are invalid." });
    return;
  }

  const campaigns = await db
    .select()
    .from(marketplaceCampaignsTable)
    .where(eq(marketplaceCampaignsTable.advertiserId, advertiser.id))
    .orderBy(desc(marketplaceCampaignsTable.createdAt));
  res.json(
    ListMarketplaceCampaignsResponse.parse(campaigns.map(campaignView)),
  );
});

router.post("/marketplace/campaigns", async (req, res): Promise<void> => {
  const body = CreateMarketplaceCampaignBody.safeParse(req.body);
  const headers = CreateMarketplaceCampaignHeader.safeParse({
    "x-marketplace-partner-key": headerValue(
      req,
      "x-marketplace-partner-key",
    ),
  });
  if (
    !body.success ||
    !headers.success ||
    !isUuid(body.data.advertiserId)
  ) {
    res.status(400).json({ error: "Campaign details are invalid." });
    return;
  }
  if (
    !isSafeHttpsUrl(body.data.creativeUrl) ||
    !isSafeHttpsUrl(body.data.destinationUrl)
  ) {
    res.status(400).json({ error: "Creative and destination URLs must use HTTPS." });
    return;
  }
  if (body.data.startsAt >= body.data.endsAt) {
    res.status(400).json({ error: "Campaign end time must follow its start time." });
    return;
  }

  const [advertiser] = await db
    .select()
    .from(marketplaceAdvertisersTable)
    .where(eq(marketplaceAdvertisersTable.id, body.data.advertiserId))
    .limit(1);
  if (
    !advertiser ||
    !privateKeyMatches(
      headers.data["x-marketplace-partner-key"],
      advertiser.accessKeyHash,
    )
  ) {
    res.status(401).json({ error: "Advertiser credentials are invalid." });
    return;
  }
  if (advertiser.status !== "approved") {
    res.status(409).json({
      error: "The advertiser must be approved before submitting campaigns.",
    });
    return;
  }

  const [campaign] = await db
    .insert(marketplaceCampaignsTable)
    .values({
      advertiserId: advertiser.id,
      name: body.data.name.trim(),
      category: body.data.category.trim().toLowerCase(),
      creativeUrl: body.data.creativeUrl,
      creativeText: body.data.creativeText.trim(),
      destinationUrl: body.data.destinationUrl,
      width: body.data.width,
      height: body.data.height,
      bidCpmCents: body.data.bidCpmCents,
      budgetCents: body.data.budgetCents,
      currency: body.data.currency,
      startsAt: body.data.startsAt,
      endsAt: body.data.endsAt,
      status: "submitted",
    })
    .returning();

  req.log.info(
    { advertiserId: advertiser.id, campaignId: campaign.id },
    "Marketplace campaign submitted for review",
  );
  res
    .status(201)
    .json(CreateMarketplaceCampaignResponse.parse(campaignView(campaign)));
});

router.post("/marketplace/delivery", async (req, res): Promise<void> => {
  const body = SelectMarketplaceDeliveryBody.safeParse(req.body);
  const headers = SelectMarketplaceDeliveryHeader.safeParse({
    "x-marketplace-placement-key": headerValue(
      req,
      "x-marketplace-placement-key",
    ),
  });
  if (
    !body.success ||
    !headers.success ||
    !isUuid(body.data.placementId)
  ) {
    res.status(400).json({ error: "Delivery request is invalid." });
    return;
  }

  const [row] = await db
    .select({
      placement: marketplacePlacementsTable,
      host: marketplaceHostsTable,
    })
    .from(marketplacePlacementsTable)
    .innerJoin(
      marketplaceHostsTable,
      eq(marketplaceHostsTable.id, marketplacePlacementsTable.hostId),
    )
    .where(eq(marketplacePlacementsTable.id, body.data.placementId))
    .limit(1);
  if (
    !row ||
    !privateKeyMatches(
      headers.data["x-marketplace-placement-key"],
      row.placement.accessKeyHash,
    )
  ) {
    res.status(401).json({ error: "Placement credentials are invalid." });
    return;
  }
  if (row.host.status !== "approved" || row.placement.status !== "approved") {
    res.json(
      SelectMarketplaceDeliveryResponse.parse({
        fill: false,
        noFillReason: "placement_unavailable",
        campaignId: null,
        creativeUrl: null,
        destinationUrl: null,
        category: null,
        deliveryToken: null,
      }),
    );
    return;
  }

  await releaseExpiredDeliveryReservations();

  const selected = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${row.placement.id}, 0))`,
    );

    const now = new Date();
    const candidates = await tx
      .select({
        campaign: marketplaceCampaignsTable,
        advertiserName: marketplaceAdvertisersTable.name,
      })
      .from(marketplaceCampaignsTable)
      .innerJoin(
        marketplaceAdvertisersTable,
        eq(
          marketplaceAdvertisersTable.id,
          marketplaceCampaignsTable.advertiserId,
        ),
      )
      .where(
        and(
          eq(marketplaceCampaignsTable.status, "approved"),
          eq(marketplaceCampaignsTable.currency, row.placement.currency),
          eq(marketplaceAdvertisersTable.status, "approved"),
          lte(marketplaceCampaignsTable.startsAt, now),
          gte(marketplaceCampaignsTable.endsAt, now),
          gte(
            marketplaceCampaignsTable.bidCpmCents,
            row.placement.floorCpmCents,
          ),
          sql`${marketplaceCampaignsTable.spentMilliCents} < ${marketplaceCampaignsTable.budgetCents} * 1000`,
        ),
      )
      .orderBy(
        desc(marketplaceCampaignsTable.bidCpmCents),
        marketplaceCampaignsTable.createdAt,
      );

    const activeLocks = await tx
      .select()
      .from(marketplaceCategoryLocksTable)
      .where(
        and(
          eq(
            marketplaceCategoryLocksTable.placementId,
            row.placement.id,
          ),
          gte(marketplaceCategoryLocksTable.lockedUntil, now),
        ),
      );

    const eligible = candidates.filter(({ campaign, advertiserName }) => {
      if (
        campaign.width !== row.placement.width ||
        campaign.height !== row.placement.height ||
        !row.placement.allowedCategories.includes(campaign.category)
      ) {
        return false;
      }

      const vetoSubject = [
        advertiserName,
        campaign.name,
        campaign.category,
        campaign.creativeText,
        campaign.creativeUrl,
        campaign.destinationUrl,
      ]
        .join(" ")
        .toLowerCase();
      if (row.placement.vetoTerms.some((term) => vetoSubject.includes(term))) {
        return false;
      }

      return !activeLocks.some(
        (lock) =>
          lock.category === campaign.category &&
          lock.campaignId !== campaign.id,
      );
    });

    for (const candidate of eligible) {
      const reservedMilliCents = candidate.campaign.bidCpmCents;
      const [reservedCampaign] = await tx
        .update(marketplaceCampaignsTable)
        .set({
          spentMilliCents: sql`${marketplaceCampaignsTable.spentMilliCents} + ${reservedMilliCents}`,
          spentCents: sql`((${marketplaceCampaignsTable.spentMilliCents} + ${reservedMilliCents}) / 1000)::integer`,
        })
        .where(
          and(
            eq(
              marketplaceCampaignsTable.id,
              candidate.campaign.id,
            ),
            eq(marketplaceCampaignsTable.status, "approved"),
            lte(marketplaceCampaignsTable.startsAt, now),
            gte(marketplaceCampaignsTable.endsAt, now),
            sql`${marketplaceCampaignsTable.spentMilliCents} + ${reservedMilliCents} <= ${marketplaceCampaignsTable.budgetCents} * 1000`,
            sql`exists (
              select 1
              from marketplace_advertisers advertiser
              where advertiser.id = ${marketplaceCampaignsTable.advertiserId}
                and advertiser.status = 'approved'
            )`,
          ),
        )
        .returning();
      if (!reservedCampaign) {
        continue;
      }

      const identity = createDeliveryIdentity({
        campaignId: reservedCampaign.id,
        placementId: row.placement.id,
      });
      const expiresAt = new Date(identity.expiresAt);

      await tx
        .insert(marketplaceCategoryLocksTable)
        .values({
          placementId: row.placement.id,
          category: reservedCampaign.category,
          campaignId: reservedCampaign.id,
          lockedUntil: expiresAt,
        })
        .onConflictDoUpdate({
          target: [
            marketplaceCategoryLocksTable.placementId,
            marketplaceCategoryLocksTable.category,
          ],
          set: {
            campaignId: reservedCampaign.id,
            lockedUntil: sql`greatest(${marketplaceCategoryLocksTable.lockedUntil}, ${expiresAt})`,
            updatedAt: now,
          },
        });

      await tx.insert(marketplaceDeliveriesTable).values({
        id: identity.deliveryId,
        placementId: row.placement.id,
        campaignId: reservedCampaign.id,
        category: reservedCampaign.category,
        priceCpmCents: reservedCampaign.bidCpmCents,
        reservedMilliCents,
        status: "issued",
        expiresAt,
      });

      return { campaign: reservedCampaign, identity };
    }

    return null;
  });

  if (!selected) {
    res.json(
      SelectMarketplaceDeliveryResponse.parse({
        fill: false,
        noFillReason: "no_eligible_campaign",
        campaignId: null,
        creativeUrl: null,
        destinationUrl: null,
        category: null,
        deliveryToken: null,
      }),
    );
    return;
  }

  res.json(
    SelectMarketplaceDeliveryResponse.parse({
      fill: true,
      noFillReason: null,
      campaignId: selected.campaign.id,
      creativeUrl: selected.campaign.creativeUrl,
      destinationUrl: selected.campaign.destinationUrl,
      category: selected.campaign.category,
      deliveryToken: createDeliveryToken(selected.identity),
    }),
  );
});

router.post("/marketplace/events", async (req, res): Promise<void> => {
  const body = ReportMarketplaceEventBody.safeParse(req.body);
  const headers = ReportMarketplaceEventHeader.safeParse({
    "x-marketplace-signature": headerValue(req, "x-marketplace-signature"),
  });
  if (
    !body.success ||
    !headers.success ||
    !isUuid(body.data.placementId) ||
    !isUuid(body.data.campaignId)
  ) {
    res.status(400).json({ error: "Delivery event is invalid." });
    return;
  }

  const token = verifyDeliveryToken(body.data.deliveryToken);
  if (
    !token ||
    token.campaignId !== body.data.campaignId ||
    token.placementId !== body.data.placementId
  ) {
    res.status(401).json({ error: "Delivery token is invalid or expired." });
    return;
  }

  const [placement] = await db
    .select()
    .from(marketplacePlacementsTable)
    .where(eq(marketplacePlacementsTable.id, body.data.placementId))
    .limit(1);
  if (!placement) {
    res.status(401).json({ error: "Placement is not recognized." });
    return;
  }

  const now = Date.now();
  if (
    body.data.occurredAt.getTime() > now + 5 * 60 * 1000 ||
    body.data.occurredAt.getTime() < now - 30 * 60 * 1000
  ) {
    res.status(400).json({ error: "Event timestamp is outside the reporting window." });
    return;
  }

  const signingSecret = decryptMarketplaceSecret(
    placement.eventSigningSecretEncrypted,
  );
  if (
    !marketplaceEventSignatureMatches(
      body.data,
      headers.data["x-marketplace-signature"],
      signingSecret,
    )
  ) {
    res.status(401).json({ error: "Event signature is invalid." });
    return;
  }

  let accepted: "accepted" | "invalid" | "duplicate";
  try {
    accepted = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${body.data.placementId}, 0))`,
      );
      const [eligibleDelivery] = await tx
        .select({
          delivery: marketplaceDeliveriesTable,
        })
        .from(marketplaceDeliveriesTable)
        .innerJoin(
          marketplaceCampaignsTable,
          eq(
            marketplaceCampaignsTable.id,
            marketplaceDeliveriesTable.campaignId,
          ),
        )
        .innerJoin(
          marketplaceAdvertisersTable,
          eq(
            marketplaceAdvertisersTable.id,
            marketplaceCampaignsTable.advertiserId,
          ),
        )
        .innerJoin(
          marketplacePlacementsTable,
          eq(
            marketplacePlacementsTable.id,
            marketplaceDeliveriesTable.placementId,
          ),
        )
        .innerJoin(
          marketplaceHostsTable,
          eq(
            marketplaceHostsTable.id,
            marketplacePlacementsTable.hostId,
          ),
        )
        .where(
          and(
            eq(marketplaceDeliveriesTable.id, token.deliveryId),
            eq(
              marketplaceDeliveriesTable.placementId,
              body.data.placementId,
            ),
            eq(
              marketplaceDeliveriesTable.campaignId,
              body.data.campaignId,
            ),
            gte(marketplaceDeliveriesTable.expiresAt, new Date()),
            eq(marketplaceCampaignsTable.status, "approved"),
            eq(marketplaceAdvertisersTable.status, "approved"),
            eq(marketplacePlacementsTable.status, "approved"),
            eq(marketplaceHostsTable.status, "approved"),
            lte(
              marketplaceCampaignsTable.startsAt,
              body.data.occurredAt,
            ),
            gte(
              marketplaceCampaignsTable.endsAt,
              body.data.occurredAt,
            ),
          ),
        )
        .limit(1);
      const delivery = eligibleDelivery?.delivery;
      if (!delivery || delivery.status === "expired") {
        return "invalid";
      }
      if (
        body.data.eventType === "click" &&
        delivery.status !== "reconciled"
      ) {
        return "invalid";
      }

      if (body.data.eventType === "impression") {
        const [claimed] = await tx
          .update(marketplaceDeliveriesTable)
          .set({
            status: "reconciled",
            reportedAt: body.data.occurredAt,
          })
          .where(
            and(
              eq(marketplaceDeliveriesTable.id, delivery.id),
              eq(marketplaceDeliveriesTable.status, "issued"),
            ),
          )
          .returning({ id: marketplaceDeliveriesTable.id });
        if (!claimed) {
          return "duplicate";
        }
      }

      const [inserted] = await tx
        .insert(marketplaceDeliveryEventsTable)
        .values({
          externalEventId: body.data.eventId,
          deliveryId: delivery.id,
          placementId: placement.id,
          campaignId: delivery.campaignId,
          eventType: body.data.eventType,
          occurredAt: body.data.occurredAt,
          priceCpmCents: delivery.priceCpmCents,
        })
        .onConflictDoNothing()
        .returning({ id: marketplaceDeliveryEventsTable.id });
      if (!inserted) {
        throw new Error("DUPLICATE_MARKETPLACE_EVENT");
      }

      if (body.data.eventType === "impression") {
        const lockedUntil = new Date(
          body.data.occurredAt.getTime() +
            placement.exclusivityHours * 60 * 60 * 1000,
        );
        await tx
          .update(marketplaceCategoryLocksTable)
          .set({
            lockedUntil: sql`greatest(${marketplaceCategoryLocksTable.lockedUntil}, ${lockedUntil})`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(
                marketplaceCategoryLocksTable.placementId,
                placement.id,
              ),
              eq(
                marketplaceCategoryLocksTable.category,
                delivery.category,
              ),
              eq(
                marketplaceCategoryLocksTable.campaignId,
                delivery.campaignId,
              ),
            ),
          );
      }

      return "accepted";
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DUPLICATE_MARKETPLACE_EVENT"
    ) {
      accepted = "duplicate";
    } else {
      throw error;
    }
  }

  if (accepted === "invalid") {
    res.status(401).json({ error: "Delivery reservation is invalid or expired." });
    return;
  }
  if (accepted === "duplicate") {
    res.status(409).json({ error: "This delivery event was already accepted." });
    return;
  }

  res.status(201).json(
    ReportMarketplaceEventResponse.parse({
      accepted: true,
      eventId: body.data.eventId,
    }),
  );
});

router.get(
  "/marketplace/admin/overview",
  async (req, res): Promise<void> => {
    if (!requireAdmin(req)) {
      res.status(401).json({ error: "Administrator authentication failed." });
      return;
    }

    await releaseExpiredDeliveryReservations();
    const [hosts, placements, advertisers, campaigns, delivery] =
      await Promise.all([
        db.select().from(marketplaceHostsTable).orderBy(desc(marketplaceHostsTable.createdAt)),
        db
          .select()
          .from(marketplacePlacementsTable)
          .orderBy(desc(marketplacePlacementsTable.createdAt)),
        db
          .select()
          .from(marketplaceAdvertisersTable)
          .orderBy(desc(marketplaceAdvertisersTable.createdAt)),
        db
          .select()
          .from(marketplaceCampaignsTable)
          .orderBy(desc(marketplaceCampaignsTable.createdAt)),
        db
          .select({
            placementId: marketplaceDeliveryEventsTable.placementId,
            campaignId: marketplaceDeliveryEventsTable.campaignId,
            impressions: sql<number>`count(*) filter (where ${marketplaceDeliveryEventsTable.eventType} = 'impression')::integer`,
            clicks: sql<number>`count(*) filter (where ${marketplaceDeliveryEventsTable.eventType} = 'click')::integer`,
            lastEventAt: sql<Date | null>`max(${marketplaceDeliveryEventsTable.occurredAt})`,
          })
          .from(marketplaceDeliveryEventsTable)
          .groupBy(
            marketplaceDeliveryEventsTable.placementId,
            marketplaceDeliveryEventsTable.campaignId,
          ),
      ]);

    res.json(
      GetMarketplaceAdminOverviewResponse.parse({
        hosts: hosts.map(hostView),
        placements: placements.map(placementView),
        advertisers: advertisers.map(advertiserView),
        campaigns: campaigns.map(campaignView),
        eligibility: campaigns.map((campaign) => {
          const advertiser = advertisers.find(
            (item) => item.id === campaign.advertiserId,
          );
          const blockers = [
            ...(campaign.status === "approved"
              ? []
              : ["campaign_not_approved" as const]),
            ...(advertiser?.status === "approved"
              ? []
              : ["advertiser_not_approved" as const]),
            ...(campaign.startsAt <= new Date()
              ? []
              : ["not_started" as const]),
            ...(campaign.endsAt >= new Date() ? [] : ["ended" as const]),
            ...(campaign.spentMilliCents + campaign.bidCpmCents <=
            campaign.budgetCents * 1000
              ? []
              : ["budget_exhausted" as const]),
          ];
          return {
            campaignId: campaign.id,
            eligible: blockers.length === 0,
            blockers,
          };
        }),
        delivery: delivery.map((item) => ({
          ...item,
          impressions: Number(item.impressions),
          clicks: Number(item.clicks),
        })),
        settlement: campaigns.map((campaign) => ({
          campaignId: campaign.id,
          budgetCents: campaign.budgetCents,
          spentCents: campaign.spentCents,
          status:
            campaign.status !== "approved"
              ? "awaiting_approval"
              : campaign.spentCents >= campaign.budgetCents
                ? "fulfilled"
                : "delivering",
        })),
      }),
    );
  },
);

router.patch(
  "/marketplace/admin/hosts/:hostId",
  async (req, res): Promise<void> => {
    const params = ReviewMarketplaceHostParams.safeParse(req.params);
    const body = ReviewMarketplaceHostBody.safeParse(req.body);
    if (!requireAdmin(req)) {
      res.status(401).json({ error: "Administrator authentication failed." });
      return;
    }
    if (
      !params.success ||
      !isUuid(params.data.hostId) ||
      !body.success ||
      !["approved", "suspended", "rejected"].includes(body.data.status)
    ) {
      res.status(400).json({ error: "Host review is invalid." });
      return;
    }

    const host = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(marketplaceHostsTable)
        .set({ status: body.data.status })
        .where(eq(marketplaceHostsTable.id, params.data.hostId))
        .returning();
      if (updated && body.data.status !== "approved") {
        const placements = await tx
          .select({ id: marketplacePlacementsTable.id })
          .from(marketplacePlacementsTable)
          .where(eq(marketplacePlacementsTable.hostId, updated.id));
        if (placements.length > 0) {
          await expireIssuedReservations(
            tx,
            inArray(
              marketplaceDeliveriesTable.placementId,
              placements.map((item) => item.id),
            ),
          );
        }
      }
      return updated;
    });
    if (!host) {
      res.status(404).json({ error: "Host not found." });
      return;
    }
    res.json(ReviewMarketplaceHostResponse.parse(hostView(host)));
  },
);

router.patch(
  "/marketplace/admin/placements/:placementId",
  async (req, res): Promise<void> => {
    const params = ReviewMarketplacePlacementParams.safeParse(req.params);
    const body = ReviewMarketplacePlacementBody.safeParse(req.body);
    if (!requireAdmin(req)) {
      res.status(401).json({ error: "Administrator authentication failed." });
      return;
    }
    if (
      !params.success ||
      !isUuid(params.data.placementId) ||
      !body.success ||
      !["approved", "paused", "rejected"].includes(body.data.status)
    ) {
      res.status(400).json({ error: "Placement review is invalid." });
      return;
    }

    const placement = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(marketplacePlacementsTable)
        .set({ status: body.data.status })
        .where(eq(marketplacePlacementsTable.id, params.data.placementId))
        .returning();
      if (updated && body.data.status !== "approved") {
        await expireIssuedReservations(
          tx,
          eq(marketplaceDeliveriesTable.placementId, updated.id),
        );
      }
      return updated;
    });
    if (!placement) {
      res.status(404).json({ error: "Placement not found." });
      return;
    }
    res.json(
      ReviewMarketplacePlacementResponse.parse(placementView(placement)),
    );
  },
);

router.patch(
  "/marketplace/admin/advertisers/:advertiserId",
  async (req, res): Promise<void> => {
    const params = ReviewMarketplaceAdvertiserParams.safeParse(req.params);
    const body = ReviewMarketplaceAdvertiserBody.safeParse(req.body);
    if (!requireAdmin(req)) {
      res.status(401).json({ error: "Administrator authentication failed." });
      return;
    }
    if (
      !params.success ||
      !isUuid(params.data.advertiserId) ||
      !body.success ||
      !["approved", "suspended", "rejected"].includes(body.data.status)
    ) {
      res.status(400).json({ error: "Advertiser review is invalid." });
      return;
    }

    const advertiser = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(marketplaceAdvertisersTable)
        .set({ status: body.data.status })
        .where(
          eq(marketplaceAdvertisersTable.id, params.data.advertiserId),
        )
        .returning();
      if (updated && body.data.status !== "approved") {
        const campaigns = await tx
          .select({ id: marketplaceCampaignsTable.id })
          .from(marketplaceCampaignsTable)
          .where(
            eq(
              marketplaceCampaignsTable.advertiserId,
              updated.id,
            ),
          );
        if (campaigns.length > 0) {
          await expireIssuedReservations(
            tx,
            inArray(
              marketplaceDeliveriesTable.campaignId,
              campaigns.map((item) => item.id),
            ),
          );
        }
      }
      return updated;
    });
    if (!advertiser) {
      res.status(404).json({ error: "Advertiser not found." });
      return;
    }
    res.json(
      ReviewMarketplaceAdvertiserResponse.parse(
        advertiserView(advertiser),
      ),
    );
  },
);

router.patch(
  "/marketplace/admin/campaigns/:campaignId",
  async (req, res): Promise<void> => {
    const params = ReviewMarketplaceCampaignParams.safeParse(req.params);
    const body = ReviewMarketplaceCampaignBody.safeParse(req.body);
    if (!requireAdmin(req)) {
      res.status(401).json({ error: "Administrator authentication failed." });
      return;
    }
    if (
      !params.success ||
      !isUuid(params.data.campaignId) ||
      !body.success ||
      !["approved", "paused", "rejected"].includes(body.data.status)
    ) {
      res.status(400).json({ error: "Campaign review is invalid." });
      return;
    }

    const campaign = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(marketplaceCampaignsTable)
        .set({
          status: body.data.status,
          reviewNote: body.data.reviewNote ?? null,
        })
        .where(eq(marketplaceCampaignsTable.id, params.data.campaignId))
        .returning();
      if (updated && body.data.status !== "approved") {
        await expireIssuedReservations(
          tx,
          eq(marketplaceDeliveriesTable.campaignId, updated.id),
        );
      }
      return updated;
    });
    if (!campaign) {
      res.status(404).json({ error: "Campaign not found." });
      return;
    }
    res.json(
      ReviewMarketplaceCampaignResponse.parse(campaignView(campaign)),
    );
  },
);

export default router;