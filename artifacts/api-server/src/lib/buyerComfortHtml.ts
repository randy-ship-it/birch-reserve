/** Server-rendered HTML for the buyer-comfort additions on /buycalc. Copy lives in ./buyerComfort. */
import {
  BUYER_FAQ,
  EARLY_SLOTS,
  FLIGHT_TIMELINE,
  LIVE_HUB_LINKS,
  SAMPLE_IO_HREF,
  SAMPLE_IO_LINKS,
  SEE_THE_UNIT,
  SEE_THE_UNIT_IMAGE,
  CREATIVE_BRIEF_HREF,
  BUYER_FAQ_TITLE,
  DUAL_MOTION,
  REQUEST_HREF,
  SALES_EMAIL,
  SALES_PHONE_DISPLAY,
  SALES_PHONE_HREF,
} from "./buyerComfort";

/**
 * /buycalc never says "exclusive" (Randy, Nov 14 2026; publicSeo test). The same shared-seat
 * facts are worded as "open to more than one brand" here; /media-kit keeps "not exclusive".
 */
export function buycalcWording(s: string): string {
  return s
    .replaceAll("Is my category exclusive or shared?", "Is my category mine alone, or shared?")
    .replaceAll("Shared, not exclusive.", "Shared, open to more than one brand.")
    .replaceAll("shared, not exclusive", "shared, open to more than one brand")
    .replaceAll("Category exclusivity comes with exclusive display", "Locking a category to one brand comes with exclusive display");
}

const escRaw = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const esc = (s: string) => escRaw(buycalcWording(s));

export const BUYER_COMFORT_CSS = `.unit{display:grid;grid-template-columns:1fr 1.1fr;gap:28px;align-items:start}.unit figure{margin:0;border:1px solid #071A39;background:#fff;padding:8px}.unit img{display:block;width:100%;height:auto}.unit figcaption{font-size:12px;opacity:.75;margin-top:6px}.unit ul{padding-left:18px;margin:10px 0}.unit li{margin:6px 0}.illus{display:inline-block;background:#C8F55A;color:#071A39;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:2px 8px;margin-bottom:8px}
.steps{list-style:none;padding:0;margin:18px 0 0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.steps li{background:#fff;border:1px solid #071A39;padding:16px}.steps .n{font-family:Fraunces,Georgia,serif;font-size:28px;opacity:.45}.steps h3{font-size:19px;margin:4px 0 6px}.steps p{margin:0;font-size:14px}
.rail{margin-top:18px;border-top:2px solid #071A39;padding-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.rail div{font-size:14px}.rail strong{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase}.rail strong:before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:#C8F55A;border:2px solid #071A39;margin-right:6px;vertical-align:-1px}
.faq .qa{max-width:820px;border-top:1px solid #071A39;margin-top:18px}.faq details{border-bottom:1px solid rgba(7,26,57,.18)}.faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 2px;font-weight:600;font-size:16px;min-height:48px}.faq summary::-webkit-details-marker{display:none}.faq summary:after{content:"+";font:400 24px/1 Fraunces,Georgia,serif;flex:none;transition:transform .15s}.faq details[open] summary:after{transform:rotate(45deg)}.faq details p{margin:0 0 18px;padding:0 36px 0 2px;font-size:15px;opacity:.85}
.hero-sub{font-size:clamp(1.05rem,2.4vw,1.3rem);max-width:680px;margin:14px 0 18px;opacity:.9}
.hero-inquire{margin:18px 0 0;font-weight:600}.hero-inquire a{color:#C8F55A;text-underline-offset:4px}
.offers-io{margin:14px 0 0;font-size:14px;opacity:.8}
.shared-note{margin:10px 0 0;font-size:14px;max-width:720px;opacity:.85}
.io-link{font-size:13px;margin:8px 0 0}
@media (max-width:760px){.unit,.steps,.rail{grid-template-columns:1fr}}`;

/** 2. See the unit before you lock. */
export function seeTheUnitHtml(lookPrice: string, seatPrice: string): string {
  const swap = (s: string) => s.replaceAll("$190 USD", lookPrice).replaceAll("$490 USD", seatPrice);
  const hubs = LIVE_HUB_LINKS.map((h) => `<a href="${h.href}" target="_blank" rel="noopener">${esc(h.label)}</a>`).join(" and ");
  const gets = [
    esc(SEE_THE_UNIT.gets[0]),
    `${esc(SEE_THE_UNIT.gets[1])} ${hubs}.`,
    `The <a href="${CREATIVE_BRIEF_HREF}">creative brief</a> and the <a href="${SAMPLE_IO_HREF}">sample insertion order</a>, so you know what the next step asks for.`,
    `A real person: <a href="tel:+16479316278">(647) 931-6278</a> or <a href="mailto:randy@scalehealth.ca">randy@scalehealth.ca</a>.`,
  ];
  return `<section class="band" id="see-the-unit" data-testid="see-the-unit"><div class="wrap"><p class="kicker">${esc(SEE_THE_UNIT.kicker)}</p><h2>${esc(SEE_THE_UNIT.title)}</h2>
<div class="unit"><div><p>${esc(swap(SEE_THE_UNIT.body))}</p><p><strong>${esc(SEE_THE_UNIT.getTitle)}</strong></p><ul>${gets.map((g) => `<li>${g}</li>`).join("")}</ul><p>${esc(swap(SEE_THE_UNIT.decide))}</p></div>
<figure><span class="illus">Illustrative</span><img src="${SEE_THE_UNIT_IMAGE}" alt="${esc(SEE_THE_UNIT.imageAlt)}" width="1280" height="970" loading="lazy" decoding="async"><figcaption>${esc(SEE_THE_UNIT.caption)}</figcaption></figure></div>
</div></section>`;
}

/** 1. How a test dollar becomes a flight. */
export function flightTimelineHtml(lookPrice: string, seatPrice: string): string {
  const swap = (s: string) => s.replaceAll("$190 USD", lookPrice).replaceAll("$490 USD", seatPrice);
  return `<section class="band" id="flight" data-testid="flight-timeline"><div class="wrap"><p class="kicker">${esc(FLIGHT_TIMELINE.kicker)}</p><h2>${esc(FLIGHT_TIMELINE.title)}</h2>
<ol class="steps">${FLIGHT_TIMELINE.steps.map((s) => `<li><span class="n">${s.n}</span><h3>${esc(s.t)}</h3><p>${esc(swap(s.d))}</p></li>`).join("")}</ol>
<p class="kicker" style="margin-top:22px">${esc(FLIGHT_TIMELINE.refundTitle)}</p>
<div class="rail">${FLIGHT_TIMELINE.refunds.map((r) => `<div><strong>${esc(r.k)}</strong>${esc(swap(r.d))}</div>`).join("")}</div>
<p class="io-link"><a href="${SAMPLE_IO_HREF}">Read the sample insertion order</a></p>
</div></section>`;
}

/** 5. Note beside the checkout terms checkbox. */
export function sampleIoCheckoutHtml(): string {
  return `<p class="fine io-link" data-testid="checkout-sample-io">${esc(SAMPLE_IO_LINKS.checkoutLead)} <a href="${SAMPLE_IO_HREF}">${esc(SAMPLE_IO_LINKS.checkoutLabel)}</a>.</p>`;
}

/** 3. Five questions buyers ask. */
export function buyerFaqHtml(lookPrice: string, seatPrice: string): string {
  const swap = (s: string) => s.replaceAll("$190 USD", lookPrice).replaceAll("$490 USD", seatPrice);
  return `<section class="band faq" id="buyer-faq" data-testid="buyer-faq"><div class="wrap"><p class="kicker">Questions</p><h2>${esc(BUYER_FAQ_TITLE)}</h2>
<div class="qa">${BUYER_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(swap(f.a))}${f.link ? ` <a href="${f.link.href}">${esc(f.link.label)}</a>.` : ""}</p></details>`).join("\n")}</div>
</div></section>`;
}

/** A1: subhead under the /buycalc H1. */
export function heroSubHtml(lookPrice: string, seatPrice: string): string {
  return `<p class="hero-sub" data-testid="hero-sub">${esc(DUAL_MOTION.heroSub.replaceAll("$190 USD", lookPrice).replaceAll("$490 USD", seatPrice))}</p>`;
}

/** A2: secondary inquire link plus the contact line, under the self-serve buttons. */
export function heroInquireHtml(): string {
  return `<p class="hero-inquire" data-testid="hero-inquire"><a href="#request">${esc(DUAL_MOTION.inquireLabel)} →</a></p>
<p class="hero-contact">Or call <a href="${SALES_PHONE_HREF}">${SALES_PHONE_DISPLAY}</a> ${esc(DUAL_MOTION.callBack)} · <a href="mailto:${SALES_EMAIL}?subject=Birch%20Reserve%20seat">${SALES_EMAIL}</a></p>`;
}

/** B1: sample IO line under the offer cards. */
export function offersSampleIoHtml(): string {
  return `<p class="offers-io" data-testid="offers-sample-io">${esc(DUAL_MOTION.sampleIoLead)} <a href="${SAMPLE_IO_HREF}">${esc(DUAL_MOTION.sampleIoLabel)}</a> ${esc(DUAL_MOTION.sampleIoTail)}</p>`;
}

/** A4 merged with the early-slots strap: one line in the network section. */
export function sharedSeatsHtml(): string {
  return `<p class="shared-note" data-testid="shared-seats"><strong>${esc(EARLY_SLOTS.label)}.</strong> ${esc(DUAL_MOTION.sharedBuycalc)}</p>`;
}

/** B3: sentence added to the live hub proof line. */
export function liveHubTalkHtml(): string {
  return ` ${esc(DUAL_MOTION.liveHubLead)} <a href="${REQUEST_HREF.replace("/buycalc", "")}">Ask about a placement</a> or call <a href="${SALES_PHONE_HREF}">${SALES_PHONE_DISPLAY}</a>.`;
}
