/**
 * Paid seat checkout (Stripe webhook, metadata.kind = "category_seat") -> Friday
 * intake with paid=true (Friday moves the deal to "Hold $190" / "Reserved $490")
 * + an instant RESERVATION alert. Never throws: Stripe always gets its 2xx.
 */
import { sendIntakeAndAlert } from "../overhaul/fridayIntake";

type SessionLike = {
  id: string;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null; name?: string | null; phone?: string | null } | null;
  metadata?: Record<string, string> | null;
  livemode?: boolean;
};

export function isSeatSession(session: SessionLike): boolean {
  return session.metadata?.kind === "category_seat";
}

export async function recordPaidSeatSafe(session: SessionLike): Promise<void> {
  try {
    if (!isSeatSession(session) || session.payment_status !== "paid") return;
    const m = session.metadata ?? {};
    const email = session.customer_details?.email ?? session.customer_email ?? undefined;
    await sendIntakeAndAlert(
      {
        kind: "seat_paid",
        // Same externalId as the original request so Friday upgrades that seat unit.
        externalId: m.intake_external_id || undefined,
        value: typeof session.amount_total === "number" ? session.amount_total / 100 : undefined,
        currency: session.currency ?? undefined,
        email: email ?? undefined,
        name: session.customer_details?.name ?? undefined,
        phone: session.customer_details?.phone ?? undefined,
        company: m.brand,
        website: m.website || undefined,
        path: "/buycalc",
        meta: {
          category: m.category,
          category_label: m.category_label,
          sku: m.sku,
          amount: typeof session.amount_total === "number" ? session.amount_total / 100 : undefined,
          currency: session.currency ?? undefined,
          seat_action: m.sku === "reserve-490" ? "lock" : "hold",
          paid: true,
          stripe_session_id: session.id,
          order_id: session.id,
          livemode: session.livemode,
          is_test: m.is_test === "true" || session.livemode === false || undefined,
        },
      },
      { checkout: `PAID (Stripe ${session.livemode ? "live" : "test"} ${session.id})` },
    );
  } catch {
    /* never throw from the webhook */
  }
}
