/**
 * Ad-system emails. The login link goes out only when ADS_LOGIN_EMAIL_ENABLED=true, and new-hub alerts only when
 * ADS_HUB_ALERT_EMAIL_ENABLED=true (Randy approved turning both on after QA, Nov 21 2026 1:10 PM).
 * Preview the copy at /ads/admin/email-preview (admin only).
 */
import { sendBuyerEmail } from "../siteMail";
import { transcriptFrom } from "../randyChatTranscripts";
import { esc } from "./ui";
import { EMAIL_TOKENS, emailButton, emailLayout, emailP } from "../emailLayout";

export const ADS_FROM = () => process.env.ADS_EMAIL_FROM?.trim() || transcriptFrom() // existing verified Birch sender; no new sender;

export function loginLinkEmail(link: string): { subject: string; text: string; html: string } {
  const subject = "Your Birch Reserve ad dashboard link";
  const text = `Here's your sign-in link for your Birch Reserve ad dashboard:\n\n${link}\n\nIt works for 24 hours. If you didn't ask for it, you can ignore this email.\n\nBirch Reserve\nrandy@scalehealth.ca`;
  const html = emailLayout({
    title: subject,
    preheader: "Your sign-in link (works for 24 hours)",
    eyebrow: "Birch Reserve · Ad dashboard",
    body: emailP("Here's your sign-in link for your Birch Reserve ad dashboard:") + emailButton(link, "Open my dashboard") + emailP("It works for 24 hours. If you didn't ask for it, you can ignore this email.", { muted: true, small: true }),
    footer: "Birch Reserve · randy@scalehealth.ca",
  });
  return { subject, text, html };
}

export function hubAlertEmail(o: { hubName: string; category: string; hubUrl: string; unsubscribeUrl?: string }): { subject: string; text: string; html: string } {
  const subject = `New private hub: ${o.hubName} (${o.category})`;
  const off = o.unsubscribeUrl ?? "https://birchreserve.net/account#alerts";
  const text = `${o.hubName}, a private hub with members in ${o.category}, now takes placements on Birch Reserve.\n\nSee it and add it to your campaign from your dashboard: https://birchreserve.net/account#hubs\n\nYou asked for alerts on ${o.category}. Stop these emails: ${off}\n\nBirch Reserve\nrandy@scalehealth.ca`;
  const html = emailLayout({
    title: subject,
    preheader: `${o.hubName} now takes placements`,
    eyebrow: "Birch Reserve · New private hub",
    body: emailP(`<b>${esc(o.hubName)}</b>, a private hub with members in ${esc(o.category)}, now takes placements on Birch Reserve.`) + emailButton("https://birchreserve.net/account#hubs", "See the hub"),
    footer: `You asked for alerts on ${esc(o.category)}. <a href="${esc(off)}" style="color:${EMAIL_TOKENS.muted}">Stop these emails</a> or <a href="https://birchreserve.net/account#alerts" style="color:${EMAIL_TOKENS.muted}">change categories</a>.<br>Birch Reserve · randy@scalehealth.ca`,
  });
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
