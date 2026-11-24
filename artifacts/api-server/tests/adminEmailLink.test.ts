import test from "node:test";
import assert from "node:assert/strict";
import { sign, verify } from "../src/lib/adserver/auth";
import { adminLinkEmail } from "../src/lib/adserver/mail";
import { DEFAULT_ADMIN_EMAILS } from "../src/lib/adserver/config";

test("admin email link: 30 min token, kind-bound, Randy's SBG address allowlisted", () => {
  assert.ok(DEFAULT_ADMIN_EMAILS.includes("randy@silverbirchgrowth.com"));
  const now = Date.now();
  const t = sign("al", { e: "randy@silverbirchgrowth.com" }, 30 * 60_000, now);
  assert.equal(verify<{ e: string }>("al", t)?.e, "randy@silverbirchgrowth.com");
  assert.equal(verify("adm", t), null); // not usable as a session or customer token
  assert.equal(verify("l", t), null);
  const old = sign("al", { e: "x@y.com" }, 30 * 60_000, now - 31 * 60_000);
  assert.equal(verify("al", old), null);
  const m = adminLinkEmail("https://birchreserve.net/ads/admin/auth?t=abc");
  assert.match(m.subject, /admin sign-in/);
  assert.match(m.text, /30 minutes/);
});
