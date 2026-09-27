import {
  legacyReserveCopyPatch,
  mentionsLegacyHeroPrice,
  PUBLIC_INSIGHT_ARTICLES,
} from "./public-insights-copy";

export type PublishedInsightCopy = {
  id: string;
  slug: string;
  summary: string;
  body: string;
};

export type ScaleHubsArticleInsert = {
  slug: string;
  title: string;
  authorName: string;
  topic: string;
  summary: string;
  body: string;
  publishedAt: Date;
};

export type InsightsSeedStore = {
  listPublished(): Promise<PublishedInsightCopy[]>;
  updateCopy(id: string, copy: { summary: string; body: string }): Promise<void>;
  insertPublishedIfMissing(article: ScaleHubsArticleInsert): Promise<boolean>;
};

export type PublicInsightsSeedResult = {
  inserted: boolean;
  corrected: number;
};

function assertPublishable(article: ScaleHubsArticleInsert): void {
  const haystack = `${article.title}\n${article.summary}\n${article.body}`;
  if (mentionsLegacyHeroPrice(haystack)) {
    throw new Error("Refusing to publish an insights article that mentions the legacy reserve price.");
  }
}

export async function seedPublicInsightsWithStore(
  store: InsightsSeedStore,
): Promise<PublicInsightsSeedResult> {
  const published = await store.listPublished();
  let corrected = 0;
  for (const article of published) {
    const patch = legacyReserveCopyPatch(article.summary, article.body);
    if (!patch) continue;
    await store.updateCopy(article.id, patch);
    corrected += 1;
  }

  let inserted = false;
  for (const source of PUBLIC_INSIGHT_ARTICLES) {
    const article: ScaleHubsArticleInsert = {
      slug: source.slug,
      title: source.title,
      authorName: source.authorName,
      topic: source.topic,
      summary: source.summary,
      body: source.body,
      publishedAt: source.publishedAt,
    };
    assertPublishable(article);
    if (await store.insertPublishedIfMissing(article)) inserted = true;
  }
  return { inserted, corrected };
}
