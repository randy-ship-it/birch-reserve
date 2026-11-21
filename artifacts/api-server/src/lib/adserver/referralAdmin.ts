/** Admin panel: referral orders (QR / street team / partner links) and per-referrer commission. Real rows only. */
import { CHANNEL_LABEL, recipientsAt, type ReferralDetail, type RecipientRow } from "./payoutSplit";
import type { ReferralOrder } from "./referrals";
import { esc, fmtDateTime, fmtInt, fmtMoney } from "./ui";

export type ReferralAdminView = {
  orders: ReferralOrder[];
  detail: ReferralDetail[];
  members: Array<{ id: string; label: string }>;
  recipients: RecipientRow[];
};

const pct = (bps: number | null) => (bps == null ? "–" : `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`);

export function referralAdminHtml(v: ReferralAdminView): string {
  const label = new Map(v.members.map((m) => [m.id, m.label]));
  const det = new Map(v.detail.map((d) => [d.sessionId, d]));
  const now = Date.now();
  const shares = recipientsAt(v.recipients, now).filter((r) => r.active && r.scopeReferrer);
  const rows = v.orders.slice(0, 300).map((o) => {
    const d = det.get(o.sessionId);
    const com = d?.commissions.length ? d.commissions.map((c) => `${esc(c.name)} ${pct(c.pctBps)} of pool: <b>${fmtMoney(c.micros, o.currency)}</b>`).join("<br>") : `<span class="fine">no share set</span>`;
    return `<tr><td class="fine">${esc(fmtDateTime(o.paidAt))}</td><td>${esc(o.brand ?? "")}${o.isTest ? ` <span class="chip c-paused">test</span>` : ""}<div class="fine"><code>${esc(o.sessionId.slice(0, 20))}…</code>${o.campaignId ? ` · ${esc(o.campaignId.slice(0, 8))}` : ""}${o.orderKind ? ` · ${esc(o.orderKind)}` : ""}</div></td>
<td><b>${esc(label.get(o.member) ?? o.member)}</b><div class="fine">${esc(o.member)}${o.qr ? ` · QR ${esc(o.qr)}` : " · link"}${o.code ? ` · ${esc(o.code)}` : ""}</div></td><td>${o.site === "scale" ? "Scale mirror" : "Birch"}</td><td class="fine">${esc(CHANNEL_LABEL[o.channel])}</td>
<td class="n">${fmtMoney(o.amountCents * 10_000, o.currency)}</td><td class="n">${pct(d?.overrideBps ?? null)}</td><td class="n">${d?.poolMicros != null ? fmtMoney(d.poolMicros, o.currency) : "–"}</td><td class="fine">${com}</td></tr>`;
  });
  const by = new Map<string, { orders: number; money: Map<string, { amount: number; pool: number; com: number }> }>();
  for (const o of v.orders.filter((x) => !x.isTest)) {
    const d = det.get(o.sessionId);
    const b = by.get(o.member) ?? { orders: 0, money: new Map() };
    b.orders += 1;
    const m = b.money.get(o.currency) ?? { amount: 0, pool: 0, com: 0 };
    m.amount += o.amountCents * 10_000;
    m.pool += d?.poolMicros ?? 0;
    m.com += d?.commissions.reduce((s, c) => s + c.micros, 0) ?? 0;
    b.money.set(o.currency, m);
    by.set(o.member, b);
  }
  const sum = [...by.entries()].sort((a, b) => b[1].orders - a[1].orders).map(([id, b]) => {
    const sh = shares.filter((r) => r.scopeReferrer === id);
    const cell = (k: "amount" | "pool" | "com") => [...b.money.entries()].map(([cur, m]) => fmtMoney(m[k], cur)).join("<br>");
    return `<tr><td><b>${esc(label.get(id) ?? id)}</b><div class="fine">${esc(id)}</div></td><td class="n">${fmtInt(b.orders)}</td><td class="n">${cell("amount")}</td><td class="n">${cell("pool")}</td><td class="fine">${sh.length ? sh.map((r) => `${esc(r.name)} ${pct(r.pctBps)}`).join("<br>") : "not set"}</td><td class="n">${sh.length ? cell("com") : "–"}</td></tr>`;
  });
  return `<section id="referrals"><h2>Referral orders</h2><p class="fine">Every paid order a QR code or street-team / partner link brought in, on birchreserve.net and the Scale mirror alike (30 days from the referring click, last click wins). <b>Pool</b> = amount collected × the Birch override for the order's channel at payment time (${esc(CHANNEL_LABEL.brokerage)} default, ${esc(CHANNEL_LABEL.scale_direct)} / ${esc(CHANNEL_LABEL.internal)} channel rate). A referrer earns its share of that pool once you add a payout recipient scoped to them (Payout split → recipients → <i>Referrer</i>); those lines appear in the statements above for Approve and Pay. <a href="/ads/admin/export/referrals.csv">CSV</a></p>
<div class="tw"><table><thead><tr><th>Referrer</th><th class="n">Paid orders</th><th class="n">Collected</th><th class="n">Pool</th><th>Share</th><th class="n">Commission</th></tr></thead><tbody>${sum.join("") || `<tr><td colspan="6" class="muted">No referred paid orders yet.</td></tr>`}</tbody></table></div>
<div class="tw"><table><thead><tr><th>Paid</th><th>Order</th><th>Referrer</th><th>Site</th><th>Channel</th><th class="n">Collected</th><th class="n">Override</th><th class="n">Pool</th><th>Commission</th></tr></thead><tbody>${rows.join("") || `<tr><td colspan="9" class="muted">No referred paid orders yet.</td></tr>`}</tbody></table></div></section>`;
}
