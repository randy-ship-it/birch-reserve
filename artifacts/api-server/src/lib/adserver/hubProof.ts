/**
 * "Activate your own hub, earn $100". A hub owner who sends their hub to 1,000+ people uploads proof (a screenshot of the send count or
 * a post's reach). An admin reviews it in /ads/admin. Approval issues a $100 ad credit through the normal promo credit system
 * (internal code, own campaign, own ledger, regular rate card). One per hub. Rejection issues nothing.
 */
import type { Request } from "express";
import { createHash, randomUUID } from "node:crypto";
import { emailButton, emailH1, emailLayout, emailP } from "../emailLayout";
import { sendBuyerEmail } from "../siteMail";
import { isTestIdentity } from "../testTraffic";
import { ADS_FROM } from "./mail";
import * as promo from "./promo";
import { db, S, audit } from "./store";
import { esc, fmtDateTime } from "./ui";

export const HUB_PROOF_CODE = "internalhubproof100";
export const HUB_PROOF_MIN_REACH = 1000;
export const HUB_PROOF_MAX_BYTES = 3 * 1024 * 1024;
export { HUB_PROOF_TERMS } from "../overhaul/hubEarn";

export const hubKeyOf = (name: string, url: string): string => {
  const host = url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] ?? "";
  return host.includes(".") ? host : promo.normKey(name);
};

export type Proof = { id: string; hubKey: string; hubName: string; hubUrl: string; contactName: string; email: string; channel: string; reach: number; note: string | null; mime: string; bytes: number; status: string; reviewer: string | null; reviewedAt: Date | null; reviewNote: string | null; isTest: boolean; site: string; createdAt: Date };
const toProof = (r: Record<string, unknown>): Proof => ({
  id: String(r.id), hubKey: String(r.hub_key), hubName: String(r.hub_name), hubUrl: String(r.hub_url ?? ""), contactName: String(r.contact_name ?? ""), email: String(r.email), channel: String(r.channel), reach: Number(r.reach),
  note: (r.note as string) ?? null, mime: String(r.mime), bytes: Number(r.bytes), status: String(r.status), reviewer: (r.reviewer as string) ?? null, reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)) : null,
  reviewNote: (r.review_note as string) ?? null, isTest: Boolean(r.is_test), site: String(r.site), createdAt: new Date(String(r.created_at)),
});
const COLS = "id, hub_key, hub_name, hub_url, contact_name, email, channel, reach, note, mime, bytes, status, reviewer, reviewed_at, review_note, is_test, site, created_at";

export function sniff(buf: Buffer): string | null {
  if (buf.length > 12 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.length > 5 && buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

export type SubmitInput = { hubName: string; hubUrl: string; contactName: string; email: string; channel: string; reach: number; note: string; file: Buffer; site: "birch" | "scale" };
export async function submitProof(i: SubmitInput): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const email = promo.cleanEmail(i.email);
  if (!promo.validEmail(email)) return { ok: false, message: "Add a valid email so we can reach you." };
  if (i.hubName.length < 2) return { ok: false, message: "Add your hub's name." };
  if (!Number.isFinite(i.reach) || i.reach < HUB_PROOF_MIN_REACH) return { ok: false, message: `This credit is for sends to ${HUB_PROOF_MIN_REACH.toLocaleString("en-US")} or more people.` };
  if (!["email", "sms", "social", "other"].includes(i.channel)) return { ok: false, message: "Pick how you sent it." };
  const mime = sniff(i.file);
  if (!mime) return { ok: false, message: "Upload a PNG, JPG, WebP or PDF." };
  if (i.file.length > HUB_PROOF_MAX_BYTES) return { ok: false, message: "That file is over 3 MB. Send a smaller screenshot." };
  const key = hubKeyOf(i.hubName, i.hubUrl);
  const p = await db();
  const dupe = await p.query(`SELECT 1 FROM ${S()}.ad_hub_proofs WHERE hub_key = $1 AND status <> 'rejected' LIMIT 1`, [key]);
  if (dupe.rows[0]) return { ok: false, message: "We already have a submission for this hub. One credit per hub. Reply to your confirmation email if something needs fixing." };
  const id = randomUUID();
  const test = isTestIdentity({ email, name: i.hubName });
  await p.query(
    `INSERT INTO ${S()}.ad_hub_proofs (id, hub_key, hub_name, hub_url, contact_name, email, channel, reach, note, mime, bytes, sha256, data, is_test, site) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [id, key, i.hubName, i.hubUrl, i.contactName, email, i.channel, Math.round(i.reach), i.note || null, mime, i.file.length, createHash("sha256").update(i.file).digest("hex"), i.file, test, i.site],
  );
  await audit(`hub:${email}`, "hubproof.submitted", id, `${i.hubName} reach=${Math.round(i.reach)} ${i.channel}`);
  return { ok: true, id };
}

export async function listProofs(limit = 100): Promise<Proof[]> {
  const p = await db();
  const { rows } = await p.query(`SELECT ${COLS} FROM ${S()}.ad_hub_proofs ORDER BY (status = 'pending') DESC, created_at DESC LIMIT $1`, [limit]);
  return rows.map(toProof);
}
export async function proofFile(id: string): Promise<{ mime: string; data: Buffer } | null> {
  const p = await db();
  const { rows } = await p.query(`SELECT mime, data FROM ${S()}.ad_hub_proofs WHERE id = $1`, [id]);
  return rows[0] ? { mime: String(rows[0].mime), data: rows[0].data as Buffer } : null;
}

export async function reviewProof(id: string, action: "approve" | "reject", actor: string, note: string): Promise<{ ok: boolean; message: string }> {
  const p = await db();
  const { rows } = await p.query(`SELECT ${COLS} FROM ${S()}.ad_hub_proofs WHERE id = $1`, [id]);
  if (!rows[0]) return { ok: false, message: "No such submission." };
  const pr = toProof(rows[0]);
  if (pr.status !== "pending") return { ok: false, message: `Already ${pr.status}.` };
  if (action === "approve") {
    const c = await promo.claimCode({ code: HUB_PROOF_CODE, email: pr.email, company: pr.hubName, site: pr.site === "scale" ? "scale" : "birch", src: "hub-proof" });
    if (!c.ok) return { ok: false, message: c.message };
    await promo.attachPendingForAccount(pr.email, `admin:${actor}`);
    await p.query(`UPDATE ${S()}.ad_hub_proofs SET status = 'approved', reviewer = $2, reviewed_at = now(), review_note = $3, redemption_id = $4 WHERE id = $1 AND status = 'pending'`, [id, actor, note || null, c.redemption.id]);
    await audit(actor, "hubproof.approved", id, `${pr.hubName} $100 credit`);
    await mail(pr, "approved", note);
    return { ok: true, message: `Approved. $100 ad credit issued to ${pr.email}.` };
  }
  await p.query(`UPDATE ${S()}.ad_hub_proofs SET status = 'rejected', reviewer = $2, reviewed_at = now(), review_note = $3 WHERE id = $1 AND status = 'pending'`, [id, actor, note || null]);
  await audit(actor, "hubproof.rejected", id, `${pr.hubName}${note ? ` ${note}` : ""}`);
  await mail(pr, "rejected", note);
  return { ok: true, message: "Rejected. No credit issued." };
}

/* ------------------------------------------------------------------------------------------ email (intake palette) */
export function proofEmail(kind: "received" | "approved" | "rejected", hubName: string, note?: string): { subject: string; text: string; html: string } {
  const h = esc(hubName);
  const copy = {
    received: { subject: `We got your hub proof, ${hubName}`, h1: "We got your proof.", lines: [`Thanks for activating <b>${h}</b>. A person reviews every submission, usually within 2 business days.`, "If it checks out, a $100 ad credit lands on your account and we email you again. One credit per hub."], btn: null as null | [string, string] },
    approved: { subject: `Your $100 ad credit is ready, ${hubName}`, h1: "Your $100 ad credit is ready.", lines: [`<b>${h}</b> is activated and your proof checked out. A $100 USD ad credit is now on your account.`, "Ad spend only, no cash value, not transferable, valid for 12 months. Sign in to see it and build your first ad."], btn: ["https://birchreserve.net/account", "See my credit"] as [string, string] },
    rejected: { subject: `About your hub proof, ${hubName}`, h1: "We couldn't approve that one yet.", lines: [`We couldn't confirm a send to 1,000 or more people for <b>${h}</b> from what we received.${note ? ` Note from our team: ${esc(note)}` : ""}`, "Reply to this email with a clearer screenshot and we'll look again."], btn: null },
  }[kind];
  const text = `${copy.h1.replace(/<[^>]+>/g, "")}\n\n${copy.lines.map((l) => l.replace(/<[^>]+>/g, "")).join("\n\n")}\n\nBirch Reserve\nsales@silverbirchgrowth.com`;
  const html = emailLayout({
    title: copy.subject, preheader: copy.h1, eyebrow: "Birch Reserve · Hub activation",
    body: emailH1(copy.h1) + copy.lines.map((l) => emailP(l)).join("") + (copy.btn ? emailButton(copy.btn[0], copy.btn[1]) : ""),
    footer: "Birch Reserve · sales@silverbirchgrowth.com",
  });
  return { subject: copy.subject, text, html };
}
async function mail(pr: Proof, kind: "received" | "approved" | "rejected", note?: string): Promise<void> {
  try {
    await sendBuyerEmail({ from: ADS_FROM(), to: [pr.email], ...proofEmail(kind, pr.hubName, note) });
  } catch {
    /* mail is best effort; the row and audit are the record */
  }
}
export const mailReceived = (pr: { email: string; hubName: string }) => mail({ email: pr.email, hubName: pr.hubName } as Proof, "received");

/* ------------------------------------------------------------------------------------------ admin panel */
export function hubProofAdminHtml(rows: Proof[]): string {
  const tr = rows
    .map(
      (r) => `<tr><td>${esc(fmtDateTime(r.createdAt))}</td><td><b>${esc(r.hubName)}</b><div class="fine">${esc(r.hubUrl)}</div></td><td>${esc(r.email)}${r.isTest ? ` <span class="chip c-paused">test</span>` : ""}<div class="fine">${esc(r.contactName)}</div></td>
<td class="n">${r.reach.toLocaleString("en-US")}<div class="fine">${esc(r.channel)}</div>${r.note ? `<div class="fine">${esc(r.note)}</div>` : ""}</td><td><a href="/ads/admin/hub-proof/${esc(r.id)}/file" target="_blank" rel="noopener">View proof</a></td>
<td><span class="chip ${r.status === "approved" ? "c-approved" : r.status === "pending" ? "c-draft" : "c-paused"}">${esc(r.status)}</span>${r.reviewer ? `<div class="fine">${esc(r.reviewer)}</div>` : ""}</td>
<td>${r.status === "pending" ? `<form data-post="/ads/admin/hub-proof/${esc(r.id)}/approve" data-reload style="display:inline"><button class="sm" type="submit">Approve $100</button></form> <form data-post="/ads/admin/hub-proof/${esc(r.id)}/reject" data-reload style="display:inline"><input name="note" placeholder="Reason (optional)" maxlength="200" style="width:140px"><button class="danger sm" type="submit">Reject</button></form>` : ""}</td></tr>`,
    )
    .join("");
  return `<section id="hubproof"><h2>Hub activation proofs</h2><p class="fine">Hub owners who show a send to 1,000+ people earn one $100 USD ad credit per hub. Approve issues it through the promo credit system (own campaign, regular rates; visible in Promo codes → Redemptions and the owner's /account). Form: <a href="/hub-proof">/hub-proof</a>.</p>
<div class="tw"><table><thead><tr><th>When</th><th>Hub</th><th>Contact</th><th class="n">Reach</th><th>Proof</th><th>Status</th><th></th></tr></thead><tbody>${tr || `<tr><td colspan="7" class="muted">No submissions yet.</td></tr>`}</tbody></table></div></section>`;
}
