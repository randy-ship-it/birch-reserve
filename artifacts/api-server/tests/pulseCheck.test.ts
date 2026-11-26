/** Rapid pulse check: validation, honeypot, throttles, TEST skips CRM, team alert, no submitter email, export auth. */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import { createPulseCheckRouter, PULSE_CONFIRMATION } from "../src/routes/pulseCheck";
import { MemoryPulseStore, sheetRowOf } from "../src/lib/pulseCheck";
import type { SalesAlert } from "../src/lib/salesAlert";

const store = new MemoryPulseStore();
const alerts: SalesAlert[] = [];
const crm: Array<Record<string, unknown>> = [];
let crmStatus: "sent" | "failed" = "sent";
const KEY = "k".repeat(32);
const router = createPulseCheckRouter({
  store,
  sendIntake: async (i) => { crm.push(i as unknown as Record<string, unknown>); return { status: crmStatus, externalId: "x" }; },
  sendAlert: async (a) => { alerts.push(a); return { status: "sent", id: "mail-1", to: ["randy@scalehealth.ca"] }; },
  exportKey: () => KEY,
});
let base = "";
let close: () => Promise<void>;

before(async () => {
  const app = express();
  app.use(router);
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("port");
  base = `http://127.0.0.1:${a.port}`;
  close = () => new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
});
after(async () => close());
beforeEach(() => { store.rows = []; alerts.length = 0; crm.length = 0; crmStatus = "sent"; router.resetLimits(); });

const BLURB = "We run paid social for DTC supplement and recovery brands selling to active adults in Ontario.";
const post = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  fetch(`${base}/v1/pulse-check`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

test("validation: needs a real email and a few sentences", async () => {
  assert.equal((await post({ email: "nope", blurb: BLURB })).status, 400);
  assert.equal((await post({ email: "a@agency.com", blurb: "short" })).status, 400);
  assert.equal((await post({ email: "a@agency.com", blurb: "x".repeat(1600) })).status, 400);
  assert.equal(store.rows.length, 0);
});

test("real submission: row stored, CRM written, team alert tagged by source, nothing to the submitter", async () => {
  const res = await post({ email: "Lead@Agency.com", blurb: BLURB, path: "/agencies" }, { origin: "https://birchreserve.net" });
  assert.equal(res.status, 201);
  const j = (await res.json()) as { ok: boolean; message: string; test?: unknown };
  assert.equal(j.message, PULSE_CONFIRMATION);
  assert.equal(j.test, undefined, "visitors never see delivery receipts");
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0]!.email, "lead@agency.com");
  assert.equal(crm.length, 1);
  assert.equal(crm[0]!["kind"], "pulse_check");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.via, "birchreserve.net");
  assert.deepEqual(alerts[0]!.to, undefined, "alert goes to the default team recipients only");
  assert.equal(alerts[0]!.replyTo, "lead@agency.com");
  assert.equal(store.rows[0]!.friday, "sent");
});

test("scalehealth.ca origin: alert says via scalehealth.ca and the sheet row says so", async () => {
  await post({ email: "s@agency.com", blurb: BLURB, path: "/intake/_m/agencies?x=1" }, { origin: "https://www.scalehealth.ca" });
  assert.equal(alerts[0]!.via, "scalehealth.ca");
  assert.match(alerts[0]!.tag ?? "", /SCALE PULSE/);
  const row = sheetRowOf(store.rows[0]!);
  assert.equal(row[3], "scalehealth.ca");
  assert.equal(row[4], "/intake/_m/agencies");
  assert.equal(row[7], "new");
});

test("TEST skips the CRM but still alerts and stores; test receipt is returned", async () => {
  const res = await post({ email: "randy+fitcheck-test@scalehealth.ca", blurb: `TEST ${BLURB}` });
  const j = (await res.json()) as { test: { crm: string; alert: string; alertId: string; stored: boolean } };
  assert.equal(crm.length, 0);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.isTest, true);
  assert.equal(j.test.crm, "skipped (TEST)");
  assert.equal(j.test.alert, "sent");
  assert.equal(j.test.stored, true);
});

test("Friday failure still sends the team alert, flagged in the title", async () => {
  crmStatus = "failed";
  await post({ email: "f@agency.com", blurb: BLURB });
  assert.equal(alerts.length, 1);
  assert.match(alerts[0]!.title, /\(Friday failed\)/);
});

test("honeypot and too-fast fills look successful and do nothing", async () => {
  for (const extra of [{ company_url: "http://spam.example" }, { hp: "x" }, { t: Date.now() }]) {
    const res = await post({ email: "b@bot.com", blurb: BLURB, ...extra });
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { message: string }).message, PULSE_CONFIRMATION);
  }
  assert.equal(store.rows.length, 0);
  assert.equal(alerts.length, 0);
  assert.equal(crm.length, 0);
});

test("one per address per hour: the repeat looks fine but sends nothing", async () => {
  await post({ email: "d@agency.com", blurb: BLURB });
  const again = await post({ email: "d@agency.com", blurb: BLURB });
  assert.equal(again.status, 200);
  assert.equal(((await again.json()) as { duplicate?: boolean }).duplicate, true);
  assert.equal(store.rows.length, 1);
  assert.equal(alerts.length, 1);
});

test("per-IP throttle: the sixth in ten minutes is a 429", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await post({ email: `u${i}@agency.com`, blurb: BLURB })).status, 201);
  assert.equal((await post({ email: "u9@agency.com", blurb: BLURB })).status, 429);
});

test("export: unauthorised without the key, lists unsynced rows with the key, ack marks them synced", async () => {
  await post({ email: "e@agency.com", blurb: BLURB });
  assert.equal((await fetch(`${base}/v1/pulse-check/export`)).status, 401);
  assert.equal((await fetch(`${base}/v1/pulse-check/export`, { headers: { "x-pulse-export-key": "wrong".repeat(8) } })).status, 401);
  const ok = await fetch(`${base}/v1/pulse-check/export`, { headers: { "x-pulse-export-key": KEY } });
  const j = (await ok.json()) as { count: number; rows: Array<{ ref: string; sheetRow: string[] }> };
  assert.equal(j.count, 1);
  assert.equal(j.rows[0]!.sheetRow[1], "e@agency.com");
  const ack = await fetch(`${base}/v1/pulse-check/export/ack`, { method: "POST", headers: { "content-type": "application/json", "x-pulse-export-key": KEY }, body: JSON.stringify({ refs: [j.rows[0]!.ref] }) });
  assert.equal(((await ack.json()) as { acked: number }).acked, 1);
  const again = (await (await fetch(`${base}/v1/pulse-check/export`, { headers: { "x-pulse-export-key": KEY } })).json()) as { count: number };
  assert.equal(again.count, 0);
});
