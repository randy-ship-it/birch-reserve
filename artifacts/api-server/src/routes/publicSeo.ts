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
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import {
  PUBLIC_SITEMAP_PATHS,
  SPA_SHELL_PATHS,
  isSelfCanonical,
  readSpaIndexHtml,
  sitemapXml,
  withNotFoundDocument,
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
  const pages = [...PUBLIC_SITEMAP_PATHS, ...insights.paths].filter((path) => isSelfCanonical(path));
  const xml = sitemapXml(pages, insights.lastmod);
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

const FILE_EXTENSION = /\.[a-z0-9]{1,8}$/i;

/**
 * Last resort for GET/HEAD that no real route claimed. The shell is the same
 * document the client uses to paint Signal Lost; the status is 404.
 * /inventory is a project rewrite and must not be answered here.
 */
export function unknownDocument(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }
  const path = req.path || "/";
  if (
    path.startsWith("/api") ||
    path.startsWith("/v1") ||
    path.startsWith("/ucp") ||
    path.startsWith("/.well-known") ||
    path === "/inventory" ||
    path.startsWith("/inventory/")
  ) {
    next();
    return;
  }
  if (FILE_EXTENSION.test(path)) {
    next();
    return;
  }
  let html: string;
  try {
    html = withNotFoundDocument(readSpaIndexHtml());
  } catch (error) {
    next(error);
    return;
  }
  res.status(404).set("Cache-Control", "no-store").type("html").send(html);
}

export default router;
