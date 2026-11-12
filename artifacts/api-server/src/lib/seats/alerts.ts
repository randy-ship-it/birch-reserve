/**
 * Instant buyer alerts (Randy, Nov 12 2026): every meaningful action (form submit,
 * hold, waitlist, lock request, reservation) emails Randy + sales right away.
 *
 * - Recipients are FIXED to the three internal addresses below. Never the buyer:
 *   no auto-replies, no confirmations. Reply-To is the buyer so Randy can answer.
 * - Sender: the site's existing Resend path (lib/siteMail.ts, RESEND_API_KEY,
 *   from RANDY_CHAT_FROM / "Birch Reserve <care@scalehealth.ca>").
 * - Plain, short body: buyer, category, SKU, action, time in America/Toronto.
 *   No signature and no "--" separator line.
 * - SEAT_ALERTS_DISABLED=true is the hard off switch.
 */
import { resendSend, type SiteMail } from "../siteMail";

/** Same verified Resend sender as chat transcripts (kept inline so this module has no DB imports). */
export function seatAlertFrom(env: NodeJS.ProcessEnv = process.env): string {
  return env.SEAT_ALERT_FROM?.trim() || env.RANDY_CHAT_FROM?.trim() || "Birch Reserve <care@scalehealth.ca>";
}

export const SEAT_ALERT_TO = ["randy@scalehealth.ca", "randy@silverbirchgrowth.com", "sales@silverbirchgrowth.com"] as const;

export type AlertAction =
  | "hold"
  | "lock"
  | "lock_request"
  | "waitlist"
  | "block_request"
  | "reservation"
  | "form_submit";

export const ACTION_LABEL: Record<AlertAction, string> = {
  hold: "HOLD ($190 7-day look)",
  lock: "LOCK ($490 named category seat)",
  lock_request: "LOCK REQUEST (form)",
  waitlist: "WAITLIST",
  block_request: "IMPRESSION BLOCK REQUEST",
  reservation: "RESERVATION / CHECKOUT",
  form_submit: "FORM SUBMIT",
};

export type SeatAlert = {
  action: AlertAction;
  form?: string; // e.g. "area_lock_interest", "match_tool"
  brand?: string;
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  category?: string;
  sku?: string;
  amount?: string;
  message?: string;
  page?: string;
  checkout?: string; // "held" | "open" | "n/a"
  friday?: string; // sent | skipped | failed
  test?: boolean;
  at?: Date;
  extra?: Record<string, string | number | boolean | undefined>;
};

export function torontoTime(d: Date): string {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(d);
  return `${s} (America/Toronto)`;
}

const clean = (v: unknown, max = 300) => String(v ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export function renderSeatAlert(a: SeatAlert): { subject: string; text: string } {
  const at = a.at ?? new Date();
  const who = clean(a.brand) || clean(a.name) || clean(a.email) || "unknown buyer";
  const subject = [
    a.test ? "[TEST]" : "",
    "Birch buyer:",
    ACTION_LABEL[a.action],
    a.category ? `· ${clean(a.category, 60)}` : "",
    `· ${clean(who, 80)}`,
  ]
    .filter(Boolean)
    .join(" ");
  const rows: [string, string | undefined][] = [
    ["Action", ACTION_LABEL[a.action] + (a.form ? ` (${clean(a.form, 60)})` : "")],
    ["Buyer", clean(a.brand) || undefined],
    ["Name", clean(a.name) || undefined],
    ["Email", clean(a.email) || undefined],
    ["Phone", clean(a.phone) || undefined],
    ["Website", clean(a.website) || undefined],
    ["Category", clean(a.category) || undefined],
    ["SKU", clean(a.sku) || undefined],
    ["Amount", clean(a.amount) || undefined],
    ["Message", clean(a.message, 1200) || undefined],
    ["Page", clean(a.page) || undefined],
    ["Checkout", clean(a.checkout) || undefined],
    ["Friday", clean(a.friday) || undefined],
    ["Time", torontoTime(at)],
    ...Object.entries(a.extra ?? {}).map(([k, v]) => [k, v === undefined || v === "" ? undefined : clean(v)] as [string, string | undefined]),
  ];
  const lines = [
    a.test ? "TEST ALERT from the birchreserve.net preview. No buyer, no action needed." : "A buyer just moved on birchreserve.net. Call or reply fast.",
    "",
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
  ];
  // Hard rule: no "--" signature separator anywhere in the body.
  const text = lines.join("\n").replace(/^\s*-{2,}\s*$/gm, "").replace(/--/g, "\u2013");
  return { subject: subject.replace(/--/g, "\u2013").slice(0, 200), text };
}

export type AlertResult = { status: "sent" | "skipped" | "failed"; id?: string | null; reason?: string };

type Sender = (mail: SiteMail) => Promise<{ id: string | null }>;
let sender: Sender = resendSend;
export function setSeatAlertSenderForTests(s: Sender | null): void {
  sender = s ?? resendSend;
}

export async function sendSeatAlert(a: SeatAlert, env: NodeJS.ProcessEnv = process.env): Promise<AlertResult> {
  if (env.SEAT_ALERTS_DISABLED === "true") return { status: "skipped", reason: "SEAT_ALERTS_DISABLED" };
  if (sender === resendSend && !env.RESEND_API_KEY?.trim()) return { status: "skipped", reason: "RESEND_API_KEY not set" };
  const { subject, text } = renderSeatAlert(a);
  const email = clean(a.email, 320);
  try {
    const out = await sender({
      from: seatAlertFrom(env),
      to: [...SEAT_ALERT_TO],
      subject,
      text,
      ...(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? { replyTo: email } : {}),
    });
    return { status: "sent", id: out.id };
  } catch (err) {
    return { status: "failed", reason: err instanceof Error ? err.message.slice(0, 160) : "send failed" };
  }
}

/** Await an alert but never hold the visitor longer than `ms`. */
export async function alertWithin(a: SeatAlert, ms = 6000, env: NodeJS.ProcessEnv = process.env): Promise<AlertResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AlertResult>((resolve) => {
    timer = setTimeout(() => resolve({ status: "failed", reason: "timeout" }), ms);
  });
  try {
    return await Promise.race([sendSeatAlert(a, env), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
