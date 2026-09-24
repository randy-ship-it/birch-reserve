/**
 * POST /api/ops/mail-test  (Randy 7:27pm): prove the site mailer reaches sales@.
 *
 * Requires header X-Birch-QA == BIRCH_QA_SECRET (falls back to VOICE_WEBHOOK_SECRET;
 * constant-time compare in hasValidQaHeader). Sends exactly ONE fixed email to the
 * hard-coded sales@silverbirchgrowth.com (nothing is taken from the request), with
 * Reply-To sales@. Returns { accepted, id, sentAt } from the provider (Resend).
 * Rate limit: 3 per hour (global).
 */
import { Router, type IRouter } from "express";
import { hasValidQaHeader } from "../lib/testTraffic";
import { limiter } from "../lib/rateLimit";
import { DEFAULT_BIRCH_REPLY_TO, birchReplyTo, resendKeyConfigured, resendSend } from "../lib/siteMail";
import { transcriptFrom } from "../lib/randyChatTranscripts";
import { logger } from "../lib/logger";

export const MAIL_TEST_TO = "sales@silverbirchgrowth.com" as const;
export const MAIL_TEST_SUBJECT = "Birch site test — sales@ routing";
const mailTestLimiter = limiter({ max: 3, windowMs: 60 * 60_000 });

const router: IRouter = Router();

router.post("/ops/mail-test", async (req, res): Promise<void> => {
  if (!hasValidQaHeader(req)) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const hit = mailTestLimiter.hit("global");
  if (hit.limited) {
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ accepted: false, error: "Mail test limit reached (3 per hour). Try again later." });
    return;
  }
  if (!resendKeyConfigured()) {
    res.status(503).json({ accepted: false, error: "Mailer is not configured on this deploy." });
    return;
  }
  const sentAt = new Date().toISOString();
  try {
    const { id } = await resendSend({
      from: transcriptFrom(),
      to: [MAIL_TEST_TO],
      subject: MAIL_TEST_SUBJECT,
      text: [
        "This is a test from birchreserve.net to confirm site email reaches sales@silverbirchgrowth.com.",
        `Reply-To is set to ${birchReplyTo() || DEFAULT_BIRCH_REPLY_TO}.`,
        `Sent ${sentAt}. No action needed.`,
      ].join("\n\n"),
      replyTo: birchReplyTo(),
    });
    logger.info({ id, sentAt }, "Ops mail test sent to sales@");
    res.status(200).json({ accepted: true, id, sentAt });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "send_failed";
    logger.warn({ err: msg }, "Ops mail test failed");
    res.status(502).json({ accepted: false, id: null, sentAt, error: msg.slice(0, 200) });
  }
});

export default router;
