/**
 * "Insertion order (IO)" on first use, on every page (Randy, Nov 23 2026 8:16 AM ET).
 * One browser script for the React site and the server-rendered pages (same pattern as adserver/promoBoxJs.ts):
 * the first plain "IO" in the visible text of a page becomes "insertion order (IO)" with a small ? that opens the buyer
 * explainer under that paragraph. Nothing else on the page changes. Prices, links and fields are never touched.
 */
export const IO_TERM = "insertion order (IO)";
export const IO_EXPLAINER =
  "An insertion order is the short document that names your hub, the surface (post-purchase, dashboard tile, hub home), your category and your dates before anything runs. What you pay is media credit until the IO is signed and approved. Nothing runs without it.";

export const IO_EXPLAIN_JS = String.raw`(function(){
if(window.__brIo)return;window.__brIo=1;
var TXT=${JSON.stringify(IO_EXPLAINER)};
var SKIP="script,style,noscript,textarea,input,select,option,code,pre,svg,a,button,summary,label,title,[data-no-io],.io-exp,.io-term";
function css(){if(document.getElementById("io-css"))return;var s=document.createElement("style");s.id="io-css";
s.textContent=".io-term{white-space:normal}.io-q{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin:0 0 0 4px;padding:0;border:1px solid currentColor;border-radius:50%;background:transparent;color:inherit;font-weight:700;font-size:11px;line-height:1;font-family:inherit;font-style:normal;cursor:pointer;vertical-align:1px;opacity:.75}.io-q:hover,.io-q:focus-visible{opacity:1}.io-exp{display:block;box-sizing:border-box;max-width:100%;margin:8px 0 0;padding:10px 12px;border-left:3px solid #C8F55A;border-radius:6px;background:rgba(7,26,57,.06);color:#071A39;font-weight:500;font-size:13px;line-height:1.45;font-style:normal;font-family:inherit;text-align:left;text-transform:none;letter-spacing:0;overflow-wrap:anywhere}.io-exp[hidden]{display:none}html[data-skin=scale] .io-exp{border-left-color:#2fbf71}";
(document.head||document.documentElement).appendChild(s)}
function blockOf(n){var e=n.parentElement;while(e&&e!==document.body){var d=getComputedStyle(e).display;if(d==="block"||d==="list-item"||d==="flow-root")return e;e=e.parentElement}return document.body}
function find(){
 if(document.querySelector(".io-q"))return null;
 var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(t){
  if(!t.nodeValue||t.nodeValue.indexOf("IO")<0)return NodeFilter.FILTER_REJECT;
  var p=t.parentElement;if(!p||p.closest(SKIP))return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_ACCEPT}});
 var t;while((t=w.nextNode())){
  var re=/\bIO\b/g,m;
  while((m=re.exec(t.nodeValue))){
   var before=t.nodeValue.slice(0,m.index);
   if(/insertion order\s*\(\s*$/i.test(before)&&t.nodeValue.charAt(m.index+2)===")")return {t:t,i:m.index,spelled:true};
   if(t.nodeValue.charAt(m.index+2)==="-"||before.slice(-1)==="-")continue;
   return {t:t,i:m.index}}
 }
 return null}
function apply(){
 if(!document.body)return;var f=find();if(!f||f.skip)return;css();
 var t=f.t,s=t.nodeValue,i=f.i,before=s.slice(0,i),after=s.slice(i+2);
 var spelled=f.spelled;var cap=/^\s*$/.test(before)||/[.!?:]\s*$/.test(before);
 var span=document.createElement("span");span.className="io-term";
 if(!spelled)span.appendChild(document.createTextNode((cap?"Insertion order (IO)":"insertion order (IO)")));
 var b=document.createElement("button");b.type="button";b.className="io-q";b.textContent="?";b.setAttribute("aria-expanded","false");b.setAttribute("aria-label","What is an insertion order?");b.setAttribute("data-testid","io-explainer-toggle");
 var box=document.createElement("span");box.className="io-exp";box.hidden=true;box.setAttribute("role","note");box.setAttribute("data-testid","io-explainer");box.textContent=TXT;
 b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var o=box.hidden;box.hidden=!o;b.setAttribute("aria-expanded",o?"true":"false")});
 span.appendChild(b);
 var par=t.parentNode,blk=blockOf(t);
 if(spelled){t.nodeValue=s.slice(0,i+3);par.insertBefore(span,t.nextSibling);par.insertBefore(document.createTextNode(s.slice(i+3)),span.nextSibling)}
 else{t.nodeValue=before;par.insertBefore(span,t.nextSibling);par.insertBefore(document.createTextNode(after),span.nextSibling)}
 blk.appendChild(box)}
var tm=0;function later(){clearTimeout(tm);tm=setTimeout(apply,250)}
function start(){apply();try{new MutationObserver(later).observe(document.body,{childList:true,subtree:true,characterData:false})}catch(e){}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();`;

export const IO_SCRIPT_TAG = `<script data-io-explain>${IO_EXPLAIN_JS}</script>`;
