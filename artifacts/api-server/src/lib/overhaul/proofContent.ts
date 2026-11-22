/**
 * Proof content as plain data + server-rendered HTML (Randy t450u, Nov 21 2026).
 * Why: the SPA shell used to ship only a one-line stub inside #root, so any reader that does not run scripts
 * (AI reviewers, crawlers, plain fetches) never saw "How we got here", the Track record strip or the GTM block.
 * The same data feeds the React components, the no-JS HTML shell (proofShellHtml) and llms.txt / llms-full.txt.
 * Visitor rules kept: no tool, company or client names, no counts, no guarantees, internal and unaudited labels.
 */
import { TRACK_RECORD } from "./trackRecord";
import { GTM_SETUP } from "./gtmSetup";

export const HOW_WE_GOT_HERE = {
  eyebrow: "How we got here",
  steps: [
    "We tested post-checkout and retail-adjacent surfaces and saw strong engagement across categories.",
    "Seeing how well captive audiences convert after purchase, we started talking with a lot of recovery brands.",
    "We asked: what if an organic, service co-branded layer made the post-purchase moment free and valuable, and helped brands sell more of their own products through a trusted clinic layer?",
    "From there, it rapidly opened up lots of captive cross-promotional audiences who wanted to work together.",
    "Brands will share audiences with each other when there's a mutual reason to. Co-branded hubs became that reason.",
    "We rolled that into something bigger: one combined private audience.",
    "Then we added more ways to activate, like our Street Team, on-site and door to door.",
    "We started in recovery, built on our team's experience opening and scaling digital-first clinics, with vertical integration to curate providers quickly.",
    "That clinic layer became the foundation. Hubs are now turning into inventory that can be monetized immediately, at low or zero incremental cost to the brand.",
    "The same systems and GTM expertise we use to sign and onboard partners now power our ad product and the $3,500+ USD partnership bot setup.",
  ],
  note: "Internal testing that informed the product, not campaign results or current sold performance.",
  cta: "Start with the $190 USD 7-day look",
  more: "See the full story",
  less: "Show less",
} as const;

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
    { k: "Hub home", pct: 30 },
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
  return `<section data-ssr="gtm-setup"><h2>${esc(GTM_SETUP.eyebrow)}</h2><h3>${esc(GTM_SETUP.title)}</h3><p>${esc(GTM_SETUP.sub)}</p><ol>${GTM_SETUP.steps.map((s) => `<li><strong>${esc(s.t)}.</strong> ${esc(s.d)}</li>`).join("")}</ol><ul>${GTM_SETUP.cases.map((c) => `<li>${esc(c)}</li>`).join("")}</ul><p>${esc(GTM_SETUP.casesNote)} ${esc(GTM_SETUP.separate)}</p><p><a href="/intake/gtm">${esc(GTM_SETUP.cta)}</a></p></section>`;
}
function reportHtml(): string {
  const r = FLIGHT_REPORT_EXAMPLE;
  return `<section data-ssr="flight-report"><h2>${esc(r.eyebrow)}</h2><p><strong>${esc(r.watermark)}</strong></p><p>${esc(r.soon)}</p><p>${esc(r.lede)}</p><ul>${r.stats.map((s) => `<li>${esc(s.k)}: ${esc(s.v)}</li>`).join("")}<li>${esc(r.pacing.label)}: ${r.pacing.pct}%. ${esc(r.pacing.note)}</li>${r.surfaces.map((s) => `<li>${esc(s.k)}: ${s.pct}% of views</li>`).join("")}</ul><p>${esc(r.note)} <a href="${FLIGHT_REPORT_HREF}">${esc(r.cta)}</a></p></section>`;
}

/** Text-only blocks injected inside #root for "/" and "/media-kit". React replaces them on mount. */
export function proofShellHtml(pathname: string): string {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/media-kit") return howHtml() + trackHtml() + gtmHtml() + reportHtml();
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
    "## GTM setup packages (separate from the ad product)",
    `- ${GTM_SETUP.eyebrow}. ${GTM_SETUP.title} ${GTM_SETUP.sub}`,
    ...GTM_SETUP.steps.map((s) => `- ${s.n}. ${s.t}: ${s.d}`),
    ...GTM_SETUP.cases.map((c) => `- ${c}`),
    `- ${GTM_SETUP.casesNote} ${GTM_SETUP.separate}`,
    "- Start: https://birchreserve.net/intake/gtm",
    "",
    "## What your flight report shows (example, illustrative numbers, not results)",
    `- ${r.watermark}`,
    `- ${r.soon}`,
    `- ${r.lede}`,
    `- ${r.stats.map((s) => `${s.k}: ${s.v}`).join(" · ")}`,
    `- ${r.pacing.label}: ${r.pacing.pct}%. ${r.pacing.note}`,
    `- By surface: ${r.surfaces.map((s) => `${s.k} ${s.pct}%`).join(", ")}`,
    `- ${r.note} Buyer dashboard: https://birchreserve.net${FLIGHT_REPORT_HREF}`,
  ].join("\n");
}
