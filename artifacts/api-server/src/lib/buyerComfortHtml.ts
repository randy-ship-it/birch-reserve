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
    .replaceAll("Category exclusivity is only available as a premium slot", "Locking a category to one brand is only available as a premium slot");
}

const escRaw = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const esc = (s: string) => escRaw(buycalcWording(s));

export const BUYER_COMFORT_CSS = `.early{margin:-8px 0 18px;font-size:14px;max-width:640px;opacity:.85}.early strong{color:#C8F55A}
.unit{display:grid;grid-template-columns:1fr 1.1fr;gap:28px;align-items:start}.unit figure{margin:0;border:1px solid #071A39;background:#fff;padding:8px}.unit img{display:block;width:100%;height:auto}.unit figcaption{font-size:12px;opacity:.75;margin-top:6px}.unit ul{padding-left:18px;margin:10px 0}.unit li{margin:6px 0}.illus{display:inline-block;background:#C8F55A;color:#071A39;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:2px 8px;margin-bottom:8px}
.steps{list-style:none;padding:0;margin:18px 0 0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.steps li{background:#fff;border:1px solid #071A39;padding:16px}.steps .n{font-family:Fraunces,Georgia,serif;font-size:28px;opacity:.45}.steps h3{font-size:19px;margin:4px 0 6px}.steps p{margin:0;font-size:14px}
.rail{margin-top:18px;border-top:2px solid #071A39;padding-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.rail div{font-size:14px}.rail strong{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase}.rail strong:before{content:"";display:inline-block;width:10px;height:10px;border-radius:50%;background:#C8F55A;border:2px solid #071A39;margin-right:6px;vertical-align:-1px}
.faq details{background:#fff;border:1px solid #071A39;padding:14px 16px;margin:8px 0}.faq summary{cursor:pointer;font-weight:600}.faq details p{margin:10px 0 0;font-size:15px}
.io-link{font-size:13px;margin:8px 0 0}
@media (max-width:760px){.unit,.steps,.rail{grid-template-columns:1fr}}`;

/** 6. Strap under the hero's "Limited early placements" line. */
export function earlySlotsHtml(): string {
  return `<p class="early" data-testid="early-slots"><strong>${esc(EARLY_SLOTS.label)}.</strong> ${esc(EARLY_SLOTS.line)}</p>`;
}

/** 2. See the unit before you lock. */
export function seeTheUnitHtml(lookPrice: string, seatPrice: string): string {
  const swap = (s: string) => s.replaceAll("$190 USD", lookPrice).replaceAll("$490 USD", seatPrice);
  const hubs = LIVE_HUB_LINKS.map((h) => `<a href="${h.href}" target="_blank" rel="noopener">${esc(h.label)}</a>`).join(" and ");
  const gets = [
    esc(SEE_THE_UNIT.gets[0]),
    `${esc(SEE_THE_UNIT.gets[1])} ${hubs}.`,
    `The <a href="${CREATIVE_BRIEF_HREF}">creative brief</a> and the <a href="${SAMPLE_IO_HREF}">sample insertion order</a>, so you know what the next step asks for.`,
    `A real person: <a href="tel:+16479316278">(647) 931-6278</a> or <a href="mailto:sales@silverbirchgrowth.com">sales@silverbirchgrowth.com</a>.`,
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

/** 5. Extra "Plain terms." bullet. */
export function sampleIoFactHtml(): string {
  return `<li>${esc(SAMPLE_IO_LINKS.factLead)} <a href="${SAMPLE_IO_HREF}">${esc(SAMPLE_IO_LINKS.factLabel)}</a>.</li>`;
}

/** 5. Note beside the checkout terms checkbox. */
export function sampleIoCheckoutHtml(): string {
  return `<p class="fine io-link" data-testid="checkout-sample-io">${esc(SAMPLE_IO_LINKS.checkoutLead)} <a href="${SAMPLE_IO_HREF}">${esc(SAMPLE_IO_LINKS.checkoutLabel)}</a>.</p>`;
}

/** 3. Five questions buyers ask. */
export function buyerFaqHtml(lookPrice: string, seatPrice: string): string {
  const swap = (s: string) => s.replaceAll("$190 USD", lookPrice).replaceAll("$490 USD", seatPrice);
  return `<section class="band faq" id="buyer-faq" data-testid="buyer-faq"><div class="wrap"><p class="kicker">Questions</p><h2>Five questions buyers ask.</h2>
${BUYER_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(swap(f.a))}${f.link ? ` <a href="${f.link.href}">${esc(f.link.label)}</a>.` : ""}</p></details>`).join("\n")}
</div></section>`;
}
