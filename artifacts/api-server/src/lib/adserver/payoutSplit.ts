/**
 * Payout split (Randy voice Nov 21 2026 1:09 PM). Per delivered (charged) dollar of collected ad revenue:
 *   Birch override = override% of gross → distributed to brokerage / commission recipients (% of the pool); unallocated pool stays with Birch.
 *   net = gross − override; hub royalty = hub% of net; the remainder stays with Birch / SBG.
 * Rates and recipients are dated versions: a charge uses the version in effect at its own time, so changes are never retroactive.
 * Pure module (no DB).
 */
/** Volume tier: once a hub's monthly gross (per currency, per source) reaches fromMicros, further gross earns hubBps. Progressive. */
export type Tier = { fromMicros: number; hubBps: number };
export type RateRow = { partner: string | null; overrideBps: number | null; hubBps: number | null; tiers?: Tier[] | null; effectiveAt: Date };
export type SourceType = "ad" | "transaction";
export type RecipientRow = {
  rkey: string; name: string; kind: "brokerage" | "commission"; pctBps: number; scopePartner: string | null; scopeCampaign: string | null;
  active: boolean; payoutRef: string | null; effectiveAt: Date;
};
export type ChargeLine = { partner: string; campaignId: string; at: Date; currency: string; grossMicros: number; source?: SourceType };
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

export const applies = (r: RecipientRow, partner: string, campaignId: string) =>
  r.active && (r.scopePartner === null || r.scopePartner === partner) && (r.scopeCampaign === null || r.scopeCampaign === campaignId);

/** Largest share of the pool any one charge could hand out (every hub × campaign scope combination). Must be ≤ 10000. */
export function maxPoolAllocationBps(active: RecipientRow[], partners: string[], campaigns: string[]): number {
  const ps = [...new Set([...partners, ...active.map((r) => r.scopePartner).filter((x): x is string => Boolean(x)), "\u0000none"])];
  const cs = [...new Set([...campaigns, ...active.map((r) => r.scopeCampaign).filter((x): x is string => Boolean(x)), "\u0000none"])];
  let max = 0;
  for (const p of ps) for (const c of cs) max = Math.max(max, active.filter((r) => applies(r, p, c)).reduce((s, r) => s + r.pctBps, 0));
  return max;
}

export type PayeeAgg = { key: string; kind: "hub" | "brokerage" | "commission"; label: string; partner: string; source: SourceType; month: string; currency: string; basis: number; payable: number; pending: boolean; units: number; bpsSeen: Set<number>; payoutRef: string | null };
export type MonthAgg = { month: string; currency: string; gross: number; override: number; recipients: number; hub: number; pendingGross: number };

/** Split every charge line. Amounts accumulate in fractional micros and are floored once per payee. */
export function splitCharges(lines: ChargeLine[], rates: RateRow[], recipients: RecipientRow[]): { payees: PayeeAgg[]; months: MonthAgg[] } {
  const payees = new Map<string, PayeeAgg>();
  const months = new Map<string, MonthAgg>();
  const add = (k: string, init: () => PayeeAgg, basis: number, amt: number | null, bps: number | null) => {
    const a = payees.get(k) ?? init();
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
    const m = months.get(mk) ?? { month, currency: l.currency, gross: 0, override: 0, recipients: 0, hub: 0, pendingGross: 0 };
    m.gross += l.grossMicros;
    const r = ratesAt(rates, l.partner, t);
    const pkey = src === "ad" ? l.partner : `${l.partner}#${src}`;
    const hk = `${pkey}|${month}|${l.currency}`;
    const hubInit = (): PayeeAgg => ({ key: pkey, kind: "hub", label: l.partner, partner: l.partner, source: src, month, currency: l.currency, basis: 0, payable: 0, pending: false, units: 0, bpsSeen: new Set(), payoutRef: null });
    if (!r) {
      m.pendingGross += l.grossMicros;
      add(hk, hubInit, l.grossMicros, null, null);
      months.set(mk, m);
      continue;
    }
    const pool = (l.grossMicros * r.overrideBps) / 10_000;
    const vk = `${l.partner}|${src}|${month}|${l.currency}`;
    const before = mtd.get(vk) ?? 0;
    mtd.set(vk, before + l.grossMicros);
    const { amt: hubAmt, topBps } = hubAmountFor(l.grossMicros, before, r.overrideBps, r.hubBps, r.tiers);
    add(hk, hubInit, l.grossMicros, hubAmt, topBps);
    m.override += pool;
    m.hub += hubAmt;
    for (const rc of recipientsAt(recipients, t).filter((x) => applies(x, l.partner, l.campaignId))) {
      const amt = (pool * rc.pctBps) / 10_000;
      m.recipients += amt;
      const key = `rcpt:${rc.rkey}@${pkey}`; // one line per recipient per hub, so each line follows its hub's payout gate
      add(`${key}|${month}|${l.currency}`, () => ({ key, kind: rc.kind, label: `${rc.name} (on ${l.partner})`, partner: l.partner, source: src, month, currency: l.currency, basis: 0, payable: 0, pending: false, units: 0, bpsSeen: new Set(), payoutRef: rc.payoutRef }), pool, amt, rc.pctBps);
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
