/** Admin panels: promo codes + street team. Real rows only. */
import { esc, fmtDateTime, fmtInt } from "./ui";
import type { PromoCode, QrRow, Redemption, StreetRow } from "./promo";

export type PromoAdminView = {
  codes: PromoCode[];
  redemptions: Array<Redemption & { code: string; brand: string | null }>;
  street: StreetRow[];
  qrs: QrRow[];
};

const usd = (m: number) => `$${Math.round(m / 1_000_000).toLocaleString("en-US")}`;
const money = (x: { currency: string; cents: number }) => `${x.currency.toUpperCase()} ${(x.cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export function promoAdminHtml(v: PromoAdminView): string {
  const codes = v.codes
    .map(
      (c) => `<tr><td><b>${esc(c.code)}</b>${c.notes ? `<div class="fine">${esc(c.notes)}</div>` : ""}</td><td class="n">${usd(c.creditMicros)} USD</td><td class="n">${fmtInt(c.used)}${c.maxRedemptions ? ` / ${fmtInt(c.maxRedemptions)}` : ""}</td>
<td>${c.expiresAt ? esc(c.expiresAt.toISOString().slice(0, 10)) : "none"}</td><td><span class="chip ${c.active ? "c-approved" : "c-paused"}">${c.active ? "active" : "disabled"}</span></td>
<td><form data-post="/ads/admin/promo/${esc(c.codeKey)}/${c.active ? "disable" : "enable"}" data-reload><button class="${c.active ? "danger " : ""}sm" type="submit">${c.active ? "Disable" : "Enable"}</button></form></td></tr>`,
    )
    .join("");
  const reds = v.redemptions
    .slice(0, 150)
    .map(
      (r) => `<tr><td>${esc(fmtDateTime(r.createdAt))}</td><td>${esc(r.code)}</td><td>${esc(r.email)}${r.isTest ? ` <span class="chip c-paused">test</span>` : ""}<div class="fine">${esc(r.company ?? "")}</div></td><td>${esc(r.site)}</td><td>${esc(r.st ?? "")}${r.src ? `<div class="fine">${esc(r.src)}</div>` : ""}</td>
<td><span class="chip ${r.status === "applied" ? "c-approved" : "c-draft"}">${esc(r.status)}</span></td><td class="n">${usd(r.creditMicros)}</td><td class="fine">${r.sessionId ? esc(r.sessionId.slice(0, 18)) + "…" : "no order yet"}${r.brand ? `<div>${esc(r.brand)}</div>` : ""}</td></tr>`,
    )
    .join("");
  const members = v.street
    .map((m) => {
      const links = v.qrs.filter((q) => q.member === m.id);
      return `<tr><td><b>${esc(m.label)}</b><div class="fine">${esc(m.id)}</div></td><td class="n">${fmtInt(m.visits)}</td><td class="n">${fmtInt(m.scans)}</td><td class="n">${fmtInt(m.intakes)}</td><td class="n">${fmtInt(m.redemptions)}</td><td class="n">${fmtInt(m.applied)}</td><td class="n">${fmtInt(m.orders)}</td>
<td class="n">${m.revenue.length ? m.revenue.map(money).join("<br>") : "0"}</td>
<td>${links.map((q) => `<div class="fine"><b>${esc(q.label)}</b> (${esc(q.site)})<br><a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.url)}</a><br>${fmtInt(m.byQr[q.url.split("qr=")[1]?.split("&")[0] ?? ""] ?? 0)} scans · <a href="/ads/admin/street/qr.png?member=${encodeURIComponent(q.member)}&label=${encodeURIComponent(q.label)}" target="_blank">QR PNG</a></div>`).join("") || `<span class="fine">no link yet</span>`}</td></tr>`;
    })
    .join("");
  return `<section id="promo"><h2>Promo codes</h2><p class="fine">Free ad credit: ad spend only, no cash value, not transferable, one per business (email and company domain). The credit lands on the ad ledger as bonus credit; on $190 / $490 card orders, STREET100 also takes $100 off the Stripe price (the order's campaign still carries the full media amount); every other credit never reduces a Stripe price. Codes match case- and space-insensitively.</p>
<div class="tw"><table><thead><tr><th>Code</th><th class="n">Credit</th><th class="n">Redeemed</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>${codes || `<tr><td colspan="6" class="muted">No codes yet.</td></tr>`}</tbody></table></div>
<details class="ed"><summary>Create or update a code</summary><form class="f" data-post="/ads/admin/promo/save" data-reload><div class="row"><label>Code<input name="code" required maxlength="40" placeholder="PARTNER50"></label><label>Credit (USD)<input name="credit" type="number" min="1" max="5000" step="1" required></label><label>Max redemptions (optional)<input name="max" type="number" min="1"></label><label>Expires (optional)<input name="expires" type="date"></label></div>
<label>Other spellings that map to it (comma separated, optional)<input name="aliases" maxlength="200"></label><label>Notes<input name="notes" maxlength="300"></label><button type="submit">Save code</button></form></details>
<h3 style="margin-top:18px">Redemptions <a class="fine" href="/ads/admin/export/promo-redemptions.csv">CSV</a></h3>
<div class="tw"><table><thead><tr><th>When</th><th>Code</th><th>Business</th><th>Site</th><th>Street team</th><th>Status</th><th class="n">Credit</th><th>Order / campaign</th></tr></thead><tbody>${reds || `<tr><td colspan="8" class="muted">No redemptions yet.</td></tr>`}</tbody></table></div>
<form data-post="/ads/admin/promo-test/purge" data-reload style="margin-top:8px"><button class="ghost sm" type="submit">Delete test-identity redemptions + events</button></form></section>
<section id="street"><h2>Street team</h2><p class="fine">Per member, from first-party links and QR codes (30-day last-touch). Visits and scans are one per device per day with bots removed. Revenue is paid Stripe orders in the currency paid. Test identities are excluded. <a href="/ads/admin/export/street-team.csv">CSV</a></p>
<div class="tw"><table><thead><tr><th>Member</th><th class="n">Visits</th><th class="n">QR scans</th><th class="n">Intakes</th><th class="n">Code claims</th><th class="n">Credits applied</th><th class="n">Paid orders</th><th class="n">Revenue</th><th>Links + QR</th></tr></thead><tbody>${members || `<tr><td colspan="9" class="muted">No members yet.</td></tr>`}</tbody></table></div>
<details class="ed"><summary>Mint a member link + QR</summary><form class="f" data-post="/ads/admin/street/member"><div class="row"><label>Member id (name only)<input name="id" required maxlength="32" placeholder="bridget"></label><label>Display name<input name="label" maxlength="60"></label><label>Site<select name="site"><option value="birch">birchreserve.net/intake</option><option value="scale">scalehealth.ca/intake (Scale)</option></select></label><label>QR label<input name="qrLabel" maxlength="60" placeholder="scale-intake-digital"></label></div><button type="submit">Create link + QR</button><pre data-out style="display:none;white-space:pre-wrap;word-break:break-all"></pre></form></details></section>`;
}
