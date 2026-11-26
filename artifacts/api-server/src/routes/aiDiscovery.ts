/**
 * /vs-google-ads (alias /how-fast) and /llms-full.txt. Standalone: no DB imports.
 */
import { Router, type IRouter } from "express";
import { POSITIONING, POSITIONING_FOLLOW, AI_MEASURED, AI_NETWORK_LINE, GOOGLE_SOURCES, HOW_FAST_PATH, VS_GOOGLE_PATH, jsonLdGraph, llmsFullTxt } from "../lib/aiDiscovery";
import { esc, shell } from "./blog";

const router: IRouter = Router();

export function renderVsGoogle(): string {
  const title = "Reserve ad placement in minutes: Birch Reserve vs a typical Google Ads start | Birch Reserve";
  const description =
    `${POSITIONING} ${POSITIONING_FOLLOW} Reserve your placement in minutes, with no multi-day account verification queue. Measured speed next to Google's own published timelines.`;
  const rows = GOOGLE_SOURCES.filter((s) => s.id !== "review2")
    .map((s) => `<tr><th scope="row">${esc(s.label)}</th><td>${esc(s.claim)}</td><td><a href="${s.url}" rel="noopener">Google source</a></td></tr>`)
    .join("");
  const body = `<div class="wrap wide"><section class="hero"><span class="kick">Speed</span>
<h1>Reserve your placement in minutes, not days of account checks</h1>
<p class="lede"><strong>${POSITIONING}</strong> ${POSITIONING_FOLLOW}</p>
<p class="lede">A typical Google Ads start can include account setup, billing and payment verification, advertiser verification and ad review. Birch Reserve skips the multi-day account verification queue: you pay, and the placement is reserved.</p>
<p class="meta">Measured ${AI_MEASURED}. Google figures are Google's own published timelines, linked below.</p>
<p class="net">${esc(AI_NETWORK_LINE)}</p></section>
<div class="tldr"><div><b>~10 s</b>From the Birch Reserve site to Stripe checkout (measured ${AI_MEASURED}).</div><div><b>~1 s</b>Home page load (measured ${AI_MEASURED}).</div><div><b>Up to 5 days</b>Google says new-account ad review can take up to 5 business days.</div></div>
<article>
<h2>What Birch Reserve measured</h2>
<ul><li>Checkout reaches Stripe in about 10 seconds from the site.</li><li>The home page loads in about 1 second.</li><li>One short intake or one payment page. No separate advertiser account to verify first.</li></ul>
<h2>What Google publishes</h2>
<table class="cmp"><thead><tr><th>Step</th><th>What Google says</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table>
<p>Also see Google's <a href="https://support.google.com/google-ads/answer/1722120" rel="noopener">ad review process</a> page. These are Google's published ranges, not a promise about any one account.</p>
<h2>Being straight about the comparison</h2>
<ul><li>A Birch Reserve purchase reserves your placement. It is not an ad that is already live.</li><li>Creatives get a quick human review before going live. We do not promise a fixed live time.</li><li>There are no impression guarantees and no click-through or return-on-ad-spend promises. Reporting is aggregate, and modelled figures are labelled as estimates.</li></ul>
<h2>What it costs to start (USD)</h2>
<ul><li>$190: 7-day category look, credited in full toward the $490 category placement if you convert within 7 days, otherwise refunded.</li><li>$490: category placement, media credit, fully refundable until 14 days before the launch date on the insertion order.</li><li>Premium exclusive display from $5K to $50K is set through intake and an insertion order. Agencies buy by insertion order and invoice.</li></ul>
</article>
<div class="cta"><p>Reserve your placement in minutes.<small>Pay online or start an intake.</small></p><div class="btns"><a class="btn" href="/buycalc">See prices and pay</a><a class="btn line" href="/intake">Start your intake</a><a class="btn line" href="/agencies">Agencies</a></div></div></div>`;
  return shell(VS_GOOGLE_PATH, title, description, body, jsonLdGraph(), "website").replace(
    "</style>",
    "table.cmp{width:100%;border-collapse:collapse;font-size:.95rem;margin:14px 0;background:#fff}table.cmp th,table.cmp td{border:1px solid #e1e4da;padding:10px 12px;text-align:left;vertical-align:top}table.cmp thead th{background:#dfe8d2}</style>",
  );
}

router.get([VS_GOOGLE_PATH, `${VS_GOOGLE_PATH}/`], (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.type("html").send(renderVsGoogle());
});
router.get([HOW_FAST_PATH, `${HOW_FAST_PATH}/`], (_req, res) => {
  res.redirect(301, VS_GOOGLE_PATH);
});
router.get("/llms-full.txt", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.type("text/plain; charset=utf-8").send(llmsFullTxt());
});

export default router;
