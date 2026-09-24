import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  advertiserIntakeReviewEventsTable,
  advertiserIntakesTable,
  commercialInquiriesTable,
  db,
  pilotWaitlistEntriesTable,
  salesStaffAccessEventsTable,
  salesStaffAccessTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  CreateAdvertiserIntakeBody,
  CreateAdvertiserIntakeResponse,
  GetLaunchStatusResponse,
  CreateCommercialInquiryBody,
  CreateCommercialInquiryResponse,
  GrantSalesStaffAccessBody,
  GrantSalesStaffAccessResponse,
  JoinPilotWaitlistBody,
  JoinPilotWaitlistResponse,
  ListAdvertiserIntakesResponse,
  ListCategoryInsightsResponse,
  ListSalesStaffAccessResponse,
  RevokeSalesStaffAccessBody,
  RevokeSalesStaffAccessParams,
  RevokeSalesStaffAccessResponse,
  UpdateAdvertiserIntakeReviewStatusBody,
  UpdateAdvertiserIntakeReviewStatusParams,
  UpdateAdvertiserIntakeReviewStatusResponse,
} from "@workspace/api-zod";
import { getPublicLaunchMode } from "../lib/launchMode";
import { captureAdvertiserIntakeLead } from "../lib/leadCapture";
import { attributionFrom } from "../lib/publicGuards";
import { hasValidQaHeader } from "../lib/testTraffic";
import {
  getAuthorizedSalesStaff,
  requireSalesManager,
  requireSalesStaff,
} from "../lib/salesStaffAccess";

const router: IRouter = Router();

const INSIGHT_WINDOW_DAYS = 90;
const MIN_CAMPAIGNS = 5;
const MIN_PLACEMENTS = 3;
const MIN_IMPRESSIONS = 100;

type InsightRow = {
  category: string;
  campaigns: number | string;
  placements: number | string;
  impressions: number | string;
  clicks: number | string;
};

export function buildPublicCategoryInsight(row: InsightRow): {
  category: string;
  status: "collecting" | "published";
  campaigns: number | null;
  placements: number | null;
  impressions: number | null;
  clicks: number | null;
  clickThroughRateBps: number | null;
} {
  const campaigns = Number(row.campaigns);
  const placements = Number(row.placements);
  const impressions = Number(row.impressions);
  const clicks = Number(row.clicks);
  const isPublished =
    campaigns >= MIN_CAMPAIGNS &&
    placements >= MIN_PLACEMENTS &&
    impressions >= MIN_IMPRESSIONS;

  return {
    category: row.category,
    status: isPublished ? "published" : "collecting",
    campaigns: isPublished ? campaigns : null,
    placements: isPublished ? placements : null,
    impressions: isPublished ? impressions : null,
    clicks: isPublished ? clicks : null,
    clickThroughRateBps: isPublished
      ? Math.round((clicks / impressions) * 10_000)
      : null,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidWebsite(website: string | undefined): boolean {
  if (!website) {
    return true;
  }

  try {
    const parsed = new URL(website);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function advertiserIntakeQueueItem(
  intake: typeof advertiserIntakesTable.$inferSelect,
) {
  return {
    id: intake.id,
    email: intake.normalizedEmail,
    visitorType: intake.visitorType,
    advertisingIntent: intake.advertisingIntent,
    advertiserSize: intake.advertiserSize,
    operatingScope: intake.operatingScope,
    adInterest: intake.adInterest,
    source: intake.source,
    reviewStatus: intake.reviewStatus,
    lastReviewedBy: intake.lastReviewedByName,
    lastReviewedAt: intake.lastReviewedAt,
    createdAt: intake.createdAt,
  };
}

type SalesStaffRosterChange = Pick<
  typeof salesStaffAccessEventsTable.$inferSelect,
  "actorName" | "createdAt"
>;

function salesStaffAccessRosterItem(
  staff: typeof salesStaffAccessTable.$inferSelect,
  lastChange?: SalesStaffRosterChange,
) {
  return {
    id: staff.id,
    email: staff.normalizedEmail,
    displayName: staff.displayName,
    role: staff.role,
    accessStatus: staff.accessStatus,
    identityBound: Boolean(staff.clerkUserId),
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    revokedAt: staff.revokedAt,
    lastChangedBy: lastChange?.actorName ?? null,
    lastChangedAt: lastChange?.createdAt ?? null,
  };
}

const ADVERTISER_INTAKE_KEYS = new Set([
  "email",
  "visitorType",
  "advertisingIntent",
  "advertiserSize",
  "operatingScope",
  "adInterest",
  "source",
  "followUpConsent",
]);

export function hasOnlyAdvertiserIntakeFields(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).every((key) => ADVERTISER_INTAKE_KEYS.has(key)),
  );
}

type AdvertiserIntakeBody = ReturnType<
  typeof CreateAdvertiserIntakeBody.parse
>;

function hasValidAdvertiserIntakeProgression(
  data: AdvertiserIntakeBody,
): boolean {
  if (data.advertisingIntent === "interested") {
    return Boolean(
      data.advertiserSize &&
        data.operatingScope &&
        data.adInterest,
    );
  }

  return !data.advertiserSize && !data.operatingScope;
}

router.get("/launch/status", (_req, res): void => {
  res.json(GetLaunchStatusResponse.parse(getPublicLaunchMode()));
});

router.post("/launch/waitlist", async (req, res): Promise<void> => {
  const parsed = JoinPilotWaitlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the required pilot request fields." });
    return;
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const website = parsed.data.website?.trim();
  if (!isValidEmail(normalizedEmail) || !isValidWebsite(website)) {
    res.status(400).json({ error: "Enter a valid email and website." });
    return;
  }

  const inserted = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('pilot_waitlist_entries_queue', 0))`,
    );

    const [created] = await tx
      .insert(pilotWaitlistEntriesTable)
      .values({
        normalizedEmail,
        interestType: parsed.data.interestType,
        category: parsed.data.category?.trim() || null,
        company: parsed.data.company?.trim() || null,
        website: website || null,
        businessSize: parsed.data.businessSize ?? null,
        marketingConsent: parsed.data.marketingConsent,
        createdAt: sql`clock_timestamp()`,
      })
      .onConflictDoNothing({
        target: pilotWaitlistEntriesTable.normalizedEmail,
      })
      .returning({ id: pilotWaitlistEntriesTable.id });

    return Boolean(created);
  });

  const receipt = JoinPilotWaitlistResponse.parse({
    status: "received",
    requestId: randomUUID(),
  });

  req.log.info(
    {
      interestType: parsed.data.interestType,
      created: inserted,
      requestId: receipt.requestId,
      attribution: attributionFrom(res),
    },
    "Pilot waitlist request accepted",
  );
  res.status(202).json(receipt);
});

router.post("/launch/commercial-inquiries", async (req, res): Promise<void> => {
  const parsed = CreateCommercialInquiryBody.safeParse(req.body);
  if (!parsed.success || parsed.data.transactionConsent !== true) {
    res.status(400).json({ error: "Check the required commercial request fields." });
    return;
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const website = parsed.data.website.trim();
  const name = parsed.data.name.trim();
  const company = parsed.data.company.trim();
  const category = parsed.data.category.trim();
  const details = parsed.data.details.trim();
  if (
    !isValidEmail(normalizedEmail) ||
    !isValidWebsite(website) ||
    name.length < 2 ||
    company.length < 2 ||
    category.length < 2 ||
    details.length < 10
  ) {
    res.status(400).json({ error: "Enter a valid email and website." });
    return;
  }

  const [inquiry] = await db
    .insert(commercialInquiriesTable)
    .values({
      inquiryType: parsed.data.inquiryType,
      normalizedEmail,
      name,
      company,
      website,
      category,
      coverageRegion: parsed.data.coverageRegion,
      details,
      transactionConsent: true,
      marketingConsent: parsed.data.marketingConsent ?? false,
      createdAt: sql`clock_timestamp()`,
      updatedAt: sql`clock_timestamp()`,
    })
    .onConflictDoUpdate({
      target: [
        commercialInquiriesTable.normalizedEmail,
        commercialInquiriesTable.inquiryType,
      ],
      set: {
        name,
        company,
        website,
        category,
        coverageRegion: parsed.data.coverageRegion,
        details,
        transactionConsent: true,
        marketingConsent: parsed.data.marketingConsent ?? false,
        updatedAt: sql`clock_timestamp()`,
      },
    })
    .returning({ id: commercialInquiriesTable.id });

  if (!inquiry) {
    throw new Error("Commercial inquiry was not persisted.");
  }

  const receipt = CreateCommercialInquiryResponse.parse({
    status: "received",
    requestId: inquiry.id,
  });

  req.log.info(
    {
      inquiryType: parsed.data.inquiryType,
      requestId: receipt.requestId,
      attribution: attributionFrom(res),
    },
    "Commercial inquiry accepted",
  );
  res.status(202).json(receipt);
});

router.post("/launch/advertiser-intake", async (req, res): Promise<void> => {
  const parsed = CreateAdvertiserIntakeBody.safeParse(req.body);
  if (
    !parsed.success ||
    !hasOnlyAdvertiserIntakeFields(req.body) ||
    (parsed.success && !hasValidAdvertiserIntakeProgression(parsed.data)) ||
    parsed.data.followUpConsent !== true
  ) {
    res.status(400).json({ error: "Check the advertiser follow-up fields." });
    return;
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    res.status(400).json({ error: "Enter a valid follow-up email." });
    return;
  }

  const [intake] = await db
    .insert(advertiserIntakesTable)
    .values({
      normalizedEmail,
      visitorType: parsed.data.visitorType,
      advertisingIntent: parsed.data.advertisingIntent,
      advertiserSize: parsed.data.advertiserSize ?? null,
      operatingScope: parsed.data.operatingScope ?? null,
      adInterest: parsed.data.adInterest ?? null,
      source: parsed.data.source,
      followUpConsent: true,
    })
    .returning({ id: advertiserIntakesTable.id });

  if (!intake) {
    throw new Error("Advertiser intake was not persisted.");
  }

  // Single system of record (HARD 5:46pm): mirror into leads + Friday push. Never throws.
  await captureAdvertiserIntakeLead({
    id: intake.id,
    email: normalizedEmail,
    advertisingIntent: parsed.data.advertisingIntent,
    advertiserSize: parsed.data.advertiserSize ?? null,
    adInterest: parsed.data.adInterest ?? null,
    source: parsed.data.source,
    isTest: hasValidQaHeader(req),
    attribution: attributionFrom(res),
  });

  req.log.info(
    {
      intakeId: intake.id,
      visitorType: parsed.data.visitorType,
      advertisingIntent: parsed.data.advertisingIntent,
      source: parsed.data.source,
    },
    "Advertiser follow-up request accepted",
  );

  res.status(202).json(
    CreateAdvertiserIntakeResponse.parse({
      intakeId: intake.id,
      status: "received",
    }),
  );
});

router.get(
  "/launch/admin/advertiser-intakes",
  requireSalesStaff,
  async (req, res): Promise<void> => {
    const intakes = await db
      .select()
      .from(advertiserIntakesTable)
      .orderBy(desc(advertiserIntakesTable.createdAt));

    res.set("Cache-Control", "no-store");
    res.json(
      ListAdvertiserIntakesResponse.parse(
        intakes.map(advertiserIntakeQueueItem),
      ),
    );
  },
);

router.patch(
  "/launch/admin/advertiser-intakes/:intakeId",
  requireSalesStaff,
  async (req, res): Promise<void> => {
    const params = UpdateAdvertiserIntakeReviewStatusParams.safeParse(
      req.params,
    );
    const body = UpdateAdvertiserIntakeReviewStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Choose a valid review status." });
      return;
    }

    const staff = getAuthorizedSalesStaff(req);
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(advertiserIntakesTable)
        .where(eq(advertiserIntakesTable.id, params.data.intakeId))
        .limit(1)
        .for("update");

      if (!current) {
        return null;
      }

      if (current.reviewStatus === body.data.reviewStatus) {
        return current;
      }

      const reviewedAt = new Date();
      const [next] = await tx
        .update(advertiserIntakesTable)
        .set({
          reviewStatus: body.data.reviewStatus,
          lastReviewedByStaffAccessId: staff.id,
          lastReviewedByName: staff.displayName,
          lastReviewedAt: reviewedAt,
        })
        .where(eq(advertiserIntakesTable.id, params.data.intakeId))
        .returning();

      if (!next) {
        return null;
      }

      await tx.insert(advertiserIntakeReviewEventsTable).values({
        advertiserIntakeId: next.id,
        previousStatus: current.reviewStatus,
        nextStatus: next.reviewStatus,
        staffAccessId: staff.id,
        actorClerkUserId: staff.clerkUserId,
        actorName: staff.displayName,
        createdAt: reviewedAt,
      });

      return next;
    });

    if (!updated) {
      res.status(404).json({ error: "Advertiser request not found." });
      return;
    }

    req.log.info(
      {
        intakeId: updated.id,
        reviewStatus: updated.reviewStatus,
        staffAccessId: staff.id,
      },
      "Advertiser follow-up review status updated",
    );
    res.set("Cache-Control", "no-store");
    res.json(
      UpdateAdvertiserIntakeReviewStatusResponse.parse(
        {
          id: updated.id,
          reviewStatus: updated.reviewStatus,
          reviewedBy: updated.lastReviewedByName,
          reviewedAt: updated.lastReviewedAt,
        },
      ),
    );
  },
);

router.get(
  "/launch/admin/sales-staff",
  requireSalesManager,
  async (_req, res): Promise<void> => {
    const staff = await db
      .select()
      .from(salesStaffAccessTable)
      .where(eq(salesStaffAccessTable.role, "sales"))
      .orderBy(desc(salesStaffAccessTable.updatedAt));
    const staffIds = staff.map((entry) => entry.id);
    const changes =
      staffIds.length === 0
        ? []
        : await db
            .select({
              targetStaffAccessId:
                salesStaffAccessEventsTable.targetStaffAccessId,
              actorName: salesStaffAccessEventsTable.actorName,
              createdAt: salesStaffAccessEventsTable.createdAt,
            })
            .from(salesStaffAccessEventsTable)
            .where(
              inArray(
                salesStaffAccessEventsTable.targetStaffAccessId,
                staffIds,
              ),
            )
            .orderBy(desc(salesStaffAccessEventsTable.createdAt));
    const latestChanges = new Map<string, SalesStaffRosterChange>();
    for (const change of changes) {
      if (!latestChanges.has(change.targetStaffAccessId)) {
        latestChanges.set(change.targetStaffAccessId, change);
      }
    }

    res.set("Cache-Control", "no-store");
    res.json(
      ListSalesStaffAccessResponse.parse(
        staff.map((entry) =>
          salesStaffAccessRosterItem(entry, latestChanges.get(entry.id)),
        ),
      ),
    );
  },
);

router.post(
  "/launch/admin/sales-staff",
  requireSalesManager,
  async (req, res): Promise<void> => {
    const body = GrantSalesStaffAccessBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Check the teammate name and email." });
      return;
    }

    const normalizedEmail = body.data.email.trim().toLowerCase();
    const displayName = body.data.displayName.trim();
    if (
      !isValidEmail(normalizedEmail) ||
      displayName.length < 2 ||
      displayName.length > 120
    ) {
      res.status(400).json({ error: "Check the teammate name and email." });
      return;
    }

    const manager = getAuthorizedSalesStaff(req);
    const result = await db.transaction(async (tx) => {
      const [activeManager] = await tx
        .select({ id: salesStaffAccessTable.id })
        .from(salesStaffAccessTable)
        .where(
          and(
            eq(salesStaffAccessTable.id, manager.id),
            eq(salesStaffAccessTable.clerkUserId, manager.clerkUserId),
            eq(salesStaffAccessTable.role, "sales_manager"),
            eq(salesStaffAccessTable.accessStatus, "active"),
            isNull(salesStaffAccessTable.revokedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (!activeManager) {
        return { unauthorized: true as const };
      }

      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${normalizedEmail}, 0))`,
      );
      const [current] = await tx
        .select()
        .from(salesStaffAccessTable)
        .where(eq(salesStaffAccessTable.normalizedEmail, normalizedEmail))
        .limit(1)
        .for("update");

      if (
        current?.role === "sales_manager" ||
        (current?.role === "sales" &&
          current.accessStatus === "active" &&
          current.revokedAt === null)
      ) {
        return { conflict: true as const };
      }

      const changedAt = new Date();
      const [staff] = current
        ? await tx
            .update(salesStaffAccessTable)
            .set({
              displayName,
              role: "sales",
              accessStatus: "active",
              revokedAt: null,
              updatedAt: changedAt,
            })
            .where(eq(salesStaffAccessTable.id, current.id))
            .returning()
        : await tx
            .insert(salesStaffAccessTable)
            .values({
              normalizedEmail,
              displayName,
              role: "sales",
              accessStatus: "active",
              createdAt: changedAt,
              updatedAt: changedAt,
            })
            .returning();

      if (!staff) {
        throw new Error("Sales teammate access was not persisted.");
      }

      await tx.insert(salesStaffAccessEventsTable).values({
        targetStaffAccessId: staff.id,
        targetNormalizedEmail: staff.normalizedEmail,
        targetDisplayName: staff.displayName,
        action: "grant",
        previousStatus: current?.accessStatus ?? null,
        nextStatus: staff.accessStatus,
        managerStaffAccessId: manager.id,
        actorClerkUserId: manager.clerkUserId,
        actorName: manager.displayName,
        createdAt: changedAt,
      });

      return { staff, changedAt };
    });

    if ("unauthorized" in result) {
      res.status(403).json({
        error: "Sales manager access is not active for this account.",
      });
      return;
    }
    if ("conflict" in result) {
      res.status(409).json({
        error:
          "That account already has active access or belongs to a protected manager.",
      });
      return;
    }

    req.log.info(
      {
        targetStaffAccessId: result.staff.id,
        managerStaffAccessId: manager.id,
        action: "grant",
      },
      "Sales teammate access granted",
    );
    res.set("Cache-Control", "no-store");
    res.json(
      GrantSalesStaffAccessResponse.parse(
        salesStaffAccessRosterItem(result.staff, {
          actorName: manager.displayName,
          createdAt: result.changedAt,
        }),
      ),
    );
  },
);

router.patch(
  "/launch/admin/sales-staff/:staffAccessId",
  requireSalesManager,
  async (req, res): Promise<void> => {
    const params = RevokeSalesStaffAccessParams.safeParse(req.params);
    const body = RevokeSalesStaffAccessBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Choose a valid sales teammate." });
      return;
    }

    const manager = getAuthorizedSalesStaff(req);
    const result = await db.transaction(async (tx) => {
      const [activeManager] = await tx
        .select({ id: salesStaffAccessTable.id })
        .from(salesStaffAccessTable)
        .where(
          and(
            eq(salesStaffAccessTable.id, manager.id),
            eq(salesStaffAccessTable.clerkUserId, manager.clerkUserId),
            eq(salesStaffAccessTable.role, "sales_manager"),
            eq(salesStaffAccessTable.accessStatus, "active"),
            isNull(salesStaffAccessTable.revokedAt),
          ),
        )
        .limit(1)
        .for("update");
      if (!activeManager) {
        return { unauthorized: true as const };
      }

      const [current] = await tx
        .select()
        .from(salesStaffAccessTable)
        .where(eq(salesStaffAccessTable.id, params.data.staffAccessId))
        .limit(1)
        .for("update");

      if (!current || current.role !== "sales") {
        return { missing: true as const };
      }
      if (current.accessStatus === "revoked" && current.revokedAt) {
        return { conflict: true as const };
      }

      const changedAt = new Date();
      const [staff] = await tx
        .update(salesStaffAccessTable)
        .set({
          accessStatus: "revoked",
          revokedAt: changedAt,
          updatedAt: changedAt,
        })
        .where(eq(salesStaffAccessTable.id, current.id))
        .returning();

      if (!staff) {
        throw new Error("Sales teammate access was not revoked.");
      }

      await tx.insert(salesStaffAccessEventsTable).values({
        targetStaffAccessId: staff.id,
        targetNormalizedEmail: staff.normalizedEmail,
        targetDisplayName: staff.displayName,
        action: "revoke",
        previousStatus: current.accessStatus,
        nextStatus: staff.accessStatus,
        managerStaffAccessId: manager.id,
        actorClerkUserId: manager.clerkUserId,
        actorName: manager.displayName,
        createdAt: changedAt,
      });

      return { staff, changedAt };
    });

    if ("unauthorized" in result) {
      res.status(403).json({
        error: "Sales manager access is not active for this account.",
      });
      return;
    }
    if ("missing" in result) {
      res.status(404).json({ error: "Sales teammate not found." });
      return;
    }
    if ("conflict" in result) {
      res.status(409).json({ error: "Sales teammate access is already revoked." });
      return;
    }

    req.log.info(
      {
        targetStaffAccessId: result.staff.id,
        managerStaffAccessId: manager.id,
        action: "revoke",
      },
      "Sales teammate access revoked",
    );
    res.set("Cache-Control", "no-store");
    res.json(
      RevokeSalesStaffAccessResponse.parse(
        salesStaffAccessRosterItem(result.staff, {
          actorName: manager.displayName,
          createdAt: result.changedAt,
        }),
      ),
    );
  },
);

router.get("/launch/category-insights", async (_req, res): Promise<void> => {
  const cutoff = new Date(
    Date.now() - INSIGHT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const result = await db.execute(sql`
    with categorized_campaigns as (
      select
        id,
        case
          when lower(trim(category)) in ('health', 'healthcare', 'wellness', 'medical') then 'Healthcare'
          when lower(trim(category)) in ('professional services', 'professional-services', 'b2b services') then 'Professional services'
          when lower(trim(category)) in ('finance', 'financial services', 'financial-services', 'insurance') then 'Financial services'
          when lower(trim(category)) in ('home services', 'home-services', 'home improvement') then 'Home services'
          when lower(trim(category)) in ('education', 'training', 'learning') then 'Education'
          when lower(trim(category)) in ('consumer goods', 'consumer-goods', 'retail', 'ecommerce', 'e-commerce') then 'Consumer goods'
          else null
        end as public_category
      from marketplace_campaigns
      where status in ('submitted', 'approved', 'paused')
    )
    select
      cc.public_category as category,
      count(distinct e.campaign_id)::int as campaigns,
      count(distinct e.placement_id)::int as placements,
      count(*) filter (where e.event_type = 'impression')::int as impressions,
      count(*) filter (where e.event_type = 'click')::int as clicks
    from categorized_campaigns cc
    left join marketplace_delivery_events e
      on e.campaign_id = cc.id
      and e.occurred_at >= ${cutoff}
    where cc.public_category is not null
    group by cc.public_category
    order by cc.public_category
  `);

  const items = (result.rows as InsightRow[]).map(buildPublicCategoryInsight);

  res.json(
    ListCategoryInsightsResponse.parse({
      status: items.some((item) => item.status === "published")
        ? "published"
        : "collecting",
      windowDays: INSIGHT_WINDOW_DAYS,
      updatedAt: new Date(),
      items,
    }),
  );
});

export default router;