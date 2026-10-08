/**
 * POST /api/inventory/notify
 *
 * Mail relay for birchreserve.net/inventory (the Scale Health demand-pool page,
 * served from the separate birch-inventory Vercel project). Its forms (insider
 * code request, Reserve List) send their internal notification through the
 * site's existing Resend sender here, so the key lives in one place.
 *
 * Auth: header X-Inventory-Key must equal env INVENTORY_NOTIFY_KEY (constant-time).
 * Unset key → 503. Recipients are limited to the internal team addresses below,
 * so the relay can never mail anyone else. Rate limit: 30 per hour (global).
 */
import { Router, type IRouter } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resendKeyConfigured, resendSend } from "../lib/siteMail";
import { transcriptFrom } from "../lib/randyChatTranscripts";
import { limiter } from "../lib/rateLimit";

export const INVENTORY_NOTIFY_RECIPIENTS = new Set([
  "sales@silverbirchgrowth.com",
  "randy@silverbirchgrowth.com",
  "jon@silverbirchgrowth.com",
]);

const Internal = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => INVENTORY_NOTIFY_RECIPIENTS.has(v), "recipient not allowed");

const Body = z.object({
  to: z.array(Internal).min(1).max(3),
  cc: z.array(Internal).max(3).optional(),
  subject: z.string().trim().min(1).max(200),
  text: z.string().min(1).max(10_000),
  html: z.string().max(30_000).optional(),
  replyTo: z.string().trim().email().max(320).optional(),
});

const relayLimiter = limiter({ max: 30, windowMs: 60 * 60_000 });

function keyMatches(given: string | undefined): boolean {
  const want = process.env["INVENTORY_NOTIFY_KEY"]?.trim();
  if (!want || want.length < 24 || !given) return false;
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

const router: IRouter = Router();

router.post("/inventory/notify", async (req, res): Promise<void> => {
  if (!process.env["INVENTORY_NOTIFY_KEY"]?.trim()) {
    res.status(503).json({ ok: false, error: "Relay is not configured." });
    return;
  }
  if (!keyMatches(req.get("x-inventory-key"))) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  const hit = relayLimiter.hit("global");
  if (hit.limited) {
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ ok: false, error: "Relay limit reached." });
    return;
  }
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Bad relay payload." });
    return;
  }
  if (!resendKeyConfigured()) {
    res.status(503).json({ ok: false, error: "Mailer is not configured on this deploy." });
    return;
  }
  const m = parsed.data;
  try {
    const { id } = await resendSend({
      from: transcriptFrom(),
      to: m.to,
      ...(m.cc?.length ? { cc: m.cc } : {}),
      subject: m.subject,
      text: m.text,
      ...(m.html ? { html: m.html } : {}),
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
    });
    req.log?.info({ kind: "inventory_notify", id }, "Inventory notification sent");
    res.status(200).json({ ok: true, id });
  } catch (error) {
    req.log?.warn({ err: error instanceof Error ? error.message : "send_failed" }, "Inventory notification failed");
    res.status(502).json({ ok: false, error: "Send failed." });
  }
});

export default router;
