/**
 * /index.md, /media-kit.md, ... (lib/aiMarkdown.ts). text/markdown. Also answers Accept: text/markdown on the
 * mirrored HTML paths with the same Markdown, and adds a Link header pointing at the mirror.
 */
import { Router, type IRouter } from "express";
import { MD_PAGES, mdPageForHtmlPath, mdPathFor, renderMarkdown } from "../lib/aiMarkdown";

const router: IRouter = Router();
const MIRROR_PARAM = "br_mirror";

for (const p of MD_PAGES) {
  const md = mdPathFor(p.path);
  router.get(md, (_req, res) => {
    const body = renderMarkdown(md);
    if (!body) return void res.status(404).end();
    res.set("Cache-Control", "public, max-age=300");
    res.set("X-Robots-Tag", "index, follow");
    res.type("text/markdown; charset=utf-8").send(body);
  });
}

router.use((req, res, next) => {
  if ((req.method !== "GET" && req.method !== "HEAD") || req.query[MIRROR_PARAM]) return next();
  const page = mdPageForHtmlPath(req.path);
  if (!page) return next();
  const md = mdPathFor(page.path);
  res.vary("Accept");
  res.append("Link", `<${md}>; rel="alternate"; type="text/markdown"`);
  const accept = String(req.headers.accept ?? "");
  if (/text\/markdown/i.test(accept) && !/text\/html/i.test(accept)) {
    const body = renderMarkdown(md);
    if (body) {
      res.set("Cache-Control", "public, max-age=300");
      return void res.type("text/markdown; charset=utf-8").send(body);
    }
  }
  next();
});

export default router;
