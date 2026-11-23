/**
 * Payout split (Randy voice Nov 21 2026 1:09 PM). Per delivered (charged) dollar of collected ad revenue:
 *   Birch override = override% of gross → distributed to brokerage / commission recipients (% of the pool); unallocated pool stays with Birch.
 *   net = gross − override; hub royalty = hub% of net; the remainder stays with Birch / SBG.
 * The override depends on the sales channel (Randy voice Nov 21 2026 2:45 PM):
 *   brokerage    = sold through Birch Reserve (campaign seller "birch") → the Birch override rate (default 20%, per hub editable);
 *   scale_direct = sold organically off the Scale Health site (seller "scale") → its own rate (default 5%);
 *   internal     = Birch only runs it internally as cost accounting (campaign flag) → its own rate (default 5%).
 * Rates and recipients are dated versions: a charge uses the version in effect at its own time, so changes are never retroactive.
 * Pure module (no DB).
 */
/** Volume tier: once a hub's monthly gross (per currency, per source) reaches fromMicros, further gross earns hubBps. Progressive. */
export type Tier = { fromMicros: number; hubBps: number };
export type RateRow = { partner: string | null; overrideBps: number | null; hubBps: number | null; tiers?: Tier[] | null; effectiveAt: Date };
export type SourceType = "ad" | "transaction" | "referral";
export type RecipientRow = {
  rkey: string; name: string; kind: "brokerage" | "commission"; pctBps: number; scopePartner: string | null; scopeCampaign: string | null;
  /** Street-team / partner member id: this recipient earns its share on orders that member referred (sale-time), never on delivery. */
  scopeReferrer?: string | null;
  /** Referrer shares only. "pool" (default) = pct of the order's Birch override pool; "gross" = pct of the amount the buyer paid (Simar: 10% of the sale). */
  basis?: "pool" | "gross";
  active: boolean; payoutRef: string | null; effectiveAt: Date;
};
export type Channel = "brokerage" | "scale_direct" | "internal";
export const CHANNELS: readonly Channel[] = ["brokerage", "scale_direct", "internal"];
export const CHANNEL_LABEL: Record<Channel, string> = { brokerage: "Birch brokerage", scale_direct: "Scale direct", internal: "Internal (cost accounting)" };
/** Fallback rates before any dated row exists (Randy 2:45 PM: 5% for Scale direct / internal). Brokerage uses the Birch override in RateRow. */
export const CHANNEL_DEFAULT_BPS: Record<Exclude<Channel, "brokerage">, number> = { scale_direct: 500, internal: 500 };
export type ChannelRateRow = { channel: Exclude<Channel, "brokerage">; overrideBps: number; effectiveAt: Date };
/** Campaign → channel: the internal flag wins, then the seller. */
export const channelOf = (seller: string | null | undefined, internal: boolean | null | undefined): Channel => (internal ? "internal" : seller === "scale" ? "scale_direct" : "brokerage");
export type ChargeLine = { partner: string; campaignId: string; at: Date; currency: string; grossMicros: number; source?: SourceType; channel?: Channel };
/** Payout gate per hub: no hub or override payout until live + has transactions + own audience activated, unless overridden with a note. */
export type Gate = { live: boolean; hasTransactions: boolean; audienceActivated: boolean; override: boolean; note: string | null };
export const gatePassed = (g: Gate | undefined) => Boolean(g && (g.override || (g.live && g.hasTransactions && g.audienceActivated)));

const latest = <T extends { effectiveAt: Date }>(rows: T[], t: number): T | undefined => {
  let best: T | undefined;
  for (const r of rows) if (r.effectiveAt.getTime() <= t && (!best || r.effectiveAt.getTime() >= best.effectiveAt.getTime())) best = r;
  return best;
};

export function ratesAt(rates: RateRow[], partner: string, t: number): { overrideBps: number; hubBps: number; tiers: Tier[] } | null {
  const g = latest(rates.filter((r) => r.partner === null), t);
  const h = latest(rates.filter((r) => r.partner === partner), t);
  const overrideBps = h?.overrideBps ?? g?.overrideBps;
  const hubBps = h?.hubBps ?? g?.hubBps;
  const tiers = [...(h?.tiers ?? [])].sort((a, b) => a.fromMicros - b.fromMicros);
  return overrideBps == null || hubBps == null ? null : { overrideBps, hubBps, tiers };
}

/** Override bps for a charge: brokerage uses the Birch override (global / per hub); the other channels use their own dated rate. */
export function overrideFor(channel: Channel, brokerageBps: number, channelRates: ChannelRateRow[], t: number): number {
  if (channel === "brokerage") return brokerageBps;
  return latest(channelRates.filter((r) => r.channel === channel), t)?.overrideBps ?? CHANNEL_DEFAULT_BPS[channel];
}

/** Hub amount for one line given the hub's month-to-date gross before it (progressive tiers on gross volume). */
function hubAmountFor(gross: number, before: number, ovBps: number, base: number, tiers: Tier[]): { amt: number; topBps: number } {
  const bands: Array<{ from: number; bps: number }> = [{ from: 0, bps: base }, ...tiers.map((t) => ({ from: t.fromMicros, bps: t.hubBps }))];
  let amt = 0;
  let top = base;
  for (let i = 0; i < bands.length; i++) {
    const lo = Math.max(bands[i]!.from, before);
    const hi = Math.min(i + 1 < bands.length ? bands[i + 1]!.from : Infinity, before + gross);
    if (hi > lo) {
      amt += ((hi - lo) * (1 - ovBps / 10_000) * bands[i]!.bps) / 10_000;
      top = bands[i]!.bps;
    }
  }
  return { amt, topBps: top };
}

/** Current version of each recipient at time t (inactive ones included, so callers can filter). */
export function recipientsAt(rows: RecipientRow[], t: number): RecipientRow[] {
  const by = new Map<string, RecipientRow[]>();
  for (const r of rows) by.set(r.rkey, [...(by.get(r.rkey) ?? []), r]);
  return [...by.values()].map((v) => latest(v, t)).filter((r): r is RecipientRow => Boolean(r));
}

/** Delivery-time recipients. Referrer-scoped recipients are paid on the referred sale instead (splitReferralOrders), never twice. */
export const applies = (r: RecipientRow, partner: string, campaignId: string) =>
  r.active && !r.scopeReferrer && (r.scopePartner === null || r.scopePartner === partner) && (r.scopeCampaign === null || r.scopeCampaign === campaignId);

/** Largest share of the pool any one charge could hand out (every hub × campaign scope combination). Must be ≤ 10000. */
export function maxPoolAllocationBps(active: RecipientRow[], partners: string[], campaigns: string[]): number {
  const ps = [...new Set([...partners, ...active.map((r) => r.scopePartner).filter((x): x is string => Boolean(x)), "\u0000none"])];
  const cs = [...new Set([...campaigns, ...active.map((r) => r.scopeCampaign).filter((x): x is string => Boolean(x)), "\u0000none"])];
  let max = 0;
  for (const p of ps) for (const c of cs) max = Math.max(max, active.filter((r) => applies(r, p, c)).reduce((s, r) => s + r.pctBps, 0));
  return max;
}

export type PayeeAgg = { key: string; kind: "hub" | "brokerage" | "commission"; label: string; partner: string; source: SourceType; month: string; currency: string; basis: number; payable: number; pending: boolean; units: number; bpsSeen: Set<number>; payoutRef: string | null; overrides: Map<string, number> };
export type MonthAgg = { month: string; currency: string; gross: number; override: number; recipients: number; hub: number; pendingGross: number; byChannel: Partial<Record<Channel, { gross: number; override: number }>> };
/** "20% Birch brokerage · 5% Scale direct" from a payee's overrides map (key "channel:bps" → gross). */
export const overrideLabel = (m: Map<string, number>): string =>
  [...m.keys()].map((k) => { const [ch, bps] = k.split(":"); return `${(Number(bps) / 100).toFixed(Number(bps) % 100 ? 2 : 0)}% ${CHANNEL_LABEL[ch as Channel] ?? ch}`; }).join(" · ");

/** Split every charge line. Amounts accumulate in fractional micros and are floored once per payee. */
export function splitCharges(lines: ChargeLine[], rates: RateRow[], recipients: RecipientRow[], channelRates: ChannelRateRow[] = []): { payees: PayeeAgg[]; months: MonthAgg[] } {
  const payees = new Map<string, PayeeAgg>();
  const months = new Map<string, MonthAgg>();
  const add = (k: string, init: () => PayeeAgg, basis: number, amt: number | null, bps: number | null, ov?: string) => {
    const a = payees.get(k) ?? init();
    if (ov) a.overrides.set(ov, (a.overrides.get(ov) ?? 0) + basis);
    a.basis += basis;
    a.units += 1;
    if (amt === null) a.pending = true;
    else a.payable += amt;
    if (bps !== null) a.bpsSeen.add(bps);
    payees.set(k, a);
  };
  const mtd = new Map<string, number>(); // hub month-to-date gross for tiers
  for (const l of [...lines].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const t = l.at.getTime();
    const src: SourceType = l.source ?? "ad";
    const month = l.at.toISOString().slice(0, 7);
    const mk = `${month}|${l.currency}`;
    const m = months.get(mk) ?? { month, currency: l.currency, gross: 0, override: 0, recipients: 0, hub: 0, pendingGross: 0, byChannel: {} };
    m.gross += l.grossMicros;
    const r = ratesAt(rates, l.partner, t);
    const pkey = src === "ad" ? l.partner : `${l.partner}#${src}`;
    const hk = `${pkey}|${month}|${l.currency}`;
    const hubInit = (): PayeeAgg => ({ key: pkey, kind: "hub", label: l.partner, partner: l.partner, source: src, month, currency: l.currency, basis: 0, payable: 0, pending: false, units: 0, bpsSeen: new Set(), payoutRef: null, overrides: new Map() });
    if (!r) {
      m.pendingGross += l.grossMicros;
      add(hk, hubInit, l.grossMicros, null, null);
      months.set(mk, m);
      continue;
    }
    const channel: Channel = l.channel ?? "brokerage";
    const ovBps = overrideFor(channel, r.overrideBps, channelRates, t);
    const ovKey = `${channel}:${ovBps}`;
    const pool = (l.grossMicros * ovBps) / 10_000;
    const bc = (m.byChannel[channel] ??= { gross: 0, override: 0 });
    bc.gross += l.grossMicros;
    bc.override += pool;
    const vk = `${l.partner}|${src}|${month}|${l.currency}`;
    const before = mtd.get(vk) ?? 0;
    mtd.set(vk, before + l.grossMicros);
    const { amt: hubAmt, topBps } = hubAmountFor(l.grossMicros, before, ovBps, r.hubBps, r.tiers);
    add(hk, hubInit, l.grossMicros, hubAmt, topBps, ovKey);
    m.override += pool;
    m.hub += hubAmt;
    for (const rc of recipientsAt(recipients, t).filter((x) => applies(x, l.partner, l.campaignId))) {
      const amt = (pool * rc.pctBps) / 10_000;
      m.recipients += amt;
      const key = `rcpt:${rc.rkey}@${pkey}`; // one line per recipient per hub, so each line follows its hub's payout gate
      add(`${key}|${month}|${l.currency}`, () => ({ key, kind: rc.kind, label: `${rc.name} (on ${l.partner})`, partner: l.partner, source: src, month, currency: l.currency, basis: 0, payable: 0, pending: false, units: 0, bpsSeen: new Set(), payoutRef: rc.payoutRef, overrides: new Map() }), pool, amt, rc.pctBps, ovKey);
    }
    months.set(mk, m);
  }
  for (const p of payees.values()) {
    p.payable = Math.floor(p.payable);
    p.basis = Math.round(p.basis);
  }
  return { payees: [...payees.values()], months: [...months.values()] };
}

/** Worked example for the settings panel (default: $1,000 collected). */
export function workedExample(overrideBps: number, hubBps: number, recipients: Array<{ name: string; pctBps: number }>, gross = 1000) {
  const override = (gross * overrideBps) / 10_000;
  const net = gross - override;
  const hub = (net * hubBps) / 10_000;
  const rec = recipients.map((r) => ({ name: r.name, amount: (override * r.pctBps) / 10_000 }));
  const distributed = rec.reduce((s, r) => s + r.amount, 0);
  // retained = what stays with Birch/SBG out of net (Randy's example: $1,000 → $200 override, $280 hub, $520 retained); unallocated override also stays with Birch.
  return { gross, override, net, hub, recipients: rec, unallocatedOverride: override - distributed, retained: net - hub };
}

/** Due date for a statement month under the payout timing settings (end of month or quarter, plus Net-X days). */
export function dueDate(month: string, cadence: "monthly" | "quarterly", netDays: number): Date {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const endMonth = cadence === "quarterly" ? Math.ceil(m / 3) * 3 : m;
  const end = new Date(Date.UTC(y, endMonth, 1)); // first day after the period
  return new Date(end.getTime() + netDays * 864e5);
}

/* ------------------------------------------------------------------------------------- referral commissions (Randy, Nov 21 2026 4:07 PM) */
/** One paid order a street-team / partner link or QR brought in (ad_referral_orders + the order's current channel). */
export type ReferralOrderLine = { sessionId: string; campaignId: string | null; member: string; at: Date; currency: string; amountMicros: number; channel: Channel };
export type ReferralDetail = ReferralOrderLine & { overrideBps: number | null; poolMicros: number | null; commissions: Array<{ rkey: string; name: string; pctBps: number; micros: number; basis?: "pool" | "gross" }> };

/** Largest share of a referral pool any one member's recipients could take. Must be ≤ 10000. */
export function maxReferrerAllocationBps(active: RecipientRow[]): number {
  const by = new Map<string, number>();
  for (const r of active) if (r.active && r.scopeReferrer) by.set(r.scopeReferrer, (by.get(r.scopeReferrer) ?? 0) + r.pctBps);
  return Math.max(0, ...by.values());
}

/**
 * Referral commission on a paid, referred order, using the existing rates only (nothing new is invented):
 *   pool = amount collected × the Birch override for the order's channel at payment time
 *          (brokerage = default Birch override, 20% now; Scale direct / internal = their dated channel rate, 5% now);
 *   each active recipient scoped to that member (scope_referrer) earns its % of that pool; the rest stays with Birch.
 * No recipient for the member → the order is still listed with its pool, and no payout line is made.
 */
export function splitReferralOrders(orders: ReferralOrderLine[], rates: RateRow[], recipients: RecipientRow[], channelRates: ChannelRateRow[] = []): { payees: PayeeAgg[]; detail: ReferralDetail[] } {
  const payees = new Map<string, PayeeAgg>();
  const detail: ReferralDetail[] = [];
  for (const o of [...orders].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const t = o.at.getTime();
    const g = ratesAt(rates, "\u0000referral", t);
    if (!g) {
      detail.push({ ...o, overrideBps: null, poolMicros: null, commissions: [] });
      continue;
    }
    const ovBps = overrideFor(o.channel, g.overrideBps, channelRates, t);
    const pool = (o.amountMicros * ovBps) / 10_000;
    const month = o.at.toISOString().slice(0, 7);
    const commissions: ReferralDetail["commissions"] = [];
    for (const rc of recipientsAt(recipients, t).filter((x) => x.active && x.scopeReferrer === o.member)) {
      const gross = rc.basis === "gross";
      const base = gross ? o.amountMicros : pool;
      const amt = (base * rc.pctBps) / 10_000;
      commissions.push({ rkey: rc.rkey, name: rc.name, pctBps: rc.pctBps, micros: Math.floor(amt), basis: gross ? "gross" : "pool" });
      const key = `ref:${rc.rkey}`;
      const k = `${key}|${month}|${o.currency}`;
      const a = payees.get(k) ?? { key, kind: rc.kind, label: `${rc.name} (referrals by ${o.member}${gross ? ", % of sale" : ""})`, partner: "", source: "referral" as const, month, currency: o.currency, basis: 0, payable: 0, pending: false, units: 0, bpsSeen: new Set<number>(), payoutRef: rc.payoutRef, overrides: new Map<string, number>() };
      a.basis += base;
      a.payable += amt;
      a.units += 1;
      a.bpsSeen.add(rc.pctBps);
      if (!gross) {
        const ov = `${o.channel}:${ovBps}`;
        a.overrides.set(ov, (a.overrides.get(ov) ?? 0) + pool);
      }
      payees.set(k, a);
    }
    detail.push({ ...o, overrideBps: ovBps, poolMicros: Math.round(pool), commissions });
  }
  for (const p of payees.values()) {
    p.payable = Math.floor(p.payable);
    p.basis = Math.round(p.basis);
  }
  return { payees: [...payees.values()], detail };
}
