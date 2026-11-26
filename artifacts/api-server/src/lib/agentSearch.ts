/**
 * Search for agents (Randy, Nov 26 2026; pattern from Cloudflare's "Search for Agents").
 * A read-only search over PUBLIC page copy only. The index is built once per process from the same sources as the
 * public pages: the Markdown mirrors, the advertiser guides / buyer answers, and the blog. It never reads the
 * database, gated pages (TAM access-code areas, /advertise/brands names and per-hub volumes, /inventory planner
 * labels), checkout, promo codes or client names. Any chunk that trips the hard-rule filter below is dropped.
 */
import { MD_PAGES, mdPathFor, renderMarkdown } from "./aiMarkdown";
import { ADVERTISER_GUIDES } from "./advertiserGuides";
import { BLOG_POSTS, BLOG_INDEX_PATH } from "./blogPosts";
import { AGENCY_FAQ, AGENCY_RATE_RULES, BUY_PATHS } from "./overhaul/agencyShowcase";
import { MEDIA_BUYER_FAQ } from "./overhaul/mediaBuyers";
import { POSITIONING, POSITIONING_FOLLOW } from "./aiDiscovery";

import { SEARCH_ORIGIN } from "./agentSearchMeta";
export * from "./agentSearchMeta";

/** Never in the index, whatever the source says. */
const BLOCKED: readonly RegExp[] = [
  /\bAlign\b/, /Clairvoyant/i, /Alset/i, /80 locations/i, /MedVibe/i, /\bFriday\b/, /pier ?39/i, /Ankita/i, /Kalaya/i,
  /\b(?:promo|coupon|discount|access|insider) ?code[:\s]+[A-Z0-9-]{5,}\b/, /access[- ]?code|insider code/i,
  /\b0 (hubs|brands|spots|seats)\b/i,
];
/** "No impression guarantee" style disclaimers are fine; a positive guarantee is not. */
const positiveGuarantee = (s: string) =>
  /guarante/i.test(s.replace(/\b(no|not|never|without|don't|do not|does not|doesn't|isn't|is not)\b[^.\n]{0,48}guarante\w*/gi, ""));
export const AGENT_SEARCH_BLOCKED = BLOCKED;

export type SearchDoc = { title: string; url: string; text: string };
export type SearchHit = { title: string; url: string; snippet: string; score: number };

const stripMd = (s: string) =>
  s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)").replace(/[*_`>#|]/g, " ").replace(/\s+/g, " ").trim();

/** Split Markdown on `## ` headings: one chunk per section, titled "<page> · <section>". */
function chunk(pageTitle: string, url: string, md: string): SearchDoc[] {
  const out: SearchDoc[] = [];
  const parts = `\n${md}`.split(/\n(?=## )/);
  for (const part of parts) {
    const m = part.match(/^## ([^\n]+)\n?([\s\S]*)$/);
    const heading = m ? m[1]!.trim() : "";
    const body = stripMd(m ? m[2]! : part.replace(/^\n?# [^\n]*\n?/, ""));
    if (body.length < 30) continue;
    // Forward-looking inventory estimate counts are stated only on the page itself (same rule as the home mirror).
    if (/^2027 ad inventory/i.test(heading)) continue;
    out.push({ title: heading ? `${pageTitle} · ${heading}` : pageTitle, url, text: `${heading}. ${body}` });
  }
  return out;
}

let cache: SearchDoc[] | null = null;

export function buildAgentSearchIndex(): SearchDoc[] {
  const docs: SearchDoc[] = [];
  for (const p of MD_PAGES) {
    if (p.path === "/") continue; // home mirror = llms.txt; its sections already sit under the pages below
    const md = renderMarkdown(mdPathFor(p.path));
    if (md) docs.push(...chunk(p.title, `${SEARCH_ORIGIN}${p.path === "/" ? "/" : p.path}`, md));
  }
  // Pages that are React-rendered (no Markdown mirror): index the same copy the pages are built from.
  docs.push({ title: "Birch Reserve: what it is", url: `${SEARCH_ORIGIN}/`, text: `${POSITIONING} ${POSITIONING_FOLLOW}` });
  for (const f of MEDIA_BUYER_FAQ) docs.push({ title: `Media buyers · ${f.q}`, url: `${SEARCH_ORIGIN}/media-buyers`, text: `${f.q} ${f.a}` });
  for (const f of AGENCY_FAQ) docs.push({ title: `Agencies · ${f.q}`, url: `${SEARCH_ORIGIN}/agencies`, text: `${f.q} ${f.a}` });
  for (const r of AGENCY_RATE_RULES) docs.push({ title: `Agencies · Rate card rules · ${r.k}`, url: `${SEARCH_ORIGIN}/agencies`, text: `${r.k}. ${r.d}` });
  docs.push({
    title: "Start an intake",
    url: `${SEARCH_ORIGIN}/intake`,
    text: `Start an intake: send your brand, category and goal. ${BUY_PATHS.io.kicker}, ${BUY_PATHS.io.price} ${BUY_PATHS.io.sub}. ` + BUY_PATHS.rows.map((r) => `${r.k}: card, ${r.card}; IO, ${r.io}.`).join(" "),
  });
  // renderGuideMarkdown is in the route file (express import); build the same Markdown inline from the guide data.
  for (const g of ADVERTISER_GUIDES) {
    const md: string[] = [`# ${g.h1}`, "", `> ${g.description}`, "", g.lede, ""];
    if (g.answer) md.push(`## Short answer`, g.answer, "");
    for (const s of g.sections) md.push(`## ${s.h2}`, ...(s.paras ?? []), ...(s.bullets ?? []).map((b) => `- ${b}`), "");
    if (g.faq?.length) md.push("## Questions buyers ask", ...g.faq.flatMap((f) => [`${f.q}`, f.a, ""]));
    const intro = stripMd(`${g.description} ${g.lede}`);
    docs.push({ title: g.h1, url: `${SEARCH_ORIGIN}/${g.slug}`, text: intro });
    docs.push(...chunk(g.h1, `${SEARCH_ORIGIN}/${g.slug}`, md.join("\n")));
  }
  for (const b of BLOG_POSTS) {
    docs.push({ title: `Blog · ${b.h1}`, url: `${SEARCH_ORIGIN}${BLOG_INDEX_PATH}/${b.slug}`, text: stripMd(`${b.description} ${b.tldr.join(" ")}`) });
  }
  return docs.filter((d) => !BLOCKED.some((re) => re.test(d.title) || re.test(d.text)) && !positiveGuarantee(`${d.title} ${d.text}`));
}

export function agentSearchIndex(): SearchDoc[] {
  return (cache ??= buildAgentSearchIndex());
}

const STOP = new Set("a an and are as at be but by can do does for from how i if in is it its of on or our so that the their there this to we what when where which who why will with you your me my about into".split(" "));
const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9$]+/g) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
const stem = (t: string) => (t.length > 4 ? t.replace(/(ing|ed|es|s)$/, "") : t);

type Prepared = { doc: SearchDoc; tf: Map<string, number>; len: number; titleSet: Set<string> };
let prepared: { items: Prepared[]; df: Map<string, number>; avg: number } | null = null;

function prepare() {
  if (prepared) return prepared;
  const items: Prepared[] = [];
  const df = new Map<string, number>();
  for (const doc of agentSearchIndex()) {
    const tf = new Map<string, number>();
    const toks = tokens(`${doc.title} ${doc.text}`).map(stem);
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    items.push({ doc, tf, len: toks.length || 1, titleSet: new Set(tokens(doc.title).map(stem)) });
  }
  prepared = { items, df, avg: items.reduce((n, i) => n + i.len, 0) / (items.length || 1) };
  return prepared;
}

function snippetFor(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t.slice(0, Math.max(3, t.length - 1)));
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, at < 0 ? 0 : at - 60);
  let s = text.slice(start, start + 260).trim();
  if (start > 0) s = `…${s}`;
  if (start + 260 < text.length) s = `${s}…`;
  return s;
}

export function agentSearch(query: string, limit = 5): SearchHit[] {
  const q = tokens(query.slice(0, 300)).map(stem);
  if (!q.length) return [];
  const { items, df, avg } = prepare();
  const N = items.length;
  const scored: { item: Prepared; score: number }[] = [];
  for (const item of items) {
    let score = 0;
    for (const t of new Set(q)) {
      const f = item.tf.get(t) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (item.len / avg)))) + (item.titleSet.has(t) ? idf * 0.8 : 0);
    }
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]?.score ?? 1;
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  for (const { item, score } of scored) {
    if (seen.has(item.doc.url)) continue; // best chunk per page
    seen.add(item.doc.url);
    hits.push({ title: item.doc.title, url: item.doc.url, snippet: snippetFor(item.doc.text, q), score: Math.round((score / top) * 1000) / 1000 });
    if (hits.length >= Math.max(1, Math.min(limit, 10))) break;
  }
  return hits;
}

export function searchMarkdown(query: string, hits: SearchHit[]): string {
  const body = hits.length
    ? hits.flatMap((h) => [`## ${h.title} (score: ${h.score.toFixed(3)})`, "", h.url, "", h.snippet, "", "---", ""])
    : ["No public pages matched. Try fewer words, or read https://birchreserve.net/llms.txt.", ""];
  return [`# Search results for: "${query}"`, "", ...body].join("\n");
}
