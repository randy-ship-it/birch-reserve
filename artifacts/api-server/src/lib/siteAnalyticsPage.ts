/**
 * Live site analytics dashboard (Nov 23 2026). Server sends the admin shell (lib/adserver/ui.ts shell + tokens); the
 * page polls /ads/admin/analytics.json every 5 s and draws everything as inline SVG: no chart library, no layout shift.
 * Phone to desktop: one column under 720 px, a 12-column desk above.
 */
import { esc, shell } from "./adserver/ui";

const CSS = `
.desk{--d-bg:#06142c;--d-panel:#0b1f3a;--d-line:#1d3557;--d-ink:#eef3fa;--d-mute:#8fa3bf;--d-lime:#C8F55A;--d-cyan:#5ad1f5;--d-pink:#f58bd1;--d-amber:#f5c45a;
  background:var(--d-bg);color:var(--d-ink);border-radius:12px;padding:14px;margin:14px 0 22px;font-variant-numeric:tabular-nums}
.desk h2{font:600 12px/1.2 var(--br-sans);letter-spacing:.12em;text-transform:uppercase;color:var(--d-mute);margin:0 0 10px}
.dbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:12px}
.dbar .rng{display:flex;gap:4px;flex-wrap:wrap}.dbar button{min-height:40px;padding:0 14px;border-radius:6px;border:1px solid var(--d-line);background:transparent;color:var(--d-ink);font:600 13px var(--br-sans);cursor:pointer}
.dbar button[aria-pressed=true]{background:var(--d-lime);color:#071A39;border-color:var(--d-lime)}
.pulse{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--d-mute)}.pulse i{width:9px;height:9px;border-radius:50%;background:var(--d-lime);box-shadow:0 0 0 0 rgba(200,245,90,.7);animation:pl 1.6s infinite}
@keyframes pl{70%{box-shadow:0 0 0 9px rgba(200,245,90,0)}100%{box-shadow:0 0 0 0 rgba(200,245,90,0)}}
.dg{display:grid;gap:10px;grid-template-columns:repeat(12,minmax(0,1fr))}
.p{background:var(--d-panel);border:1px solid var(--d-line);border-radius:10px;padding:12px 14px;min-width:0}
.s3{grid-column:span 3}.s4{grid-column:span 4}.s5{grid-column:span 5}.s6{grid-column:span 6}.s7{grid-column:span 7}.s8{grid-column:span 8}.s12{grid-column:span 12}
@media (max-width:1100px){.s3{grid-column:span 6}.s4,.s5,.s7,.s8{grid-column:span 12}.s6{grid-column:span 12}}
@media (max-width:720px){.dg{grid-template-columns:1fr 1fr}.dg>*{grid-column:1/-1!important}.dg>.s3.kv{grid-column:auto!important}.kv b{font-size:26px}.desk{padding:10px;margin:10px -12px 18px;border-radius:0}}
.kv b{display:block;font:600 30px/1.1 var(--br-sans);color:var(--d-ink)}.kv span{font-size:12px;color:var(--d-mute);letter-spacing:.06em;text-transform:uppercase}.kv small{display:block;color:var(--d-mute);font-size:12px;margin-top:2px}
.kv.live b{color:var(--d-lime)}.kv small span,.kv .legend span{text-transform:none;letter-spacing:0;font-size:12px;display:inline}
.rows{display:grid;gap:7px}.row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;font-size:13px;align-items:center}
.row .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--d-ink)}.row .vl{color:var(--d-mute)}.row .tr{grid-column:1/-1;height:6px;border-radius:3px;background:#12294a;overflow:hidden}
.row .tr i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--d-cyan),var(--d-lime))}
.fn{display:grid;gap:8px}.fs{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr) 92px;gap:10px;align-items:center;font-size:13px}
.fs .br{height:26px;background:#12294a;border-radius:5px;overflow:hidden}.fs .br i{display:block;height:100%;background:linear-gradient(90deg,var(--d-lime),#8fd14a);border-radius:5px;min-width:2px}
.fs .dr{color:var(--d-pink);font-size:12px;text-align:right}.fs .n{font-weight:600}
@media (max-width:520px){.fs{grid-template-columns:1fr 70px}.fs .br{grid-column:1/-1;order:3}}
#ticker{font:12px/1.5 var(--br-mono);max-height:300px;overflow:auto;color:var(--d-mute)}#ticker>div{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-bottom:1px solid #12294a;padding:3px 0}
#ticker>div>*{margin-right:8px}#ticker b{color:var(--d-lime);font-weight:500}#ticker em{color:var(--d-cyan);font-style:normal}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--d-mute);margin-top:6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.donut{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.empty{color:var(--d-mute);font-size:13px;padding:8px 0}
.split{height:30px;border-radius:6px;overflow:hidden;display:flex;margin:6px 0}.split i{display:block;height:100%}
.note{color:var(--d-mute);font-size:12px;margin-top:8px}
svg text{fill:var(--d-mute);font:11px var(--br-sans)}
`;

const JS = `
(function(){
var K=new URLSearchParams(location.search).get("k")||"",R=localStorage.getItem("br_ana_range")||"today",T=null,busy=false;
var C=["#C8F55A","#5ad1f5","#f58bd1","#f5c45a","#9b8cf5","#5af5b5","#f5845a","#8fa3bf"];
function $(id){return document.getElementById(id)}
function e(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function n(x){return (x||0).toLocaleString("en-US")}
function bars(id,list,unit){var el=$(id);if(!list||!list.length){el.innerHTML='<div class="empty">No data in this range yet.</div>';return}
 var m=Math.max.apply(null,list.map(function(x){return x.v}))||1;
 el.innerHTML='<div class="rows">'+list.map(function(x){return '<div class="row"><span class="nm" title="'+e(x.k)+'">'+e(x.k)+'</span><span class="vl">'+n(x.v)+(x.u!=null?' · '+n(x.u)+' ppl':'')+'</span><span class="tr"><i style="width:'+(100*x.v/m).toFixed(1)+'%"></i></span></div>'}).join("")+'</div>'}
function donut(id,list){var el=$(id);if(!list||!list.length){el.innerHTML='<div class="empty">No data in this range yet.</div>';return}
 var t=list.reduce(function(a,b){return a+b.v},0)||1,a=0,r=42,cx=56,cy=56,p="";
 list.forEach(function(x,i){var f=x.v/t,a2=a+f*2*Math.PI;if(f>=.9999){p+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+C[i%8]+'" stroke-width="16"/>'}else{var l=f>.5?1:0;
 p+='<path d="M'+(cx+r*Math.sin(a))+' '+(cy-r*Math.cos(a))+' A'+r+' '+r+' 0 '+l+' 1 '+(cx+r*Math.sin(a2))+' '+(cy-r*Math.cos(a2))+'" fill="none" stroke="'+C[i%8]+'" stroke-width="16"/>'}a=a2});
 el.innerHTML='<div class="donut"><svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="share">'+p+'<text x="56" y="60" text-anchor="middle" style="font-size:15px;fill:#eef3fa">'+n(t)+'</text></svg><div class="legend" style="flex-direction:column;gap:4px">'+list.map(function(x,i){return '<span><i style="background:'+C[i%8]+'"></i>'+e(x.k)+' · '+(100*x.v/t).toFixed(0)+'%</span>'}).join("")+'</div></div>'}
function area(d){var el=$("series"),s=d.series||[];if(!s.length){el.innerHTML='<div class="empty">No data yet.</div>';return}
 var W=760,H=180,P=24,m=Math.max(1,Math.max.apply(null,s.map(function(x){return x.views}))),st=(W-P)/Math.max(1,s.length-1);
 function y(v){return H-P-(v/m)*(H-P-10)}
 var pv=s.map(function(x,i){return (P+i*st).toFixed(1)+","+y(x.views).toFixed(1)}).join(" "),pu=s.map(function(x,i){return (P+i*st).toFixed(1)+","+y(x.visitors).toFixed(1)}).join(" ");
 var hr=R==="today",lab=function(t){var dt=new Date(t);return hr?dt.toLocaleTimeString("en-CA",{hour:"numeric",timeZone:"America/Toronto"}):dt.toLocaleDateString("en-CA",{month:"short",day:"numeric",timeZone:"America/Toronto"})};
 var ticks="";var every=Math.ceil(s.length/6);s.forEach(function(x,i){if(i%every===0)ticks+='<text x="'+(P+i*st).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle">'+e(lab(x.t))+'</text>'});
 el.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="none" role="img" aria-label="views over time"><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C8F55A" stop-opacity=".45"/><stop offset="1" stop-color="#C8F55A" stop-opacity="0"/></linearGradient></defs>'
 +'<line x1="'+P+'" y1="'+(H-P)+'" x2="'+W+'" y2="'+(H-P)+'" stroke="#1d3557"/><text x="2" y="14">'+n(m)+'</text>'
 +'<polygon points="'+P+','+(H-P)+' '+pv+' '+(P+(s.length-1)*st).toFixed(1)+','+(H-P)+'" fill="url(#g1)"/><polyline points="'+pv+'" fill="none" stroke="#C8F55A" stroke-width="2.2"/><polyline points="'+pu+'" fill="none" stroke="#5ad1f5" stroke-width="1.8" stroke-dasharray="4 3"/>'+ticks+'</svg><div class="legend"><span><i style="background:#C8F55A"></i>Page views</span><span><i style="background:#5ad1f5"></i>Visitors</span></div>'}
function funnel(f){var el=$("funnel"),top=(f[0]&&f[0].n)||0;
 el.innerHTML='<div class="fn">'+f.map(function(s,i){var prev=i?f[i-1].n:0,w=top?100*s.n/top:0,drop=i&&prev?Math.round(100*(1-s.n/prev)):null;
 return '<div class="fs"><span>'+e(s.step)+'</span><span class="br"><i style="width:'+Math.max(w,s.n?1.5:0).toFixed(1)+'%"></i></span><span><span class="n">'+n(s.n)+'</span> '+(drop!=null&&prev?'<span class="dr">−'+drop+'%</span>':'')+'</span></div>'}).join("")+'</div>'}
function scroll(sc,views){var list=["25","50","75","100"].map(function(k){return {k:"Reached "+k+"%",v:sc[k]||0}});bars("scroll",list);
 if(views){$("scroll").insertAdjacentHTML("beforeend",'<div class="note">'+(100*(sc["50"]||0)/views).toFixed(0)+'% of page views reach halfway; '+(100*(sc["100"]||0)/views).toFixed(0)+'% reach the end.</div>')}}
function skins(list){var el=$("skins"),t=(list||[]).reduce(function(a,b){return a+b.v},0);if(!t){el.innerHTML='<div class="empty">No page views yet.</div>';return}
 var b=(list.find(function(x){return x.k==="birch"})||{v:0}).v,s=(list.find(function(x){return x.k==="scale"})||{v:0}).v;
 el.innerHTML='<div class="split"><i style="width:'+(100*b/t)+'%;background:#C8F55A"></i><i style="width:'+(100*s/t)+'%;background:#5ad1f5"></i></div><div class="legend"><span><i style="background:#C8F55A"></i>birchreserve.net · '+n(b)+'</span><span><i style="background:#5ad1f5"></i>scalehealth.ca mirror · '+n(s)+'</span></div>'}
function render(d){var t=d.totals;
 $("k-live").textContent=n(t.live_visitors);$("k-vis").textContent=n(t.visitors);$("k-views").textContent=n(t.views);$("k-clicks").textContent=n(t.clicks);
 $("k-forms").textContent=n(t.form_submits);$("k-forms-s").textContent=n(t.form_starts)+" started";$("k-co").textContent=n(d.stripe.created);$("k-paid").textContent=n(d.stripe.paid)+" paid";
 area(d);funnel(d.funnel);bars("pages",d.pages);bars("sources",d.sources);donut("devices",d.devices);bars("browsers",d.browsers);bars("clicks",d.clicks);bars("labels",d.click_labels);scroll(d.scroll,t.views);skins(d.skins);bars("tags",d.tags);bars("refs",d.referrers);
 $("ticker").innerHTML=(d.recent||[]).map(function(r){return '<div><span>'+e(new Date(r.at).toLocaleTimeString("en-CA",{timeZone:"America/Toronto"}))+'</span><b>'+e(r.event)+'</b><em>'+e(r.path)+'</em><span>'+e([r.label,r.device,r.skin,r.source].filter(Boolean).join(" · "))+'</span></div>'}).join("")||'<div class="empty">Waiting for the first event…</div>';
 $("stamp").textContent="Updated "+new Date(d.generated_at).toLocaleTimeString("en-CA",{timeZone:"America/Toronto"})+" ET · "+n(t.excluded_test_or_bot)+" QA/bot events excluded"+(d.stripe.available?"":" · Stripe counts unavailable");}
function load(){if(busy||document.hidden)return;busy=true;
 fetch("/ads/admin/analytics.json?range="+R+(K?"&k="+encodeURIComponent(K):""),{credentials:"same-origin",cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(render).catch(function(err){$("stamp").textContent="Could not refresh ("+err.message+"). Retrying…"}).finally(function(){busy=false})}
document.querySelectorAll("[data-range]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.range===R));b.addEventListener("click",function(){R=b.dataset.range;localStorage.setItem("br_ana_range",R);document.querySelectorAll("[data-range]").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))});load()})});
var lk=$("mklink");if(lk)lk.addEventListener("click",function(){fetch("/ads/admin/analytics/link",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:"{}"}).then(function(r){return r.json()}).then(function(j){$("linkout").value=j.url||j.message||"";$("linkout").select()})});
load();T=setInterval(load,5000);document.addEventListener("visibilitychange",load);
})();`;

export function analyticsPage(o: { who: string | null; embed: boolean }): string {
  const panel = (id: string, title: string, span: string, extra = "") => `<section class="p ${span}"><h2>${esc(title)}</h2><div id="${id}">${extra}</div></section>`;
  const desk = `<div class="desk">
<div class="dbar"><span class="pulse"><i></i><span id="stamp">Loading live data…</span></span>
<span class="rng" role="group" aria-label="Date range"><button type="button" data-range="today">Today</button><button type="button" data-range="7d">7 days</button><button type="button" data-range="30d">30 days</button></span></div>
<div class="dg">
<section class="p s3 kv live"><span>Live now</span><b id="k-live">–</b><small>visitors, last 5 min</small></section>
<section class="p s3 kv"><span>Visitors</span><b id="k-vis">–</b><small><span id="k-views">–</span> page views</small></section>
<section class="p s3 kv"><span>Clicks</span><b id="k-clicks">–</b><small>tracked buttons + links</small></section>
<section class="p s3 kv"><span>Forms sent</span><b id="k-forms">–</b><small id="k-forms-s">–</small></section>
${panel("series", "Traffic", "s8")}
<section class="p s4 kv"><h2>Stripe checkout</h2><b id="k-co">–</b><small>sessions opened · <span id="k-paid">–</span></small><div class="note">From Stripe (read-only), QA cards excluded.</div><h2 style="margin-top:14px">Birch vs Scale</h2><div id="skins"></div></section>
${panel("funnel", "Funnel: visit to paid", "s12")}
${panel("pages", "Views by page", "s6")}
${panel("sources", "Traffic sources", "s6")}
${panel("devices", "Devices", "s4")}
${panel("browsers", "Browsers", "s4")}
${panel("scroll", "Scroll depth", "s4")}
${panel("clicks", "Button clicks", "s6")}
${panel("labels", "Which button", "s6")}
${panel("refs", "Referring sites", "s4")}
${panel("tags", "Street team · QR · ref tags", "s4")}
${panel("ticker", "Live event feed", "s4")}
</div></div>`;
  const friday = o.embed ? "" : `<section class="card" style="margin-bottom:22px"><h2 style="margin-top:0">Show this in Friday</h2><p class="fine">Mint a read-only link (analytics only, no personal data, 1 year). Paste it into Friday as a link or an iframe. To revoke every link, change ANALYTICS_LINK_VERSION on Vercel.</p>
<p><button type="button" id="mklink" class="btn">Make Friday link</button></p><input id="linkout" readonly style="width:100%;min-height:40px" aria-label="Friday link"></section>`;
  const body = `${o.embed ? "" : `<h1 style="margin-top:18px">Site analytics</h1><p class="lede">birchreserve.net and the scalehealth.ca mirror, live. Cookieless, no personal data, Do Not Track respected. Our own QA traffic is left out.</p>`}${desk}${friday}<style>${CSS}</style><script>${JS}</script>`;
  return shell({ title: "Site analytics · Birch Reserve", nav: o.embed ? "LIVE SITE ANALYTICS" : "ADMIN · ANALYTICS", body, home: o.embed ? "#" : "/ads/admin",
    right: o.embed ? "" : `<nav class="tabs"><a href="/ads/admin">Ad admin</a><a href="/ads/admin/analytics">Analytics</a></nav>`, footer: o.embed ? " " : undefined });
}
