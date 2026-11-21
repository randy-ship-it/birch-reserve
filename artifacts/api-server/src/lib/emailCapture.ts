/**
 * Linger email capture → Randy + Jon email (same Resend sender / recipients as
 * the chat transcripts). Skipped for is_test leads by the caller. Never includes
 * anything the visitor didn't type except first-touch attribution.
 */
import { emailH1, emailLayout, emailRows } from "./emailLayout";
import { logger } from "./logger";
import type { Lead } from "./leads";
import {
  resendConfigured,
  resendMailer,
  type RenderedEmail,
  type TranscriptMailer,
} from "./randyChatTranscripts";

let mailer: TranscriptMailer = resendMailer;
let mailerReady: () => boolean = resendConfigured;

export function setEmailCaptureDepsForTests(deps: { mailer?: TranscriptMailer; mailerReady?: () => boolean }): void {
  if (deps.mailer) mailer = deps.mailer;
  if (deps.mailerReady) mailerReady = deps.mailerReady;
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderEmailCaptureEmail(lead: Lead): RenderedEmail {
  const rows: Array<[string, string]> = [
    ["Email", lead.email ?? "(not given)"],
    ["Company", lead.company ?? "(not given)"],
    ["Wants", "Birch Reserve media kit + seat updates"],
    ["Page", lead.pagePath ?? "/"],
    ["UTM source / medium / campaign", [lead.utmSource, lead.utmMedium, lead.utmCampaign].map((x) => x ?? "-").join(" / ")],
    ["UTM term / content", [lead.utmTerm, lead.utmContent].map((x) => x ?? "-").join(" / ")],
    ["Referrer", lead.referrer ?? "(direct)"],
    ["Landing page", lead.landingPage ?? "(unknown)"],
    ["Lead id", lead.id],
  ];
  const subject = `Birch email capture: ${lead.company || lead.email || "anon"}`;
  const text = ["Birch email capture (site pop-up)", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = emailLayout({ title: "Birch email capture", eyebrow: "Birch email capture", body: emailH1("Birch email capture (site pop-up)") + emailRows(rows.map(([k, v]) => [k, esc(v)])) });
  return { subject, text, html, ...(lead.email ? { replyTo: lead.email } : {}) };
}

export async function notifyEmailCapture(lead: Lead): Promise<boolean> {
  if (lead.isTest) return false;
  if (!mailerReady()) {
    logger.info({ kind: "email_capture_intake", lead: lead.id, reason: "resend_not_configured" }, "Email capture stored (no mailer)");
    return false;
  }
  await mailer(renderEmailCaptureEmail(lead));
  return true;
}
