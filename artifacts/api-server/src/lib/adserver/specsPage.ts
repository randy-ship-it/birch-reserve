/**
 * Public creative specs (/ads/specs) and the unlisted hub drop-in kit (/ads/hub-kit). Both read creativeSpec.ts, so the
 * page, the upload checks and the templates never drift. `skin: "scale"` is the scalehealth.ca mirror (same content,
 * Scale name, absolute links back to birchreserve.net). Visitor copy rules: no client names, no counts, no forecasts,
 * no impression / click / sales guarantees.
 */
import { PLACEMENTS, placementLabel, type Placement } from "./config";
import { COPY, FORMATS, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_SECONDS, formatsForPlacement, type CreativeFormat } from "./creativeSpec";
import { esc, shell } from "./ui";

export const PUBLIC_ORIGIN = "https://birchreserve.net";
type Skin = "birch" | "scale";
const brandOf = (skin: Skin) => (skin === "scale" ? { brand: "SCALE HEALTH", name: "Scale Health ad system", home: "https://www.scalehealth.ca/" } : { brand: "BIRCH RESERVE", name: "Birch Reserve", home: "/" });
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(0)} MB` : `${Math.round(n / 1024)} KB`);

const CSS = `<style>
.hero{margin:28px 0 8px;display:grid;gap:10px}.hero h1{margin:0}.eyebrow{font:600 .72rem/1 "IBM Plex Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#33465e}
.pill{display:inline-block;background:#C8F55A;color:#071A39;border-radius:999px;padding:3px 10px;font-weight:600;font-size:.78rem}
.choose{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:14px 0}
.choose .card h3{margin-top:0}.choose ul{margin:6px 0 0;padding-left:18px}.choose li{margin:3px 0}
.fmts{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.fmt{display:grid;gap:8px;align-content:start}.fmt .shape{background:#F9F8F6;border:1px solid #d9ddd2;border-radius:12px;display:grid;place-items:center;padding:10px;min-height:120px}
.fmt .box{width:100%;max-height:150px;background:rgba(200,245,90,.35);border:2px dashed #071A39;border-radius:8px;display:grid;place-items:center;font:600 .78rem "IBM Plex Sans",sans-serif;color:#071A39}
.fmt .box.v{background:#071A39;color:#C8F55A;border-color:#C8F55A}.fmt h3{margin:0}.fmt dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0;font-size:.84rem}.fmt dt{color:#566476}.fmt dd{margin:0;font-weight:600}
.dl{display:flex;gap:6px;flex-wrap:wrap}.chips{display:flex;gap:6px;flex-wrap:wrap}.chip.kind{background:#071A39;color:#C8F55A}
details.more{background:#fff;border:1px solid #d9ddd2;border-radius:14px;padding:12px 16px;margin-top:10px}details.more summary{cursor:pointer;font-weight:600}
.rules td:first-child{white-space:nowrap;font-weight:600;color:#33465e}.ok-list li::marker{content:"✓  ";color:#0b6b43}
@media(max-width:640px){.fmt .shape{min-height:96px}}
</style>`;

function shapeBox(f: CreativeFormat): string {
  const [w, h] = f.size;
  const tall = h > w;
  const style = tall ? `aspect-ratio:${w}/${h};width:auto;height:150px` : `aspect-ratio:${w}/${h}`;
  return `<div class="shape"><div class="box${f.kind === "video" ? " v" : ""}" style="${style}">${f.kind === "video" ? "▶ " : ""}${f.ratio}</div></div>`;
}

function fmtCard(f: CreativeFormat, base: string): string {
  const where = f.placements.map((p) => placementLabel(p)).join(" · ");
  return `<article class="card fmt" id="f-${f.key}">${shapeBox(f)}
<div class="chips"><span class="chip kind">${f.kind === "video" ? "Video" : "Still"}</span><span class="chip c-completed">${esc(f.ratio)}</span></div>
<h3>${esc(f.label)}</h3><p class="fine" style="margin:0">${esc(f.where)}</p>
<dl><dt>Export</dt><dd>${f.upload[0]}×${f.upload[1]} px</dd><dt>Smallest</dt><dd>${f.min[0]}×${f.min[1]} px</dd><dt>Shows at</dt><dd>${f.size[0]}×${f.size[1]} px</dd><dt>Safe zone</dt><dd>${f.safe * (f.upload[0] / f.size[0])} px from each edge</dd><dt>Aim for</dt><dd>${f.kind === "video" ? `≤ ${kb(f.targetBytes)}, ${VIDEO_SECONDS.ideal[0]}–${VIDEO_SECONDS.ideal[1]} s` : `≤ ${kb(f.targetBytes)}`}</dd><dt>Format id</dt><dd><code>${f.key}</code></dd></dl>
<p class="fine" style="margin:0">Runs on: ${esc(where)}</p>
<div class="dl"><a class="btn ghost sm" href="${base}/ads/specs/templates/${f.key}.svg?download" download>SVG template</a><a class="btn ghost sm" href="${base}/ads-specs/templates/${f.key}.png" download>PNG template</a></div></article>`;
}

export function specsPage(o: { skin?: Skin } = {}): string {
  const skin = o.skin ?? "birch";
  const b = brandOf(skin);
  const base = skin === "scale" ? "/intake/_m" : ""; // templates resolve on both hosts through the mirror prefix
  const abs = skin === "scale" ? "/intake/_m" : ""; // Scale pages stay on scalehealth.ca (the mirror prefix serves every Birch path)
  const stills = FORMATS.filter((f) => f.kind === "image");
  const videos = FORMATS.filter((f) => f.kind === "video");
  const snippet = `<script async src="${PUBLIC_ORIGIN}/ads/embed.js"></script>
<div data-br-slot="yourhub.dashboard" data-br-format="card,hero_phone"></div>`;
  const imgTag = `<!-- What the embed writes for a still (you don't write this yourself) -->
<a href="…/v1/ads/c?t=…" target="_blank" rel="sponsored noopener">
  <picture>
    <source type="image/avif" srcset="…600w, …1200w" sizes="600px">
    <source type="image/webp" srcset="…600w, …1200w" sizes="600px">
    <img src="…/v1/ads/cr/ID" width="1200" height="800" alt="Your alt text"
         loading="lazy" decoding="async" style="width:100%;height:auto">
  </picture>
</a>`;
  const body = `${CSS}
<section class="hero"><span class="eyebrow">${esc(b.name)} · Creative specs</span>
<h1>Make an ad that fits, first time.</h1>
<p class="lede">Two kinds: a still image or a short muted video. Pick the size for where it runs, export at 2×, upload. We check the file the moment you send it, and a person reviews every ad before it runs.</p>
<p><span class="pill">Export at 2× · sRGB · alt text required</span></p></section>

<div class="choose"><div class="card"><h3>Still image</h3><ul><li>JPG, PNG, WebP or AVIF</li><li>Up to ${mb(MAX_IMAGE_BYTES)} (aim for 150–300 KB)</li><li>We make WebP/AVIF sizes for fast phones</li><li>Best for: offers, products, a clear price</li></ul></div>
<div class="card"><h3>Short video</h3><ul><li>MP4 (H.264), or WebM</li><li>${VIDEO_SECONDS.min}–${VIDEO_SECONDS.max} seconds (${VIDEO_SECONDS.ideal[0]}–${VIDEO_SECONDS.ideal[1]} is best), up to ${mb(MAX_VIDEO_BYTES)}</li><li>Plays muted on loop: burn captions in</li><li>Poster frame shows first (we grab one for you)</li></ul></div></div>

<section id="sizes"><h2>Pick your size</h2><p class="fine">Shapes we run today. A file must match one of these shapes (within 2%). Templates show the safe zone: keep logo, words and offer inside the dashed box.</p>
<h3 style="margin-top:14px">Still images</h3><div class="fmts">${stills.map((f) => fmtCard(f, base)).join("")}</div>
<h3 style="margin-top:22px">Video</h3><div class="fmts">${videos.map((f) => fmtCard(f, base)).join("")}</div>
<details class="more"><summary>Which size for which placement?</summary><div class="tw" style="margin-top:10px"><table><thead><tr><th>Placement</th><th>Formats that run there</th></tr></thead><tbody>
${PLACEMENTS.map((p) => `<tr><td>${esc(placementLabel(p))}</td><td>${formatsForPlacement(p as Placement).map((f) => `${esc(f.label)} <span class="fine">${f.upload[0]}×${f.upload[1]}</span>`).join(" · ")}</td></tr>`).join("")}
</tbody></table></div><p class="fine">Running more than one placement? Upload one file per shape. We pick the one made for each slot.</p></details></section>

<section id="rules"><h2>File rules</h2><div class="tw"><table class="rules"><thead><tr><th></th><th>Still image</th><th>Video</th></tr></thead><tbody>
<tr><td>Types</td><td>JPG, PNG, WebP, AVIF. GIF accepted (still only is best). No SVG.</td><td>MP4: H.264 video, AAC audio optional. WebM: VP9. No MOV/HEVC.</td></tr>
<tr><td>Max size</td><td>${mb(MAX_IMAGE_BYTES)} hard limit · aim 150 KB (banners) to 300 KB (cards)</td><td>${mb(MAX_VIDEO_BYTES)} hard limit · aim under 3 MB</td></tr>
<tr><td>Pixels</td><td>Export at 2× the shown size (sharp on phones). Max 4000 px a side.</td><td>1080×1920 or 1920×1080 (720p minimum). 24–30 fps.</td></tr>
<tr><td>Length</td><td>–</td><td>${VIDEO_SECONDS.min}–${VIDEO_SECONDS.max} s; ${VIDEO_SECONDS.ideal[0]}–${VIDEO_SECONDS.ideal[1]} s is best. Loops, so make the end meet the start.</td></tr>
<tr><td>Bitrate</td><td>–</td><td>About 2 Mbps at 1080p, 1.2 Mbps at 720p. "Fast start" / "Web optimized" on.</td></tr>
<tr><td>Sound</td><td>–</td><td>Plays muted. Burn captions into the picture; never rely on audio.</td></tr>
<tr><td>Colour</td><td colspan="2">sRGB, 8-bit. CMYK files are refused. Wide-gamut (P3, Adobe RGB) gets a warning.</td></tr>
<tr><td>Corners</td><td colspan="2">We round corners 12 px and add a small "Sponsored" label under the ad. Don't draw your own border.</td></tr>
<tr><td>Motion off</td><td colspan="2">Visitors who turn motion off see the poster, not the video.</td></tr>
</tbody></table></div>
<details class="more"><summary>Export recipes (Figma, Canva, Photoshop, ffmpeg)</summary>
<ul><li><b>Figma:</b> frame at the "Shows at" size, export 2× as PNG or WebP.</li><li><b>Canva:</b> custom size at the "Export" size, download PNG (or JPG at 80–90% for photos).</li><li><b>Photoshop:</b> Export As → JPG/PNG/WebP, check "Convert to sRGB".</li>
<li><b>Video (ffmpeg):</b></li></ul>
<pre>ffmpeg -i in.mov -t 10 -vf "scale=1080:1920,fps=30" -c:v libx264 -profile:v high -pix_fmt yuv420p \\
  -b:v 2M -maxrate 2.5M -bufsize 4M -an -movflags +faststart out.mp4</pre>
<p class="fine">Use <code>scale=1920:1080</code> for landscape. Drop <code>-an</code> to keep audio (AAC 128k); it still plays muted.</p></details></section>

<section id="words"><h2>Words</h2><div class="grid two">
<div class="card"><h3>Alt text (required)</h3><p>${COPY.alt.min}–${COPY.alt.max} characters. Say what the ad shows and offers: <i>"Recovery cream, 20% off this week"</i>. Screen readers read it out.</p></div>
<div class="card"><h3>Headline + button (optional)</h3><p>Headline up to ${COPY.headline.max} characters, shown under the ad. Button label from: ${COPY.cta.map((c) => `<code>${esc(c)}</code>`).join(" ")}.</p></div>
</div><details class="more"><summary>Text inside the image</summary><ul><li>Brand, one line, one offer. Less text reads faster on a phone.</li><li>Smallest text: 14 px at the shown size (28 px in a 2× export).</li><li>Claims must be true and match the landing page. Health claims need to follow the rules where the ad runs; we may ask for proof.</li></ul></details></section>

<section id="link"><h2>Landing link</h2><ul class="ok-list"><li>https only, on your own domain. No link shorteners or redirect chains.</li><li>Opens fast on a phone and shows the same offer as the ad.</li><li>We add <code>utm_source=birchreserve</code>, <code>utm_medium=display</code>, <code>utm_campaign</code>, <code>utm_content=&lt;slot&gt;</code> and a <code>br_click</code> id. UTMs you already set are kept.</li><li>No personal data in the link (no emails, names or phone numbers).</li></ul></section>

<section id="embed"><h2>How to embed (for hub and partner pages)</h2><p>One script per page, one tag per slot. When there's no ad, the tag stays empty and takes no space.</p>
<pre>${esc(snippet)}</pre>
<p><a class="btn sm" href="${abs}/ads/hub-kit">Full hub drop-in kit</a> <a class="btn ghost sm" href="${abs}/ads/docs">Delivery and pixel docs</a></p>
<details class="more"><summary>What the embed puts on the page</summary><pre>${esc(imgTag)}</pre>
<p class="fine">Required on every ad: real <code>width</code>/<code>height</code> (no layout jump), <code>alt</code>, <code>rel="sponsored noopener"</code>, the "Sponsored" label. Videos get <code>muted playsinline loop</code>, a poster, and autoplay only when motion is on.</p></details></section>

<section id="review"><h2>After you upload</h2><ol class="steps"><li class="done"><b>1</b><span>Instant check: type, size, shape, length, colour. If something's off, you get a plain fix right away.</span></li><li><b>2</b><span>We make fast WebP/AVIF copies (and a poster for video) in your browser while it uploads.</span></li><li><b>3</b><span>A person reviews it, usually within 1 business day.</span></li><li><b>4</b><span>It runs in the slots that match its shape.</span></li></ol>
<details class="more"><summary>Every automatic check, in plain words</summary><ul>
<li>File type is read from the file itself, not its name.</li><li>Images over ${mb(MAX_IMAGE_BYTES)} or videos over ${mb(MAX_VIDEO_BYTES)} are refused.</li><li>The shape must match a format within 2%, and be at least the "Smallest" size.</li>
<li>Videos: ${VIDEO_SECONDS.min}–${VIDEO_SECONDS.max} seconds, H.264 (MP4) or VP9 (WebM), fast start on.</li><li>CMYK images are refused; wide-gamut colour gets a warning.</li><li>Alt text is required; headline and button label are checked for length and wording.</li><li>SVG, HEIC and MOV files are refused with a note on what to export instead.</li></ul></details></section>
<p class="fine" style="margin-top:22px">Every ad is reviewed by a person. Reporting is aggregate. No impression, click or sales guarantees.</p>`;
  return shell({
    title: `Ad creative specs · ${b.name}`,
    nav: "Creative specs",
    brand: b.brand,
    home: b.home,
    robots: skin === "scale" ? "noindex,follow" : "index,follow",
    head: `<link rel="canonical" href="${PUBLIC_ORIGIN}/ads/specs"><meta name="description" content="Ad creative specs: still image and short video sizes, file types, weights, safe zones, alt text and landing link rules, with downloadable templates.">`,
    right: `<nav class="tabs"><a href="#sizes">Sizes</a><a href="#rules">Rules</a><a href="#words">Words</a><a href="#embed">Embed</a><a href="${abs}/account">Upload</a></nav>`,
    footer: skin === "scale" ? `Scale Health ad system · Aggregate reporting only. No impression guarantees.` : undefined,
    body,
  });
}

/* ------------------------------------------------------------------ hub drop-in kit */
const SLOT_MAP: Array<{ placement: Placement; where: string; width: string }> = [
  { placement: "landing", where: "Hub home, under the hero or first content block. Never above the hero.", width: "Full content width, up to 1200 px" },
  { placement: "dashboard", where: "Member home after sign-in, between the first and second cards.", width: "Card column, 320–728 px" },
  { placement: "products", where: "Product list or product page, after the first row or under the buy box.", width: "300–728 px" },
  { placement: "services", where: "Service and booking pages, under the service details, above the footer.", width: "300–728 px" },
  { placement: "post_purchase", where: "Order or booking confirmation, under the confirmation message.", width: "320–728 px" },
];

export function hubKitPage(o: { skin?: Skin } = {}): string {
  const skin = o.skin ?? "birch";
  const b = brandOf(skin);
  const abs = skin === "scale" ? "/intake/_m" : ""; // Scale pages stay on scalehealth.ca (the mirror prefix serves every Birch path)
  const snippet = `<!-- 1. Once per page (or once in your app shell) -->
<script async src="${PUBLIC_ORIGIN}/ads/embed.js"></script>

<!-- 2. One tag per agreed slot. Empty = takes no space. -->
<div data-br-slot="HUB.dashboard" data-br-format="card,hero_phone"></div>`;
  const react = `// React / Next / Vite: render the tag; the embed finds it (also after route changes).
export function BirchSlot({ slot, format }: { slot: string; format?: string }) {
  return <div data-br-slot={slot} data-br-format={format} />;
}`;
  const csp = `script-src  https://birchreserve.net
connect-src https://birchreserve.net
img-src     https://birchreserve.net
media-src   https://birchreserve.net`;
  const verify = `curl -s "${PUBLIC_ORIGIN}/v1/ads/serve?slot=HUB.dashboard&test=1"
# {"fill":false,"reason":"no_eligible_campaign"}  → slot id is right, nothing booked (fine)
# {"fill":false,"reason":"unknown_slot"}          → check the slot id
# {"fill":true, ...}                              → an ad will show`;
  const body = `${CSS}
<section class="hero"><span class="eyebrow">${esc(b.name)} · For hub builders</span>
<h1>Hub drop-in kit</h1>
<p class="lede">One script and one tag per slot. Our ads show only in the slots we agreed with you. When there's no ad, the tag stays empty and takes no space. No cookies, no extra tracking.</p>
<p><span class="pill">Copy · paste · check with ?br_ads=test</span></p>
<p class="fine" style="border-left:3px solid #C8F55A;padding-left:10px"><b>Not live yet.</b> A hub only shows ads after Randy or Jon approves that hub in the Birch ad system. Until then every slot on the hub stays empty, even if the tag is pasted.</p></section>

<section id="snippet"><h2>1. Paste this</h2><pre id="snip">${esc(snippet)}</pre><button class="ghost sm" data-copy="#snip" type="button">Copy snippet</button>
<p class="fine">Replace <code>HUB</code> with your hub id (we send it to you) and keep the placement name after the dot.</p>
<details class="more"><summary>React / single-page apps</summary><pre>${esc(react)}</pre><p class="fine">The embed watches the page for new slot tags. To force a re-scan: <code>window.__brAds &amp;&amp; window.__brAds.scan()</code>.</p></details></section>

<section id="slots"><h2>2. Slot map</h2><p class="fine">Slot id = <code>&lt;hub id&gt;.&lt;placement&gt;</code>. Use only the slots in your agreement.</p>
<div class="tw"><table><thead><tr><th>Slot id ends in</th><th>Where it goes</th><th><code>data-br-format</code></th><th>Container</th></tr></thead><tbody>
${SLOT_MAP.map((r) => `<tr><td><code>.${r.placement}</code><div class="fine">${esc(placementLabel(r.placement))}</div></td><td>${esc(r.where)}</td><td><code>${formatsForPlacement(r.placement).map((f) => f.key).join(",")}</code></td><td class="fine">${esc(r.width)}</td></tr>`).join("")}
</tbody></table></div>
<p class="fine">Your hub id comes with your agreement (lowercase, e.g. <code>yourhub</code>). Each hub only uses its own id.</p>
<p class="fine">Format ids and sizes: <a href="${abs}/ads/specs#sizes">creative specs</a>. Leave <code>data-br-format</code> off to accept every format made for that placement.</p></section>

<section id="attrs"><h2>3. Options</h2><div class="tw"><table><thead><tr><th>Attribute</th><th>Needed?</th><th>What it does</th></tr></thead><tbody>
<tr><td><code>data-br-slot</code></td><td>Yes</td><td>The slot id from the map.</td></tr>
<tr><td><code>data-br-format</code></td><td>No</td><td>Comma list of format ids this spot can show (e.g. <code>card,mrec</code>). Anything else never shows here.</td></tr>
<tr><td><code>data-br-reserve</code></td><td>No</td><td>Holds the first format's shape while the ad loads (for slots on the first screen). Collapses if there's no ad.</td></tr>
<tr><td><code>data-br-text="off"</code></td><td>No</td><td>Hides the optional headline and button row under the ad.</td></tr>
<tr><td><code>data-br-test="1"</code></td><td>No</td><td>Test mode for this one slot.</td></tr>
<tr><td>Children inside the tag</td><td>No</td><td>Your own "house" card. It stays when there's no paid ad and hides when one shows.</td></tr>
</tbody></table></div></section>

<section id="behaviour"><h2>4. How it behaves</h2><ul class="ok-list">
<li><b>Empty takes no space.</b> No ad = an empty tag (0 px). Don't give the tag a height, padding or border.</li>
<li><b>No layout jump.</b> Every ad carries its real width and height. Put slots below the first screen; the ad loads before people scroll to it. On the first screen, add <code>data-br-reserve</code> or a house card.</li>
<li><b>Fits the column.</b> The ad fills the tag's width, never wider than its file. Rounded 12 px corners and a small "Sponsored" label are added for you.</li>
<li><b>Only our endpoints.</b> <code>/v1/ads/serve</code> (pick an ad), <code>/v1/ads/v</code> (viewable: 50% on screen for 1 s, 2 s for video), <code>/v1/ads/c</code> (click). Ad files come from <code>/v1/ads/cr</code> and <code>/v1/ads/crv</code>.</li>
<li><b>Privacy.</b> No cookies. Do Not Track and Global Privacy Control are honoured. No names, emails or IP addresses are collected by the embed.</li>
<li><b>Motion.</b> Videos play muted and only autoplay when the visitor allows motion.</li>
<li><b>Won't break your page.</b> If our server is slow or down, the tag stays empty (or keeps your house card).</li></ul></section>

<section id="csp"><h2>5. Security headers and domains</h2><p>If your site sends a Content-Security-Policy, add:</p><pre>${esc(csp)}</pre>
<ul><li>No iframes, no third-party ad networks, no <code>eval</code>. One script from <code>birchreserve.net</code>.</li><li>Clicks open the brand's page in a new tab with <code>rel="sponsored noopener"</code>.</li><li>Inside a sandboxed iframe? Allow <code>allow-scripts allow-popups allow-same-origin</code>, or place the tag outside it.</li></ul></section>

<section id="verify"><h2>6. Check it works</h2><ol class="steps"><li><b>1</b><span>Open the page with <code>?br_ads=test</code> on the address (e.g. <code>/home?br_ads=test</code>). Test mode shows only test ads, labelled "Sponsored · TEST". Real visitors never see them.</span></li>
<li><b>2</b><span>In the browser console: <code>[...document.querySelectorAll('[data-br-slot]')].map(e =&gt; e.dataset.brSlot + ' ' + e.dataset.brState)</code>. You want <code>paid</code> (ad showing) or <code>house</code> (no ad booked, tag empty).</span></li>
<li><b>3</b><span>Network tab: one call to <code>/v1/ads/serve?slot=…</code> per slot, answered with JSON.</span></li>
<li><b>4</b><span>Or from a terminal:</span></li></ol><pre>${esc(verify)}</pre></section>

<section id="dont"><h2>Please don't</h2><ul><li>Crop, stretch or overlay the ad, or wrap it in your own link.</li><li>Hide or restyle the "Sponsored" label.</li><li>Copy ad files to your own server (counts and approvals depend on ours).</li><li>Add slots that aren't in your agreement.</li></ul></section>

<section id="contact"><h2>Questions</h2><div class="card"><p>Email <a href="mailto:randy@scalehealth.ca?subject=Hub%20drop-in%20kit">randy@scalehealth.ca</a> with the subject "Hub drop-in kit", your hub id and the page link. We'll check the slot from our side.</p></div></section>`;
  return shell({
    title: `Hub drop-in kit · ${b.name}`,
    nav: "Hub drop-in kit",
    brand: b.brand,
    home: b.home,
    robots: "noindex,nofollow",
    right: `<nav class="tabs"><a href="#snippet">Snippet</a><a href="#slots">Slots</a><a href="#csp">CSP</a><a href="#verify">Check</a><a href="${abs}/ads/specs">Specs</a></nav>`,
    footer: skin === "scale" ? `Scale Health ad system · Aggregate reporting only. No impression guarantees.` : undefined,
    body,
  });
}
