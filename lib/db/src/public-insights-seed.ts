import {
  legacyReserveCopyPatch,
  mentionsLegacyHeroPrice,
  SCALE_HUBS_ARTICLE,
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

  const article: ScaleHubsArticleInsert = {
    slug: SCALE_HUBS_ARTICLE.slug,
    title: SCALE_HUBS_ARTICLE.title,
    authorName: SCALE_HUBS_ARTICLE.authorName,
    topic: SCALE_HUBS_ARTICLE.topic,
    summary: SCALE_HUBS_ARTICLE.summary,
    body: SCALE_HUBS_ARTICLE.body,
    publishedAt: SCALE_HUBS_ARTICLE.publishedAt,
  };
  assertPublishable(article);
  const inserted = await store.insertPublishedIfMissing(article);
  return { inserted, corrected };
}
