/**
 * Paid Stripe checkout → Friday (Emma 7:21pm).
 *
 * On checkout.session.completed (paid) the webhook calls recordPaidCheckoutSafe(session):
 *   - loads the splash reservation named in session.metadata.reservationId
 *   - upserts ONE leads row `checkout:<reservationId>` (source checkout) with
 *       meta { sku, paid: true, stripe_session_id, category?, value 190|490 }
 *       tags (via fridayPush) birch:hold-190 | birch:reserve-490
 *   - Friday externalId: the visitor's prior real lead (same email) when there is one,
 *     so Friday updates that contact/deal; otherwise birch-checkout-<reservationId>.
 *   - Idempotent per session: a repeat delivery upserts the same row with the same values
 *     (no change), and a lead already `sent` is never re-claimed.
 *   - is_test (reservation.is_test, qa+ email, QA Test / Pulse Probe name): stored, never pushed.
 * Never throws: every error is caught and logged so Stripe always gets its 2xx.
 */
import type Stripe from "stripe";
import { logger } from "./logger";
import { getLeadStore, upsertLeadSafeDetailed, type Lead } from "./leads";
import { SKU_VALUE, fridayExternalId, queueFridayPush } from "./fridayPush";
import { isTestIdentity } from "./testTraffic";

export type CheckoutReservation = {
  id: string;
  email: string;
  brandName: string | null;
  offerKey: string;
  isTest: boolean;
};

export type CheckoutLeadDeps = {
  loadReservation: (id: string) => Promise<CheckoutReservation | undefined>;
  queuePush: (leadId: string) => void;
};

const defaultDeps: CheckoutLeadDeps = {
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
      })
      .from(splashAdReservationsTable)
      .where(eq(splashAdReservationsTable.id, id));
    return row ? { ...row, id: String(row.id) } : undefined;
  },
  queuePush: queueFridayPush,
};

let deps: CheckoutLeadDeps = defaultDeps;
export function setCheckoutLeadDepsForTests(next: Partial<CheckoutLeadDeps> | null): void {
  deps = next ? { ...defaultDeps, ...next } : defaultDeps;
}

export type CheckoutLeadOutcome =
  | { status: "recorded"; leadId: string; externalId: string; isTest: boolean; created: boolean }
  | { status: "ignored"; reason: string }
  | { status: "error"; error: string };

export async function recordPaidCheckoutSafe(session: Stripe.Checkout.Session): Promise<CheckoutLeadOutcome> {
  try {
    if (session.payment_status !== "paid") return { status: "ignored", reason: "not_paid" };
    const reservationId = session.metadata?.["reservationId"];
    if (!reservationId) return { status: "ignored", reason: "no_reservation" };
    const reservation = await deps.loadReservation(reservationId);
    if (!reservation) return { status: "ignored", reason: "reservation_not_found" };

    const email = (reservation.email || session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
    const skuRaw = session.metadata?.["sku"] || reservation.offerKey;
    const sku = SKU_VALUE[skuRaw] !== undefined ? skuRaw : undefined;
    const isTest =
      reservation.isTest || isTestIdentity({ email: email || null, name: reservation.brandName ?? null });

    const prior: Lead | undefined = !isTest && email ? await getLeadStore().findPriorByEmail(email) : undefined;
    const externalId = prior ? fridayExternalId(prior) : `birch-checkout-${reservationId}`;
    const leadId = `checkout:${reservationId}`;

    const res = await upsertLeadSafeDetailed({
      id: leadId,
      source: "checkout",
      sourceRef: session.id,
      email: email || undefined,
      company: reservation.brandName ?? undefined,
      name: prior?.name ?? undefined,
      phone: prior?.phone ?? undefined,
      need: `Paid Birch Reserve ${sku ?? "checkout"}`,
      isTest,
      meta: {
        paid: true,
        stripe_session_id: session.id,
        friday_external_id: externalId,
        ...(sku ? { sku, value: SKU_VALUE[sku] } : {}),
        ...(prior?.meta.category ? { category: prior.meta.category } : {}),
        ...(prior?.meta.hubs ? { hubs: prior.meta.hubs } : {}),
      },
      ...(prior
        ? {
            utmSource: prior.utmSource,
            utmMedium: prior.utmMedium,
            utmCampaign: prior.utmCampaign,
            referrer: prior.referrer,
            landingPage: prior.landingPage,
          }
        : {}),
    });
    if (!res) return { status: "error", error: "lead_upsert_failed" };
    if (!isTest) deps.queuePush(res.lead.id);
    logger.info(
      { reservationId, stripeSession: session.id, leadId, externalId, isTest, created: res.created },
      isTest ? "Paid checkout recorded (is_test: no Friday push)" : "Paid checkout queued for Friday",
    );
    return { status: "recorded", leadId, externalId, isTest, created: res.created };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "checkout_lead_failed";
    logger.warn({ stripeSession: session?.id, err: msg }, "Paid checkout → Friday failed (webhook still 2xx)");
    return { status: "error", error: msg.slice(0, 200) };
  }
}
