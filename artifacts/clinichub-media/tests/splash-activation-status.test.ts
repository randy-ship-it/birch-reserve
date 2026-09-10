import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { terminalSplashActivation } from "../src/lib/splash-activation-status.ts";

test("expired activation is terminal and states that no payment was recorded", () => {
  const presentation = terminalSplashActivation({
    status: "expired",
    paymentStatus: "unpaid",
  });
  assert.equal(presentation?.kind, "expired");
  assert.match(presentation?.description ?? "", /No payment was recorded/);
});

test("paid recycled activation preserves payment history without reopening checkout", () => {
  const presentation = terminalSplashActivation({
    status: "recycled",
    paymentStatus: "paid",
  });
  assert.equal(presentation?.kind, "paid_recycled");
  assert.match(presentation?.description ?? "", /payment remains recorded/i);
});

test("generated clients preserve public root routes and private API routes", () => {
  const generated = readFileSync(
    new URL("../../../lib/api-client-react/src/generated/api.ts", import.meta.url),
    "utf8",
  );
  assert.match(generated, /return `\/v1\/orders\/\$\{id\}`/);
  assert.match(generated, /return `\/v1\/orders\/\$\{id\}\/confirm`/);
  assert.match(generated, /`\/api\/launch\/splash\/status\?\$\{stringifiedParams\}`/);
  assert.doesNotMatch(generated, /`\/api\/v1\/orders\//);
});