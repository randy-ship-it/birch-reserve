/**
 * Promo codes for free ad credit + street team attribution.
 * A code grants AD SPEND ONLY credit: no cash value, non-transferable, one redemption per business (email and company domain).
 * Credit is never a Stripe discount: it lands on the ad ledger (bonus credit on the order's campaign when that is USD,
 * otherwise its own USD promo campaign), so the Stripe price a customer pays is never reduced.
 * Everything shown in admin comes from rows written here. Nothing is modelled.
 */
import type Stripe from "stripe";
import { createHmac, randomBytes } from "node:crypto";
import { MICROS, PROMO_RATE_BPS, regularRateSummary } from "./config";
import { MEMBER_RE } from "./promoContext";
import * as store from "./store";
import { db, S, audit } from "./store";
import { isTestIdentity } from "../testTraffic";
import { firstTouchFor, recordFirstTouch, recordReferralOrder } from "./referrals";

export const normKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Spoken forms: "street team hundred" and "street team 100" normalise to the same key. */
const SPOKEN: Record<string, string> = { streetteamhundred: "street100", streetteamonehundred: "street100", streetteam100: "street100", streethundred: "street100", streetonehundred: "street100" };

export type PromoCode = { codeKey: string; code: string; creditMicros: number; currency: string; maxRedemptions: number | null; active: boolean; expiresAt: Date | null; createdBy: string | null; notes: string | null; createdAt: Date; used: number };
export type Redemption = { id: number; codeKey: string; email: string; company: string | null; site: string; st: string | null; src: string | null; sessionId: string | null; campaignId: string | null; creditMicros: number; status: string; isTest: boolean; createdAt: Date; appliedAt: Date | null };

const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "yahoo.ca", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "msn.com", "rogers.com", "bell.net", "shaw.ca", "telus.net", "sympatico.ca", "gmx.com"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmail = (v: unknown): string => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 254) : "");
export const validEmail = (v: string): boolean => EMAIL_RE.test(v);
const domainKeyOf = (email: string): string | null => {
  const d = email.split("@")[1] ?? "";
  return !d || FREE_MAIL.has(d) ? null : d;
};
const usd = (micros: number) => `$${Math.round(micros / MICROS).toLocaleString("en-US")}`;
export const creditLabel = (micros: number) => `${usd(micros)} ad credit`;

function toCode(r: Record<string, unknown>): PromoCode {
  return {
    codeKey: String(r.code_key), code: String(r.code), creditMicros: Number(r.credit_micros), currency: String(r.currency), maxRedemptions: r.max_redemptions == null ? null : Number(r.max_redemptions),
    active: Boolean(r.active), expiresAt: r.expires_at ? new Date(String(r.expires_at)) : null, createdBy: (r.created_by as string) ?? null, notes: (r.notes as string) ?? null,
    createdAt: new Date(String(r.created_at)), used: Number(r.used ?? 0),
  };
}
function toRed(r: Record<string, unknown>): Redemption {
  return {
    id: Number(r.id), codeKey: String(r.code_key), email: String(r.email), company: (r.company as string) ?? null, site: String(r.site), st: (r.st as string) ?? null, src: (r.src as string) ?? null,
    sessionId: (r.session_id as string) ?? null, campaignId: (r.campaign_id as string) ?? null, creditMicros: Number(r.credit_micros), status: String(r.status), isTest: Boolean(r.is_test),
    createdAt: new Date(String(r.created_at)), appliedAt: r.applied_at ? new Date(String(r.applied_at)) : null,
  };
}
const CODE_SELECT = (s: string) => `SELECT c.*, (SELECT count(*) FROM ${s}.ad_promo_redemptions r WHERE r.code_key = c.code_key AND r.status <> 'void') AS used FROM ${s}.ad_promo_codes c`;

/** Opaque per-member link token for NEW street-team URLs (?c=...). The server maps it to the street credit; the code string never appears in a URL. */
let tokenSecret: string | null = null;
const secretOf = (): string => (tokenSecret ??= process.env.SESSION_SECRET?.trim() || randomBytes(32).toString("hex"));
export const memberToken = (member: string): string => "sc" + createHmac("sha256", secretOf()).update(`street-link:${member}`).digest("hex").slice(0, 12);
const TOKEN_RE = /^sc[0-9a-f]{12}$/;
async function tokenOwner(k0: string): Promise<string | null> {
  if (!TOKEN_RE.test(k0)) return null;
  const p = await db();
  const { rows } = await p.query(`SELECT id FROM ${S()}.ad_street_members WHERE active`);
  for (const r of rows) if (memberToken(String(r.id)) === k0) return String(r.id);
  return null;
}

export async function findCode(input: string): Promise<PromoCode | null> {
  const k0 = normKey(input);
  if (!k0 || k0.length > 40) return null;
  const k = (await tokenOwner(k0)) ? "street100" : (SPOKEN[k0] ?? k0);
  const p = await db();
  const { rows } = await p.query(`${CODE_SELECT(S())} WHERE c.code_key = $1 OR $1 = ANY (c.aliases)`, [k]);
  return rows[0] ? toCode(rows[0]) : null;
}

export type CodeProblem = "unknown" | "inactive" | "expired" | "exhausted" | "already";
export const PROBLEM_COPY: Record<CodeProblem, string> = {
  unknown: "We don't recognise that code. Check the spelling, or keep going without it. You can add a code later from your account.",
  inactive: "That code is no longer active. You can keep going without it.",
  expired: "That code has expired. You can keep going without it.",
  exhausted: "That code has been fully claimed. You can keep going without it.",
  already: "A credit from this code is already on your business. Each business can use it once.",
};
export function codeProblem(c: PromoCode | null, now = new Date()): CodeProblem | null {
  if (!c) return "unknown";
  if (!c.active) return "inactive";
  if (c.expiresAt && c.expiresAt <= now) return "expired";
  if (c.maxRedemptions !== null && c.used >= c.maxRedemptions) return "exhausted";
  return null;
}

/** Existing live redemption by this email or this business domain (test identities skip the domain rule). */
async function existing(codeKey: string, email: string): Promise<Redemption | null> {
  const p = await db();
  const dk = isTestIdentity({ email }) ? null : domainKeyOf(email);
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_promo_redemptions WHERE code_key = $1 AND status <> 'void' AND (email = $2 OR ($3::text IS NOT NULL AND domain_key = $3)) LIMIT 1`, [codeKey, email, dk]);
  return rows[0] ? toRed(rows[0]) : null;
}

export type ValidateResult = { ok: true; code: string; creditUsd: number; label: string; message: string } | { ok: false; reason: CodeProblem; message: string };
export async function validateCode(input: string, email?: string): Promise<ValidateResult> {
  const c = await findCode(input);
  const bad = codeProblem(c) ?? (c && c.codeKey.startsWith("internal") ? "unknown" : null);
  if (bad) return { ok: false, reason: bad, message: PROBLEM_COPY[bad] };
  if (email && validEmail(email) && (await existing(c!.codeKey, email))) return { ok: false, reason: "already", message: PROBLEM_COPY.already };
  const label = creditLabel(c!.creditMicros);
  return { ok: true, code: c!.code, creditUsd: c!.creditMicros / MICROS, label, message: `${c!.codeKey === "street100" ? "Code applied — $100 media credit. Use it to test the shelf after the receipt. " : `Code accepted: ${label}. `}Ad spend only, no cash value, not transferable. ${regularRateSummary().line}` };
}

/* ------------------------------------------------------------------------------------------ street team */
let memberCache: { at: number; ids: Map<string, string> } | null = null;
export function resetMemberCache(): void {
  memberCache = null;
}
export async function members(): Promise<Array<{ id: string; label: string; active: boolean; createdAt: Date }>> {
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_street_members ORDER BY created_at, id`);
  return rows.map((r) => ({ id: String(r.id), label: String(r.label), active: Boolean(r.active), createdAt: new Date(String(r.created_at)) }));
}
/** Registered, active member id (lowercase) or null. Public callers only ever see name-only ids. */
export async function resolveMember(raw: unknown): Promise<string | null> {
  const id = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!MEMBER_RE.test(id)) return null;
  if (!memberCache || Date.now() - memberCache.at > 30_000) {
    memberCache = { at: Date.now(), ids: new Map((await members()).filter((m) => m.active).map((m) => [m.id, m.label])) };
  }
  return memberCache.ids.has(id) ? id : null;
}
export async function memberLabel(id: string | null): Promise<string | null> {
  if (!id) return null;
  return (await members()).find((m) => m.id === id)?.label ?? null;
}
export async function createMember(id: string, label: string, actor: string): Promise<{ ok: boolean; message: string }> {
  const k = id.trim().toLowerCase();
  if (!MEMBER_RE.test(k)) return { ok: false, message: "Member id: 2-32 characters, letters, numbers, dash or underscore. Name only, no email or phone." };
  const p = await db();
  const { rows } = await p.query(`INSERT INTO ${S()}.ad_street_members (id, label, created_by) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET active = true RETURNING id`, [k, (label || k).slice(0, 60), actor]);
  resetMemberCache();
  await audit(actor, "street.member", k, label);
  return { ok: rows.length > 0, message: `Member ${k} is ready.` };
}

export type StreetKind = "visit" | "scan" | "intake" | "redeem" | "order";
export async function streetEvent(e: { member: string; kind: StreetKind; qr?: string | null; site?: string | null; ref?: string | null; amountCents?: number | null; currency?: string | null; isTest?: boolean; dedupeKey?: string | null }): Promise<boolean> {
  const p = await db();
  const { rows } = await p.query(
    `INSERT INTO ${S()}.ad_street_events (member, kind, qr, site, ref, amount_cents, currency, is_test, dedupe_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`,
    [e.member, e.kind, e.qr ?? null, e.site ?? null, e.ref ?? null, e.amountCents ?? null, e.currency ?? null, e.isTest ?? false, e.dedupeKey ?? null],
  );
  return rows.length > 0;
}

export type StreetRow = { id: string; label: string; active: boolean; visits: number; scans: number; byQr: Record<string, number>; intakes: number; redemptions: number; applied: number; orders: number; revenue: Array<{ currency: string; cents: number }>; creditMicros: number };
export async function streetStats(includeTest = false): Promise<StreetRow[]> {
  const p = await db();
  const ms = await members();
  const t = includeTest ? "" : "AND is_test = false";
  const { rows: ev } = await p.query(`SELECT member, kind, qr, count(*)::int AS n, coalesce(sum(amount_cents),0)::bigint AS cents, currency FROM ${S()}.ad_street_events WHERE true ${t} GROUP BY member, kind, qr, currency`);
  const { rows: rd } = await p.query(`SELECT st AS member, status, count(*)::int AS n, coalesce(sum(credit_micros),0)::bigint AS micros FROM ${S()}.ad_promo_redemptions WHERE st IS NOT NULL ${t} GROUP BY st, status`);
  return ms.map((m) => {
    const row: StreetRow = { id: m.id, label: m.label, active: m.active, visits: 0, scans: 0, byQr: {}, intakes: 0, redemptions: 0, applied: 0, orders: 0, revenue: [], creditMicros: 0 };
    for (const r of ev) {
      if (r.member !== m.id) continue;
      const n = Number(r.n);
      if (r.kind === "visit") row.visits += n;
      else if (r.kind === "scan") (row.scans += n), (row.byQr[String(r.qr ?? "qr")] = (row.byQr[String(r.qr ?? "qr")] ?? 0) + n);
      else if (r.kind === "intake") row.intakes += n;
      else if (r.kind === "order") {
        row.orders += n;
        if (r.currency) row.revenue.push({ currency: String(r.currency), cents: Number(r.cents) });
      }
    }
    for (const r of rd) {
      if (r.member !== m.id || r.status === "void") continue;
      row.redemptions += Number(r.n);
      if (r.status === "applied") (row.applied += Number(r.n)), (row.creditMicros += Number(r.micros));
    }
    return row;
  });
}

export type QrRow = { member: string; label: string; site: string; url: string; createdAt: Date };
export async function listQrs(): Promise<QrRow[]> {
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_street_qrs ORDER BY member, created_at`);
  return rows.map((r) => ({ member: String(r.member), label: String(r.label), site: String(r.site), url: String(r.url), createdAt: new Date(String(r.created_at)) }));
}
const SITE_BASE = { birch: "https://birchreserve.net/intake", scale: "https://scalehealth.ca/intake" } as const;
/** Shareable link: prefilled code + member. qr=1 marks a QR scan (vs a pasted link). */
export function shareUrl(member: string, site: "birch" | "scale", code: string | null = null, qrLabel: string | null = "qr"): string {
  // New links carry an opaque per-member token (?c=), never the code itself. An explicit code (legacy / one-off) is still honoured.
  const q = new URLSearchParams(code ? { code, st: member } : { c: memberToken(member), st: member });
  if (qrLabel) q.set("qr", qrLabel);
  return `${SITE_BASE[site]}?${q.toString()}`;
}
export async function registerQr(member: string, label: string, site: "birch" | "scale", url: string, actor: string): Promise<boolean> {
  const p = await db();
  const { rows } = await p.query(`INSERT INTO ${S()}.ad_street_qrs (member, label, site, url, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (member, label) DO UPDATE SET url = EXCLUDED.url, site = EXCLUDED.site RETURNING id`, [member, label.slice(0, 60), site, url.slice(0, 500), actor]);
  await audit(actor, "street.qr", `${member}/${label}`, url);
  return rows.length > 0;
}

/* ------------------------------------------------------------------------------------------ redemptions */
export type ClaimInput = { code: string; email: string; company?: string | null; site?: "birch" | "scale"; st?: string | null; src?: string | null; sessionId?: string | null };
export type ClaimResult = { ok: true; redemption: Redemption; created: boolean; label: string } | { ok: false; reason: CodeProblem; message: string };

/** Idempotent per email: a repeat returns the existing redemption. Stores a pending credit tied to the email. */
export async function claimCode(i: ClaimInput): Promise<ClaimResult> {
  const email = cleanEmail(i.email);
  const c = await findCode(i.code);
  const bad = codeProblem(c) ?? (c && c.codeKey.startsWith("internal") && i.src !== "hub-proof" ? "unknown" : null);
  if (bad) return { ok: false, reason: bad, message: PROBLEM_COPY[bad] };
  const p = await db();
  const mine = await p.query(`SELECT * FROM ${S()}.ad_promo_redemptions WHERE code_key = $1 AND email = $2 AND status <> 'void'`, [c!.codeKey, email]);
  if (mine.rows[0]) return { ok: true, redemption: toRed(mine.rows[0]), created: false, label: creditLabel(c!.creditMicros) };
  if (await existing(c!.codeKey, email)) return { ok: false, reason: "already", message: PROBLEM_COPY.already };
  const st = await resolveMember(i.st);
  const test = isTestIdentity({ email });
  const ins = await p.query(
    `INSERT INTO ${S()}.ad_promo_redemptions (code_key, email, domain_key, company, site, st, src, session_id, credit_micros, is_test) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING *`,
    [c!.codeKey, email, test ? null : domainKeyOf(email), i.company ? i.company.slice(0, 160) : null, i.site === "scale" ? "scale" : "birch", st, i.src ? i.src.slice(0, 60) : null, i.sessionId ?? null, c!.creditMicros, test],
  );
  if (!ins.rows[0]) return { ok: false, reason: "already", message: PROBLEM_COPY.already };
  const red = toRed(ins.rows[0]);
  await audit(st ? `street:${st}` : "visitor", "promo.claim", c!.codeKey, `${email} site=${red.site}${red.src ? ` src=${red.src}` : ""}`);
  if (st) await streetEvent({ member: st, kind: "redeem", site: red.site, ref: `red:${red.id}`, isTest: test, dedupeKey: `redeem:${red.id}` });
  return { ok: true, redemption: red, created: true, label: creditLabel(c!.creditMicros) };
}

/** Apply a pending credit: bonus on the order's ledger when the campaign is USD, else its own USD promo campaign. */
async function applyRedemption(r: Redemption, campaign: { id: string; currency: string; brand: string } | null, sessionId: string | null, actor: string): Promise<{ campaignId: string | null; applied: boolean }> {
  const p = await db();
  const lock = await p.query(`UPDATE ${S()}.ad_promo_redemptions SET status = 'applied', applied_at = now(), session_id = coalesce(session_id, $2) WHERE id = $1 AND status = 'pending' RETURNING id`, [r.id, sessionId]);
  if (!lock.rows[0]) return { campaignId: r.campaignId, applied: false };
  const note = `Promo ${r.codeKey.toUpperCase()}: free ad credit${r.st ? ` (street team ${r.st})` : ""}. Ad spend only.`;
  let campaignId: string | null = null;
  try {
    // Promo credit is its own credit source (own campaign, own ledger) so it can run at the regular rate while paid credit keeps its sold rate.
    const made = await store.createCampaign({
      accountEmail: r.email, brand: r.company || campaign?.brand || r.email.split("@")[1] || "Brand", orderRef: `promo:${r.id}`, orderKind: `promo ${r.codeKey.toUpperCase()}`,
      currency: "usd", budgetMicros: r.creditMicros, rateMultiplierBps: PROMO_RATE_BPS, isTest: r.isTest,
      notes: `${note}${sessionId ? ` Order ${sessionId}.` : ""} Charged at regular rate-card rates. Draft until a creative is approved.`, actor,
    });
    campaignId = made.campaign.id;
    await p.query(`UPDATE ${S()}.ad_promo_redemptions SET campaign_id = $2 WHERE id = $1`, [r.id, campaignId]);
    await audit(actor, "promo.applied", r.codeKey, `${r.email} ${usd(r.creditMicros)} campaign=${campaignId}${sessionId ? ` order=${sessionId}` : ""}`);
    return { campaignId, applied: true };
  } catch (err) {
    await p.query(`UPDATE ${S()}.ad_promo_redemptions SET status = 'pending', applied_at = NULL WHERE id = $1 AND campaign_id IS NULL`, [r.id]);
    throw err;
  }
}

/** First sign-in / account page: attach any pending credit for this email. */
export async function attachPendingForAccount(email: string, actor = "account"): Promise<number> {
  const p = await db();
  const { rows } = await p.query(`SELECT * FROM ${S()}.ad_promo_redemptions WHERE email = $1 AND status = 'pending'`, [cleanEmail(email)]);
  let n = 0;
  for (const row of rows) {
    const r = await applyRedemption(toRed(row), null, null, actor);
    if (r.applied) n += 1;
  }
  return n;
}

/** Paid order hook (webhook or thank-you page). Idempotent. Records street attribution and the order's promo line. */
export async function afterOrderCampaign(session: Stripe.Checkout.Session, campaign: { id: string; currency: string; brand: string; orderKind?: string | null }, isTest: boolean): Promise<void> {
  const md = session.metadata ?? {};
  const email = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
  const site = md.site === "scale" ? "scale" : "birch";
  let st = await resolveMember(md.st);
  let touch: { touchQr: string | null; touchSite: "birch" | "scale"; email: string } | undefined;
  if (!st && email) {
    // No referral on this checkout (different device, link lost): credit the referrer who first brought this buyer's email / company in.
    const t = await firstTouchFor(email, md.website ?? null).catch(() => null);
    if (t) {
      st = t.member;
      touch = { touchQr: t.qr, touchSite: t.site, email };
    }
  }
  if (st) {
    await streetEvent({ member: st, kind: "order", site, ref: session.id, amountCents: session.amount_total ?? 0, currency: session.currency ?? "usd", isTest, dedupeKey: `order:${session.id}` });
    // Commission basis: stamp the order with its referrer and write the referral row (referrals.ts). Never blocks the promo step.
    try {
      await recordReferralOrder(session, campaign, st, isTest, touch);
    } catch (err) {
      await audit("stripe-webhook", "referral.error", session.id, err instanceof Error ? err.message : String(err));
    }
  }
  if (!email) return;
  const p = await db();
  let { rows } = await p.query(`SELECT * FROM ${S()}.ad_promo_redemptions WHERE (session_id = $1 OR email = $2) AND status <> 'void' ORDER BY (session_id = $1) DESC NULLS LAST, id LIMIT 1`, [session.id, email]);
  if (!rows[0] && md.promo) {
    const c = await claimCode({ code: md.promo, email, company: md.brand ?? null, site, st, src: "checkout", sessionId: session.id });
    if (c.ok) rows = [{ ...c.redemption, code_key: c.redemption.codeKey, credit_micros: c.redemption.creditMicros, is_test: c.redemption.isTest, created_at: c.redemption.createdAt, session_id: c.redemption.sessionId, campaign_id: c.redemption.campaignId, applied_at: null }];
  }
  if (!rows[0]) return;
  const red = toRed(rows[0]);
  if (red.status === "pending") await applyRedemption(red, campaign, session.id, "stripe-webhook");
  else if (!red.sessionId) await p.query(`UPDATE ${S()}.ad_promo_redemptions SET session_id = $2 WHERE id = $1 AND session_id IS NULL`, [red.id, session.id]);
}

export async function redemptionForSession(sessionId: string): Promise<(Redemption & { code: string }) | null> {
  const p = await db();
  const { rows } = await p.query(`SELECT r.*, c.code FROM ${S()}.ad_promo_redemptions r JOIN ${S()}.ad_promo_codes c ON c.code_key = r.code_key WHERE r.session_id = $1 AND r.status = 'applied' LIMIT 1`, [sessionId]);
  return rows[0] ? { ...toRed(rows[0]), code: String(rows[0].code) } : null;
}
export async function redemptionForEmail(email: string): Promise<Array<Redemption & { code: string }>> {
  const p = await db();
  const { rows } = await p.query(`SELECT r.*, c.code FROM ${S()}.ad_promo_redemptions r JOIN ${S()}.ad_promo_codes c ON c.code_key = r.code_key WHERE r.email = $1 AND r.status <> 'void' ORDER BY r.id`, [cleanEmail(email)]);
  return rows.map((r) => ({ ...toRed(r), code: String(r.code) }));
}

/* ------------------------------------------------------------------------------------------ admin */
export async function listCodes(): Promise<PromoCode[]> {
  const p = await db();
  const { rows } = await p.query(`${CODE_SELECT(S())} ORDER BY c.created_at, c.code_key`);
  return rows.map(toCode);
}
export async function listRedemptions(limit = 500): Promise<Array<Redemption & { code: string; brand: string | null }>> {
  const p = await db();
  const { rows } = await p.query(
    `SELECT r.*, c.code, ca.brand FROM ${S()}.ad_promo_redemptions r JOIN ${S()}.ad_promo_codes c ON c.code_key = r.code_key LEFT JOIN ${S()}.ad_campaigns ca ON ca.id = r.campaign_id ORDER BY r.id DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ ...toRed(r), code: String(r.code), brand: (r.brand as string) ?? null }));
}
export async function saveCode(i: { code: string; creditUsd: number; maxRedemptions?: number | null; expiresAt?: Date | null; notes?: string | null; aliases?: string[] }, actor: string): Promise<{ ok: boolean; message: string }> {
  const display = i.code.trim().toUpperCase().replace(/[^A-Z0-9 _-]/g, "").slice(0, 40);
  const key = normKey(display);
  if (key.length < 4) return { ok: false, message: "Codes need at least 4 letters or numbers." };
  if (!(i.creditUsd > 0 && i.creditUsd <= 5000)) return { ok: false, message: "Credit must be between $1 and $5,000 USD." };
  const p = await db();
  const aliases = (i.aliases ?? []).map(normKey).filter((a) => a && a !== key);
  await p.query(
    `INSERT INTO ${S()}.ad_promo_codes (code_key, code, aliases, credit_micros, max_redemptions, expires_at, created_by, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (code_key) DO UPDATE SET credit_micros = EXCLUDED.credit_micros, max_redemptions = EXCLUDED.max_redemptions, expires_at = EXCLUDED.expires_at, notes = EXCLUDED.notes, aliases = EXCLUDED.aliases`,
    [key, display, aliases, Math.round(i.creditUsd * MICROS), i.maxRedemptions ?? null, i.expiresAt ? i.expiresAt.toISOString() : null, actor, i.notes?.slice(0, 300) ?? null],
  );
  await audit(actor, "promo.save", key, `${i.creditUsd} USD max=${i.maxRedemptions ?? "none"}`);
  return { ok: true, message: `Code ${display} saved: ${usd(i.creditUsd * MICROS)}.` };
}
export async function setCodeActive(codeKey: string, active: boolean, actor: string): Promise<boolean> {
  const p = await db();
  const { rows } = await p.query(`UPDATE ${S()}.ad_promo_codes SET active = $2 WHERE code_key = $1 RETURNING code_key`, [codeKey, active]);
  await audit(actor, active ? "promo.enable" : "promo.disable", codeKey);
  return rows.length > 0;
}
/** Remove test-identity redemptions (and their events) so QA leaves nothing behind. Only is_test rows. */
export async function purgeTestPromo(actor: string): Promise<number> {
  const p = await db();
  const ids = await p.query(`SELECT id, campaign_id FROM ${S()}.ad_promo_redemptions WHERE is_test = true`);
  for (const r of ids.rows) {
    if (r.campaign_id) {
      const c = await store.getCampaign(String(r.campaign_id));
      if (c?.isTest) await store.purgeTestCampaign(c.id, actor);
    }
  }
  await p.query(`DELETE FROM ${S()}.ad_street_events WHERE is_test = true`);
  await p.query(`DELETE FROM ${S()}.ad_promo_redemptions WHERE is_test = true`);
  await audit(actor, "promo.purge_test", null, String(ids.rows.length));
  return ids.rows.length;
}

/** A brand submitted an intake with a street team link / code in play. Counts the intake and stores a pending credit tied to the email. Never throws. */
export async function onIntakeSubmitted(ctx: { st: string | null; code: string | null; site: "birch" | "scale"; qr?: string | null }, email: string, website?: string | null): Promise<void> {
  try {
    const e = cleanEmail(email);
    if (!validEmail(e)) return;
    const test = isTestIdentity({ email: e });
    const st = await resolveMember(ctx.st);
    if (st) await streetEvent({ member: st, kind: "intake", site: ctx.site, isTest: test, dedupeKey: `intake:${e}:${st}` });
    // First touch: remember who referred this buyer (email + company domain) so a later card or EFT order from them, on either site, is credited.
    if (st) await recordFirstTouch(st, ctx.qr ?? null, ctx.site, e, website ?? null, test);
    if (ctx.code) {
      const host = website ? website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0]!.slice(0, 120) : null;
      await claimCode({ code: ctx.code, email: e, company: host, site: ctx.site, st, src: "intake" });
    }
  } catch (err) {
    await audit("intake", "promo.intake_error", null, err instanceof Error ? err.message : String(err));
  }
}
