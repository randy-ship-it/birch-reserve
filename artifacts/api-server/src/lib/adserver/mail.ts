/**
 * Ad-system emails. The login link goes out only when ADS_LOGIN_EMAIL_ENABLED=true, and new-hub alerts only when
 * ADS_HUB_ALERT_EMAIL_ENABLED=true (Randy approved turning both on after QA, Nov 21 2026 1:10 PM).
 * Preview the copy at /ads/admin/email-preview (admin only).
 */
import { sendBuyerEmail } from "../siteMail";
import { transcriptFrom } from "../randyChatTranscripts";
import { esc } from "./ui";

export const ADS_FROM = () => process.env.ADS_EMAIL_FROM?.trim() || transcriptFrom() // existing verified Birch sender; no new sender;

export function loginLinkEmail(link: string): { subject: string; text: string; html: string } {
  const subject = "Your Birch Reserve ad dashboard link";
  const text = `Here's your sign-in link for your Birch Reserve ad dashboard:\n\n${link}\n\nIt works for 24 hours. If you didn't ask for it, you can ignore this email.\n\nBirch Reserve\nsales@silverbirchgrowth.com`;
  const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#071A39;background:#ffffff;max-width:520px"><p>Here's your sign-in link for your Birch Reserve ad dashboard:</p><p><a href="${esc(link)}" style="display:inline-block;background:#071A39;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">Open my dashboard</a></p><p style="color:#566476;font-size:13px">It works for 24 hours. If you didn't ask for it, you can ignore this email.</p><p>Birch Reserve<br>sales@silverbirchgrowth.com</p></div>`;
  return { subject, text, html };
}

export function hubAlertEmail(o: { hubName: string; category: string; hubUrl: string; unsubscribeUrl?: string }): { subject: string; text: string; html: string } {
  const subject = `New private hub: ${o.hubName} (${o.category})`;
  const off = o.unsubscribeUrl ?? "https://birchreserve.net/account#alerts";
  const text = `${o.hubName}, a private hub with members in ${o.category}, now takes placements on Birch Reserve.\n\nSee it and add it to your campaign from your dashboard: https://birchreserve.net/account#hubs\n\nYou asked for alerts on ${o.category}. Stop these emails: ${off}\n\nBirch Reserve\nsales@silverbirchgrowth.com`;
  const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#071A39;background:#ffffff;max-width:520px"><p><b>${esc(o.hubName)}</b>, a private hub with members in ${esc(o.category)}, now takes placements on Birch Reserve.</p><p><a href="https://birchreserve.net/account#hubs" style="display:inline-block;background:#071A39;color:#ffffff;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:600">See the hub</a></p><p style="color:#566476;font-size:13px">You asked for alerts on ${esc(o.category)}. <a href="${esc(off)}" style="color:#566476">Stop these emails</a> or <a href="https://birchreserve.net/account#alerts" style="color:#566476">change categories</a>.</p><p>Birch Reserve<br>sales@silverbirchgrowth.com</p></div>`;
  return { subject, text, html };
}

export const siteMail = {
  async loginLink(to: string, link: string): Promise<void> {
    if (process.env.ADS_LOGIN_EMAIL_ENABLED !== "true") return;
    const m = loginLinkEmail(link);
    await sendBuyerEmail({ from: ADS_FROM(), to: [to], ...m });
  },
  /** Send a new-hub alert once to one opted-in subscriber (caller dedupes). */
  async hubAlert(to: string, hub: { hubName: string; category: string; hubUrl: string }, unsubscribeUrl: string): Promise<void> {
    if (process.env.ADS_HUB_ALERT_EMAIL_ENABLED !== "true") return;
    await sendBuyerEmail({ from: ADS_FROM(), to: [to], ...hubAlertEmail({ ...hub, unsubscribeUrl }) });
  },
};
