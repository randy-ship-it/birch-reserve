import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  fitWireBudget,
  isTransientFailure,
  withQuietRetry,
  MAX_WIRE_CHARS,
  type WireAttempt,
} from "../src/lib/randy-wire.ts";

const noSleep = async () => {};

test("dropped connection (Safari 'Load failed') is retried once, quietly, and the reply comes back", async () => {
  const calls: string[] = [];
  const payload = JSON.stringify({ messages: [{ role: "user", content: "email me on qa+test@silverbirchgrowth.com" }] });
  let n = 0;
  const res = await withQuietRetry<string>(
    async () => {
      calls.push(payload);
      n += 1;
      return n === 1 ? { ok: false, kind: "network" } : { ok: true, value: "Got it." };
    },
    { sleep: noSleep },
  );
  assert.deepEqual(res, { ok: true, value: "Got it." });
  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1], "retry sends the exact same request");
});

test("only one quiet retry: a second failure surfaces so the card shows", async () => {
  let n = 0;
  const res = await withQuietRetry<string>(async () => {
    n += 1;
    return { ok: false, kind: "network" };
  }, { sleep: noSleep });
  assert.equal(n, 2);
  assert.deepEqual(res, { ok: false, kind: "network" });
});

test("5xx is retried; 4xx, rate limit, timeout and stub are not", async () => {
  assert.equal(isTransientFailure({ kind: "unavailable", status: 503 }), true);
  assert.equal(isTransientFailure({ kind: "network" }), true);
  assert.equal(isTransientFailure({ kind: "rejected", status: 400 }), false);
  assert.equal(isTransientFailure({ kind: "rate_limited", status: 429 }), false);
  assert.equal(isTransientFailure({ kind: "timeout" }), false);
  for (const first of [{ ok: false, kind: "rejected", status: 400 }, { ok: "stub" }] as WireAttempt<string>[]) {
    let n = 0;
    await withQuietRetry<string>(async () => { n += 1; return first; }, { sleep: noSleep });
    assert.equal(n, 1);
  }
});

test("a slow first failure is not retried (visitor already waited)", async () => {
  let t = 0;
  let n = 0;
  await withQuietRetry<string>(
    async () => { n += 1; t += 20_000; return { ok: false, kind: "unavailable", status: 503 }; },
    { sleep: noSleep, now: () => t },
  );
  assert.equal(n, 1);
});

test("backoff is short", async () => {
  const slept: number[] = [];
  let n = 0;
  await withQuietRetry<string>(async () => (++n === 1 ? { ok: false, kind: "network" } : { ok: true, value: "x" }), {
    sleep: async (ms) => { slept.push(ms); },
  });
  assert.equal(slept.length, 1);
  assert.ok(slept[0]! >= 200 && slept[0]! <= 1500);
});

test("wire budget keeps the latest turn and drops the oldest to stay under the server limit", () => {
  const thread = Array.from({ length: 80 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `${i} ` + "x".repeat(1400) }));
  const out = fitWireBudget(thread);
  assert.ok(JSON.stringify(out).length < 100_000);
  assert.ok(out.reduce((n, m) => n + m.content.length, 0) <= MAX_WIRE_CHARS);
  assert.equal(out[out.length - 1], thread[thread.length - 1]);
  const short = [{ role: "user" as const, content: "hi" }];
  assert.equal(fitWireBudget(short), short);
});

test("widget wiring: model client uses the quiet retry and builds the payload once; widget pushes no bubble for it", () => {
  const client = readFileSync(new URL("../src/lib/randy-model-client.ts", import.meta.url), "utf8");
  assert.match(client, /withQuietRetry\(\(\) => fetchGrokReply\(req, payload\)/);
  assert.match(client, /FETCH_TIMEOUT_MS = 25_000/);
  assert.match(client, /fitWireBudget\(/);
  const widget = readFileSync(new URL("../src/components/randy-chat.tsx", import.meta.url), "utf8");
  // Retry button removes the error card and re-asks with the same thread (no new user bubble).
  assert.match(widget, /setThread\(messagesRef\.current\.filter\(\(m\) => m\.id !== errorId\)\);\s*await fetchReply\(\);/);
});

import { parseCheckoutStatus, reserveIntakeNeed } from "../src/lib/checkout-status.ts";

test("checkout paused: CTAs open intake with seat + category preselected; enabled falls back to checkout", () => {
  assert.equal(reserveIntakeNeed("reserve-490", "sports_nutrition"), "Reserve $490 seat — sports nutrition");
  assert.equal(reserveIntakeNeed("hold-190"), "Hold $190 (7-day category hold)");
  assert.equal(parseCheckoutStatus({ checkoutEnabled: true }), true);
  for (const v of [null, {}, { checkoutEnabled: "true" }, { checkoutEnabled: false }]) assert.equal(parseCheckoutStatus(v), false);
  const home = readFileSync(new URL("../src/pages/home.tsx", import.meta.url), "utf8");
  assert.match(home, /if \(!enabled\) \{\s*openRandyChat\(\{ reason: "reserve-intake"/);
  assert.match(home, /setSplashDialogOpen\(true\);/);
  assert.doesNotMatch(home, /\$899/);
  const widget = readFileSync(new URL("../src/components/randy-chat.tsx", import.meta.url), "utf8");
  assert.match(widget, /detail\?\.reason === "reserve-intake"[\s\S]{0,900}setCallbackOpen\(true\)/);
});
