/**
 * Server-rendered advertiser guides (Randy, Nov 15 2026). Standalone: no DB imports.
 *   GET /advertiser-guides          index
 *   GET /<guide slug>               one guide (see lib/advertiserGuides.ts)
 */
import { Router, type IRouter } from "express";
import { ADVERTISER_GUIDES, GUIDES_INDEX_PATH, GUIDES_REVIEWED, type AdvertiserGuide } from "../lib/advertiserGuides";
import { PUBLIC_SITE_ORIGIN, publicSeoTags } from "../lib/publicSeo";

const router: IRouter = Router();

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:#f8f6ef;color:#071A39;font:17px/1.65 "IBM Plex Sans",system-ui,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.top{border-bottom:1px solid #d8dccf;background:#f8f6ef;position:sticky;top:0;z-index:2}
header.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:56px}
.logo{font-weight:600;letter-spacing:.12em;font-size:.85rem;text-decoration:none;color:#071A39}
nav.tn{display:flex;gap:14px;font-size:.88rem;flex-wrap:wrap;justify-content:flex-end}nav.tn a{color:#071A39}
.crumb{font-size:.85rem;color:#4d5b6a;margin:22px 0 0}.crumb a{color:#4d5b6a}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.15}
h1{font-size:clamp(2rem,7vw,3rem);margin:.35em 0 .3em}h2{font-size:clamp(1.35rem,4.5vw,1.7rem);margin:1.8em 0 .5em}
.lede{font-size:1.12rem;color:#24364f}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 6px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border-radius:999px;background:#071A39;color:#f8f6ef;text-decoration:none;font-weight:600;font-size:.98rem}
.btn.line{background:transparent;color:#071A39;border:1.5px solid #071A39}
ul{padding-left:1.2em}li{margin:.4em 0}
.card{background:#fff;border:1px solid #e1e4da;border-radius:16px;padding:18px 20px;margin:14px 0}
.card h3{margin:.1em 0 .3em;font-size:1.25rem}.card a{text-decoration:none}.card p{margin:.2em 0;color:#24364f}
.note{background:#eef1e8;border-radius:14px;padding:14px 16px;font-size:.95rem}
.src{font-size:.9rem;color:#4d5b6a}.src a{color:#24364f;word-break:break-word}
footer{border-top:1px solid #d8dccf;margin-top:48px;padding:24px 0 40px;font-size:.9rem;color:#4d5b6a}footer a{color:#24364f}`;

function shell(path: string, title: string, description: string, body: string, jsonLd: unknown): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
${publicSeoTags(path, title, description)}
<meta property="og:type" content="article">
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>
</head><body>
<header class="top"><div class="wrap"><a class="logo" href="/">BIRCH RESERVE</a><nav class="tn" aria-label="Advertiser guides"><a href="${GUIDES_INDEX_PATH}">Guides</a><a href="/blog">Blog</a><a href="/media-kit">Media kit</a><a href="/buy-ads">Advertise</a></nav></div></header>
<main class="wrap">${body}</main>
<footer><div class="wrap">Silver Birch Growth Inc. · Toronto, Ontario · <a href="tel:+16479316278">(647) 931-6278</a> · <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a><br><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="${GUIDES_INDEX_PATH}">All advertiser guides</a></div></footer>
</body></html>`;
}

const CTA = `<div class="cta"><a class="btn" href="/buy-ads">Advertise with Birch</a><a class="btn line" href="/media-kit">See the media kit</a></div>`;

export function renderGuide(g: AdvertiserGuide): string {
  const path = `/${g.slug}`;
  const sections = g.sections
    .map((s) => {
      const paras = (s.paras ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
      const bullets = s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
      return `<h2>${esc(s.h2)}</h2>${paras}${bullets}`;
    })
    .join("");
  const sources = `<h2>Sources</h2><ol class="src">${g.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join("")}</ol>`;
  const body = `<p class="crumb"><a href="${GUIDES_INDEX_PATH}">Advertiser guides</a></p>
<h1>${esc(g.h1)}</h1>
<p class="lede">${esc(g.lede)}</p>
${CTA}
${sections}
<p class="note">Figures from third parties are their estimates, in USD unless noted, and are cited below. Birch audience volumes are modelled until an insertion order names a hub. Nothing here is legal advice; check your own claims with counsel or a preclearance agency. Last reviewed ${GUIDES_REVIEWED}.</p>
${CTA}
${sources}`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: g.h1, description: g.description, dateModified: "2026-11-15", url: `${PUBLIC_SITE_ORIGIN}${path}`, publisher: { "@type": "Organization", name: "Silver Birch Growth Inc.", url: PUBLIC_SITE_ORIGIN } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Advertiser guides", item: `${PUBLIC_SITE_ORIGIN}${GUIDES_INDEX_PATH}` },
        { "@type": "ListItem", position: 2, name: g.h1, item: `${PUBLIC_SITE_ORIGIN}${path}` },
      ] },
    ],
  };
  return shell(path, g.title, g.description, body, ld);
}

export function renderGuidesIndex(): string {
  const title = "Advertiser guides: compliant health and wellness advertising | Birch Reserve";
  const description = "Plain guides for health and wellness brands: GLP-1 companion advertising, supplements in Canada, recovery devices, post-purchase ads and retail media. Cited, with no guarantees.";
  const cards = ADVERTISER_GUIDES.map((g) => `<div class="card"><h3><a href="/${g.slug}">${esc(g.h1)}</a></h3><p>${esc(g.description)}</p></div>`).join("");
  const body = `<h1>Advertiser guides</h1>
<p class="lede">Short, cited guides for health and wellness brands that are paying too much for crowded public auctions and want compliant, curated placements in front of recovery and wellness customers.</p>
${CTA}
${cards}
<p class="note">Last reviewed ${GUIDES_REVIEWED}. Birch does not run prescription-drug promotion.</p>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Advertiser guides", url: `${PUBLIC_SITE_ORIGIN}${GUIDES_INDEX_PATH}`, hasPart: ADVERTISER_GUIDES.map((g) => ({ "@type": "Article", headline: g.h1, url: `${PUBLIC_SITE_ORIGIN}/${g.slug}` })) };
  return shell(GUIDES_INDEX_PATH, title, description, body, ld);
}

router.get([GUIDES_INDEX_PATH, `${GUIDES_INDEX_PATH}/`], (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.type("html").send(renderGuidesIndex());
});

for (const g of ADVERTISER_GUIDES) {
  router.get([`/${g.slug}`, `/${g.slug}/`], (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.type("html").send(renderGuide(g));
  });
}

export default router;
