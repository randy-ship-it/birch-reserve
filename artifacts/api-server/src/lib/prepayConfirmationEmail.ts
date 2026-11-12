/**
 * Prepay confirmation email (buyer-facing).
 *
 * After a paid reserve-490 checkout the brand is emailed what we need to build the campaign
 * (artwork, copy, links) and replies with it. Contract:
 *   - NO URLs anywhere in the body or subject. Links are collected by reply, never sent.
 *     (Randy's HARD rule: automated email carries no URLs; door/URL mail goes via Instantly only.)
 *   - Sent through sendBuyerEmail (Resend), so Reply-To is always BIRCH_REPLY_TO.
 *   - OFF by default. Only sends when PREPAY_CONFIRMATION_EMAIL=true AND RESEND_API_KEY is set.
 *     Preview / test deployments never send.
 *   - Never for is_test reservations. Never throws (webhook still returns 2xx to Stripe).
 *   - Hold-190 is not a prepay and gets no email from this module.
 */
import type Stripe from "stripe";
import { logger } from "./logger";
import { PREPAY_REFUND_CUTOFF_DAYS } from "./reserveOffers";
import { resendKeyConfigured, sendBuyerEmail } from "./siteMail";
import { transcriptFrom } from "./randyChatTranscripts";
import { isTestIdentity } from "./testTraffic";

export type PrepayEmailInput = {
  brandName?: string | null;
  amountCents: number;
  currency: string;
};

export type PrepayEmail = { subject: string; text: string };

export function formatPrepayAmount(amountCents: number, currency: string): string {
  const cur = currency.toUpperCase();
  const whole = amountCents % 100 === 0 ? String(amountCents / 100) : (amountCents / 100).toFixed(2);
  return `$${whole} ${cur}`;
}

export function buildPrepayConfirmationEmail(input: PrepayEmailInput): PrepayEmail {
  const brand = (input.brandName ?? "").trim();
  const amount = formatPrepayAmount(input.amountCents, input.currency);
  const subject = `Your category is reserved${brand ? `: ${brand}` : ""}. Reply with your artwork, copy and links`;
  const text = [
    brand ? `Hi ${brand} team,` : "Hi,",
    "",
    `Thank you. Your ${amount} prepayment is received and your category is reserved. All of it becomes display credit in your category.`,
    "",
    "To build your campaign, reply to this email with:",
    "",
    "1. Artwork: a square image (1080 x 1080 px, PNG or JPG) and, if you have it, a wide image (1200 x 628 px). Attach the files.",
    "2. Copy: a headline of up to 40 characters, one line of body copy of up to 90 characters, and a button label of up to 20 characters.",
    "3. Links: the page your button should open, in plain text. Include any tracking parameters you want us to keep.",
    "4. Your target launch date. If you have no date yet, say so and we will propose one.",
    "5. Anything we must not say, and your legal or compliance contact if a review is needed.",
    "",
    "What happens next:",
    "- We reply within 2 business days with a preview of your unit for approval.",
    "- An insertion order names the hub and the category before anything runs.",
    "- Nothing goes live until you approve the preview and the insertion order.",
    "",
    `Refund: your prepayment is fully refundable until ${PREPAY_REFUND_CUTOFF_DAYS} days before your launch date. To cancel, reply to this email with the word CANCEL. We refund the full amount to the card you paid with. After that date the credit is not refundable, and it stays usable for 12 months after payment.`,
    "",
    "Your payment is display credit, not an impression guarantee. Reporting is aggregate only.",
    "",
    "Reply to this email with any question.",
    "",
    "Birch Reserve",
  ].join("\n");
  return { subject, text };
}

export type PrepayReservation = {
  id: string;
  email: string;
  brandName: string | null;
  offerKey: string;
  isTest: boolean;
  amountCents: number;
  currency: string;
};

export type PrepayEmailDeps = {
  loadReservation: (id: string) => Promise<PrepayReservation | undefined>;
  send: (mail: { from: string; to: string[]; subject: string; text: string }) => Promise<{ id: string | null }>;
  enabled: () => boolean;
};

const defaultDeps: PrepayEmailDeps = {
  loadReservation: async (id) => {
    const { db, splashAdReservationsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({
        id: splashAdReservationsTable.id,
        email: splashAdReservationsTable.email,
        brandName: splashAdReservationsTable.brandName,
        offerKey: splashAdReservationsTable.offerKey,
        isTest: splashAdReservationsTable.isTest,
        amountCents: splashAdReservationsTable.amountCents,
        currency: splashAdReservationsTable.currency,
      })
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, id));
    return row ? { ...row, id: String(row.id), amountCents: row.amountCents ?? 0, currency: row.currency ?? "usd" } : undefined;
  },
  send: (mail) => sendBuyerEmail(mail),
  enabled: () => process.env["PREPAY_CONFIRMATION_EMAIL"] === "true" && resendKeyConfigured(),
};

let deps: PrepayEmailDeps = defaultDeps;
export function setPrepayEmailDepsForTests(next: Partial<PrepayEmailDeps> | null): void {
  deps = next ? { ...defaultDeps, ...next } : defaultDeps;
}

export type PrepayEmailOutcome =
  | { status: "sent"; id: string | null }
  | { status: "skipped"; reason: string }
  | { status: "error"; error: string };

export async function sendPrepayConfirmationSafe(session: Stripe.Checkout.Session): Promise<PrepayEmailOutcome> {
  try {
    if (!deps.enabled()) return { status: "skipped", reason: "disabled" };
    if (session.payment_status !== "paid") return { status: "skipped", reason: "not_paid" };
    const reservationId = session.metadata?.["reservationId"];
    if (!reservationId) return { status: "skipped", reason: "no_reservation" };
    const reservation = await deps.loadReservation(reservationId);
    if (!reservation) return { status: "skipped", reason: "reservation_not_found" };
    if (reservation.offerKey !== "reserve-490") return { status: "skipped", reason: "not_prepay_offer" };
    const to = (reservation.email || session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    if (!to) return { status: "skipped", reason: "no_email" };
    if (reservation.isTest || isTestIdentity({ email: to, name: reservation.brandName ?? null })) {
      return { status: "skipped", reason: "test_identity" };
    }
    const mail = buildPrepayConfirmationEmail({
      brandName: reservation.brandName,
      amountCents: reservation.amountCents,
      currency: reservation.currency,
    });
    const { id } = await deps.send({ from: transcriptFrom(), to: [to], ...mail });
    logger.info({ reservationId }, "Prepay confirmation email sent");
    return { status: "sent", id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "prepay_email_failed";
    logger.warn({ stripeSession: session?.id, err: msg.slice(0, 160) }, "Prepay confirmation email failed (webhook still 2xx)");
    return { status: "error", error: msg.slice(0, 200) };
  }
}
