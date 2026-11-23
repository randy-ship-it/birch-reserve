/**
 * Markdown mirrors of the main public pages (CrowdReply / Ramp playbook, Nov 21 2026).
 * AI answer engines quote clean Markdown best. Every mirror is public, listed in llms.txt, the sitemap and a
 * <link rel="alternate" type="text/markdown"> on its HTML page. Same content for bots and people: no cloaking.
 * Copy is assembled only from the vetted llms.txt / llms-full.txt sections, so it can never drift from them.
 */
import { llmsTxt } from "./overhaul/seo";
import { llmsFullTxt } from "./aiDiscovery";
import { OVERHAUL_ROUTES } from "./overhaul/seo";

const SITE = "https://birchreserve.net";

function sections(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of `\n${text}`.split(/\n(?=## )/)) {
    const m = part.match(/^## ([^\n]+)\n([\s\S]*)$/);
    if (m) out.set(m[1]!.trim(), `## ${m[1]!.trim()}\n${m[2]!.trim()}`);
  }
  return out;
}

function pick(map: Map<string, string>, prefixes: readonly string[]): string[] {
  const out: string[] = [];
  for (const p of prefixes) for (const [k, v] of map) if (k.startsWith(p)) { out.push(v); break; }
  return out;
}

type MdPage = { path: string; title: string; summary?: string; short: readonly string[]; full: readonly string[] };

/** md path -> HTML page it mirrors. Order = order in llms.txt. */
export const MD_PAGES: readonly MdPage[] = [
  { path: "/", title: "Birch Reserve", short: [], full: [] },
  { path: "/media-kit", title: "Media kit", short: ["Offers", "Hubs (one status ladder)"], full: ["What you can buy", "How to buy", "What Birch does not do"] },
  { path: "/rates", title: "Rates", short: ["Offers"], full: ["What you can buy", "How to buy"] },
  { path: "/buycalc", title: "See prices and pay", short: ["Offers"], full: ["How to buy", "What Birch does not do"] },
  { path: "/buyers", title: "For media buyers and agencies", short: ["For media buyers"], full: ["How to buy", "FAQ"] },
  { path: "/agencies", title: "Agencies", short: ["For media buyers"], full: ["How to buy", "FAQ"] },
  { path: "/hubs", title: "Hubs", short: ["Hubs (one status ladder)"], full: ["How to buy"] },
  { path: "/vs-google-ads", title: "Birch Reserve vs a typical Google Ads start", short: [], full: ["Speed versus Google Ads", "What Birch does not do"] },
];

export function mdPathFor(htmlPath: string): string {
  return htmlPath === "/" ? "/index.md" : `${htmlPath}.md`;
}

const BY_MD = new Map(MD_PAGES.map((p) => [mdPathFor(p.path), p]));
const BY_HTML = new Map(MD_PAGES.map((p) => [p.path, p]));

export function mdPageForHtmlPath(pathname: string): MdPage | undefined {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return BY_HTML.get(p);
}

export function renderMarkdown(mdPath: string): string | null {
  const page = BY_MD.get(mdPath);
  if (!page) return null;
  if (page.path === "/") {
    // Home mirror = llms.txt minus the forward-looking inventory estimate section (counts we only state on the page itself).
    const home = llmsTxt().replace(/\n## 2027 ad inventory[\s\S]*?(?=\n## )/, "\n");
    return `${home.trim()}\n\nHTML version: ${SITE}/\n`;
  }
  const meta = OVERHAUL_ROUTES[page.path];
  const short = sections(llmsTxt());
  const full = sections(llmsFullTxt());
  const body = [...pick(short, page.short), ...pick(full, page.full)];
  return [
    `# ${page.title} | Birch Reserve`,
    "",
    meta ? `> ${meta.description}` : "> Buy Scale Health ads through Birch Reserve.",
    "",
    ...body.flatMap((b) => [b, ""]),
    `HTML version: ${SITE}${page.path}`,
    `See prices and pay: ${SITE}/buycalc · Start an intake: ${SITE}/intake · All pages: ${SITE}/llms.txt`,
    "",
  ].join("\n");
}

export function mdAlternateLink(pathname: string): string | null {
  const page = mdPageForHtmlPath(pathname);
  return page ? `<link rel="alternate" type="text/markdown" href="${SITE}${mdPathFor(page.path)}" />` : null;
}
