/**
 * Intake funnel analytics (Randy via Emma, Nov 18 2026 10:44 PM ET). Aggregate counts only:
 * every event is `intake.<side>.<action>[.<detail>]` from fixed lists below, plus the page path
 * (report tokens are replaced with /kit/r/report). No email, website, brand, numbers or ids ever go in.
 * Stored by Birch's /v1/ui-events (site_cta_events: event, path); mirrored to Plausible/GA4 when configured.
 */
import { track } from "@/lib/analytics";

import { INTAKE_ACTION_SET as ACTION_SET, INTAKE_DETAIL_SET as DETAIL_SET, type IntakeAction, type IntakeDetail, type IntakeSide } from "../../../api-server/src/lib/intakeEvents";
export type { IntakeAction, IntakeDetail, IntakeSide };

const once = new Set<string>();

export function intakeEventName(side: IntakeSide, action: IntakeAction, detail?: IntakeDetail): string | null {
  if (side !== "advertiser" && side !== "publisher") return null;
  if (!ACTION_SET.has(action)) return null;
  if (detail !== undefined && !DETAIL_SET.has(detail)) return null;
  return `intake.${side}.${action}${detail ? `.${detail}` : ""}`;
}

export function safeIntakePath(path: string): string {
  const p = (path || "/").split(/[?#]/)[0]!.slice(0, 200);
  return /^\/kit\/r\//.test(p) ? "/kit/r/report" : p;
}

/** Fire-and-forget; never throws. `dedupe` fires at most once per page load (views, field starts). */
export function trackIntake(side: IntakeSide, action: IntakeAction, detail?: IntakeDetail, opts?: { dedupe?: boolean }): void {
  const event = intakeEventName(side, action, detail);
  if (!event || typeof window === "undefined") return;
  const path = safeIntakePath(window.location.pathname);
  if (opts?.dedupe) {
    const k = `${event}|${path}`;
    if (once.has(k)) return;
    once.add(k);
  }
  track("intake_step", { side, action, detail, path });
  try {
    const body = JSON.stringify({ event, path });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/v1/ui-events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/v1/ui-events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => undefined);
  } catch {
    /* analytics must never break the page */
  }
}

/** Map an adapter error code to a fixed detail key (never the message text). */
export function errorDetail(code: string): IntakeDetail {
  return code === "too_fast" ? "too_fast" : code === "email" ? "invalid_email" : code === "website" ? "invalid_website" : code === "rate_limited" ? "rate_limited" : "unreachable";
}

/** onFocus helper: first focus of a field = field_start. */
export const fieldStart = (side: IntakeSide, field: IntakeDetail) => () => trackIntake(side, "field_start", field, { dedupe: true });

/** Spread on a CTA link/button: counts the click. */
export const ctaTrack = (side: IntakeSide, key: IntakeDetail) => ({ "data-intake-cta": key, onClick: () => trackIntake(side, "cta_click", key) });
