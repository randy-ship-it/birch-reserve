/**
 * POST /api/ops/mail-test  (Randy 7:27pm): prove the site mailer reaches sales@.
 *
 * Requires header X-Birch-QA == BIRCH_QA_SECRET (falls back to VOICE_WEBHOOK_SECRET;
 * constant-time compare in hasValidQaHeader). Sends exactly ONE fixed email to the
 * hard-coded randy@scalehealth.ca (nothing is taken from the request), with
 * Reply-To randy@. Returns { accepted, id, sentAt } from the provider (Resend).
 * Rate limit: 3 per hour (global).
 */
import { Router, type IRouter } from "express";
import { hasValidQaHeader, intakeSyntheticSecret, isSyntheticIntake } from "../lib/testTraffic";
import { emailH1, emailLayout, emailP, emailTestBanner } from "../lib/emailLayout";
import { limiter } from "../lib/rateLimit";
import { DEFAULT_BIRCH_REPLY_TO, birchReplyTo, resendKeyConfigured, resendSend } from "../lib/siteMail";
import { transcriptFrom } from "../lib/randyChatTranscripts";
import { logger } from "../lib/logger";

export const MAIL_TEST_TO = "randy@scalehealth.ca" as const;
export const MAIL_TEST_SUBJECT = "Birch site test — randy@ routing";
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
        "This is a test from birchreserve.net to confirm site email reaches randy@scalehealth.ca.",
        `Reply-To is set to ${birchReplyTo() || DEFAULT_BIRCH_REPLY_TO}.`,
        `Sent ${sentAt}. No action needed.`,
      ].join("\n\n"),
      replyTo: birchReplyTo(),
    });
    logger.info({ id, sentAt }, "Ops mail test sent to randy@");
    res.status(200).json({ accepted: true, id, sentAt });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "send_failed";
    logger.warn({ err: msg }, "Ops mail test failed");
    res.status(502).json({ accepted: false, id: null, sentAt, error: msg.slice(0, 200) });
  }
});

/**
 * POST /api/ops/mail-canary
 *
 * Intake health-check canary (Nov 26 2026 form audit): proves the Resend path that
 * X-Intake-Synthetic otherwise skips. Protected by X-Intake-Synthetic == INTAKE_SYNTHETIC_SECRET.
 * Sends exactly one clearly labelled test email to a single plus-address
 * (randy+intake-canary@scalehealth.ca), never the sales inbox pair. Override with MAIL_CANARY_TO.
 * Rate limit: 8 per hour (global) — enough for the weekday 4-hour check plus a manual retry.
 */
export const MAIL_CANARY_TO_DEFAULT = "randy+intake-canary@scalehealth.ca" as const;
export const MAIL_CANARY_SUBJECT = "[INTAKE CANARY] Site mailer ok — health check";
const mailCanaryLimiter = limiter({ max: 8, windowMs: 60 * 60_000 });

export function mailCanaryTo(env: NodeJS.ProcessEnv = process.env): string {
  const v = env["MAIL_CANARY_TO"]?.trim();
  return v && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v : MAIL_CANARY_TO_DEFAULT;
}

router.post("/ops/mail-canary", async (req, res): Promise<void> => {
  if (!intakeSyntheticSecret()) {
    res.status(503).json({ ok: false, error: "Canary is not configured on this deploy." });
    return;
  }
  if (!isSyntheticIntake(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  const hit = mailCanaryLimiter.hit("global");
  if (hit.limited) {
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ ok: false, error: "Mail canary limit reached (8 per hour). Try again later." });
    return;
  }
  if (!resendKeyConfigured()) {
    res.status(503).json({ ok: false, error: "Mailer is not configured on this deploy." });
    return;
  }
  const to = mailCanaryTo();
  const sentAt = new Date().toISOString();
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0]!.trim() || "unknown";
  const text = [
    "INTAKE CANARY — automated health check. Safe to filter or ignore.",
    "This confirms the Birch/Scale site mailer can send. It is not a buyer lead.",
    `Host: ${host}`,
    `Sent ${sentAt}. No action needed.`,
  ].join("\n\n");
  const html = emailLayout({
    title: MAIL_CANARY_SUBJECT,
    preheader: "Automated intake mailer health check. Safe to ignore.",
    eyebrow: "Intake canary",
    body: [
      emailTestBanner("<strong>INTAKE CANARY.</strong> Automated health check. Safe to filter or ignore."),
      emailH1("Site mailer ok"),
      emailP("This confirms the Birch/Scale site mailer can send. It is not a buyer lead."),
      emailP(`Host: ${host.replace(/&/g, "&amp;").replace(/</g, "&lt;")}<br>Sent ${sentAt}. No action needed.`, { muted: true, small: true }),
    ].join(""),
  });
  try {
    const { id } = await resendSend({
      from: transcriptFrom(),
      to: [to],
      subject: MAIL_CANARY_SUBJECT,
      text,
      html,
      replyTo: birchReplyTo(),
    });
    logger.info({ id, sentAt }, "Intake mail canary sent");
    res.status(200).json({ ok: true, id, sentAt, to });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "send_failed";
    logger.warn({ err: msg }, "Intake mail canary failed");
    res.status(502).json({ ok: false, id: null, sentAt, error: msg.slice(0, 200) });
  }
});

export default router;
