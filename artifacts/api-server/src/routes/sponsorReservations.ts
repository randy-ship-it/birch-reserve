/**
 * Birch Reserve request-only Founding Sponsor routes.
 *
 * This application does not collect payment. Every package submission creates
 * a durable request for private commercial and host review.
 */

import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { db, sponsorReservationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateSponsorReservationBody,
  CreateSponsorReservationResponse,
  GetSponsorOfferResponse,
  GetSponsorReservationStatusResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const FOUNDING_SPONSOR_AMOUNT_CENTS = "500000";
const TEST_PILOT_AMOUNT_CENTS = "1000000";
const CURRENCY = "cad";

const PACKAGE_BRAND = "founding_sponsor_brand_5k_cad";
const PACKAGE_CLINIC = "founding_sponsor_clinic_5k_cad";
const PACKAGE_TEST_PILOT = "test_pilot_10k_cad";

const COMMERCIAL_POLICY_METADATA = {
  host_veto_policy: "alternate_or_withdrawn",
  fulfillment: "manual_after_approval",
  payment_collection: "not_available_in_app",
} as const;

router.get("/launch/sponsor/offer", (_req, res): void => {
  res.json(
    GetSponsorOfferResponse.parse({
      offerStatus: "reserve_only",
      packages: [
        {
          packageKey: PACKAGE_BRAND,
          label: "Founding Sponsor",
          amountCents: Number(FOUNDING_SPONSOR_AMOUNT_CENTS),
          currency: CURRENCY,
          termDays: 90,
          description:
            "Indicative CAD 5,000 commercial package. One complementary seat on one approved live hub, host veto with an alternative offer, category exclusivity, and an end-of-term view/click note. Request-only and pending manual review; no payment is collected here.",
        },
        {
          packageKey: PACKAGE_TEST_PILOT,
          label: "Test Pilot",
          amountCents: Number(TEST_PILOT_AMOUNT_CENTS),
          currency: CURRENCY,
          termDays: 90,
          description:
            "Indicative CAD 10,000 request-only package. Subject to separate enablement and not currently available for purchase.",
        },
      ],
    }),
  );
});

router.post("/launch/sponsor/reserve", async (req, res): Promise<void> => {
  const parsed = CreateSponsorReservationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid reservation request fields." });
    return;
  }

  const {
    packageType,
    accessRoute,
    buyerEmail,
    buyerName,
    companyName,
    companyWebsite,
    requestedHubId,
    requestedHubName,
    requestedCategory,
    advertisingObjective,
    preferredPlacement,
    investmentRange,
    launchTimeline,
    creativeStatus,
    additionalNotes,
    termsAccepted,
    marketingConsent,
  } = parsed.data;

  if (!termsAccepted) {
    res.status(400).json({ error: "termsAccepted must be true." });
    return;
  }

  const isTestPilotPackage = packageType === "test_pilot";
  const isTestPilotRoute = accessRoute === "test_pilot";
  if (isTestPilotPackage !== isTestPilotRoute) {
    res.status(400).json({ error: "Package type and access route do not match." });
    return;
  }

  const contributorVerificationStatus =
    accessRoute === "ecosystem_contributor" ? "pending" : "not_applicable";

  const normalizedEmail = buyerEmail.trim().toLowerCase();
  const normalizedName = buyerName.trim();
  const normalizedCompany = companyName.trim();
  const normalizedWebsite = companyWebsite.trim();
  const normalizedCategory = requestedCategory.trim();

  if (
    !isValidEmail(normalizedEmail) ||
    !isValidWebsite(normalizedWebsite) ||
    normalizedName.length < 2 ||
    normalizedCompany.length < 2 ||
    normalizedCategory.length < 2
  ) {
    res.status(400).json({ error: "Invalid reservation request fields." });
    return;
  }

  let packageKey: string;
  let amountCents: string;
  switch (packageType) {
    case "brand":
    case "retail":
    case "other":
      packageKey = PACKAGE_BRAND;
      amountCents = FOUNDING_SPONSOR_AMOUNT_CENTS;
      break;
    case "clinic":
    case "physio":
      packageKey = PACKAGE_CLINIC;
      amountCents = FOUNDING_SPONSOR_AMOUNT_CENTS;
      break;
    case "test_pilot":
      packageKey = PACKAGE_TEST_PILOT;
      amountCents = TEST_PILOT_AMOUNT_CENTS;
      break;
    default:
      res.status(400).json({ error: "Unknown packageType." });
      return;
  }

  const lookupToken = `${randomUUID()}-${randomUUID()}`;
  const [reservation] = await db
    .insert(sponsorReservationsTable)
    .values({
      packageKey,
      amountCents,
      currency: CURRENCY,
      status: "reserve_only",
      accessRoute,
      contributorVerificationStatus,
      buyerEmail: normalizedEmail,
      buyerName: normalizedName,
      companyName: normalizedCompany,
      companyWebsite: normalizedWebsite,
      requestedHubId: requestedHubId?.trim() || null,
      requestedHubName: requestedHubName?.trim() || null,
      requestedCategory: normalizedCategory,
      advertisingObjective,
      preferredPlacement,
      investmentRange,
      launchTimeline,
      creativeStatus,
      additionalNotes: additionalNotes?.trim() || null,
      termsAccepted: true,
      marketingConsent: marketingConsent ?? false,
      lookupToken,
      metadata: {
        packageType,
        qualification_schema_version: 2,
        ...COMMERCIAL_POLICY_METADATA,
      },
    })
    .returning();

  if (!reservation) {
    res.status(500).json({ error: "Failed to create reservation." });
    return;
  }

  logger.info(
    {
      reservationId: reservation.id,
      packageKey,
      accessRoute,
      contributorVerificationStatus,
      status: "reserve_only",
    },
    "Sponsor request created",
  );

  res.status(202).json(
    CreateSponsorReservationResponse.parse({
      reservationId: reservation.id,
      status: "reserve_only",
      lookupToken,
    }),
  );
});

router.get("/launch/sponsor/status", async (req, res): Promise<void> => {
  const token =
    typeof req.query["token"] === "string" ? req.query["token"] : null;

  if (!token || token.length < 36) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  const [reservation] = await db
    .select()
    .from(sponsorReservationsTable)
    .where(eq(sponsorReservationsTable.lookupToken, token));

  if (!reservation) {
    res.status(404).json({ error: "Not found." });
    return;
  }

  res.json(
    GetSponsorReservationStatusResponse.parse({
      reservationId: reservation.id,
      status: "reserve_only",
      packageKey: reservation.packageKey,
      amountCents: Number(reservation.amountCents),
      currency: reservation.currency,
      createdAt: reservation.createdAt,
    }),
  );
});

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWebsite(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export default router;