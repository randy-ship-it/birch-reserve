/**
 * Signed tokens for the ad system (HMAC-SHA256 over SESSION_SECRET, separate "ads:" key space).
 *   s   served-ad token (campaign, creative, slot, serve time, daily visitor hash). Views and clicks must carry one.
 *   a   customer dashboard session (email), 14 days
 *   l   customer sign-in link (email), 24 hours
 *   adm admin session (email), 12 hours
 * Pixel ids and postback keys are derived per account email, so nothing extra is stored.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

let ephemeral: string | null = null;
function secret(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.SESSION_SECRET?.trim();
  if (s) return `ads:${s}`;
  ephemeral ??= randomBytes(32).toString("hex"); // local / tests only; prod and preview have SESSION_SECRET
  return ephemeral;
}

const mac = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function sign(kind: string, payload: Record<string, unknown>, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ k: kind, x: now + ttlMs, ...payload })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verify<T extends Record<string, unknown>>(kind: string, token: unknown, now = Date.now()): (T & { x: number }) | null {
  if (typeof token !== "string" || token.length > 3000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (p.k !== kind || typeof p.x !== "number" || p.x < now) return null;
    return p as T & { x: number };
  } catch {
    return null;
  }
}

/** Daily-rotating visitor hash for frequency caps. The raw id never leaves this function and is never stored. */
export function visitorHash(rawId: string, now = Date.now()): string | null {
  const v = rawId.trim();
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(v)) return null;
  const day = new Date(now).toISOString().slice(0, 10);
  return mac(`vid:${day}:${v}`).slice(0, 22);
}

export const pixelId = (email: string) => `px_${mac(`pxa:${email.trim().toLowerCase()}`).replace(/[-_]/g, "").slice(0, 18)}`;
export const postbackKey = (email: string) => `pb_${mac(`pba:${email.trim().toLowerCase()}`).replace(/[-_]/g, "").slice(0, 32)}`;
export const hashRef = (v: string) => mac(`ref:${v}`).slice(0, 32);
export const randomId = (bytes = 12) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
