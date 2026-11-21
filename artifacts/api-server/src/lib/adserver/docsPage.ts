/** Public docs: hub embed (/ads/docs) and the CPA pixel / postback (/ads/docs#pixel). */
import { AD_DEFAULTS, AD_SLOTS, VIEWABILITY, placementLabel } from "./config";
import { esc, shell } from "./ui";

export function docsPage(origin: string): string {
  const live = AD_SLOTS.filter((s) => s.live && !s.test);
  const embed = `<!-- Once per page, anywhere -->
<script async src="${origin}/ads/embed.js"></script>

<!-- Each ad slot: keep your house card inside; it stays when no paid ad is booked -->
<div data-br-slot="sole.post_purchase">
  <a href="/partners"><img src="/house-card.png" alt="Our partners"></a>
</div>`;
  const px = `<script async src="${origin}/ads/px.js" data-pixel="px_YOUR_PIXEL_ID"></script>
<script>
  window.brpx = window.brpx || function(){ (brpx.q = brpx.q || []).push(arguments) };
  // On the order confirmation / thank-you page only:
  brpx('conversion', { value: 49.99, currency: 'USD', order_id: 'ORDER-123' });
</script>`;
  const pb = `GET ${origin}/v1/ads/postback?key=pb_YOUR_KEY&click_id=BR_CLICK&value=49.99&currency=USD&order_id=ORDER-123
→ {"ok":true,"attributed":true,"via":"click"}`;
  return shell({
    title: "Ad embed and conversion pixel · Birch Reserve",
    nav: "Developer docs",
    robots: "index,follow",
    right: `<nav class="tabs"><a href="#embed">Hub embed</a><a href="#pixel">CPA pixel</a><a href="#postback">Postback</a><a href="#privacy">Privacy</a><a href="/account">Your ads</a></nav>`,
    body: `<h1 style="margin-top:26px">Ad embed and conversion pixel</h1>
<p class="lede">How Birch Reserve placements render inside private hubs, how delivery is counted, and how a brand tracks cost per acquisition. Reporting is aggregate only. No impression guarantees.</p>
<section id="embed"><h2>1. Hub embed (for hub pages)</h2><pre>${esc(embed)}</pre>
<ul><li>The script asks <code>/v1/ads/serve</code> for the slot. If an approved, paid, in-flight campaign is eligible it replaces the house card; otherwise your house card stays exactly as it was.</li>
<li><b>Viewable impression:</b> counted once per served ad when ${VIEWABILITY.ratio * 100}% of it is on screen for ${VIEWABILITY.ms / 1000} continuous second (IAB/MRC display standard) with the tab visible. CPM campaigns are billed on viewable impressions only.</li>
<li><b>Click:</b> the link goes through <code>/v1/ads/c</code>, counted once per served ad, then redirects to the brand's page with <code>utm_source=birchreserve</code>, <code>utm_medium=display</code>, <code>utm_campaign</code>, <code>utm_content=&lt;slot&gt;</code> and a <code>br_click</code> id. CPC campaigns are billed per click.</li>
<li><b>Filtering:</b> known bots, crawlers, previews and headless browsers are never counted; view and click links are signed and expire after ${AD_DEFAULTS.tokenTtlMs / 60000} minutes; clicks faster than ${AD_DEFAULTS.minClickMs} ms after serve are dropped; repeats are counted once.</li>
<li><b>Frequency cap:</b> ${AD_DEFAULTS.freqCapPerDay} viewable impressions per visitor per campaign per day by default.</li>
<li><b>Pacing:</b> even across the flight (up to 6 months), at most one day ahead of plan, never past the budget. A brand that allows it can also run on equal-or-lower-rate placements on its hubs, charged at that placement's own card rate.</li></ul>
<h3>Live slot keys</h3><div class="tw"><table><thead><tr><th>Key</th><th>Hub</th><th>Placement</th><th class="n">Starter CPM</th><th class="n">Starter CPC</th></tr></thead><tbody>
${live.map((s) => `<tr><td><code>${esc(s.key)}</code></td><td>${esc(s.hubName)}</td><td>${esc(placementLabel(s.placement))}</td><td class="n">$${s.cpmUsd.toFixed(2)}</td><td class="n">$${s.cpcUsd.toFixed(2)}</td></tr>`).join("")}
</tbody></table></div><p class="fine">USD starter (starting-at) card rates. CAD campaigns use the same 1.4× ladder as every Birch price.</p></section>
<section id="pixel"><h2>2. CPA pixel (for brand carts)</h2><p>Your pixel id is on your <a href="/account#tracking">ad dashboard</a>. Put this on the order confirmation page:</p><pre>${esc(px)}</pre>
<ul><li>When a shopper lands from a Birch Reserve ad, the pixel keeps the <code>br_click</code> id in your site's own storage (no cookies) for the attribution window.</li>
<li>On <code>brpx('conversion', …)</code> it sends only that id, the value, currency and your order id (hashed on our side, used only to drop duplicates).</li>
<li>Attribution: last click within ${AD_DEFAULTS.clickWindowDays} days (configurable per campaign). On carts inside a Scale Health hub (same site as the ad), a viewable impression within ${AD_DEFAULTS.viewWindowDays} day can also be credited.</li></ul></section>
<section id="postback"><h2>3. Server postback (no JavaScript)</h2><p>Save the <code>br_click</code> query value with the order, then call this from your server when the order is paid. Keep the key private; it's on your dashboard.</p><pre>${esc(pb)}</pre></section>
<section id="privacy"><h2>Privacy</h2><ul><li>No names, emails, IP addresses or cross-site cookies are collected by the embed or pixel.</li>
<li>Do Not Track and Global Privacy Control are honoured: no visitor id is created, no view history is kept, and the pixel sends nothing. The ad itself can still show (it is chosen by the page, not the person).</li>
<li>The visitor id used for frequency caps is a random value in the hub site's own storage, hashed on our side with a salt that changes every day.</li>
<li>Brands get aggregate reports only. See the <a href="/privacy#ads">privacy policy</a>.</li></ul></section>`,
  });
}
