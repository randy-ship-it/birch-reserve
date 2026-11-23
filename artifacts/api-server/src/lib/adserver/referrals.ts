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
  /** card = Stripe Checkout; eft = e-transfer / wire / invoice recorded by an admin. */
  method: "card" | "eft";
  status: "paid" | "pending";
  paidRef: string | null;
  buyerEmail: string | null;
  /** link = this visit's link / QR; first_touch = credited from the buyer's first earlier visit (email or company domain). */
  via: string | null;
};

const toOrder = (r: Record<string, unknown>): ReferralOrder => ({
  id: Number(r.id), sessionId: String(r.session_id), campaignId: (r.campaign_id as string) ?? null, member: String(r.member), qr: (r.qr as string) ?? null,
  code: (r.code as string) ?? null, site: r.site === "scale" ? "scale" : "birch", amountCents: Number(r.amount_cents), currency: String(r.currency),
  orderKind: (r.order_kind as string) ?? null, brand: ((r.c_brand ?? r.brand) as string) ?? null, isTest: Boolean(r.is_test), paidAt: new Date(String(r.paid_at)),
  channel: channelOf((r.seller as string) ?? "birch", Boolean(r.internal)),
  method: r.method === "eft" ? "eft" : "card", status: r.status === "pending" ? "pending" : "paid", paidRef: (r.paid_ref as string) ?? null, buyerEmail: (r.buyer_email as string) ?? null, via: (r.via as string) ?? null,
});

/** Stamp the order and write its referral row. Idempotent (webhook retries, thank-you page reconcile). Returns true when newly written. */
export async function recordReferralOrder(session: Stripe.Checkout.Session, campaign: { id: string; brand: string; orderKind?: string | null }, member: string, isTest: boolean, via?: { touchQr: string | null; touchSite: "birch" | "scale"; email: string }): Promise<boolean> {
  const md = session.metadata ?? {};
  const qr = via ? via.touchQr : typeof md.st_qr === "string" && QR_RE.test(md.st_qr) ? md.st_qr : null;
  const site = md.site === "scale" ? "scale" : "birch";
  const code = typeof md.promo === "string" && /^[A-Za-z0-9 _-]{2,40}$/.test(md.promo) ? md.promo.toUpperCase() : null;
  const p = await db();
  await p.query(`UPDATE ${S()}.ad_campaigns SET referrer = $2, referrer_qr = $3, referrer_site = $4, updated_at = now() WHERE id = $1 AND referrer IS NULL`, [campaign.id, member, qr, site]);
  const paidAt = new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000);
  const { rows } = await p.query(
    `INSERT INTO ${S()}.ad_referral_orders (session_id, campaign_id, member, qr, code, site, amount_cents, currency, order_kind, brand, is_test, paid_at, method, buyer_email, via)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'card',$13,$14) ON CONFLICT (session_id) DO NOTHING RETURNING id`,
    [session.id, campaign.id, member, qr, code, site, session.amount_total ?? 0, (session.currency ?? "usd").toLowerCase(), campaign.orderKind ?? (md.kind as string) ?? null, campaign.brand.slice(0, 160), isTest, paidAt.toISOString(), via?.email || (session.customer_details?.email || session.customer_email || "").toLowerCase() || null, via ? "first_touch" : "link"],
  );
  if (rows[0]) await audit("stripe-webhook", "referral.order", session.id, `${member}${qr ? ` qr=${qr}` : ""} site=${site} ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency ?? "usd").toUpperCase()} campaign=${campaign.id}`);
  return Boolean(rows[0]);
}

/** Referral orders (newest first), with each order's channel from its campaign right now. */
export async function listReferralOrders(opts: { since?: Date; testOnly?: boolean; includeTest?: boolean; limit?: number; includePending?: boolean } = {}): Promise<ReferralOrder[]> {
  const p = await db();
  const where: string[] = opts.includePending ? [] : ["r.status = 'paid'"];
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

/* ---------------------------------------------------------------------------- first touch (buyer email / company domain) */
const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "yahoo.ca", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "msn.com"]);
const cleanEmail = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 254) : "");
/** touch keys for a buyer: their exact email, and their company domain (never a free-mail domain, never a website we don't know). */
export function touchKeys(email: unknown, website?: string | null): string[] {
  const e = cleanEmail(email);
  const keys: string[] = [];
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    keys.push(`e:${e}`);
    const d = e.split("@")[1]!;
    if (!FREE_MAIL.has(d)) keys.push(`d:${d.replace(/^www\./, "")}`);
  }
  const w = (website ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0]!.toLowerCase().slice(0, 120);
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(w) && !FREE_MAIL.has(w)) keys.push(`d:${w}`);
  return [...new Set(keys)];
}

/** First touch wins: the first time a referred visitor submits intake with this email / domain, the referrer is remembered. Never overwritten. */
export async function recordFirstTouch(member: string, qr: string | null, site: "birch" | "scale", email: unknown, website: string | null, isTest: boolean): Promise<number> {
  const p = await db();
  let n = 0;
  for (const k of touchKeys(email, website)) {
    const { rows } = await p.query(
      `INSERT INTO ${S()}.ad_referral_touch (touch_key, kind, member, qr, site, is_test) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (touch_key) DO NOTHING RETURNING touch_key`,
      [k, k[0] === "e" ? "email" : "domain", member, qr && QR_RE.test(qr) ? qr : null, site, isTest],
    );
    n += rows.length;
  }
  return n;
}

/** Referrer remembered for a buyer (email first, then company domain), or null. */
export async function firstTouchFor(email: unknown, website?: string | null): Promise<{ member: string; qr: string | null; site: "birch" | "scale"; key: string } | null> {
  const keys = touchKeys(email, website);
  if (!keys.length) return null;
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_referral_touch WHERE touch_key = ANY($1::text[]) AND member IN (SELECT id FROM ${S()}.ad_street_members WHERE active) ORDER BY (touch_key LIKE 'e:%') DESC, first_at LIMIT 1`, [keys]);
  const r = rows[0];
  return r ? { member: String(r.member), qr: (r.qr as string) ?? null, site: r.site === "scale" ? "scale" : "birch", key: String(r.touch_key) } : null;
}

/* ---------------------------------------------------------------------------- EFT / invoice orders (admin recorded) */
export type EftInput = { ref: string; brand: string; email: string; website?: string | null; amountCents: number; currency: "usd" | "cad"; member?: string | null; qr?: string | null; site?: "birch" | "scale"; campaignId?: string | null; orderKind?: string | null; isTest?: boolean };

/**
 * Record an EFT / invoice order as PENDING, stamped with its referrer: the one named on the insertion order (member), else the
 * buyer's first touch (email, then company domain). Commission is not owed until markEftPaid. Idempotent on ref.
 */
export async function recordEftOrder(i: EftInput, actor: string): Promise<{ ok: true; member: string; qr: string | null; via: string; created: boolean } | { ok: false; message: string }> {
  const email = cleanEmail(i.email);
  let member = (i.member ?? "").trim().toLowerCase() || null;
  let qr = i.qr ?? null;
  let via = "io_ref";
  let site: "birch" | "scale" = i.site === "scale" ? "scale" : "birch";
  if (!member) {
    const t = await firstTouchFor(email, i.website);
    if (!t) return { ok: false, message: "No referrer on the insertion order and no earlier referred visit for this buyer's email or company. Nothing recorded." };
    member = t.member;
    qr = t.qr;
    site = i.site ?? t.site;
    via = "first_touch";
  }
  const p = await db();
  const m = await p.query(`SELECT 1 FROM ${S()}.ad_street_members WHERE id = $1 AND active`, [member]);
  if (!m.rows.length) return { ok: false, message: `Unknown or inactive referrer "${member}".` };
  if (!Number.isInteger(i.amountCents) || i.amountCents <= 0) return { ok: false, message: "Amount must be a positive number." };
  const sid = `eft:${i.ref.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 60)}`;
  const { rows } = await p.query(
    `INSERT INTO ${S()}.ad_referral_orders (session_id, campaign_id, member, qr, code, site, amount_cents, currency, order_kind, brand, is_test, paid_at, status, method, buyer_email, via)
     VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,now(),'pending','eft',$11,$12) ON CONFLICT (session_id) DO NOTHING RETURNING id`,
    [sid, i.campaignId ?? null, member, qr, site, i.amountCents, i.currency, i.orderKind ?? "eft", i.brand.slice(0, 160), Boolean(i.isTest), email || null, via],
  );
  if (rows[0]) await audit(actor, "referral.eft_recorded", sid, `${member}${qr ? ` qr=${qr}` : ""} via=${via} ${(i.amountCents / 100).toFixed(2)} ${i.currency.toUpperCase()} ${i.brand} (pending until paid)`);
  if (i.campaignId && rows[0]) await p.query(`UPDATE ${S()}.ad_campaigns SET referrer = $2, referrer_qr = $3, referrer_site = $4, updated_at = now() WHERE id = $1 AND referrer IS NULL`, [i.campaignId, member, qr, site]);
  return { ok: true, member, qr, via, created: Boolean(rows[0]) };
}

/** Admin marks an EFT order paid (money arrived outside Stripe). The order then counts for the referrer's commission lines. No money moves here. */
export async function markEftPaid(ref: string, paidRef: string, actor: string): Promise<{ ok: boolean; message: string }> {
  const sid = ref.startsWith("eft:") ? ref : `eft:${ref.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 60)}`;
  const p = await db();
  const { rows } = await p.query(`UPDATE ${S()}.ad_referral_orders SET status = 'paid', paid_ref = $2, paid_at = now() WHERE session_id = $1 AND method = 'eft' AND status = 'pending' RETURNING member, amount_cents`, [sid, paidRef.slice(0, 120)]);
  if (!rows[0]) {
    const done = await p.query(`SELECT 1 FROM ${S()}.ad_referral_orders WHERE session_id = $1 AND status = 'paid'`, [sid]);
    return { ok: done.rows.length > 0, message: done.rows.length ? "Already marked paid." : "No pending EFT order with that reference." };
  }
  await audit(actor, "referral.eft_paid", sid, `${rows[0].member} ${(Number(rows[0].amount_cents) / 100).toFixed(2)} ref=${paidRef}`);
  return { ok: true, message: `Marked paid. ${rows[0].member}'s commission line is now calculated (approve it in Money → Payouts).` };
}
