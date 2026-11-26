/**
 * Branded buyer confirmation after a paid checkout (Randy, Nov 21 2026 6:12 PM: "Turn on the branded Birch confirmation email").
 *
 * - Every paid SKU: $190 look, $490 category placement, $1,900 starter placement, sponsor packs (USD and CAD).
 * - Birch buyers get the Birch layout; checkouts that started on the Scale mirror (metadata site=scale) get the ScaleHealth one.
 * - Content: amount paid + currency, ad credit booked (bonus and media credit shown separately), campaign dates when set,
 *   a dashboard button (/account/login?session_id=…, which re-checks the payment with Stripe and signs the buyer in),
 *   creative next steps, support contact. Never the promo code, never counts, claims or partner names.
 * - Exactly one email per paid session: an atomic claim on ad_once (`buyer.paid_confirmation:<session id>`, INSERT … ON
 *   CONFLICT DO NOTHING) is taken before sending, so webhook retries, completed + async_payment_succeeded, and admin
 *   replays all find it taken. A failed send gives the claim back so a replay can retry.
 * - No retro-sends: sessions created before PAID_CONFIRMATION_SINCE never get one (Calm Joints' Nov 21 order included).
 * - Test identities never get one, except our own qa+…@silverbirchgrowth.com inbox (marked TEST).
 * - Kill switch: PAID_CONFIRMATION_EMAIL=false. Needs RESEND_API_KEY. Never throws (Stripe still gets its 2xx).
 */
import type Stripe from "stripe";
import { EMAIL_TOKENS, SCALE_EMAIL_TOKENS, emailButton, emailLayout, escEmail, type EmailBrand } from "./emailLayout";
import { resendKeyConfigured, sendBuyerEmail } from "./siteMail";
import { transcriptFrom } from "./randyChatTranscripts";
import { isTestIdentity } from "./testTraffic";
import { logger } from "./logger";
import { campaignByOrderRef, claimOnce, releaseOnce, audit } from "./adserver/store";
import { MICROS } from "./adserver/config";
import type { Campaign } from "./adserver/engine";

/** Paid sessions created before this (Nov 21 2026 6:30 PM ET) never get a confirmation: no retro-sends. */
export const PAID_CONFIRMATION_SINCE = Date.UTC(2026, 10, 21, 23, 30, 0) / 1000;
export const SUPPORT_EMAIL = "randy@scalehealth.ca";
export const SUPPORT_PHONE = "(647) 931-6278";
const OWN_QA = /^qa\+[^@\s]*@silverbirchgrowth\.com$/i;

export type PaidConfirmationInput = {
  brand: EmailBrand;
  brandName?: string | null;
  sku: "hold-190" | "reserve-490" | "exclusive" | "sponsor" | "other";
  tierLabel?: string | null;
  amountPaidCents: number;
  currency: string;
  /** Credit on the campaign, in cents of the campaign currency (paid + bonus + media credit). */
  creditCents: number;
  bonusCents: number;
  mediaCreditCents: number;
  flightStart?: Date | null;
  flightEnd?: Date | null;
  dashboardUrl: string;
  isTest?: boolean;
};
export type PaidConfirmationEmail = { subject: string; text: string; html: string };

export function money(cents: number, currency: string): string {
  const whole = cents % 100 === 0 ? (cents / 100).toLocaleString("en-US") : (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${whole} ${currency.toUpperCase()}`;
}
const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Toronto", month: "long", day: "numeric", year: "numeric" });

export function skuOf(md: Record<string, string>): PaidConfirmationInput["sku"] {
  if (md.kind === "exclusive_reserve") return "exclusive";
  if (md.kind === "sponsorship_credit") return "sponsor";
  const s = md.sku || md.offerKey || "";
  if (s === "hold-190") return "hold-190";
  if (s === "reserve-490" || s === "reserve-899") return "reserve-490";
  return "other";
}

const ORDER_LABEL: Record<PaidConfirmationInput["sku"], string> = {
  "hold-190": "7-day look",
  "reserve-490": "Category placement",
  exclusive: "Starter placement",
  sponsor: "Sponsor pack",
  other: "Ad order",
};

function nextSteps(i: PaidConfirmationInput): string[] {
  const upload = "Upload your ad from your dashboard. The common 1200 x 628 landscape image works, and the dashboard lists every other size (wide banner, vertical, card and video).";
  if (i.sku === "exclusive" || i.sku === "sponsor") {
    return [
      "We email your insertion order within 1 business day. It names your hubs, category and dates.",
      "Nothing runs until you sign it.",
      upload,
      "A person reviews every ad before it goes live.",
    ];
  }
  return [
    upload,
    "A person reviews every ad before it goes live. We email you if anything needs a change.",
    i.sku === "hold-190" ? "Once approved, your placement runs for 7 days." : "Once approved, your placement runs on the dates we confirm with you.",
    "Your dashboard shows your credit, what has run and what is left.",
  ];
}

export function buildPaidConfirmationEmail(i: PaidConfirmationInput): PaidConfirmationEmail {
  const scale = i.brand === "scale";
  const K = scale ? SCALE_EMAIL_TOKENS : EMAIL_TOKENS;
  const site = scale ? "ScaleHealth" : "Birch Reserve";
  const name = (i.brandName ?? "").trim();
  const order = `${ORDER_LABEL[i.sku]}${i.tierLabel ? ` (${i.tierLabel})` : ""}`;
  const paid = money(i.amountPaidCents, i.currency);
  const credit = money(i.creditCents, i.currency);
  const dates = i.flightStart && i.flightEnd ? `${day(i.flightStart)} to ${day(i.flightEnd)}` : i.sku === "exclusive" || i.sku === "sponsor" ? "Set in your insertion order" : "Confirmed when your ad is approved";
  const creditNote = [i.bonusCents > 0 ? `includes ${money(i.bonusCents, i.currency)} bonus credit` : "", i.mediaCreditCents > 0 ? `includes ${money(i.mediaCreditCents, i.currency)} media credit` : ""].filter(Boolean).join(", ");
  const rows: Array<[string, string]> = [
    ["Order", order],
    ["Paid", paid],
    ["Ad credit booked", `${credit}${creditNote ? ` (${creditNote})` : ""}`],
    ["Campaign dates", dates],
  ];
  const steps = nextSteps(i);
  const subject = `${i.isTest ? "[TEST] " : ""}Payment received${name ? `: ${name}` : ""}. Your ${ORDER_LABEL[i.sku].toLowerCase()} is booked`;
  const text = [
    i.isTest ? "TEST order. Safe to ignore." : "",
    name ? `Hi ${name} team,` : "Hi,",
    "",
    `Thank you. Your payment is received and your ad credit is booked with ${site}.`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Open your ad dashboard: ${i.dashboardUrl}`,
    "",
    "Next steps:",
    ...steps.map((s) => `- ${s}`),
    "",
    `Questions? Reply to this email, write to ${SUPPORT_EMAIL}.`,
    "",
    site,
  ].filter((l, n) => l !== "" || n > 0).join("\n");

  const p = (h: string, muted = false, small = false) => `<p style="margin:0 0 12px;font-family:${K.sans};font-size:${small ? 13 : 15}px;line-height:1.6;color:${muted ? K.muted : K.ink}">${h}</p>`;
  const h1 = scale
    ? `<h1 style="margin:0 0 10px;font-family:${K.sans};font-weight:800;font-size:26px;line-height:1.2;color:${K.ink}">Payment received</h1>`
    : `<h1 style="margin:0 0 10px;font-family:${EMAIL_TOKENS.serif};font-weight:400;font-size:28px;line-height:1.18;color:${K.ink}">Payment received</h1>`;
  const h2 = (t: string) => `<h2 style="margin:22px 0 8px;font-family:${K.sans};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${K.eyebrow}">${t}</h2>`;
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 8px">${rows
    .map(([k, v]) => `<tr><td valign="top" style="padding:9px 12px 9px 0;border-bottom:1px solid ${K.line};font-family:${K.sans};font-size:13px;color:${K.muted};width:38%">${escEmail(k)}</td><td valign="top" style="padding:9px 0;border-bottom:1px solid ${K.line};font-family:${K.sans};font-size:15px;color:${K.ink};font-weight:${k === "Ad credit booked" ? 700 : 400};word-break:break-word">${escEmail(v)}</td></tr>`)
    .join("")}</table>`;
  const list = `<ul style="margin:0 0 12px;padding-left:20px;font-family:${K.sans};font-size:15px;line-height:1.6;color:${K.ink}">${steps.map((s) => `<li style="margin:0 0 6px">${escEmail(s)}</li>`).join("")}</ul>`;
  const banner = i.isTest ? `<p style="margin:0 0 16px;padding:10px 14px;background:${scale ? SCALE_EMAIL_TOKENS.greenSoft : EMAIL_TOKENS.limeSoft};border-radius:12px;font-family:${K.sans};font-size:13px;color:${K.ink}"><strong>TEST order.</strong> Safe to ignore.</p>` : "";
  const body = [
    banner,
    h1,
    p(`${name ? `Hi ${escEmail(name)} team, thank you.` : "Thank you."} Your payment is received and your ad credit is booked with ${site}.`),
    table,
    emailButton(i.dashboardUrl, "Open my ad dashboard", i.brand),
    h2("Next steps"),
    list,
    p(`Questions? Reply to this email, write to <a href="mailto:${SUPPORT_EMAIL}" style="color:${K.ink}">${SUPPORT_EMAIL}</a>.`, true, true),
  ].join("");
  const footer = scale
    ? `ScaleHealth · <a href="https://www.scalehealth.ca/intake" style="color:${K.muted}">scalehealth.ca</a> · ${SUPPORT_EMAIL}`
    : `Birch Reserve · <a href="https://birchreserve.net" style="color:${K.muted}">birchreserve.net</a> · ${SUPPORT_EMAIL}`;
  const html = emailLayout({ brand: i.brand, title: "Payment received", preheader: `${paid} received. ${credit} of ad credit is booked.`, eyebrow: `${site} · Payment received`, body, footer });
  return { subject, text, html };
}

/** Where the buyer's dashboard button goes: the site they bought on, signed in by the paid session id (45 days). */
export function dashboardUrlFor(brand: EmailBrand, sessionId: string): string {
  const base = brand === "scale" ? "https://www.scalehealth.ca/intake/_m" : "https://birchreserve.net";
  return `${base}/account/login?session_id=${encodeURIComponent(sessionId)}`;
}

/** Credit split: sponsor packs carry bonus credit (credit_cents − paid); anything else above the paid amount is media credit. */
export function creditSplit(session: Pick<Stripe.Checkout.Session, "amount_total" | "metadata">, campaign: Pick<Campaign, "budgetMicros"> | null) {
  const paid = session.amount_total ?? 0;
  const md = session.metadata ?? {};
  const creditCents = campaign ? Math.round(campaign.budgetMicros / (MICROS / 100)) : Number(md.credit_cents) || paid;
  const packCredit = md.kind === "sponsorship_credit" ? Number(md.credit_cents) || paid : paid;
  const bonusCents = Math.max(0, packCredit - paid);
  const mediaCreditCents = Math.max(0, creditCents - packCredit);
  return { creditCents, bonusCents, mediaCreditCents };
}

type Mail = { from: string; to: string[]; subject: string; text: string; html?: string };
export type PaidConfirmationDeps = { send: (m: Mail) => Promise<{ id: string | null }>; enabled: () => boolean; now: () => number };
const defaults: PaidConfirmationDeps = {
  send: (m) => sendBuyerEmail(m),
  enabled: () => process.env.PAID_CONFIRMATION_EMAIL !== "false" && resendKeyConfigured(),
  now: () => Date.now(),
};
let deps = defaults;
export function setPaidConfirmationDepsForTests(d: Partial<PaidConfirmationDeps> | null): void {
  deps = d ? { ...defaults, ...d } : defaults;
}

function fromFor(brand: EmailBrand): string {
  const from = transcriptFrom();
  if (brand !== "scale") return from;
  const m = /<([^>]+)>/.exec(from);
  return `ScaleHealth Ads <${m ? m[1] : from}>`;
}

export type PaidConfirmationOutcome = "sent" | "duplicate" | "skipped" | "error";

export async function sendPaidConfirmationSafe(session: Stripe.Checkout.Session): Promise<{ status: PaidConfirmationOutcome; reason?: string }> {
  const key = `buyer.paid_confirmation:${session?.id}`;
  let claimed = false;
  try {
    if (!deps.enabled()) return { status: "skipped", reason: "disabled" };
    if (session.payment_status !== "paid") return { status: "skipped", reason: "not_paid" };
    if ((session.created ?? 0) < PAID_CONFIRMATION_SINCE) return { status: "skipped", reason: "before_launch" };
    const md = (session.metadata ?? {}) as Record<string, string>;
    const to = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    if (!to) return { status: "skipped", reason: "no_email" };
    const campaign = await campaignByOrderRef(session.id);
    const test = !session.livemode || campaign?.isTest === true || isTestIdentity({ email: to, name: md.brand ?? null });
    if (test && !OWN_QA.test(to)) return { status: "skipped", reason: "test_identity" };
    if (!(await claimOnce(key, "stripe-webhook"))) return { status: "duplicate" };
    claimed = true;
    const brand: EmailBrand = md.site === "scale" || md.sold_by === "scale" ? "scale" : "birch";
    const currency = String(session.currency ?? campaign?.currency ?? "usd");
    const sku = skuOf(md);
    const mail = buildPaidConfirmationEmail({
      brand,
      brandName: campaign?.brand ?? md.brand ?? null,
      sku,
      tierLabel: sku === "sponsor" && md.tier ? md.tier.replace(/^sponsor-(\d+)$/, (_m, n) => `$${Number(n).toLocaleString("en-US")} pack`) : null,
      amountPaidCents: session.amount_total ?? 0,
      currency,
      ...creditSplit(session, campaign),
      flightStart: campaign?.flightStart ?? null,
      flightEnd: campaign?.flightEnd ?? null,
      dashboardUrl: dashboardUrlFor(brand, session.id),
      isTest: test,
    });
    const { id } = await deps.send({ from: fromFor(brand), to: [to], ...mail });
    await audit("stripe-webhook", "buyer.paid_confirmation", campaign?.id ?? session.id, `${brand} ${sku} → ${to.replace(/^(.).*(@.*)$/, "$1…$2")} ${id ?? ""}`.trim());
    return { status: "sent" };
  } catch (error) {
    if (claimed) await releaseOnce(key).catch(() => undefined);
    logger.warn({ stripeSession: session?.id, err: error instanceof Error ? error.message.slice(0, 160) : String(error) }, "Paid confirmation email failed (webhook still 2xx)");
    return { status: "error" };
  }
}
