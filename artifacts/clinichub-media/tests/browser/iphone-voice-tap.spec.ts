import { devices, expect, test, type Page } from "@playwright/test";

/**
 * iPhone Safari: the convai host used to shrink to 0px wide, so Start / Accept
 * never received the tap and getUserMedia never ran inside the gesture.
 * WebKit + iPhone 13 is the check. Chromium CI skips this file.
 */
test.use({
  ...devices["iPhone 13"],
  permissions: ["microphone"],
});

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== "webkit", "iPhone voice tap is a WebKit check");
});

async function installFakeMic(page: Page) {
  await page.addInitScript(() => {
    // This WebKit build aborts the process if it decodes the hub mp4.
    const create = document.createElement.bind(document);
    document.createElement = function (tag: string, options?: ElementCreationOptions) {
      if (String(tag).toLowerCase() === "video") return create("div");
      return create(tag, options);
    };
    const calls: number[] = [];
    (window as unknown as { __gum: number[] }).__gum = calls;
    const md = navigator.mediaDevices;
    if (!md) {
      (window as unknown as { __gumMissing?: boolean }).__gumMissing = true;
      return;
    }
    md.getUserMedia = function getUserMedia() {
      calls.push(performance.now());
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(dest);
      osc.start();
      return Promise.resolve(dest.stream);
    };
  });
}

test("iPhone WebKit tap starts the voice session and the phone link is tappable", async ({ page }) => {
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    if (/elevenlabs/i.test(socket.url)) sockets.push(socket.url);
  });
  await installFakeMic(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content: "vite-error-overlay{display:none !important;pointer-events:none !important}",
  });

  const host = page.locator("elevenlabs-convai");
  await expect(host).toBeVisible({ timeout: 20_000 });
  const hostBox = await host.boundingBox();
  expect(hostBox?.width ?? 0).toBeGreaterThan(300);
  expect(hostBox?.height ?? 0).toBeGreaterThan(400);

  const callLink = page.getByTestId("link-mobile-tap-to-call");
  await expect(callLink).toBeVisible();
  await expect(callLink).toHaveAttribute("href", "tel:+16479316278");
  await expect(callLink).toHaveText(/Call \(647\) 931-6278/);
  const callBox = await callLink.boundingBox();
  expect(callBox).not.toBeNull();
  const viewport = page.viewportSize();
  expect((callBox?.y ?? 9999) + (callBox?.height ?? 0)).toBeLessThan((viewport?.height ?? 0) + 1);
  const callHit = await callLink.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return hit === el || el.contains(hit);
  });
  expect(callHit).toBe(true);

  const heroCall = page.getByTestId("link-hero-tap-to-call");
  await heroCall.scrollIntoViewIfNeeded();
  await expect(heroCall).toHaveAttribute("href", "tel:+16479316278");
  const heroHit = await heroCall.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + Math.min(24, rect.width / 2), rect.y + rect.height / 2);
    return hit === el || Boolean(el.contains(hit));
  });
  expect(heroHit).toBe(true);

  await page.evaluate(() => window.scrollTo(0, 0));
  const start = host.getByRole("button", { name: /start a call|start talking|hear randy/i });
  await expect(start).toBeVisible({ timeout: 20_000 });
  await start.tap();

  const accept = host.getByRole("button", { name: /^accept$/i });
  await expect(accept).toBeVisible({ timeout: 10_000 });
  const acceptHit = await accept.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const root = (el.getRootNode() as ShadowRoot).host;
    return hit === root || root.contains(hit as Node);
  });
  expect(acceptHit).toBe(true);
  await accept.tap();

  let detail = "";
  let started = false;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
        const state = await page.evaluate(() => {
          const root = document.querySelector("elevenlabs-convai")?.shadowRoot;
          const text = Array.from(root?.childNodes ?? [])
            .filter((node) => !(node instanceof HTMLStyleElement))
            .map((node) => node.textContent ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          const gum = (window as unknown as { __gum?: unknown[] }).__gum?.length ?? 0;
          return { gum, text: text.slice(0, 240) };
        });
        detail = `gum=${state.gum} sockets=${sockets.join(" | ") || "none"} ${state.text}`;
    const session =
      /listening|connecting|not allowed to connect/i.test(state.text) ||
      sockets.some((url) => /elevenlabs/i.test(url));
    if (state.gum > 0 && session) {
      started = true;
      break;
    }
    await page.waitForTimeout(250);
  }
  expect(started, detail).toBe(true);
});
