import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { deflateSync } from "node:zlib";
import buyRouter, { renderBuyPage } from "../src/routes/buy";
import {
  BUY_FORMATS, BUY_PATH, BUY_PLANS, BUY_TAGLINE, buyPlans, CREATIVE_MAX_BYTES, checkCreative, domainCheck, parseAccount,
  resetBuyLimitsForTests, setBuyStoreForTests, memoryBuyStore, signToken, sniffImage, validPick, verifyToken, findPlan, findFormat, isProductionRuntime, buyStore,
} from "../src/lib/buyFlow";
import { CHECKOUT_TAGLINE, STATEMENT_DESCRIPTOR_SUFFIX, birchCheckoutCustomText, birchPaymentIntentBrand } from "../src/lib/checkoutCopy";
import { PUBLIC_RESERVE_OFFERS, reserveCheckoutLineItem } from "../src/lib/reserveOffers";
import { PUBLIC_SITEMAP_PATHS } from "../src/lib/publicSeo";
import { buildAreaLockSession } from "../src/lib/overhaul/checkout";

// Copy rules (Randy, Nov 2026). Kalaya is never mentioned to visitors (Nov 27 2026).
const BANNED = [
  /\bFriday\b/, /\bAlign\b/, /Clairvoyant/i, /Alset/i, /80 locations/i, /MedVibe/i, /\bsigned partners\b/i, /Integrity Fitness/i, /Kalaya/i,
  // CAD is allowed since Nov 21 2026 3:34 PM ET (geo currency + toggle); C$ shorthand stays out.
  /\bPublisher\b/, /C\$/, /guarantee(d)? (results|reach|impressions|roi|leads|views)/i, /\bROAS\b/, /\bCTR\b/,
  /\b(not taken|unclaimed|is open|are open|still open|open now|0 (hubs|brands|spots|seats))\b/i, /\bseats? left\b/i, /—/,
];
const visible = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

/** Minimal valid PNG of w×h (one IDAT of zeros). */
function png(w: number, h: number): Buffer {
  const crc = (b: Buffer) => {
    let c = ~0;
    for (const x of b) {
      c ^= x;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function jpegHeader(w: number, h: number): Buffer {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "binary"), sof, Buffer.alloc(32)]);
}

test("page: Randy's line is the headline, copy rules hold, three steps, honeypot, USD, no counts", () => {
  for (const live of [true, false]) {
    const html = renderBuyPage({ checkoutLive: live });
    assert.match(html, new RegExp(`<h1>${BUY_TAGLINE.replace(".", "\\.")}</h1>`));
    assert.match(html, /<link rel="canonical" href="https:\/\/birchreserve\.net\/buy" \/>/);
    assert.match(html, /id="s1"[\s\S]*id="s2"[\s\S]*id="s3"/);
    assert.match(html, /name="fax"/);
    assert.match(html, /reviewed before it runs/i);
    assert.match(html, /USD/);
    for (const re of BANNED) assert.doesNotMatch(visible(html), re, `${re}`);
    assert.doesNotMatch(visible(html), /\b0\s+(placements|hubs|brands)/i);
  }
  assert.ok((PUBLIC_SITEMAP_PATHS as readonly string[]).includes(BUY_PATH));
});

test("slots: card plans only on self-serve spots, exclusive anywhere; prices come from the live offers", () => {
  for (const o of PUBLIC_RESERVE_OFFERS) assert.ok(BUY_PLANS.some((p) => p.key === o.sku && p.price === `$${o.dueTodayUsd} USD`), o.sku);
  // One price source, visitor currency (Nov 21 2026): CAD table for look / reserve, same $1,900 for the exclusive reserve.
  assert.deepEqual(buyPlans("cad").map((p) => p.price), ["$690 CAD", "$270 CAD", "$1,900 CAD"]);
  assert.deepEqual(buyPlans("usd").map((p) => p.price), ["$490 USD", "$190 USD", "$1,900 USD"]);
  assert.match(buyPlans("cad").find((p) => p.key === "exclusive")!.line, /\$5K–\$50K CAD/);
  assert.equal(findPlan("exclusive")!.pay, "reserve");
  const prem = BUY_FORMATS.find((f) => f.premium)!;
  const self = BUY_FORMATS.find((f) => !f.premium)!;
  assert.equal(validPick(findPlan("reserve-490"), prem), false);
  assert.equal(validPick(findPlan("reserve-490"), self), true);
  assert.equal(validPick(findPlan("exclusive"), prem), true);
  assert.equal(validPick(findPlan("nope"), self), false);
  assert.equal(validPick(findPlan("hold-190"), findFormat("motion_15s")), false);
});

test("account: validation and a soft email-vs-website check (flag, never block)", () => {
  assert.equal(domainCheck("jo@acme.com", "acme.com"), "match");
  assert.equal(domainCheck("jo@mail.acme.com", "shop.acme.com"), "match");
  assert.equal(domainCheck("jo@acme.co.uk", "acme.co.uk"), "match");
  assert.equal(domainCheck("jo@other.com", "acme.com"), "mismatch");
  assert.equal(domainCheck("jo@gmail.com", "acme.com"), "free_email");
  const ok = parseAccount({ name: "Jo Doe", email: "Jo@Acme.com", company: "Acme", website: "www.acme.com/shop" });
  assert.ok(ok.ok && ok.value.website === "https://acme.com" && ok.value.email === "jo@acme.com");
  const gm = parseAccount({ name: "Jo Doe", email: "jo@gmail.com", company: "Acme", website: "acme.com" });
  assert.ok(gm.ok && gm.value.domainCheck === "free_email");
  for (const bad of [{}, { name: "J", email: "jo@acme.com", company: "Acme", website: "acme.com" }, { name: "Jo", email: "nope", company: "Acme", website: "acme.com" }, { name: "Jo", email: "jo@acme.com", company: "Acme", website: "javascript:alert(1)" }]) {
    assert.equal(parseAccount(bad).ok, false);
  }
});

test("tokens: signed, typed, expiring, tamper-proof", () => {
  const t = signToken("acct", { e: "jo@acme.com", id: "x" });
  assert.equal(verifyToken<{ e: string }>("acct", t)?.e, "jo@acme.com");
  assert.equal(verifyToken("crv", t), null);
  const [b, m] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ k: "acct", x: Date.now() + 1e6, e: "evil@x.com", id: "x" })).toString("base64url");
  assert.equal(verifyToken("acct", `${forged}.${m}`), null);
  assert.equal(verifyToken("acct", `${b}.${m}x`), null);
  assert.equal(verifyToken("acct", signToken("acct", { id: "x" }, -1)), null);
});

test("creative: type from bytes, size and pixel limits", () => {
  assert.deepEqual(sniffImage(png(600, 400)), { mime: "image/png", width: 600, height: 400 });
  assert.deepEqual(sniffImage(jpegHeader(1200, 628)), { mime: "image/jpeg", width: 1200, height: 628 });
  assert.equal(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>                ")), null);
  assert.equal(checkCreative(png(600, 400)).ok, true);
  assert.equal(checkCreative(png(100, 100)).ok, false);
  assert.equal(checkCreative(png(5000, 300)).ok, false);
  assert.equal(checkCreative(Buffer.alloc(CREATIVE_MAX_BYTES + 1)).ok, false);
  assert.equal(checkCreative(Buffer.from("MZ executable pretending to be a png....")).ok, false);
});

test("stripe: descriptor suffix fits Stripe's rules with the BIRCHRSV prefix; line items carry the tagline", () => {
  assert.match(STATEMENT_DESCRIPTOR_SUFFIX, /^[A-Z0-9 ]*[A-Z][A-Z0-9 ]*$/);
  assert.ok(`BIRCHRSV* ${STATEMENT_DESCRIPTOR_SUFFIX}`.length <= 22);
  assert.doesNotMatch(STATEMENT_DESCRIPTOR_SUFFIX, /BIRCH/);
  const pid = birchPaymentIntentBrand("7-day category look");
  assert.equal(pid.statement_descriptor_suffix, "SCALE ADS");
  assert.ok(pid.description.startsWith(CHECKOUT_TAGLINE));
  for (const o of PUBLIC_RESERVE_OFFERS) {
    const li = reserveCheckoutLineItem(o) as { price_data?: { product_data: { description: string } } };
    if (li.price_data) assert.ok(li.price_data.product_data.description.startsWith(CHECKOUT_TAGLINE));
  }
  assert.ok(birchCheckoutCustomText().submit.message.startsWith(CHECKOUT_TAGLINE));
  assert.ok(birchCheckoutCustomText().submit.message.length <= 1200);
  assert.equal(typeof buildAreaLockSession, "function");
});

test("store: previews and tests never use the production database", () => {
  delete process.env.VERCEL_ENV;
  assert.equal(isProductionRuntime(), false);
  assert.equal(buyStore().name, "memory");
});

test("routes: account → upload → order (card hands back the /v1/checkout body; exclusive hands back the reserve checkout body)", async () => {
  const store = memoryBuyStore();
  setBuyStoreForTests(store);
  resetBuyLimitsForTests();
  const app = express();
  app.use(buyRouter);
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const UA = { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36" };
  const json = (p: string, body: unknown, h: Record<string, string> = {}) => fetch(base + p, { method: "POST", headers: { ...UA, "content-type": "application/json", ...h }, body: JSON.stringify(body) });
  try {
    const page = await fetch(`${base}/buy`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);

    assert.equal((await json("/v1/buy/account", { name: "Jo", email: "jo@acme.com", company: "Acme", website: "acme.com" }, { "user-agent": "curl/8" })).status, 403);
    const hp = await (await json("/v1/buy/account", { name: "Jo", email: "jo@acme.com", company: "Acme", website: "acme.com", fax: "x" })).json() as { account: string };
    assert.equal((await fetch(`${base}/v1/buy/creative`, { method: "POST", headers: { ...UA, "content-type": "image/png", "x-buy-account": hp.account }, body: png(600, 400) })).status, 401);

    const a = await json("/v1/buy/account", { name: "QA Test", email: "qa+buy@acme.com", company: "Acme", website: "https://acme.com" });
    assert.equal(a.status, 200);
    const acct = (await a.json()) as { account: string; domain_check: string };
    assert.equal(acct.domain_check, "match");

    const noAcct = await fetch(`${base}/v1/buy/creative`, { method: "POST", headers: { ...UA, "content-type": "image/png" }, body: png(600, 400) });
    assert.equal(noAcct.status, 401);
    const bad = await fetch(`${base}/v1/buy/creative`, { method: "POST", headers: { ...UA, "content-type": "image/png", "x-buy-account": acct.account }, body: Buffer.from("not an image at all, just text....") });
    assert.equal(bad.status, 400);
    const big = await fetch(`${base}/v1/buy/creative`, { method: "POST", headers: { ...UA, "content-type": "image/png", "x-buy-account": acct.account }, body: Buffer.alloc(CREATIVE_MAX_BYTES + 4096) });
    assert.equal(big.status, 413);
    const up = await fetch(`${base}/v1/buy/creative`, { method: "POST", headers: { ...UA, "content-type": "image/png", "x-buy-account": acct.account }, body: png(600, 400) });
    assert.equal(up.status, 200);
    const crv = (await up.json()) as { creative: string; width: number };
    assert.equal(crv.width, 600);
    const cid = verifyToken<{ id: string }>("crv", crv.creative)!.id;
    assert.ok(await store.getCreative(cid));

    assert.equal((await json("/v1/buy/order", { account: acct.account, creative: crv.creative, plan: "reserve-490", format: "post_checkout", terms: true })).status, 400);
    assert.equal((await json("/v1/buy/order", { account: acct.account, creative: crv.creative, plan: "reserve-490", format: "member_hub" })).status, 400);
    const other = (await (await json("/v1/buy/account", { name: "Al Bee", email: "al@other.com", company: "Other", website: "other.com" })).json()) as { account: string };
    assert.equal((await json("/v1/buy/order", { account: other.account, creative: crv.creative, plan: "reserve-490", format: "member_hub", terms: true })).status, 400);

    const card = await json("/v1/buy/order", { account: acct.account, creative: crv.creative, plan: "reserve-490", format: "member_hub", terms: true });
    assert.equal(card.status, 200);
    const co = (await card.json()) as { next: string; checkout: Record<string, string> };
    assert.equal(co.next, "checkout");
    assert.deepEqual(Object.keys(co.checkout).sort(), ["brand", "currency", "email", "format_pref", "idempotency_key", "sku", "website_url"]);
    assert.equal(co.checkout.sku, "reserve-490");
    assert.equal(co.checkout.currency, "usd");

    const inv = await json("/v1/buy/order", { account: acct.account, creative: crv.creative, plan: "exclusive", format: "post_checkout", terms: true, currency: "cad" });
    const ex = (await inv.json()) as { next: string; reserve: Record<string, unknown> };
    assert.equal(ex.next, "reserve");
    assert.deepEqual(ex.reserve, { brand: "Acme", email: ex.reserve.email, category: "", agree: true, currency: "cad" });
    assert.equal((await store.listOrders(10)).length, 2);

    // "Send it later" (Nov 21 2026): no image needed to order; the order carries no creative and stays pending review.
    const laterAcct = (await (await json("/v1/buy/account", { name: "QA Later", email: "qa+later@acme.com", company: "Acme", website: "acme.com" })).json()) as { account: string };
    assert.equal((await json("/v1/buy/order", { account: laterAcct.account, plan: "hold-190", format: "member_hub", terms: true })).status, 400);
    const later = await json("/v1/buy/order", { account: laterAcct.account, creative_later: true, plan: "hold-190", format: "member_hub", terms: true });
    assert.equal(later.status, 200);
    assert.equal(((await later.json()) as { next: string }).next, "checkout");
    const lo = (await store.listOrders(10))[0]!;
    assert.equal(lo.creativeId, null);
    assert.equal(lo.reviewStatus, "pending_review");
    assert.equal((await store.listOrders(10)).length, 3);
    assert.ok((await store.listOrders(10)).every((o) => o.reviewStatus === "pending_review"));

    let last = 200;
    for (let i = 0; i < 7; i++) last = (await json("/v1/buy/order", { account: acct.account, creative: crv.creative, plan: "hold-190", format: "member_hub", terms: true })).status;
    assert.equal(last, 429);
  } finally {
    server.close();
    setBuyStoreForTests(null);
  }
});

test("page: ?plan= preselects a known plan; unknown keeps the default", () => {
  const checked = (html: string) => /name="plan" value="([^"]+)" checked/.exec(html)?.[1];
  assert.equal(checked(renderBuyPage({ checkoutLive: true })), "reserve-490");
  assert.equal(checked(renderBuyPage({ checkoutLive: true, plan: "hold-190" })), "hold-190");
  assert.equal(checked(renderBuyPage({ checkoutLive: true, plan: "exclusive" })), "exclusive");
  assert.equal(checked(renderBuyPage({ checkoutLive: true, plan: "<x>" })), "reserve-490");
});

// Nov 20 2026 (Randy): post-kit checkout prefill. Encrypted token, email never readable in the URL.
import { openPrefill as _open, sealPrefill as _seal, parsePrefill as _parse } from "../src/lib/buyFlow";
test("kit prefill: sealed token round-trips, hides the email, expires, rejects tampering", () => {
  const p = _parse({ name: "Sam Lee", email: "Sam@Acme.com", company: "Acme", website: "acme.com", junk: "x" });
  assert.deepEqual(p, { name: "Sam Lee", email: "sam@acme.com", company: "Acme", website: "acme.com" });
  const t = _seal(p, 1_000);
  assert.doesNotMatch(Buffer.from(t, "base64url").toString("latin1"), /acme/i, "email/brand not readable");
  assert.deepEqual(_open(t, 2_000), p);
  assert.equal(_open(t, 1_000 + 3 * 3600_000), null, "expired");
  const bad = t.slice(0, -2) + (t.endsWith("A") ? "BB" : "AA");
  assert.equal(_open(bad, 2_000), null, "tampered");
  assert.equal(_open("nope", 2_000), null);
});

test("kit prefill: /buy?pf= fills step 1, no-store, and the POST endpoint seals", async () => {
  const html = renderBuyPage({ checkoutLive: true, plan: "hold-190", prefill: { email: "sam@acme.com", company: "Acme <b>", website: "acme.com" } });
  assert.match(html, /id="b-email"[^>]*value="sam@acme\.com"/);
  assert.match(html, /id="b-company"[^>]*value="Acme &lt;b&gt;"/);
  assert.match(html, /Filled in from your kit/);
  assert.doesNotMatch(renderBuyPage({ checkoutLive: true }), /Filled in from your kit|value="sam/);
  const app = express(); app.use(buyRouter);
  const srv = app.listen(0); const port = (srv.address() as AddressInfo).port;
  try {
    const ua = { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131 Safari/537.36", "content-type": "application/json" };
    const r = await fetch(`http://127.0.0.1:${port}/v1/buy/prefill`, { method: "POST", headers: ua, body: JSON.stringify({ email: "sam@acme.com", company: "Acme", website: "acme.com" }) });
    assert.equal(r.status, 200);
    const { pf } = (await r.json()) as { pf: string };
    const g = await fetch(`http://127.0.0.1:${port}/buy?plan=hold-190&pf=${pf}`, { headers: ua });
    assert.match(g.headers.get("cache-control") ?? "", /no-store/);
    assert.match(await g.text(), /id="b-email"[^>]*value="sam@acme\.com"/);
    const e = await fetch(`http://127.0.0.1:${port}/v1/buy/prefill`, { method: "POST", headers: ua, body: "{}" });
    assert.equal(e.status, 400);
  } finally { srv.close(); }
});
