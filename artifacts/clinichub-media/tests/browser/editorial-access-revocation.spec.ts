import { expect, test, type Page } from "@playwright/test";

const articleId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const privateMarkers = {
  draft: "PRIVATE DRAFT CANARY",
  source: "PRIVATE SOURCE CANARY",
  revision: "PRIVATE REVISION CANARY",
  audit: "PRIVATE AUDIT CANARY",
  job: "PRIVATE JOB CANARY",
} as const;

type EditorialMocks = {
  revoked: boolean;
  requestCountAfterRevocation: number;
};

const now = "2026-08-24T12:00:00.000Z";
const draft = {
  id: articleId,
  slug: "private-draft-canary",
  title: privateMarkers.draft,
  authorName: "Authorized Editor",
  topic: "Confidential editorial planning",
  summary: "A private summary that must disappear after access is revoked.",
  body: `${privateMarkers.draft} body `.repeat(20),
  status: "draft",
  generationJobId: null,
  approvedByStaffAccessId: null,
  approvedAt: null,
  publishedByStaffAccessId: null,
  publishedAt: null,
  scheduledFor: null,
  reviewNotes: null,
  createdAt: now,
  updatedAt: now,
  citations: [],
};
const source = {
  id: sourceId,
  canonicalUrl: "https://example.com/private-source",
  publisher: "Private Publisher",
  title: privateMarkers.source,
  evidenceType: "study",
  publicationDateLabel: "August 2026",
  accessedAt: now,
  relevance: "Private relevance details for editorial review.",
  limitations: "Private limitations details for editorial review.",
  publishedAt: now,
  retrievedAt: now,
  excerpt: `${privateMarkers.source} excerpt`,
  sourceType: "research",
  publicApproved: "true",
  approvedByStaffAccessId: "staff-access-id",
  approvedAt: now,
  contentHash: "private-hash",
  createdAt: now,
};

async function installEditorialMocks(page: Page): Promise<EditorialMocks> {
  const state: EditorialMocks = {
    revoked: false,
    requestCountAfterRevocation: 0,
  };

  await page.route("**/api/editorial/admin/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (state.revoked) {
      state.requestCountAfterRevocation += 1;
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "Editorial access revoked" }),
      });
      return;
    }

    let body: unknown = [];
    if (pathname.endsWith("/jobs")) {
      body = [{
        id: "job-id",
        idempotencyKey: "job-key",
        status: "processing",
        topic: privateMarkers.job,
        sourceIds: [sourceId],
        articleId,
        createdAt: now,
      }];
    } else if (pathname.endsWith("/revisions")) {
      body = [{
        id: "revision-id",
        articleId,
        revisionNumber: "1",
        snapshot: { body: privateMarkers.revision },
        createdAt: now,
      }];
    } else if (pathname.endsWith("/audit")) {
      body = [{
        action: privateMarkers.audit,
        metadata: { private: true },
        createdAt: now,
      }];
    } else if (pathname.endsWith(`/articles/${articleId}`)) {
      body = draft;
    } else if (pathname.endsWith("/articles")) {
      body = [draft];
    } else if (pathname.endsWith("/sources")) {
      body = [source];
    } else if (pathname.endsWith("/context")) {
      body = [{
        id: "context-id",
        name: "Private context",
        content: "Private context content",
        status: "approved",
        approvedByStaffAccessId: "staff-access-id",
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
      }];
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  return state;
}

async function privateCache(page: Page) {
  return page.evaluate(() => {
    const inspect = (
      window as typeof window & {
        __BIRCH_EDITORIAL_QUERY_CACHE__?: () => unknown[];
      }
    ).__BIRCH_EDITORIAL_QUERY_CACHE__;
    return inspect?.() ?? [];
  });
}

async function expectStableDenial(page: Page, errors: string[]) {
  await expect(page.getByText(/^(Access denied|Session expired)$/)).toBeVisible();
  const denialHeading = page.getByRole("heading", {
    name: /^(Unauthorized|Please sign in again)$/,
  });
  await expect(denialHeading).toBeVisible();
  for (const marker of Object.values(privateMarkers)) {
    await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
  }
  await expect.poll(async () => {
    const cache = await privateCache(page) as Array<{ data?: unknown }>;
    return cache.every((entry) => entry.data === undefined);
  }).toBe(true);
  await expect.poll(async () => JSON.stringify(await privateCache(page))).not.toContain(
    "PRIVATE",
  );
  await page.waitForTimeout(750);
  await expect(denialHeading).toBeVisible();
  expect(errors.filter((message) => /hooks|maximum update depth/i.test(message))).toEqual([]);
}

for (const route of [
  "/editorial",
  "/editorial/drafts",
  `/editorial/drafts/${articleId}`,
  "/editorial/sources",
]) {
  test(`revoked same-user access locks ${route} and purges private cache`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const state = await installEditorialMocks(page);

    await page.goto(route);
    await expect.poll(async () => JSON.stringify(await privateCache(page))).toContain(
      "/api/editorial/admin",
    );
    await expect(
      page.getByText(
        route === "/editorial"
          ? privateMarkers.job
          : route === "/editorial/sources"
            ? privateMarkers.source
            : privateMarkers.draft,
        { exact: false },
      ).first(),
    ).toBeVisible();

    state.revoked = true;
    await expectStableDenial(page, errors);
    const requestsAtDenial = state.requestCountAfterRevocation;
    await page.waitForTimeout(750);
    expect(state.requestCountAfterRevocation).toBe(requestsAtDenial);
  });
}

for (const status of [401, 403] as const) {
  test(`a ${status} mutation immediately locks the open editor`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await installEditorialMocks(page);
    await page.goto(`/editorial/drafts/${articleId}`);
    const titleInput = page.getByRole("textbox", { name: "Article Headline" });
    await expect(titleInput).toBeVisible();

    await page.route(`**/api/editorial/admin/articles/${articleId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ message: "Access denied" }),
        });
        return;
      }
      await route.fallback();
    });

    await titleInput.fill(`${privateMarkers.draft} changed`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expectStableDenial(page, errors);
  });
}
