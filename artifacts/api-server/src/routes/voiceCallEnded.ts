/**
 * POST /api/voice/call-ended — xAI voice agent post-call webhook.
 *
 * Auth: shared secret in header `X-Voice-Webhook-Secret` (also accepted as
 * `Authorization: Bearer <secret>`), compared in constant time against env
 * VOICE_WEBHOOK_SECRET. 503 when the env is unset, 401 when missing/wrong.
 * Idempotent on the call id. Responses never echo the secret or any contact value.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { ingestVoiceCall, normalizeVoicePayload } from "../lib/voiceCalls";
import { hasValidQaHeader } from "../lib/testTraffic";

export const VOICE_WEBHOOK_SECRET_ENV = "VOICE_WEBHOOK_SECRET" as const;
export const VOICE_WEBHOOK_HEADER = "x-voice-webhook-secret" as const;

const router: IRouter = Router();

function providedSecret(req: Request): string {
  const header = req.get(VOICE_WEBHOOK_HEADER)?.trim();
  if (header) return header;
  const auth = req.get("authorization") ?? "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

/** Constant-time compare (hash both sides so length differences don't leak). */
export function secretMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

router.post("/voice/call-ended", async (req, res): Promise<void> => {
  const expected = process.env[VOICE_WEBHOOK_SECRET_ENV]?.trim();
  if (!expected) {
    res.status(503).json({ error: "Voice webhook is not configured." });
    return;
  }
  if (!secretMatches(providedSecret(req), expected)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const parsed = normalizeVoicePayload(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    // X-Birch-QA (or a qa-/emma-qa call id, qa+ email, QA Test name) → stored as is_test, no email/Friday.
    const result = await ingestVoiceCall(parsed.call, req.body, { isTest: hasValidQaHeader(req) });
    req.log?.info({ duplicate: result.duplicate, emailed: result.emailed }, "Voice call-ended webhook");
    res.status(200).json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    // 500 so xAI retries; the delivery is idempotent on the call id.
    req.log?.error({ err: error instanceof Error ? error.message : "voice_ingest_failed" }, "Voice call-ended webhook failed");
    res.status(500).json({ error: "Could not record the call." });
  }
});

export default router;
