/**
 * IndexNow key hosting and the fixed-allowlist notify route.
 * Does not call api.indexnow.org.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import app from "../src/app";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_URL_LIST,
  setIndexNowFetchForTests,
  type IndexNowFetch,
} from "../src/lib/indexNow";
import indexNowRouter, { INDEXNOW_NOTIFY_MAX_PER_HOUR, indexNowKeyRouter } from "../src/routes/indexNow";
import { resetRateLimitsForTests } from "../src/lib/rateLimit";

const QA_SECRET = "qa-secret-for-indexnow-tests-83e5";
const calls: Array<{ url: string; body: string }> = [];
let indexNowStatus = 200;
let indexNowBody = "OK";
let failFetch = false;

const mockFetch: IndexNowFetch = async (url, init) => {
  if (failFetch) throw new Error("network down");
  calls.push({ url, body: init.body });
  return { status: indexNowStatus, text: async () => indexNowBody };
};

let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;
let origin = "";
let closeApp: (() => Promise<void>) | undefined;

before(async () => {
  process.env["BIRCH_QA_SECRET"] = QA_SECRET;
  setIndexNowFetchForTests(mockFetch);
  const mini = express();
  mini.use(express.json());
  mini.use(indexNowKeyRouter);
  mini.use("/api", indexNowRouter);
  const server = mini.listen(0);
  await new Promise<void>((resolveReady) => server.once("listening", resolveReady));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  baseUrl = `http://127.0.0.1:${address.port}`;
  closeServer = () => new Promise<void>((resolveClose, rejectClose) => server.close((error) => (error ? rejectClose(error) : resolveClose())));

  const live = app.listen(0);
  await new Promise<void>((resolveReady, rejectReady) => {
    live.once("listening", () => resolveReady());
    live.once("error", rejectReady);
  });
  const liveAddress = live.address();
  if (!liveAddress || typeof liveAddress === "string") throw new Error("App server did not bind.");
  origin = `http://127.0.0.1:${liveAddress.port}`;
  closeApp = () => new Promise<void>((resolveClose, rejectClose) => live.close((error) => (error ? rejectClose(error) : resolveClose())));
});

after(async () => {
  setIndexNowFetchForTests(null);
  await closeServer?.();
  await closeApp?.();
});

beforeEach(() => {
  process.env["BIRCH_QA_SECRET"] = QA_SECRET;
  resetRateLimitsForTests();
  calls.length = 0;
  indexNowStatus = 200;
  indexNowBody = "OK";
  failFetch = false;
});

test("public key file and API route are the key only, and Autoscale claims the path", async () => {
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{8,128}$/);
  const filePath = resolve(process.cwd(), `../clinichub-media/public/${INDEXNOW_KEY}.txt`);
  const bytes = await readFile(filePath);
  assert.equal(bytes.toString("utf8"), INDEXNOW_KEY);
  assert.equal(bytes.length, INDEXNOW_KEY.length);

  const artifact = await readFile(resolve(process.cwd(), ".replit-artifact/artifact.toml"), "utf8");
  assert.match(artifact, new RegExp(`"/${INDEXNOW_KEY}\\.txt"`));

  const appSource = await readFile(resolve(process.cwd(), "src/app.ts"), "utf8");
  assert.match(appSource, /app\.use\(indexNowKeyRouter\)/);
  const routes = await readFile(resolve(process.cwd(), "src/routes/index.ts"), "utf8");
  assert.match(routes, /router\.use\(indexNowRouter\)/);

  for (const root of [baseUrl, origin]) {
    const res = await fetch(`${root}/${INDEXNOW_KEY}.txt`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /^text\/plain/);
    assert.equal(await res.text(), INDEXNOW_KEY);
  }
});

test("editorial sitemap static list keeps existing URLs and adds the legal pages", async () => {
  const source = await readFile(resolve(process.cwd(), "src/routes/editorial.ts"), "utf8");
  const block = source.match(/const staticUrls = \[([\s\S]*?)\]\.map/)?.[1] ?? "";
  for (const path of ["/", "/about", "/insights", "/terms", "/privacy", "/sample-io", "/marketplace", "/buycalc", "/v1/catalog.json", "/llms.txt", "/openapi.yaml"]) {
    assert.match(block, new RegExp(`"${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

function notify(headers: Record<string, string>, body?: string) {
  return fetch(`${baseUrl}/api/ops/indexnow/notify`, {
    method: "POST",
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body,
  });
}

test("POST /api/ops/indexnow/notify requires the QA header and submits only the allowlist", async () => {
  assert.equal((await notify({})).status, 401);
  assert.equal((await notify({ "x-birch-qa": "wrong" }, JSON.stringify({ urlList: ["https://evil.example/phish"] }))).status, 401);
  assert.equal(calls.length, 0);

  const ok = await notify(
    { "x-birch-qa": QA_SECRET },
    JSON.stringify({ urlList: ["https://evil.example/phish"], host: "evil.example" }),
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, indexNowStatus: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, INDEXNOW_ENDPOINT);
  assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList: [...INDEXNOW_URL_LIST],
  });

  indexNowStatus = 202;
  indexNowBody = "";
  const accepted = await notify({ "x-birch-qa": QA_SECRET });
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { ok: true, indexNowStatus: 202 });

  indexNowStatus = 422;
  indexNowBody = "URLs do not belong to the host";
  const rejected = await notify({ "x-birch-qa": QA_SECRET });
  assert.equal(rejected.status, 502);
  const rejectedBody = await rejected.json() as { ok: boolean; indexNowStatus: number; error: string };
  assert.equal(rejectedBody.ok, false);
  assert.equal(rejectedBody.indexNowStatus, 422);
  assert.match(rejectedBody.error, /do not belong/);

  failFetch = true;
  const down = await notify({ "x-birch-qa": QA_SECRET });
  assert.equal(down.status, 502);
  assert.equal(calls.length, 3);
});

test("POST /api/ops/indexnow/notify is limited to six submits an hour", async () => {
  for (let i = 0; i < INDEXNOW_NOTIFY_MAX_PER_HOUR; i += 1) {
    assert.equal((await notify({ "x-birch-qa": QA_SECRET })).status, 200);
  }
  const limited = await notify({ "x-birch-qa": QA_SECRET });
  assert.equal(limited.status, 429);
  assert.equal(calls.length, INDEXNOW_NOTIFY_MAX_PER_HOUR);
});
