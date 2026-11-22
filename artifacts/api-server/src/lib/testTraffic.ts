/**
 * Test-traffic hygiene (Randy 6:50pm): QA / probe traffic is still STORED, but is
 * flagged is_test=true so it never emails randy@/jon@ and never pushes to Friday.
 * Real visitors behave exactly as before.
 *
 * A request / row is test traffic when ANY of these hold:
 *   - header `X-Birch-QA` equals env BIRCH_QA_SECRET (falls back to
 *     VOICE_WEBHOOK_SECRET when unset), compared in constant time
 *   - email matches qa+*@...
 *   - name contains "QA Test" or "Pulse Probe"
 *   - voice call_id starts with qa- (incl. qa-replitbot) or emma-qa
 *   - chat session id / label starts with emma-qa
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

export const BIRCH_QA_HEADER = "x-birch-qa" as const;
export const BIRCH_QA_SECRET_ENV = "BIRCH_QA_SECRET" as const;

/** Constant-time compare (hash both sides so length differences don't leak). */
export function constantTimeEquals(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function birchQaSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[BIRCH_QA_SECRET_ENV]?.trim() || env["VOICE_WEBHOOK_SECRET"]?.trim() || undefined;
}

/** True only when the X-Birch-QA header carries the configured secret. */
export function hasValidQaHeader(req: Pick<Request, "get">): boolean {
  const expected = birchQaSecret();
  if (!expected) return false;
  const given = req.get(BIRCH_QA_HEADER)?.trim() ?? "";
  return constantTimeEquals(given, expected);
}

/**
 * Automated QA browsers (the live referral e2e) add this token to their user agent so the visits / scans they cause are
 * stored is_test and never count in street-team stats or pulse. It only marks the sender's own traffic as test.
 */
export const BIRCH_QA_UA_TOKEN = "BirchQA/1" as const;
export function hasQaUaToken(req: Pick<Request, "get">): boolean {
  return /\bBirchQA\/\d/.test(req.get("user-agent") ?? "");
}

/**
 * QA-marked chat traffic (Randy, Nov 21 2026 7:03 PM ET: eval runs must never touch the pulse, transcripts or leads):
 * the secret X-Birch-QA header or the BirchQA/1 user-agent token. The token only marks the sender's own traffic as test,
 * so honouring it can only suppress writes, never create them.
 */
export function isQaMarked(req: Pick<Request, "get">): boolean {
  return hasValidQaHeader(req) || hasQaUaToken(req);
}

export type TestIdentity = {
  email?: string | null;
  name?: string | null;
  callId?: string | null;
  sessionId?: string | null;
  label?: string | null;
};

const QA_EMAIL = /^qa\+[^@\s]*@/i;
const QA_NAME = /(qa test|pulse probe)/i;
const QA_CALL_ID = /^(qa-|emma-qa)/i;
const QA_SESSION = /^emma-qa/i;

export function isTestIdentity(v: TestIdentity): boolean {
  if (v.email && QA_EMAIL.test(v.email.trim())) return true;
  if (v.name && QA_NAME.test(v.name)) return true;
  if (v.callId && QA_CALL_ID.test(v.callId.trim())) return true;
  if (v.sessionId && QA_SESSION.test(v.sessionId.trim())) return true;
  if (v.label && QA_SESSION.test(v.label.trim())) return true;
  return false;
}

/**
 * /v1/leads test submissions (Nov 21 2026): TEST in the brand / name, a qa+ email, the QA name markers, or an explicit
 * test flag. They still email the [TEST] alert, but are never pushed to the CRM (Friday).
 */
export function isTestLead(v: { email?: string | null; name?: string | null; company?: string | null; test?: unknown }): boolean {
  if (v.test === true) return true;
  if (/\bTEST\b/.test(`${v.company ?? ""} ${v.name ?? ""}`)) return true;
  return isTestIdentity({ email: v.email, name: `${v.name ?? ""} ${v.company ?? ""}` });
}
