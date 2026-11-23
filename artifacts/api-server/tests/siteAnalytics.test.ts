import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { isSiteEvent, parseSiteExtras, summarize, uaInfo, sourceOf, type EventRow } from "../src/lib/siteAnalytics";
import { memoryStore, setSiteAnalyticsStore } from "../src/lib/siteAnalyticsStore";
import { handleUiEvent, parseUiEvent, uiEventsJsonParser, resetUiEventRateLimitForTests } from "../src/lib/uiEvents";
import router, { setStripeListerForTests } from "../src/routes/siteAnalytics";
import { sign } from "../src/lib/adserver/auth";

test("site events: fixed names only, extras never carry free text", () => {
  assert.equal(isSiteEvent("a.pv"), true);
  assert.equal(isSiteEvent("a.click.get_my_kit"), true);
  assert.equal(isSiteEvent("a.click.someone@x.com"), false);
  assert.equal(isSiteEvent("a.scroll_33"), false);
  const p = parseUiEvent({ event: "a.click.reserve", path: "/exclusive", label: "Jane Doe <x>", ref: "news.ycombinator.com", src: "st:abc", skin: "scale", w: 390 });
  assert.ok(p);
  assert.equal(p!.extras!.label, null); // spaces / brackets rejected
  assert.equal(p!.extras!.src, "st:abc");
  assert.equal(parseUiEvent({ event: "a.pv", path: "/", email: "a@b.co" }), null); // unknown key -> rejected
  assert.equal(parseSiteExtras({ src: "evil:1" }).src, null);
});

test("ua: coarse device + browser, bots flagged", () => {
  assert.deepEqual(uaInfo("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), { device: "mobile", browser: "Safari", os: "iOS", bot: false });
  assert.equal(uaInfo("Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36 Edg/130").browser, "Edge");
  assert.equal(uaInfo("Googlebot/2.1").device, "bot");
  assert.equal(sourceOf({ refHost: "www.google.com", utmSource: null, src: null }), "google");
});

const row = (event: string, path: string, vh: string | null, extra: Partial<EventRow> = {}): EventRow => ({ event, path, label: null, skin: "birch", device: "mobile", browser: "Safari", os: "iOS", refHost: null, utmSource: null, src: null, vh, isTest: false, createdAt: new Date(), ...extra });

test("summary: funnel, legacy rows, QA excluded", () => {
  const rows = [
    row("a.pv", "/", "v1"), row("a.pv", "/intake", "v1", { refHost: "internal" }), row("a.form_start", "/intake", "v1"), row("a.form_submit", "/intake", "v1"),
    row("a.pv", "/", "v2", { skin: "scale", device: "desktop" }), row("a.scroll_50", "/", "v2"), row("a.click.get_my_kit", "/", "v2", { label: "nav_kit_cta" }),
    row("attn.view", "/", null), row("attn.view", "/", "v2"), // legacy counts, new duplicate does not
    row("a.pv", "/", "qa", { isTest: true }),
  ];
  const s = summarize(rows, { sinceMs: Date.now() - 3600_000, stripe: { created: 1, paid: 0, createdBySkin: {}, available: true }, bucket: "hour" });
  assert.equal(s.totals.views, 4);
  assert.equal(s.totals.excluded_test_or_bot, 1);
  assert.deepEqual(s.funnel.map((f) => f.n), [3, 1, 1, 1, 1, 0]);
  assert.equal(s.totals.live_visitors, 2);
  assert.deepEqual(s.skins.map((x) => x.k).sort(), ["birch", "scale"]);
});

test("routes: ui-events stores dims; dashboard needs admin or a signed link; embed frameable by Friday only", async () => {
  const mem = memoryStore();
  setSiteAnalyticsStore(mem);
  setStripeListerForTests(async () => [{ created: 1, status: "complete", payment_status: "paid", success_url: "https://birchreserve.net/success", cancel_url: null, email: "buyer@brand.com" }, { created: 1, status: "open", payment_status: "unpaid", success_url: "https://birchreserve.net/success", cancel_url: null, email: "qa-test+x@silverbirchgrowth.com" }]);
  resetUiEventRateLimitForTests();
  const app = express();
  app.set("trust proxy", true);
  app.use("/v1/ui-events", uiEventsJsonParser());
  app.post("/v1/ui-events", (req, res) => void handleUiEvent(req, res));
  app.use(router);
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${(srv.address() as { port: number }).port}`;
  try {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
    let r = await fetch(`${base}/v1/ui-events`, { method: "POST", headers: { "content-type": "application/json", "user-agent": ua, origin: "https://www.scalehealth.ca" }, body: JSON.stringify({ event: "a.pv", path: "/intake", skin: "birch", ref: "google.com" }) });
    assert.equal(r.status, 204);
    r = await fetch(`${base}/v1/ui-events`, { method: "POST", headers: { "content-type": "application/json", "user-agent": ua, dnt: "1" }, body: JSON.stringify({ event: "a.pv", path: "/" }) });
    assert.equal(r.status, 204);
    assert.equal(mem.rows.length, 1); // DNT stored nothing
    assert.equal(mem.rows[0]!.skin, "scale");
    assert.equal(mem.rows[0]!.device, "desktop");
    assert.match(mem.rows[0]!.vh ?? "", /^[A-Za-z0-9_-]{16}$/);
    assert.equal((await fetch(`${base}/ads/admin/analytics.json`)).status, 401);
    assert.equal((await fetch(`${base}/analytics/live?k=nope`)).status, 403);
    const k = sign("ana", { v: "1", by: "t" }, 60_000);
    const j = await (await fetch(`${base}/ads/admin/analytics.json?range=today&k=${encodeURIComponent(k)}`)).json() as { totals: { views: number }; stripe: { created: number; paid: number } };
    assert.equal(j.totals.views, 1);
    assert.deepEqual([j.stripe.created, j.stripe.paid], [1, 1]); // QA card excluded
    const page = await fetch(`${base}/analytics/live?k=${encodeURIComponent(k)}`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-security-policy") ?? "", /frame-ancestors 'self' https:\/\/fridayapp\.org/);
  } finally {
    srv.close();
    setSiteAnalyticsStore(null);
  }
});
