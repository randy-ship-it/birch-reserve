/**
 * Refunds and disputes (Stripe audit, Nov 21 2026 5:30 PM: "is everything organized and logged in Stripe properly so when people
 * go spend it clocks, works"). Before this, a refund or chargeback in Stripe left the order's ad credit fully spendable and nobody
 * was told. Now, from the signed webhook:
 *   charge.refunded         → the order's credit drops by the refunded share (never below what already served), a full refund
 *                             also pauses the campaign, the referral commission basis shrinks by the same amount, the splash
 *                             seat is marked refunded, and sales gets a [BIRCH REFUND] email. Partial refunds stack correctly
 *                             (delta from previous_attributes), and each refund step runs once per charge + refunded total.
 *   charge.dispute.created  → the campaign pauses (nothing more serves on disputed money) and sales gets a [BIRCH DISPUTE] email.
 * Never throws, so Stripe always gets its 2xx; every step lands in the ad admin audit log.
 */
import type Stripe from "stripe";
import { getStripeClient } from "./stripeClient";
import { audit, claimOnce, db, S } from "./adserver/store";
import { sendSalesAlert } from "./salesAlert";
import { logger } from "./logger";

type SessionFinder = (paymentIntentId: string) => Promise<Stripe.Checkout.Session | null>;
type ChargeFinder = (chargeId: string) => Promise<Stripe.Charge | null>;

const defaultFindSession: SessionFinder = async (pi) => {
  const list = await getStripeClient().checkout.sessions.list({ payment_intent: pi, limit: 1 });
  return list.data[0] ?? null;
};
const defaultFindCharge: ChargeFinder = async (id) => getStripeClient().charges.retrieve(id);

let findSession: SessionFinder = defaultFindSession;
let findCharge: ChargeFinder = defaultFindCharge;
export function setStripeRefundDepsForTests(d: { findSession?: SessionFinder | null; findCharge?: ChargeFinder | null }): void {
  findSession = d.findSession ?? defaultFindSession;
  findCharge = d.findCharge ?? defaultFindCharge;
}

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : v?.id ?? null);
const money = (cents: number, cur: string) => `${(cents / 100).toFixed(2)} ${cur.toUpperCase()}`;

/** Credit per paid cent: sponsor packs carry bonus credit (credit_cents / amount paid), everything else is 1:1. */
export function creditRatio(session: Pick<Stripe.Checkout.Session, "metadata" | "amount_total">): number {
  const paid = session.amount_total ?? 0;
  const credit = Number(session.metadata?.credit_cents);
  if (session.metadata?.kind === "sponsorship_credit" && paid > 0 && Number.isFinite(credit) && credit > 0) return credit / paid;
  return 1;
}

async function markReservationRefunded(sessionId: string, full: boolean): Promise<void> {
  if (!full) return;
  try {
    const p = await db();
    await p.query(`UPDATE public.splash_ad_reservations SET payment_status = 'refunded' WHERE stripe_checkout_session_id = $1 AND payment_status = 'paid'`, [sessionId]);
  } catch {
    /* table absent in some test pools; the campaign + alert still carry the refund */
  }
}

export type RefundOutcome = "applied" | "duplicate" | "no_order" | "ignored" | "error";

export async function handleChargeRefundedSafe(charge: Stripe.Charge, previous?: { amount_refunded?: number } | null): Promise<RefundOutcome> {
  try {
    const refunded = charge.amount_refunded ?? 0;
    const delta = refunded - (previous?.amount_refunded ?? 0);
    if (refunded <= 0 || delta <= 0) return "ignored";
    if (!(await claimOnce(`stripe.refund:${charge.id}:${refunded}`, "stripe-webhook"))) return "duplicate";
    const pi = idOf(charge.payment_intent as never);
    const session = pi ? await findSession(pi) : null;
    const full = charge.refunded === true || refunded >= (charge.amount ?? 0);
    const cur = String(charge.currency ?? "usd");
    const p = await db();
    let campaignId: string | null = null;
    let budgetLine = "no order found for this payment";
    let isTest = !charge.livemode;
    if (session) {
      const reduce = Math.round(delta * creditRatio(session)) * 10_000;
      const { rows } = await p.query(
        `UPDATE ${S()}.ad_campaigns SET budget_micros = GREATEST(spent_micros, budget_micros - $2),
           status = CASE WHEN $3::boolean AND status <> 'completed' THEN 'paused' ELSE status END, updated_at = now()
         WHERE order_ref = $1 RETURNING id, budget_micros, spent_micros, is_test, status`,
        [session.id, reduce, full],
      );
      if (rows[0]) {
        campaignId = String(rows[0].id);
        isTest = isTest || Boolean(rows[0].is_test);
        budgetLine = `credit now ${money(Number(rows[0].budget_micros) / 10_000, cur)} (spent ${money(Number(rows[0].spent_micros) / 10_000, cur)}), status ${rows[0].status}`;
      }
      await p.query(`UPDATE ${S()}.ad_referral_orders SET amount_cents = GREATEST(0, amount_cents - $2) WHERE session_id = $1`, [session.id, delta]);
      await markReservationRefunded(session.id, full);
    }
    await audit("stripe-webhook", full ? "stripe.refund_full" : "stripe.refund_partial", campaignId ?? session?.id ?? charge.id, `${charge.id} refunded ${money(delta, cur)} (total ${money(refunded, cur)} of ${money(charge.amount ?? 0, cur)}) · ${budgetLine}`);
    await sendSalesAlert({
      event: "paid_checkout",
      tag: "BIRCH REFUND",
      isTest,
      title: `${full ? "Full refund" : "Partial refund"}: ${money(delta, cur)} · ${session?.metadata?.brand ?? session?.customer_details?.email ?? charge.billing_details?.email ?? charge.id}`,
      rows: [
        ["Refunded now", money(delta, cur)],
        ["Refunded in total", `${money(refunded, cur)} of ${money(charge.amount ?? 0, cur)}`],
        ["Order", session?.metadata?.sku ?? session?.metadata?.kind],
        ["Ad credit", budgetLine],
        ["Stripe charge", charge.id],
        ["Stripe session", session?.id],
      ],
    }).catch(() => undefined);
    return session ? "applied" : "no_order";
  } catch (error) {
    logger.warn({ charge: charge?.id, err: error instanceof Error ? error.message : String(error) }, "Refund handling failed (webhook still 2xx)");
    return "error";
  }
}

export async function handleDisputeCreatedSafe(dispute: Stripe.Dispute): Promise<RefundOutcome> {
  try {
    if (!(await claimOnce(`stripe.dispute:${dispute.id}`, "stripe-webhook"))) return "duplicate";
    const chargeId = idOf(dispute.charge as never);
    const charge = chargeId ? await findCharge(chargeId) : null;
    const pi = idOf((dispute.payment_intent ?? charge?.payment_intent) as never);
    const session = pi ? await findSession(pi) : null;
    const cur = String(dispute.currency ?? "usd");
    let campaignId: string | null = null;
    let isTest = !dispute.livemode;
    if (session) {
      const p = await db();
      const { rows } = await p.query(
        `UPDATE ${S()}.ad_campaigns SET status = CASE WHEN status <> 'completed' THEN 'paused' ELSE status END, updated_at = now() WHERE order_ref = $1 RETURNING id, is_test`,
        [session.id],
      );
      if (rows[0]) {
        campaignId = String(rows[0].id);
        isTest = isTest || Boolean(rows[0].is_test);
      }
    }
    await audit("stripe-webhook", "stripe.dispute", campaignId ?? session?.id ?? dispute.id, `${dispute.id} ${money(dispute.amount ?? 0, cur)} reason=${dispute.reason} · campaign ${campaignId ? "paused" : "not found"}`);
    await sendSalesAlert({
      event: "paid_checkout",
      tag: "BIRCH DISPUTE",
      isTest,
      title: `Chargeback opened: ${money(dispute.amount ?? 0, cur)} · ${session?.metadata?.brand ?? session?.customer_details?.email ?? dispute.id}`,
      rows: [
        ["Amount", money(dispute.amount ?? 0, cur)],
        ["Reason", dispute.reason],
        ["Respond by", dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toLocaleString("en-CA", { timeZone: "America/Toronto" }) + " ET" : undefined],
        ["Campaign", campaignId ? "paused until resolved" : "no order found"],
        ["Stripe dispute", dispute.id],
        ["Stripe session", session?.id],
      ],
    }).catch(() => undefined);
    return session ? "applied" : "no_order";
  } catch (error) {
    logger.warn({ dispute: dispute?.id, err: error instanceof Error ? error.message : String(error) }, "Dispute handling failed (webhook still 2xx)");
    return "error";
  }
}
