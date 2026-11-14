import { test } from "node:test";
import assert from "node:assert/strict";
import { callbackKeyOk } from "../src/lib/callbackKey";

test("callback key: constant-time match, fails closed (Randy Nov 13 2026 10:34 PM)", () => {
  assert.equal(callbackKeyOk("abc123", "abc123"), true);
  assert.equal(callbackKeyOk(["abc123"], "abc123"), true);
  assert.equal(callbackKeyOk("abc124", "abc123"), false);
  assert.equal(callbackKeyOk("abc", "abc123"), false);
  assert.equal(callbackKeyOk(undefined, "abc123"), false);
  assert.equal(callbackKeyOk("", "abc123"), false);
  assert.equal(callbackKeyOk("anything", undefined), false);
  assert.equal(callbackKeyOk("anything", ""), false);
});
