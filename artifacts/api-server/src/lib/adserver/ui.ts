/** Shared HTML shell, helpers and the tiny form script for /account, /ads/admin and /ads/docs. */
import { MICROS } from "./config";

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

const CSS = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:#F9F8F6;color:#071A39;font:15px/1.55 "IBM Plex Sans",system-ui,sans-serif}
a{color:#071A39}header.top{position:sticky;top:0;z-index:10;background:rgba(249,248,246,.95);backdrop-filter:blur(6px);border-bottom:1px solid #d8dccf}
.wrap{max-width:1180px;margin:0 auto;padding:0 22px}header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:60px;flex-wrap:wrap}
.logo{font-weight:600;letter-spacing:.16em;font-size:.82rem;text-decoration:none}.logo span{opacity:.55;font-weight:500;letter-spacing:.06em;margin-left:8px}
nav.tabs{display:flex;gap:4px;flex-wrap:wrap}nav.tabs a{padding:6px 11px;border-radius:999px;text-decoration:none;font-size:.86rem;color:#33465e}nav.tabs a:hover{background:#ece9de}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.15;margin:.2em 0 .35em}h1{font-size:clamp(1.9rem,4vw,2.6rem)}h2{font-size:1.45rem;margin-top:1.6em}h3{font-size:1.12rem}
.lede{font-size:1.04rem;color:#33465e;max-width:760px}.fine{color:#566476;font-size:.84rem}.muted{color:#566476}
.grid{display:grid;gap:12px}.k{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.two{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.card{background:#fff;border:1px solid #d9ddd2;border-radius:16px;padding:16px 18px}.kpi b{display:block;font:600 1.55rem/1.15 Fraunces,serif;margin-top:2px}.kpi span{font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:#566476;font-weight:600}
.kpi small{display:block;color:#566476;font-size:.8rem;margin-top:2px}
.chip{display:inline-block;padding:2px 9px;border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:1px solid transparent;white-space:nowrap}
.c-active,.c-on_pace,.c-approved{background:#dff5e6;color:#0b6b43;border-color:#b8e6c8}.c-draft,.c-pending,.c-not_started,.c-calculated{background:#fff4db;color:#8a5a00;border-color:#f1d58f}
.c-paused,.c-rejected{background:#f6e3e1;color:#8a2b1f;border-color:#ecc4bf}.c-completed,.c-ended,.c-spent{background:#e7eaf0;color:#33465e;border-color:#cfd5df}.c-behind{background:#fde9cf;color:#8a4b00;border-color:#f3cf9b}.c-ahead{background:#e2ecff;color:#1d3f8a;border-color:#c3d4fa}.c-test{background:#071A39;color:#fff}
.bar{position:relative;height:10px;border-radius:999px;background:#ece9de;overflow:hidden;margin:6px 0 2px}.bar i{position:absolute;left:0;top:0;bottom:0;background:#071A39;border-radius:999px}.bar em{position:absolute;top:-3px;bottom:-3px;width:2px;background:#9fd13a}
table{border-collapse:collapse;width:100%;font-size:.88rem}th,td{padding:8px 10px;border-bottom:1px solid #eceee8;text-align:left;vertical-align:top}th{font-weight:600;color:#33465e;background:#f6f4ec;position:sticky;top:0}td.n,th.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.tw{overflow:auto;border:1px solid #d9ddd2;border-radius:14px;background:#fff;max-height:560px}
.btn,button{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#071A39;color:#fff;border:0;border-radius:999px;padding:10px 16px;font:600 .9rem "IBM Plex Sans",sans-serif;cursor:pointer;text-decoration:none;min-height:40px}
.btn.ghost,button.ghost{background:#fff;color:#071A39;border:1px solid #b9c1c9}.btn.green{background:#9fd13a;color:#071A39}button.sm,.btn.sm{padding:5px 11px;min-height:30px;font-size:.8rem}button.danger{background:#8a2b1f}
form.f{display:grid;gap:10px}label{display:grid;gap:4px;font-size:.84rem;font-weight:600;color:#33465e}input,select,textarea{font:inherit;padding:9px 10px;border:1px solid #b9c1c9;border-radius:9px;background:#fff;color:#071A39;width:100%}
input[type=checkbox]{width:auto}.row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}.checks{display:flex;flex-wrap:wrap;gap:8px 14px;font-weight:500}.checks label{display:flex;gap:6px;align-items:center;font-weight:500}
details.ed{margin-top:8px}details.ed summary{cursor:pointer;font-weight:600;font-size:.85rem}details.ed[open]{background:#fbfaf6;border-radius:12px;padding:10px}
.steps{list-style:none;padding:0;margin:8px 0;display:grid;gap:6px}.steps li{display:flex;gap:10px;align-items:flex-start}.steps li b{flex:0 0 24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:.75rem;background:#ece9de}.steps li.done b{background:#9fd13a}
.empty{border:1px dashed #c7cdbf;border-radius:14px;padding:18px;background:#fbfaf6;color:#33465e}
pre{background:#071A39;color:#e9f0ff;border-radius:12px;padding:14px;overflow:auto;font-size:.8rem;line-height:1.5}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86em}
.toast{position:fixed;right:18px;bottom:18px;background:#071A39;color:#fff;padding:10px 14px;border-radius:12px;font-weight:600;z-index:50;display:none;max-width:420px}
.spark{display:block;width:100%;height:64px}.legend{display:flex;gap:12px;font-size:.76rem;color:#566476}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.notice{background:#071A39;color:#F9F8F6;border-radius:12px;padding:10px 14px;font-size:.88rem}.ok{background:#dff5e6;color:#0b6b43;border-radius:12px;padding:10px 14px}.warn{background:#fff4db;color:#6b4700;border-radius:12px;padding:10px 14px}
section{scroll-margin-top:80px}footer{margin:40px 0 24px}
@media(max-width:640px){header.top{position:static}.wrap{padding:0 14px}th,td{padding:7px 8px}}`;

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
})();`;

export function shell(o: { title: string; nav?: string; right?: string; body: string; robots?: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><meta name="robots" content="${o.robots ?? "noindex,nofollow"}"><link rel="icon" type="image/svg+xml" href="/favicon.svg?v=birch-reserve-3">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<header class="top"><div class="wrap"><a class="logo" href="/">BIRCH RESERVE<span>${esc(o.nav ?? "")}</span></a>${o.right ?? ""}</div></header>
<main class="wrap">${o.body}</main>
<footer class="wrap fine">Birch Reserve, a Silver Birch Growth company · <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · Aggregate reporting only. No impression guarantees.</footer>
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
