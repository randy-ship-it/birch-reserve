import {
  db,
  editorialArticleSourcesTable,
  editorialArticlesTable,
  editorialSourcesTable,
  PUBLIC_INSIGHT_ARTICLES,
  rewriteAlignNetworkCopy,
} from "@workspace/db";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import { autolinkPlainUrl, publicSeoTags } from "../lib/publicSeo";

const router: IRouter = Router();

const SELLER = "Silver Birch Growth Inc. · 777-2255B Queen St E, Toronto ON M4E 1G3";

type PublicCitation = {
  label: string;
  url: string;
  title: string;
  publisher: string;
};

type PublicArticle = {
  slug: string;
  title: string;
  authorName: string;
  topic: string;
  summary: string;
  body: string;
  publishedAt: Date | null;
  citations: PublicCitation[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(text: string): string {
  return text
    .split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g)
    .map((part) => {
      const linked = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (linked) {
        return `<a href="${escapeHtml(linked[2] ?? "")}">${escapeHtml(linked[1] ?? "")}</a>`;
      }
      if (/^https?:\/\//.test(part)) {
        return autolinkPlainUrl(part);
      }
      return escapeHtml(part);
    })
    .join("");
}

function renderMarkdown(markdown: string): string {
  const html: string[] = [];
  const paragraph: string[] = [];
  let list: "ol" | "ul" | null = null;

  const closeList = () => {
    if (!list) return;
    html.push(list === "ol" ? "</ol>" : "</ul>");
    list = null;
  };
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph.length = 0;
  };

  for (const line of markdown.replaceAll("\r\n", "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1]?.length ?? 1;
      html.push(`<h${level}>${inline(heading[2] ?? "")}</h${level}>`);
      continue;
    }
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (ordered || bullet) {
      flushParagraph();
      const kind = ordered ? "ol" : "ul";
      if (list !== kind) {
        closeList();
        list = kind;
        html.push(kind === "ol" ? "<ol>" : "<ul>");
      }
      html.push(`<li>${inline((ordered ?? bullet)?.[1] ?? "")}</li>`);
      continue;
    }
    closeList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  closeList();
  return html.join("");
}

function documentPage(title: string, description: string, body: string, path: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
${publicSeoTags(path)}
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;background:#f8f6ef;color:#071A39;font:16px/1.6 "IBM Plex Sans",sans-serif}
header,main,footer{max-width:760px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;gap:16px;align-items:baseline;border-bottom:1px solid #ccd2d8}
h1,h2,h3{font-family:Fraunces,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(2.2rem,6vw,3.4rem);margin:.4em 0}
a{color:#071A39}nav{display:flex;flex-wrap:wrap;gap:12px;font-size:.9rem}.fine{color:#4d5b6a;font-size:.9rem}
</style></head><body>
<header><a href="/"><strong>BIRCH RESERVE</strong></a><nav><a href="/insights">Insights</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/sample-io">Sample IO</a></nav></header>
<main>${body}</main>
<footer class="fine">${escapeHtml(SELLER)} · <a href="mailto:sales@silverbirchgrowth.com">Email sales</a></footer>
</body></html>`;
}

function sendPage(res: { type: (value: string) => { send: (body: string) => void }; set: (name: string, value: string) => void }, html: string): void {
  res.set("Cache-Control", "private, no-cache");
  res.type("html").send(html);
}

const TERMS_HTML = documentPage(
  "Terms of sale — Birch Reserve",
  "Draft terms for Birch Reserve hold-190 and reserve-490. Not in force for a live card until counsel stamps this page.",
  `<h1>Terms of sale</h1>
<p class="fine">${escapeHtml(SELLER)}</p>
<p>Birch Reserve is operated by Silver Birch Growth Inc. These terms are a draft. They are not in force for a live card until counsel stamps this page. Public prices are $190 USD (<strong>hold-190</strong>, a 7-day category look that does not lock an exclusive category) and $490 USD (<strong>reserve-490</strong>, lock your exclusive category).</p>
<p>hold-190 is a 100% credit if the buyer converts within 7 days. Otherwise it is a cash refund. It does not lock an exclusive category. reserve-490 is 100% media credit. Credit expires 12 months after payment. A cash refund is available if no approved surface is named within 60 days of payment.</p>
<p>Payment is a reservation credit, not a live flight and not an impression guarantee. Nothing runs until an insertion order names the surface. After that order, cancellation and makegood follow IAB. The public sample is <a href="/sample-io">/sample-io</a>.</p>
<p>8 exclusive brand categories across hubs — not eight websites. One brand per category. Reporting is aggregate only. No PHI. No clinical pixels.</p>
<p>Checkout is Stripe-hosted. Silver Birch Growth Inc. does not store full card numbers. Questions: <a href="mailto:sales@silverbirchgrowth.com">Email sales</a>.</p>
<p><a href="/privacy">Privacy</a></p>`,
  "/terms",
);

const PRIVACY_HTML = documentPage(
  "Privacy — Birch Reserve",
  "Draft privacy note for Birch Reserve reservations. Not in force until counsel stamps this page.",
  `<h1>Privacy</h1>
<p class="fine">${escapeHtml(SELLER)}</p>
<p>This draft describes what Birch Reserve collects to sell the public $190 and $490 reservations. This page is not in force until counsel stamps it.</p>
<p>Reservation checkout collects the brand legal name, work email, optional website, format preference, and an idempotency key so a repeated request does not open a second hold. Stripe hosts the card form. Silver Birch Growth Inc. receives payment status from Stripe and does not store full card numbers on Birch Reserve servers.</p>
<p>Birch Reserve does not collect protected health information, clinical pixels, or patient-level reporting. Birch Guide does not collect patient or PHI data. Placement reporting, when an insertion order later authorizes a flight, is aggregate only.</p>
<p>The Stripe descriptor should read SCALE HEALTH*BIRCH or BIRCH RESERVE. Contact <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a> to ask for a copy of reservation details or to correct a brand name or email on an unpaid hold.</p>
<p><a href="/terms">Terms of sale</a></p>`,
  "/privacy",
);

const SAMPLE_IO_HTML = documentPage(
  "Sample insertion order — Birch Reserve",
  "Blank sample insertion order. Nothing runs until an approved insertion order names the surface.",
  `<p class="fine">Draft sample — not an approved insertion order</p>
<h1>Sample insertion order</h1>
<p>Nothing runs until an approved insertion order names the surface. This page is a blank sample, not a flight and not a receipt.</p>
<dl>
<div><dt><strong>Advertiser</strong></dt><dd>[Brand legal name]</dd></div>
<div><dt><strong>SKU</strong></dt><dd>reserve-490 · $490 USD exclusive category, or hold-190 · $190 USD 7-day look</dd></div>
<div><dt><strong>Named surface</strong></dt><dd>[Hub URL, for example a signed Scale Health hub]</dd></div>
<div><dt><strong>Format</strong></dt><dd>post-checkout, recovery plan, booking confirmation, native hub module, or motion :15</dd></div>
<div><dt><strong>Category</strong></dt><dd>One of eight: pain relief / topicals, recovery hardware, nutrition, sleep, meal prep, women’s health, men’s health, diagnostics / services</dd></div>
<div><dt><strong>Credit</strong></dt><dd>100% media credit. Credit expires 12 months. Cash refund if no approved surface can be named within 60 days.</dd></div>
</dl>
<p class="fine">Draft until counsel stamps.</p>
<p><a href="/terms">Terms of sale</a></p>`,
  "/sample-io",
);

function seedArticles(): PublicArticle[] {
  return PUBLIC_INSIGHT_ARTICLES.map((article) => ({
    slug: article.slug,
    title: article.title,
    authorName: article.authorName,
    topic: article.topic,
    summary: article.summary,
    body: article.body,
    publishedAt: article.publishedAt,
    citations: [],
  }));
}

async function listReadableArticles(): Promise<PublicArticle[]> {
  const seeded = seedArticles();
  try {
    const now = new Date();
    const rows = await db
      .select({
        id: editorialArticlesTable.id,
        slug: editorialArticlesTable.slug,
        title: editorialArticlesTable.title,
        authorName: editorialArticlesTable.authorName,
        topic: editorialArticlesTable.topic,
        summary: editorialArticlesTable.summary,
        body: editorialArticlesTable.body,
        publishedAt: editorialArticlesTable.publishedAt,
      })
      .from(editorialArticlesTable)
      .where(and(eq(editorialArticlesTable.status, "published"), lte(editorialArticlesTable.publishedAt, now)))
      .orderBy(asc(editorialArticlesTable.publishedAt));
    const ids = rows.map((row) => row.id);
    let citationRows: {
      articleId: string;
      citationLabel: string;
      canonicalUrl: string;
      publisher: string;
      title: string;
    }[] = [];
    if (ids.length) {
      try {
        citationRows = await db
          .select({
            articleId: editorialArticleSourcesTable.articleId,
            citationLabel: editorialArticleSourcesTable.citationLabel,
            canonicalUrl: editorialSourcesTable.canonicalUrl,
            publisher: editorialSourcesTable.publisher,
            title: editorialSourcesTable.title,
          })
          .from(editorialArticleSourcesTable)
          .innerJoin(editorialSourcesTable, eq(editorialArticleSourcesTable.sourceId, editorialSourcesTable.id))
          .where(inArray(editorialArticleSourcesTable.articleId, ids));
      } catch (error) {
        logger.warn({ err: error }, "Public insights HTML omitted citations");
      }
    }
    const bySlug = new Map(rows.map((row) => [row.slug, {
      slug: row.slug,
      title: row.title,
      authorName: row.authorName,
      topic: row.topic,
      summary: row.summary,
      body: rewriteAlignNetworkCopy(row.body),
      publishedAt: row.publishedAt,
      citations: citationRows
        .filter((citation) => citation.articleId === row.id)
        .map((citation) => ({
          label: citation.citationLabel,
          url: citation.canonicalUrl,
          title: citation.title,
          publisher: citation.publisher,
        })),
    }]));
    for (const article of seeded) {
      if (!bySlug.has(article.slug)) bySlug.set(article.slug, article);
    }
    return [...bySlug.values()].sort((a, b) => (a.publishedAt?.getTime() ?? 0) - (b.publishedAt?.getTime() ?? 0));
  } catch (error) {
    logger.warn({ err: error }, "Public insights HTML fell back to seeded articles");
    return seeded;
  }
}

function insightsIndexHtml(articles: PublicArticle[]): string {
  const cards = articles
    .map((article) => {
      const when = article.publishedAt
        ? article.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
        : "";
      return `<article><p class="fine">${escapeHtml(article.topic)}${when ? ` · ${escapeHtml(when)}` : ""}</p><h2><a href="/insights/${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></h2><p>${escapeHtml(article.summary)}</p></article>`;
    })
    .join("");
  return documentPage(
    "Insights | Birch Reserve",
    "Evidence-led advertising publication and insights for health, wellness, and retail.",
    `<h1>Insights &amp; Evidence</h1>
<p>Measured, evidence-led reporting on health, wellness, and trusted retail contexts. Public readings from the Birch Reserve editorial desk.</p>
${cards || "<p>No insights published yet.</p>"}`,
    "/insights",
  );
}

function bodyWithoutRepeatedTitle(article: PublicArticle): string {
  const lines = article.body.replaceAll("\r\n", "\n").split("\n");
  if (lines[0]?.trim() !== `# ${article.title}`) return article.body;
  let index = 1;
  while (lines[index]?.trim() === "") index += 1;
  return lines.slice(index).join("\n");
}

function articleHtml(article: PublicArticle): string {
  const when = article.publishedAt
    ? article.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";
  return documentPage(
    `${article.title} | Birch Reserve`,
    article.summary,
    `<p class="fine"><a href="/insights">Insights</a>${when ? ` · ${escapeHtml(when)}` : ""} · ${escapeHtml(article.topic)}</p>
<h1>${escapeHtml(article.title)}</h1>
<p class="fine">${escapeHtml(article.authorName)}</p>
${renderMarkdown(bodyWithoutRepeatedTitle(article))}
${article.citations.length
    ? `<h2>Sources</h2><ul>${article.citations.map((citation) => `<li><a href="${escapeHtml(citation.url)}">${escapeHtml(citation.label || citation.title)}</a> <span class="fine">${escapeHtml(citation.publisher)}</span></li>`).join("")}</ul>`
    : ""}`,
    `/insights/${article.slug}`,
  );
}


const KIT_HTML = documentPage(
  "Creative brief — Birch Reserve placements",
  "What to send for Birch Reserve category placements: square still, optional 15s silent motion, destination URL, category, and contact.",
  `<h1>Creative brief for Birch Reserve placements</h1>
<p class="fine">${escapeHtml(SELLER)}</p>
<p>This page is the creative brief for a Birch Reserve category placement. It is not a media-kit demos dump. Captions and mock placements are illustrative until an insertion order names the hub.</p>
<h2>What to send</h2>
<ul>
<li>Square still (primary creative)</li>
<li>Optional 15-second silent motion</li>
<li>Destination URL</li>
<li>One of the eight exclusive brand categories</li>
<li>Contact email for creative and IO follow-up</li>
</ul>
<p class="fine">Caption: illustrative until an insertion order names the hub.</p>
<h2>Eight exclusive brand categories</h2>
<ul>
<li>Pain relief / topicals</li>
<li>Recovery hardware</li>
<li>Nutrition</li>
<li>Sleep</li>
<li>Meal prep</li>
<li>Women’s health</li>
<li>Men’s health</li>
<li>Diagnostics / services</li>
</ul>
<p>One brand per category. Not eight websites.</p>
<h2>Formats (context only)</h2>
<p>Placement formats for IO discussion — not CTR or impression guarantees:</p>
<ul>
<li>post_checkout</li>
<li>scheduled_service</li>
<li>recovery_plan</li>
<li>member_hub</li>
<li>motion_15s</li>
</ul>
<h2>Contact</h2>
<p><a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a> · human calculator: <a href="/buycalc">/buycalc</a></p>
<p><a href="/sample-io">Sample insertion order</a> · <a href="/terms">Terms</a></p>`,
  "/kit",
);

router.get("/terms", (_req, res) => {
  sendPage(res, TERMS_HTML);
});

router.get("/privacy", (_req, res) => {
  sendPage(res, PRIVACY_HTML);
});

router.get("/sample-io", (_req, res) => {
  sendPage(res, SAMPLE_IO_HTML);
});

router.get("/kit", (_req, res) => {
  sendPage(res, KIT_HTML);
});

router.get("/insights", async (_req, res) => {
  sendPage(res, insightsIndexHtml(await listReadableArticles()));
});

router.get("/insights/:slug", async (req, res) => {
  const slug = req.params.slug;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    res.status(404).type("html").send(documentPage("Article not found — Birch Reserve", "That insight is not published.", "<h1>Article not found</h1><p><a href=\"/insights\">Insights</a></p>", "/insights"));
    return;
  }
  const articles = await listReadableArticles();
  const article = articles.find((item) => item.slug === slug);
  if (!article) {
    res.status(404).type("html").send(documentPage("Article not found — Birch Reserve", "That insight is not published.", "<h1>Article not found</h1><p><a href=\"/insights\">Insights</a></p>", "/insights"));
    return;
  }
  sendPage(res, articleHtml(article));
});

export default router;
