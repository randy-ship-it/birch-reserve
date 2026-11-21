/**
 * Site mail core (Resend) + Reply-To policy (Randy 7:27pm).
 *
 *   BIRCH_REPLY_TO (env, default sales@silverbirchgrowth.com): Reply-To on every
 *   BUYER-facing email the site sends (sendBuyerEmail). Internal lead / transcript
 *   notifications keep going TO randy@ + jon@ with Reply-To = the visitor, unchanged.
 *
 * Today the site itself sends no buyer-facing email: Stripe sends checkout receipts
 * (their Reply-To is the Stripe account's support email, set in the Stripe dashboard),
 * the linger capture delivers the media kit in-page, and intake confirmations are
 * on-screen. Any future buyer email must go through sendBuyerEmail so Reply-To is enforced.
 */
import { BR_MARK_CID, BR_MARK_PNG_BASE64 } from "./emailBrandMark";
import { SCALE_LOGO_CID, SCALE_LOGO_PNG_BASE64 } from "./emailScaleMark";
export const DEFAULT_BIRCH_REPLY_TO = "sales@silverbirchgrowth.com";
export const RESEND_ENDPOINT = "https://api.resend.com/emails";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function birchReplyTo(env: NodeJS.ProcessEnv = process.env): string {
  const v = env["BIRCH_REPLY_TO"]?.trim();
  return v && EMAIL_RE.test(v) ? v : DEFAULT_BIRCH_REPLY_TO;
}

export type SiteMail = {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  /** Resend attachments: base64 content (e.g. the Monetization Kit PDF). */
  attachments?: Array<{ filename: string; content: string; content_id?: string; content_type?: string }>;
  /** Extra headers (List-Unsubscribe on the nudge). */
  headers?: Record<string, string>;
};

export type ResendFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

let fetchImpl: ResendFetch = (url, init) => fetch(url, init);
export function setSiteMailFetchForTests(f: ResendFetch | null): void {
  fetchImpl = f ?? ((url, init) => fetch(url, init));
}

export function resendKeyConfigured(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]?.trim());
}

/** Shared email layout logo: attach the inline mark whenever the HTML references cid:br-mark. */
function withBrandMark(mail: SiteMail): NonNullable<SiteMail["attachments"]> {
  const list = [...(mail.attachments ?? [])];
  if (mail.html?.includes(`cid:${BR_MARK_CID}`) && !list.some((a) => a.content_id === BR_MARK_CID)) {
    list.push({ filename: "birch-reserve.png", content: BR_MARK_PNG_BASE64, content_id: BR_MARK_CID, content_type: "image/png" });
  }
  if (mail.html?.includes(`cid:${SCALE_LOGO_CID}`) && !list.some((a) => a.content_id === SCALE_LOGO_CID)) {
    list.push({ filename: "scalehealth.png", content: SCALE_LOGO_PNG_BASE64, content_id: SCALE_LOGO_CID, content_type: "image/png" });
  }
  return list;
}

/** POST to Resend; returns the provider message id. Throws on failure (key never in errors). */
export async function resendSend(mail: SiteMail): Promise<{ id: string | null }> {
  const key = process.env["RESEND_API_KEY"]?.trim();
  if (!key) throw new Error("resend_not_configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: mail.from,
        to: mail.to,
        ...(mail.cc?.length ? { cc: mail.cc } : {}),
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        ...(withBrandMark(mail).length ? { attachments: withBrandMark(mail) } : {}),
        ...(mail.headers ? { headers: mail.headers } : {}),
      }),
      signal: controller.signal,
    });
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      const detail = body.replace(/\s+/g, " ").split(key).join("[redacted]").slice(0, 160);
      throw new Error(`Resend HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    let id: string | null = null;
    try {
      const parsed = JSON.parse(body) as { id?: unknown };
      id = typeof parsed.id === "string" ? parsed.id : null;
    } catch {
      /* tolerate non-JSON success */
    }
    return { id };
  } finally {
    clearTimeout(timeout);
  }
}

/** Buyer-facing email: Reply-To is always BIRCH_REPLY_TO (never the caller's choice). */
export async function sendBuyerEmail(mail: Omit<SiteMail, "replyTo">): Promise<{ id: string | null }> {
  return resendSend({ ...mail, replyTo: birchReplyTo() });
}
