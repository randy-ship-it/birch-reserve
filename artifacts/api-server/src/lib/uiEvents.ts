import type { NextFunction, Request, Response } from "express";
import express from "express";
import { isIP } from "node:net";
import { logger } from "./logger";
import { isIntakeEvent } from "./intakeEvents";
import { isAttentionEvent } from "./attentionEvents";
import { isAiRefEvent } from "./aiReferral";
import { SITE_EVENT_KEYS, isSiteEvent, parseSiteExtras, uaInfo, visitorDayHash, type SiteExtras } from "./siteAnalytics";
import { siteAnalyticsStore } from "./siteAnalyticsStore";
import { isQaMarked } from "./testTraffic";
import { MIRROR_ORIGIN_HOSTS } from "../middlewares/mirrorHost";

export const UI_EVENTS = [
  "cta_hero_reserve",
  "cta_hold_190",
  "cta_reserve_490",
  "cta_book_call",
  "nav_insights",
  "buycalc_open",
  "cta_open_reserve",
  "cta_custom_onprem",
  "cta_confirmation_placement",
  "cta_auto_buy",
  "cta_private_distribution",
] as const;

/** Fixed CTA events, or an intake funnel event `intake.<side>.<action>[.<detail>]` from fixed lists (lib/intakeEvents.ts). */
export type UiEventName = (typeof UI_EVENTS)[number] | `intake.${string}` | `attn.${string}` | `ai_ref.${string}` | `a.${string}`;
export type UiEventOffer = "hold-190" | "reserve-490";

export type ParsedUiEvent = {
  event: UiEventName;
  path: string;
  offer: UiEventOffer | null;
  extras?: SiteExtras;
};

/** Request-derived dimensions (never the IP or UA themselves). */
export type UiEventContext = { skin: "birch" | "scale"; device: string; browser: string; os: string; vh: string | null; isTest: boolean };

const UI_EVENT_SET = new Set<string>(UI_EVENTS);
const OFFER_SET = new Set<string>(["hold-190", "reserve-490"]);
const ALLOWED_KEYS = new Set<string>(["event", "path", "offer", "locale", ...SITE_EVENT_KEYS]);
const PATH_PATTERN = /^\/[A-Za-z0-9._~/-]{0,199}$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

const RATE_WINDOW_MS = 10_000;
const DEFAULT_RATE_MAX = 600;

let rateMax = DEFAULT_RATE_MAX;
let rateHits: number[] = [];

type UiEventRecorder = (event: ParsedUiEvent, ctx?: UiEventContext) => Promise<void>;

async function defaultRecordUiEvent(event: ParsedUiEvent, ctx?: UiEventContext): Promise<void> {
  const x = event.extras;
  await (await siteAnalyticsStore()).insert({
    event: event.event, path: event.path, offer: event.offer,
    label: x?.label ?? null, area: x?.area ?? null, refHost: x?.refHost ?? null, utmSource: x?.utmSource ?? null, utmMedium: x?.utmMedium ?? null,
    utmCampaign: x?.utmCampaign ?? null, src: x?.src ?? null,
    skin: ctx?.skin ?? x?.skin ?? null, device: ctx?.device ?? null, browser: ctx?.browser ?? null, os: ctx?.os ?? null, vh: ctx?.vh ?? null,
    isTest: Boolean(ctx?.isTest || x?.clientTest),
  });
}

/** Same IP source as the Friday track forward (routes/brandIntakeProxy.ts clientIp), so both carry one visitor hash. */
function visitorIp(req: Pick<Request, "get" | "ip">): string | null {
  const first = (v: string | undefined) => v?.split(",")[0]?.trim();
  const ip = (first(req.get("x-vercel-forwarded-for")) || first(req.get("x-real-ip")) || first(req.get("x-forwarded-for")) || req.ip || "").replace(/^::ffff:/i, "");
  return isIP(ip) ? ip : null;
}

/** Skin from the page's Origin (the Scale mirror posts with scalehealth.ca), else the client's hint. */
export function uiEventContext(req: Pick<Request, "get" | "ip">, extras?: SiteExtras): UiEventContext {
  const ua = req.get("user-agent") ?? "";
  let host = "";
  try { host = new URL(req.get("origin") ?? req.get("referer") ?? "").hostname; } catch { /* none */ }
  const info = uaInfo(ua, extras?.width ?? null);
  return {
    skin: MIRROR_ORIGIN_HOSTS.has(host) ? "scale" : extras?.skin ?? "birch",
    device: info.device, browser: info.browser, os: info.os,
    vh: ua ? visitorDayHash(visitorIp(req) ?? "", ua) : null,
    isTest: info.bot || isQaMarked(req),
  };
}

let recordUiEvent: UiEventRecorder = defaultRecordUiEvent;

export function resetUiEventRateLimitForTests(max = DEFAULT_RATE_MAX): void {
  rateMax = max;
  rateHits = [];
}

export function setUiEventRecorderForTests(recorder: UiEventRecorder | null): void {
  recordUiEvent = recorder ?? defaultRecordUiEvent;
}

export function uiEventBurstLimited(now = Date.now()): boolean {
  rateHits = rateHits.filter((hit) => now - hit < RATE_WINDOW_MS);
  if (rateHits.length >= rateMax) return true;
  rateHits.push(now);
  return false;
}

export function parseUiEvent(body: unknown): ParsedUiEvent | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) return null;

  const event = record.event;
  const path = record.path;
  if (typeof event !== "string" || !(UI_EVENT_SET.has(event) || isIntakeEvent(event) || isAttentionEvent(event) || isAiRefEvent(event) || isSiteEvent(event))) return null;
  if (typeof path !== "string" || path.length > 200 || !PATH_PATTERN.test(path)) return null;

  let offer: UiEventOffer | null = null;
  if ("offer" in record && record.offer !== null) {
    if (typeof record.offer !== "string" || !OFFER_SET.has(record.offer)) return null;
    offer = record.offer as UiEventOffer;
  }

  if ("locale" in record && record.locale != null) {
    if (typeof record.locale !== "string" || !LOCALE_PATTERN.test(record.locale)) return null;
  }

  // Private report links carry a token in the path: never store it.
  const safePath = /^\/kit\/r\//.test(path) ? "/kit/r/report" : path;
  return { event: event as UiEventName, path: safePath, offer, ...(isSiteEvent(event) ? { extras: parseSiteExtras(record) } : {}) };
}

export function uiEventsJsonParser() {
  const parser = express.json({ limit: "1kb", strict: true });
  return (req: Request, res: Response, next: NextFunction): void => {
    parser(req, res, (error?: unknown) => {
      if (!error) {
        next();
        return;
      }
      const status = typeof error === "object" && error && "status" in error
        ? Number((error as { status?: number }).status)
        : 400;
      res.status(status === 413 ? 413 : 400).end();
    });
  };
}

export async function handleUiEvent(req: Request, res: Response): Promise<void> {
  if (uiEventBurstLimited()) {
    res.status(429).end();
    return;
  }

  const parsed = parseUiEvent(req.body);
  if (!parsed) {
    res.status(400).json({ error: "Unsupported event." });
    return;
  }

  try {
    if (req.get("dnt") === "1" || req.get("sec-gpc") === "1") { res.status(204).end(); return; } // Do Not Track / GPC: store nothing
    await recordUiEvent(parsed, uiEventContext(req, parsed.extras));
  } catch (error) {
    logger.warn({ err: error }, "UI event was not stored");
  }
  res.status(204).end();
}
