import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Editorial records are intentionally isolated from commercial, account, and
 * marketplace data. Source excerpts are private working material; only the
 * citation metadata selected by an editor can become public.
 */
export const editorialSourcesTable = pgTable(
  "editorial_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalUrl: text("canonical_url").notNull(),
    publisher: text("publisher").notNull(),
    title: text("title").notNull(),
    evidenceType: text("evidence_type").notNull(),
    publicationDateLabel: text("publication_date_label").notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull().defaultNow(),
    relevance: text("relevance").notNull(),
    limitations: text("limitations").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    excerpt: text("excerpt").notNull(),
    sourceType: text("source_type").notNull(),
    publicApproved: text("public_approved").notNull().default("pending"),
    approvedByStaffAccessId: uuid("approved_by_staff_access_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("editorial_sources_canonical_url").on(t.canonicalUrl),
    uniqueIndex("editorial_sources_content_hash").on(t.contentHash),
    index("editorial_sources_approved_published").on(t.publicApproved, t.publishedAt),
  ],
);

export const editorialPublicContextTable = pgTable(
  "editorial_public_context",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("draft"),
    approvedByStaffAccessId: uuid("approved_by_staff_access_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("editorial_public_context_name").on(t.name), index("editorial_public_context_status").on(t.status)],
);

export const editorialArticlesTable = pgTable(
  "editorial_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    authorName: text("author_name").notNull().default("Birch Reserve Editorial"),
    topic: text("topic").notNull().default("Evidence-led practice"),
    summary: text("summary").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("draft"),
    generationJobId: uuid("generation_job_id"),
    approvedByStaffAccessId: uuid("approved_by_staff_access_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    publishedByStaffAccessId: uuid("published_by_staff_access_id"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("editorial_articles_slug").on(t.slug),
    index("editorial_articles_publication").on(t.status, t.publishedAt),
    index("editorial_articles_schedule").on(t.status, t.scheduledFor),
  ],
);

export const editorialArticleSourcesTable = pgTable(
  "editorial_article_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    citationLabel: text("citation_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("editorial_article_sources_unique").on(t.articleId, t.sourceId),
    index("editorial_article_sources_article").on(t.articleId),
  ],
);

export const editorialRevisionsTable = pgTable(
  "editorial_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id").notNull(),
    revisionNumber: text("revision_number").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdByStaffAccessId: uuid("created_by_staff_access_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("editorial_revisions_article_number").on(t.articleId, t.revisionNumber), index("editorial_revisions_article_created").on(t.articleId, t.createdAt)],
);

export const editorialGenerationJobsTable = pgTable(
  "editorial_generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("queued"),
    topic: text("topic").notNull(),
    sourceIds: jsonb("source_ids").notNull(),
    errorCode: text("error_code"),
    articleId: uuid("article_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("editorial_generation_jobs_idempotency").on(t.idempotencyKey), index("editorial_generation_jobs_status_created").on(t.status, t.createdAt)],
);

export const editorialAuditEventsTable = pgTable(
  "editorial_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    actorStaffAccessId: uuid("actor_staff_access_id"),
    actorClerkUserId: text("actor_clerk_user_id"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("editorial_audit_events_entity_created").on(t.entityType, t.entityId, t.createdAt)],
);