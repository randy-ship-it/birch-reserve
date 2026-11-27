import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { kitFlags, kitFrom, readToken, recipientAllowed, renderKitEmail, renderNudgeEmail, signToken, sweepNudges, NUDGE_AFTER_MS, type NudgeStore, type AbandonedLead } from "../src/lib/kitEmails";
import { createKitEmailRouter } from "../src/routes/kitEmail";
import { cleanPhysical, inLocationReach, physicalBlurb } from "../src/lib/overhaul/inLocation";
import { cleanLeadMeta } from "../src/lib/leads";

const SECRET = "0123456789abcdef0123";
const PROD = { VERCEL_ENV: "production", KIT_EMAIL_ENABLED: "on", KIT_NUDGE_ENABLED: "on", KIT_EMAIL_SECRET: SECRET } as NodeJS.ProcessEnv;
const PREVIEW = { ...PROD, VERCEL_ENV: "preview" } as NodeJS.ProcessEnv;
const BANNED = /friday|clairvoyant|80 locations|guarantee[ds]? (results|views|sales)|\bCTR\b|ROAS|\bAlign\b(?!=)/i;

test("flags default OFF; only the exact value on turns them on", () => {
  assert.deepEqual(kitFlags({} as NodeJS.ProcessEnv), { kit: false, nudge: false, production: false });
  assert.equal(kitFlags({ KIT_EMAIL_ENABLED: "true" } as NodeJS.ProcessEnv).kit, false);
  assert.equal(kitFlags({ KIT_EMAIL_ENABLED: "on" } as NodeJS.ProcessEnv).kit, true);
});

test("recipients: nobody when off; previews only test+ addresses; sender never names the CRM", () => {
  assert.equal(recipientAllowed("a@b.com", false, PROD), false);
  assert.equal(recipientAllowed("a@b.com", true, PREVIEW), false);
  assert.equal(recipientAllowed("test+kit@silverbirchgrowth.com", true, PREVIEW), true);
  assert.equal(recipientAllowed("a@b.com", true, PROD), true);
  assert.equal(kitFrom({ KIT_EMAIL_FROM: "Friday <x@friday.ai>" } as NodeJS.ProcessEnv), "Birch Reserve <kit@birchreserve.net>");
});

test("signed tokens: round trip, tamper and expiry fail", () => {
  const t = signToken({ k: "resume", id: "abc", e: "x@y.com", exp: Date.now() + 1000 }, SECRET);
  assert.equal(readToken(t, SECRET)?.id, "abc");
  assert.equal(readToken(t + "x", SECRET), null);
  assert.equal(readToken(t, "another-secret-value"), null);
  assert.equal(readToken(t, SECRET, Date.now() + 5000), null);
});

test("templates: Birch sender copy, kit link, PDF line, one reminder + unsubscribe, no banned words", () => {
  const k = renderKitEmail({ brand: "Acme", reportUrl: "https://birchreserve.net/kit/r/tok", headline: { exposureMonth: "1.2MM", earningsMonth: "$1,240" }, hasPdf: true });
  assert.match(k.subject, /Monetization Kit/);
  assert.match(k.html, /Open my Monetization Kit/);
  assert.match(k.html, /kit\/r\/tok/);
  assert.match(k.html, /attached as a PDF/);
  const n = renderNudgeEmail({ resumeUrl: "https://birchreserve.net/intake?resume=t", unsubscribeUrl: "https://birchreserve.net/v1/kit-unsubscribe?t=u", website: "acme.com" });
  assert.match(n.html, /only reminder/);
  assert.match(n.html, /Unsubscribe/);
  for (const s of [k.html, k.text, n.html, n.text]) assert.doesNotMatch(s, BANNED);
});

function memStore(leads: Array<AbandonedLead & { stage: string; nudged?: boolean; unsub?: boolean; roles?: string[] }>): NudgeStore {
  return {
    async listAbandoned(older) { return leads.filter((l) => l.stage === "abandoned" && !l.nudged && !l.unsub && l.updatedAt < older); },
    async claimNudge(id) { const l = leads.find((x) => x.id === id); if (!l || l.nudged || l.unsub || l.stage !== "abandoned") return false; l.nudged = true; return true; },
    async unsubscribe(id) { const l = leads.find((x) => x.id === id); if (l) l.unsub = true; },
    async get(id) { const l = leads.find((x) => x.id === id); return l ? { email: l.email, website: l.website, roles: l.roles ?? ["supplier"] } : null; },
  };
}

test("nudge sweep: off by default; after 1h; ONE nudge max; skips submitted, fresh and unsubscribed", async () => {
  const now = new Date("2026-11-19T18:00:00Z");
  const old = new Date(now.getTime() - NUDGE_AFTER_MS - 1000);
  const leads = [
    { id: "a", email: "a@brand.com", website: "a.com", updatedAt: old, stage: "abandoned" },
    { id: "b", email: "b@brand.com", website: null, updatedAt: new Date(now.getTime() - 60_000), stage: "abandoned" },
    { id: "c", email: "c@brand.com", website: null, updatedAt: old, stage: "submitted" },
    { id: "d", email: "d@brand.com", website: null, updatedAt: old, stage: "abandoned", unsub: true },
  ];
  const sent: Array<{ to: string[]; html: string; headers?: Record<string, string> }> = [];
  const mail = async (m: { to: string[]; html: string; headers?: Record<string, string> }) => { sent.push(m); };
  assert.deepEqual(await sweepNudges(memStore(leads), mail, {} as NodeJS.ProcessEnv, now), { sent: 0, skipped: 0, disabled: true });
  const r1 = await sweepNudges(memStore(leads), mail, PROD, now);
  assert.equal(r1.sent, 1);
  assert.deepEqual(sent.map((m) => m.to[0]), ["a@brand.com"]);
  assert.match(sent[0]!.html, /intake\?resume=/);
  assert.match(sent[0]!.headers?.["List-Unsubscribe"] ?? "", /kit-unsubscribe\?t=/);
  const r2 = await sweepNudges(memStore(leads), mail, PROD, new Date(now.getTime() + 864e5));
  assert.equal(sent.filter((m) => m.to[0] === "a@brand.com").length, 1, "never a second nudge");
  assert.deepEqual(sent.map((m) => m.to[0]), ["a@brand.com", "b@brand.com"], "b is due a day later; c (submitted) and d (unsubscribed) never");
  assert.equal(r2.sent, 1);
  await sweepNudges(memStore(leads), mail, PROD, new Date(now.getTime() + 2 * 864e5));
  assert.equal(sent.length, 2);
});

test("nudge sweep on a preview only mails test+ addresses", async () => {
  const now = new Date();
  const leads = [{ id: "x", email: "real@brand.com", website: null, updatedAt: new Date(now.getTime() - 2 * NUDGE_AFTER_MS), stage: "abandoned" }];
  const sent: unknown[] = [];
  const r = await sweepNudges(memStore(leads), async (m) => { sent.push(m); }, PREVIEW, now);
  assert.equal(sent.length, 0);
  assert.equal(r.skipped, 1);
});

async function serve(deps: Parameters<typeof createKitEmailRouter>[0]) {
  const app = express();
  app.set("trust proxy", false);
  app.use(createKitEmailRouter(deps));
  const s = app.listen(0);
  await new Promise((r) => s.once("listening", r));
  return { url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, close: () => { s.closeAllConnections(); s.close(); } };
}
const PDF_B64 = Buffer.from("%PDF-1.4 test").toString("base64");

test("POST /v1/kit-email: disabled by default, sends nothing", async () => {
  const sent: unknown[] = [];
  const s = await serve({ env: {} as NodeJS.ProcessEnv, mail: async (m) => { sent.push(m); } });
  const r = await fetch(`${s.url}/v1/kit-email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "test+a@silverbirchgrowth.com", report_path: "/kit/r/abcdefgh123", pdf_b64: PDF_B64 }) });
  assert.equal(r.status, 202);
  assert.deepEqual(await r.json(), { sent: false, reason: "disabled" });
  assert.equal(sent.length, 0);
  s.close();
});

test("POST /v1/kit-email: production needs a submitted lead with the same email; attaches only a real PDF", async () => {
  const sent: Array<{ to: string[]; attachments?: unknown[] }> = [];
  const s = await serve({ env: PROD, mail: async (m) => { sent.push(m as never); }, lead: async (id) => (id === "rec1" ? { email: "owner@brand.com", stage: "submitted" } : id === "rec2" ? { email: "owner@brand.com", stage: "abandoned" } : null) });
  const post = (b: Record<string, unknown>) => fetch(`${s.url}/v1/kit-email`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ report_path: "/kit/r/abcdefgh123", ...b }) }).then((r) => r.json());
  assert.equal((await post({ email: "owner@brand.com", intake_id: "rec2" })).reason, "not_submitted");
  assert.equal((await post({ email: "other@brand.com", intake_id: "rec1" })).reason, "not_submitted");
  assert.equal((await post({ email: "owner@brand.com", intake_id: "rec1", pdf_b64: Buffer.from("nope").toString("base64") })).sent, true);
  assert.equal(sent[0]!.attachments, undefined);
  assert.equal((await post({ email: "owner@brand.com", intake_id: "rec1", pdf_b64: PDF_B64 })).sent, true);
  assert.equal(sent.length, 2);
  assert.equal((sent[1]!.attachments as Array<{ filename: string }>)[0]!.filename, "birch-reserve-monetization-kit.pdf");
  s.close();
});

test("resume + unsubscribe tokens", async () => {
  const leads = [{ id: "r1", email: "test+r@silverbirchgrowth.com", website: "acme.com", updatedAt: new Date(), stage: "abandoned", roles: ["supplier", "publisher"] }];
  const store = memStore(leads);
  const s = await serve({ env: PREVIEW, store: async () => store });
  const t = signToken({ k: "resume", id: "r1", e: leads[0]!.email, exp: Date.now() + 60_000 }, SECRET);
  const r = await fetch(`${s.url}/v1/kit-resume?t=${t}`).then((x) => x.json());
  assert.deepEqual(r, { email: leads[0]!.email, website: "acme.com", roles: ["supplier", "publisher"] });
  assert.equal((await fetch(`${s.url}/v1/kit-resume?t=bad`)).status, 404);
  const u = signToken({ k: "unsub", id: "r1", e: leads[0]!.email, exp: Date.now() + 60_000 }, SECRET);
  const page = await fetch(`${s.url}/v1/kit-unsubscribe?t=${u}`).then((x) => x.text());
  assert.match(page, /unsubscribed/);
  assert.equal((leads[0] as { unsub?: boolean }).unsub, true);
  assert.equal((await fetch(`${s.url}/api/cron/kit-nudges`)).status, 401);
  s.close();
});

test("lead meta keeps nudged_at / unsub across later merges", () => {
  assert.deepEqual(cleanLeadMeta({ stage: "abandoned", nudged_at: "2026-11-19T18:00:00Z", unsub: "x", junk: "y" }), { stage: "abandoned", nudged_at: "2026-11-19T18:00:00Z", unsub: "x" });
});

test("in-location display: their numbers only, per location or total, labelled blurb, no rate", () => {
  assert.equal(cleanPhysical({ has: false })?.has, false);
  assert.deepEqual(inLocationReach(cleanPhysical({ has: true, locations: 4, visitors_month: 2500, basis: "per_location" })), { locations: 4, monthlyVisits: 10_000 });
  assert.deepEqual(inLocationReach(cleanPhysical({ has: true, locations: 4, visitors_month: 9000, basis: "total" })), { locations: 4, monthlyVisits: 9000 });
  assert.equal(inLocationReach(cleanPhysical({ has: true, visitors_month: 9000 })), null);
  const b = physicalBlurb(cleanPhysical({ has: true, locations: 4, visitors_month: 2500 }))!;
  assert.match(b, /4 locations; 2500 visitors \/ month \(per location\); ≈ 10000 in-person visits/);
  assert.match(b, /priced by IO/);
  assert.doesNotMatch(b, /\$/);
  assert.equal(physicalBlurb(cleanPhysical({ has: false })), "Physical locations: no.");
});

test("templates: Scale mirror kit email is ScaleHealth-branded, no Birch, modelled-estimate label, own sender", () => {
  const k = renderKitEmail({ site: "scale", brand: "Acme", reportUrl: "https://www.scalehealth.ca/intake/_m/kit/r/tok", headline: { exposureMonth: "1.2MM", earningsMonth: "$1,240" }, hasPdf: true, activateUrl: "https://www.scalehealth.ca/intake/activate?role=supplier" });
  assert.match(k.subject, /from Scale Health$/);
  assert.match(k.html, /cid:scale-logo/);
  assert.doesNotMatch(k.html, /cid:br-mark/);
  assert.match(k.html, /#1D875C/);
  for (const s of [k.html, k.text]) {
    assert.doesNotMatch(s, /Birch|birchreserve/i);
    assert.doesNotMatch(s, /exclusive|\breserv|\block|25%|promo|coupon/i);
    assert.doesNotMatch(s, BANNED);
    assert.match(s, /Modelled estimates from listed partners/);
  }
  const b = renderKitEmail({ brand: "Acme", reportUrl: "https://birchreserve.net/kit/r/tok", hasPdf: false });
  assert.match(b.subject, /from Birch Reserve$/);
  assert.match(b.html, /cid:br-mark/);
  assert.doesNotMatch(b.html, /cid:scale-logo/);
  assert.equal(kitFrom({} as NodeJS.ProcessEnv, "scale"), "Scale Health <kit@scalehealth.ca>");
  assert.equal(kitFrom({ KIT_EMAIL_FROM_SCALE: "Scale Health <care@scalehealth.ca>" } as NodeJS.ProcessEnv, "scale"), "Scale Health <care@scalehealth.ca>");
  assert.equal(kitFrom({} as NodeJS.ProcessEnv), "Birch Reserve <kit@birchreserve.net>");
});

test("POST /v1/kit-email: a Scale mirror sign-up (Origin www.scalehealth.ca or site=scale) gets the ScaleHealth email and sender", async () => {
  const sent: Array<{ from: string; subject: string; html: string; attachments?: Array<{ filename: string }> }> = [];
  const s = await serve({ env: PROD, mail: async (m) => { sent.push(m as never); return { id: "re_test" }; }, lead: async () => ({ email: "scale-owner@brand.com", stage: "submitted" }) });
  const post = (b: Record<string, unknown>, h: Record<string, string> = {}) => fetch(`${s.url}/v1/kit-email`, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify({ report_path: "/kit/r/abcdefgh123", email: "scale-owner@brand.com", intake_id: "rec1", pdf_b64: PDF_B64, ...b }) }).then((r) => r.json());
  assert.deepEqual(await post({}, { origin: "https://www.scalehealth.ca" }), { sent: true, site: "scale", id: "re_test" });
  assert.equal(sent[0]!.from, "Scale Health <kit@scalehealth.ca>");
  assert.match(sent[0]!.subject, /Scale Health/);
  assert.match(sent[0]!.html, /https:\/\/www\.scalehealth\.ca\/intake\/_m\/kit\/r\/abcdefgh123/);
  assert.equal(sent[0]!.attachments![0]!.filename, "scalehealth-monetization-kit.pdf");
  assert.equal((await post({ site: "birch" }, { "x-forwarded-for": "10.0.0.2" })).site, "birch");
  assert.equal(sent[1]!.from, "Birch Reserve <kit@birchreserve.net>");
  s.close();
});
