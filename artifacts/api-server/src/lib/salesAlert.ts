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

/** Public site the visitor used. Shown as "via scalehealth.ca" or "via birchreserve.net". */
export const ALERT_SITES = ["scalehealth.ca", "birchreserve.net"] as const;
export type AlertSite = (typeof ALERT_SITES)[number];

export function alertSiteOf(
  req?: { get: (n: string) => string | undefined } | null,
  extra?: { src?: string | null; ref?: string | null; skin?: string | null; host?: string | null; origin?: string | null; site?: string | null },
): AlertSite {
  if (extra?.skin === "scale" || extra?.site === "scale") return "scalehealth.ca";
  const host = (extra?.host ?? (req ? String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0]!.trim() : "")).toLowerCase().replace(/:\d+$/, "");
  const origin = (extra?.origin ?? (req ? String(req.get("origin") || req.get("referer") || "") : "")).toLowerCase();
  const src = (extra?.src ?? "").toLowerCase();
  const ref = (extra?.ref ?? "").toLowerCase();
  if (src === "scale_mirror" || src === "scale" || ref === "scale") return "scalehealth.ca";
  if (/(^|[./])scalehealth\.ca(?=$|[/:])/.test(host) || /scalehealth\.ca/.test(origin)) return "scalehealth.ca";
  return "birchreserve.net";
}

export function receivedViaLine(when: string, via: AlertSite = "birchreserve.net"): string {
  return `Received ${when} ET via ${via}`;
}

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
  /** Override recipients (e.g. SBG-only alerts). */
  to?: string[];
  /** Override the subject tag / eyebrow label (default "BIRCH <EVENT>"). */
  tag?: string;
  /** Visitor site: "via scalehealth.ca" or "via birchreserve.net". Defaults to birchreserve.net. */
  via?: AlertSite;
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
  const tag = `${alert.isTest ? "[TEST] " : ""}[${alert.tag ?? `BIRCH ${EVENT_LABEL[alert.event]}`}]`;
  const subject = `${tag} ${alert.title}`.slice(0, 200);
  const rows = alert.rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => [k, String(v).slice(0, 2000)] as const);
  const when = new Date().toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });
  const via = alert.via === "scalehealth.ca" ? "scalehealth.ca" : "birchreserve.net";
  const received = receivedViaLine(when, via);
  const text = [
    alert.isTest ? "TEST submission. Safe to ignore." : "",
    `${alert.title}`,
    received,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "Reply to this email to answer the buyer directly.",
  ].filter((l, i) => l !== "" || i > 0).join("\n");
  const html = emailLayout({
    title: alert.title,
    preheader: received,
    eyebrow: alert.tag ? alert.tag.toLowerCase() : `Birch ${EVENT_LABEL[alert.event].toLowerCase()}`,
    body: [
      alert.isTest ? emailTestBanner(`<strong>TEST submission.</strong> Safe to ignore.`) : "",
      emailH1(esc(alert.title)),
      emailP(esc(received), { muted: true, small: true }),
      emailRows(rows.map(([k, v]) => [k, esc(v)])),
      emailP("Reply to this email to answer the buyer directly.", { muted: true, small: true }),
    ].join(""),
  });
  return { subject, text, html };
}

export type SalesAlertResult = { status: "sent" | "skipped" | "failed"; id?: string | null; to: string[] };

export async function sendSalesAlert(alert: SalesAlert): Promise<SalesAlertResult> {
  const to = alert.to?.length ? alert.to : salesAlertRecipients();
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
