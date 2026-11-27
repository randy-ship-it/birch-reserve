/**
 * Browser side of promo codes + street team attribution (one script, used by the React site and the server-rendered pages).
 *   BRPromo.capture()      reads ?st= (and ?ref= / ?via= once the server confirms an active member), ?qr= and ?code=; keeps
 *                          them 30 days from the referring click, last click wins (localStorage + first-party cookies br_st /
 *                          br_qr / br_pc / br_at scoped to .birchreserve.net or .scalehealth.ca, which the server reads), and sends
 *                          one aggregate scan beacon per session. Rule: docs/ads/ARCHITECTURE.md "Referral attribution".
 *   BRPromo.mount(el, o)   o.mode "form" (collapsible "Have a code?"), "account" (applies to the signed-in account) or
 *                          "success" (thank-you banner for ?session_id=).
 * No dependencies, no storage of anything but a member id and a code. Same-origin fetches go through the Scale mirror boot script.
 */
export const PROMO_BOX_JS = String.raw`(function(){
if(window.BRPromo)return;
var KEY="br_promo_v1",MAXAGE=30*86400,MEMBER=/^[a-z0-9][a-z0-9_-]{1,31}$/,QRL=/^[a-z0-9][a-z0-9_-]{0,39}$/,CODE=/^[A-Za-z0-9 _-]{2,40}$/;
function rd(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){return{}}}
function wr(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
function dom(){var h=location.hostname;return /(^|\.)scalehealth\.ca$/.test(h)?".scalehealth.ca":/(^|\.)birchreserve\.net$/.test(h)?".birchreserve.net":""}
function ck(n,v,age){try{var sec=location.protocol==="https:"?"; Secure":"",d=dom(),a=v?(age>0?age:MAXAGE):0;if(d)document.cookie=n+"=; Max-Age=0; Path=/; SameSite=Lax"+sec;document.cookie=n+"="+encodeURIComponent(v)+"; Max-Age="+a+"; Path=/; SameSite=Lax"+sec+(d?"; Domain="+d:"")}catch(e){}}
function gc(n){var m=document.cookie.match(new RegExp("(?:^|; )"+n+"=([^;]*)"));try{return m?decodeURIComponent(m[1]):""}catch(e){return""}}
function state(){var s=rd();if(s.at&&Date.now()-s.at>MAXAGE*1000)s={};
 if(!s.st&&!s.code){var cs=gc("br_st"),cc=gc("br_pc"),ca=Number(gc("br_at"))||0;if((cs&&MEMBER.test(cs))||(cc&&CODE.test(cc))){s={st:MEMBER.test(cs)?cs:undefined,qr:QRL.test(gc("br_qr"))?gc("br_qr"):undefined,code:CODE.test(cc)?cc:undefined,at:ca||Date.now()};if(Date.now()-s.at>MAXAGE*1000)s={};else wr(s)}}
 return s}
function sync(s){wr(s);var left=s.at?Math.max(1,Math.floor(MAXAGE-(Date.now()-s.at)/1000)):MAXAGE;ck("br_st",s.st||"",left);ck("br_qr",s.st&&s.qr||"",left);ck("br_pc",s.code||"",left);ck("br_at",s.st||s.code?String(s.at||Date.now()):"",left)}
function post(u,b){return fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b||{}),credentials:"same-origin"}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){j.__status=r.status;return j})})}
function qlab(v){v=(v||"").trim().toLowerCase();return v==="1"||v==="true"?"qr":QRL.test(v)?v:""}
function setMember(st,qr){var s=state();s.st=st;s.qr=qr||undefined;s.at=Date.now();sync(s)}
function capture(){
 var q;try{q=new URLSearchParams(location.search)}catch(e){return}
 var s=state(),st=(q.get("st")||"").trim().toLowerCase(),alt=(q.get("ref")||q.get("via")||"").trim().toLowerCase(),code=(q.get("code")||q.get("c")||"").trim().slice(0,40),qr=qlab(q.get("qr")),changed=false;
 // ?st= is the street-team member param: last click wins. ?ref= / ?via= are also used by our own internal links (home_tile, share_*),
 // so they only take over once the server confirms an active member; an unknown value never wipes a real referrer.
 if(st&&MEMBER.test(st)){s.st=st;s.qr=qr||undefined;s.at=Date.now();changed=true}else st="";
 if(code&&CODE.test(code)){s.code=code;if(!s.at)s.at=Date.now();changed=true}
 if(changed||s.st||s.code)sync(s);
 try{var u=new URL(location.href);if(u.searchParams.has("code")||u.searchParams.has("c")){u.searchParams.delete("code");u.searchParams.delete("c");history.replaceState(history.state,"",u.pathname+(u.search||"")+u.hash)}}catch(e){}
 var who=st||(alt&&MEMBER.test(alt)?alt:"");if(!who)return;
 var k="br_st_b_"+who+"_"+(qr||"");try{if(!st&&sessionStorage.getItem(k)==="0")return;if(st&&sessionStorage.getItem(k))return}catch(e){}
 post("/v1/promo/scan",{st:who,qr:qr||undefined,code:code||undefined}).then(function(j){var ok=j&&j.member===who;try{sessionStorage.setItem(k,ok?"1":"0")}catch(e){}if(ok&&!st)setMember(who,qr)}).catch(function(){})
}
function install(){
 if(window.__brPromoFetch||typeof window.fetch!=="function")return;window.__brPromoFetch=1;var of=window.fetch;
 window.fetch=function(i,o){try{
  var u=typeof i==="string"?i:(i&&i.url)||"",m=((o&&o.method)||(i&&i.method)||"GET").toUpperCase();
  if(m!=="GET"&&m!=="HEAD"&&/(^|\/)(v1|launch)\//.test(u)&&(u.charAt(0)==="/"||u.indexOf(location.origin)===0)){
   var s=state(),h=[];if(s.st&&MEMBER.test(s.st)){h.push("st="+s.st);if(s.qr&&QRL.test(s.qr))h.push("qr="+s.qr)}if(s.code&&CODE.test(s.code))h.push("code="+encodeURIComponent(s.code));
   if(h.length){var hd=new Headers((o&&o.headers)||(i&&i.headers)||undefined);if(!hd.has("x-br-attr"))hd.set("x-br-attr",h.join("&"));o=Object.assign({},o||{},{headers:hd})}}
 }catch(e){}return of.call(this,i,o)}
}
function css(){if(document.getElementById("brpromo-css"))return;var s=document.createElement("style");s.id="brpromo-css";
 s.textContent=".brpromo{margin:12px 0;border:1px solid #d9ddd2;border-radius:12px;background:#fbfaf6;color:#071A39;font:500 14px/1.4 inherit;font-family:inherit;max-width:520px}.brpromo summary{cursor:pointer;padding:10px 14px;font-weight:700;min-height:44px;display:flex;align-items:center;list-style:none}.brpromo summary::-webkit-details-marker{display:none}.brpromo summary:after{content:'+';margin-left:auto;font-size:18px}.brpromo[open] summary:after{content:'\\2212'}.brpromo .bp-b{padding:0 14px 14px}.brpromo .bp-r{display:flex;gap:8px;flex-wrap:wrap}.brpromo input{flex:1 1 180px;min-height:44px;padding:8px 12px;border:1px solid #b9c1c9;border-radius:10px;font:inherit;font-size:16px;background:#fff;color:#071A39;text-transform:uppercase}.brpromo button{min-height:44px;padding:8px 18px;border:0;border-radius:999px;background:#071A39;color:#fff;font:700 14px inherit;font-family:inherit;cursor:pointer}.brpromo .bp-m{margin:8px 0 0;font-size:13px}.brpromo .ok{color:#1d6b2e}.brpromo .no{color:#8a2b1f}.brpromo .bp-f{margin:6px 0 0;font-size:11.5px;color:#4a5b70}.brpromo.q{border:0;background:none;margin:10px 0 0;max-width:420px}.brpromo.q summary{display:inline-flex;min-height:32px;padding:4px 0;font-weight:600;font-size:13px;color:#4a5b70;text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(74,91,112,.35)}.brpromo.q summary:after{content:none}.brpromo.q .bp-b{padding:6px 0 0}.brbanner{margin:12px auto;max-width:640px;border:1px solid #b8dfa0;background:#eef8e6;color:#12361a;border-radius:12px;padding:12px 16px;font:600 15px/1.4 inherit;font-family:inherit}.brbanner small{display:block;font-weight:500;font-size:12.5px;margin-top:3px}";
 document.head.appendChild(s)}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function mountForm(host,o){
 css();host.innerHTML="";var s=state(),q=!!(o&&o.quiet),d=el("details",q?"brpromo q":"brpromo");d.setAttribute("data-testid","promo-box");
 d.appendChild(el("summary",null,"Have a code?"));var b=el("div","bp-b"),row=el("div","bp-r"),inp=el("input");
 inp.type="text";inp.name="promo_code";inp.placeholder="Promo or street-team code";inp.autocomplete="off";inp.setAttribute("aria-label","Promo code");inp.setAttribute("data-testid","promo-input");var held=s.code||"";inp.value="";if(held)inp.placeholder="Code saved on this page";
 var btn=el("button",null,"Apply");btn.type="button";btn.setAttribute("data-testid","promo-apply");
 var msg=el("p","bp-m");msg.setAttribute("role","status");msg.setAttribute("aria-live","polite");msg.setAttribute("data-testid","promo-msg");
 var fine=el("p","bp-f","Free ad credit: ad spend only, no cash value, not transferable. One per business.");
 row.appendChild(inp);row.appendChild(btn);b.appendChild(row);b.appendChild(msg);b.appendChild(fine);d.appendChild(b);host.appendChild(d);
 function show(ok,t){msg.className="bp-m "+(ok?"ok":"no");msg.textContent=t}
 function email(){if(o&&o.getEmail){var v=o.getEmail();if(v)return v}var f=host.closest("form")||document;var i=f.querySelector&&f.querySelector('input[type=email],input[name=email]');return i&&i.value?i.value.trim():""}
 function go(auto){var v=inp.value.trim()||(auto?held:"");if(!v){show(false,"Type your code, or keep going without one.");return}
  btn.disabled=true;btn.textContent="Checking...";
  var req=o&&o.mode==="account"?post("/account/promo",{code:v}):post("/v1/promo/validate",{code:v,email:email()||undefined});
  req.then(function(j){btn.disabled=false;btn.textContent="Apply";
   if(j.ok){if(o&&o.mode==="account"){show(true,j.message);setTimeout(function(){location.reload()},1400)}else{var cur=state();cur.code=v;if(!cur.at)cur.at=Date.now();sync(cur);show(true,j.message+" It will be added with your order or request.")}}
   else if(auto&&j.reason==="unknown"){show(false,j.message)}else show(false,j.message||"That didn't work. You can keep going without a code.")})
  .catch(function(){btn.disabled=false;btn.textContent="Apply";show(false,"We couldn't check that right now. Keep going, and your code stays saved on this page.")})}
 function s2(x){return x}
 btn.onclick=function(){go(false)};inp.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();go(false)}};
 d.open=!q||!!held;if(held){go(true)}
}
function mountSuccess(host){
 css();var q=new URLSearchParams(location.search),sid=q.get("session_id")||"";if(!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid))return;
 host.innerHTML="";var tries=0;
 function tick(){post("/v1/promo/order",{session_id:sid}).then(function(j){
  if(j.applied){host.innerHTML="";var b=el("div","brbanner","Code applied: "+j.label+" added");b.setAttribute("role","status");b.setAttribute("data-testid","promo-applied");
   b.appendChild(el("small",null,"Ad spend only, no cash value. It is its own ad credit on your account"+(j.member?" · Street team: "+j.member:"")+". "+(j.rate||"")+" "+(j.compare||"")));host.appendChild(b)}
  else if(j.pending&&tries<4){tries+=1;setTimeout(tick,2500)}
  else if(j.pending){host.innerHTML="";var c=el("div","brbanner","Your code is saved to your order");c.appendChild(el("small",null,"Your "+j.label+" appears in your account as soon as payment confirms."));host.appendChild(c)}
 }).catch(function(){})}
 tick();
}
function mount(host,o){if(!host)return;o=o||{};if(o.mode==="success")mountSuccess(host);else mountForm(host,o)}
window.BRPromo={capture:capture,mount:mount,state:state};
capture();install();
document.addEventListener("DOMContentLoaded",function(){var n=document.querySelectorAll("[data-promo-box]");for(var i=0;i<n.length;i++){if(n[i].getAttribute("data-mounted"))continue;n[i].setAttribute("data-mounted","1");mount(n[i],{mode:n[i].getAttribute("data-promo-box")||"form"})}});
if(document.readyState!=="loading"){var n=document.querySelectorAll("[data-promo-box]");for(var i=0;i<n.length;i++){if(n[i].getAttribute("data-mounted"))continue;n[i].setAttribute("data-mounted","1");mount(n[i],{mode:n[i].getAttribute("data-promo-box")||"form"})}}
})();`;

/** Script tag for server-rendered pages. Pair with <div data-promo-box="form|account|success"></div>. */
export const PROMO_SCRIPT_TAG = `<script>${PROMO_BOX_JS.replaceAll("</script", "<\\/script")}</script>`;
