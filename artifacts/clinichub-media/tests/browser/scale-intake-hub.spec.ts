import { expect, test } from "@playwright/test";

test("Scale-facing intake (?ref=scale) defines a Hub and keeps the short form", async ({ page }) => {
  await page.goto("/intake?ref=scale&mock=1");
  const landing = page.getByTestId("intake-landing");
  await expect(landing.getByTestId("hub-definition")).toBeVisible();
  await expect(landing.getByTestId("hub-definition")).toContainText("co-branded Scale clinic storefront");
  await expect(landing.getByTestId("hub-definition")).toContainText("earn from day 1");
  await expect(page.locator("text=Reserve space now, book a big block, or get your free kit.")).toHaveCount(0);
  await expect(page.getByTestId("two-lane")).toHaveCount(0);
  await expect(page.getByTestId("kit-divider")).toHaveCount(0);
  await expect(page.getByTestId("intake-next-step")).toHaveCount(0);
  await expect(page.getByTestId("intake-gtm-setup")).toHaveCount(0);
  await expect(page.getByTestId("pulse-row")).toHaveCount(0);
  await expect(page.getByTestId("intake-short-form")).toBeVisible();
  await expect(page.getByTestId("intake-website")).toBeVisible();
  await expect(page.getByTestId("intake-email")).toBeVisible();
  await expect(page.getByTestId("intake-submit")).toBeVisible();
  await expect(page.getByTestId("intake-role-hub-card")).toContainText("Your audience books care and buys products through it.");
  await page.getByTestId("intake-reserve-space-link").click();
  await expect(page.getByTestId("two-lane")).toBeVisible();
});

test("default Birch intake keeps the reserve/block hero and does not show the Scale Hub definition", async ({ page }) => {
  await page.goto("/intake?mock=1");
  await expect(page.getByTestId("intake-landing")).toBeVisible();
  await expect(page.getByTestId("hub-definition")).toHaveCount(0);
  await expect(page.getByText("Reserve space now, book a big block, or get your free kit.")).toBeVisible();
  await expect(page.getByTestId("two-lane")).toBeVisible();
  await expect(page.getByTestId("intake-short-form")).toBeVisible();
  await expect(page.getByTestId("intake-website")).toBeVisible();
  await expect(page.getByTestId("intake-email")).toBeVisible();
  await expect(page.getByTestId("intake-submit")).toBeVisible();
});
