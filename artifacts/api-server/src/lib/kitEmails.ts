/**
 * Monetization Kit emails (Randy, Nov 19 2026 10:54 AM ET): (1) the kit to the submitter (link + PDF), (2) ONE
 * drop-off nudge for an abandoned partial lead (resume link + unsubscribe). Both behind flags that default OFF:
 *   KIT_EMAIL_ENABLED=on   sends the kit email after a final submit
 *   KIT_NUDGE_ENABLED=on   lets the nudge sweep send
 * In production each flag must be exactly "on". On previews, sends are further limited to test+…@silverbirchgrowth.com.
 * Sender: KIT_EMAIL_FROM (default "Birch Reserve <kit@birchreserve.net>", must be a verified Resend sender).
 * Reply-To: BIRCH_REPLY_TO (siteMail). Tokens: KIT_EMAIL_SECRET (HMAC). Never mentions Friday.
 */
import { EMAIL_TOKENS, emailButton, emailLayout } from "./emailLayout";
import { createHmac, timingSafeEqual } from "node:crypto";

type Env = NodeJS.ProcessEnv;
export const DEFAULT_KIT_FROM = "Birch Reserve <kit@birchreserve.net>";
export const SITE = "https://birchreserve.net";
export const TEST_RECIPIENT_RE = /^test\+[a-z0-9._-]{1,40}@silverbirchgrowth\.com$/i;
const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,255}\.[^\s@<>]{2,}$/;

export function kitFlags(env: Env = process.env) {
  const on = (v: string | undefined) => v?.trim() === "on";
  return { kit: on(env.KIT_EMAIL_ENABLED), nudge: on(env.KIT_NUDGE_ENABLED), production: env.VERCEL_ENV === "production" };
}
/** Who may receive mail right now: nobody when the flag is off; only test+ addresses outside production. */
export function recipientAllowed(email: string, flag: boolean, env: Env = process.env): boolean {
  if (!flag || !EMAIL_RE.test(email)) return false;
  return env.VERCEL_ENV === "production" ? true : TEST_RECIPIENT_RE.test(email);
}
export function kitFrom(env: Env = process.env): string {
  const v = env.KIT_EMAIL_FROM?.trim();
  return v && /@/.test(v) && !/friday/i.test(v) ? v : DEFAULT_KIT_FROM;
}

/* ------------------------------------------------------------------ signed tokens (resume / unsubscribe) */
const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export function signToken(payload: { k: "resume" | "unsub"; id: string; e: string; exp: number }, secret: string): string {
  const body = b64u(JSON.stringify(payload));
  return `${body}.${b64u(createHmac("sha256", secret).update(body).digest())}`;
}
export function readToken(t: string, secret: string, now = Date.now()): { k: "resume" | "unsub"; id: string; e: string; exp: number } | null {
  const [body, sig] = String(t || "").split(".");
  if (!body || !sig || !secret) return null;
  const want = createHmac("sha256", secret).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if ((p.k !== "resume" && p.k !== "unsub") || typeof p.id !== "string" || typeof p.e !== "string" || typeof p.exp !== "number" || p.exp < now) return null;
    return p;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ templates */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const FOREST = EMAIL_TOKENS.ink, MINT = EMAIL_TOKENS.limeSoft, MUTE = EMAIL_TOKENS.muted; // /intake tokens via the shared layout
function shell(title: string, pre: string, inner: string, foot: string): string {
  return emailLayout({ title, preheader: pre, eyebrow: "Birch Reserve · Monetization Kit", body: inner, footer: foot });
}
const button = (href: string, label: string) => emailButton(href, label);

export type KitEmailInput = { brand?: string | null; reportUrl: string; headline?: { exposureMonth?: string; earningsMonth?: string } | null; hasPdf: boolean; /** Prefilled /intake/activate link: the "ads turned on" step. */ activateUrl?: string };
export function renderKitEmail(i: KitEmailInput): { subject: string; html: string; text: string } {
  const who = i.brand?.trim() ? esc(i.brand.trim()) : "your brand";
  const stats = [i.headline?.exposureMonth ? [i.headline.exposureMonth, "page-view exposures a month, likely"] : null, i.headline?.earningsMonth ? [i.headline.earningsMonth, "hub earnings a month, likely"] : null].filter(Boolean) as string[][];
  const statHtml = stats.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px -8px;border-collapse:separate;border-spacing:8px 0;width:calc(100% + 16px)"><tr>${stats.map(([v, l]) => `<td style="background:${MINT};border-radius:14px;padding:14px 16px;width:50%"><div style="font-family:${EMAIL_TOKENS.serif};font-size:28px;color:${FOREST}">${esc(v)}</div><div style="font-size:12px;color:${FOREST}">${esc(l)}</div></td>`).join('')}</tr></table>`
    : "";
  const inner = `<h1 style="font-family:${EMAIL_TOKENS.serif};font-weight:400;font-size:28px;line-height:1.18;margin:0 0 10px;color:${EMAIL_TOKENS.ink}">Your Monetization Kit is ready.</h1>
<p style="font-size:15px;line-height:1.55;margin:0;color:${MUTE}">Here is what ${who} could reach and earn across health and wellness hubs. Estimates, reviewed by a person.</p>
${statHtml}<div>${button(i.reportUrl, "Open my Monetization Kit")}</div>
${i.hasPdf ? `<p style="font-size:13px;color:${MUTE};margin:0 0 14px">Your kit is attached as a PDF.</p>` : ""}${i.activateUrl ? `<p style="font-size:14px;line-height:1.5;margin:14px 0 8px;color:${MUTE}"><b style="color:${FOREST}">Next step: getting your ads turned on.</b> Two quick questions about your inventory and which ads can run on your hubs. Ranges are fine.</p><div>${button(i.activateUrl, "Answer the two questions")}</div>` : ""}`;
  const foot = `Estimates in USD, not guarantees. A person at Birch Reserve reviews every request; nothing is booked or charged automatically.<br>Birch Reserve · birchreserve.net · Reply to this email to reach the team.`;
  const text = `Your Monetization Kit is ready.\n\nHere is what ${i.brand?.trim() || "your brand"} could reach and earn across health and wellness hubs. Estimates, reviewed by a person.\n${stats.map(([v, l]) => `- ${v} ${l}`).join("\n")}\n\nOpen your Monetization Kit: ${i.reportUrl}\n${i.hasPdf ? "Your kit is attached as a PDF.\n" : ""}${i.activateUrl ? `\nNext step, getting your ads turned on (two quick questions): ${i.activateUrl}\n` : ""}\nEstimates in USD, not guarantees. Birch Reserve · birchreserve.net`;
  return { subject: "Your free Monetization Kit from Birch Reserve", html: shell("Your Monetization Kit", "Your exposure and earnings estimate, plus the PDF.", inner, foot), text };
}

export type NudgeInput = { resumeUrl: string; unsubscribeUrl: string; website?: string | null };
export function renderNudgeEmail(i: NudgeInput): { subject: string; html: string; text: string } {
  const site = i.website?.trim() ? ` for ${esc(i.website.trim())}` : "";
  const inner = `<h1 style="font-family:${EMAIL_TOKENS.serif};font-weight:400;font-size:28px;line-height:1.18;margin:0 0 10px;color:${EMAIL_TOKENS.ink}">Your Monetization Kit is one click away.</h1>
<p style="font-size:15px;line-height:1.55;margin:0;color:${MUTE}">You started your kit${site}. We saved what you typed, so you can pick up right where you left off.</p>
<div>${button(i.resumeUrl, "Finish my free Monetization Kit")}</div>
<p style="font-size:13px;color:${MUTE};margin:0">Takes under a minute. Free.</p>`;
  const foot = `This is the only reminder we will send about this kit. <a href="${esc(i.unsubscribeUrl)}" style="color:${MUTE}">Unsubscribe</a>.<br>Birch Reserve · birchreserve.net`;
  const text = `Your Monetization Kit is one click away.\n\nYou started your kit${i.website ? ` for ${i.website}` : ""}. We saved what you typed, so you can pick up where you left off.\n\nFinish my Monetization Kit: ${i.resumeUrl}\n\nThis is the only reminder we will send about this kit. Unsubscribe: ${i.unsubscribeUrl}\nBirch Reserve · birchreserve.net`;
  return { subject: "Finish your free Monetization Kit", html: shell("Finish your Monetization Kit", "We saved your answers. Pick up where you left off.", inner, foot), text };
}

/* ------------------------------------------------------------------ nudge sweep */
export const NUDGE_AFTER_MS = 60 * 60 * 1000;
export type AbandonedLead = { id: string; email: string; website: string | null; updatedAt: Date };
export type NudgeStore = {
  listAbandoned(olderThan: Date, limit: number): Promise<AbandonedLead[]>;
  /** Atomically mark nudged; false if already nudged / unsubscribed / submitted (one nudge max). */
  claimNudge(id: string, now: Date): Promise<boolean>;
  unsubscribe(id: string, email: string, now: Date): Promise<void>;
  get(id: string): Promise<{ email: string; website: string | null; roles: string[] } | null>;
};
export type Mailer = (m: { from: string; to: string[]; subject: string; html: string; text: string; headers?: Record<string, string> }) => Promise<unknown>;

export async function sweepNudges(store: NudgeStore, mail: Mailer, env: Env = process.env, now = new Date()): Promise<{ sent: number; skipped: number; disabled?: true }> {
  const f = kitFlags(env);
  const secret = env.KIT_EMAIL_SECRET?.trim() ?? "";
  if (!f.nudge || secret.length < 16) return { sent: 0, skipped: 0, disabled: true };
  const due = await store.listAbandoned(new Date(now.getTime() - NUDGE_AFTER_MS), 50);
  let sent = 0, skipped = 0;
  for (const l of due) {
    if (!recipientAllowed(l.email, true, env) || !(await store.claimNudge(l.id, now))) { skipped++; continue; }
    const exp = now.getTime() + 30 * 864e5;
    const resumeUrl = `${SITE}/intake?resume=${signToken({ k: "resume", id: l.id, e: l.email, exp }, secret)}`;
    const unsubscribeUrl = `${SITE}/v1/kit-unsubscribe?t=${signToken({ k: "unsub", id: l.id, e: l.email, exp: now.getTime() + 365 * 864e5 }, secret)}`;
    const m = renderNudgeEmail({ resumeUrl, unsubscribeUrl, website: l.website });
    await mail({ from: kitFrom(env), to: [l.email], subject: m.subject, html: m.html, text: m.text, headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }).then(() => sent++, () => skipped++);
  }
  return { sent, skipped };
}
