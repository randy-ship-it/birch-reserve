/**
 * Intake funnel event names, shared by the client (lib/intakeTrack.ts) and /v1/ui-events.
 * `intake.<side>.<action>[.<detail>]` from fixed lists only: aggregate counts, no personal data.
 */
export type IntakeSide = "advertiser" | "publisher";
export const INTAKE_ACTIONS = ["view", "field_start", "step_complete", "submit", "submit_error", "kit_download", "cta_click", "mode"] as const;
export type IntakeAction = (typeof INTAKE_ACTIONS)[number];
/** Fixed detail keys (field names, step names, CTA keys, formats, error codes, page states). Never user values. */
export const INTAKE_DETAILS = [
  // pages / report states
  "intake", "brand_kit", "media_kit", "publisher", "supplier", "sponsor", "report_ready", "report_draft", "report_missing", "report_error", "report_held",
  // fields
  "side", "role", "website", "email", "brand", "category", "aov", "orders", "repeat", "margin", "spend", "conversion", "inputs", "market", "regions",
  // steps
  "roles", "calculator", "contact", "done",
  // CTAs
  "look_190", "reserve_490", "kit", "sample_io", "report", "publisher_payout", "send_for_review", "supplier_first_look", "sponsor_lock",
  // fast / expanded modes (Randy 11:36 PM)
  "fast", "expanded", "quick_report", "add_detail", "update",
  // simplified intake (Randy voice, Nov 19 2026 8:30 AM ET): supply-only choice, "Add a hub too", hub details
  "supply_only", "add_hub", "hub_details", "accelerate", "partial_saved", "locations", "kit_email", "resume",
  // two-lane conversion layer (Randy t227u, Nov 19 2026): card reserve + big block / agency IO
  "lane_card", "lane_block", "agency_test", "big_block", "io_pdf",
  // formats / errors
  "pdf", "png", "too_fast", "invalid_email", "invalid_website", "rate_limited", "unreachable",
] as const;
export type IntakeDetail = (typeof INTAKE_DETAILS)[number];

export const INTAKE_DETAIL_SET = new Set<string>(INTAKE_DETAILS);
export const INTAKE_ACTION_SET = new Set<string>(INTAKE_ACTIONS);
export const INTAKE_EVENT_RE = /^intake\.(advertiser|publisher)\.([a-z_]+)(?:\.([a-z0-9_]+))?$/;
export function isIntakeEvent(event: string): boolean {
  const m = INTAKE_EVENT_RE.exec(event);
  return Boolean(m && INTAKE_ACTION_SET.has(m[2]!) && (m[3] === undefined || INTAKE_DETAIL_SET.has(m[3])));
}
