import {
  expect,
  test,
  type Page,
  type Request,
} from "@playwright/test";

const visitorTypes = [
  "A product sold online",
  "A health & wellness service sold online",
  "A health & wellness audience",
  "Other",
] as const;

const allowedPublicRequests = new Set([
  "POST /api/launch/concierge/advice",
  "POST /api/launch/splash/reserve",
]);

type NetworkCapture = {
  conciergeBodies: unknown[];
  reserveBodies: unknown[];
  unexpectedApiRequests: string[];
};

function requestBody(request: Request): unknown {
  try {
    return request.postDataJSON();
  } catch {
    return request.postData();
  }
}

async function capturePublicRequests(page: Page): Promise<NetworkCapture> {
  const capture: NetworkCapture = {
    conciergeBodies: [],
    reserveBodies: [],
    unexpectedApiRequests: [],
  };

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    const methodAndPath = `${request.method()} ${pathname}`;

    if (
      request.method() === "POST" &&
      pathname === "/api/launch/concierge/advice"
    ) {
      capture.conciergeBodies.push(requestBody(request));
    }

    if (
      request.method() === "POST" &&
      pathname === "/api/launch/splash/reserve"
    ) {
      capture.reserveBodies.push(requestBody(request));
    }

    if (
      pathname.startsWith("/api/") &&
      !allowedPublicRequests.has(methodAndPath)
    ) {
      capture.unexpectedApiRequests.push(methodAndPath);
    }
  });

  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;

    if (pathname === "/api/launch/concierge/advice") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Display is a strong fit for a brand building awareness.",
          recommendedInterest: "display",
          suggestions: ["display", "both"],
          handoffAllowed: true,
          source: "fallback",
        }),
      });
      return;
    }

    if (pathname === "/api/launch/splash/reserve") {
      const reserveBody = route.request().postDataJSON() as {
        expectedAmountCents?: number;
        offer?: string;
      };
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          reservationId: "7e67ef03-0c6a-4a66-a01c-8ebf89f7bfc7",
          status: "held_pending_payments",
          checkoutUrl: null,
          amountCents: reserveBody.expectedAmountCents ?? 89900,
          currency: "usd",
          offer: reserveBody.offer ?? "reserve-899",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 418,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unexpected API request in public flow." }),
    });
  });

  return capture;
}

async function openGuide(page: Page) {
  await page.getByTestId("button-open-sales-concierge").click();
  const guide = page.getByTestId("dialog-sales-concierge");
  await expect(guide).toBeVisible();
  return guide;
}

async function chooseVisitorType(
  page: Page,
  visitorType: (typeof visitorTypes)[number],
) {
  const guide = await openGuide(page);
  await guide.getByRole("button", { name: visitorType, exact: true }).click();
  await expect(
    guide.getByRole("button", {
      name: "Reserve an advertising seat",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    guide.getByRole("button", { name: "Just learn", exact: true }),
  ).toBeVisible();
  await expect(
    guide.getByRole("button", { name: "Ask a typed question", exact: true }),
  ).toBeVisible();
  return guide;
}

for (const visitorType of visitorTypes) {
  test(`Guide recognizes ${visitorType}`, async ({ page }) => {
    const capture = await capturePublicRequests(page);
    await page.goto("/");

    await chooseVisitorType(page, visitorType);
    expect(capture.unexpectedApiRequests).toEqual([]);
  });
}

test("public offer leads with the three-tier USD ladder", async ({ page }) => {
  await capturePublicRequests(page);
  await page.goto("/");

  await expect(page.getByTestId("text-launch-status")).toContainText(
    "Reservations are open now. Campaign inventory rolls out next.",
  );
  await expect(
    page.getByRole("heading", {
      name: "Same dollar. Different customer.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "Buy reach one impression at a time; compete in an open auction; interrupt a stranger; hope the feed found the right moment. You bought attention, not context.",
  );
  await expect(page.locator("body")).toContainText(
    "Add exclusive digital and physical inventory beside your existing channels, reaching customers inside closed brand environments and participating health and wellness locations.",
  );
  await expect(
    page
      .getByRole("button", {
        name: "Reserve first access - $899 USD",
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "See the customer", exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText(
    "Reserve first rights to book inventory.",
  );
  await expect(page.locator("body")).toContainText("Digital inventory");
  await expect(page.locator("body")).toContainText("Physical inventory");
  await expect(page.locator("body")).toContainText("Direct reserve");
  await expect(page.locator("body")).toContainText("Managed distribution");
  await expect(page.locator("body")).toContainText("Access Reserve");
  await expect(page.locator("body")).toContainText("Placement Pilot");
  await expect(page.locator("body")).toContainText("Network Pilot");
  await expect(page.locator("body")).toContainText("$4,900");
  await expect(page.locator("body")).toContainText("$9,900");
  await expect(
    page.getByRole("heading", { name: "Who you actually reach." }),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("Just checked out");
  await expect(page.locator("body")).toContainText("On a plan");
  await expect(page.locator("body")).toContainText("Booked a session");
  await expect(page.locator("body")).toContainText(
    "We do not publish first-party lifetime-value dollars yet. The profile is from live placement context, not a survey panel.",
  );
  await expect(page.locator("body")).not.toContainText("Share your interest");
  await expect(page.locator("body")).not.toContainText("Check your interest");
  await expect(page.locator("body")).not.toContainText("request-only");
  await expect(page.locator("body")).not.toContainText("$10k Test Pilot");
  await expect(page.locator("body")).not.toContainText("HubAds");
  await expect(page.locator("body")).toContainText(
    "Fulfillment is coordinated, not autopilot.",
  );
  await expect(page.locator("body")).toContainText(
    "Aggregate reporting only, never patient data.",
  );
});

test("both buying paths open the first-access reserve form", async ({ page }) => {
  await capturePublicRequests(page);
  await page.goto("/");

  await page.getByTestId("button-auto-buy-reserve").click();
  const dialog = page.getByTestId("dialog-splash-reservation");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Reserve Access Reserve",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByTestId("button-private-distribution-reserve").click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("First-right planning access");
  await expect(dialog).toContainText("100% media credit");
});

test("hub inventory tabs replace one non-interactive screenshot at a time", async ({
  page,
}) => {
  await capturePublicRequests(page);
  await page.goto("/");

  const showcase = page.getByTestId("hub-showcase");
  await showcase
    .getByRole("button", {
      name: /02 · Clinical services Jill Health/,
    })
    .click();
  await expect(showcase.getByTestId("hub-showcase-image")).toHaveAttribute(
    "alt",
    "Screenshot of Jill Health hub",
  );
  await expect(showcase.getByTestId("hub-showcase-image")).toHaveCount(1);
  expect(
    await showcase
      .getByTestId("hub-showcase-image")
      .evaluate((image) => getComputedStyle(image).pointerEvents),
  ).toBe("none");

  await showcase
    .getByRole("button", {
      name: /06 · Nutrition & recovery landing NutriProCan/,
    })
    .click();
  await expect(showcase.getByTestId("hub-showcase-image")).toHaveAttribute(
    "alt",
    "Screenshot of NutriProCan hub",
  );
  await expect(showcase.getByTestId("hub-showcase-image")).toHaveCount(1);
});

test("Birch Guide hands a ready buyer to the reserve form", async ({ page }) => {
  await capturePublicRequests(page);
  await page.goto("/");

  const guide = await chooseVisitorType(
    page,
    "A health & wellness audience",
  );
  await guide
    .getByRole("button", {
      name: "Reserve an advertising seat",
      exact: true,
    })
    .click();
  await guide
    .getByRole("button", { name: "Open Reservation Form", exact: true })
    .click();

  const dialog = page.getByTestId("dialog-splash-reservation");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Reserve first access", exact: true }),
  ).toBeVisible();
});

test("mobile sticky CTA opens the reserve form", async ({ page }) => {
  await capturePublicRequests(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByTestId("mobile-sticky-reserve-cta").getByRole("button").click();
  const dialog = page.getByTestId("dialog-splash-reservation");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: "Reserve Access Reserve",
      exact: true,
    }),
  ).toBeVisible();
});

test("typed Guide questions send anonymous intent signals only", async ({
  page,
}) => {
  const capture = await capturePublicRequests(page);
  const rawQuestion = "Could Question Canary 8472 begin with Birch Reserve?";
  await page.goto("/");

  const guide = await chooseVisitorType(
    page,
    "A health & wellness audience",
  );
  await guide
    .getByRole("button", { name: "Ask a typed question", exact: true })
    .click();
  await guide.getByPlaceholder("Ask a question...").fill(rawQuestion);
  await guide.getByRole("button", { name: "Ask", exact: true }).click();

  await expect.poll(() => capture.conciergeBodies.length).toBe(1);
  expect(capture.conciergeBodies).toEqual([
    {
      bookingIntent: false,
      awarenessIntent: false,
      comparisonIntent: false,
      privateReviewIntent: false,
      sensitiveContentDetected: false,
    },
  ]);
  expect(JSON.stringify(capture.conciergeBodies)).not.toContain(rawQuestion);
  expect(capture.reserveBodies).toEqual([]);
});

test("reserve form stores the selected tier and shows its held-seat fallback", async ({
  page,
}) => {
  const capture = await capturePublicRequests(page);
  await page.goto("/");

  await page.getByTestId("button-hero-reserve").click();
  const dialog = page.getByTestId("dialog-splash-reservation");
  await dialog.locator('input[name="brandName"]').fill("Northstar Recovery");
  await dialog.locator('input[name="email"]').fill("buyer@northstar.example");
  await dialog
    .locator('input[name="websiteUrl"]')
    .fill("https://northstar.example");
  await dialog
    .getByRole("button", { name: /Network Pilot.*\$9,900/ })
    .click();
  await dialog
    .getByRole("button", {
      name: "Reserve Network Pilot",
      exact: true,
    })
    .click();

  await expect.poll(() => capture.reserveBodies.length).toBe(1);
  expect(capture.reserveBodies).toEqual([
    {
      brandName: "Northstar Recovery",
      email: "buyer@northstar.example",
      websiteUrl: "https://northstar.example",
      buyerPath: "private_distribution",
      expectedAmountCents: 990000,
      expectedCurrency: "usd",
      offer: "network-9900",
    },
  ]);
  await expect(
    dialog.getByRole("heading", { name: "Seat reserved", exact: true }),
  ).toBeVisible();
  await expect(dialog).toContainText(
    "Payment is still required; contact Birch Reserve to complete the secure $9,900 USD checkout",
  );
  await expect(dialog).toContainText("applied toward future campaign spend");
  expect(capture.unexpectedApiRequests).toEqual([]);
});
