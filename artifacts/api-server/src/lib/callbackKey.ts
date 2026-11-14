/**
 * Shared-key check for POST /v1/callback-request (Randy, Nov 13 2026 10:34 PM ET).
 * The ElevenLabs submit_callback tool sends header x-birch-callback-key; the value
 * must equal env BIRCH_CALLBACK_KEY. The site chat submits call-backs server-side
 * (randyChat.ts -> sendSalesAlert) and never calls this endpoint, so it needs no key.
 * Fails closed when the env var is missing.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const CALLBACK_KEY_HEADER = "x-birch-callback-key" as const;

function digest(v: string): Buffer {
  return createHash("sha256").update(v, "utf8").digest();
}

export function callbackKeyOk(provided: unknown, expected = process.env["BIRCH_CALLBACK_KEY"]?.trim()): boolean {
  if (!expected) return false;
  const got = Array.isArray(provided) ? provided[0] : provided;
  if (typeof got !== "string" || !got) return false;
  // Hash both sides so lengths match, then compare in constant time.
  return timingSafeEqual(digest(got.trim()), digest(expected));
}
