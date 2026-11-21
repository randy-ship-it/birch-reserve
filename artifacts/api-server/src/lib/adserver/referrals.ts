/**
 * Referral attribution ledger (Randy, Nov 21 2026 4:07 PM: "Monica's and other QR codes need to track clicks through BR's site /
 * checkout and Scale's all the same for when people buy ads so that we can pay them out commission rates").
 *
 * Flow: QR / link (?st=<member>&qr=<label>) → first-party 30-day last-click state (promoBoxJs) → x-br-attr header / br_st cookie →
 * Checkout Session metadata (st, st_qr, promo, site) → Stripe webhook → draftCampaignFromCheckoutSafe → afterOrderCampaign → here:
 * the order (campaign) is stamped with referrer / referrer_qr / referrer_site and one ad_referral_orders row is written per paid
 * session (idempotent on session_id). Commission lines come from payoutSplit.splitReferralOrders. Real rows only, nothing modelled.
 */
import type Stripe from "stripe";
import { channelOf, type Channel, type ReferralOrderLine } from "./payoutSplit";
import { db, S, audit } from "./store";
import { QR_RE } from "./promoContext";

export type ReferralOrder = {
  id: number; sessionId: string; campaignId: string | null; member: string; qr: string | null; code: string | null; site: "birch" | "scale";
  amountCents: number; currency: string; orderKind: string | null; brand: string | null; isTest: boolean; paidAt: Date;
  /** The order's channel now (campaign seller / internal flag), which decides the override pool. */
  channel: Channel;
};

const toOrder = (r: Record<string, unknown>): ReferralOrder => ({
  id: Number(r.id), sessionId: String(r.session_id), campaignId: (r.campaign_id as string) ?? null, member: String(r.member), qr: (r.qr as string) ?? null,
  code: (r.code as string) ?? null, site: r.site === "scale" ? "scale" : "birch", amountCents: Number(r.amount_cents), currency: String(r.currency),
  orderKind: (r.order_kind as string) ?? null, brand: ((r.c_brand ?? r.brand) as string) ?? null, isTest: Boolean(r.is_test), paidAt: new Date(String(r.paid_at)),
  channel: channelOf((r.seller as string) ?? "birch", Boolean(r.internal)),
});

/** Stamp the order and write its referral row. Idempotent (webhook retries, thank-you page reconcile). Returns true when newly written. */
export async function recordReferralOrder(session: Stripe.Checkout.Session, campaign: { id: string; brand: string; orderKind?: string | null }, member: string, isTest: boolean): Promise<boolean> {
  const md = session.metadata ?? {};
  const qr = typeof md.st_qr === "string" && QR_RE.test(md.st_qr) ? md.st_qr : null;
  const site = md.site === "scale" ? "scale" : "birch";
  const code = typeof md.promo === "string" && /^[A-Za-z0-9 _-]{2,40}$/.test(md.promo) ? md.promo.toUpperCase() : null;
  const p = await db();
  await p.query(`UPDATE ${S()}.ad_campaigns SET referrer = $2, referrer_qr = $3, referrer_site = $4, updated_at = now() WHERE id = $1 AND referrer IS NULL`, [campaign.id, member, qr, site]);
  const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const { rows } = await p.query(
    `INSERT INTO ${S()}.ad_referral_orders (session_id, campaign_id, member, qr, code, site, amount_cents, currency, order_kind, brand, is_test, paid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (session_id) DO NOTHING RETURNING id`,
    [session.id, campaign.id, member, qr, code, site, session.amount_total ?? 0, (session.currency ?? "usd").toLowerCase(), campaign.orderKind ?? (md.kind as string) ?? null, campaign.brand.slice(0, 160), isTest, paidAt.toISOString()],
  );
  if (rows[0]) await audit("stripe-webhook", "referral.order", session.id, `${member}${qr ? ` qr=${qr}` : ""} site=${site} ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency ?? "usd").toUpperCase()} campaign=${campaign.id}`);
  return Boolean(rows[0]);
}

/** Referral orders (newest first), with each order's channel from its campaign right now. */
export async function listReferralOrders(opts: { since?: Date; testOnly?: boolean; includeTest?: boolean; limit?: number } = {}): Promise<ReferralOrder[]> {
  const p = await db();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.testOnly) where.push("r.is_test = true");
  else if (!opts.includeTest) where.push("r.is_test = false");
  if (opts.since) {
    params.push(opts.since.toISOString());
    where.push(`r.paid_at >= $${params.length}`);
  }
  params.push(opts.limit ?? 5000);
  const { rows } = await p.query(
    `SELECT r.*, c.seller, c.internal, c.brand AS c_brand FROM ${S()}.ad_referral_orders r LEFT JOIN ${S()}.ad_campaigns c ON c.id = r.campaign_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.paid_at DESC, r.id DESC LIMIT $${params.length}`,
    params,
  );
  return rows.map(toOrder);
}

export const toLine = (o: ReferralOrder): ReferralOrderLine => ({ sessionId: o.sessionId, campaignId: o.campaignId, member: o.member, at: o.paidAt, currency: o.currency, amountMicros: o.amountCents * 10_000, channel: o.channel });
