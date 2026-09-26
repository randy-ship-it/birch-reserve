/**
 * Local Biz lead → Randy + Jon email (same Resend sender / recipients as chat
 * transcripts and email capture). Skipped for is_test leads by the caller.
 */
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

export function setLocalBizLeadNotifyDepsForTests(deps: {
  mailer?: TranscriptMailer;
  mailerReady?: () => boolean;
}): void {
  if (deps.mailer) mailer = deps.mailer;
  if (deps.mailerReady) mailerReady = deps.mailerReady;
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderLocalBizLeadEmail(lead: Lead): RenderedEmail {
  const rows: Array<[string, string]> = [
    ["Name", lead.name ?? "(not given)"],
    ["Company", lead.company ?? "(not given)"],
    ["Role", lead.role ?? "(not given)"],
    ["Email", lead.email ?? "(not given)"],
    ["Phone", lead.phone ?? "(not given)"],
    ["Need / message", lead.need ?? "(not given)"],
    ["Size", lead.size ?? "(not given)"],
    ["Timing", lead.timing ?? "(not given)"],
    ["Page", lead.pagePath ?? "/"],
    ["Category / hubs", [lead.meta.category, lead.meta.hubs].map((x) => x ?? "-").join(" / ")],
    ["Friday externalId", lead.meta.friday_external_id ?? lead.sourceRef],
    ["Lead id", lead.id],
  ];
  const subject = `Local Biz lead: ${lead.company || lead.email || lead.name || "anon"}`;
  const text = ["Local Biz lead (birchreserve.net)", "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = [
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.45">`,
    `<h2 style="margin:0 0 8px">Local Biz lead</h2>`,
    `<table style="border-collapse:collapse">${rows
      .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#555">${esc(k)}</td><td style="padding:2px 0">${esc(v)}</td></tr>`)
      .join("")}</table>`,
    `</body></html>`,
  ].join("\n");
  return { subject, text, html, ...(lead.email ? { replyTo: lead.email } : {}) };
}

export async function notifyLocalBizLead(lead: Lead): Promise<boolean> {
  if (lead.isTest) return false;
  if (!mailerReady()) {
    logger.info({ kind: "local_biz_lead_intake", lead: lead.id, reason: "resend_not_configured" }, "Local Biz lead stored (no mailer)");
    return false;
  }
  await mailer(renderLocalBizLeadEmail(lead));
  return true;
}
