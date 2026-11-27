/**
 * Proof content as plain data + server-rendered HTML (Randy t450u, Nov 21 2026).
 * Why: the SPA shell used to ship only a one-line stub inside #root, so any reader that does not run scripts
 * (AI reviewers, crawlers, plain fetches) never saw "How we got here", the Track record strip or the GTM block.
 * The same data feeds the React components, the no-JS HTML shell (proofShellHtml) and llms.txt / llms-full.txt.
 * Visitor rules kept: no tool, company or client names, no counts, no guarantees, internal and unaudited labels.
 */
import { TRACK_RECORD } from "./trackRecord";
import { GTM_SETUP } from "./gtmSetup";
import { PERFORMANCE_ONLY, PERF_ONLY_HREF, PERF_ONLY_URL } from "./performanceOnly";

export const HOW_WE_GOT_HERE = {
  eyebrow: "How we got here",
  steps: [
    "We tested post-checkout and retail-adjacent surfaces and saw strong engagement across categories.",
    "Seeing how well captive audiences convert after purchase, we started talking with a lot of recovery brands.",
    "We asked: what if an organic, service co-branded layer made the post-purchase moment free and valuable, and helped brands sell more of their own products through a trusted clinic layer?",
    "From there, it rapidly opened up lots of captive cross-promotional audiences who wanted to work together.",
    "Brands will share audiences with each other when there's a mutual reason to. Co-branded clinic layers became that reason.",
    "We rolled that into something bigger: one combined private audience.",
    "Then we added more ways to activate, like our Street Team, on-site and door to door.",
    "We started in recovery, built on our team's experience opening and scaling digital-first clinics, with vertical integration to curate providers quickly.",
    "That clinic layer became the foundation. Clinic layers are now turning into inventory that can be monetized immediately, at low or zero incremental cost to the brand.",
    "The same systems and B2B go-to-market discipline — powered by Silver Birch Growth Inc. for rare strategic portfolio work — now sit behind our ad product.",
  ],
  note: "Internal testing that informed the product, not campaign results or current sold performance.",
  cta: "Start with the $190 USD 7-day look",
  more: "See the full story",
  less: "Show less",
} as const;


/**
 * Estimated performance ranges (Randy pt453u, Nov 21 2026). BRANCH ONLY until Randy approves.
 * Ranges only, never a promise and never Birch results. Basis: (1) what we've observed on comparable post-purchase ad
 * installations and (2) published industry research (cited in RANGE_SOURCES). Never name the source of the installation data.
 */
export const RANGES_LABEL = "Estimated range, based on comparable installations and industry research, not a guarantee or Birch results";
export const RANGE_SCALE_MAX = 10;
type RangeBand = { lo: number; hi: number; hwLo: number; hwHi: number };
export const RANGE_METRICS = [
  { key: "ctr", label: "CTR" },
  { key: "engagement", label: "Engagement" },
  { key: "conversion", label: "Post-click conversion" },
] as const;
export const PERFORMANCE_RANGES = {
  eyebrow: "Estimated performance ranges",
  title: "What comparable placements have seen.",
  lede: "Conservative bands for the moments right after a purchase. Health and wellness is marked inside each band.",
  rows: [
    { placement: "Post-purchase", ctr: { lo: 2, hi: 5, hwLo: 3, hwHi: 5 }, engagement: { lo: 4, hi: 7, hwLo: 5, hwHi: 7 }, conversion: { lo: 4, hi: 8, hwLo: 5, hwHi: 8 } },
    { placement: "Thank-you page", ctr: { lo: 1, hi: 3, hwLo: 1.5, hwHi: 3 }, engagement: { lo: 2, hi: 5, hwLo: 3, hwHi: 5 }, conversion: { lo: 3, hi: 6, hwLo: 4, hwHi: 6 } },
    { placement: "Activation (clinic layer home, member dashboard)", ctr: { lo: 0.5, hi: 2, hwLo: 1, hwHi: 2 }, engagement: { lo: 1, hi: 3, hwLo: 1.5, hwHi: 3 }, conversion: { lo: 2, hi: 5, hwLo: 3, hwHi: 5 } },
  ] as readonly { placement: string; ctr: RangeBand; engagement: RangeBand; conversion: RangeBand }[],
  hwLabel: "Health and wellness",
  note: "Observed on comparable post-purchase ad installations, then checked against published research. Your results depend on offer, creative and audience.",
} as const;
export const fmtPct = (n: number) => `${n}%`;
export const fmtRange = (b: { lo: number; hi: number }) => `${b.lo}% to ${b.hi}%`;
export const RANGE_SOURCES = [
  { label: "Rokt Ads: 4.03% average CTR and 6.32% conversion at checkout and confirmation moments (vendor-reported)", url: "https://www.rokt.com/products/rokt-ads" },
  { label: "Rokt Thanks: 5.6% average positive engagement on confirmation pages (vendor-reported)", url: "https://www.rokt.com/products/rokt-thanks" },
  { label: "Klarna with Rokt: 5.2% US CTR on post-transaction offers", url: "https://www.rokt.com/case-studies/klarna-unlocks-scalable-growth-with-rokt" },
  { label: "AMC Theatres with Rokt: 8.9% engagement and 9.6% conversion on confirmation offers", url: "https://www.rokt.com/case-studies/how-amc-theatres-unlocks-more-value-from-every-transaction" },
  { label: "Zipify, 123.9M offer views: post-purchase offers 8.7% accepted (7.4% median store), thank-you page 2.4%", url: "https://zipify.com/blog-upsell-acceptance-rates-report/" },
  { label: "Upsell.com (ReConvert) 2023 report: post-purchase upsell 4.7% average, thank-you page 1.7%", url: "https://upsell.com/blog/the-impact-of-post-purchase-upselling-2023" },
  { label: "Candy Rack, 3,199 stores: thank-you page median take rate 0.7% (P25 to P75 0.3% to 1.5%)", url: "https://www.digismoothie.com/blog/upsell-benchmarks" },
  { label: "Focus Digital 2025: programmatic display CTR, health and wellness 0.47%", url: "https://focus-digital.co/programmatic-display-ctr-benchmarks-2025-report/" },
  { label: "MDMPPC 2023 to 2025: health and wellness Google Ads CTR 1.2% to 1.4%, conversion 6.0% to 9.5% (search-led, so we sit lower)", url: "https://mdmppc.com/google-ads-benchmarks/health-wellness/" },
] as const;

export const FLIGHT_REPORT_HREF = "/account/login";
export const FLIGHT_REPORT_EXAMPLE = {
  eyebrow: "What your flight report shows",
  watermark: "Example report · illustrative numbers, not results",
  title: "One aggregate card per flight.",
  soon: "First measured flight reports coming soon. Here's exactly what yours will show.",
  lede: "After a flight you see totals, pacing and where views came from. Aggregate only. No names, no user-level rows, no health data.",
  stats: [
    { k: "Impressions", v: "10,000" },
    { k: "Clicks", v: "100" },
    { k: "CTR", v: "1.0%" },
    { k: "Spend vs credit", v: "$250 of $500" },
  ],
  pacing: { label: "Pacing", pct: 50, note: "On pace: half the credit used, half the flight elapsed." },
  surfaces: [
    { k: "Post-purchase", pct: 40 },
    { k: "Clinic layer home", pct: 30 },
    { k: "Product and services pages", pct: 20 },
    { k: "Member dashboard", pct: 10 },
  ],
  note: "Round numbers for illustration only. Real reports show measured aggregates, and no results are guaranteed.",
  cta: "Open the buyer dashboard",
} as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function howHtml(): string {
  return `<section data-ssr="how-we-got-here"><h2>${esc(HOW_WE_GOT_HERE.eyebrow)}</h2><ol>${HOW_WE_GOT_HERE.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p>${esc(HOW_WE_GOT_HERE.note)}</p></section>`;
}
function trackHtml(): string {
  return `<section data-ssr="track-record"><h2>${esc(TRACK_RECORD.eyebrow)}: ${esc(TRACK_RECORD.title)}</h2><ul>${TRACK_RECORD.cards.map((c) => `<li><strong>${esc(c.stat)}</strong> (${esc(c.tag)}) ${esc(c.outcome)} ${esc(c.detail)}</li>`).join("")}</ul><p>${esc(TRACK_RECORD.note)}</p></section>`;
}
function gtmHtml(): string {
  return `<section data-ssr="gtm-setup"><h2>${esc(GTM_SETUP.eyebrow)}</h2><h3>${esc(GTM_SETUP.title)}</h3><p>${esc(GTM_SETUP.sub)}</p><ul>${GTM_SETUP.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul><p>${esc(GTM_SETUP.separate)}</p></section>`;
}
function reportHtml(): string {
  const r = FLIGHT_REPORT_EXAMPLE;
  return `<section data-ssr="flight-report"><h2>${esc(r.eyebrow)}</h2><p><strong>${esc(r.watermark)}</strong></p><p>${esc(r.soon)}</p><p>${esc(r.lede)}</p><ul>${r.stats.map((s) => `<li>${esc(s.k)}: ${esc(s.v)}</li>`).join("")}<li>${esc(r.pacing.label)}: ${r.pacing.pct}%. ${esc(r.pacing.note)}</li>${r.surfaces.map((s) => `<li>${esc(s.k)}: ${s.pct}% of views</li>`).join("")}</ul><p>${esc(r.note)} <a href="${FLIGHT_REPORT_HREF}">${esc(r.cta)}</a></p></section>`;
}

function rangesHtml(): string {
  const r = PERFORMANCE_RANGES;
  return `<section data-ssr="performance-ranges"><h2>${esc(r.eyebrow)}</h2><p><strong>${esc(RANGES_LABEL)}</strong></p><p>${esc(r.lede)}</p><ul>${r.rows.map((x) => `<li>${esc(x.placement)}: CTR ${fmtRange(x.ctr)}; engagement ${fmtRange(x.engagement)}; post-click conversion ${fmtRange(x.conversion)}. ${esc(r.hwLabel)}: CTR ${x.ctr.hwLo}% to ${x.ctr.hwHi}%, engagement ${x.engagement.hwLo}% to ${x.engagement.hwHi}%, conversion ${x.conversion.hwLo}% to ${x.conversion.hwHi}%.</li>`).join("")}</ul><p>${esc(r.note)}</p><ul>${RANGE_SOURCES.map((x) => `<li><a href="${x.url}" rel="noopener nofollow">${esc(x.label)}</a></li>`).join("")}</ul></section>`;
}

function perfOnlyHtml(): string {
  const r = PERFORMANCE_ONLY;
  return `<section data-ssr="performance-only"><h2>${esc(r.eyebrow)}</h2><h3>${esc(r.title)}</h3><p>${esc(r.sub)}</p><ul>${r.spots.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><ol>${r.steps.map((x) => `<li><strong>${esc(x.t)}.</strong> ${esc(x.d)}</li>`).join("")}</ol><ul>${r.details.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p><a href="${PERF_ONLY_HREF}">${esc(r.cta)}</a></p></section>`;
}

/** Text-only blocks injected inside #root for "/" and "/media-kit". React replaces them on mount. */
export function proofShellHtml(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/media-kit") return howHtml() + trackHtml() + gtmHtml() + reportHtml() + rangesHtml() + perfOnlyHtml();
  return "";
}

/** Inject the proof blocks into the SPA shell's #root stub (before its closing </div>). */
export function withProofShell(html: string, pathname: string): string {
  const extra = proofShellHtml(pathname);
  if (!extra) return html;
  return html.replace(/(<div id="root"><main>[\s\S]*?)(<\/main><\/div>)/, (_m, a: string, b: string) => `${a}${extra}${b}`);
}

/** Plain-text section for llms.txt and llms-full.txt. */
export function llmsProofSection(): string {
  const r = FLIGHT_REPORT_EXAMPLE;
  return [
    "",
    "## How we got here (internal testing, not campaign results)",
    ...HOW_WE_GOT_HERE.steps.map((s, i) => `${i + 1}. ${s}`),
    HOW_WE_GOT_HERE.note,
    "",
    "## Track record (team and portfolio, anonymous, internally reported and unaudited)",
    ...TRACK_RECORD.cards.map((c) => `- ${c.stat} · ${c.tag}: ${c.outcome} ${c.detail}`),
    TRACK_RECORD.note,
    "",
    "## B2B go-to-market, powered by Silver Birch Growth Inc. (not for sale)",
    `- ${GTM_SETUP.eyebrow}. ${GTM_SETUP.title} ${GTM_SETUP.sub}`,
    ...GTM_SETUP.notes.map((n) => `- ${n}`),
    `- ${GTM_SETUP.separate}`,
    "",
    "## What your flight report shows (example, illustrative numbers, not results)",
    `- ${r.watermark}`,
    `- ${r.soon}`,
    `- ${r.lede}`,
    `- ${r.stats.map((s) => `${s.k}: ${s.v}`).join(" · ")}`,
    `- ${r.pacing.label}: ${r.pacing.pct}%. ${r.pacing.note}`,
    `- By surface: ${r.surfaces.map((s) => `${s.k} ${s.pct}%`).join(", ")}`,
    `- ${r.note} Buyer dashboard: https://birchreserve.net${FLIGHT_REPORT_HREF}`,
    "",
    "## Estimated performance ranges (not a guarantee, not Birch results)",
    `- ${RANGES_LABEL}`,
    ...PERFORMANCE_RANGES.rows.map((x) => `- ${x.placement}: CTR ${fmtRange(x.ctr)}; engagement ${fmtRange(x.engagement)}; post-click conversion ${fmtRange(x.conversion)}. Health and wellness: CTR ${x.ctr.hwLo}% to ${x.ctr.hwHi}%, engagement ${x.engagement.hwLo}% to ${x.engagement.hwHi}%, conversion ${x.conversion.hwLo}% to ${x.conversion.hwHi}%.`),
    `- ${PERFORMANCE_RANGES.note}`,
    "- Sources:",
    ...RANGE_SOURCES.map((x) => `  - ${x.label}: ${x.url}`),
    "",
    "## Performance only (your own site, no clinic layer layer)",
    `- ${PERFORMANCE_ONLY.title} ${PERFORMANCE_ONLY.sub}`,
    `- Where our code goes: ${PERFORMANCE_ONLY.spots.join(", ")}.`,
    ...PERFORMANCE_ONLY.steps.map((s) => `- ${s.n}. ${s.t}: ${s.d}`),
    ...PERFORMANCE_ONLY.details.map((d) => `- ${d}`),
    `- Start: ${PERF_ONLY_URL}`,
  ].join("\n");
}
