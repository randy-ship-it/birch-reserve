import { expect, test } from "@playwright/test";
import { auditPage } from "./helpers-overlap";

/**
 * Regression: no horizontal overflow, clipped or overlapping text at phone widths, with every <details> open.
 * Birch pages run locally; set PLAYWRIGHT_BASE_URL to audit a live host, and AUDIT_PATHS to override the list.
 * On scalehealth.ca the mirror serves /intake, /intake/street-team etc. (same deployment, Scale skin).
 */
const WIDTHS = [320, 375, 390, 430, 1280, 1440];
const PATHS = (process.env.AUDIT_PATHS ?? [
  "/", "/advertise/brands", "/advertise/local", "/publish/brands", "/publish/studios", "/rates", "/match", "/hubs", "/media-kit",
  "/agencies", "/brand-kit", "/intake", "/intake/publisher", "/intake/supplier", "/intake/activate", "/intake/sponsor", "/intake/gtm", "/gtm-bot", "/intake/street-team",
  "/street-team", "/partners", "/media-buyers", "/audiences", "/audiences/sample-profile", "/buyers", "/ai-buyers", "/about", "/terms", "/privacy",
  "/insights", "/inventory",
  // Server-rendered (api-server) pages: only exist on a live/preview host.
  ...(process.env.PLAYWRIGHT_BASE_URL ? ["/hub-proof", "/sponsor", "/ads/docs", "/reel", "/buy", "/buycalc"] : []),
].join(",")).split(",");

for (const width of WIDTHS) {
  for (const path of PATHS) {
    test(`no overlap or overflow: ${path} @${width}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width, height: 800 },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      });
      const page = await ctx.newPage();
      await page.goto(path, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(/a plan, not a guarantee|Reach counted with the Street Team/);
      const hits = await auditPage(page);
      await ctx.close();
      expect(hits, JSON.stringify(hits.slice(0, 8), null, 1)).toEqual([]);
    });
  }
}
