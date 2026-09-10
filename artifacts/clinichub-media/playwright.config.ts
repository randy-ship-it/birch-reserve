import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const localBaseURL = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "../../.cache/playwright/clinichub-media",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: "pnpm run dev",
        env: {
          ...process.env,
          BASE_PATH: "/",
          PORT: "4173",
           VITE_BROWSER_TEST_AUTH: "true",
           VITE_EDITORIAL_WATCHDOG_INTERVAL_MS: "250",
        },
        url: localBaseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  use: {
    baseURL: externalBaseURL ?? localBaseURL,
    trace: "retain-on-failure",
  },
});