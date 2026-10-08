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
 *
 * POST /api/inventory/confirm — requester confirmation for scalehealth.ca
 * "Request access to see brand names" (birch-inventory /inventory/api/tam-access).
 * Same key. The caller only supplies the recipient, a first name and a ref; the
 * subject and body are a fixed server-side template ("we'll review and send your
 * access code"), so this can't be used to send arbitrary mail, and it never
 * contains the access code. One per address per 24h; 60 per hour (global).
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

export function buildTamAccessConfirmation(name: string, ref: string, test = false) {
  const first = (name || "").replace(/[^\p{L}\p{M}' -]/gu, "").trim().split(/\s+/)[0]?.slice(0, 40) || "there";
  const safeRef = /^tam-acc-[0-9a-f]{12}$/.test(ref) ? ref : "";
  const subject = `${test ? "[TEST] " : ""}We received your Scale Health TAM access request`;
  const text = [
    `Hi ${first},`,
    "",
    "Thanks for requesting access to the brand names behind the Scale Health TAM. We'll review your request and send your access code shortly.",
    "",
    "In the meantime, the TAM by category is at https://www.scalehealth.ca/tam.",
    "",
    "Scale Health · Canada",
    safeRef ? `Ref: ${safeRef}` : "",
  ].filter((l, i, a) => !(l === "" && i === a.length - 1)).join("\n");
  const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0b1220"><p>Hi ${esc(first)},</p><p>Thanks for requesting access to the brand names behind the Scale Health TAM. We'll review your request and send your access code shortly.</p><p>In the meantime, the TAM by category is at <a href="https://www.scalehealth.ca/tam">scalehealth.ca/tam</a>.</p><p style="color:#6b7280;font-size:13px">Scale Health · Canada${safeRef ? ` · Ref ${esc(safeRef)}` : ""}</p></div>`;
  return { subject, text, html };
}

const ConfirmBody = z.object({
  to: z.string().trim().toLowerCase().email().max(320),
  name: z.string().max(120).optional().default(""),
  kind: z.literal("tam-access"),
  ref: z.string().max(40).optional().default(""),
  test: z.boolean().optional().default(false),
});
const confirmLimiter = limiter({ max: 60, windowMs: 60 * 60_000 });
const confirmedRecently = new Map<string, number>();

const router: IRouter = Router();

router.post("/inventory/confirm", async (req, res): Promise<void> => {
  if (!process.env["INVENTORY_NOTIFY_KEY"]?.trim()) {
    res.status(503).json({ ok: false, error: "Relay is not configured." });
    return;
  }
  if (!keyMatches(req.get("x-inventory-key"))) {
    res.status(401).json({ ok: false, error: "Unauthorized." });
    return;
  }
  const parsed = ConfirmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: "Bad confirm payload." });
    return;
  }
  const m = parsed.data;
  const now = Date.now();
  const last = confirmedRecently.get(m.to) || 0;
  if (now - last < 24 * 60 * 60_000) {
    res.status(200).json({ ok: true, skipped: "already-confirmed-24h" });
    return;
  }
  if (/@(example\.(com|org|net)|test\.invalid)$/.test(m.to)) {
    res.status(200).json({ ok: true, skipped: "reserved-test-domain" });
    return;
  }
  const hit = confirmLimiter.hit("global");
  if (hit.limited) {
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ ok: false, error: "Confirm limit reached." });
    return;
  }
  if (!resendKeyConfigured()) {
    res.status(503).json({ ok: false, error: "Mailer is not configured on this deploy." });
    return;
  }
  const mail = buildTamAccessConfirmation(m.name, m.ref, m.test);
  try {
    const { id } = await resendSend({ from: transcriptFrom(), to: [m.to], subject: mail.subject, text: mail.text, html: mail.html, replyTo: "sales@silverbirchgrowth.com" });
    confirmedRecently.set(m.to, now);
    req.log?.info({ kind: "inventory_confirm", id }, "TAM access confirmation sent");
    res.status(200).json({ ok: true, id });
  } catch (error) {
    req.log?.warn({ err: error instanceof Error ? error.message : "send_failed" }, "TAM access confirmation failed");
    res.status(502).json({ ok: false, error: "Send failed." });
  }
});

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
