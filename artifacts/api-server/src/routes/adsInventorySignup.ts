/**
 * POST /api/launch/ads-inventory-signup
 * Inventory host / publisher door → leads row ads:{id} + Friday birchreserve push.
 * Not a CRM. Does not touch hold-190 / reserve-490 checkout.
 */
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { captureInventorySignupLead } from "../lib/leadCapture";
import { attributionFrom } from "../lib/publicGuards";
import { hasValidQaHeader, isTestIdentity } from "../lib/testTraffic";
import { sendSalesAlert, alertSiteOf } from "../lib/salesAlert";

const InventoryType = z.enum(["site", "email", "sms", "waiting_room"]);

const Body = z.object({
  company: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  audienceEstimate: z.string().trim().min(1).max(200),
  inventoryTypes: z.array(InventoryType).min(1).max(4),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
  path: z.string().trim().max(200).optional(),
});

const router: IRouter = Router();

router.post("/launch/ads-inventory-signup", async (req, res): Promise<void> => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check required fields and try again." });
    return;
  }
  const data = parsed.data;
  const id = (
    data.idempotencyKey && /^[A-Za-z0-9_-]+$/.test(data.idempotencyKey)
      ? data.idempotencyKey
      : randomUUID()
  ).slice(0, 80);

  const lead = await captureInventorySignupLead({
    id,
    company: data.company,
    name: data.name,
    email: data.email,
    phone: data.phone,
    audienceEstimate: data.audienceEstimate,
    inventoryTypes: data.inventoryTypes,
    notes: data.notes,
    pagePath: data.path ?? "/sell-ads",
    isTest:
      hasValidQaHeader(req) ||
      isTestIdentity({ email: data.email, name: data.name }),
    attribution: attributionFrom(res),
  });

  if (!lead) {
    res.status(500).json({
      error: "We could not save that. Try again or email randy@scalehealth.ca.",
    });
    return;
  }

  req.log?.info(
    { leadId: lead.id, source: lead.source, pagePath: lead.pagePath },
    "Ads inventory signup accepted",
  );

  // Form audit Nov 26 2026: this door only stored the lead + queued Friday, so the team never got an email.
  // Same internal alert as every other form (randy@scalehealth.ca + randy@silverbirchgrowth.com). Awaited so the
  // serverless function cannot freeze before it sends; sendSalesAlert never throws.
  await sendSalesAlert({
      via: alertSiteOf(req),
    event: "inquiry",
    tag: "BIRCH SUPPLIER",
    title: `Inventory host signup: ${data.company}`,
    rows: [
      ["Form", "Sell ads / inventory host (/sell-ads)"],
      ["Company", data.company],
      ["Name", data.name],
      ["Email", data.email],
      ["Phone", data.phone],
      ["Audience", data.audienceEstimate],
      ["Inventory", data.inventoryTypes.join(", ")],
      ["Notes", data.notes],
      ["Page", data.path ?? "/sell-ads"],
      ["Lead id", lead.id],
    ],
    replyTo: data.email,
    isTest: lead.isTest === true,
  });

  res.status(201).json({ ok: true, leadId: lead.id });
});

export default router;
