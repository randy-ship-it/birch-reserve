/**
 * Site mail core (Resend) + Reply-To policy (Randy 7:27pm).
 *
 *   BIRCH_REPLY_TO (env, default unset = OFF): when set to a valid address it is the
 *   Reply-To on every BUYER-facing email the site sends (sendBuyerEmail). Unset or
 *   invalid means no Reply-To header (Emma 7:37pm: sales@ auto-replies with an old
 *   commission-jobs message, so the sales@ default is on hold). Internal lead / transcript
 *   notifications keep going TO randy@ + jon@ with Reply-To = the visitor, unchanged.
 *
 * Today the site itself sends no buyer-facing email: Stripe sends checkout receipts
 * (their Reply-To is the Stripe account's support email, set in the Stripe dashboard),
 * the linger capture delivers the media kit in-page, and intake confirmations are
 * on-screen. Any future buyer email must go through sendBuyerEmail so Reply-To is enforced.
 */
export const DEFAULT_BIRCH_REPLY_TO = "";
export const RESEND_ENDPOINT = "https://api.resend.com/emails";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function birchReplyTo(env: NodeJS.ProcessEnv = process.env): string {
  const v = env["BIRCH_REPLY_TO"]?.trim();
  return v && EMAIL_RE.test(v) ? v : DEFAULT_BIRCH_REPLY_TO;
}

export type SiteMail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
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
        subject: mail.subject,
        text: mail.text,
        ...(mail.html ? { html: mail.html } : {}),
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
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

/** Buyer-facing email: Reply-To is BIRCH_REPLY_TO when set (never the caller's choice); unset = no Reply-To. */
export async function sendBuyerEmail(mail: Omit<SiteMail, "replyTo">): Promise<{ id: string | null }> {
  const replyTo = birchReplyTo();
  return resendSend({ ...mail, ...(replyTo ? { replyTo } : {}) });
}
