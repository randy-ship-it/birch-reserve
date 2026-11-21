/**
 * Referral attribution end to end on in-memory Postgres (Randy, Nov 21 2026 4:07 PM): QR / street-team link → 30-day last-click
 * browser state → x-br-attr / cookies → Checkout Session metadata → webhook → order stamp + ad_referral_orders → commission lines.
 */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import * as store from "../src/lib/adserver/store";
import * as promo from "../src/lib/adserver/promo";
import { listReferralOrders, toLine } from "../src/lib/adserver/referrals";
import { applies, splitReferralOrders, maxReferrerAllocationBps, type RecipientRow, type RateRow } from "../src/lib/adserver/payoutSplit";
import { promoContext, promoCtxOf, promoMetadata, withPromoMetadata } from "../src/lib/adserver/promoContext";
import { PROMO_BOX_JS } from "../src/lib/adserver/promoBoxJs";
import { mirrorBootScript } from "../src/middlewares/mirrorHost";
import { draftCampaignFromCheckoutSafe } from "../src/lib/adserver/service";
import { referralAdminHtml } from "../src/lib/adserver/referralAdmin";

const req = (h: Record<string, string>, query: Record<string, string> = {}) => ({ get: (n: string) => h[n.toLowerCase()], query }) as never;

test("server context: header pair wins, cookie pair falls back, QR label never mixes members, Scale origin → site scale", () => {
  const a = promoCtxOf(req({ "x-br-attr": "st=mona&qr=scale-intake-digital&code=STREET100", origin: "https://www.scalehealth.ca", cookie: "br_st=bridget; br_qr=birch-intake" }));
  assert.deepEqual(a, { st: "mona", code: "STREET100", site: "scale", qr: "scale-intake-digital" });
  const b = promoCtxOf(req({ cookie: "br_st=bridget; br_qr=birch-intake; br_pc=STREET100" }));
  assert.deepEqual(b, { st: "bridget", code: "STREET100", site: "birch", qr: "birch-intake" });
  const c = promoCtxOf(req({ "x-br-attr": "st=mona", cookie: "br_st=bridget; br_qr=birch-intake" }));
  assert.equal(c.qr, null, "header member without a QR label does not inherit the cookie member's label");
  const d = promoCtxOf(req({ "x-br-attr": "st=<x>&qr=../../" }));
  assert.equal(d.st, null);
  assert.equal(d.qr, null);
  assert.equal(promoCtxOf(req({}, { br_mirror: "scale" })).site, "scale");
});

test("Checkout Session metadata carries st / st_qr / promo / site through every builder", async () => {
  const mw = promoContext();
  const md = await new Promise<Record<string, string>>((resolve) => mw(req({ "x-br-attr": "st=mona&qr=scale-intake", origin: "https://scalehealth.ca" }) as never, {} as never, () => setTimeout(() => resolve(promoMetadata()), 1)));
  assert.deepEqual(md, { st: "mona", st_qr: "scale-intake", site: "scale" });
  const merged = await new Promise<Record<string, unknown>>((resolve) => mw(req({ cookie: "br_st=bridget; br_qr=birch-intake" }) as never, {} as never, () => resolve(withPromoMetadata({ mode: "payment", metadata: { kind: "area_lock" } }) as never)));
  assert.deepEqual(merged.metadata, { kind: "area_lock", st: "bridget", st_qr: "birch-intake", site: "birch" });
  assert.deepEqual(withPromoMetadata({ metadata: { a: "1" } }), { metadata: { a: "1" } }, "outside a request nothing is added");
});

const session = (id: string, md: Record<string, string>, amount = 19_000, email = "buyer@realbrand.co") =>
  ({ id, livemode: true, payment_status: "paid", status: "complete", currency: "usd", amount_total: amount, created: Math.floor(Date.UTC(2026, 10, 21, 21, 30) / 1000), customer_details: { email, name: "Buyer" }, metadata: md }) as never;

test("webhook: referred paid order is stamped with its referrer and gets one referral row (idempotent); unknown referrers are ignored", async () => {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, "ads_ref_t1");
  promo.resetMemberCache();
  const s1 = session("cs_live_ref_mona_1", { sku: "hold-190", brand: "Real Brand", st: "mona", st_qr: "scale-intake-digital", site: "scale" });
  assert.equal(await draftCampaignFromCheckoutSafe(s1), "created");
  assert.equal(await draftCampaignFromCheckoutSafe(s1), "exists");
  const c = (await store.listCampaigns()).find((x) => x.orderRef === "cs_live_ref_mona_1")!;
  assert.equal(c.referrer, "mona");
  assert.equal(c.referrerQr, "scale-intake-digital");
  assert.equal(c.referrerSite, "scale");
  assert.equal(c.seller, "birch", "the mirror does not change who sold it (see ARCHITECTURE.md)");
  const rows = await listReferralOrders();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.member, "mona");
  assert.equal(rows[0]!.amountCents, 19_000);
  assert.equal(rows[0]!.channel, "brokerage");
  assert.equal(rows[0]!.site, "scale");
  const street = (await promo.streetStats()).find((m) => m.id === "mona")!;
  assert.equal(street.orders, 1);
  await draftCampaignFromCheckoutSafe(session("cs_live_ref_nobody", { sku: "hold-190", st: "home_tile", site: "birch" }, 19_000, "b2@otherbrand.co"));
  assert.equal((await listReferralOrders()).length, 1, "a non-member value (e.g. an internal ?ref=home_tile) never creates a referral");
  const plain = (await store.listCampaigns()).find((x) => x.orderRef === "cs_live_ref_nobody")!;
  assert.equal(plain.referrer, null);
  await draftCampaignFromCheckoutSafe(session("cs_test_ref_qa", { sku: "hold-190", st: "bridget", site: "birch" }, 19_000, "qa+ref@silverbirchgrowth.com"));
  assert.equal((await listReferralOrders()).length, 1, "test identities stay out of the real list");
  assert.equal((await listReferralOrders({ testOnly: true })).length, 1);
  store.setAdPoolForTests(null);
});

const T = (iso: string) => new Date(iso);
const rates: RateRow[] = [{ partner: null, overrideBps: 2000, hubBps: 3500, effectiveAt: T("2026-11-01T00:00:00Z") }];
const rcpt = (p: Partial<RecipientRow>): RecipientRow => ({ rkey: "mona-ref", name: "Mona", kind: "commission", pctBps: 5000, scopePartner: null, scopeCampaign: null, scopeReferrer: "mona", active: true, payoutRef: "mona@example.com", effectiveAt: T("2026-11-01T00:00:00Z"), ...p });

test("commission: existing channel override × the referrer's share; Scale direct / internal 5%; dated, never retroactive; never paid on delivery too", () => {
  const ch = [{ channel: "scale_direct" as const, overrideBps: 500, effectiveAt: T("2026-11-01T00:00:00Z") }, { channel: "internal" as const, overrideBps: 500, effectiveAt: T("2026-11-01T00:00:00Z") }];
  const o = (id: string, channel: "brokerage" | "scale_direct" | "internal", at = "2026-11-21T21:30:00Z") => ({ sessionId: id, campaignId: null, member: "mona", at: T(at), currency: "usd", amountMicros: 1000 * 1e6, channel });
  const r = splitReferralOrders([o("a", "brokerage"), o("b", "scale_direct"), o("c", "internal")], rates, [rcpt({})], ch);
  const by = new Map(r.detail.map((d) => [d.sessionId, d]));
  assert.equal(by.get("a")!.poolMicros, 200e6); // $1,000 × 20%
  assert.equal(by.get("a")!.commissions[0]!.micros, 100e6); // 50% of the pool
  assert.equal(by.get("b")!.poolMicros, 50e6); // 5% Scale direct
  assert.equal(by.get("b")!.commissions[0]!.micros, 25e6);
  assert.equal(by.get("c")!.commissions[0]!.micros, 25e6);
  assert.equal(r.payees.length, 1);
  assert.equal(r.payees[0]!.payable, 150e6);
  assert.equal(r.payees[0]!.source, "referral");
  // A share added later does not reach back to earlier orders.
  const late = splitReferralOrders([o("d", "brokerage", "2026-11-05T12:00:00Z")], rates, [rcpt({ effectiveAt: T("2026-11-10T00:00:00Z") })], ch);
  assert.equal(late.detail[0]!.commissions.length, 0);
  assert.equal(late.detail[0]!.poolMicros, 200e6, "the order is still listed with its pool");
  // Referrer-scoped recipients never take a cut of hub delivery (no double pay).
  assert.equal(applies(rcpt({}), "SOLE", "camp-1"), false);
  assert.equal(applies(rcpt({ scopeReferrer: null }), "SOLE", "camp-1"), true);
  assert.equal(maxReferrerAllocationBps([rcpt({}), rcpt({ rkey: "x", pctBps: 6000 })]), 11000);
});

test("statements: referral commission lines are payable (not hub-gated) and approve like any other line", async () => {
  store.setAdPoolForTests(new PGlite() as unknown as store.Queryable, "ads_ref_t2");
  promo.resetMemberCache();
  await draftCampaignFromCheckoutSafe(session("cs_live_ref_bridget_1", { sku: "reserve-490", st: "bridget", st_qr: "birch-intake", site: "birch" }, 49_000, "jane@acmebrand.co"));
  await store.addRecipientVersion(rcpt({ rkey: "bridget-ref", name: "Bridget", scopeReferrer: "bridget", pctBps: 2500, effectiveAt: T("2026-11-01T00:00:00Z") }), "t");
  const st = await store.statements(13);
  const line = st.lines.find((l) => l.partner === "ref:bridget-ref")!;
  assert.ok(line, "referral line present");
  assert.equal(line.source, "referral");
  assert.equal(line.status, "calculated");
  assert.equal(line.payableMicros, 24_500_000); // $490 × 20% × 25%
  const ap = await store.approvePayout("ref:bridget-ref", line.month, "usd", "randy");
  assert.equal(ap?.status, "approved");
  const orders = await listReferralOrders();
  const recips = await store.recipientHistory();
  const { detail } = splitReferralOrders(orders.map(toLine), await store.rateHistory(), recips, await store.channelRateHistory());
  assert.equal(detail[0]!.commissions[0]!.micros, 24_500_000);
  // Admin payouts view: per-order referrer attribution + per-referrer commission.
  const html = referralAdminHtml({ orders, detail, members: (await promo.members()).map((m) => ({ id: m.id, label: m.label })), recipients: recips });
  assert.match(html, /id="referrals"/);
  assert.match(html, /<b>Bridget<\/b><div class="fine">bridget · QR birch-intake/);
  assert.match(html, /\$98\.00 USD/); // pool
  assert.match(html, /\$24\.50 USD/); // commission
  store.setAdPoolForTests(null);
});

/* ------------------------------------------------------------------------------------------------ browser script (vm) */
type Fake = { cookies: string[]; fetches: Array<{ url: string; attr: string | null }>; ls: Map<string, string>; run: (code: string) => void; win: Record<string, unknown> };
function fakeBrowser(href: string, scanMember: (st: string) => string | null): Fake {
  const u = new URL(href);
  const jar = new Map<string, string>();
  const cookies: string[] = [];
  const ls = new Map<string, string>();
  const ss = new Map<string, string>();
  const fetches: Fake["fetches"] = [];
  const document = {
    get cookie() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(v: string) { cookies.push(v); const [kv] = v.split(";"); const i = kv!.indexOf("="); const k = kv!.slice(0, i).trim(); const val = kv!.slice(i + 1); if (/Max-Age=0/.test(v)) jar.delete(k); else jar.set(k, val); },
    readyState: "complete", addEventListener() {}, querySelectorAll: () => [], getElementById: () => null, head: { appendChild() {} }, documentElement: { setAttribute() {} },
  };
  const baseFetch = async (i: unknown, o?: { headers?: Headers; body?: string }) => {
    const url = String(i);
    fetches.push({ url, attr: o?.headers instanceof Headers ? o.headers.get("x-br-attr") : null });
    if (/v1\/promo\/scan$/.test(url)) {
      const m = scanMember(JSON.parse(o?.body ?? "{}").st);
      return m ? new Response(JSON.stringify({ ok: true, member: m }), { status: 200 }) : new Response(null, { status: 204 });
    }
    return new Response("{}", { status: 200 });
  };
  const win: Record<string, unknown> = {
    location: { href, origin: u.origin, hostname: u.hostname, protocol: u.protocol, search: u.search }, document, fetch: baseFetch, Headers, Request, Response, URL, URLSearchParams, JSON, Date, Math, Number, String, Object, RegExp, Array, Promise, setTimeout,
    localStorage: { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v) },
    sessionStorage: { getItem: (k: string) => ss.get(k) ?? null, setItem: (k: string, v: string) => void ss.set(k, v) },
    navigator: {}, history: { pushState() {}, replaceState() {} }, XMLHttpRequest: function () {}, Element: function () {}, MutationObserver: undefined, open() {},
    HTMLImageElement: undefined, HTMLScriptElement: undefined, HTMLSourceElement: undefined, HTMLVideoElement: undefined, HTMLAudioElement: undefined, HTMLIFrameElement: undefined,
  };
  (win.XMLHttpRequest as { prototype: unknown }).prototype = { open() {} };
  (win.Element as { prototype: unknown }).prototype = { setAttribute() {} };
  win.window = win;
  const ctx = vm.createContext(win);
  return { cookies, fetches, ls, win, run: (code: string) => vm.runInContext(code, ctx) };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
const members = (st: string) => (["mona", "bridget"].includes(st) ? st : null);

test("browser: QR scan on the Scale host keeps st + qr 30 days on .scalehealth.ca, and the mirror's checkout call carries them", async () => {
  const b = fakeBrowser("https://scalehealth.ca/intake?code=STREET100&st=mona&qr=scale-intake-digital", members);
  b.run(mirrorBootScript("scale_mirror").replace(/^<script>|<\/script>$/g, ""));
  b.run(PROMO_BOX_JS);
  await tick();
  assert.ok(b.cookies.some((c) => /^br_st=mona; Max-Age=25920\d\d; Path=\/; SameSite=Lax; Secure; Domain=\.scalehealth\.ca$/.test(c)), b.cookies.join("\n"));
  assert.ok(b.cookies.some((c) => c.startsWith("br_qr=scale-intake-digital;") && c.includes("Domain=.scalehealth.ca")));
  assert.ok(b.fetches.some((f) => f.url === "/intake/_m/v1/promo/scan"), "scan beacon routed through the mirror");
  await (b.win.fetch as (u: string, o: object) => Promise<Response>)("/v1/checkout", { method: "POST", body: "{}" });
  const co = b.fetches.find((f) => f.url === "/intake/_m/v1/checkout")!;
  assert.ok(co, "checkout call routed through /intake/_m");
  assert.equal(co.attr, "st=mona&qr=scale-intake-digital&code=STREET100");
  await (b.win.fetch as (u: string, o: object) => Promise<Response>)("/launch/splash/checkout", { method: "POST", body: "{}" });
  assert.equal(b.fetches.find((f) => f.url === "/intake/_m/launch/splash/checkout")!.attr, "st=mona&qr=scale-intake-digital&code=STREET100", "splash checkout carries attribution too");
});

test("browser: internal ?ref= links never wipe a real referrer; ?ref=<member> takes over once confirmed (last click)", async () => {
  const b = fakeBrowser("https://birchreserve.net/intake?st=mona&qr=birch-intake", members);
  b.run(PROMO_BOX_JS);
  await tick();
  const state = () => JSON.parse(b.ls.get("br_promo_v1") ?? "{}");
  assert.equal(state().st, "mona");
  // Same storage, a later page view on an internal tracked link.
  const b2 = fakeBrowser("https://birchreserve.net/intake?ref=home_tile", members);
  for (const [k, v] of b.ls) b2.ls.set(k, v);
  b2.run(PROMO_BOX_JS);
  await tick();
  assert.equal(JSON.parse(b2.ls.get("br_promo_v1")!).st, "mona", "home_tile is not a member, so Mona keeps the order");
  const b3 = fakeBrowser("https://birchreserve.net/buy?ref=bridget", members);
  for (const [k, v] of b2.ls) b3.ls.set(k, v);
  b3.run(PROMO_BOX_JS);
  await tick();
  assert.equal(JSON.parse(b3.ls.get("br_promo_v1")!).st, "bridget", "a confirmed member link is the new last click");
  assert.ok(b3.cookies.some((c) => c.startsWith("br_st=bridget;") && c.includes("Domain=.birchreserve.net")));
});

test("browser: www and apex share attribution through the domain cookie; expired state is dropped", async () => {
  const b = fakeBrowser("https://www.scalehealth.ca/intake/_m/buycalc", members);
  (b.win.document as { cookie: string }).cookie = `br_st=mona; Max-Age=100; Path=/`;
  (b.win.document as { cookie: string }).cookie = `br_qr=scale-intake; Max-Age=100; Path=/`;
  (b.win.document as { cookie: string }).cookie = `br_at=${Date.now() - 864e5}; Max-Age=100; Path=/`;
  b.run(PROMO_BOX_JS);
  await tick();
  const s = JSON.parse(b.ls.get("br_promo_v1")!);
  assert.equal(s.st, "mona");
  assert.equal(s.qr, "scale-intake");
  const old = fakeBrowser("https://birchreserve.net/buy", members);
  old.ls.set("br_promo_v1", JSON.stringify({ st: "mona", at: Date.now() - 31 * 864e5 }));
  old.run(PROMO_BOX_JS);
  await (old.win.fetch as (u: string, o: object) => Promise<Response>)("/v1/checkout", { method: "POST" });
  assert.equal(old.fetches.find((f) => f.url === "/v1/checkout")!.attr, null, "past 30 days nothing is carried");
});
