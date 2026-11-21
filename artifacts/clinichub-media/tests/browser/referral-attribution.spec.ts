/**
 * Referral attribution, live, on BOTH hosts (Randy, Nov 21 2026 4:07 PM): scan a street-team QR URL, browse, start a checkout,
 * and prove the Stripe Checkout Session carries the referrer. Never pays: a qa+ email, the Stripe redirect is never followed,
 * and the open session self-expires. Opt-in because it creates real (unpaid) Stripe sessions:
 *   REFERRAL_E2E_LIVE=1 pnpm exec playwright test tests/browser/referral-attribution.spec.ts --config=playwright.config.ts
 * (set PLAYWRIGHT_BASE_URL to anything so the local dev server is not started). Rule: docs/ads/ARCHITECTURE.md "Referral attribution".
 */
import { expect, test, type Page } from "@playwright/test";

const LIVE = process.env.REFERRAL_E2E_LIVE === "1";
const BIRCH = process.env.REFERRAL_E2E_BIRCH ?? "https://birchreserve.net";
const SCALE = process.env.REFERRAL_E2E_SCALE ?? "https://scalehealth.ca";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

test.use({ userAgent: UA });
test.skip(!LIVE, "live referral e2e is opt-in (REFERRAL_E2E_LIVE=1)");

type Host = { name: string; qr: string; browse: string[]; checkoutFrom: string; cookieDomain: string; site: "birch" | "scale"; st: string; qrLabel: string };
const HOSTS: Host[] = [
  { name: "birchreserve.net", qr: `${BIRCH}/intake?code=STREET100&st=bridget&qr=birch-intake`, browse: [`${BIRCH}/media-kit`, `${BIRCH}/intake?ref=home_tile`], checkoutFrom: `${BIRCH}/buycalc`, cookieDomain: ".birchreserve.net", site: "birch", st: "bridget", qrLabel: "birch-intake" },
  { name: "scalehealth.ca mirror", qr: `${SCALE}/intake?code=STREET100&st=mona&qr=scale-intake-digital`, browse: [`${SCALE}/intake/supplier`, `${SCALE}/intake?ref=nav`], checkoutFrom: `${SCALE}/intake/_m/buycalc`, cookieDomain: ".scalehealth.ca", site: "scale", st: "mona", qrLabel: "scale-intake-digital" },
];

async function startCheckout(page: Page, email: string): Promise<string> {
  // The page's own fetch: the same wrapped path the buy / buycalc buttons use (promo header + Scale mirror routing).
  const out = await page.evaluate(async (em) => {
    const r = await fetch("/v1/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sku: "hold-190", brand: "QA Referral Test", email: em, website_url: "https://example.com", currency: "usd", idempotency_key: `qa-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, email);
  expect(out.status, JSON.stringify(out.body)).toBeLessThan(300);
  const url = String((out.body as { checkout_url?: string }).checkout_url ?? "");
  const sid = url.match(/cs_(?:live|test)_[A-Za-z0-9]+/)?.[0];
  expect(sid, `checkout_url ${url}`).toBeTruthy();
  return sid!;
}

for (const h of HOSTS) {
  test(`QR → browse → checkout carries the referrer on ${h.name}`, async ({ page, context }) => {
    await page.route(/checkout\.stripe\.com/, (r) => r.abort());
    const scan = page.waitForResponse((r) => /\/v1\/promo\/scan$/.test(r.url()), { timeout: 15_000 });
    await page.goto(h.qr, { waitUntil: "domcontentloaded" });
    const sr = await scan;
    expect(sr.status()).toBe(200);
    expect(await sr.json()).toMatchObject({ member: h.st });
    for (const u of h.browse) await page.goto(u, { waitUntil: "domcontentloaded" });
    const ck = (await context.cookies()).filter((c) => c.name === "br_st" || c.name === "br_qr");
    expect(ck.find((c) => c.name === "br_st")).toMatchObject({ value: h.st, domain: h.cookieDomain });
    expect(ck.find((c) => c.name === "br_qr")).toMatchObject({ value: h.qrLabel, domain: h.cookieDomain });
    await page.goto(h.checkoutFrom, { waitUntil: "domcontentloaded" });
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("br_promo_v1") ?? "{}"));
    expect(state).toMatchObject({ st: h.st, qr: h.qrLabel });
    const sid = await startCheckout(page, `qa+referral-${h.site}-${Date.now()}@silverbirchgrowth.com`);
    const md = await page.evaluate(async (s) => (await fetch("/v1/promo/attribution", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session_id: s }) })).json(), sid);
    expect(md).toMatchObject({ ok: true, st: h.st, st_qr: h.qrLabel, site: h.site });
  });
}
