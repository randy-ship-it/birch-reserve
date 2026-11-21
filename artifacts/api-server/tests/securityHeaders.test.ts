import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { securityHeaders, enforcedCsp, reportOnlyCsp, frameAncestors } from "../src/middlewares/securityHeaders";
import { toCsv } from "../src/lib/adserver/ui";

test("frame-ancestors always allows Birch + Scale mirror hosts, and folds valid MIRROR_FRAME_HOSTS only", () => {
  assert.equal(frameAncestors({}), "frame-ancestors 'self' https://scalehealth.ca https://www.scalehealth.ca");
  assert.equal(frameAncestors({ MIRROR_FRAME_HOSTS: "*, javascript:alert(1), https://partner.example.com" }), "frame-ancestors 'self' https://scalehealth.ca https://www.scalehealth.ca https://partner.example.com");
  assert.match(enforcedCsp({}), /base-uri 'self'; object-src 'none'; frame-ancestors/);
  assert.doesNotMatch(enforcedCsp({}), /script-src|default-src/);
  assert.match(reportOnlyCsp({}), /report-uri https:\/\/birchreserve\.net\/v1\/csp-report/);
  assert.match(reportOnlyCsp({}), /script-src 'self' https:\/\/birchreserve\.net/);
  assert.match(reportOnlyCsp({}), /connect-src 'self' https:\/\/birchreserve\.net/);
});

test("every response carries the security headers and no X-Powered-By", async () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders({}));
  app.get("/x", (_req, res) => res.send("ok"));
  app.get("/own", (_req, res) => res.set("Content-Security-Policy", "default-src 'none'; sandbox").send("ok"));
  const srv = app.listen(0);
  const port = (srv.address() as { port: number }).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}/x`);
    assert.equal(r.headers.get("x-powered-by"), null);
    assert.equal(r.headers.get("strict-transport-security"), "max-age=63072000; includeSubDomains");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.equal(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.match(r.headers.get("permissions-policy") ?? "", /camera=\(\)/);
    assert.match(r.headers.get("content-security-policy-report-only") ?? "", /default-src 'self'/);
    const own = await fetch(`http://127.0.0.1:${port}/own`);
    assert.equal(own.headers.get("content-security-policy"), "default-src 'none'; sandbox", "a route's stricter CSP still wins");
  } finally {
    srv.close();
  }
});

test("CSV exports neutralise formula injection but keep numbers", () => {
  const out = toCsv([{ a: "=HYPERLINK(\"http://x\")", b: "+1 555", c: "-12.50", d: "@SUM(A1)", e: "ok", f: -3 }]);
  const row = out.split("\n")[1]!;
  assert.equal(row, `"'=HYPERLINK(""http://x"")",'+1 555,-12.50,'@SUM(A1),ok,-3`);
});
