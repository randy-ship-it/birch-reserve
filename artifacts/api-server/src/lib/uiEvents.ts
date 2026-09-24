import {
  siteCtaEventsTable,
  db,
} from "@workspace/db";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { logger } from "./logger";

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

export type UiEventName = (typeof UI_EVENTS)[number];
export type UiEventOffer = "hold-190" | "reserve-490";

export type ParsedUiEvent = {
  event: UiEventName;
  path: string;
  offer: UiEventOffer | null;
};

const UI_EVENT_SET = new Set<string>(UI_EVENTS);
const OFFER_SET = new Set<string>(["hold-190", "reserve-490"]);
const ALLOWED_KEYS = new Set(["event", "path", "offer", "locale"]);
const PATH_PATTERN = /^\/[A-Za-z0-9._~/-]{0,199}$/;
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

const RATE_WINDOW_MS = 10_000;
const DEFAULT_RATE_MAX = 240;

let rateMax = DEFAULT_RATE_MAX;
let rateHits: number[] = [];

type UiEventRecorder = (event: ParsedUiEvent) => Promise<void>;

async function defaultRecordUiEvent(event: ParsedUiEvent): Promise<void> {
  await db.insert(siteCtaEventsTable).values({
    event: event.event,
    path: event.path,
    offer: event.offer,
  });
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
  if (typeof event !== "string" || !UI_EVENT_SET.has(event)) return null;
  if (typeof path !== "string" || path.length > 200 || !PATH_PATTERN.test(path)) return null;

  let offer: UiEventOffer | null = null;
  if ("offer" in record && record.offer !== null) {
    if (typeof record.offer !== "string" || !OFFER_SET.has(record.offer)) return null;
    offer = record.offer as UiEventOffer;
  }

  if ("locale" in record && record.locale != null) {
    if (typeof record.locale !== "string" || !LOCALE_PATTERN.test(record.locale)) return null;
  }

  return { event: event as UiEventName, path, offer };
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
    await recordUiEvent(parsed);
  } catch (error) {
    logger.warn({ err: error }, "UI event was not stored");
  }
  res.status(204).end();
}
