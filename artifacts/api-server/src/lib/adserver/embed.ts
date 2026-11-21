/**
 * Browser scripts served by the API.
 *   /ads/embed.js  renders approved paid creatives into [data-br-slot] elements, else leaves the house card as is.
 *   /ads/px.js     brand cart / thank-you page conversion tag (window.brpx).
 * Privacy: Do Not Track or Global Privacy Control → no visitor id is created or sent, no view history is kept and the
 * pixel sends nothing. The visitor id is a random string in the host site's own localStorage (no cookies), hashed
 * server-side with a daily salt for frequency caps and never stored raw. No names, emails or IPs are collected.
 */
import { VIEWABILITY } from "./config";

export const EMBED_JS = `/*! Birch Reserve ad embed v1 · https://birchreserve.net/ads/docs */
(function(){
  if (window.__brAds) { window.__brAds.scan(); return; }
  var d = document, w = window, me = d.currentScript;
  var API = (me && me.src) ? me.src.replace(/\\/ads\\/embed\\.js.*$/, "") : "https://birchreserve.net";
  var TEST = !!(me && me.getAttribute("data-test") === "1");
  var dnt = navigator.doNotTrack === "1" || w.doNotTrack === "1" || navigator.msDoNotTrack === "1" || navigator.globalPrivacyControl === true;
  function store(){ try { var k = "__br_t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } }
  var ls = dnt ? null : store();
  function rid(){ var a = new Uint8Array(16); (w.crypto || w.msCrypto).getRandomValues(a); var s = ""; for (var i = 0; i < a.length; i++) s += ("0" + a[i].toString(16)).slice(-2); return s; }
  function vid(){ if (!ls) return ""; var v = ls.getItem("br_ads_vid"); if (!v) { v = rid(); ls.setItem("br_ads_vid", v); } return v; }
  function remember(id, campaign){ if (!ls) return; try { var a = JSON.parse(ls.getItem("br_ads_views") || "[]"); var now = Date.now(); a = a.filter(function(x){ return now - x.at < 7 * 864e5; }); a.unshift({ id: id, c: campaign, at: now }); ls.setItem("br_ads_views", JSON.stringify(a.slice(0, 20))); } catch (e) {} }
  function ping(url){ try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) {} var i = new Image(); i.src = url + "&b=" + Date.now(); }
  function viewable(el, cb){
    if (!("IntersectionObserver" in w)) return;
    var timer = null, done = false;
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var on = e.isIntersecting && e.intersectionRatio >= ${VIEWABILITY.ratio} && d.visibilityState === "visible";
        if (on && !timer && !done) timer = setTimeout(function(){ done = true; io.disconnect(); cb(); }, ${VIEWABILITY.ms});
        if (!on && timer) { clearTimeout(timer); timer = null; }
      });
    }, { threshold: [0, ${VIEWABILITY.ratio}, 1] });
    io.observe(el);
    d.addEventListener("visibilitychange", function(){ if (d.visibilityState !== "visible" && timer) { clearTimeout(timer); timer = null; } });
  }
  function render(el, ad){
    var box = d.createElement("div"); box.className = "br-ad"; box.setAttribute("data-br-fill", "paid");
    box.style.cssText = "position:relative;display:block;max-width:100%;";
    var a = d.createElement("a"); a.href = ad.click; a.target = "_blank"; a.rel = "sponsored noopener"; a.style.cssText = "display:block;line-height:0;border-radius:12px;overflow:hidden;";
    var img = d.createElement("img"); img.src = ad.creative.src; img.alt = ad.creative.alt; img.width = ad.creative.width; img.height = ad.creative.height; img.loading = "lazy"; img.decoding = "async";
    img.style.cssText = "display:block;width:100%;height:auto;max-width:100%;";
    a.appendChild(img); box.appendChild(a);
    var lab = d.createElement("div"); lab.textContent = ad.label + (ad.test ? " · TEST" : ""); lab.style.cssText = "font:600 10px/1.4 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#5b6776;margin-top:4px;";
    box.appendChild(lab);
    var house = [].slice.call(el.childNodes);
    img.onload = function(){ house.forEach(function(n){ if (n.style) n.style.display = "none"; else if (n.parentNode) n.parentNode.removeChild(n); }); el.setAttribute("data-br-state", "paid"); viewable(box, function(){ ping(ad.view); remember(ad.id, ad.campaign); }); };
    img.onerror = function(){ if (box.parentNode) box.parentNode.removeChild(box); el.setAttribute("data-br-state", "house"); };
    el.appendChild(box);
  }
  function fill(el){
    if (el.getAttribute("data-br-state")) return;
    el.setAttribute("data-br-state", "loading");
    var slot = el.getAttribute("data-br-slot");
    var q = "slot=" + encodeURIComponent(slot) + (TEST || el.getAttribute("data-br-test") === "1" ? "&test=1" : "") + (dnt ? "&dnt=1" : "&v=" + vid());
    fetch(API + "/v1/ads/serve?" + q, { credentials: "omit", mode: "cors" }).then(function(r){ return r.json(); }).then(function(ad){
      if (!ad || !ad.fill) { el.setAttribute("data-br-state", "house"); return; }
      render(el, ad);
    }).catch(function(){ el.setAttribute("data-br-state", "house"); });
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
