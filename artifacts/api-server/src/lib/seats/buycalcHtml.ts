/**
 * Server-rendered seat blocks for /buycalc (the page is plain HTML, not the SPA).
 * Same data as the React home: availability strip, founder snippet, category cards
 * with one-click Hold / Lock / Waitlist, impression blocks, lock-request form,
 * proof + network, and phone/email CTAs. Vanilla JS posts to /v1/seats/request.
 */
import { BLOCK_NOTE, CONTACT, FACE_BEFORE_FLIGHT, FOUNDER, HELD_MESSAGE, IMPRESSION_BLOCKS, LIVE_HUB_EXAMPLES, NETWORK, SEAT_CATEGORIES, SEAT_SKUS } from "./catalog";
import type { SeatAvailability } from "./availability";

type Cur = "usd" | "cad";
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number, c: Cur) => `$${n.toLocaleString("en-US")} ${c.toUpperCase()}`;

export const SEATS_CSS = `.bs-strip{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:22px 0 4px;padding:14px 16px;border:1px solid #ffffff33;background:#ffffff0d}.bs-strip b{font:600 1.5rem Fraunces,serif;color:#C8F55A}.bs-strip a{color:#fff}.bs-dots{display:flex;gap:4px}.bs-dot{width:14px;height:14px;border:1px solid #C8F55A}.bs-dot.o{background:#C8F55A}.bs-dot.u{border-style:dashed;opacity:.6}.bs-src{font-size:12px;opacity:.75;width:100%}
.bs-founder{display:grid;gap:10px;margin:18px 0 6px;padding:16px;border-left:3px solid #C8F55A;background:#ffffff0d}.bs-founder q{font:400 1.15rem/1.4 Fraunces,serif}.bs-founder small{opacity:.8}.bs-founder a{color:#C8F55A;font-weight:600}
.bs{margin:28px 0}.bs h2{font-size:clamp(1.8rem,5vw,2.8rem);margin:.2em 0 .3em}.bs-eb{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;opacity:.7;margin:0}.bs-cards{display:grid;grid-template-columns:1fr;gap:10px;margin:16px 0}.bs-card{border:1px solid #071A39;background:#fff;padding:16px;display:flex;flex-direction:column;gap:10px}.bs-card h3{margin:0;font:600 1.15rem Fraunces,serif}.bs-st{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;border:1px solid #071A39}.bs-st.open{background:#C8F55A;border-color:#C8F55A}.bs-st.taken{background:#071A39;color:#fff}.bs-st.unknown{border-style:dashed}.bs-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}.bs-btns button,.bs-btn{margin:0;min-height:48px;padding:10px;font:600 14px "IBM Plex Sans",sans-serif;cursor:pointer;border:1px solid #071A39;background:#fff;color:#071A39;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.bs-btns .bs-lock,.bs-btn.lime{background:#C8F55A;border-color:#071A39}.bs-btns .bs-wait{grid-column:1/-1;background:#071A39;color:#fff}
.bs-blocks{display:grid;grid-template-columns:1fr;gap:10px;margin:16px 0}.bs-block{border:1px solid #071A3933;background:#fff;padding:16px}.bs-block strong{display:block;font:600 1.6rem Fraunces,serif}.bs-note{font-size:12px;opacity:.8}
.bs-rate{width:100%;border-collapse:collapse;background:#fff;font-size:14px}.bs-rate th,.bs-rate td{border:1px solid #071A3926;padding:8px;text-align:left}.bs-rate th{background:#F0F4F8}
.bs-form{border:1px solid #071A39;background:#fff;padding:18px}.bs-form label{margin-top:10px;font-size:14px}.bs-form input,.bs-form select,.bs-form textarea{min-height:48px;font-size:16px}.bs-form textarea{width:100%;padding:12px;border:1px solid #071A39;font:inherit;min-height:90px}.bs-chk{display:flex;gap:8px;align-items:flex-start;font-weight:400!important}.bs-chk input{width:auto;min-height:auto;margin-top:4px}.bs-msg{font-weight:600;padding-top:10px}
.bs-proof{display:grid;grid-template-columns:1fr;gap:12px}.bs-proof figure{margin:0;border:1px solid #071A3933;background:#fff}.bs-proof img{width:100%;height:200px;object-fit:cover;object-position:top;display:block}.bs-proof figcaption{padding:12px;font-size:14px}.bs-net{background:#071A39;color:#fff;padding:20px}.bs-net a{color:#C8F55A;font-weight:600}
.bs-contact{display:grid;grid-template-columns:1fr;gap:8px;margin:16px 0}.bs-contact a{min-height:52px}
dialog.bs-dlg{border:1px solid #071A39;padding:0;max-width:440px;width:calc(100% - 24px)}dialog.bs-dlg::backdrop{background:#071A39b3}.bs-dlg form{padding:18px}.bs-dlg h3{font:600 1.3rem Fraunces,serif;margin:0 0 4px}.bs-x{position:absolute;right:8px;top:8px;width:auto!important;margin:0!important;background:#fff!important;border:0!important;font-size:22px;cursor:pointer}
@media(min-width:640px){.bs-cards{grid-template-columns:1fr 1fr}.bs-blocks{grid-template-columns:1fr 1fr}.bs-contact{grid-template-columns:1fr 1fr}.bs-proof{grid-template-columns:1fr 1fr}}@media(min-width:1000px){.bs-cards{grid-template-columns:repeat(4,1fr)}.bs-blocks{grid-template-columns:repeat(5,1fr)}}`;

function stripDots(a: SeatAvailability): string {
  return a.categories.map((c) => `<span class="bs-dot ${c.status === "open" ? "o" : c.status === "unknown" ? "u" : ""}" title="${esc(c.label)}: ${c.status}"></span>`).join("");
}

export function renderSeatsStripHtml(a: SeatAvailability): string {
  const head =
    a.open === null
      ? `<span><b>Call to confirm</b> which of ${a.total} categories are open today</span>`
      : `<span><b data-testid="seats-open-count">${a.open} of ${a.total}</b> categories open</span>`;
  return `<div class="bs-strip" data-testid="availability-strip" data-source="${a.source}" data-open="${a.open ?? ""}">${head}<span class="bs-dots" aria-hidden="true">${stripDots(a)}</span><a href="#seats">Hold or lock yours</a><a href="${CONTACT.tel}">${CONTACT.phoneDisplay}</a><span class="bs-src">${esc(a.note)} One brand per category. Seats sell when a buyer locks them; we confirm every hold.</span></div>`;
}

export function renderFounderSnippetHtml(): string {
  const media = FOUNDER.videoUrl
    ? `<video controls preload="none" style="width:100%" src="${esc(FOUNDER.videoUrl)}"></video>`
    : `<small>${esc(FOUNDER.videoStatus)}</small>`;
  return `<div class="bs-founder" data-testid="founder-snippet"><span class="bs-eb" style="opacity:.8">Hear from the Founder</span><q>${esc(FOUNDER.quote)}</q><small>${esc(FOUNDER.name)}, ${esc(FOUNDER.title)}</small>${media}<a href="${FOUNDER.pageUrl}" target="_blank" rel="noopener">Hear Randy on the demand flywheel →</a></div>`;
}

function cardHtml(c: SeatAvailability["categories"][number], cur: Cur): string {
  const hold = SEAT_SKUS[0];
  const lock = SEAT_SKUS[1];
  const taken = c.status === "held" || c.status === "locked";
  const label = c.status === "open" ? "Open" : c.status === "held" ? "On hold" : c.status === "locked" ? "Locked" : "Call to confirm";
  const cls = c.status === "open" ? "open" : taken ? "taken" : "unknown";
  const btns = taken
    ? `<button type="button" class="bs-wait" data-action="waitlist" data-cat="${c.slug}">Join the waitlist</button>`
    : `<button type="button" data-action="hold" data-cat="${c.slug}">Hold 7 days · ${money(cur === "cad" ? hold.cad : hold.usd, cur)}</button><button type="button" class="bs-lock" data-action="lock" data-cat="${c.slug}">Lock seat · ${money(cur === "cad" ? lock.cad : lock.usd, cur)}</button>`;
  return `<article class="bs-card" data-testid="seat-card-${c.slug}" data-status="${c.status}"><span class="bs-st ${cls}">${label}</span><h3>${esc(c.label)}</h3><div class="bs-btns">${btns}</div></article>`;
}

export function renderSeatsSectionHtml(a: SeatAvailability, cur: Cur): string {
  const blocks = IMPRESSION_BLOCKS.map(
    (b) => `<div class="bs-block" data-testid="block-${b.key}"><span class="bs-eb">${esc(b.surfaceLabel)}</span><p style="margin:.3em 0;font-weight:600">${esc(b.name)} · ${b.views.toLocaleString("en-US")} views <span class="bs-st unknown">Estimate</span></p><strong>${money(cur === "cad" ? b.cad : b.usd, cur)}</strong><p class="bs-note">Starter rate: $${b.starterCpmUsd} CPM USD</p><button type="button" class="bs-btn" style="width:100%" data-action="block_request" data-block="${b.key}">Request this block</button></div>`,
  ).join("");
  const opts = SEAT_CATEGORIES.map((c) => `<option value="${c.slug}">${esc(c.label)}</option>`).join("");
  const proof = LIVE_HUB_EXAMPLES.map(
    (h) => `<figure><img src="${h.image}" alt="${esc(h.name)}" loading="lazy"><figcaption><b>${esc(h.name)}</b> <span class="bs-st open">Live</span><br>${esc(h.note)}${h.url ? ` <a href="${h.url}" target="_blank" rel="noopener">Open the hub</a>` : ""}</figcaption></figure>`,
  ).join("");
  return `<section class="bs" id="seats" data-testid="seats-section"><p class="bs-eb">Category seats · one brand per category</p><h2>Pick your category. Hold it or lock it.</h2>
<p>$190 holds a category for 7 days. $490 locks the named seat, all of it media credit. When a seat is taken, join the waitlist and we call you the moment it opens.</p>
<div class="bs-cards" data-testid="seat-cards">${a.categories.map((c) => cardHtml(c, cur)).join("")}</div>
<p class="bs-note">${esc(a.note)}</p>
<p class="bs-eb" style="margin-top:28px">Optional impression blocks · starter rates</p><h2>Add a block on one surface.</h2>
<div class="bs-blocks" data-testid="impression-blocks">${blocks}</div><p class="bs-note">${esc(BLOCK_NOTE)}</p>
<div class="grid" style="margin-top:28px"><div><p class="bs-eb">Request a category lock</p><h2>Want it locked before anyone else?</h2><p>Tell us the category and when you want to start. Randy and the sales team get it instantly and call you back, usually the same business day.</p>
<div class="bs-contact"><a class="bs-btn lime" href="${CONTACT.tel}" data-testid="cta-call">Call ${CONTACT.phoneDisplay}</a><a class="bs-btn" href="${CONTACT.mailto}" data-testid="cta-email">${CONTACT.email}</a></div></div>
<form class="bs-form" id="bs-lockform" data-testid="lock-request-form"><label>Category<select name="category" required>${opts}</select></label><label>Brand or business<input name="brand" required maxlength="160" autocomplete="organization"></label><label>Your name<input name="name" maxlength="120" autocomplete="name"></label><label>Work email<input name="email" type="email" required autocomplete="email"></label><label>Phone (optional)<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><label>Website (optional)<input name="website" maxlength="300" inputmode="url"></label><label>When do you want to start?<select name="timing"><option>This month</option><option>Next 30–60 days</option><option>Next quarter</option><option>Just exploring</option></select></label><label>Anything else (optional)<textarea name="message" maxlength="2000"></textarea></label><label class="bs-chk"><input type="checkbox" name="waitlist_if_taken" checked> If my category is taken, put me on the waitlist.</label><input name="company_url" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><button type="submit">Request a category lock</button><p class="bs-msg" role="status"></p></form></div>
<p class="bs-eb" style="margin-top:28px">Proof</p><h2>Real hubs. See the face before the flight.</h2>
<div class="bs-proof" data-testid="proof-section">${proof}</div>
<p><b>${esc(FACE_BEFORE_FLIGHT.title)}.</b> ${esc(FACE_BEFORE_FLIGHT.line)} <a href="${FACE_BEFORE_FLIGHT.href}">Read how</a></p>
<div class="bs-net" data-testid="network-section"><p style="margin:0 0 8px;font:400 1.2rem/1.4 Fraunces,serif">${esc(NETWORK.line)}</p><p style="margin:0"><a href="${NETWORK.mapUrl}" target="_blank" rel="noopener">See the local demand map</a> · postal-code map of trusted places and brand vibe estimates. ${esc(NETWORK.estimateNote)}</p></div>
</section>
<dialog class="bs-dlg" id="bs-dlg"><form method="dialog" id="bs-dlgform"><button class="bs-x" value="cancel" aria-label="Close" formnovalidate>×</button><h3 id="bs-dlgtitle">Hold this category</h3><p id="bs-dlgsub" class="bs-note"></p><label>Brand or business<input name="brand" required maxlength="160" autocomplete="organization"></label><label>Work email<input name="email" type="email" required autocomplete="email"></label><label>Phone (optional, fastest)<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><input name="company_url" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true"><button type="submit" id="bs-dlgbtn" value="default">Confirm</button><p class="bs-msg" role="status"></p><p class="bs-note">No charge today while checkout is being switched on. ${esc(HELD_MESSAGE)} Prefer to talk? <a href="${CONTACT.tel}">${CONTACT.phoneDisplay}</a></p></form></dialog>
<script>(function(){var CUR=${JSON.stringify(cur)},TEST=/[?&]seats_test=1/.test(location.search),CATS=${JSON.stringify(Object.fromEntries(SEAT_CATEGORIES.map((c) => [c.slug, c.label])))},BLOCKS=${JSON.stringify(Object.fromEntries(IMPRESSION_BLOCKS.map((b) => [b.key, `${b.name} · ${b.views.toLocaleString("en-US")} views`])))},T={hold:"Hold for 7 days · $190 look",lock:"Lock the named seat · $490",waitlist:"Join the waitlist",block_request:"Request this block"};
function saved(){try{return JSON.parse(localStorage.getItem("br_buyer")||"{}")}catch(e){return{}}}function save(d){try{localStorage.setItem("br_buyer",JSON.stringify({brand:d.brand,email:d.email,phone:d.phone}))}catch(e){}}
function utm(){var p=new URLSearchParams(location.search),o={};["utm_source","utm_medium","utm_campaign"].forEach(function(k){if(p.get(k))o[k]=p.get(k)});return o}
async function send(d,msg,btn){msg.textContent="Sending…";if(btn)btn.disabled=true;d.currency=CUR;d.path=location.pathname;d.utm=utm();if(TEST)d.test=true;try{var r=await fetch("/v1/seats/request",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(d)}),j=await r.json();if(j.checkout_url){location.assign(j.checkout_url);return}msg.textContent=r.ok?(j.message||"Saved."):(j.error||"Could not send. Call ${CONTACT.phoneDisplay}.");if(r.ok){save(d);if(window.plausible)plausible("seat_"+d.action)}}catch(e){msg.textContent="Could not send. Call ${CONTACT.phoneDisplay} or email ${CONTACT.email}."}if(btn)btn.disabled=false}
var dlg=document.getElementById("bs-dlg"),f=document.getElementById("bs-dlgform"),cur={};
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-action]");if(!b)return;cur={action:b.getAttribute("data-action"),category:b.getAttribute("data-cat")||undefined,block:b.getAttribute("data-block")||undefined};document.getElementById("bs-dlgtitle").textContent=T[cur.action];document.getElementById("bs-dlgsub").textContent=cur.category?CATS[cur.category]:BLOCKS[cur.block]||"";var s=saved();f.brand.value=s.brand||"";f.email.value=s.email||"";f.phone.value=s.phone||"";f.querySelector(".bs-msg").textContent="";document.getElementById("bs-dlgbtn").textContent=cur.action==="waitlist"?"Join the waitlist":cur.action==="block_request"?"Request block":"Confirm "+(cur.action==="hold"?"hold":"lock");if(dlg.showModal)dlg.showModal();else dlg.setAttribute("open","")});
f.addEventListener("submit",function(e){if(e.submitter&&e.submitter.value==="cancel")return;e.preventDefault();if(!f.reportValidity())return;var d=Object.assign({},cur,{brand:f.brand.value,email:f.email.value,phone:f.phone.value,company_url:f.company_url.value});send(d,f.querySelector(".bs-msg"),document.getElementById("bs-dlgbtn"))});
var lf=document.getElementById("bs-lockform");lf.addEventListener("submit",function(e){e.preventDefault();var d=Object.fromEntries(new FormData(lf));d.action="lock_request";d.sku="reserve-490";d.waitlist_if_taken=!!lf.waitlist_if_taken.checked;send(d,lf.querySelector(".bs-msg"),lf.querySelector("button[type=submit]"))});
var s=saved();if(s.brand)lf.brand.value=s.brand;if(s.email)lf.email.value=s.email;})();</script>`;
}

/** Five-surface starter rate card + public channel ranges, for /buycalc. */
export function renderRateCardHtml(surfaces: readonly { label: string; cpmStarter: readonly [number, number]; cpcStarter: readonly [number, number] }[], channels: readonly { label: string; cpm: readonly [number, number] | null; cpc: readonly [number, number] | null }[]): string {
  const rows = surfaces.map((s) => `<tr><td>${esc(s.label)}</td><td><b>from $${s.cpmStarter[0]}</b> CPM</td><td>from $${s.cpcStarter[0].toFixed(2)} CPC</td></tr>`).join("");
  const ch = channels.map((c) => `<tr><td>${esc(c.label)}</td><td>${c.cpm ? `$${c.cpm[0]}–${c.cpm[1]}` : "—"}</td><td>${c.cpc ? `$${c.cpc[0].toFixed(2)}–${c.cpc[1].toFixed(2)}` : "—"}</td></tr>`).join("");
  return `<section class="bs" id="rate-card" data-testid="buycalc-rate-card"><p class="bs-eb">Rate card · starter rates (USD)</p><h2>Five surfaces. Starter prices, visible.</h2><div style="overflow-x:auto"><table class="bs-rate"><thead><tr><th>Surface</th><th>Display</th><th>CPC</th></tr></thead><tbody>${rows}</tbody></table></div><p><b>Prove it, then we raise.</b> New placements open at starter rates. A rate only moves up after your reporting shows the placement works, and a locked deposit keeps its rate for its term.</p><p class="bs-eb" style="margin-top:18px">Open channels · public 2026 benchmark ranges</p><div style="overflow-x:auto"><table class="bs-rate"><thead><tr><th>Channel</th><th>Typical CPM</th><th>Typical CPC</th></tr></thead><tbody>${ch}</tbody></table></div><p class="bs-note">Starter rates are planning estimates, not measured Birch results. Channel figures are public 2026 benchmark ranges for health and wellness, shown for comparison only. No reach, click-through or impression guarantee; aggregate reporting only.</p></section>`;
}
