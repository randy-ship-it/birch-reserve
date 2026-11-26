/**
 * Server-rendered advertiser guides (Randy, Nov 15 2026). Standalone: no DB imports.
 *   GET /advertiser-guides          index
 *   GET /<guide slug>               one guide (see lib/advertiserGuides.ts)
 */
import { Router, type IRouter } from "express";
import { ADVERTISER_GUIDES, GUIDES_INDEX_PATH, GUIDES_REVIEWED, type AdvertiserGuide } from "../lib/advertiserGuides";
import { aiRefBeaconScript } from "../lib/aiReferral";
import { PUBLIC_SITE_ORIGIN, publicSeoTags } from "../lib/publicSeo";

const router: IRouter = Router();

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:#F9F8F6;color:#071A39;font:17px/1.65 "IBM Plex Sans",system-ui,sans-serif}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.top{border-bottom:1px solid #d8dccf;background:#F9F8F6;position:sticky;top:0;z-index:2}
header.top .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:56px}
.logo{font-weight:600;letter-spacing:.12em;font-size:.85rem;text-decoration:none;color:#071A39}
nav.tn{display:flex;gap:14px;font-size:.88rem;flex-wrap:wrap;justify-content:flex-end}nav.tn a{color:#071A39}
.crumb{font-size:.85rem;color:#4d5b6a;margin:22px 0 0}.crumb a{color:#4d5b6a}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.15}
h1{font-size:clamp(2rem,7vw,3rem);margin:.35em 0 .3em}h2{font-size:clamp(1.35rem,4.5vw,1.7rem);margin:1.8em 0 .5em}
.lede{font-size:1.12rem;color:#24364f}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 6px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;border-radius:999px;background:#071A39;color:#F9F8F6;text-decoration:none;font-weight:600;font-size:.98rem}
.btn.line{background:transparent;color:#071A39;border:1.5px solid #071A39}
ul{padding-left:1.2em}li{margin:.4em 0}
.card{background:#fff;border:1px solid #e1e4da;border-radius:16px;padding:18px 20px;margin:14px 0}
main a{color:#071A39;text-underline-offset:2px}main a:hover{text-decoration-thickness:2px}
.card h3{margin:.1em 0 .3em;font-size:1.25rem}.card a{text-decoration:none}.card a:hover{text-decoration:underline}.card p{margin:.2em 0;color:#24364f}
.note{background:#eef1e8;border-radius:14px;padding:14px 16px;font-size:.95rem}
.src{font-size:.9rem;color:#4d5b6a}.src a{color:#24364f;word-break:break-word}
footer{border-top:1px solid #d8dccf;margin-top:48px;padding:24px 0 96px;font-size:.9rem;color:#4d5b6a}footer a{color:#24364f}
.answer{background:#fff;border:1.5px solid #071A39;border-radius:16px;padding:16px 18px;margin:18px 0 6px;font-size:1.05rem}.answer b{display:block;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;margin-bottom:4px;color:#4d5b6a}
.pill{display:inline-block;background:#C8F55A;color:#071A39;border-radius:999px;padding:3px 12px;font-weight:600;font-size:.8rem}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:18px 0}.tile{background:#071A39;color:#F9F8F6;border-radius:16px;padding:14px 16px;font-size:.95rem;line-height:1.45}.tile b{display:block;font-family:Fraunces,Georgia,serif;font-weight:400;font-size:1.35rem;margin-bottom:4px;color:#C8F55A}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0;counter-reset:s}.step{border:1px solid #d8dccf;border-radius:14px;padding:12px;background:#fff;font-size:.9rem;line-height:1.35}.step b{display:block;font-family:Fraunces,Georgia,serif;font-size:1.6rem;font-weight:400;line-height:1;margin-bottom:6px}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:14px 0;border:1px solid #e1e4da;border-radius:14px;background:#fff}table.cmp{border-collapse:collapse;width:100%;font-size:.92rem;line-height:1.4}.cmp caption{text-align:left;padding:12px 14px 4px;font-weight:600}.cmp th,.cmp td{text-align:left;padding:10px 14px;border-top:1px solid #eef0ea;vertical-align:top}.cmp thead th{background:#F3F4EF;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em}.cmp tr.us td{background:#F4FBE3;font-weight:500}
details.q{background:#fff;border:1px solid #e1e4da;border-radius:14px;padding:4px 16px;margin:8px 0}details.q summary{cursor:pointer;font-weight:600;min-height:48px;display:flex;align-items:center}details.q p{margin:0 0 12px;color:#24364f}
.mock{display:grid;grid-template-columns:1fr;gap:6px;max-width:260px;margin:16px auto;padding:14px;border:8px solid #071A39;border-radius:28px;background:#fff}.mock div{border-radius:8px;padding:10px;font-size:.78rem;font-weight:600;text-align:center}.mock .b{background:#C8F55A}.mock .g{background:#eef1e8;color:#4d5b6a;font-weight:400}.mock .p{background:#071A39;color:#F9F8F6}.mockcap{text-align:center;font-size:.82rem;color:#4d5b6a;margin-top:-6px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.cards .card{margin:0}
.sticky{position:fixed;left:0;right:0;bottom:0;z-index:5;background:rgba(249,248,246,.97);border-top:1px solid #d8dccf;padding:10px 16px calc(10px + env(safe-area-inset-bottom));display:flex;gap:10px;align-items:center;justify-content:center}.sticky span{font-size:.85rem;color:#24364f}.sticky .btn{min-height:44px}
@media(max-width:560px){.cmp th,.cmp td{padding:8px 8px;font-size:.82rem;overflow-wrap:anywhere}.cmp thead th{font-size:.7rem;letter-spacing:.03em}.logo{white-space:nowrap}nav.tn{gap:12px}nav.tn a:nth-child(2){display:none}.steps{grid-template-columns:1fr}.sticky span{display:none}.sticky .btn{flex:1}}`;

function shell(path: string, title: string, description: string, body: string, jsonLd: unknown, sticky = ""): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow">
${publicSeoTags(path, title, description)}
<meta property="og:type" content="article">
${path === GUIDES_INDEX_PATH ? "" : `<link rel="alternate" type="text/markdown" href="${PUBLIC_SITE_ORIGIN}${path}.md">`}
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>
</head><body>
<header class="top"><div class="wrap"><a class="logo" href="/">BIRCH RESERVE</a><nav class="tn" aria-label="Advertiser guides"><a href="${GUIDES_INDEX_PATH}">Guides</a><a href="/blog">Blog</a><a href="/media-kit">Media kit</a><a href="/starter">Starter</a></nav></div></header>
<main class="wrap">${body}</main>
<footer><div class="wrap">Silver Birch Growth Inc. · Toronto, Ontario · <a href="mailto:randy@scalehealth.ca">randy@scalehealth.ca</a><br><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="${GUIDES_INDEX_PATH}">All advertiser guides</a></div></footer>
${sticky}${CTA_TRACK}${aiRefBeaconScript()}
</body></html>`;
}

const reserveHref = (g?: AdvertiserGuide) => `/starter${g?.exclusiveCategory ? `?category=${encodeURIComponent(g.exclusiveCategory)}` : ""}`;
const ctaHtml = (g?: AdvertiserGuide) => `<div class="cta"><a class="btn" data-cta="reserve" href="${reserveHref(g)}">Starter placement · $1,900</a><a class="btn line" href="/media-kit">See the media kit</a></div>`;
const CTA = ctaHtml();
const STEPS = `<div class="steps" aria-label="How buying works"><div class="step"><b>1</b>Pay $1,900 by card. All of it counts toward your package.</div><div class="step"><b>2</b>Sign the insertion order: hub, placement, dates.</div><div class="step"><b>3</b>Send your creative. It runs after a quick human review.</div></div>`;
const stickyHtml = (g?: AdvertiserGuide) => `<div class="sticky"><span>One brand per category. Refundable until 14 days before launch.</span><a class="btn" data-cta="reserve" href="${reserveHref(g)}">Starter placement · $1,900</a></div>`;
const CTA_TRACK = `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest('a[data-cta="reserve"]');if(!a)return;try{navigator.sendBeacon&&navigator.sendBeacon("/v1/ui-events",new Blob([JSON.stringify({event:"cta_open_reserve",path:(location.pathname||"/").slice(0,200)})],{type:"application/json"}))}catch(x){}},true)</script>`;
const MOCK = `<div class="mock" role="img" aria-label="Illustrative hub page with example placement areas"><div class="b">Hub banner</div><div class="g">Member dashboard</div><div class="p">Product page unit</div><div class="g">Recovery tools</div><div class="b">Thank-you card</div></div><p class="mockcap">Illustrative. Example placement areas on a hub page, no brand creative.</p>`;

export function renderGuide(g: AdvertiserGuide): string {
  const path = `/${g.slug}`;
  const isNew = Boolean(g.group);
  const reviewed = isNew ? "November 22, 2026" : GUIDES_REVIEWED;
  const sections = g.sections
    .map((s) => {
      const paras = (s.paras ?? []).map((p) => `<p>${esc(p)}</p>`).join("");
      const bullets = s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
      return `<h2>${esc(s.h2)}</h2>${paras}${bullets}`;
    })
    .join("");
  const answer = g.answer ? `<div class="answer"><b>Short answer</b>${esc(g.answer)}</div>` : "";
  const tiles = g.tiles?.length ? `<div class="tiles">${g.tiles.map((t) => `<div class="tile"><b>${esc(t.k)}</b>${esc(t.v)}</div>`).join("")}</div>` : "";
  const compare = g.compare
    ? `<h2>${esc(g.compare.caption)}</h2><div class="tw"><table class="cmp"><thead><tr>${g.compare.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${g.compare.rows
        .map((r) => `<tr${/Birch Reserve/.test(r.join(" ")) ? ' class="us"' : ""}>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`)
        .join("")}</tbody></table></div>`
    : "";
  const faq = g.faq?.length ? `<h2>Questions buyers ask</h2>${g.faq.map((f, i) => `<details class="q"${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}` : "";
  const related = [
    ...(g.related ?? []),
    ...ADVERTISER_GUIDES.filter((x) => x.slug !== g.slug && x.group === (g.group ?? "answer")).slice(0, 4).map((x) => ({ label: x.h1, href: `/${x.slug}` })),
  ];
  const relatedHtml = related.length ? `<h2>Related</h2><ul>${related.map((r) => `<li><a href="${esc(r.href)}">${esc(r.label)}</a></li>`).join("")}</ul>` : "";
  const sources = g.sources.length ? `<h2>Sources</h2><ol class="src">${g.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join("")}</ol>` : "";
  const status = g.status ? `<p style="margin:10px 0 0"><span class="pill">${esc(g.status)}</span></p>` : "";
  const body = `<p class="crumb"><a href="${GUIDES_INDEX_PATH}">Advertiser guides</a></p>
${status}<h1>${esc(g.h1)}</h1>
<p class="lede">${esc(g.lede)}</p>
${answer}
${ctaHtml(g)}
${tiles}
${g.mock ? MOCK : ""}
${sections}
${compare}
${isNew ? `<h2>How buying works</h2>${STEPS}` : ""}
${faq}
<p class="note">Figures from third parties are their estimates, in USD unless noted, and are cited below. Birch audience volumes are modelled until an insertion order names a hub. Nothing here is legal advice; check your own claims with counsel or a preclearance agency.${isNew ? " Birch does not run prescription-drug promotion." : ""} Last reviewed ${reviewed}.</p>
${ctaHtml(g)}
${relatedHtml}
${sources}`;
  const graph: unknown[] = [
    { "@type": "Article", headline: g.h1, description: g.description, dateModified: isNew ? "2026-11-22" : "2026-11-15", url: `${PUBLIC_SITE_ORIGIN}${path}`, publisher: { "@type": "Organization", name: "Silver Birch Growth Inc.", url: PUBLIC_SITE_ORIGIN } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Advertiser guides", item: `${PUBLIC_SITE_ORIGIN}${GUIDES_INDEX_PATH}` },
      { "@type": "ListItem", position: 2, name: g.h1, item: `${PUBLIC_SITE_ORIGIN}${path}` },
    ] },
  ];
  if (g.faq?.length) graph.push({ "@type": "FAQPage", mainEntity: [...(g.answer ? [{ q: g.h1, a: g.answer }] : []), ...g.faq].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) });
  if (isNew) graph.push({ "@type": "Offer", name: "Starter placement", price: "1900", priceCurrency: "CAD", url: `${PUBLIC_SITE_ORIGIN}/starter`, description: "Holds a $5K–$50K dedicated package in your category pending your insertion order. The full $1,900 counts toward that package. Refunded if another brand commits first. Nothing runs until you sign an insertion order.", seller: { "@type": "Organization", name: "Silver Birch Growth Inc." } });
  return shell(path, g.title, g.description, body, { "@context": "https://schema.org", "@graph": graph }, stickyHtml(g));
}

/** Markdown mirror of one guide (/<slug>.md), for AI assistants. Same words as the page. */
export function renderGuideMarkdown(g: AdvertiserGuide): string {
  const out: string[] = [`# ${g.h1}`, "", `> ${g.description}`, "", g.lede, ""];
  if (g.answer) out.push(`**Short answer:** ${g.answer}`, "");
  if (g.tiles?.length) out.push(...g.tiles.map((t) => `- **${t.k}:** ${t.v}`), "");
  for (const s of g.sections) out.push(`## ${s.h2}`, "", ...(s.paras ?? []).flatMap((p) => [p, ""]), ...(s.bullets ?? []).map((b) => `- ${b}`), "");
  if (g.compare) out.push(`## ${g.compare.caption}`, "", `| ${g.compare.head.join(" | ")} |`, `|${g.compare.head.map(() => " --- ").join("|")}|`, ...g.compare.rows.map((r) => `| ${r.join(" | ")} |`), "");
  if (g.faq?.length) out.push("## Questions buyers ask", "", ...g.faq.flatMap((f) => [`### ${f.q}`, "", f.a, ""]));
  out.push("## Sources", "", ...g.sources.map((s, i) => `${i + 1}. [${s.label}](${s.url})`), "");
  out.push(`HTML version: ${PUBLIC_SITE_ORIGIN}/${g.slug}`, `Starter placement ($1,900, counted in full toward the package): ${PUBLIC_SITE_ORIGIN}/starter`, `All pages: ${PUBLIC_SITE_ORIGIN}/llms.txt`, "");
  return out.join("\n");
}

export function renderGuidesIndex(): string {
  const title = "Advertiser guides: compliant health and wellness advertising | Birch Reserve";
  const description = "Plain answers for health and wellness brands: reaching recovery and physio patients in Canada, clinic waiting-room vs hub display, alternatives to Meta ads, Scale Health categories, and cited guides.";
  const card = (g: AdvertiserGuide) => `<div class="card"><h3><a href="/${g.slug}">${esc(g.h1)}</a></h3>${g.status ? `<p><span class="pill">${esc(g.status)}</span></p>` : ""}<p>${esc(g.description)}</p></div>`;
  const group = (k: AdvertiserGuide["group"]) => ADVERTISER_GUIDES.filter((g) => g.group === k);
  const body = `<h1>Advertiser guides</h1>
<p class="lede">Short, cited answers for health and wellness brands that want curated, compliant placements in front of recovery and wellness customers.</p>
${CTA}
<h2>Buyer answers</h2><div class="cards">${group("answer").map(card).join("")}</div>
<h2>By category</h2><div class="cards">${group("category").map(card).join("")}</div>
<h2>Guides</h2>${group(undefined).map(card).join("")}
<p class="note">Last reviewed November 22, 2026. Birch does not run prescription-drug promotion.</p>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Advertiser guides", url: `${PUBLIC_SITE_ORIGIN}${GUIDES_INDEX_PATH}`, hasPart: ADVERTISER_GUIDES.map((g) => ({ "@type": "Article", headline: g.h1, url: `${PUBLIC_SITE_ORIGIN}/${g.slug}` })) };
  return shell(GUIDES_INDEX_PATH, title, description, body, ld, stickyHtml());
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
  router.get(`/${g.slug}.md`, (_req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.set("X-Robots-Tag", "index, follow");
    res.type("text/markdown; charset=utf-8").send(renderGuideMarkdown(g));
  });
}

export default router;
