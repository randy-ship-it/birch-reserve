import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import {
  db,
  editorialArticlesTable,
  editorialArticleSourcesTable,
  editorialGenerationJobsTable,
  editorialRevisionsTable,
  editorialSourcesTable,
  salesStaffAccessTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../src/app";
import { setSalesStaffIdentityProviderForTests } from "../src/lib/salesStaffAccess";

const token = randomUUID();
const managerEmail = `editor-manager-${token}@example.com`;
const staffEmail = `editor-staff-${token}@example.com`;
const articleIds: string[] = [];
const sourceIds: string[] = [];
let baseUrl = "";
let closeServer: (() => Promise<void>) | undefined;

const headers = (role: "manager" | "staff") => ({
  "content-type": "application/json",
  "x-test-clerk-user-id": `editorial_${role}_${token}`,
  "x-test-staff-email": role === "manager" ? managerEmail : staffEmail,
  "x-test-staff-name": role === "manager" ? "Editorial Manager" : "Editorial Staff",
});

before(async () => {
  process.env["EDITORIAL_AI_DISABLED"] = "true";
  setSalesStaffIdentityProviderForTests(async (req) => {
    const clerkUserId = req.get("x-test-clerk-user-id");
    const normalizedEmail = req.get("x-test-staff-email");
    const displayName = req.get("x-test-staff-name");
    return clerkUserId && normalizedEmail && displayName ? { clerkUserId, normalizedEmail, displayName } : null;
  });
  await db.insert(salesStaffAccessTable).values([
    { normalizedEmail: managerEmail, displayName: "Editorial Manager", role: "sales_manager", accessStatus: "active" },
    { normalizedEmail: staffEmail, displayName: "Editorial Staff", role: "sales", accessStatus: "active" },
  ]);
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind.");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  closeServer = () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

after(async () => {
  if (articleIds.length) {
    await db.delete(editorialArticleSourcesTable).where(inArray(editorialArticleSourcesTable.articleId, articleIds));
    await db.delete(editorialRevisionsTable).where(inArray(editorialRevisionsTable.articleId, articleIds));
    await db.delete(editorialArticlesTable).where(inArray(editorialArticlesTable.id, articleIds));
  }
  if (sourceIds.length) await db.delete(editorialSourcesTable).where(inArray(editorialSourcesTable.id, sourceIds));
  await db.delete(editorialGenerationJobsTable).where(eq(editorialGenerationJobsTable.idempotencyKey, `test:${token}:failure`));
  await db.delete(salesStaffAccessTable).where(inArray(salesStaffAccessTable.normalizedEmail, [managerEmail, staffEmail]));
  await closeServer?.();
});

test("editorial API separates pending sources, staff drafts, manager transitions, and public projection", async () => {
  const unauthenticated = await fetch(`${baseUrl}/editorial/admin/sources`);
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.headers.get("cache-control"), "no-store");

  const sourceResponse = await fetch(`${baseUrl}/editorial/admin/sources`, {
    method: "POST", headers: headers("manager"), body: JSON.stringify({
      canonicalUrl: `https://example.org/${token}`, publisher: "Public Research Office",
      title: "A complete public editorial research record", evidenceType: "Government guidance",
      publicationDateLabel: "2025", relevance: "Relevant to a bounded editorial integration test.",
      limitations: "This fixture supports workflow behavior and no broader factual claim.",
      excerpt: "A sufficiently long public excerpt used only to prove approved-source citation workflow behavior.",
      sourceType: "government",
    }),
  });
  assert.equal(sourceResponse.status, 201);
  const sourceId = ((await sourceResponse.json()) as { id: string }).id;
  sourceIds.push(sourceId);
  const [pending] = await db.select().from(editorialSourcesTable).where(eq(editorialSourcesTable.id, sourceId));
  assert.equal(pending?.publicApproved, "pending");

  const staffApprove = await fetch(`${baseUrl}/editorial/admin/sources/${sourceId}/approve`, { method: "POST", headers: headers("staff"), body: "{}" });
  assert.equal(staffApprove.status, 403);
  const approved = await fetch(`${baseUrl}/editorial/admin/sources/${sourceId}/approve`, { method: "POST", headers: headers("manager"), body: "{}" });
  assert.equal(approved.status, 200);

  const created = await fetch(`${baseUrl}/editorial/admin/articles`, {
    method: "POST", headers: headers("staff"), body: JSON.stringify({
      title: "A private evidence-led integration draft",
      summary: "A private summary that is long enough for strict editorial validation.",
      body: "Private evidence-led draft content. ".repeat(12), sourceIds: [sourceId],
    }),
  });
  assert.equal(created.status, 201);
  const articleId = ((await created.json()) as { id: string }).id;
  articleIds.push(articleId);
  const [createdArticle] = await db.select().from(editorialArticlesTable).where(eq(editorialArticlesTable.id, articleId));
  assert.ok(createdArticle);

  const hidden = await fetch(`${baseUrl}/editorial/articles`);
  assert.equal(((await hidden.json()) as unknown[]).some((item) => JSON.stringify(item).includes(articleId)), false);
  const hiddenSitemap = await (await fetch(`${baseUrl}/editorial/sitemap.xml`)).text();
  assert.doesNotMatch(hiddenSitemap, new RegExp(createdArticle.slug));

  const patch = await fetch(`${baseUrl}/editorial/admin/articles/${articleId}`, {
    method: "PATCH", headers: headers("staff"), body: JSON.stringify({ topic: "Updated evidence topic" }),
  });
  assert.equal(patch.status, 200);
  const citations = await db.select().from(editorialArticleSourcesTable).where(eq(editorialArticleSourcesTable.articleId, articleId));
  assert.equal(citations.length, 1);
  assert.equal(citations[0]?.sourceId, sourceId);
  assert.equal((await db.select().from(editorialRevisionsTable).where(eq(editorialRevisionsTable.articleId, articleId))).length, 1);

  assert.equal((await fetch(`${baseUrl}/editorial/admin/articles/${articleId}/review`, { method: "POST", headers: headers("staff") })).status, 200);
  assert.equal((await fetch(`${baseUrl}/editorial/admin/articles/${articleId}/approve`, { method: "POST", headers: headers("staff") })).status, 403);
  assert.equal((await fetch(`${baseUrl}/editorial/admin/articles/${articleId}/approve`, { method: "POST", headers: headers("manager") })).status, 200);
  assert.equal((await fetch(`${baseUrl}/editorial/admin/articles/${articleId}/archive`, { method: "POST", headers: headers("staff") })).status, 403);

  const scheduled = await fetch(`${baseUrl}/editorial/admin/articles/${articleId}/schedule`, {
    method: "POST", headers: headers("manager"), body: JSON.stringify({ scheduledFor: new Date(Date.now() + 86_400_000).toISOString() }),
  });
  assert.equal(scheduled.status, 200);
  assert.equal(((await (await fetch(`${baseUrl}/editorial/articles`)).json()) as unknown[]).some((item) => JSON.stringify(item).includes("A private evidence-led integration draft")), false);

  const published = await fetch(`${baseUrl}/editorial/admin/articles/${articleId}/publish`, { method: "POST", headers: headers("manager") });
  assert.equal(published.status, 200);
  const publicItems = await (await fetch(`${baseUrl}/editorial/articles`)).json() as Array<Record<string, unknown>>;
  const publicItem = publicItems.find((item) => item.title === "A private evidence-led integration draft");
  assert.ok(publicItem);
  assert.deepEqual(Object.keys(publicItem).sort(), ["authorName", "body", "citations", "publishedAt", "slug", "summary", "title", "topic"]);
  assert.doesNotMatch(JSON.stringify(publicItem), /reviewNotes|generationJobId|excerpt|contentHash|approvedByStaff/i);
  const publishedSitemap = await (await fetch(`${baseUrl}/editorial/sitemap.xml`)).text();
  assert.match(publishedSitemap, new RegExp(`https://birchreserve\\.net/insights/${createdArticle.slug}`));
  assert.doesNotMatch(publishedSitemap, /reviewNotes|generationJobId|excerpt|contentHash|approvedByStaff/i);
});

test("generation failures are durable and idempotent", async () => {
  const key = `test:${token}:failure`;
  const payload = { topic: "A safely failing editorial generation request", sourceIds: [sourceIds[0]], idempotencyKey: key };
  const first = await fetch(`${baseUrl}/editorial/admin/generate`, { method: "POST", headers: headers("manager"), body: JSON.stringify(payload) });
  assert.equal(first.status, 502);
  const second = await fetch(`${baseUrl}/editorial/admin/generate`, { method: "POST", headers: headers("manager"), body: JSON.stringify(payload) });
  assert.equal(second.status, 200);
  const job = await second.json() as { status: string; errorCode: string };
  assert.equal(job.status, "failed");
  assert.equal(job.errorCode, "generation_failed");
});