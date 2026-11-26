/**
 * Intake mail canary + sales-alert "via" wording (form audit gaps, Nov 26 2026).
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import opsMailTestRouter, { MAIL_CANARY_SUBJECT, MAIL_CANARY_TO_DEFAULT } from "../src/routes/opsMailTest";
import { setSiteMailFetchForTests } from "../src/lib/siteMail";
import { alertSiteOf, renderSalesAlert } from "../src/lib/salesAlert";
import { INTAKE_SYNTHETIC_HEADER, INTAKE_SYNTHETIC_SECRET_ENV } from "../src/lib/testTraffic";

const SECRET = "canary-test-secret";
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;
const sent: Array<Record<string, unknown>> = [];

before(async () => {
  process.env[INTAKE_SYNTHETIC_SECRET_ENV] = SECRET;
  process.env["RESEND_API_KEY"] = "re_test_not_a_real_key";
  setSiteMailFetchForTests(async (_url, init) => {
    sent.push(JSON.parse(String((init as { body?: string }).body ?? "{}")) as Record<string, unknown>);
    return new Response(JSON.stringify({ id: "re_canary_test_1" }), { status: 200 });
  });
  const app = express();
  app.use(express.json());
  app.use("/api", opsMailTestRouter);
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  closeServer = () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

after(async () => {
  await closeServer?.();
  setSiteMailFetchForTests(null);
  delete process.env[INTAKE_SYNTHETIC_SECRET_ENV];
  delete process.env["RESEND_API_KEY"];
});

beforeEach(() => {
  sent.length = 0;
});

function post(headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/ops/mail-canary`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });
}

test("alertSiteOf: scale host, skin, src tag, else birchreserve.net", () => {
  const get = (h: Record<string, string>) => (n: string) => h[n];
  assert.equal(alertSiteOf({ get: get({ "x-forwarded-host": "www.scalehealth.ca" }) }), "scalehealth.ca");
  assert.equal(alertSiteOf({ get: get({ origin: "https://scalehealth.ca/intake/_m" }) }), "scalehealth.ca");
  assert.equal(alertSiteOf({ get: get({ host: "birchreserve.net" }) }, { skin: "scale" }), "scalehealth.ca");
  assert.equal(alertSiteOf({ get: get({ host: "birchreserve.net" }) }, { src: "scale_mirror" }), "scalehealth.ca");
  assert.equal(alertSiteOf(null, { site: "scale" }), "scalehealth.ca");
  assert.equal(alertSiteOf({ get: get({ host: "birchreserve.net" }) }), "birchreserve.net");
  assert.equal(alertSiteOf(), "birchreserve.net");
});

test("renderSalesAlert says via scalehealth.ca or via birchreserve.net, never the old 'on birchreserve.net' line when Scale", () => {
  const scale = renderSalesAlert({ event: "inquiry", title: "agency inquiry: Acme", via: "scalehealth.ca", rows: [["Form", "agency_inquiry"]] });
  assert.match(scale.text, /via scalehealth\.ca/);
  assert.doesNotMatch(scale.text, /on birchreserve\.net/);
  assert.match(scale.html, /via scalehealth\.ca/);
  const birch = renderSalesAlert({ event: "inquiry", title: "agency inquiry: Acme", via: "birchreserve.net", rows: [["Form", "agency_inquiry"]] });
  assert.match(birch.text, /via birchreserve\.net/);
});

test("mail canary: missing or wrong X-Intake-Synthetic → 401, no send", async () => {
  assert.equal((await post()).status, 401);
  assert.equal((await post({ [INTAKE_SYNTHETIC_HEADER]: "wrong" })).status, 401);
  assert.equal(sent.length, 0);
});

test("mail canary: valid synthetic header sends one labelled email to the plus-address only", async () => {
  const res = await post({ [INTAKE_SYNTHETIC_HEADER]: SECRET });
  assert.equal(res.status, 200);
  const json = (await res.json()) as { ok: boolean; id: string; to: string };
  assert.equal(json.ok, true);
  assert.equal(json.id, "re_canary_test_1");
  assert.equal(json.to, MAIL_CANARY_TO_DEFAULT);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0]!.to, [MAIL_CANARY_TO_DEFAULT]);
  assert.equal(sent[0]!.subject, MAIL_CANARY_SUBJECT);
  assert.match(String(sent[0]!.text), /INTAKE CANARY/);
  assert.ok(!Array.isArray(sent[0]!.to) || !(sent[0]!.to as string[]).includes("randy@silverbirchgrowth.com"));
  assert.ok(!Array.isArray(sent[0]!.cc));
});
