import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 * Missing secret or a mismatched token fails closed.
 */
export function cronAuthorized(
  authorization: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) return false;
  const presented = authorization.slice(prefix.length);
  if (!presented) return false;
  const presentedBuf = Buffer.from(presented);
  const secretBuf = Buffer.from(secret);
  if (presentedBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(presentedBuf, secretBuf);
}
