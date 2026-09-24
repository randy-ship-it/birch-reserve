/**
 * "Humans only" gate (Randy 6:50pm): Cloudflare Turnstile (managed / invisible
 * widget) before the chat opens a Grok session and before any voice start.
 *
 * Env-gated. Enforced only when BOTH are set:
 *   TURNSTILE_SITE_KEY    public site key (served to the widget by GET /api/launch/human/config)
 *   TURNSTILE_SECRET_KEY  server-side siteverify secret (never logged or returned)
 * Unset → the gate is skipped (everything else, rate limits / UA block / honeypots, still runs).
 *
 * Flow: widget token → POST /api/launch/human/verify → server siteverify →
 * short-lived signed session token (HMAC, 2h) the browser keeps in sessionStorage and
 * sends as header X-Birch-Human, so a real person verifies once per tab session.
 * A valid X-Birch-QA header also passes (QA automation).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { hasValidQaHeader } from "./testTraffic";

export const TURNSTILE_SITE_KEY_ENV = "TURNSTILE_SITE_KEY" as const;
export const TURNSTILE_SECRET_KEY_ENV = "TURNSTILE_SECRET_KEY" as const;
export const HUMAN_TOKEN_HEADER = "x-birch-human" as const;
export const HUMAN_TOKEN_TTL_MS = 2 * 60 * 60_000;
export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileConfig = { siteKey: string; secretKey: string };

export function turnstileConfig(env: NodeJS.ProcessEnv = process.env): TurnstileConfig | null {
  const siteKey = env[TURNSTILE_SITE_KEY_ENV]?.trim();
  const secretKey = env[TURNSTILE_SECRET_KEY_ENV]?.trim();
  return siteKey && secretKey ? { siteKey, secretKey } : null;
}

function signingKey(secret: string): Buffer {
  return createHmac("sha256", secret).update("birch-human-session-v1").digest();
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", signingKey(secret)).update(payload).digest("base64url");
}

export function issueHumanToken(secret: string, now: number = Date.now()): { token: string; expiresAt: number } {
  const expiresAt = now + HUMAN_TOKEN_TTL_MS;
  const payload = `h1.${Math.floor(expiresAt / 1000)}.${randomBytes(12).toString("base64url")}`;
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}

export function verifyHumanToken(token: string | undefined, secret: string, now: number = Date.now()): boolean {
  if (!token || token.length > 200) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "h1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return false;
  const expected = Buffer.from(sign(parts.slice(0, 3).join("."), secret));
  const given = Buffer.from(parts[3] ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type SiteverifyFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  json(): Promise<unknown>;
}>;

let fetchImpl: SiteverifyFetch = (url, init) => fetch(url, init);
export function setSiteverifyFetchForTests(f: SiteverifyFetch): void {
  fetchImpl = f;
}

export type SiteverifyResult = { success: boolean; errorCodes: string[]; unavailable?: boolean };

export async function siteverify(token: string, secret: string, remoteip?: string): Promise<SiteverifyResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const body = new URLSearchParams({ secret, response: token, ...(remoteip ? { remoteip } : {}) });
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
    if (!res.ok) return { success: false, errorCodes: ["siteverify_http"], unavailable: true };
    const data = (await res.json()) as { success?: unknown; "error-codes"?: unknown };
    const codes = Array.isArray(data["error-codes"]) ? data["error-codes"].filter((c): c is string => typeof c === "string") : [];
    return { success: data.success === true, errorCodes: codes };
  } catch {
    return { success: false, errorCodes: ["siteverify_unreachable"], unavailable: true };
  } finally {
    clearTimeout(timeout);
  }
}

export function requestHasHumanPass(req: Request, cfg: TurnstileConfig | null = turnstileConfig()): boolean {
  if (!cfg) return true;
  if (hasValidQaHeader(req)) return true;
  return verifyHumanToken(req.get(HUMAN_TOKEN_HEADER)?.trim(), cfg.secretKey);
}

/** 401 {humanRequired:true} unless Turnstile is off, the request carries a valid human token, or a valid X-Birch-QA. */
export function requireHuman(): RequestHandler {
  return (req, res, next) => {
    if (requestHasHumanPass(req)) return next();
    res.status(401).json({ error: "Please confirm you're human to continue.", humanRequired: true });
  };
}
