/** Admin panel: referral orders (QR / street team / partner links) and per-referrer commission. Real rows only. */
import { CHANNEL_LABEL, recipientsAt, type ReferralDetail, type RecipientRow } from "./payoutSplit";
import type { ReferralOrder } from "./referrals";
import { esc, fmtDateTime, fmtInt, fmtMoney } from "./ui";

export type ReferralAdminView = {
  orders: ReferralOrder[];
  detail: ReferralDetail[];
  members: Array<{ id: string; label: string }>;
  recipients: RecipientRow[];
  /** EFT / invoice orders recorded but not yet marked paid (no commission owed until then). */
  pending?: ReferralOrder[];
  pendingDetail?: ReferralDetail[];
};

const pct = (bps: number | null) => (bps == null ? "–" : `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%`);

export function referralAdminHtml(v: ReferralAdminView): string {
  const label = new Map(v.members.map((m) => [m.id, m.label]));
  const det = new Map(v.detail.map((d) => [d.sessionId, d]));
  const now = Date.now();
  const shares = recipientsAt(v.recipients, now).filter((r) => r.active && r.scopeReferrer);
  const rows = v.orders.slice(0, 300).map((o) => {
    const d = det.get(o.sessionId);
    const com = d?.commissions.length ? d.commissions.map((c) => `${esc(c.name)} ${pct(c.pctBps)} ${c.basis === "gross" ? "of sale" : "of pool"}: <b>${fmtMoney(c.micros, o.currency)}</b>`).join("<br>") : `<span class="fine">no share set</span>`;
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
  const pdet = new Map((v.pendingDetail ?? []).map((d) => [d.sessionId, d]));
  const pend = (v.pending ?? []).map((o) => {
    const d = pdet.get(o.sessionId);
    const com = d?.commissions.length ? d.commissions.map((c) => `${esc(c.name)} ${pct(c.pctBps)}: <b>${fmtMoney(c.micros, o.currency)}</b> <span class="chip c-pending">pending until paid</span>`).join("<br>") : `<span class="fine">no share set</span>`;
    const ref = o.sessionId.replace(/^eft:/, "");
    return `<tr><td class="fine">${esc(fmtDateTime(o.paidAt))}</td><td>${esc(o.brand ?? "")}${o.isTest ? ` <span class="chip c-paused">test</span>` : ""}<div class="fine"><code>${esc(ref)}</code> · ${esc(o.buyerEmail ?? "")}</div></td><td><b>${esc(label.get(o.member) ?? o.member)}</b><div class="fine">${esc(o.member)}${o.qr ? ` · QR ${esc(o.qr)}` : ""} · ${o.via === "first_touch" ? "first touch" : "on the IO"}</div></td><td class="n">${fmtMoney(o.amountCents * 10_000, o.currency)}</td><td class="fine">${com}</td><td><form data-post="/ads/admin/referral/eft/paid" data-reload style="display:flex;gap:6px"><input type="hidden" name="ref" value="${esc(ref)}"><input name="paidRef" placeholder="e-transfer ref" required><button class="sm" type="submit">Mark paid</button></form></td></tr>`;
  });
  const eftForm = `<h3>EFT / invoice order</h3><p class="fine">Record an order paid by e-transfer, wire or invoice. Leave Referrer blank to credit whoever first brought this buyer in (their email or company). Commission stays pending until you mark it paid. No card is charged.</p>
<form data-post="/ads/admin/referral/eft" data-reload style="display:flex;flex-wrap:wrap;gap:6px;align-items:end"><input name="ref" placeholder="IO / invoice ref" required><input name="brand" placeholder="Brand" required><input name="email" type="email" placeholder="Buyer email" required><input name="website" placeholder="Brand website (optional)"><input name="amount" type="number" step="0.01" min="1" placeholder="Amount" required><select name="currency"><option value="usd">USD</option><option value="cad">CAD</option></select><input name="member" placeholder="Referrer (blank = first touch)"><select name="site"><option value="birch">birchreserve.net</option><option value="scale">scalehealth.ca</option></select><button class="sm" type="submit">Record order</button></form>
<div class="tw"><table><thead><tr><th>Recorded</th><th>Order</th><th>Referrer</th><th class="n">Amount</th><th>Commission</th><th></th></tr></thead><tbody>${pend.join("") || `<tr><td colspan="6" class="muted">No EFT orders waiting for payment.</td></tr>`}</tbody></table></div>`;
  return `<section id="referrals"><h2>Referral orders</h2><p class="fine">Every paid order a QR code or street-team / partner link brought in, on birchreserve.net and the Scale mirror alike (30 days from the referring click, last click wins). <b>Pool</b> = amount collected × the Birch override for the order's channel at payment time (${esc(CHANNEL_LABEL.brokerage)} default, ${esc(CHANNEL_LABEL.scale_direct)} / ${esc(CHANNEL_LABEL.internal)} channel rate). A referrer earns its share of that pool once you add a payout recipient scoped to them (Payout split → recipients → <i>Referrer</i>); those lines appear in the statements above for Approve and Pay. <a href="/ads/admin/export/referrals.csv">CSV</a></p>
<div class="tw"><table><thead><tr><th>Referrer</th><th class="n">Paid orders</th><th class="n">Collected</th><th class="n">Pool</th><th>Share</th><th class="n">Commission</th></tr></thead><tbody>${sum.join("") || `<tr><td colspan="6" class="muted">No referred paid orders yet.</td></tr>`}</tbody></table></div>
<div class="tw"><table><thead><tr><th>Paid</th><th>Order</th><th>Referrer</th><th>Site</th><th>Channel</th><th class="n">Collected</th><th class="n">Override</th><th class="n">Pool</th><th>Commission</th></tr></thead><tbody>${rows.join("") || `<tr><td colspan="9" class="muted">No referred paid orders yet.</td></tr>`}</tbody></table></div>${eftForm}</section>`;
}
