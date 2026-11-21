/**
 * Sales alert (Randy, Nov 13 2026 9:41 PM ET): every category request, hold,
 * paid checkout and inquiry emails BOTH randy@scalehealth.ca and
 * randy@silverbirchgrowth.com immediately. Same Resend sender as the chat
 * transcripts (care@scalehealth.ca). Override recipients with SALES_ALERT_TO.
 *
 * Never throws: callers await it so the serverless function does not freeze
 * before the email leaves, but a mail failure never breaks the buyer's flow.
 */
import { emailH1, emailLayout, emailP, emailRows, emailTestBanner } from "./emailLayout";
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
  const html = emailLayout({
    title: alert.title,
    preheader: `Received ${when} ET on birchreserve.net`,
    eyebrow: `Birch ${EVENT_LABEL[alert.event].toLowerCase()}`,
    body: [
      alert.isTest ? emailTestBanner(`<strong>TEST submission.</strong> Safe to ignore.`) : "",
      emailH1(esc(alert.title)),
      emailP(`Received ${esc(when)} ET on birchreserve.net`, { muted: true, small: true }),
      emailRows(rows.map(([k, v]) => [k, esc(v)])),
      emailP("Reply to this email to answer the buyer directly.", { muted: true, small: true }),
    ].join(""),
  });
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
