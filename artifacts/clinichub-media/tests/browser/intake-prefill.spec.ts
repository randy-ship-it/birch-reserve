import { expect, test, type Page } from "@playwright/test";

/** Prefilled brand links (/intake/b/:slug), mock adapter only: nothing leaves the browser. */
type Row = { editToken: string; reportToken: string; slug: string; fields: Record<string, any>; meta: { status: string; version: number }; patches: Array<Record<string, any>> };
const rows = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("br_prefill_mock_v1") || "{}") as Record<string, Row>);
const only = async (page: Page) => Object.values(await rows(page))[0]!;

test("hydrates from the read-back, marks drafted fields, and an untouched form never saves", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  await expect(page.getByTestId("prefill-banner")).toContainText("We drafted this from what we know. Fix anything.");
  await expect(page.getByTestId("pf-brand-input")).toHaveValue("Northline Recovery");
  await expect(page.getByTestId("pf-orders-input")).toHaveValue("1800");
  await expect(page.getByTestId("pf-brand")).toHaveAttribute("data-mark", "drafted");
  await expect(page.getByTestId("prefill-report-label")).toHaveText("Draft preview · Estimated");
  await page.waitForTimeout(1500);
  expect((await only(page)).patches).toEqual([]);
  await expect(page.getByTestId("prefill-save")).toContainText("Nothing changed yet");
});

test("a partial edit saves only that block, whole: other prefilled fields survive", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  await page.getByTestId("pf-orders-input").fill("2500");
  await expect(page.getByTestId("pf-orders")).toHaveAttribute("data-mark", "edited");
  await expect(page.getByTestId("prefill-save")).toHaveAttribute("data-state", "saved");
  const r = await only(page);
  expect(r.patches).toHaveLength(1);
  expect(Object.keys(r.patches[0]!)).toEqual(["calculator"]);
  expect(r.fields.calculator).toEqual({ avg_cart_usd: 120, orders_per_month: 2500, purchases_per_year: 2, margin_band: "50_70" });
  expect(r.fields.profile.interests).toBe("Recovery Devices");
  expect(r.fields.company_name).toBe("Northline Recovery");
});

test("confirm = same record, version N+1, same report token; the report recalibrates", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  const before = await only(page);
  await page.getByTestId("pf-aov-input").fill("150");
  await page.waitForTimeout(2600); // the form's human-speed brake
  await page.getByTestId("pf-email").fill("ops@northlinerecovery.example");
  await page.getByTestId("pf-confirm-btn").click();
  await expect(page.getByTestId("prefill-report-label")).toContainText("Confirmed · version 1");
  await expect(page.getByTestId("prefill-recalibrated")).toBeVisible();
  const after = await only(page);
  expect(after.reportToken).toBe(before.reportToken);
  expect(after.meta).toMatchObject({ status: "submitted", version: 1 });
  expect(after.fields.calculator.avg_cart_usd).toBe(150);
  expect(after.fields.calculator.orders_per_month).toBe(1800);
});

test("the copy-paste link adopts the key and strips it from the address bar", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  const r = Object.entries(await rows(page))[0]!;
  const frag = Buffer.from(JSON.stringify({ i: r[0], e: r[1].editToken, r: r[1].reportToken, v: 0 })).toString("base64url");
  await page.evaluate(() => localStorage.removeItem("br_prefill_ref_northline-recovery_v1"));
  // Fresh tab (how a brand opens it) …
  await page.goto("about:blank");
  await page.goto(`/intake/b/northline-recovery?mock=1#edit=${frag}`);
  await expect(page.getByTestId("pf-brand-input")).toHaveValue("Northline Recovery");
  expect(page.url()).not.toContain("#edit=");
  // … and pasted into a tab that already has the page open.
  await page.evaluate(() => localStorage.removeItem("br_prefill_ref_northline-recovery_v1"));
  await page.goto(`/intake/b/northline-recovery?mock=1#edit=${frag}`);
  await expect(page.getByTestId("pf-brand-input")).toHaveValue("Northline Recovery");
  await expect.poll(() => page.url()).not.toContain("#edit=");
});

test("a re-issued (rotated) link: the old key says it was replaced, in plain words", async ({ page }) => {
  await page.goto("/intake/b/roll-recovery?mock=1&mockstate=replaced");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This link has been replaced.");
  await expect(page.getByTestId("prefill-error-copy")).toContainText("replaced with a newer one");
  await expect(page.getByTestId("prefill-form")).toHaveCount(0);
});

test("staff link: edits the draft, never shows Confirm, edits stay drafted (not brand-edited)", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1&mockstate=staff");
  await expect(page.getByTestId("prefill-staff-note")).toContainText("Staff link");
  await expect(page.getByTestId("pf-confirm-btn")).toHaveCount(0);
  await expect(page.getByTestId("pf-email")).toHaveCount(0);
  await expect(page.getByTestId("pf-no-confirm")).toBeVisible();
  await page.getByTestId("pf-orders-input").fill("2200");
  await expect(page.getByTestId("prefill-save")).toHaveAttribute("data-state", "saved");
  const r = await only(page);
  expect(r.fields.calculator.orders_per_month).toBe(2200);
  expect((r.meta as any).markers.edited).toEqual([]);
  expect(r.meta.version).toBe(0);
});

test("draft preview carries no fit adjectives (numeric scores only)", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  await expect(page.getByTestId("prefill-report-label")).toHaveText("Draft preview · Estimated");
  const text = await page.getByTestId("prefill-report").innerText();
  expect(text).not.toMatch(/\b(Good|Strong|Possible|Early|Likely) fit\b/);
});

test("expired / revoked / missing key: plain copy, no form", async ({ page }) => {
  await page.goto("/intake/b/kalaya?mock=1&mockstate=expired");
  await expect(page.getByTestId("prefill-error-copy")).toContainText("expired");
  await page.goto("/intake/b/roll-recovery?mock=1&mockstate=revoked");
  await expect(page.getByTestId("prefill-error-copy")).toContainText("turned off");
  await expect(page.getByTestId("prefill-form")).toHaveCount(0);
});

test("visitor copy: no Publisher / Align / Clairvoyant / CTR / ROAS / guarantee words", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  await expect(page.getByTestId("prefill-form")).toBeVisible();
  await page.getByTestId("pf-more").locator("summary").click();
  const text = await page.getByTestId("prefill-page").innerText();
  for (const bad of [/publisher/i, /\balign\b/i, /clairvoyant/i, /friday/i, /\bCTR\b/, /\bROAS\b/, /guarantee/i, /not taken/i]) expect(text).not.toMatch(bad);
});

test("clearing a drafted number sends an explicit null and the backend drops only that key", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  await page.getByTestId("pf-aov-input").fill("");
  await expect(page.getByTestId("prefill-save")).toHaveAttribute("data-state", "saved");
  const r = await only(page);
  expect(r.patches[0]!.calculator.avg_cart_usd).toBeNull();
  expect(r.fields.calculator).toEqual({ orders_per_month: 1800, purchases_per_year: 2, margin_band: "50_70" });
});

test("confirm without an email on file asks for one; nothing is submitted", async ({ page }) => {
  await page.goto("/intake/b/northline-recovery?mock=1");
  await page.getByTestId("pf-confirm-btn").click();
  await expect(page.getByTestId("pf-error")).toContainText("work email");
  expect((await only(page)).meta.version).toBe(0);
});
