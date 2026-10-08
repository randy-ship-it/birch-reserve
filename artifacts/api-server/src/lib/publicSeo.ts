/**
 * Public indexable URLs for birchreserve.net.
 * Canonicals are the apex host with no trailing slash, except the home page.
 * /inventory is a gated rewrite to another project and is never listed.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PUBLIC_SITE_ORIGIN = "https://birchreserve.net";

/** Existing Birch mark, served from this site. */
export const PUBLIC_OG_IMAGE = `${PUBLIC_SITE_ORIGIN}/apple-touch-icon.png`;

/** HTML pages a crawler should index. Insight articles are appended at request time. */
export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/about",
  "/kit",
  "/sell-ads",
  "/list-inventory",
  "/terms",
  "/privacy",
  "/sample-io",
  "/marketplace",
  "/success",
  "/splash/activation",
  "/insights",
  "/buycalc",
] as const;

/**
 * SPA routes whose HTML is the Vite shell. The function rewrites the head so
 * crawlers see a per-route canonical. Server-rendered pages are not in this list.
 */
export const SPA_SHELL_PATHS = [
  "/about",
  "/sell-ads",
  "/list-inventory",
  "/marketplace",
  "/success",
  "/splash/activation",
] as const;

const TRAILING_URL_PUNCTUATION = /[.,;:!?)]+$/;

export function publicCanonical(pathname: string): string {
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const clean = withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
  return clean === "/" ? `${PUBLIC_SITE_ORIGIN}/` : `${PUBLIC_SITE_ORIGIN}${clean}`;
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function publicSeoTags(pathname: string): string {
  const canonical = escapeAttr(publicCanonical(pathname));
  const image = escapeAttr(PUBLIC_OG_IMAGE);
  return [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ].join("");
}

/** Keep sentence punctuation out of an autolink href. The mark stays in the text. */
export function splitTrailingUrlPunctuation(url: string): { href: string; trail: string } {
  const trail = url.match(TRAILING_URL_PUNCTUATION)?.[0] ?? "";
  if (!trail) return { href: url, trail: "" };
  const href = url.slice(0, url.length - trail.length);
  if (!/^https?:\/\/[^/?#\s]+/.test(href)) return { href: url, trail: "" };
  return { href, trail };
}

export function autolinkPlainUrl(url: string): string {
  const { href, trail } = splitTrailingUrlPunctuation(url);
  const safe = escapeAttr(href);
  return `<a href="${safe}">${safe}</a>${escapeAttr(trail)}`;
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function sitemapXml(paths: readonly string[], lastmodByPath: ReadonlyMap<string, string> = new Map()): string {
  const body = paths
    .map((path) => {
      const loc = escapeXml(publicCanonical(path));
      const lastmod = lastmodByPath.get(path);
      return `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ""}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `${replacement}\n</head>`);
}

/** Point the shared SPA shell at one public route without dropping the client bundle. */
export function withRouteSeo(html: string, pathname: string): string {
  const canonical = escapeAttr(publicCanonical(pathname));
  const image = escapeAttr(PUBLIC_OG_IMAGE);
  let next = replaceTag(
    html,
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`,
  );
  next = replaceTag(
    next,
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${canonical}" />`,
  );
  next = replaceTag(
    next,
    /<meta\s+property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${image}" />`,
  );
  next = replaceTag(
    next,
    /<meta\s+name="twitter:card"[^>]*>/i,
    `<meta name="twitter:card" content="summary_large_image" />`,
  );
  next = replaceTag(
    next,
    /<meta\s+name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${image}" />`,
  );
  return next;
}

export function resolveSpaIndexHtmlPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "spa-index.html"),
    resolve(process.cwd(), "spa-index.html"),
    resolve(process.cwd(), "artifacts/clinichub-media/dist/public/index.html"),
    resolve(process.cwd(), "../clinichub-media/dist/public/index.html"),
    resolve(process.cwd(), "../clinichub-media/index.html"),
    resolve(process.cwd(), "artifacts/clinichub-media/index.html"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("SPA index.html is missing.");
  return found;
}

export function readSpaIndexHtml(): string {
  return readFileSync(resolveSpaIndexHtmlPath(), "utf8");
}
