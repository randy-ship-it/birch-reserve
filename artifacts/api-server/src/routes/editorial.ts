import { Router, type IRouter } from "express";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import {
  db,
  editorialArticlesTable,
  editorialArticleSourcesTable,
  editorialAuditEventsTable,
  editorialGenerationJobsTable,
  editorialPublicContextTable,
  editorialRevisionsTable,
  editorialSourcesTable,
} from "@workspace/db";
import { z } from "zod/v4";
import {
  getAuthorizedSalesStaff,
  requireSalesManager,
  requireSalesStaff,
} from "../lib/salesStaffAccess";
import { requestEditorialDraft } from "../lib/editorialDrafting";

const router: IRouter = Router();
const PUBLIC_SITE_ORIGIN = "https://www.birchreserve.net";
const uuid = z.string().uuid();
const draftInput = z.object({
  title: z.string().trim().min(12).max(180),
  summary: z.string().trim().min(30).max(600),
  body: z.string().trim().min(200).max(30_000),
  authorName: z.string().trim().min(2).max(120).optional(),
  topic: z.string().trim().min(2).max(120).optional(),
  sourceIds: z.array(uuid).min(1).max(12),
}).strict();
const sourceInput = z.object({
  canonicalUrl: z.string().url().max(2_000),
  publisher: z.string().trim().min(2).max(200),
  title: z.string().trim().min(5).max(500),
  evidenceType: z.string().trim().min(3).max(120),
  publicationDateLabel: z.string().trim().min(4).max(80),
  relevance: z.string().trim().min(20).max(2_000),
  limitations: z.string().trim().min(20).max(2_000),
  excerpt: z.string().trim().min(40).max(12_000),
  sourceType: z.enum(["research", "government", "standards_body"]),
  publishedAt: z.coerce.date().optional(),
}).strict();
const draftUpdateInput = z.object({
  title: z.string().trim().min(12).max(180).optional(),
  summary: z.string().trim().min(30).max(600).optional(),
  body: z.string().trim().min(200).max(30_000).optional(),
  authorName: z.string().trim().min(2).max(120).optional(),
  topic: z.string().trim().min(2).max(120).optional(),
  sourceIds: z.array(uuid).min(1).max(12).optional(),
  reviewNotes: z.string().trim().max(5_000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function publicArticle(article: typeof editorialArticlesTable.$inferSelect, citations: Array<{ citationLabel: string; canonicalUrl: string; publisher: string; title: string; publishedAt: Date | null }>) {
  return {
    slug: article.slug, title: article.title, authorName: article.authorName, topic: article.topic, summary: article.summary, body: article.body,
    publishedAt: article.publishedAt, citations,
  };
}

async function verifyCitations(sourceIds: string[]) {
  const sources = await db.select().from(editorialSourcesTable).where(
    and(inArray(editorialSourcesTable.id, sourceIds), eq(editorialSourcesTable.publicApproved, "approved")),
  );
  if (sources.length !== new Set(sourceIds).size) throw new Error("Each citation must identify an approved editorial source.");
  return sources;
}

function auditRecord(entityType: string, entityId: string, action: string, req: Parameters<typeof getAuthorizedSalesStaff>[0]) {
  const staff = getAuthorizedSalesStaff(req);
  return {
    entityType, entityId, action, actorStaffAccessId: staff.id, actorClerkUserId: staff.clerkUserId,
  };
}

async function transitionArticle(
  id: string,
  allowedStatuses: string[],
  changes: Partial<typeof editorialArticlesTable.$inferInsert>,
  action: string,
  req: Parameters<typeof getAuthorizedSalesStaff>[0],
) {
  return db.transaction(async (tx) => {
    const [article] = await tx.update(editorialArticlesTable).set(changes)
      .where(and(eq(editorialArticlesTable.id, id), inArray(editorialArticlesTable.status, allowedStatuses))).returning();
    if (!article) return null;
    await tx.insert(editorialAuditEventsTable).values(auditRecord("article", article.id, action, req));
    return article;
  });
}

router.get("/editorial/sitemap.xml", async (_req, res) => {
  const articles = await db
    .select({
      slug: editorialArticlesTable.slug,
      publishedAt: editorialArticlesTable.publishedAt,
      updatedAt: editorialArticlesTable.updatedAt,
    })
    .from(editorialArticlesTable)
    .where(
      and(
        eq(editorialArticlesTable.status, "published"),
        lte(editorialArticlesTable.publishedAt, new Date()),
      ),
    )
    .orderBy(asc(editorialArticlesTable.publishedAt));

  const staticUrls = [
    "/",
    "/about",
    "/insights",
    "/marketplace",
    "/buycalc",
    "/v1/catalog.json",
    "/llms.txt",
    "/openapi.yaml",
  ].map(
    (path) => `<url><loc>${escapeXml(`${PUBLIC_SITE_ORIGIN}${path}`)}</loc></url>`,
  );
  const articleUrls = articles.map((article) => {
    const location = `${PUBLIC_SITE_ORIGIN}/insights/${encodeURIComponent(article.slug)}`;
    const lastModified = (article.updatedAt ?? article.publishedAt)?.toISOString();
    return `<url><loc>${escapeXml(location)}</loc>${lastModified ? `<lastmod>${lastModified}</lastmod>` : ""}</url>`;
  });

  res.set({
    "Cache-Control": "public, max-age=300",
    "Content-Type": "application/xml; charset=utf-8",
  });
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...staticUrls, ...articleUrls].join("")}</urlset>`,
  );
});

router.get("/editorial/articles", async (_req, res) => {
  const now = new Date();
  const articles = await db.select().from(editorialArticlesTable).where(
    and(eq(editorialArticlesTable.status, "published"), lte(editorialArticlesTable.publishedAt, now)),
  ).orderBy(asc(editorialArticlesTable.publishedAt));
  const ids = articles.map((a) => a.id);
  const citations = ids.length ? await db.select({
    articleId: editorialArticleSourcesTable.articleId, citationLabel: editorialArticleSourcesTable.citationLabel,
    canonicalUrl: editorialSourcesTable.canonicalUrl, publisher: editorialSourcesTable.publisher,
    title: editorialSourcesTable.title, publishedAt: editorialSourcesTable.publishedAt,
  }).from(editorialArticleSourcesTable).innerJoin(editorialSourcesTable, eq(editorialArticleSourcesTable.sourceId, editorialSourcesTable.id))
    .where(inArray(editorialArticleSourcesTable.articleId, ids)) : [];
  res.json(articles.map((article) => publicArticle(article, citations.filter((citation) => citation.articleId === article.id))));
});

router.get("/editorial/articles/:slug", async (req, res) => {
  const [article] = await db.select().from(editorialArticlesTable).where(and(
    eq(editorialArticlesTable.slug, req.params.slug), eq(editorialArticlesTable.status, "published"),
    lte(editorialArticlesTable.publishedAt, new Date()),
  )).limit(1);
  if (!article) { res.status(404).json({ error: "Article not found." }); return; }
  const citations = await db.select({
    citationLabel: editorialArticleSourcesTable.citationLabel, canonicalUrl: editorialSourcesTable.canonicalUrl,
    publisher: editorialSourcesTable.publisher, title: editorialSourcesTable.title, publishedAt: editorialSourcesTable.publishedAt,
  }).from(editorialArticleSourcesTable).innerJoin(editorialSourcesTable, eq(editorialArticleSourcesTable.sourceId, editorialSourcesTable.id))
    .where(eq(editorialArticleSourcesTable.articleId, article.id));
  res.json(publicArticle(article, citations));
});

router.get("/editorial/admin/articles", requireSalesStaff, async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(await db.select().from(editorialArticlesTable).orderBy(asc(editorialArticlesTable.updatedAt)));
});

router.get("/editorial/admin/articles/:articleId", requireSalesStaff, async (req, res) => {
  const id = uuid.safeParse(req.params.articleId);
  if (!id.success) { res.status(400).json({ error: "Invalid article." }); return; }
  const [article] = await db.select().from(editorialArticlesTable).where(eq(editorialArticlesTable.id, id.data)).limit(1);
  if (!article) { res.status(404).json({ error: "Article not found." }); return; }
  const citationRows = await db.select({ source: editorialSourcesTable }).from(editorialArticleSourcesTable).innerJoin(editorialSourcesTable, eq(editorialArticleSourcesTable.sourceId, editorialSourcesTable.id))
    .where(eq(editorialArticleSourcesTable.articleId, id.data));
  res.set("Cache-Control", "no-store"); res.json({ ...article, citations: citationRows.map((row) => row.source) });
});
router.get("/editorial/admin/sources", requireSalesStaff, async (_req, res) => {
  res.set("Cache-Control", "no-store"); res.json(await db.select().from(editorialSourcesTable).orderBy(asc(editorialSourcesTable.createdAt)));
});
router.get("/editorial/admin/context", requireSalesStaff, async (_req, res) => {
  res.set("Cache-Control", "no-store"); res.json(await db.select().from(editorialPublicContextTable).orderBy(asc(editorialPublicContextTable.createdAt)));
});
router.get("/editorial/admin/jobs", requireSalesStaff, async (_req, res) => {
  res.set("Cache-Control", "no-store"); res.json(await db.select().from(editorialGenerationJobsTable).orderBy(asc(editorialGenerationJobsTable.createdAt)));
});
router.get("/editorial/admin/articles/:articleId/revisions", requireSalesStaff, async (req, res) => {
  const id = uuid.safeParse(req.params.articleId); if (!id.success) { res.status(400).json({ error: "Invalid article." }); return; }
  res.set("Cache-Control", "no-store"); res.json(await db.select().from(editorialRevisionsTable).where(eq(editorialRevisionsTable.articleId, id.data)).orderBy(asc(editorialRevisionsTable.createdAt)));
});
router.get("/editorial/admin/articles/:articleId/audit", requireSalesStaff, async (req, res) => {
  const id = uuid.safeParse(req.params.articleId); if (!id.success) { res.status(400).json({ error: "Invalid article." }); return; }
  res.set("Cache-Control", "no-store"); res.json(await db.select({ action: editorialAuditEventsTable.action, metadata: editorialAuditEventsTable.metadata, createdAt: editorialAuditEventsTable.createdAt }).from(editorialAuditEventsTable).where(and(eq(editorialAuditEventsTable.entityType, "article"), eq(editorialAuditEventsTable.entityId, id.data))).orderBy(asc(editorialAuditEventsTable.createdAt)));
});

router.post("/editorial/admin/sources", requireSalesManager, async (req, res) => {
  const parsed = sourceInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid editorial source." }); return; }
  const body = parsed.data;
  const contentHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${body.canonicalUrl}|${body.excerpt}`))
    .then((x) => Buffer.from(x).toString("hex"));
  const source = await db.transaction(async (tx) => {
    const [created] = await tx.insert(editorialSourcesTable).values({
      ...body, publishedAt: body.publishedAt ?? null, publicApproved: "pending", contentHash,
    }).onConflictDoNothing().returning();
    if (created) await tx.insert(editorialAuditEventsTable).values(auditRecord("source", created.id, "source_created_pending", req));
    return created;
  });
  if (!source) { res.status(409).json({ error: "Source already exists." }); return; }
  res.status(201).json({ id: source.id });
});

router.post("/editorial/admin/sources/:sourceId/approve", requireSalesManager, async (req, res) => {
  const id = uuid.safeParse(req.params.sourceId);
  if (!id.success || !z.object({}).strict().safeParse(req.body ?? {}).success) { res.status(400).json({ error: "Invalid source approval." }); return; }
  const staff = getAuthorizedSalesStaff(req);
  const source = await db.transaction(async (tx) => {
    const [approved] = await tx.update(editorialSourcesTable).set({
      publicApproved: "approved", approvedAt: new Date(), approvedByStaffAccessId: staff.id,
    }).where(and(
      eq(editorialSourcesTable.id, id.data),
      eq(editorialSourcesTable.publicApproved, "pending"),
    )).returning();
    if (!approved || !approved.canonicalUrl || !approved.publisher || !approved.title || !approved.evidenceType || !approved.publicationDateLabel || !approved.relevance || !approved.limitations || !approved.excerpt) return null;
    await tx.insert(editorialAuditEventsTable).values(auditRecord("source", approved.id, "source_approved", req));
    return approved;
  });
  if (!source) { res.status(409).json({ error: "Only a complete pending source can be approved." }); return; }
  res.set("Cache-Control", "no-store"); res.json({ id: source.id, status: source.publicApproved });
});

router.post("/editorial/admin/articles", requireSalesStaff, async (req, res) => {
  const parsed = draftInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid editorial draft." }); return; }
  try {
    const article = await db.transaction(async (tx) => {
      const sources = await tx.select().from(editorialSourcesTable).where(and(inArray(editorialSourcesTable.id, parsed.data.sourceIds), eq(editorialSourcesTable.publicApproved, "approved")));
      if (sources.length !== new Set(parsed.data.sourceIds).size) throw new Error("Each citation must identify an approved editorial source.");
      const [created] = await tx.insert(editorialArticlesTable).values({
        slug: `${slugify(parsed.data.title)}-${crypto.randomUUID().slice(0, 8)}`, title: parsed.data.title,
        summary: parsed.data.summary, body: parsed.data.body, authorName: parsed.data.authorName ?? "Birch Reserve Editorial",
        topic: parsed.data.topic ?? "Evidence-led practice", status: "draft",
      }).returning();
      if (!created) throw new Error("Draft was not saved.");
      await tx.insert(editorialArticleSourcesTable).values(sources.map((source) => ({ articleId: created.id, sourceId: source.id, citationLabel: source.title })));
      await tx.insert(editorialAuditEventsTable).values(auditRecord("article", created.id, "draft_created", req));
      return created;
    });
    res.status(201).json({ id: article.id, status: article.status });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid citations." }); }
});

router.patch("/editorial/admin/articles/:articleId", requireSalesStaff, async (req, res) => {
  const id = uuid.safeParse(req.params.articleId);
  const body = draftUpdateInput.safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid draft update." }); return; }
  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(editorialArticlesTable).where(and(eq(editorialArticlesTable.id, id.data), inArray(editorialArticlesTable.status, ["draft", "review"]))).limit(1).for("update");
      if (!current) return null;
      const sources = body.data.sourceIds
        ? await tx.select().from(editorialSourcesTable).where(and(inArray(editorialSourcesTable.id, body.data.sourceIds), eq(editorialSourcesTable.publicApproved, "approved")))
        : null;
      if (body.data.sourceIds && sources?.length !== new Set(body.data.sourceIds).size) throw new Error("Each citation must identify an approved editorial source.");
      await tx.insert(editorialRevisionsTable).values({ articleId: current.id, revisionNumber: crypto.randomUUID(), snapshot: current });
      const [next] = await tx.update(editorialArticlesTable).set({
        ...(body.data.title !== undefined ? { title: body.data.title } : {}),
        ...(body.data.summary !== undefined ? { summary: body.data.summary } : {}),
        ...(body.data.body !== undefined ? { body: body.data.body } : {}),
        ...(body.data.authorName !== undefined ? { authorName: body.data.authorName } : {}),
        ...(body.data.topic !== undefined ? { topic: body.data.topic } : {}),
        ...(body.data.reviewNotes !== undefined ? { reviewNotes: body.data.reviewNotes } : {}),
      }).where(and(eq(editorialArticlesTable.id, current.id), inArray(editorialArticlesTable.status, ["draft", "review"]))).returning();
      if (!next) return null;
      if (sources) {
        await tx.delete(editorialArticleSourcesTable).where(eq(editorialArticleSourcesTable.articleId, current.id));
        await tx.insert(editorialArticleSourcesTable).values(sources.map((source) => ({ articleId: current.id, sourceId: source.id, citationLabel: source.title })));
      }
      await tx.insert(editorialAuditEventsTable).values(auditRecord("article", current.id, "draft_updated", req));
      return next;
    });
    if (!result) { res.status(409).json({ error: "Only draft or review articles can be edited." }); return; }
    res.set("Cache-Control", "no-store"); res.json({ id: result.id, status: result.status });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Draft update failed." }); }
});

router.post("/editorial/admin/articles/:articleId/review", requireSalesStaff, async (req, res) => {
  const id = uuid.safeParse(req.params.articleId); if (!id.success) { res.status(400).json({ error: "Invalid article." }); return; }
  const article = await transitionArticle(id.data, ["draft"], { status: "review" }, "submitted_for_review", req);
  if (!article) { res.status(409).json({ error: "Only a draft can enter review." }); return; }
  res.json({ id: article.id, status: article.status });
});

router.post("/editorial/admin/articles/:articleId/approve", requireSalesManager, async (req, res) => {
  const articleId = uuid.safeParse(req.params.articleId);
  if (!articleId.success) { res.status(400).json({ error: "Invalid article." }); return; }
  const staff = getAuthorizedSalesStaff(req);
  const article = await transitionArticle(articleId.data, ["draft", "review"], { status: "approved", approvedAt: new Date(), approvedByStaffAccessId: staff.id }, "approved", req);
  if (!article) { res.status(409).json({ error: "Only a draft or review article can be approved." }); return; }
  res.json({ id: article.id, status: article.status });
});

router.post("/editorial/admin/articles/:articleId/reject", requireSalesManager, async (req, res) => {
  const id = uuid.safeParse(req.params.articleId); if (!id.success) { res.status(400).json({ error: "Invalid article." }); return; }
  const article = await transitionArticle(id.data, ["review"], { status: "draft" }, "rejected_to_draft", req);
  if (!article) { res.status(409).json({ error: "Only review articles can be rejected." }); return; }
  res.json({ id: article.id, status: article.status });
});
router.post("/editorial/admin/articles/:articleId/archive", requireSalesManager, async (req, res) => {
  const id = uuid.safeParse(req.params.articleId); if (!id.success) { res.status(400).json({ error: "Invalid article." }); return; }
  const article = await transitionArticle(id.data, ["draft", "review", "approved"], { status: "archived" }, "archived", req);
  if (!article) { res.status(409).json({ error: "Published and scheduled articles cannot be archived." }); return; }
  res.json({ id: article.id, status: article.status });
});

router.post("/editorial/admin/generate", requireSalesManager, async (req, res) => {
  const input = z.object({ topic: z.string().trim().min(10).max(180), sourceIds: z.array(uuid).min(1).max(12), idempotencyKey: z.string().trim().min(12).max(200) }).strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid generation request." }); return; }
  const job = await db.transaction(async (tx) => {
    const [created] = await tx.insert(editorialGenerationJobsTable).values({
      idempotencyKey: input.data.idempotencyKey, topic: input.data.topic,
      sourceIds: input.data.sourceIds, status: "running", startedAt: new Date(),
    }).onConflictDoNothing({ target: editorialGenerationJobsTable.idempotencyKey }).returning();
    if (created) await tx.insert(editorialAuditEventsTable).values(auditRecord("generation_job", created.id, "generation_started", req));
    return created;
  });
  if (!job) {
    const [existing] = await db.select().from(editorialGenerationJobsTable).where(eq(editorialGenerationJobsTable.idempotencyKey, input.data.idempotencyKey)).limit(1);
    if (!existing) throw new Error("Generation idempotency conflict could not be resolved.");
    res.set("Cache-Control", "no-store"); res.json(existing); return;
  }
  try {
    const sources = await verifyCitations(input.data.sourceIds);
    const contexts = await db.select({ name: editorialPublicContextTable.name, content: editorialPublicContextTable.content }).from(editorialPublicContextTable).where(eq(editorialPublicContextTable.status, "approved"));
    const draft = await requestEditorialDraft(sources, contexts, input.data.topic);
    const done = await db.transaction(async (tx) => {
      const [article] = await tx.insert(editorialArticlesTable).values({ slug: `${slugify(draft.title)}-${crypto.randomUUID().slice(0, 8)}`, title: draft.title, summary: draft.summary, body: draft.body, topic: input.data.topic, generationJobId: job.id, status: "draft" }).returning();
      if (!article) throw new Error("Generated draft was not saved.");
      await tx.insert(editorialArticleSourcesTable).values(draft.sourceIds.map((sourceId) => ({ articleId: article.id, sourceId, citationLabel: sources.find((source) => source.id === sourceId)?.title ?? "Source" })));
      const [completed] = await tx.update(editorialGenerationJobsTable).set({ status: "completed", articleId: article.id, completedAt: new Date() }).where(and(eq(editorialGenerationJobsTable.id, job.id), eq(editorialGenerationJobsTable.status, "running"))).returning();
      if (!completed) throw new Error("Generation job is no longer running.");
      await tx.insert(editorialAuditEventsTable).values(auditRecord("generation_job", job.id, "generation_completed", req));
      return completed;
    });
    res.status(201).json(done);
  } catch (error) {
    const failed = await db.transaction(async (tx) => {
      const [failure] = await tx.update(editorialGenerationJobsTable).set({ status: "failed", errorCode: "generation_failed", completedAt: new Date() }).where(and(eq(editorialGenerationJobsTable.id, job.id), eq(editorialGenerationJobsTable.status, "running"))).returning();
      if (failure) await tx.insert(editorialAuditEventsTable).values(auditRecord("generation_job", job.id, "generation_failed", req));
      return failure;
    });
    res.status(502).json({ id: failed?.id ?? job.id, status: "failed", errorCode: "generation_failed" });
  }
});

router.post("/editorial/admin/articles/:articleId/schedule", requireSalesManager, async (req, res) => {
  const articleId = uuid.safeParse(req.params.articleId);
  const input = z.object({ scheduledFor: z.coerce.date() }).strict().safeParse(req.body);
  if (!articleId.success || !input.success || input.data.scheduledFor <= new Date()) { res.status(400).json({ error: "Choose a future publication time." }); return; }
  const article = await transitionArticle(articleId.data, ["approved"], { status: "scheduled", scheduledFor: input.data.scheduledFor }, "scheduled", req);
  if (!article) { res.status(409).json({ error: "Only an approved article can be scheduled." }); return; }
  res.json({ id: article.id, status: article.status, scheduledFor: article.scheduledFor });
});

router.post("/editorial/admin/articles/:articleId/publish", requireSalesManager, async (req, res) => {
  const articleId = uuid.safeParse(req.params.articleId);
  if (!articleId.success) { res.status(400).json({ error: "Invalid article." }); return; }
  const staff = getAuthorizedSalesStaff(req);
  const article = await transitionArticle(articleId.data, ["approved", "scheduled"], { status: "published", publishedAt: new Date(), publishedByStaffAccessId: staff.id }, "published", req);
  if (!article) { res.status(409).json({ error: "Only an approved or scheduled article can be published." }); return; }
  res.json({ id: article.id, status: article.status, publishedAt: article.publishedAt });
});

router.post("/editorial/admin/context", requireSalesManager, async (req, res) => {
  const input = z.object({ name: z.string().min(2).max(100), content: z.string().min(20).max(10_000), approved: z.boolean() }).strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid public editorial context." }); return; }
  const staff = getAuthorizedSalesStaff(req);
  const context = await db.transaction(async (tx) => {
    const [created] = await tx.insert(editorialPublicContextTable).values({
      name: input.data.name, content: input.data.content, status: input.data.approved ? "approved" : "draft",
      approvedAt: input.data.approved ? new Date() : null, approvedByStaffAccessId: input.data.approved ? staff.id : null,
    }).returning();
    if (!created) throw new Error("Context was not saved.");
    await tx.insert(editorialAuditEventsTable).values(auditRecord("context", created.id, input.data.approved ? "context_approved" : "context_created", req));
    return created;
  });
  if (!context) throw new Error("Context was not saved.");
  res.status(201).json({ id: context.id });
});

export default router;