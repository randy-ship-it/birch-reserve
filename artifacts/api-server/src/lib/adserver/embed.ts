/**
 * Browser scripts served by the API.
 *   /ads/embed.js  renders approved paid creatives into [data-br-slot] elements, else leaves the house card as is.
 *   /ads/px.js     brand cart / thank-you page conversion tag (window.brpx).
 * Privacy: Do Not Track or Global Privacy Control → no visitor id is created or sent, no view history is kept and the
 * pixel sends nothing. The visitor id is a random string in the host site's own localStorage (no cookies), hashed
 * server-side with a daily salt for frequency caps and never stored raw. No names, emails or IPs are collected.
 */
import { VIEWABILITY } from "./config";
import { FORMATS, VIDEO_VIEWABILITY_MS } from "./creativeSpec";

export const EMBED_JS = `/*! Birch Reserve ad embed v2 · https://birchreserve.net/ads/hub-kit · specs: /ads/specs */
(function(){
  if (window.__brAds) { window.__brAds.scan(); return; }
  var d = document, w = window, me = d.currentScript;
  var API = (me && me.src) ? me.src.replace(/\\/ads\\/embed\\.js.*$/, "") : "https://birchreserve.net";
  var TEST = !!(me && me.getAttribute("data-test") === "1") || /[?&]br_ads=test(&|$)/.test(location.search);
  var FORMATS = ${JSON.stringify(Object.fromEntries(FORMATS.map((f) => [f.key, f.size])))};
  var dnt = navigator.doNotTrack === "1" || w.doNotTrack === "1" || navigator.msDoNotTrack === "1" || navigator.globalPrivacyControl === true;
  function store(){ try { var k = "__br_t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } }
  var ls = dnt ? null : store();
  function rid(){ var a = new Uint8Array(16); (w.crypto || w.msCrypto).getRandomValues(a); var s = ""; for (var i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2); return s; }
  function vid(){ if (!ls) return ""; var v = ls.getItem("br_ads_vid"); if (!v) { v = rid(); ls.setItem("br_ads_vid", v); } return v; }
  function remember(id, campaign){ if (!ls) return; try { var a = JSON.parse(ls.getItem("br_ads_views") || "[]"); var now = Date.now(); a = a.filter(function(x){ return now - x.at < 7 * 864e5; }); a.unshift({ id: id, c: campaign, at: now }); ls.setItem("br_ads_views", JSON.stringify(a.slice(0, 20))); } catch (e) {} }
  function ping(url){ try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) {} var i = new Image(); i.src = url + "&b=" + Date.now(); }
  function viewable(el, ms, cb){
    if (!("IntersectionObserver" in w)) return;
    var timer = null, done = false;
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var on = e.isIntersecting && e.intersectionRatio >= ${VIEWABILITY.ratio} && d.visibilityState === "visible";
        if (on && !timer && !done) timer = setTimeout(function(){ done = true; io.disconnect(); cb(); }, ms);
        if (!on && timer) { clearTimeout(timer); timer = null; }
      });
    }, { threshold: [0, ${VIEWABILITY.ratio}, 1] });
    io.observe(el);
    d.addEventListener("visibilitychange", function(){ if (d.visibilityState !== "visible" && timer) { clearTimeout(timer); timer = null; } });
  }
  function sizes(el, ad){ var cw = el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || ad.creative.width; return Math.round(Math.min(cw, ad.creative.width)) + "px"; }
  function reduced(){ try { return w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function stillImg(src, ad){
    var img = d.createElement("img"); img.src = src; img.alt = ad.creative.alt; img.width = ad.creative.width; img.height = ad.creative.height; img.loading = "lazy"; img.decoding = "async";
    img.style.cssText = "display:block;width:100%;height:auto;max-width:100%;aspect-ratio:" + ad.creative.width + "/" + ad.creative.height + ";";
    return img;
  }
  function media(el, ad){
    var c = ad.creative;
    if (c.kind === "video") {
      var v = d.createElement("video"); v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.playsInline = true; v.setAttribute("playsinline", ""); v.loop = true; v.preload = "metadata";
      v.setAttribute("disablepictureinpicture", ""); v.setAttribute("aria-label", c.alt); v.width = c.width; v.height = c.height;
      if (c.poster) v.poster = c.poster;
      if (!reduced()) { v.autoplay = true; v.setAttribute("autoplay", ""); }
      v.style.cssText = "display:block;width:100%;height:auto;max-width:100%;aspect-ratio:" + c.width + "/" + c.height + ";object-fit:cover;background:#071A39;";
      var s = d.createElement("source"); s.src = c.src; s.type = c.mime || "video/mp4"; v.appendChild(s);
      return { node: v, ready: "loadeddata", err: s, fallback: c.poster ? function(){ return stillImg(c.poster, ad); } : null, ms: ${VIDEO_VIEWABILITY_MS} };
    }
    var img = stillImg(c.src, ad);
    var groups = {}; (c.sources || []).forEach(function(x){ (groups[x.type] = groups[x.type] || []).push(x.src + " " + x.width + "w"); });
    var types = ["image/avif", "image/webp"].filter(function(t){ return groups[t]; });
    if (!types.length) return { node: img, ready: "load", err: img, ms: ${VIEWABILITY.ms} };
    var pic = d.createElement("picture"); var sz = sizes(el, ad);
    types.forEach(function(t){ var so = d.createElement("source"); so.type = t; so.srcset = groups[t].join(", "); so.sizes = sz; pic.appendChild(so); });
    pic.appendChild(img);
    return { node: pic, img: img, ready: "load", err: img, ms: ${VIEWABILITY.ms} };
  }
  function render(el, ad){
    var box = d.createElement("div"); box.className = "br-ad"; box.setAttribute("data-br-fill", "paid"); if (ad.creative.format) box.setAttribute("data-br-format", ad.creative.format);
    box.style.cssText = "position:relative;display:block;max-width:100%;";
    var a = d.createElement("a"); a.href = ad.click; a.target = "_blank"; a.rel = "sponsored noopener"; a.style.cssText = "display:block;line-height:0;border-radius:12px;overflow:hidden;";
    var m = media(el, ad);
    a.appendChild(m.node); box.appendChild(a);
    var c = ad.creative;
    if ((c.headline || c.cta) && el.getAttribute("data-br-text") !== "off") {
      var row = d.createElement("a"); row.href = ad.click; row.target = "_blank"; row.rel = "sponsored noopener";
      row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;text-decoration:none;color:#071A39;font:500 14px/1.35 system-ui,sans-serif;";
      var h = d.createElement("span"); h.textContent = c.headline || ""; row.appendChild(h);
      if (c.cta) { var b = d.createElement("span"); b.textContent = c.cta; b.style.cssText = "flex:none;background:#071A39;color:#fff;border-radius:999px;padding:5px 12px;font:600 12px/1.2 system-ui,sans-serif;"; row.appendChild(b); }
      box.appendChild(row);
    }
    var lab = d.createElement("div"); lab.textContent = ad.label + (ad.test ? " · TEST" : ""); lab.style.cssText = "font:600 10px/1.4 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#5b6776;margin-top:4px;";
    box.appendChild(lab);
    var house = [].slice.call(el.childNodes), shown = false;
    function show(){ if (shown) return; shown = true; house.forEach(function(n){ if (n.style) n.style.display = "none"; else if (n.parentNode) n.parentNode.removeChild(n); }); el.style.aspectRatio = ""; el.setAttribute("data-br-state", "paid"); viewable(box, m.ms, function(){ ping(ad.view); remember(ad.id, ad.campaign); }); }
    function fail(){ if (shown) return; if (m.fallback) { var still = m.fallback(); a.replaceChild(still, m.node); m.fallback = null; m.node = still; still.onload = show; still.onerror = fail; return; } if (box.parentNode) box.parentNode.removeChild(box); house_(el); }
    (m.img || m.node).addEventListener(m.ready, show);
    m.err.addEventListener("error", fail);
    el.appendChild(box);
  }
  function house_(el){ el.setAttribute("data-br-state", "house"); el.style.aspectRatio = ""; }
  function fill(el){
    if (el.getAttribute("data-br-state")) return;
    el.setAttribute("data-br-state", "loading");
    var slot = el.getAttribute("data-br-slot");
    var fmt = (el.getAttribute("data-br-format") || "").replace(/[^a-z_,]/g, "");
    var f0 = FORMATS[fmt.split(",")[0]];
    if (f0 && el.hasAttribute("data-br-reserve")) el.style.aspectRatio = f0[0] + "/" + f0[1];
    var q = "slot=" + encodeURIComponent(slot) + (fmt ? "&fmt=" + fmt : "") + (TEST || el.getAttribute("data-br-test") === "1" ? "&test=1" : "") + (dnt ? "&dnt=1" : "&v=" + vid());
    fetch(API + "/v1/ads/serve?" + q, { credentials: "omit", mode: "cors" }).then(function(r){ return r.json(); }).then(function(ad){
      if (!ad || !ad.fill) { house_(el); return; }
      render(el, ad);
    }).catch(function(){ house_(el); });
  }
  function scan(){ [].forEach.call(d.querySelectorAll("[data-br-slot]"), fill); }
  w.__brAds = { scan: scan };
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", scan); else scan();
  if ("MutationObserver" in w) new MutationObserver(function(){ scan(); }).observe(d.documentElement, { childList: true, subtree: true });
})();
`;

export const PIXEL_JS = `/*! Birch Reserve conversion pixel v1 · https://birchreserve.net/ads/docs#pixel */
(function(){
  var w = window, d = document, me = d.currentScript;
  var API = (me && me.src) ? me.src.replace(/\\/ads\\/px\\.js.*$/, "") : "https://birchreserve.net";
  var dnt = navigator.doNotTrack === "1" || w.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  var ls = null; try { ls = dnt ? null : w.localStorage; } catch (e) {}
  var q = (w.brpx && w.brpx.q) || [];
  var pixel = (me && me.getAttribute("data-pixel")) || "";
  // Landing from an ad: keep the click id (first-party, this site only) for the attribution window.
  try { var m = /[?&]br_click=([A-Za-z0-9_-]{10,40})/.exec(location.search); if (m && ls) ls.setItem("br_ads_click", JSON.stringify({ id: m[1], at: Date.now() })); } catch (e) {}
  function click(){ try { var c = JSON.parse((ls && ls.getItem("br_ads_click")) || "null"); return c && Date.now() - c.at < 30 * 864e5 ? c.id : ""; } catch (e) { return ""; } }
  function views(){ try { var a = JSON.parse((ls && ls.getItem("br_ads_views")) || "[]"); return a.map(function(x){ return x.id; }).slice(0, 10).join(","); } catch (e) { return ""; } }
  function send(ev, p){
    if (dnt || !pixel) return;
    p = p || {};
    var u = API + "/v1/ads/px?p=" + encodeURIComponent(pixel) + "&e=" + encodeURIComponent(ev) + "&ck=" + click() + "&vw=" + views() +
      (p.value != null ? "&val=" + encodeURIComponent(p.value) : "") + (p.currency ? "&cur=" + encodeURIComponent(p.currency) : "") + (p.order_id ? "&oid=" + encodeURIComponent(p.order_id) : "");
    try { if (navigator.sendBeacon && navigator.sendBeacon(u)) return; } catch (e) {}
    var i = new Image(); i.src = u;
  }
  function brpx(cmd, a, b){ if (cmd === "init") pixel = a || pixel; else if (cmd === "conversion" || cmd === "track") send(cmd === "track" ? (a || "conversion") : "conversion", cmd === "track" ? b : a); }
  w.brpx = brpx;
  for (var i = 0; i < q.length; i++) brpx.apply(null, q[i]);
})();
`;
