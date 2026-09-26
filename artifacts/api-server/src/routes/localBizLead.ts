/**
 * POST /api/launch/local-biz-lead — Local Biz Bot → Birch Neon shared lead write path.
 *
 * Contract (Randy HARD / Emma GREENLIGHT):
 *   Local Biz Bot NEVER receives DATABASE_URL. It POSTs here with a shared secret.
 *   Birch upserts Neon `leads` (source local_biz, id `localbiz:<externalId>`),
 *   queues Friday push with meta.friday_external_id = externalId (same id Local Biz
 *   already uses for fridayapp.org/api/intake org=birchreserve — Friday stays idempotent),
 *   and emails randy@ + jon@ via the existing Resend path (skipped for is_test).
 *
 * Auth: constant-time compare against env BIRCH_LOCAL_BIZ_SECRET.
 *   Header `X-Birch-Local-Biz-Secret` OR `Authorization: Bearer <secret>`.
 *   503 when unset, 401 when missing/wrong. Responses never echo the secret or PII.
 *
 * Body JSON (strict allowlist of known keys only):
 *   externalId (required), email and/or phone (at least one), plus optional
 *   firstName, lastName, name, company, role, website, message, need, size, timing,
 *   pagePath, category, hubs, isTest.
 */
import { Router, type IRouter, type Request } from "express";
import { constantTimeEquals, hasValidQaHeader, isTestIdentity } from "../lib/testTraffic";
import { captureLocalBizLead, sanitizeLocalBizExternalId } from "../lib/leadCapture";
import { notifyLocalBizLead } from "../lib/localBizLeadNotify";

export const LOCAL_BIZ_SECRET_ENV = "BIRCH_LOCAL_BIZ_SECRET" as const;
export const LOCAL_BIZ_SECRET_HEADER = "x-birch-local-biz-secret" as const;

const ALLOWED_KEYS = new Set([
  "externalId",
  "email",
  "firstName",
  "lastName",
  "name",
  "phone",
  "company",
  "role",
  "website",
  "message",
  "need",
  "size",
  "timing",
  "pagePath",
  "category",
  "hubs",
  "isTest",
]);

const router: IRouter = Router();

function providedSecret(req: Request): string {
  const header = req.get(LOCAL_BIZ_SECRET_HEADER)?.trim();
  if (header) return header;
  const auth = req.get("authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

export function localBizSecretMatches(given: string, expected: string): boolean {
  return constantTimeEquals(given, expected);
}

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

router.post("/launch/local-biz-lead", async (req, res): Promise<void> => {
  const expected = process.env[LOCAL_BIZ_SECRET_ENV]?.trim();
  if (!expected) {
    res.status(503).json({ error: "Local Biz lead path is not configured." });
    return;
  }
  if (!localBizSecretMatches(providedSecret(req), expected)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, unknown>) : null;
  if (!body) {
    res.status(400).json({ error: "Expected a JSON object." });
    return;
  }
  for (const k of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(k)) {
      res.status(400).json({ error: "Unknown field." });
      return;
    }
  }

  const externalId = sanitizeLocalBizExternalId(typeof body["externalId"] === "string" ? body["externalId"] : "");
  if (!externalId) {
    res.status(400).json({ error: "externalId is required." });
    return;
  }
  const email = str(body["email"], 320);
  const phone = str(body["phone"], 60);
  if (!email && !phone) {
    res.status(400).json({ error: "email or phone is required." });
    return;
  }

  const qa = hasValidQaHeader(req);
  const name = str(body["name"], 200);
  const firstName = str(body["firstName"], 80);
  const lastName = str(body["lastName"], 80);
  const company = str(body["company"], 200);
  const builtName = name || [firstName, lastName].filter(Boolean).join(" ") || undefined;
  const bodyIsTest = body["isTest"] === true;
  const isTest =
    qa ||
    bodyIsTest ||
    isTestIdentity({ email: email ?? null, name: builtName ?? company ?? null, label: externalId });

  try {
    const { lead, created } = await captureLocalBizLead({
      externalId,
      email,
      phone,
      name,
      firstName,
      lastName,
      company,
      role: str(body["role"], 200),
      website: str(body["website"], 300),
      message: str(body["message"], 1000),
      need: str(body["need"], 1000),
      size: str(body["size"], 300),
      timing: str(body["timing"], 300),
      pagePath: str(body["pagePath"], 500),
      category: str(body["category"], 200),
      hubs: str(body["hubs"], 200),
      isTest,
    });
    if (!lead) {
      res.status(500).json({ error: "Could not record the lead." });
      return;
    }
    if (created && !lead.isTest) {
      // Best-effort: never fail the request if mail fails.
      await notifyLocalBizLead(lead).catch((error) =>
        req.log?.warn({ err: error instanceof Error ? error.message : "local_biz_notify_failed" }, "Local Biz lead notify failed"),
      );
    }
    req.log?.info({ created, isTest: lead.isTest, leadId: lead.id }, "Local Biz lead accepted");
    res.status(200).json({ ok: true, leadId: lead.id, created });
  } catch (error) {
    req.log?.error({ err: error instanceof Error ? error.message : "local_biz_lead_failed" }, "Local Biz lead write failed");
    res.status(500).json({ error: "Could not record the lead." });
  }
});

export default router;
