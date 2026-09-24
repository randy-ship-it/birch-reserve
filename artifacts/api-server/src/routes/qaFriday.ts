/**
 * POST /api/launch/qa/friday-test-lead  (Emma 7:21pm: live Friday check with meta tags)
 *
 * Secret-authed: requires header X-Birch-QA = BIRCH_QA_SECRET (falls back to
 * VOICE_WEBHOOK_SECRET); anything else gets a plain 404. Creates ONE obviously named
 * QA lead (is_test = true, name "QA Test Friday check ...", qa+ email, tag birch:qa-test)
 * that is explicitly allowed through to Friday (meta.friday_qa_ok), pushes it now and
 * returns the Friday outcome plus the exact payload sent (no secrets in it).
 *
 * Optional JSON body (all fields optional, strings trimmed/clipped):
 *   { source: "chat"|"voice"|"form"|"email_capture"|"checkout", sku: "hold-190"|"reserve-490",
 *     category, hubs, utm_source, utm_campaign, label }
 * Never emails randy@ / jon@ (is_test), never touches seats or Stripe.
 */
import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { hasValidQaHeader } from "../lib/testTraffic";
import { logger } from "../lib/logger";
import { upsertLeadSafeDetailed, type LeadSource } from "../lib/leads";
import { DEFAULT_FRIDAY_STAGE, DEFAULT_FRIDAY_WORKSPACE, SKU_VALUE, buildFridayPayload, fridayConfig, pushLeadToFriday } from "../lib/fridayPush";
import { LIMITS, limiter, FRIENDLY_429 } from "../lib/rateLimit";

const router: IRouter = Router();
const qaLimiter = limiter({ ...LIMITS.formPerIp, max: 10 });

const SOURCE_MAP: Record<string, LeadSource> = {
  chat: "chat_intake",
  voice: "voice",
  form: "advertiser_intake",
  email_capture: "email_capture",
  checkout: "checkout",
};

function str(v: unknown, max = 120): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

router.post("/launch/qa/friday-test-lead", async (req, res): Promise<void> => {
  if (!hasValidQaHeader(req)) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const hit = qaLimiter.hit(req.ip || "unknown");
  if (hit.limited) {
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ error: FRIENDLY_429, rateLimited: true });
    return;
  }
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const sourceKey = str(body["source"], 20) ?? "form";
  const source = SOURCE_MAP[sourceKey] ?? "advertiser_intake";
  const skuIn = str(body["sku"], 20) ?? "hold-190";
  const sku = SKU_VALUE[skuIn] !== undefined ? skuIn : "hold-190";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13); // 20260924T1930
  const nonce = randomBytes(3).toString("hex");
  const label = str(body["label"], 60);
  const leadId = `qa-friday:${stamp}-${nonce}`;

  const result = await upsertLeadSafeDetailed({
    id: leadId,
    source,
    sourceRef: leadId,
    name: `QA Test Friday check ${stamp}${label ? ` ${label}` : ""}`,
    email: `qa+friday-${stamp.toLowerCase()}-${nonce}@birchreserve.net`,
    company: "QA Test (safe to delete)",
    need: "QA Friday meta check",
    size: "QA",
    timing: "QA",
    pagePath: "/qa/friday-test-lead",
    isTest: true,
    utmSource: str(body["utm_source"]) ?? "qa",
    utmCampaign: str(body["utm_campaign"]) ?? "friday-meta-check",
    meta: {
      category: str(body["category"]) ?? "QA category",
      hubs: str(body["hubs"]) ?? "QA hubs",
      sku,
      value: SKU_VALUE[sku],
      friday_qa_ok: true,
      ...(source === "checkout" ? { paid: true, stripe_session_id: `cs_qa_${nonce}` } : {}),
    },
  });
  if (!result) {
    res.status(503).json({ error: "Could not store the QA lead (database unavailable)." });
    return;
  }
  const cfg = fridayConfig();
  const friday = await pushLeadToFriday(leadId);
  const payload = buildFridayPayload(result.lead, {
    workspace: cfg?.workspace ?? DEFAULT_FRIDAY_WORKSPACE,
    stage: cfg?.stage ?? DEFAULT_FRIDAY_STAGE,
  });
  logger.info({ leadId, friday: friday?.status }, "QA Friday test lead");
  res.status(201).json({
    leadId,
    fridayConfigured: Boolean(cfg),
    workspace: cfg?.workspace ?? DEFAULT_FRIDAY_WORKSPACE,
    friday: friday ?? { status: "unknown" },
    payload,
  });
});

export default router;
