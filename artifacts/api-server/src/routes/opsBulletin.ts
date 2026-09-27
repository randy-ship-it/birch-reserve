/**
 * Public rolling ops bulletin for anyone with the link.
 *
 * GET /ops/rdgd-bulletin — no Clerk, no sales guard. Mounted ahead of auth,
 * the same way indexNowKeyRouter is. Autoscale claims this path on the API
 * service so the SPA rewrite does not return index.html.
 *
 * The document is the file in clinichub-media/public (noindex already). It is
 * not on the editorial sitemap or the IndexNow allowlist.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Router, type IRouter } from "express";

export const RDGD_BULLETIN_PATH = "/ops/rdgd-bulletin";

const HTML_RELATIVE = "clinichub-media/public/ops/rdgd-bulletin.html";

export function resolveRdgdBulletinHtmlPath(): string {
  const fromModule = resolve(dirname(fileURLToPath(import.meta.url)), "../../", HTML_RELATIVE);
  const candidates = [
    fromModule,
    resolve(process.cwd(), "../", HTML_RELATIVE),
    resolve(process.cwd(), "artifacts", HTML_RELATIVE),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("RDGD bulletin HTML is missing.");
  }
  return found;
}

export function readRdgdBulletinHtml(): string {
  return readFileSync(resolveRdgdBulletinHtmlPath(), "utf8");
}

export const opsBulletinRouter: IRouter = Router();

opsBulletinRouter.get(RDGD_BULLETIN_PATH, (_req, res) => {
  let html: string;
  try {
    html = readRdgdBulletinHtml();
  } catch {
    res.status(500).type("text/plain; charset=utf-8").send("Bulletin unavailable.");
    return;
  }
  res.set({
    "Cache-Control": "public, max-age=60",
    "Content-Type": "text/html; charset=utf-8",
  });
  res.status(200).send(html);
});

export default opsBulletinRouter;
