import assert from "node:assert/strict";
import { after, test } from "node:test";
import express from "express";
import { cronAuthorized } from "../src/lib/cronAuth";
import { defaultSlackProxy, isReplitRuntime } from "../src/lib/slackPost";
import {
  setSplashExpiryCleanupForTests,
} from "../src/routes/splashExpiryCron";
import splashExpiryCron from "../src/routes/splashExpiryCron";

const savedEnv = {
  CRON_SECRET: process.env.CRON_SECRET,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  REPL_ID: process.env.REPL_ID,
  REPL_IDENTITY: process.env.REPL_IDENTITY,
  WEB_REPL_RENEWAL: process.env.WEB_REPL_RENEWAL,
  REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
};

function restoreEnv(): void {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

after(() => {
  restoreEnv();
  setSplashExpiryCleanupForTests(null);
});

test("cron auth fails closed without a secret or a matching bearer", () => {
  assert.equal(cronAuthorized(undefined, undefined), false);
  assert.equal(cronAuthorized("Bearer secret", undefined), false);
  assert.equal(cronAuthorized(undefined, "secret"), false);
  assert.equal(cronAuthorized("Bearer wrong", "secret"), false);
  assert.equal(cronAuthorized("secret", "secret"), false);
  assert.equal(cronAuthorized("Bearer secret", "secret"), true);
  assert.equal(cronAuthorized("Bearer secret-extra", "secret"), false);
});

test("replit detection ignores the slack token", () => {
  delete process.env.REPL_ID;
  delete process.env.REPL_IDENTITY;
  delete process.env.WEB_REPL_RENEWAL;
  delete process.env.REPLIT_DEPLOYMENT;
  process.env.SLACK_BOT_TOKEN = "xoxb-test";
  assert.equal(isReplitRuntime(), false);
  process.env.REPL_ID = "repl-1";
  assert.equal(isReplitRuntime(), true);
});

test("off Replit, missing SLACK_BOT_TOKEN throws before any connector or fetch", async () => {
  delete process.env.REPL_ID;
  delete process.env.REPL_IDENTITY;
  delete process.env.WEB_REPL_RENEWAL;
  delete process.env.REPLIT_DEPLOYMENT;
  delete process.env.SLACK_BOT_TOKEN;
  let connectorBuilt = false;
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetched = true;
    return new Response("{}", { status: 200 });
  };
  try {
    await assert.rejects(
      () =>
        defaultSlackProxy(
          "/chat.postMessage",
          { method: "POST", body: "{}" },
          () => {
            connectorBuilt = true;
            return {
              proxy: async () => new Response("{}", { status: 200 }),
            };
          },
        ),
      /SLACK_BOT_TOKEN/,
    );
    assert.equal(connectorBuilt, false);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("off Replit, SLACK_BOT_TOKEN posts to the Slack Web API", async () => {
  delete process.env.REPL_ID;
  delete process.env.REPL_IDENTITY;
  delete process.env.WEB_REPL_RENEWAL;
  delete process.env.REPLIT_DEPLOYMENT;
  process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
  const originalFetch = globalThis.fetch;
  let seenUrl = "";
  let seenAuth = "";
  globalThis.fetch = async (input, init) => {
    seenUrl = String(input);
    seenAuth = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const response = await defaultSlackProxy("/chat.postMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "C0", text: "hi" }),
    });
    assert.equal(response.ok, true);
    assert.equal(seenUrl, "https://slack.com/api/chat.postMessage");
    assert.equal(seenAuth, "Bearer xoxb-test-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("on Replit, the connector is used even when SLACK_BOT_TOKEN is set", async () => {
  process.env.REPL_ID = "repl-1";
  process.env.SLACK_BOT_TOKEN = "xoxb-should-not-be-used";
  const originalFetch = globalThis.fetch;
  let fetched = false;
  globalThis.fetch = async () => {
    fetched = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const response = await defaultSlackProxy(
      "/chat.postMessage",
      { method: "POST", body: "{}" },
      () => ({
        proxy: async (service, slackPath) =>
          new Response(JSON.stringify({ ok: true, service, slackPath }), {
            status: 200,
          }),
      }),
    );
    const body = (await response.json()) as {
      service?: string;
      slackPath?: string;
    };
    assert.equal(fetched, false);
    assert.equal(body.service, "slack");
    assert.equal(body.slackPath, "/chat.postMessage");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("splash expiry cron rejects a bad bearer and runs cleanup once when authorized", async () => {
  process.env.CRON_SECRET = "cron-secret-value";
  let calls = 0;
  setSplashExpiryCleanupForTests(async () => {
    calls += 1;
    return {
      expiredUnpaid: 1,
      recycledPaid: 0,
      creativeWarningsSent: 0,
      creativeWarningsFailed: 0,
      skippedProcessing: 0,
      reconciledCheckouts: 0,
    };
  });

  const app = express();
  app.use(splashExpiryCron);
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind.");
  }
  const url = `http://127.0.0.1:${address.port}/api/cron/splash-expiry`;
  try {
    const denied = await fetch(url);
    assert.equal(denied.status, 401);
    const wrong = await fetch(url, {
      headers: { authorization: "Bearer wrong" },
    });
    assert.equal(wrong.status, 401);
    assert.equal(calls, 0);
    const ok = await fetch(url, {
      headers: { authorization: "Bearer cron-secret-value" },
    });
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { ok?: boolean; expiredUnpaid?: number };
    assert.equal(body.ok, true);
    assert.equal(body.expiredUnpaid, 1);
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
