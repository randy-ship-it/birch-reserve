/**
 * Public indexable URLs for birchreserve.net.
 * Canonicals are the apex host with no trailing slash, except the home page.
 * /inventory is a gated rewrite to another project and is never listed.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OVERHAUL_OG_IMAGE, OVERHAUL_ROUTES } from "./overhaul/seo";
import { PUBLIC_RESERVE_OFFERS, offerAmountCents } from "./reserveOffers";
import type { ReserveCurrency } from "./reserveOffers";

export const PUBLIC_SITE_ORIGIN = "https://birchreserve.net";

/** Existing Birch mark, served from this site. */
export const PUBLIC_OG_IMAGE = `${PUBLIC_SITE_ORIGIN}/og-birch-reserve.png`;

/**
 * HTML pages a crawler should index. Insight articles are appended at request time.
 * Only 200, indexable, self-canonical URLs. /list-inventory canonicals to /sell-ads.
 * /success and /splash/activation are noindex. /ad-examples, /oatmeal, and /advertise redirect.
 */
export const PUBLIC_SITEMAP_PATHS = [
  "/",
  "/about",
  "/kit",
  "/sell-ads",
  "/terms",
  "/privacy",
  "/sample-io",
  "/marketplace",
  "/insights",
  "/buycalc",
  "/advertise/brands",
  "/advertise/local",
  "/publish/brands",
  "/publish/studios",
  "/match",
  "/hubs",
  "/media-kit",
  "/agencies",
  "/ai-buyers",
  "/buyers",
  "/rates",
  "/audiences",
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
  "/advertise/brands",
  "/advertise/local",
  "/publish/brands",
  "/publish/studios",
  "/match",
  "/hubs",
  "/media-kit",
  "/agencies",
  "/ai-buyers",
  "/buyers",
  "/rates",
  "/audiences",
  "/audiences/sample-profile",
] as const;

/** Client routes that duplicate another URL. The canonical is the target. */
const CANONICAL_ALIAS: Readonly<Record<string, string>> = {
  "/list-inventory": "/sell-ads",
};

const NOINDEX_PATHS = new Set<string>(["/success", "/splash/activation"]);

export function normalizedPath(pathname: string): string {
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const clean = withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
  return clean.split("?")[0] || "/";
}

const TRAILING_URL_PUNCTUATION = /[.,;:!?)]+$/;

export function publicCanonical(pathname: string): string {
  const clean = normalizedPath(pathname);
  const target = CANONICAL_ALIAS[clean] ?? clean;
  return target === "/" ? `${PUBLIC_SITE_ORIGIN}/` : `${PUBLIC_SITE_ORIGIN}${target}`;
}

export function isSelfCanonical(pathname: string): boolean {
  const clean = normalizedPath(pathname);
  return publicCanonical(clean) === (clean === "/" ? `${PUBLIC_SITE_ORIGIN}/` : `${PUBLIC_SITE_ORIGIN}${clean}`);
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function publicSeoTags(pathname: string, title?: string, description?: string): string {
  const canonical = escapeAttr(publicCanonical(pathname));
  const image = escapeAttr(PUBLIC_OG_IMAGE);
  const social =
    title !== undefined && description !== undefined
      ? [
          `<meta property="og:title" content="${escapeAttr(title)}" />`,
          `<meta property="og:description" content="${escapeAttr(description)}" />`,
        ]
      : [];
  return [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    ...social,
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
  const meta = OVERHAUL_ROUTES[normalizedPath(pathname)];
  if (meta) {
    const t = escapeAttr(meta.title);
    const d = escapeAttr(meta.description);
    next = replaceTag(next, /<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`);
    next = replaceTag(next, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${d}" />`);
    next = replaceTag(next, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${t}" />`);
    next = replaceTag(next, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${d}" />`);
    next = replaceTag(next, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${t}" />`);
    next = replaceTag(next, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${d}" />`);
    const routeImage = escapeAttr(meta.image ?? OVERHAUL_OG_IMAGE);
    next = replaceTag(next, /<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${routeImage}" />`);
    next = replaceTag(next, /<meta\s+name="twitter:image"[^>]*>/i, `<meta name="twitter:image" content="${routeImage}" />`);
    if (meta.jsonld) next = next.replace("</head>", `<script type="application/ld+json">${JSON.stringify(meta.jsonld).replace(/</g, "\\u003c")}</script>\n</head>`);
  }
  if (NOINDEX_PATHS.has(normalizedPath(pathname))) {
    next = replaceTag(next, /<meta\s+name="robots"[^>]*>/i, `<meta name="robots" content="noindex" />`);
  }
  return next;
}

/** Unknown URLs keep the SPA shell (the client paints Signal Lost) and must not be indexed. */
export function withNotFoundDocument(html: string): string {
  return replaceTag(html, /<meta\s+name="robots"[^>]*>/i, `<meta name="robots" content="noindex" />`);
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


/**
 * Home-page structured data in the visitor's currency. The static shell ships a
 * USD fallback; the function swaps the whole Product/Offer block for the
 * detected or forced currency (CAD for Canada, USD elsewhere).
 */
export function homeOfferJsonLd(currency: ReserveCurrency): string {
  const offer = PUBLIC_RESERVE_OFFERS.find((o) => o.sku === "reserve-490");
  if (!offer) throw new Error("reserve-490 offer is missing.");
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Birch Reserve starter slot",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        item: {
          "@type": "Product",
          name: "Birch Reserve starter slot",
          sku: offer.sku,
          category: "Health and wellness retail media / display and CPC",
          offers: {
            "@type": "Offer",
            price: String(offerAmountCents(offer, currency) / 100),
            priceCurrency: currency.toUpperCase(),
            availability: "https://schema.org/LimitedAvailability",
            url: `${PUBLIC_SITE_ORIGIN}/advertise/brands`,
          },
        },
      },
    ],
  };
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}

export function withLocalizedOffer(html: string, currency: ReserveCurrency): string {
  const block = /<script type="application\/ld\+json">[\s\S]*?<\/script>/g;
  let replaced = false;
  const next = html.replace(block, (match) => {
    if (replaced || !match.includes("reserve-490")) return match;
    replaced = true;
    return `<script type="application/ld+json">${homeOfferJsonLd(currency)}</script>`;
  });
  return next;
}
