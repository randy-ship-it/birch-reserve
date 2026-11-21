/**
 * Browser side of promo codes + street team attribution (one script, used by the React site and the server-rendered pages).
 *   BRPromo.capture()      reads ?st= / ?ref= and ?code= (also ?qr=1), keeps them 30 days, last touch (localStorage + first-party
 *                          cookies br_st / br_pc that the server reads), and sends one aggregate scan beacon per session.
 *   BRPromo.mount(el, o)   o.mode "form" (collapsible "Have a code?"), "account" (applies to the signed-in account) or
 *                          "success" (thank-you banner for ?session_id=).
 * No dependencies, no storage of anything but a member id and a code. Same-origin fetches go through the Scale mirror boot script.
 */
export const PROMO_BOX_JS = String.raw`(function(){
if(window.BRPromo)return;
var KEY="br_promo_v1",MAXAGE=30*86400,MEMBER=/^[a-z0-9][a-z0-9_-]{1,31}$/;
function rd(){try{return JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){return{}}}
function wr(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}}
function ck(n,v){try{document.cookie=n+"="+encodeURIComponent(v)+"; Max-Age="+(v?MAXAGE:0)+"; Path=/; SameSite=Lax"+(location.protocol==="https:"?"; Secure":"")}catch(e){}}
function state(){var s=rd();if(s.at&&Date.now()-s.at>MAXAGE*1000)s={};return s}
function sync(s){wr(s);ck("br_st",s.st||"");ck("br_pc",s.code||"")}
function post(u,b){return fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b||{}),credentials:"same-origin"}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){j.__status=r.status;return j})})}
function capture(){
 var q;try{q=new URLSearchParams(location.search)}catch(e){return}
 var s=state(),st=(q.get("st")||q.get("ref")||"").trim().toLowerCase(),code=(q.get("code")||"").trim().slice(0,40),changed=false;
 if(st&&MEMBER.test(st)){s.st=st;s.at=Date.now();changed=true}
 else st="";
 if(code&&/^[A-Za-z0-9 _-]{2,40}$/.test(code)){s.code=code;if(!s.at)s.at=Date.now();changed=true}
 if(changed||s.st||s.code)sync(s);
 if(st){var k="br_st_b_"+st;try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1")}catch(e){}
  post("/v1/promo/scan",{st:st,qr:q.get("qr")||undefined,code:code||undefined}).catch(function(){})}
}
function install(){
 if(window.__brPromoFetch||typeof window.fetch!=="function")return;window.__brPromoFetch=1;var of=window.fetch;
 window.fetch=function(i,o){try{
  var u=typeof i==="string"?i:(i&&i.url)||"",m=((o&&o.method)||(i&&i.method)||"GET").toUpperCase();
  if(m!=="GET"&&m!=="HEAD"&&/(^|\/)v1\//.test(u)&&(u.charAt(0)==="/"||u.indexOf(location.origin)===0)){
   var s=state(),h=[];if(s.st&&MEMBER.test(s.st))h.push("st="+s.st);if(s.code&&/^[A-Za-z0-9 _-]{2,40}$/.test(s.code))h.push("code="+encodeURIComponent(s.code));
   if(h.length){var hd=new Headers((o&&o.headers)||(i&&i.headers)||undefined);if(!hd.has("x-br-attr"))hd.set("x-br-attr",h.join("&"));o=Object.assign({},o||{},{headers:hd})}}
 }catch(e){}return of.call(this,i,o)}
}
function css(){if(document.getElementById("brpromo-css"))return;var s=document.createElement("style");s.id="brpromo-css";
 s.textContent=".brpromo{margin:12px 0;border:1px solid #d9ddd2;border-radius:12px;background:#fbfaf6;color:#071A39;font:500 14px/1.4 inherit;font-family:inherit;max-width:520px}.brpromo summary{cursor:pointer;padding:10px 14px;font-weight:700;min-height:44px;display:flex;align-items:center;list-style:none}.brpromo summary::-webkit-details-marker{display:none}.brpromo summary:after{content:'+';margin-left:auto;font-size:18px}.brpromo[open] summary:after{content:'\\2212'}.brpromo .bp-b{padding:0 14px 14px}.brpromo .bp-r{display:flex;gap:8px;flex-wrap:wrap}.brpromo input{flex:1 1 180px;min-height:44px;padding:8px 12px;border:1px solid #b9c1c9;border-radius:10px;font:inherit;font-size:16px;background:#fff;color:#071A39;text-transform:uppercase}.brpromo button{min-height:44px;padding:8px 18px;border:0;border-radius:999px;background:#071A39;color:#fff;font:700 14px inherit;font-family:inherit;cursor:pointer}.brpromo .bp-m{margin:8px 0 0;font-size:13px}.brpromo .ok{color:#1d6b2e}.brpromo .no{color:#8a2b1f}.brpromo .bp-f{margin:6px 0 0;font-size:11.5px;color:#4a5b70}.brbanner{margin:12px auto;max-width:640px;border:1px solid #b8dfa0;background:#eef8e6;color:#12361a;border-radius:12px;padding:12px 16px;font:600 15px/1.4 inherit;font-family:inherit}.brbanner small{display:block;font-weight:500;font-size:12.5px;margin-top:3px}";
 document.head.appendChild(s)}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function mountForm(host,o){
 css();host.innerHTML="";var s=state(),d=el("details","brpromo");d.setAttribute("data-testid","promo-box");
 d.appendChild(el("summary",null,"Have a code?"));var b=el("div","bp-b"),row=el("div","bp-r"),inp=el("input");
 inp.type="text";inp.name="promo_code";inp.placeholder="Enter your code";inp.autocomplete="off";inp.setAttribute("aria-label","Promo code");inp.setAttribute("data-testid","promo-input");inp.value=(s.code||"").toUpperCase();
 var btn=el("button",null,"Apply");btn.type="button";btn.setAttribute("data-testid","promo-apply");
 var msg=el("p","bp-m");msg.setAttribute("role","status");msg.setAttribute("aria-live","polite");msg.setAttribute("data-testid","promo-msg");
 var fine=el("p","bp-f","Free ad credit: ad spend only, no cash value, not transferable. One per business.");
 row.appendChild(inp);row.appendChild(btn);b.appendChild(row);b.appendChild(msg);b.appendChild(fine);d.appendChild(b);host.appendChild(d);
 function show(ok,t){msg.className="bp-m "+(ok?"ok":"no");msg.textContent=t}
 function email(){if(o&&o.getEmail){var v=o.getEmail();if(v)return v}var f=host.closest("form")||document;var i=f.querySelector&&f.querySelector('input[type=email],input[name=email]');return i&&i.value?i.value.trim():""}
 function go(auto){var v=inp.value.trim();if(!v){show(false,"Type your code, or keep going without one.");return}
  btn.disabled=true;btn.textContent="Checking...";
  var req=o&&o.mode==="account"?post("/account/promo",{code:v}):post("/v1/promo/validate",{code:v,email:email()||undefined});
  req.then(function(j){btn.disabled=false;btn.textContent="Apply";
   if(j.ok){var t=s2(j.code);if(o&&o.mode==="account"){show(true,j.message);setTimeout(function(){location.reload()},1400)}else{var cur=state();cur.code=j.code;if(!cur.at)cur.at=Date.now();sync(cur);show(true,j.message+" It will be added with your order or request.")}}
   else if(auto&&j.reason==="unknown"){show(false,j.message)}else show(false,j.message||"That didn't work. You can keep going without a code.")})
  .catch(function(){btn.disabled=false;btn.textContent="Apply";show(false,"We couldn't check that right now. Keep going, and your code stays saved on this page.")})}
 function s2(x){return x}
 btn.onclick=function(){go(false)};inp.onkeydown=function(e){if(e.key==="Enter"){e.preventDefault();go(false)}};
 if(inp.value){d.open=true;go(true)}
}
function mountSuccess(host){
 css();var q=new URLSearchParams(location.search),sid=q.get("session_id")||"";if(!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid))return;
 host.innerHTML="";var tries=0;
 function tick(){post("/v1/promo/order",{session_id:sid}).then(function(j){
  if(j.applied){host.innerHTML="";var b=el("div","brbanner","Code "+j.code+" applied: "+j.label+" added");b.setAttribute("role","status");b.setAttribute("data-testid","promo-applied");
   b.appendChild(el("small",null,"Ad spend only, no cash value. It is its own ad credit on your account"+(j.member?" · Street team: "+j.member:"")+". "+(j.rate||"")+" "+(j.compare||"")));host.appendChild(b)}
  else if(j.pending&&tries<4){tries+=1;setTimeout(tick,2500)}
  else if(j.pending){host.innerHTML="";var c=el("div","brbanner","Code "+j.code+" is saved to your order");c.appendChild(el("small",null,"Your "+j.label+" appears in your account as soon as payment confirms."));host.appendChild(c)}
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
