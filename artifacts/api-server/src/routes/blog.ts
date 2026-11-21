/**
 * Server-rendered Birch Reserve blog (Randy, Nov 19 2026). Standalone: no DB imports.
 *   GET /blog           index
 *   GET /blog/:slug     one post (see lib/blogPosts.ts)
 */
import { Router, type IRouter } from "express";
import { BLOG_INDEX_PATH, BLOG_POSTS, BLOG_PUBLISHED, NETWORK_LINE, type BlogPost, type BlogVisual } from "../lib/blogPosts";
import { PUBLIC_OG_IMAGE, PUBLIC_SITE_ORIGIN, publicSeoTags } from "../lib/publicSeo";

const router: IRouter = Router();

export function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:#F9F8F6;color:#071A39;font:17px/1.6 "IBM Plex Sans",system-ui,sans-serif}
a{color:inherit}.wrap{max-width:820px;margin:0 auto;padding:0 20px}.wide{max-width:1080px}
header.top{border-bottom:1px solid #d8dccf;background:rgba(249,248,246,.94);backdrop-filter:blur(6px);position:sticky;top:0;z-index:5}
header.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:58px}
.logo{font-weight:600;letter-spacing:.14em;font-size:.84rem;text-decoration:none}
nav.tn{display:flex;gap:16px;align-items:center;font-size:.9rem;flex-wrap:wrap;justify-content:flex-end}nav.tn a{text-decoration:none}nav.tn a.on{font-weight:600;text-decoration:underline;text-underline-offset:4px}
nav.tn .pill{background:#071A39;color:#F9F8F6;border-radius:999px;padding:7px 14px;font-weight:600}
h1,h2,h3,.q{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.12}
.hero{padding:44px 0 8px}.kick{display:inline-block;font-size:.72rem;font-weight:600;letter-spacing:.16em;text-transform:uppercase;background:#dfe8d2;color:#24412a;border-radius:999px;padding:5px 12px}
h1{font-size:clamp(2.2rem,7.5vw,3.6rem);margin:.35em 0 .25em;letter-spacing:-.01em}
.lede{font-size:clamp(1.1rem,3.4vw,1.3rem);color:#24364f;max-width:40em;margin:.2em 0 .8em}
.meta{font-size:.85rem;color:#5b6878}
.tldr{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:26px 0}
.tldr div{background:#fff;border:1px solid #e1e4da;border-radius:18px;padding:16px 18px;font-weight:500;line-height:1.4}
.tldr b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.7rem;color:#9a7b2f;line-height:1;margin-bottom:8px}
.viz{background:#071A39;color:#F9F8F6;border-radius:24px;padding:24px 22px 20px;margin:28px 0}
.viz h3{margin:0 0 16px;font-size:1.35rem;color:#F9F8F6}.viz .vn{font-size:.82rem;color:#b9c3d3;margin:14px 0 0}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;counter-reset:s}
.steps div{background:rgba(249,248,246,.08);border:1px solid rgba(249,248,246,.18);border-radius:16px;padding:14px;position:relative}
.steps div::before{counter-increment:s;content:counter(s);display:inline-flex;width:28px;height:28px;border-radius:50%;background:#e7c873;color:#071A39;font-weight:700;align-items:center;justify-content:center;font-size:.9rem;margin-bottom:8px}
.steps strong,.loop strong{display:block;font-size:1.02rem}.steps span,.loop span{font-size:.86rem;color:#c9d2df;line-height:1.35;display:block}
.bar{display:flex;border-radius:14px;overflow:hidden;min-height:64px}.bar div{display:flex;flex-direction:column;justify-content:center;padding:10px 12px;color:#071A39;min-width:0}
.bar div:nth-child(1){background:#e7c873}.bar div:nth-child(2){background:#a9c79a}.bar div:nth-child(3){background:#F9F8F6}
.bar b{font-family:Fraunces,Georgia,serif;font-size:1.6rem;font-weight:600;line-height:1}.bar small{font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:12px;font-size:.88rem}.legend span{color:#c9d2df}
.loop{display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative}
.loop div{background:rgba(249,248,246,.08);border:1px solid rgba(249,248,246,.18);border-radius:16px;padding:14px}
.loop::after{content:"↻";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:#e7c873;color:#071A39;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700}
article h2{font-size:clamp(1.5rem,4.6vw,2rem);margin:1.6em 0 .4em}article p{margin:.5em 0}
article ul{padding-left:0;list-style:none}article li{position:relative;padding-left:28px;margin:.55em 0}article li::before{content:"";position:absolute;left:4px;top:.62em;width:10px;height:10px;border-radius:3px;background:#a9c79a}
.q{font-size:clamp(1.4rem,4.4vw,1.9rem);border-left:5px solid #e7c873;padding:4px 0 4px 18px;margin:22px 0;color:#071A39}
.birch{background:#e9efe0;border-radius:24px;padding:22px 22px 12px;margin:36px 0 10px}.birch h2{margin:0 0 .3em;font-size:1.6rem}
.cta{background:#071A39;color:#F9F8F6;border-radius:24px;padding:26px 22px;margin:22px 0;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.cta p{margin:0;font-family:Fraunces,Georgia,serif;font-size:1.45rem;line-height:1.2;max-width:22em}.cta small{display:block;font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:.85rem;color:#c9d2df;margin-top:6px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border-radius:999px;background:#e7c873;color:#071A39;text-decoration:none;font-weight:700}
.btn.line{background:transparent;color:#F9F8F6;border:1.5px solid #F9F8F6}.btns{display:flex;flex-wrap:wrap;gap:10px}
.insp{font-size:.92rem;color:#4d5b6a;border-top:1px solid #d8dccf;padding-top:14px;margin-top:26px}.insp a{color:#24364f;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px;margin:26px 0}
.post{background:#fff;border:1px solid #e1e4da;border-radius:22px;padding:22px;text-decoration:none;display:flex;flex-direction:column;gap:10px;transition:transform .15s,box-shadow .15s}
.post:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(7,26,57,.08)}.post h3{margin:0;font-size:1.55rem}.post p{margin:0;color:#24364f;font-size:.95rem}
.post .kick{align-self:flex-start}.post .by{font-size:.8rem;color:#5b6878;margin-top:auto}.post.feat{background:#071A39;color:#F9F8F6;grid-column:1/-1}.post.feat p,.post.feat .by{color:#c9d2df}.post.feat h3{font-size:clamp(1.8rem,5vw,2.4rem)}
.net{font-size:.88rem;color:#4d5b6a;margin:8px 0 0}
@media(max-width:560px){.loop::after{display:none}nav.tn{gap:10px}}
footer{border-top:1px solid #d8dccf;margin-top:48px;padding:24px 0 40px;font-size:.9rem;color:#4d5b6a}footer a{color:#24364f}`;

export function shell(path: string, title: string, description: string, body: string, jsonLd: unknown, ogType: "article" | "website"): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
${publicSeoTags(path, title, description)}
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="Birch Reserve">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>
</head><body>
<header class="top"><div class="wrap wide"><a class="logo" href="/">BIRCH RESERVE</a><nav class="tn" aria-label="Blog"><a class="on" href="${BLOG_INDEX_PATH}">Blog</a><a href="/media-kit">Media kit</a><a href="/agencies">Agencies</a><a class="pill" href="/intake">Start intake</a></nav></div></header>
<main>${body}</main>
<footer><div class="wrap wide">Silver Birch Growth Inc. · Toronto, Ontario · <a href="tel:+16479316278">(647) 931-6278</a> · <a href="mailto:randy@scalehealth.ca">randy@scalehealth.ca</a><br><a href="${BLOG_INDEX_PATH}">Blog</a> · <a href="/advertiser-guides">Advertiser guides</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></div></footer>
</body></html>`;
}

const CTA = `<div class="cta"><p>Put your brand in front of recovery customers inside retail hubs.<small>Start performance-only. Upgrade to display on CPM or CPC when you are ready.</small></p><div class="btns"><a class="btn" href="/intake">Start your intake</a><a class="btn line" href="/media-kit">Media kit</a></div></div>`;

function renderVisual(v: BlogVisual): string {
  if (v.kind === "split") {
    const bar = v.items.map((i) => `<div style="flex:${i.pct}"><b>${i.pct}%</b><small>${esc(i.label)}</small></div>`).join("");
    const legend = v.items.map((i) => `<div><strong>${esc(i.label)}</strong><br><span>${esc(i.sub)}</span></div>`).join("");
    return `<figure class="viz" aria-label="${esc(v.title)}"><h3>${esc(v.title)}</h3><div class="bar">${bar}</div><div class="legend">${legend}</div><p class="vn">${esc(v.note)}</p></figure>`;
  }
  const cls = v.kind === "loop" ? "loop" : "steps";
  const items = v.items.map((i) => `<div><strong>${esc(i.label)}</strong><span>${esc(i.sub)}</span></div>`).join("");
  return `<figure class="viz" aria-label="${esc(v.title)}"><h3>${esc(v.title)}</h3><div class="${cls}">${items}</div></figure>`;
}

export function postPath(p: BlogPost): string {
  return `${BLOG_INDEX_PATH}/${p.slug}`;
}

export function renderPost(p: BlogPost): string {
  const path = postPath(p);
  const tldr = p.tldr.map((t, i) => `<div><b>0${i + 1}</b>${esc(t)}</div>`).join("");
  const sections = p.sections
    .map((s) => {
      const paras = (s.paras ?? []).map((x) => `<p>${esc(x)}</p>`).join("");
      const bullets = s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
      const quote = s.quote ? `<blockquote class="q">${esc(s.quote)}</blockquote>` : "";
      return `<h2>${esc(s.h2)}</h2>${paras}${bullets}${quote}`;
    })
    .join("");
  const birch = `<section class="birch"><h2>${esc(p.birch.h2)}</h2><ul>${p.birch.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></section>`;
  const body = `<div class="wrap"><section class="hero"><span class="kick">${esc(p.kicker)}</span>
<h1>${esc(p.h1)}</h1><p class="lede">${esc(p.lede)}</p><p class="meta"><a href="${BLOG_INDEX_PATH}">Birch Reserve blog</a> · ${p.minutes} min read</p></section>
<div class="tldr" aria-label="In 30 seconds">${tldr}</div>
${renderVisual(p.visual)}
<article>${sections}${birch}</article>
${CTA}
<p class="insp">Inspired by ${esc(p.inspired.by)}: <a href="${esc(p.inspired.url)}" rel="noopener" target="_blank">${esc(p.inspired.work)}</a>. Ideas paraphrased and rewritten by Birch Reserve; any errors are ours. Birch reach and audience figures are modelled estimates, in USD, and never guaranteed.</p></div>`;
  const url = `${PUBLIC_SITE_ORIGIN}${path}`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: p.h1,
        description: p.description,
        url,
        mainEntityOfPage: url,
        image: PUBLIC_OG_IMAGE,
        datePublished: BLOG_PUBLISHED,
        dateModified: BLOG_PUBLISHED,
        articleSection: p.kicker,
        author: { "@type": "Organization", name: "Birch Reserve", url: PUBLIC_SITE_ORIGIN },
        publisher: { "@type": "Organization", name: "Silver Birch Growth Inc.", url: PUBLIC_SITE_ORIGIN },
        isBasedOn: p.inspired.url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: `${PUBLIC_SITE_ORIGIN}${BLOG_INDEX_PATH}` },
          { "@type": "ListItem", position: 2, name: p.h1, item: url },
        ],
      },
    ],
  };
  return shell(path, p.title, p.description, body, ld, "article");
}

export function renderBlogIndex(): string {
  const title = "Blog: ads and distribution playbooks for brands | Birch Reserve";
  const description = "Short, visual playbooks on paid ads, distribution, media buying and retail media, with how each idea plays out for brands in retail hubs.";
  const cards = BLOG_POSTS.map(
    (p, i) =>
      `<a class="post${i === 0 ? " feat" : ""}" href="${postPath(p)}"><span class="kick">${esc(p.kicker)}</span><h3>${esc(p.h1)}</h3><p>${esc(p.lede)}</p><span class="by">${p.minutes} min read · Inspired by ${esc(p.inspired.by)}</span></a>`,
  ).join("");
  const body = `<div class="wrap wide"><section class="hero"><span class="kick">Birch Reserve blog</span>
<h1>Ads and distribution, made simple</h1><p class="lede">The best ideas on paid ads, distribution and media buying, boiled down to a few minutes each, with how they play out for brands in retail hubs.</p>
<p class="net">${esc(NETWORK_LINE)}</p></section>
<div class="grid">${cards}</div>${CTA}</div>`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Birch Reserve blog",
    url: `${PUBLIC_SITE_ORIGIN}${BLOG_INDEX_PATH}`,
    publisher: { "@type": "Organization", name: "Silver Birch Growth Inc.", url: PUBLIC_SITE_ORIGIN },
    blogPost: BLOG_POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.h1, url: `${PUBLIC_SITE_ORIGIN}${postPath(p)}`, datePublished: BLOG_PUBLISHED })),
  };
  return shell(BLOG_INDEX_PATH, title, description, body, ld, "website");
}

router.get([BLOG_INDEX_PATH, `${BLOG_INDEX_PATH}/`], (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.type("html").send(renderBlogIndex());
});

for (const p of BLOG_POSTS) {
  router.get([postPath(p), `${postPath(p)}/`], (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.type("html").send(renderPost(p));
  });
}

export default router;
