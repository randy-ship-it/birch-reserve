/**
 * Scale mirror by proxy (Randy via Emma, Nov 19 2026 4:44 PM ET): scalehealth.ca/intake is the same live /intake,
 * served through a Vercel external rewrite on the Scale project. Not a fork: one deployment, one form.
 *
 * The Scale side only forwards its /intake namespace:
 *   /intake          -> https://birchreserve.net/intake?br_mirror=scale
 *   /intake/:path*   -> https://birchreserve.net/intake/:path*?br_mirror=scale
 * so everything the page loads has to live under /intake on the mirror too. Two pieces do that:
 *
 * 1. MIRROR_PREFIX (/intake/_m): any Birch path is also served at /intake/_m/<path> (assets, /v1 + /api calls, public
 *    images, the kit PDF). The prefix is stripped here (and in the Vercel routes, scripts/vercel-build.mjs), so it
 *    works on birchreserve.net itself as well. It never collides with Scale's own /assets or /api routes.
 * 2. Mirror mode: an /intake page requested with ?br_mirror=<known tag> gets a small boot script at the top of <head>
 *    (window.__BR_MIRROR) that routes same-origin fetch / beacon / XHR / src attributes through the prefix, sends
 *    links that leave /intake to birchreserve.net, and tags the source (scale_mirror) for share + intake tracking.
 *    Root-relative src/href in the shell are prefixed on the server. Canonical stays https://birchreserve.net/…
 *
 * 3. Links (Randy, Nov 20 2026 8:51 AM ET: the mirror must behave the same): root-relative <a href> that leave /intake
 *    are rewritten in the DOM to https://birchreserve.net/<path>, so middle-click, open-in-new-tab, long-press and
 *    copy-link land on the same page as a normal click. Absolute links (e.g. https://www.scalehealth.ca/clinichubs)
 *    and data-mirror-keep links are left alone.
 *
 * Without the query tag nothing changes: birchreserve.net serves byte-identical HTML.
 */
import type { NextFunction, Request, Response } from "express";
import { PUBLIC_SITE_ORIGIN } from "../lib/publicSeo";

export const MIRROR_PREFIX = "/intake/_m";
/** br_mirror tag -> source tag recorded on share events and intake records. */
export const MIRROR_TAGS: Readonly<Record<string, string>> = { scale: "scale_mirror" };
/**
 * Hosts that serve the mirror. Their pages POST to /intake/_m/api/... with their own Origin (the external rewrite
 * forwards Host as birchreserve.net), so origin-checked routes (the site chat) must accept them.
 */
export const MIRROR_ORIGIN_HOSTS: ReadonlySet<string> = new Set(["scalehealth.ca", "www.scalehealth.ca"]);
/**
 * Source tag -> site skin (Randy, Nov 20 2026 8:20 AM ET): scalehealth.ca/intake must look and feel like Scale Health
 * (Scale logo, colours, type, header and footer) while staying the SAME form, fields and logic as birchreserve.net/intake.
 * Only the chrome changes: the page reads window.__BR_MIRROR.skin (lib/siteSkin.ts) and the shell head is re-branded
 * here. One deployment, one form, so both intakes always update together.
 */
export const MIRROR_SKINS: Readonly<Record<string, "scale">> = { scale_mirror: "scale" };
/** Scale's own icon (copied byte-for-byte from silverbirchgrowth/scalehealthnew public/favicon.svg). */
export const SCALE_FAVICON = "/brand/scale/favicon.svg";
const SCALE_FONT_HREF = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
const MIRROR_PAGE_RE = /^\/intake(?:\/(?:publisher|supplier|sponsor|gtm|report))?\/?$/;

/** Strip /intake/_m from a request URL. Returns null when the URL is not prefixed. */
export function stripMirrorPrefix(url: string): string | null {
  if (url !== MIRROR_PREFIX && !url.startsWith(`${MIRROR_PREFIX}/`) && !url.startsWith(`${MIRROR_PREFIX}?`)) return null;
  const rest = url.slice(MIRROR_PREFIX.length);
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/** The boot script. Kept tiny and dependency-free; runs before the freshness check and the bundle. */
export function mirrorBootScript(src: string): string {
  const skin = MIRROR_SKINS[src];
  const cfg = JSON.stringify({ base: MIRROR_PREFIX, src, home: PUBLIC_SITE_ORIGIN, ...(skin ? { skin } : {}) });
  return `<script>(function(){var M=window.__BR_MIRROR=${cfg};var B=M.base,O=location.origin;if(M.skin)document.documentElement.setAttribute("data-skin",M.skin);
function rel(u){if(typeof u!=="string")return null;if(u.indexOf(O+"/")===0)u=u.slice(O.length);return u.charAt(0)==="/"&&u.charAt(1)!=="/"?u:null}
function own(p){return p==="/intake"||p.indexOf("/intake/")===0||p.indexOf("/intake?")===0||p.indexOf("/intake#")===0}
function fix(u){var p=rel(u);return p===null||own(p)?u:B+p}
function raw(v){return typeof v==="string"&&v.charAt(0)==="/"&&v.charAt(1)!=="/"?v:null}
M.fix=fix;M.href=function(u){var p=rel(u);return p===null||own(p)?u:M.home+p};
var f=window.fetch;if(f)window.fetch=function(i,o){try{if(typeof i==="string")i=fix(i);else if(i instanceof URL)i=fix(i.href);else if(i&&i.url&&rel(i.url)!==null&&!own(rel(i.url)))i=new Request(fix(i.url),i)}catch(e){}return f.call(this,i,o)};
var sb=navigator.sendBeacon;if(sb)navigator.sendBeacon=function(u,d){return sb.call(navigator,fix(String(u)),d)};
var xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=fix(String(u));return xo.apply(this,arguments)};
var sa=Element.prototype.setAttribute,A={src:1,srcset:1,poster:1,"data-src":1};
Element.prototype.setAttribute=function(n,v){var t=this.tagName;if(typeof v==="string"){var k=String(n).toLowerCase();if(A[k])v=k==="srcset"?v.replace(/(^|,\\s*)(\\/[^\\/\\s][^\\s,]*)/g,function(_,a,p){return a+fix(p)}):fix(v);else if(k==="href"&&(t==="LINK"||t==="IMAGE"||t==="USE"))v=fix(v)}return sa.call(this,n,v)};
["src"].forEach(function(p){[HTMLImageElement,HTMLScriptElement,HTMLSourceElement,HTMLVideoElement,HTMLAudioElement,HTMLIFrameElement].forEach(function(C){var d=C&&Object.getOwnPropertyDescriptor(C.prototype,p);if(d&&d.set)Object.defineProperty(C.prototype,p,{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){d.set.call(this,typeof v==="string"?fix(v):v)}})})});
var ps=history.pushState,rs=history.replaceState;function nav(o){return function(s,t,u){if(u!=null){var p=rel(String(u));if(p!==null&&!own(p)){location.href=M.home+p;return}}return o.apply(history,arguments)}}history.pushState=nav(ps);history.replaceState=nav(rs);
document.addEventListener("click",function(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a||a.hasAttribute("download")||a.hasAttribute("data-mirror-keep"))return;var p=raw(a.getAttribute("href"));if(p===null||own(p))return;e.preventDefault();e.stopPropagation();if(a.target==="_blank")window.open(M.home+p,"_blank","noopener");else location.href=M.home+p},true);
function fa(a){if(!a.getAttribute||a.hasAttribute("data-mirror-keep")||a.hasAttribute("download"))return;var p=raw(a.getAttribute("href"));if(p!==null&&!own(p))sa.call(a,"href",M.home+p)}
function sweep(n){if(!n||n.nodeType!==1)return;if(n.tagName==="A")fa(n);if(n.querySelectorAll){var l=n.querySelectorAll("a[href]");for(var i=0;i<l.length;i++)fa(l[i])}}
if(window.MutationObserver)new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==="attributes")fa(m.target);else for(var j=0;j<m.addedNodes.length;j++)sweep(m.addedNodes[j])}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["href"]});
document.addEventListener("DOMContentLoaded",function(){sweep(document.documentElement)});
var wo=window.open;window.open=function(u){if(typeof u==="string")arguments[0]=M.href(u);return wo.apply(window,arguments)};
})();</script>`;
}

/** Rewrite the shell for the mirror: boot script first, root-relative assets through the prefix, links to Birch. */
export function mirrorHtml(html: string, src: string): string {
  const pre = (v: string) => (v.startsWith("/") && !v.startsWith("//") && !/^\/intake(?:[/?#]|$)/.test(v) ? `${MIRROR_PREFIX}${v}` : v);
  let out = html.replace(/<(script|link|img|source|video|iframe)\b[^>]*>/gi, (tag) =>
    tag.replace(/\s(src|href|poster)="([^"]*)"/gi, (_m, k: string, v: string) => ` ${k}="${pre(v)}"`),
  );
  out = out.replace(/<a\b[^>]*>/gi, (tag) =>
    tag.replace(/\shref="(\/(?!\/)[^"]*)"/i, (m, v: string) => (/^\/intake(?:[/?#]|$)/.test(v) ? m : ` href="${PUBLIC_SITE_ORIGIN}${v}"`)),
  );
  if (MIRROR_SKINS[src] === "scale") out = scaleHead(out);
  const boot = mirrorBootScript(src);
  return /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (h) => `${h}\n${boot}`) : `${boot}${out}`;
}

/** Re-brand the shell head for the Scale skin: titles, favicon, theme colour, Scale's typeface. Canonical/og:url stay Birch's. */
export function scaleHead(html: string): string {
  const rename = (v: string) => v.replace(/Birch Reserve/g, "Scale Health");
  let out = html.replace(/<title>([^<]*)<\/title>/i, (_m, t: string) => `<title>${rename(t)}</title>`);
  out = out.replace(/<meta\b[^>]*(?:property|name)="(?:og:title|twitter:title|og:site_name)"[^>]*>/gi, (tag) => rename(tag));
  out = out.replace(/<meta name="theme-color" content="[^"]*"\s*\/?>/i, '<meta name="theme-color" content="#0d1426" />');
  out = out.replace(/<link\b[^>]*rel="icon"[^>]*>/gi, `<link rel="icon" type="image/svg+xml" href="${MIRROR_PREFIX}${SCALE_FAVICON}" />`);
  out = out.replace(/<\/head>/i, `<link href="${SCALE_FONT_HREF}" rel="stylesheet">\n</head>`);
  return out;
}

export function mirrorTagOf(req: Request): string | null {
  const raw = req.query?.br_mirror;
  const tag = typeof raw === "string" ? raw.toLowerCase() : "";
  return Object.prototype.hasOwnProperty.call(MIRROR_TAGS, tag) ? MIRROR_TAGS[tag]! : null;
}

export function mirrorHost() {
  return (req: Request, res: Response, next: NextFunction) => {
    const stripped = stripMirrorPrefix(req.url);
    if (stripped !== null) req.url = stripped;
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const src = MIRROR_PAGE_RE.test(req.path) ? mirrorTagOf(req) : null;
    if (!src) return next();
    const send = res.send.bind(res);
    res.send = ((body: unknown) => {
      const html = typeof body === "string" ? body : Buffer.isBuffer(body) && /html/i.test(String(res.getHeader("Content-Type") ?? "")) ? body.toString("utf8") : null;
      if (html === null || !/<\/head>/i.test(html)) return send(body as never);
      // The mirror shell differs from Birch's: never share it from a cache.
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return send(mirrorHtml(html, src));
    }) as Response["send"];
    next();
  };
}
