/**
 * GET  /api/launch/human/config   → { enabled, siteKey }  (site key is public)
 * POST /api/launch/human/verify   { token } → { ok, required, humanToken?, expiresAt? }
 * POST /api/launch/email-capture  { email, company?, pagePath? } (+ fax honeypot, attribution)
 *
 * See lib/humanGate.ts for the Turnstile flow and lib/publicGuards.ts for the
 * bot-UA block / honeypot / attribution middleware that runs before these.
 */
import { Router, type IRouter } from "express";
import {
  issueHumanToken,
  siteverify,
  turnstileConfig,
} from "../lib/humanGate";
import { FRIENDLY_429, LIMITS, limiter } from "../lib/rateLimit";
import { attributionFrom } from "../lib/publicGuards";
import { hasValidQaHeader, isTestIdentity } from "../lib/testTraffic";
import { captureEmailLead } from "../lib/leadCapture";
import { notifyEmailCapture } from "../lib/emailCapture";

const router: IRouter = Router();

const verifyLimiter = limiter(LIMITS.humanVerifyPerIp);
const captureLimiter = limiter(LIMITS.formPerIp);

router.get("/launch/human/config", (_req, res): void => {
  const cfg = turnstileConfig();
  res.setHeader("Cache-Control", "no-store");
  res.json({ enabled: Boolean(cfg), siteKey: cfg?.siteKey ?? null });
});

router.post("/launch/human/verify", async (req, res): Promise<void> => {
  const cfg = turnstileConfig();
  if (!cfg) {
    res.json({ ok: true, required: false });
    return;
  }
  const hit = verifyLimiter.hit(req.ip || "unknown");
  if (hit.limited) {
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ error: FRIENDLY_429 });
    return;
  }
  const token = (req.body as Record<string, unknown> | undefined)?.["token"];
  if (typeof token !== "string" || !token || token.length > 2048) {
    res.status(400).json({ error: "Missing verification token." });
    return;
  }
  const result = await siteverify(token, cfg.secretKey, req.ip);
  if (!result.success) {
    req.log?.info({ codes: result.errorCodes.slice(0, 4), unavailable: Boolean(result.unavailable) }, "Turnstile verification failed");
    res
      .status(result.unavailable ? 503 : 403)
      .json({ error: result.unavailable ? "Verification is unavailable right now. Please try again shortly." : "We couldn't confirm you're human. Please try again." });
    return;
  }
  const { token: humanToken, expiresAt } = issueHumanToken(cfg.secretKey);
  res.json({ ok: true, required: true, humanToken, expiresAt });
});

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;
const PAGE_PATH_RE = /^\/[A-Za-z0-9._~/?=&%-]{0,199}$/;

router.post("/launch/email-capture", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "Invalid body." });
    return;
  }
  for (const k of Object.keys(body)) {
    if (!["email", "company", "pagePath"].includes(k)) {
      res.status(400).json({ error: "Unknown field." });
      return;
    }
  }
  const email = typeof body["email"] === "string" ? body["email"].trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 320) {
    res.status(400).json({ error: "Enter a valid email." });
    return;
  }
  const companyRaw = body["company"];
  if (companyRaw !== undefined && (typeof companyRaw !== "string" || companyRaw.length > 200)) {
    res.status(400).json({ error: "Company is too long." });
    return;
  }
  const company = typeof companyRaw === "string" && companyRaw.trim() ? companyRaw.trim() : null;
  const pagePath = typeof body["pagePath"] === "string" && PAGE_PATH_RE.test(body["pagePath"]) ? body["pagePath"] : null;

  const qa = hasValidQaHeader(req);
  if (!qa) {
    const hit = captureLimiter.hit(req.ip || "unknown");
    if (hit.limited) {
      res.setHeader("Retry-After", String(hit.retryAfterSec));
      res.status(429).json({ error: FRIENDLY_429 });
      return;
    }
  }
  const isTest = qa || isTestIdentity({ email, name: company });
  const { lead, created } = await captureEmailLead({ email, company, pagePath, isTest, attribution: attributionFrom(res) });
  if (lead && created && !lead.isTest) {
    // Bounded (mailer has a 10s timeout); awaited so Autoscale can't freeze before it sends.
    await notifyEmailCapture(lead).catch((error) =>
      req.log?.warn({ err: error instanceof Error ? error.message : "email_capture_notify_failed" }, "Email capture notify failed"),
    );
  }
  req.log?.info({ created, isTest: Boolean(lead?.isTest) }, "Email capture accepted");
  // Never echo the email back.
  res.status(202).json({ status: "received" });
});

export default router;
