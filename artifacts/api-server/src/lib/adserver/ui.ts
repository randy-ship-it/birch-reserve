/** Shared HTML shell, helpers and the tiny form script for /account, /ads/admin and /ads/docs. */
import { MICROS } from "./config";
import { TOKENS_CSS } from "../brandTokens";

export function esc(v: unknown): string {
  return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtMoney = (micros: number, cur: string) => {
  const v = micros / MICROS;
  const d = v !== 0 && Math.abs(v) < 1 ? 4 : 2; // sub-dollar ledger lines (single impressions) keep their cents
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} ${cur.toUpperCase()}`;
};
export const fmtPct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(2)}%` : "–");
export const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "short", day: "numeric" }) : "–");
export const fmtDateTime = (d: Date | null) => (d ? d.toLocaleString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "–");
export const isoDay = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

const CSS = `${TOKENS_CSS}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--br-bg);color:var(--br-ink);font:14px/1.5 var(--br-sans)}
a{color:var(--br-ink)}header.top{position:sticky;top:0;z-index:30;background:rgba(249,248,246,.96);backdrop-filter:blur(6px);border-bottom:1px solid var(--br-line)}
.wrap{max-width:1180px;margin:0 auto;padding:0 22px}header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:56px;flex-wrap:wrap}
.logo{font-weight:600;letter-spacing:.16em;font-size:13px;text-decoration:none;white-space:nowrap}.logo span{color:var(--br-ink-3);font-weight:500;letter-spacing:.06em;margin-left:8px}
nav.tabs{display:flex;gap:2px;flex-wrap:wrap;align-items:center}nav.tabs a{display:inline-flex;align-items:center;min-height:40px;padding:0 10px;border-radius:var(--br-r-ctl);text-decoration:none;font-size:14px;color:var(--br-ink-2)}nav.tabs a:hover{background:#EEECE6;color:var(--br-ink)}
h1,h2,h3{font-weight:600;line-height:1.2;margin:.2em 0 .4em;letter-spacing:-.005em}h1{font:400 28px/1.15 var(--br-serif);letter-spacing:0}h2{font-size:20px;margin-top:1.4em}h3{font-size:16px}
.lede{font-size:16px;color:var(--br-ink-2);max-width:760px}.fine{color:var(--br-ink-3);font-size:13px}.muted{color:var(--br-ink-3)}
.grid{display:grid;gap:12px}.k{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.two{grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}
.card{background:var(--br-surface);border:1px solid var(--br-line);border-radius:var(--br-r-card);padding:14px 16px}
.kpi{padding:12px 14px}.kpi span{display:block;font-size:12px;letter-spacing:.04em;color:var(--br-ink-3);font-weight:600;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi b{display:block;font:600 22px/1.2 var(--br-sans);font-variant-numeric:tabular-nums;margin-top:4px}.kpi small{display:block;color:var(--br-ink-3);font-size:12px;margin-top:2px}
.chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:1px solid transparent;white-space:nowrap;line-height:1.5}
.c-active,.c-on_pace,.c-approved{background:#dff5e6;color:#0b6b43;border-color:#b8e6c8}.c-draft,.c-pending,.c-not_started,.c-calculated{background:#fff4db;color:#8a5a00;border-color:#f1d58f}
.c-paused,.c-rejected{background:#f6e3e1;color:#8a2b1f;border-color:#ecc4bf}.c-completed,.c-ended,.c-spent{background:#e7eaf0;color:#33465e;border-color:#cfd5df}.c-behind{background:#fde9cf;color:#8a4b00;border-color:#f3cf9b}.c-ahead{background:#e2ecff;color:#1d3f8a;border-color:#c3d4fa}.c-test{background:var(--br-ink);color:#fff}
.bar{position:relative;height:8px;border-radius:999px;background:#ECEAE3;overflow:hidden;margin:6px 0 2px}.bar i{position:absolute;left:0;top:0;bottom:0;background:var(--br-ink);border-radius:999px}.bar em{position:absolute;top:-3px;bottom:-3px;width:2px;background:#9fd13a}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:8px 10px;border-bottom:1px solid var(--br-line-soft);text-align:left;vertical-align:top}tbody tr:last-child td{border-bottom:0}tbody tr:hover td{background:#FBFAF7}
th{font-size:12px;font-weight:600;color:var(--br-ink-2);background:var(--br-head);position:sticky;top:0;z-index:1;white-space:nowrap;letter-spacing:.02em}td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}td.when,.tw td.fine:first-child{white-space:nowrap}
.tw{overflow:auto;border:1px solid var(--br-line);border-radius:var(--br-r-card);background:var(--br-surface);max-height:560px}
.btn,button{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--br-ink);color:#fff;border:1px solid var(--br-ink);border-radius:var(--br-r-ctl);padding:0 14px;font:600 14px var(--br-sans);cursor:pointer;text-decoration:none;min-height:40px;white-space:nowrap}
.btn.ghost,button.ghost{background:var(--br-surface);color:var(--br-ink);border-color:#B9C1C9}.btn.ghost:hover,button.ghost:hover{border-color:var(--br-ink)}.btn.green{background:var(--br-accent);border-color:var(--br-accent);color:var(--br-ink)}button.sm,.btn.sm{padding:0 12px;min-height:36px;font-size:13px}button.danger{background:#8a2b1f;border-color:#8a2b1f}
form.f{display:grid;gap:10px}form.f>button,form.f>.btn,form.f>a.btn{justify-self:start}label{display:grid;gap:4px;font-size:13px;font-weight:600;color:var(--br-ink-2)}
input,select,textarea{font:inherit;font-size:14px;min-height:40px;padding:8px 10px;border:1px solid #B9C1C9;border-radius:var(--br-r-ctl);background:#fff;color:var(--br-ink);width:100%;min-width:0}input:focus,select:focus,textarea:focus{outline:2px solid var(--br-accent);outline-offset:1px;border-color:var(--br-ink)}
input[type=checkbox],input[type=radio]{width:18px;height:18px;min-height:0;accent-color:var(--br-ink)}.row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))}.checks{display:flex;flex-wrap:wrap;gap:4px 16px;font-weight:500}.checks label{display:flex;gap:8px;align-items:center;font-weight:500;min-height:36px}
details.ed{margin-top:8px}details.ed>summary{cursor:pointer;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border:1px solid #B9C1C9;border-radius:var(--br-r-ctl);background:var(--br-surface);list-style:none}details.ed>summary::-webkit-details-marker{display:none}details.ed>summary::before{content:"✎";font-size:12px;color:var(--br-ink-3)}
.steps{list-style:none;padding:0;margin:8px 0;display:grid;gap:6px}.steps li{display:flex;gap:10px;align-items:flex-start}.steps li b{flex:0 0 24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:#ECEAE3}.steps li.done b{background:var(--br-accent)}
.empty{border:1px dashed #C7CDBF;border-radius:var(--br-r-card);padding:14px 16px;background:#FBFAF6;color:var(--br-ink-2)}
pre{background:var(--br-ink);color:#e9f0ff;border-radius:var(--br-r-card);padding:12px 14px;overflow:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all}code{font-family:var(--br-mono);font-size:.86em}
.toast{position:fixed;right:18px;bottom:18px;background:var(--br-ink);color:#fff;padding:10px 14px;border-radius:var(--br-r-card);font-weight:600;z-index:80;display:none;max-width:420px}
.spark{display:block;width:100%;height:64px}.legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--br-ink-3)}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.notice{background:var(--br-ink);color:var(--br-bg);border-radius:var(--br-r-card);padding:10px 14px;font-size:14px}.ok{background:#dff5e6;color:#0b6b43;border-radius:var(--br-r-card);padding:10px 14px}.warn{background:#fff4db;color:#6b4700;border-radius:var(--br-r-card);padding:10px 14px}
section{scroll-margin-top:80px}footer{margin:40px 0 24px}
.br-drawer-bg{position:fixed;inset:0;background:rgba(7,26,57,.32);z-index:60;display:none}.br-drawer-bg.on{display:block}
details.ed[open]>.drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);background:var(--br-surface);z-index:70;box-shadow:-12px 0 32px rgba(7,26,57,.18);overflow:auto;padding:0 20px 24px;display:grid;align-content:start;gap:12px}
.drawer .dh{position:sticky;top:0;background:var(--br-surface);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 0 10px;border-bottom:1px solid var(--br-line);z-index:2}.drawer .dh b{font-size:16px}.drawer .pv{background:var(--br-head);border-radius:var(--br-r-card);padding:10px 12px;font-size:13px;font-variant-numeric:tabular-nums}
@media(max-width:640px){header.top{position:static}.wrap{padding:0 14px}th,td{padding:7px 8px}
.tw.stack{overflow:visible;max-height:none;border:0;background:none}.tw.stack table,.tw.stack tbody,.tw.stack tr,.tw.stack td{display:block;width:100%}.tw.stack thead{display:none}
.tw.stack tr{background:var(--br-surface);border:1px solid var(--br-line);border-radius:var(--br-r-card);margin:0 0 8px;padding:6px 0}.tw.stack td{border:0;position:relative;padding:5px 12px 5px calc(36% + 12px);min-height:30px;text-align:left!important;white-space:normal!important;overflow-wrap:anywhere}
.tw.stack td::before{content:attr(data-label);position:absolute;left:12px;top:6px;width:calc(36% - 8px);font-size:12px;font-weight:600;color:var(--br-ink-3);overflow-wrap:anywhere}.tw.stack td[data-label=""],.tw.stack td[colspan]{padding-left:12px}.tw.stack td[data-label=""]::before,.tw.stack td[colspan]::before{display:none}}`;

export const FORM_JS = `(function(){
  var t=document.getElementById("toast");function toast(m){if(!t)return;t.textContent=m;t.style.display="block";clearTimeout(t._h);t._h=setTimeout(function(){t.style.display="none"},4200)}
  window.brToast=toast;
  document.addEventListener("submit",function(e){var f=e.target;if(!f.matches("form[data-post]"))return;e.preventDefault();
    var data={};new FormData(f).forEach(function(v,k){if(v instanceof File)return;if(k.slice(-2)==="[]"){k=k.slice(0,-2);(data[k]=data[k]||[]).push(v)}else data[k]=v});
    f.querySelectorAll("input[type=checkbox][name]").forEach(function(c){if(c.name.slice(-2)!=="[]")data[c.name]=c.checked});
    var b=f.querySelector("button[type=submit],button:not([type])");if(b){b.disabled=true}
    var file=f.querySelector("input[type=file]");var url=f.getAttribute("data-post");var p;
    if(file&&file.files&&file.files[0]){var q=Object.keys(data).map(function(k){return encodeURIComponent(k)+"="+encodeURIComponent(data[k])}).join("&");p=fetch(url+(url.indexOf("?")<0?"?":"&")+q,{method:"POST",headers:{"content-type":file.files[0].type||"application/octet-stream"},body:file.files[0],credentials:"same-origin"})}
    else p=fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data),credentials:"same-origin"});
    p.then(function(r){return r.json().catch(function(){return{}}).then(function(j){return{ok:r.ok,j:j}})}).then(function(x){
      if(b)b.disabled=false;var j=x.j||{};
      if(j.copy){try{navigator.clipboard.writeText(j.copy)}catch(e){};var o=f.querySelector("[data-out]");if(o){o.textContent=j.copy;o.style.display="block"}}
      toast(j.message||(x.ok?"Saved":"Something went wrong"));
      if(x.ok&&j.redirect){location.href=j.redirect;return}
      if(x.ok&&f.hasAttribute("data-reload"))setTimeout(function(){location.reload()},600);
    }).catch(function(){if(b)b.disabled=false;toast("Network error. Try again.")})
  });
  document.addEventListener("click",function(e){var c=e.target.closest("[data-copy]");if(!c)return;var el=document.querySelector(c.getAttribute("data-copy"));if(!el)return;try{navigator.clipboard.writeText(el.textContent);toast("Copied")}catch(x){}});

  function stack(){document.querySelectorAll(".tw").forEach(function(w){var t=w.querySelector("table");if(!t||w.classList.contains("nostack"))return;var hs=t.querySelectorAll("thead th");if(!hs.length)return;var L=[].map.call(hs,function(h){return h.textContent.trim()});
    t.querySelectorAll("tbody tr").forEach(function(r){var i=0;[].forEach.call(r.children,function(c){if(!c.hasAttribute("data-label"))c.setAttribute("data-label",c.hasAttribute("colspan")?"":(L[i]||""));i+=Number(c.getAttribute("colspan")||1)})});w.classList.add("stack")})}
  var bg=document.createElement("div");bg.className="br-drawer-bg";document.body.appendChild(bg);
  function closeAll(except){document.querySelectorAll("details.ed[open]").forEach(function(d){if(d!==except&&!(except&&d.contains(except)))d.open=false})}
  function money(v){return "$"+v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
  function preview(f){var o=f.querySelector("[name=overridePct]");if(!o)return;var h=f.querySelector("[name=hubPct]");var p=document.createElement("p");p.className="pv";p.setAttribute("aria-live","polite");f.insertBefore(p,f.querySelector("button[type=submit]")||null);
    function u(){var op=parseFloat(o.value||o.placeholder);var hp=h?parseFloat(h.value||h.placeholder||f.getAttribute("data-hub-pct")):parseFloat(f.getAttribute("data-hub-pct"));if(isNaN(op)||isNaN(hp)){p.textContent="Enter rates to preview the split on $1,000 collected.";return}var ov=1000*op/100,net=1000-ov,hub=net*hp/100;p.textContent="On $1,000 collected: override "+money(ov)+" · net "+money(net)+" · hub "+money(hub)+" · kept "+money(net-hub)+" (preview only; saves nothing)"}
    o.addEventListener("input",u);if(h)h.addEventListener("input",u);u()}
  function drawers(){document.querySelectorAll("details.ed").forEach(function(d){if(d.querySelector(":scope>.drawer"))return;var s=d.querySelector(":scope>summary");if(!s)return;var w=document.createElement("div");w.className="drawer";w.setAttribute("role","dialog");w.setAttribute("aria-label",s.textContent.trim());
    var hd=document.createElement("div");hd.className="dh";var b=document.createElement("b");b.textContent=s.getAttribute("data-title")||s.textContent.trim();var x=document.createElement("button");x.type="button";x.className="ghost sm";x.textContent="Close";x.addEventListener("click",function(){d.open=false});hd.appendChild(b);hd.appendChild(x);w.appendChild(hd);
    while(s.nextSibling)w.appendChild(s.nextSibling);d.appendChild(w);w.querySelectorAll("form").forEach(preview);
    d.addEventListener("toggle",function(){if(d.open){closeAll(d);bg.classList.add("on");document.documentElement.style.overflow="hidden";var i=w.querySelector("input:not([type=hidden]),select,textarea");if(i)try{i.focus({preventScroll:true})}catch(e){}}else if(!document.querySelector("details.ed[open]")){bg.classList.remove("on");document.documentElement.style.overflow=""}})})}
  bg.addEventListener("click",function(){closeAll(null)});document.addEventListener("keydown",function(e){if(e.key==="Escape")closeAll(null)});
  function boot(){stack();drawers()}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();`;

export function shell(o: { title: string; nav?: string; right?: string; body: string; robots?: string; brand?: string; home?: string; head?: string; footer?: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><meta name="robots" content="${o.robots ?? "noindex,nofollow"}">${o.head ?? ""}<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="logo" href="${esc(o.home ?? "/")}">${esc(o.brand ?? "BIRCH RESERVE")}<span>${esc(o.nav ?? "")}</span></a>${o.right ?? ""}</div></header>
<main class="wrap">${o.body}</main>
<footer class="wrap fine">${o.footer ?? `Birch Reserve, a Silver Birch Growth company · <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · Aggregate reporting only. No impression guarantees.`}</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div><script>${FORM_JS}</script></body></html>`;
}

/** Daily bars (views) with a click line, from real rows only. */
export function sparkline(days: Array<{ day: string; views: number; clicks: number }>, n = 30): string {
  if (days.length === 0) return `<p class="fine">No delivery yet.</p>`;
  const map = new Map(days.map((d) => [d.day, d]));
  const out: Array<{ day: string; views: number; clicks: number }> = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    out.push(map.get(day) ?? { day, views: 0, clicks: 0 });
  }
  const maxV = Math.max(1, ...out.map((d) => d.views));
  const maxC = Math.max(1, ...out.map((d) => d.clicks));
  const w = 600;
  const h = 64;
  const bw = w / out.length;
  const bars = out.map((d, i) => `<rect x="${(i * bw + 1).toFixed(1)}" y="${(h - (d.views / maxV) * (h - 6)).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${((d.views / maxV) * (h - 6)).toFixed(1)}" rx="2" fill="#071A39" opacity=".85"><title>${d.day}: ${d.views} viewable, ${d.clicks} clicks</title></rect>`).join("");
  const pts = out.map((d, i) => `${(i * bw + bw / 2).toFixed(1)},${(h - (d.clicks / maxC) * (h - 6) - 1).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Last ${n} days of delivery">${bars}<polyline points="${pts}" fill="none" stroke="#9fd13a" stroke-width="2"/></svg>
<div class="legend"><span><i style="background:#071A39"></i>Viewable impressions / day</span><span><i style="background:#9fd13a"></i>Clicks / day</span><span>Last ${n} days</span></div>`;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    const s = v instanceof Date ? v.toISOString() : String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}
