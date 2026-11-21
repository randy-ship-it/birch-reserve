/**
 * One shared layout for every Birch Reserve email (Randy voice Nov 21 2026 1:36 PM): the same design tokens as /intake
 * (navy ink, warm paper, lime pill CTA, white rounded card, serif headline, birch-branch mark), so templates can't drift.
 * Table-based with inline styles only: renders in Gmail desktop and mobile. The logo rides inline (cid:br-mark),
 * attached automatically by resendSend, so it never depends on a hosted image.
 */
import { BR_MARK_CID } from "./emailBrandMark";
import { SCALE_LOGO_CID } from "./emailScaleMark";

export const EMAIL_TOKENS = {
  ink: "#071A39", // /intake body + headline colour
  paper: "#F9F8F6", // /intake page background
  card: "#FFFFFF",
  line: "#E3E6EC", // ink at ~10%
  muted: "#52617A", // /intake secondary copy
  eyebrow: "#6B7487", // ink at ~55%
  lime: "#C8F55A", // /intake CTA (--accent)
  limeSoft: "#ECFCCB", // /intake hero wash
  forest: "#0E3B2A", // /intake kit preview panel
  sans: "'IBM Plex Sans',Arial,Helvetica,sans-serif",
  serif: "Fraunces,Georgia,'Times New Roman',serif",
} as const;
const T = EMAIL_TOKENS;

/** Scale-mirror skin (scalehealth.ca/intake): Plus Jakarta Sans, ink #0d1426, page #f9fafb, Scale green #1d875c (index.css data-skin=scale). */
export const SCALE_EMAIL_TOKENS = {
  ink: "#0D1426",
  paper: "#F9FAFB",
  card: "#FFFFFF",
  line: "#E5E7EB",
  muted: "#4B5563",
  eyebrow: "#6B7280",
  green: "#1D875C",
  greenSoft: "#E8F5EE",
  sans: "'Plus Jakarta Sans',Arial,Helvetica,sans-serif",
} as const;
export type EmailBrand = "birch" | "scale";

export const escEmail = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Lime pill button, navy text (the /intake "Get my Monetization Kit" button). */
export function emailButton(href: string, label: string, brand: EmailBrand = "birch"): string {
  if (brand === "scale") {
    const S = SCALE_EMAIL_TOKENS;
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="background:${S.green};border-radius:999px"><a href="${escEmail(href)}" style="display:inline-block;padding:14px 24px;font-family:${S.sans};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px">${escEmail(label)}&nbsp;&rarr;</a></td></tr></table>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="background:${T.lime};border-radius:999px"><a href="${escEmail(href)}" style="display:inline-block;padding:14px 24px;font-family:${T.sans};font-size:15px;font-weight:700;color:${T.ink};text-decoration:none;border-radius:999px">${escEmail(label)}&nbsp;&rarr;</a></td></tr></table>`;
}
export const emailH1 = (html: string): string => `<h1 style="margin:0 0 10px;font-family:${T.serif};font-weight:400;font-size:28px;line-height:1.18;color:${T.ink}">${html}</h1>`;
export const emailH2 = (html: string): string => `<h2 style="margin:22px 0 8px;font-family:${T.sans};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.eyebrow}">${html}</h2>`;
export const emailP = (html: string, opts: { muted?: boolean; small?: boolean } = {}): string =>
  `<p style="margin:0 0 12px;font-family:${T.sans};font-size:${opts.small ? 13 : 15}px;line-height:1.6;color:${opts.muted ? T.muted : T.ink}">${html}</p>`;
export const emailTestBanner = (html: string): string =>
  `<p style="margin:0 0 16px;padding:10px 14px;background:${T.limeSoft};border-radius:12px;font-family:${T.sans};font-size:13px;color:${T.ink}">${html}</p>`;
/** Label / value rows (lead and order alerts). Values are pre-escaped HTML. */
export function emailRows(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 8px">${rows
    .map(([k, v]) => `<tr><td valign="top" style="padding:8px 12px 8px 0;border-bottom:1px solid ${T.line};font-family:${T.sans};font-size:13px;color:${T.muted};width:34%">${escEmail(k)}</td><td valign="top" style="padding:8px 0;border-bottom:1px solid ${T.line};font-family:${T.sans};font-size:14px;color:${T.ink};word-break:break-word">${v}</td></tr>`)
    .join("")}</table>`;
}

export type EmailLayout = { title: string; preheader?: string; eyebrow?: string; body: string; footer?: string; brand?: EmailBrand };
export function emailLayout(o: EmailLayout): string {
  if (o.brand === "scale") return scaleEmailLayout(o);
  const foot = o.footer ?? `Birch Reserve · <a href="https://birchreserve.net" style="color:${T.muted}">birchreserve.net</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escEmail(o.title)}</title></head>
<body style="margin:0;padding:0;background:${T.paper};color:${T.ink};font-family:${T.sans}">
${o.preheader ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escEmail(o.preheader)}</span>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="middle"><img src="cid:${BR_MARK_CID}" width="32" height="32" alt="" style="display:block;border:0;border-radius:8px"></td><td valign="middle" style="padding-left:10px;font-family:${T.serif};font-style:italic;font-size:21px;color:${T.ink}">Birch Reserve</td></tr></table></td></tr>
<tr><td style="background:${T.card};border:1px solid ${T.line};border-radius:24px;padding:28px 24px">
${o.eyebrow ? `<p style="margin:0 0 10px;font-family:${T.sans};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${T.eyebrow}">${escEmail(o.eyebrow)}</p>` : ""}${o.body}
</td></tr>
<tr><td style="padding:16px 8px 0;font-family:${T.sans};font-size:12px;line-height:1.6;color:${T.muted}">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Same structure as emailLayout, in the Scale mirror skin with the ScaleHealth wordmark (cid:scale-logo). */
function scaleEmailLayout(o: EmailLayout): string {
  const S = SCALE_EMAIL_TOKENS;
  const foot = o.footer ?? `ScaleHealth · <a href="https://www.scalehealth.ca/intake" style="color:${S.muted}">scalehealth.ca</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escEmail(o.title)}</title></head>
<body style="margin:0;padding:0;background:${S.paper};color:${S.ink};font-family:${S.sans}">
${o.preheader ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escEmail(o.preheader)}</span>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${S.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 4px 16px"><img src="cid:${SCALE_LOGO_CID}" width="177" height="34" alt="ScaleHealth" style="display:block;border:0;border-radius:2px"></td></tr>
<tr><td style="background:${S.card};border:1px solid ${S.line};border-radius:20px;padding:28px 24px">
${o.eyebrow ? `<p style="margin:0 0 10px;font-family:${S.sans};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${S.green}">${escEmail(o.eyebrow)}</p>` : ""}${o.body}
</td></tr>
<tr><td style="padding:16px 8px 0;font-family:${S.sans};font-size:12px;line-height:1.6;color:${S.muted}">${foot}</td></tr>
</table></td></tr></table></body></html>`;
}
