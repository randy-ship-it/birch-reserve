/**
 * Admin business views (Randy + Jon, Nov 22 2026): Reserves & deposits (Stripe), Commissions owed, Leads (CRM), and the Birch / Scale / All filter.
 * Read-only, real rows only: livemode sessions and non-test leads. QA rows (qa- emails, "QA Check" brands, test identities) never show.
 */
import type Stripe from "stripe";
import type { Lead } from "../leads";
import { isTestIdentity } from "../testTraffic";
import { CHANNEL_DEFAULT_BPS, overrideFor, type ChannelRateRow, type RateRow } from "./payoutSplit";
import { esc, fmtDate, fmtDateTime, fmtInt, fmtMoney } from "./ui";

export type SiteFilter = "all" | "birch" | "scale";
export const siteFilterOf = (v: unknown): SiteFilter => (v === "birch" || v === "scale" ? v : "all");
const siteLabel = (s: string) => (s === "scale" ? "Scale" : "Birch");

/** Filter chips. Keeps the current hash so the tab stays put. */
export function siteFilterHtml(cur: SiteFilter): string {
  const chip = (k: SiteFilter, label: string) => `<a href="/ads/admin${k === "all" ? "" : `?site=${k}`}" class="chip ${cur === k ? "c-live" : "c-paused"}" style="text-decoration:none;margin-right:6px" ${cur === k ? 'aria-current="true"' : ""}>${label}</a>`;
  return `<p class="fine" style="margin:6px 0">Site: ${chip("all", "All")}${chip("birch", "Birch")}${chip("scale", "Scale")} <span>Filters campaigns, leads, reserves and commissions below. Hub, payout and ledger sections always show both.</span></p>`;
}

/* ------------------------------------------------------------------------------------------ reserves & deposits */
export type ReserveStatus = "paid" | "partly_refunded" | "refunded" | "open" | "expired" | "unpaid";
export type ReserveRow = { id: string; at: Date; site: "birch" | "scale"; flow: string; brand: string; email: string; amountCents: number; refundedCents: number; currency: string; status: ReserveStatus };

const FLOW_LABEL: Record<string, string> = { exclusive_reserve: "Exclusive reserve" };
const flowOf = (md: Record<string, string>): string | null => {
  const k = md.kind || md.offerKey || md.sku || (md.reservationId ? "reservation" : "");
  if (!k) return null;
  if (FLOW_LABEL[k]) return FLOW_LABEL[k];
  return k.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
};
export const isQaSession = (email: string, brand: string, md: Record<string, string>): boolean =>
  /^qa[-+_.]/i.test(email) || /^qa\b/i.test(brand) || isTestIdentity({ email, name: brand }) || md.is_test === "true" || md.is_test === "1" || md.qa === "1";

/** Pure: a Stripe Checkout Session (payment_intent.latest_charge expanded when present) → a row, or null (not a reserve / deposit flow, test mode, or QA). */
export function reserveRowOf(s: Stripe.Checkout.Session): ReserveRow | null {
  if (!s.livemode) return null;
  const md = (s.metadata ?? {}) as Record<string, string>;
  const flow = flowOf(md);
  if (!flow) return null;
  const email = (s.customer_details?.email ?? s.customer_email ?? "").trim();
  const brand = (md.brand || s.customer_details?.business_name || "").trim();
  if (isQaSession(email, brand, md)) return null;
  const pi = s.payment_intent && typeof s.payment_intent === "object" ? (s.payment_intent as Stripe.PaymentIntent) : null;
  const ch = pi?.latest_charge && typeof pi.latest_charge === "object" ? (pi.latest_charge as Stripe.Charge) : null;
  const amount = s.amount_total ?? 0;
  const refunded = ch?.amount_refunded ?? 0;
  const site = md.site === "scale" || md.sold_by === "scale" || /scalehealth\.ca/.test(s.success_url ?? "") ? "scale" : "birch";
  let status: ReserveStatus;
  if (s.status === "expired") status = "expired";
  else if (s.status === "open") status = "open";
  else if (s.payment_status === "paid") status = refunded >= amount && amount > 0 ? "refunded" : refunded > 0 ? "partly_refunded" : "paid";
  else status = "unpaid";
  return { id: s.id, at: new Date(s.created * 1000), site, flow, brand, email, amountCents: amount, refundedCents: refunded, currency: (s.currency ?? "usd").toLowerCase(), status };
}

export type StripeLister = (since: number) => Promise<Stripe.Checkout.Session[]>;
let cache: { at: number; rows: ReserveRow[] } | null = null;
/** Last 180 days of live sessions, up to 600, cached 60 s. Throws when Stripe can't be read (the caller shows a notice, never fake rows). */
export async function loadReserveRows(list: StripeLister, now = Date.now()): Promise<ReserveRow[]> {
  if (cache && now - cache.at < 60_000) return cache.rows;
  const sessions = await list(Math.floor(now / 1000) - 180 * 86400);
  const rows = sessions.map(reserveRowOf).filter((r): r is ReserveRow => r !== null).sort((a, b) => b.at.getTime() - a.at.getTime());
  cache = { at: now, rows };
  return rows;
}

const CHIP: Record<ReserveStatus, string> = { paid: "c-active", partly_refunded: "c-pending", refunded: "c-paused", open: "c-pending", expired: "c-paused", unpaid: "c-pending" };
const STATUS_LABEL: Record<ReserveStatus, string> = { paid: "paid", partly_refunded: "partly refunded", refunded: "refunded", open: "open (unpaid)", expired: "expired", unpaid: "complete, unpaid" };

export function reservesHtml(rows: ReserveRow[] | null, site: SiteFilter, error?: string): string {
  const head = `<section id="reserves"><h2>Reserves &amp; deposits</h2><p class="fine">Stripe Checkout sessions for the reserve, exclusive and sponsor flows (live mode, last 180 days). QA sessions are excluded. Read-only.</p>`;
  if (!rows) return `${head}<p class="warn" role="alert">${esc(error ?? "Stripe could not be read right now. Nothing is shown rather than guessing.")}</p></section>`;
  const f = rows.filter((r) => site === "all" || r.site === site);
  const n = (s: ReserveStatus) => f.filter((r) => r.status === s).length;
  const body = f.slice(0, 200).map((r) => `<tr><td class="fine">${esc(fmtDateTime(r.at))}</td><td>${esc(r.flow)}</td><td><b>${esc(r.brand || "–")}</b><div class="fine">${esc(r.email)}</div></td><td>${siteLabel(r.site)}</td><td class="n">${fmtMoney(r.amountCents * 10_000, r.currency)}${r.refundedCents ? `<div class="fine">refunded ${fmtMoney(r.refundedCents * 10_000, r.currency)}</div>` : ""}</td><td><span class="chip ${CHIP[r.status]}">${STATUS_LABEL[r.status]}</span></td><td class="fine"><code>${esc(r.id.slice(-10))}</code></td></tr>`).join("");
  return `${head}<p><b>${fmtInt(n("paid") + n("partly_refunded"))}</b> paid · <b>${fmtInt(n("open") + n("unpaid"))}</b> open or unpaid · <b>${fmtInt(n("expired"))}</b> expired · <b>${fmtInt(n("refunded"))}</b> refunded</p>
${f.length ? `<div class="tw" style="max-height:520px"><table><thead><tr><th>Created</th><th>Flow</th><th>Brand / email</th><th>Site</th><th class="n">Amount</th><th>Status</th><th>Session</th></tr></thead><tbody>${body}</tbody></table></div>` : `<p class="empty">No reserve or deposit sessions yet.</p>`}</section>`;
}

/* ------------------------------------------------------------------------------------------ commissions */
export type CommissionRates = { brokerageBps: number; scaleBps: number };
/** Rates in effect now, from the existing dated rate rows (display only; never changed here). */
export function commissionRates(rates: RateRow[], channelRates: ChannelRateRow[], now = Date.now()): CommissionRates {
  let g: RateRow | undefined;
  for (const r of rates) if (r.partner === null && r.overrideBps != null && r.effectiveAt.getTime() <= now && (!g || r.effectiveAt.getTime() >= g.effectiveAt.getTime())) g = r;
  return { brokerageBps: g?.overrideBps ?? 2000, scaleBps: overrideFor("scale_direct", 0, channelRates, now) ?? CHANNEL_DEFAULT_BPS.scale_direct };
}

const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).format(d);

export type CommissionTotals = Array<{ channel: "brokerage" | "scale_direct"; currency: string; bps: number; monthNet: number; allNet: number }>;
/** Pure: rate × net paid orders (paid minus refunds) per channel and currency, this month and to date. Birch-site orders are brokerage, Scale-site orders are Scale direct. */
export function commissionTotals(rows: ReserveRow[], rates: CommissionRates, now = new Date()): CommissionTotals {
  const m = monthKey(now);
  const acc = new Map<string, { channel: "brokerage" | "scale_direct"; currency: string; monthNet: number; allNet: number }>();
  for (const r of rows) {
    if (r.status !== "paid" && r.status !== "partly_refunded") continue;
    const channel = r.site === "scale" ? "scale_direct" : "brokerage";
    const k = `${channel}:${r.currency}`;
    const a = acc.get(k) ?? { channel, currency: r.currency, monthNet: 0, allNet: 0 };
    const net = r.amountCents - r.refundedCents;
    a.allNet += net;
    if (monthKey(r.at) === m) a.monthNet += net;
    acc.set(k, a);
  }
  return [...acc.values()].map((a) => ({ ...a, bps: a.channel === "scale_direct" ? rates.scaleBps : rates.brokerageBps })).sort((a, b) => a.channel.localeCompare(b.channel) || a.currency.localeCompare(b.currency));
}

export function commissionsHtml(rows: ReserveRow[] | null, rates: CommissionRates, site: SiteFilter, now = new Date()): string {
  const head = `<section id="commissions"><h2>Commissions owed</h2><p class="fine">Rate in effect × net paid orders (paid, minus refunds) from the Stripe sessions above. Birch-site orders are brokerage, Scale-site orders are Scale direct. Display only: change rates under Payout split.</p>`;
  if (!rows) return `${head}<p class="warn" role="alert">Stripe could not be read right now, so no totals are shown.</p></section>`;
  const t = commissionTotals(rows, rates, now).filter((x) => site === "all" || (site === "scale") === (x.channel === "scale_direct"));
  const pc = (b: number) => `${(b / 100).toFixed(b % 100 ? 2 : 0)}%`;
  const c = (cents: number, bps: number, cur: string) => fmtMoney(Math.round((cents * bps) / 10_000) * 10_000, cur);
  const body = t.map((x) => `<tr><td>${x.channel === "scale_direct" ? "Scale direct" : "Birch brokerage"}</td><td class="n">${pc(x.bps)}</td><td class="n">${fmtMoney(x.monthNet * 10_000, x.currency)}</td><td class="n"><b>${c(x.monthNet, x.bps, x.currency)}</b></td><td class="n">${fmtMoney(x.allNet * 10_000, x.currency)}</td><td class="n"><b>${c(x.allNet, x.bps, x.currency)}</b></td></tr>`).join("");
  return `${head}${t.length ? `<div class="tw"><table><thead><tr><th>Channel</th><th class="n">Rate</th><th class="n">Paid orders, this month</th><th class="n">Commission, this month</th><th class="n">Paid orders, to date</th><th class="n">Commission, to date</th></tr></thead><tbody>${body}</tbody></table></div><p class="fine">Window: last 180 days of Stripe sessions. Hub royalties are separate (Royalty statements).</p>` : `<p class="empty">No paid orders yet.</p>`}</section>`;
}

/* ------------------------------------------------------------------------------------------ leads */
export const leadSiteOf = (l: Lead): "birch" | "scale" =>
  /scale/i.test(l.utmSource ?? "") || /scalehealth\.ca|\/intake\/_m/i.test(`${l.landingPage ?? ""} ${l.referrer ?? ""} ${l.pagePath ?? ""}`) ? "scale" : "birch";

const KIND: Array<[Lead["source"], string]> = [["brand_intake", "Brand"], ["advertiser_intake", "Advertiser"], ["partners", "Hub / partner"], ["activation", "Hub ad-activation"], ["inventory_signup", "Hub signup"]];
const crm = (l: Lead) => (l.fridayStatus === "sent" ? ["in CRM", "c-active"] : l.fridayStatus === "failed" ? ["CRM push failed", "c-paused"] : l.fridayStatus === "skipped" ? ["not sent to CRM", "c-paused"] : ["queued for CRM", "c-pending"]);

export function leadsHtml(leads: Partial<Record<Lead["source"], Lead[]>>, site: SiteFilter): string {
  const all = KIND.flatMap(([src, kind]) => (leads[src] ?? []).filter((l) => !l.isTest && !isTestIdentity({ email: l.email ?? undefined, name: l.name ?? undefined })).map((l) => ({ l, kind, site: leadSiteOf(l) })))
    .filter((x) => site === "all" || x.site === site)
    .sort((a, b) => b.l.createdAt.getTime() - a.l.createdAt.getTime());
  const body = all.slice(0, 250).map(({ l, kind, site: s }) => {
    const [label, cls] = crm(l);
    const stage = l.meta.stage ?? l.meta.hub_status ?? l.meta.partner_track ?? "";
    return `<tr><td class="fine">${esc(fmtDate(l.createdAt))}</td><td>${esc(kind)}</td><td><b>${esc(l.name ?? "–")}</b><div class="fine">${esc(l.email ?? "")}</div></td><td>${esc(l.company ?? "")}</td><td>${esc(String(stage).replace(/_/g, " "))}</td><td>${siteLabel(s)}</td><td><span class="chip ${cls}">${label}</span>${l.fridayLastError && l.fridayStatus === "failed" ? `<div class="fine">${esc(l.fridayLastError.slice(0, 80))}</div>` : ""}</td></tr>`;
  }).join("");
  return `<section id="leads"><h2>Leads</h2><p class="fine">Brand, advertiser and hub intake rows, newest first (test and QA rows excluded). CRM column: whether the lead was pushed to the CRM. Site is read from the page the lead came from.</p>
${all.length ? `<div class="tw" style="max-height:520px"><table><thead><tr><th>Date</th><th>Type</th><th>Name</th><th>Company</th><th>Stage</th><th>Site</th><th>CRM</th></tr></thead><tbody>${body}</tbody></table></div>` : `<p class="empty">No leads yet.</p>`}</section>`;
}
