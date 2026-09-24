/**
 * Public POST guards (Randy 6:50pm "humans only"), mounted in app.ts ahead of the
 * routers:
 *   - obvious bot / headless user agents → 403 on chat, voice and form POSTs
 *     (NOT the Stripe webhook, NOT /api/voice/call-ended (secret-authed), NOT the
 *     machine-buying /v1 + /ucp surfaces, and NOT requests with a valid X-Birch-QA)
 *   - honeypot field `fax` on every public form: filled → silently "accepted" with a
 *     plausible receipt and dropped (nothing stored, emailed or pushed)
 *   - `attribution` (utm_*, referrer, landing_page) is lifted off the body into
 *     res.locals.attribution so the strict route parsers never see extra keys
 */
import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { hasValidQaHeader } from "./testTraffic";
import type { Attribution, AttributionField } from "./leads";
import { FRIENDLY_429, LIMITS, limiter } from "./rateLimit";
import { requestHasHumanPass } from "./humanGate";

export const HONEYPOT_FIELD = "fax" as const;
export const ATTRIBUTION_BODY_FIELD = "attribution" as const;

/** Obvious non-browser clients. Deliberately conservative: real browsers never match. */
const BOT_UA =
  /(headlesschrome|phantomjs|python-requests|python-urllib|aiohttp|httpx|\bcurl\/|\bwget\/?|scrapy|go-http-client|libwww-perl|java\/\d|okhttp|\bbot\b|crawler|spider)/i;

export function isBotUserAgent(ua: string | undefined | null): boolean {
  const v = (ua ?? "").trim();
  if (!v) return true;
  return BOT_UA.test(v);
}

type FakeReceipt = (req: Request, res: Response) => void;

const fakeReceipts: Record<string, FakeReceipt> = {
  "/api/launch/waitlist": (_req, res) => void res.status(202).json({ status: "received", requestId: randomUUID() }),
  "/api/launch/commercial-inquiries": (_req, res) => void res.status(202).json({ status: "received", requestId: randomUUID() }),
  "/api/launch/advertiser-intake": (_req, res) => void res.status(202).json({ intakeId: randomUUID(), status: "received" }),
  "/api/launch/splash/reserve": (req, res) => {
    const offer = (req.body as Record<string, unknown> | undefined)?.["offer"] === "hold-190" ? "hold-190" : "reserve-490";
    res.status(202).json({
      reservationId: randomUUID(),
      status: "held_pending_payments",
      checkoutUrl: null,
      amountCents: offer === "hold-190" ? 19000 : 49000,
      currency: "usd",
      offer,
    });
  },
  "/api/launch/sponsor/reserve": (_req, res) =>
    void res.status(202).json({ reservationId: randomUUID(), status: "reserve_only", lookupToken: randomUUID().replace(/-/g, "") }),
  "/api/launch/email-capture": (_req, res) => void res.status(202).json({ status: "received" }),
  "/api/launch/randy-chat/event": (_req, res) => void res.status(200).json({ ok: true }),
};

/** Public human-facing POSTs that get the bot-UA block. */
const GUARDED_POSTS = new Set([
  ...Object.keys(fakeReceipts),
  "/api/launch/randy-chat",
  "/api/launch/human/verify",
]);

export function isVoiceStartPath(path: string): boolean {
  const p = path.replace(/\/+$/, "");
  if (p === "/api/voice/call-ended") return false;
  return p.startsWith("/api/voice/") || p === "/api/launch/randy-voice" || p.startsWith("/api/launch/randy-voice/");
}

export function isGuardedPost(path: string): boolean {
  const p = path.replace(/\/+$/, "") || "/";
  return GUARDED_POSTS.has(p) || isVoiceStartPath(p);
}

const ATTR_KEYS: Record<string, AttributionField> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_term: "utmTerm",
  utm_content: "utmContent",
  referrer: "referrer",
  landing_page: "landingPage",
};

export function sanitizeAttribution(raw: unknown): Attribution {
  const out: Attribution = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const field = ATTR_KEYS[k];
    if (!field || typeof v !== "string") continue;
    // eslint-disable-next-line no-control-regex
    const clean = v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 500);
    if (clean) out[field] = clean;
  }
  return out;
}

export function attributionFrom(res: Response): Attribution {
  return (res.locals["attribution"] as Attribution | undefined) ?? {};
}

/** Bot-UA block + honeypot drop + attribution lift, for the guarded public POSTs. */
export function publicPostGuards(): RequestHandler {
  return (req, res, next) => {
    if (req.method !== "POST") return next();
    const path = (req.baseUrl || "") + req.path;
    if (!isGuardedPost(path)) return next();
    const qa = hasValidQaHeader(req);
    res.locals["birchQa"] = qa;
    if (!qa && isBotUserAgent(req.get("user-agent"))) {
      req.log?.info({ path, reason: "bot_user_agent" }, "Blocked automated request");
      res.status(403).json({ error: "Automated requests aren't allowed here. Please use a regular browser." });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const hp = body[HONEYPOT_FIELD];
      const attr = body[ATTRIBUTION_BODY_FIELD];
      delete body[HONEYPOT_FIELD];
      delete body[ATTRIBUTION_BODY_FIELD];
      res.locals["attribution"] = sanitizeAttribution(attr);
      const receipt = fakeReceipts[path.replace(/\/+$/, "")];
      if (receipt && hp !== undefined && hp !== null && String(hp).trim() !== "") {
        req.log?.info({ path, reason: "honeypot" }, "Dropped bot form submission");
        receipt(req, res);
        return;
      }
    }
    next();
  };
}

const voiceIpLimiter = limiter(LIMITS.voicePerIp);
const voiceSessionLimiter = limiter(LIMITS.voicePerSession);

/**
 * Guards for any browser voice / live-audio START endpoint (/api/voice/* except the
 * secret-authed call-ended webhook, and /api/launch/randy-voice*): Turnstile human
 * pass + per-IP and per-session rate limits. There is no such endpoint on
 * birchreserve.net today; this makes sure one can't ship ungated.
 */
export function voiceStartGuards(): RequestHandler {
  return (req, res, next) => {
    const path = (req.baseUrl || "") + req.path;
    if (req.method !== "POST" || !isVoiceStartPath(path)) return next();
    if (!requestHasHumanPass(req)) {
      res.status(401).json({ error: "Please confirm you're human to continue.", humanRequired: true });
      return;
    }
    if (!hasValidQaHeader(req)) {
      const ip = voiceIpLimiter.hit(req.ip || "unknown");
      const sid = (req.body as Record<string, unknown> | undefined)?.["sessionId"];
      const ses = typeof sid === "string" && sid ? voiceSessionLimiter.hit(sid) : { limited: false, retryAfterSec: 0 };
      if (ip.limited || ses.limited) {
        res.setHeader("Retry-After", String(Math.max(ip.retryAfterSec, ses.retryAfterSec)));
        res.status(429).json({ error: FRIENDLY_429 });
        return;
      }
    }
    next();
  };
}
