/**
 * /sitemap.xml and per-route head tags for SPA shells.
 *
 * The Vite shell is one index.html. Crawlers that do not run JavaScript would
 * otherwise see the home canonical on every route. These paths are claimed by
 * the API function (ahead of the SPA rewrite) and the head is rewritten here.
 * Server-rendered pages set the same tags in their own HTML.
 */
import { PUBLIC_INSIGHT_ARTICLES, db, editorialArticlesTable } from "@workspace/db";
import { and, asc, eq, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  PUBLIC_SITEMAP_PATHS,
  SPA_SHELL_PATHS,
  readSpaIndexHtml,
  sitemapXml,
  withRouteSeo,
} from "../lib/publicSeo";

const router: IRouter = Router();

async function insightPaths(): Promise<{ paths: string[]; lastmod: Map<string, string> }> {
  const lastmod = new Map<string, string>();
  const paths = new Set<string>(PUBLIC_INSIGHT_ARTICLES.map((article) => `/insights/${article.slug}`));
  try {
    const rows = await db
      .select({
        slug: editorialArticlesTable.slug,
        publishedAt: editorialArticlesTable.publishedAt,
        updatedAt: editorialArticlesTable.updatedAt,
      })
      .from(editorialArticlesTable)
      .where(and(eq(editorialArticlesTable.status, "published"), lte(editorialArticlesTable.publishedAt, new Date())))
      .orderBy(asc(editorialArticlesTable.publishedAt));
    for (const row of rows) {
      if (!/^[a-z0-9-]+$/.test(row.slug)) continue;
      const path = `/insights/${row.slug}`;
      paths.add(path);
      const stamp = row.updatedAt ?? row.publishedAt;
      if (stamp) lastmod.set(path, stamp.toISOString());
    }
  } catch (error) {
    logger.warn({ err: error }, "Public sitemap used seeded insight paths");
  }
  return { paths: [...paths].sort(), lastmod };
}

router.get("/sitemap.xml", async (_req, res) => {
  const insights = await insightPaths();
  const xml = sitemapXml([...PUBLIC_SITEMAP_PATHS, ...insights.paths], insights.lastmod);
  res.set({
    "Cache-Control": "public, max-age=300",
    "Content-Type": "application/xml; charset=utf-8",
  });
  res.send(xml);
});

for (const path of SPA_SHELL_PATHS) {
  router.get(path, (_req, res) => {
    let html: string;
    try {
      html = withRouteSeo(readSpaIndexHtml(), path);
    } catch (error) {
      logger.error({ err: error, path }, "SPA shell for public SEO is missing");
      res.status(500).type("text/plain").send("Page unavailable.");
      return;
    }
    res.set("Cache-Control", "public, max-age=0, must-revalidate");
    res.type("html").send(html);
  });
}

export default router;
