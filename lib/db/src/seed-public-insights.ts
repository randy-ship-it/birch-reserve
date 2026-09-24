import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  seedPublicInsightsWithStore,
  type InsightsSeedStore,
  type PublicInsightsSeedResult,
} from "./public-insights-seed";
import type * as schema from "./schema";
import { editorialArticlesTable } from "./schema/editorial";

type InsightsDatabase = NodePgDatabase<typeof schema>;

function drizzleInsightsSeedStore(database: InsightsDatabase): InsightsSeedStore {
  return {
    async listPublished() {
      return database
        .select({
          id: editorialArticlesTable.id,
          slug: editorialArticlesTable.slug,
          summary: editorialArticlesTable.summary,
          body: editorialArticlesTable.body,
        })
        .from(editorialArticlesTable)
        .where(eq(editorialArticlesTable.status, "published"));
    },
    async updateCopy(id, copy) {
      await database
        .update(editorialArticlesTable)
        .set({ summary: copy.summary, body: copy.body })
        .where(and(eq(editorialArticlesTable.id, id), eq(editorialArticlesTable.status, "published")));
    },
    async insertPublishedIfMissing(article) {
      const rows = await database
        .insert(editorialArticlesTable)
        .values({
          slug: article.slug,
          title: article.title,
          authorName: article.authorName,
          topic: article.topic,
          summary: article.summary,
          body: article.body,
          status: "published",
          publishedAt: article.publishedAt,
        })
        .onConflictDoNothing({ target: editorialArticlesTable.slug })
        .returning({ id: editorialArticlesTable.id });
      return rows.length > 0;
    },
  };
}

export function bindPublicInsightsSeed(
  database: InsightsDatabase,
): () => Promise<PublicInsightsSeedResult> {
  const store = drizzleInsightsSeedStore(database);
  return () => seedPublicInsightsWithStore(store);
}
