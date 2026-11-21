import { expect, test, type Page } from "@playwright/test";
import { auditPage } from "./helpers-overlap";

/**
 * Ad activation step (Nov 21 2026): shown after the intake submit (never at the start), standalone at /intake/activate.
 * Birch and the Scale mirror are one deployment; the mirror skin is injected the way the server does (window.__BR_MIRROR).
 * Set SHOTS=/dir to save screenshots. /v1/activation is stubbed so nothing is stored.
 */
const WIDTHS = [320, 375, 430, 768, 1024, 1280, 1440];
const SKINS = ["birch", "scale"] as const;

async function setup(page: Page, skin: (typeof SKINS)[number]) {
  if (skin === "scale") await page.addInitScript(() => { (window as unknown as { __BR_MIRROR: unknown }).__BR_MIRROR = { skin: "scale" }; document.documentElement.setAttribute("data-skin", "scale"); });
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/v1/activation", async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, stored: "saved" }) });
  });
  return bodies;
}

for (const skin of SKINS) {
  test(`standalone /intake/activate: answer both questions, payload is ranges + openness + exclusions (${skin})`, async ({ page }) => {
    const bodies = await setup(page, skin);
    await page.goto("/intake/activate?role=provider");
    await expect(page.getByTestId("act-inventory")).toBeVisible();
    await page.getByTestId("act-email").fill("hubowner@example-clinic.co");
    await page.getByTestId("act-submit").click();
    await expect(page.getByTestId("field-error")).toBeVisible();
    await page.getByTestId("act-pages-10-50").click();
    await page.getByTestId("act-views-5-25k").click();
    await page.getByTestId("act-list-none").click();
    await page.getByTestId("act-other").fill("Receipt inserts");
    await expect(page.getByTestId("act-exclusions")).toHaveCount(0);
    await page.getByTestId("act-openness-premium").click();
    await expect(page.getByTestId("act-exclusions")).toBeVisible();
    await page.getByTestId("act-excl-alcohol").click();
    await page.getByTestId("act-excl-gambling").click();
    await expect(page.getByTestId("act-review-note")).toContainText("explicit approval from our team");
    await page.getByTestId("act-submit").click();
    await expect(page.getByTestId("field-error")).toContainText("confirm");
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/activate-${skin}-filled.png`, fullPage: true });
    await page.getByTestId("act-ack").check();
    await page.getByTestId("act-submit").click();
    await expect(page.getByTestId("act-done")).toBeVisible();
    expect(bodies[0]).toMatchObject({ role: "provider", pages: "10-50", views: "5-25k", list: "none", openness: "premium", exclusions: ["alcohol", "gambling"], ack: true, email: "hubowner@example-clinic.co" });
  });

  test(`supplier intake: the questions appear only after the first submit (${skin})`, async ({ page }) => {
    await setup(page, skin);
    await page.goto("/intake/supplier?brand=crossover-symmetry&mock=1");
    await expect(page.getByTestId("ad-activation")).toHaveCount(0);
    await page.getByTestId("intake-website").fill("example-brand.com");
    await page.getByTestId("intake-email").fill("test+activation@silverbirchgrowth.com");
    await page.waitForTimeout(4500); // the form rejects a submit faster than a human
    await page.getByTestId("intake-submit").click();
    await expect(page.getByTestId("ad-activation")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("act-openness")).toContainText("Which ads can run on your hubs?");
    await expect(page.getByTestId("act-inventory")).toContainText("Your inventory estimate");
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/supplier-after-submit-${skin}.png`, fullPage: true });
  });

  for (const width of WIDTHS) {
    test(`no overlap/overflow @${width}: /intake/activate with exclusions open (${skin})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await ctx.newPage();
      await setup(page, skin);
      await page.goto("/intake/activate");
      await page.getByTestId("act-role-supplier").click();
      await page.getByTestId("act-openness-any").click();
      await page.getByTestId("act-excl-cannabis").click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      const hits = await auditPage(page);
      if (process.env.SHOTS && [320, 1440].includes(width)) await page.screenshot({ path: `${process.env.SHOTS}/activate-${skin}-${width}.png`, fullPage: true });
      await ctx.close();
      expect(hits, JSON.stringify(hits.slice(0, 8), null, 1)).toEqual([]);
    });
  }
  for (const width of [320, 390, 768, 1280, 1440]) {
    test(`no overlap/overflow @${width}: supplier intake after submit, activation step open (${skin})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await ctx.newPage();
      await setup(page, skin);
      await page.goto("/intake/supplier?brand=crossover-symmetry&mock=1");
      await page.getByTestId("intake-website").fill("example-brand.com");
      await page.getByTestId("intake-email").fill("test+activation@silverbirchgrowth.com");
      await page.waitForTimeout(3000);
      await page.getByTestId("intake-submit").click();
      await expect(page.getByTestId("ad-activation")).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("act-openness-premium").click();
      await page.getByTestId("ad-activation").scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      const hits = await auditPage(page);
      await ctx.close();
      expect(hits, JSON.stringify(hits.slice(0, 8), null, 1)).toEqual([]);
    });
  }
}
