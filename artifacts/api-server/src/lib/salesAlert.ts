/**
 * Sales alert (Randy, Nov 13 2026 9:41 PM ET): every category request, hold,
 * paid checkout and inquiry emails BOTH randy@scalehealth.ca and
 * randy@silverbirchgrowth.com immediately. Same Resend sender as the chat
 * transcripts (care@scalehealth.ca). Override recipients with SALES_ALERT_TO.
 *
 * Never throws: callers await it so the serverless function does not freeze
 * before the email leaves, but a mail failure never breaks the buyer's flow.
 */
import { logger } from "./logger";
import { resendKeyConfigured, resendSend, type SiteMail } from "./siteMail";
import { transcriptFrom } from "./randyChatTranscripts";

export const SALES_ALERT_TO = ["randy@scalehealth.ca", "randy@silverbirchgrowth.com"] as const;

export function salesAlertRecipients(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env["SALES_ALERT_TO"]?.trim();
  const list = raw ? raw.split(",").map((x) => x.trim()).filter((x) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(x)) : [];
  return list.length ? list : [...SALES_ALERT_TO];
}

export type SalesAlertEvent = "category_request" | "seat_hold" | "paid_checkout" | "inquiry";

export type SalesAlert = {
  event: SalesAlertEvent;
  /** Short headline, e.g. "Category request: Acme · Sleep". */
  title: string;
  rows: Array<[string, string | number | boolean | null | undefined]>;
  replyTo?: string;
  isTest?: boolean;
};

const EVENT_LABEL: Record<SalesAlertEvent, string> = {
  category_request: "REQUEST",
  seat_hold: "HOLD",
  paid_checkout: "PAID",
  inquiry: "INQUIRY",
};

type Sender = (mail: SiteMail) => Promise<{ id: string | null }>;
let sender: Sender = resendSend;
let ready: () => boolean = resendKeyConfigured;
export function setSalesAlertDepsForTests(deps: { send?: Sender | null; ready?: (() => boolean) | null }): void {
  sender = deps.send ?? resendSend;
  ready = deps.ready ?? resendKeyConfigured;
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderSalesAlert(alert: SalesAlert): Pick<SiteMail, "subject" | "text" | "html"> {
  const tag = `${alert.isTest ? "[TEST] " : ""}[BIRCH ${EVENT_LABEL[alert.event]}]`;
  const subject = `${tag} ${alert.title}`.slice(0, 200);
  const rows = alert.rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => [k, String(v).slice(0, 2000)] as const);
  const when = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });
  const text = [
    alert.isTest ? "TEST submission. Safe to ignore." : "",
    `${alert.title}`,
    `Received ${when} ET on birchreserve.net`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Reply to this email to answer the buyer directly.",
  ].filter((l, i) => l !== "" || i > 0).join("\n");
  const html = [
    `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.45">`,
    alert.isTest ? `<p style="background:#fff3cd;padding:6px 10px;margin:0 0 10px"><strong>TEST submission.</strong> Safe to ignore.</p>` : "",
    `<h2 style="margin:0 0 4px">${esc(alert.title)}</h2>`,
    `<p style="margin:0 0 12px;color:#555">Received ${esc(when)} ET on birchreserve.net</p>`,
    `<table style="border-collapse:collapse">${rows
      .map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#555;vertical-align:top">${esc(k)}</td><td style="padding:3px 0">${esc(v)}</td></tr>`)
      .join("")}</table>`,
    `<p style="margin:14px 0 0;color:#555">Reply to this email to answer the buyer directly.</p>`,
    `</body></html>`,
  ].join("");
  return { subject, text, html };
}

export type SalesAlertResult = { status: "sent" | "skipped" | "failed"; id?: string | null; to: string[] };

export async function sendSalesAlert(alert: SalesAlert): Promise<SalesAlertResult> {
  const to = salesAlertRecipients();
  if (process.env["SALES_ALERTS_DISABLED"] === "true") return { status: "skipped", to };
  if (!ready()) {
    logger.warn({ kind: "sales_alert", event: alert.event, reason: "resend_not_configured" }, "Sales alert not sent (no mailer)");
    return { status: "skipped", to };
  }
  try {
    const rendered = renderSalesAlert(alert);
    const replyTo = alert.replyTo && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(alert.replyTo) ? alert.replyTo : undefined;
    const { id } = await sender({ from: transcriptFrom(), to, ...rendered, ...(replyTo ? { replyTo } : {}) });
    logger.info({ kind: "sales_alert", event: alert.event, id, test: alert.isTest === true }, "Sales alert sent");
    return { status: "sent", id, to };
  } catch (err) {
    logger.error({ kind: "sales_alert", event: alert.event, err: err instanceof Error ? err.message : String(err) }, "Sales alert failed");
    return { status: "failed", to };
  }
}
