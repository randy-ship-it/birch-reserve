/**
 * Monetization Kit emails (Randy, Nov 19 2026 10:54 AM ET). Flags default OFF; see lib/kitEmails.ts.
 *   POST /v1/kit-email          the kit to the submitter (link + client-rendered PDF). Production: only for a BR lead
 *                               row brandintake:<id> with the same email at stage "submitted". Previews: test+ only.
 *   GET  /v1/kit-resume?t=      signed resume token → { email, website, roles } to prefill the form.
 *   GET  /v1/kit-unsubscribe?t= signed unsubscribe token → no further reminders (HTML page).
 *   GET  /api/cron/kit-nudges   ONE drop-off nudge per abandoned partial lead (>1h). Bearer CRON_SECRET. Not scheduled
 *                               in vercel.json until Randy turns it on.
 */
import express, { Router, type IRouter, type Request } from "express";
import { cronAuthorized } from "../lib/cronAuth";
import { kitFlags, kitFrom, readToken, recipientAllowed, renderKitEmail, sweepNudges, SITE, type Mailer, type NudgeStore } from "../lib/kitEmails";

type Env = NodeJS.ProcessEnv;
export type KitLeadLookup = (id: string) => Promise<{ email: string | null; stage: string | null } | null>;
export type KitEmailDeps = { env?: Env; mail?: Mailer; store?: () => Promise<NudgeStore>; lead?: KitLeadLookup; now?: () => number };

const PDF_MAX_B64 = 3_400_000; // ~2.5 MB of PDF
const REPORT_PATH_RE = /^\/kit\/r\/[A-Za-z0-9_-]{8,200}$/;
const hits = new Map<string, number[]>();
function limited(key: string, now: number, max = 5, windowMs = 10 * 60_000): boolean {
  const xs = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  xs.push(now);
  hits.set(key, xs);
  if (hits.size > 5000) hits.clear();
  return xs.length > max;
}
const ipOf = (req: Request) => req.ip ?? "?";

async function defaultMail(m: Parameters<Mailer>[0] & { attachments?: Array<{ filename: string; content: string }> }) {
  const { resendSend, birchReplyTo } = await import("../lib/siteMail");
  return resendSend({ from: m.from, to: m.to, subject: m.subject, text: m.text, html: m.html, replyTo: birchReplyTo(), attachments: m.attachments, headers: m.headers });
}
async function defaultStore(): Promise<NudgeStore> {
  const { PgNudgeStore } = await import("../lib/kitNudgeStore");
  return new PgNudgeStore();
}
async function defaultLead(id: string) {
  const { getLeadStore } = await import("../lib/leads");
  const l = await getLeadStore().get(`brandintake:${id}`.slice(0, 200));
  return l ? { email: l.email ?? null, stage: l.meta?.stage ?? null } : null;
}

export function createKitEmailRouter(deps: KitEmailDeps = {}): IRouter {
  const env = () => deps.env ?? process.env;
  const now = () => (deps.now ? deps.now() : Date.now());
  const mail = (deps.mail ?? defaultMail) as (m: Parameters<Mailer>[0] & { attachments?: Array<{ filename: string; content: string }> }) => Promise<unknown>;
  const r: IRouter = Router();

  r.post("/v1/kit-email", express.json({ limit: "3600kb" }), async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const e = env();
    const f = kitFlags(e);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!f.kit) { res.status(202).json({ sent: false, reason: "disabled" }); return; }
    if (!recipientAllowed(email, true, e)) { res.status(202).json({ sent: false, reason: "recipient_not_allowed" }); return; }
    if (limited(`ip:${ipOf(req)}`, now(), 10)) { res.status(429).json({ sent: false, reason: "rate_limited" }); return; }
    const id = typeof b.intake_id === "string" ? b.intake_id.slice(0, 160) : "";
    const reportPath = typeof b.report_path === "string" && REPORT_PATH_RE.test(b.report_path) ? b.report_path : null;
    if (!reportPath) { res.status(400).json({ sent: false, reason: "report_path" }); return; }
    if (f.production) {
      const lead = id ? await (deps.lead ?? defaultLead)(id).catch(() => null) : null;
      if (!lead || lead.email?.toLowerCase() !== email || lead.stage !== "submitted") { res.status(202).json({ sent: false, reason: "not_submitted" }); return; }
    }
    if (limited(`to:${email}`, now(), 2, 60 * 60_000)) { res.status(429).json({ sent: false, reason: "rate_limited" }); return; }
    let pdf: string | null = null;
    if (typeof b.pdf_b64 === "string" && b.pdf_b64.length <= PDF_MAX_B64) {
      const head = Buffer.from(b.pdf_b64.slice(0, 12), "base64").toString("latin1");
      if (head.startsWith("%PDF")) pdf = b.pdf_b64;
    }
    const brand = typeof b.brand === "string" ? b.brand.slice(0, 80) : null;
    const h = (b.headline ?? {}) as Record<string, unknown>;
    const s = (x: unknown) => (typeof x === "string" && /^[\w$.,–\- +%MKB/]{1,24}$/.test(x) ? x : undefined);
    const m = renderKitEmail({ brand, reportUrl: `${SITE}${reportPath}`, headline: { exposureMonth: s(h.exposureMonth), earningsMonth: s(h.earningsMonth) }, hasPdf: !!pdf });
    try {
      await mail({ from: kitFrom(e), to: [email], subject: m.subject, html: m.html, text: m.text, ...(pdf ? { attachments: [{ filename: "birch-reserve-monetization-kit.pdf", content: pdf }] } : {}) });
      res.json({ sent: true });
    } catch {
      res.status(502).json({ sent: false, reason: "send_failed" });
    }
  });

  r.get("/v1/kit-resume", async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const secret = env().KIT_EMAIL_SECRET?.trim() ?? "";
    const t = secret.length >= 16 ? readToken(String(req.query.t ?? ""), secret, now()) : null;
    if (!t || t.k !== "resume") { res.status(404).json({ error: "expired" }); return; }
    const l = await (deps.store ?? defaultStore)().then((s) => s.get(t.id)).catch(() => null);
    if (!l || l.email.toLowerCase() !== t.e.toLowerCase()) { res.status(404).json({ error: "expired" }); return; }
    res.json({ email: l.email, website: l.website ?? "", roles: l.roles });
  });

  r.get("/v1/kit-unsubscribe", async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const secret = env().KIT_EMAIL_SECRET?.trim() ?? "";
    const t = secret.length >= 16 ? readToken(String(req.query.t ?? ""), secret, now()) : null;
    if (t?.k === "unsub") await (deps.store ?? defaultStore)().then((s) => s.unsubscribe(t.id, t.e, new Date(now()))).catch(() => undefined);
    res.status(t ? 200 : 400).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Birch Reserve</title><body style="font-family:Helvetica,Arial,sans-serif;background:#F6F4EE;color:#0B1F17;padding:48px 20px;text-align:center"><h1 style="font-family:Georgia,serif;font-weight:normal">${t ? "You're unsubscribed." : "That link has expired."}</h1><p>${t ? "We won't send any more reminders about your Monetization Kit." : "No reminder will be sent without a valid link."}</p><p><a href="${SITE}" style="color:#0E3B2A">birchreserve.net</a></p></body>`);
  });

  r.get("/api/cron/kit-nudges", async (req, res): Promise<void> => {
    if (!cronAuthorized(req.headers.authorization, env().CRON_SECRET)) { res.status(401).json({ error: "unauthorized" }); return; }
    const out = await sweepNudges(await (deps.store ?? defaultStore)(), mail, env(), new Date(now())).catch(() => ({ sent: 0, skipped: 0, error: true }));
    res.json(out);
  });
  return r;
}
