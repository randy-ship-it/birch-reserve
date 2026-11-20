# Scale mirror: scalehealth.ca/intake

Randy (via Emma, Nov 19 2026 4:44 PM ET): scalehealth.ca/intake is the same live `/intake` as birchreserve.net,
same skin, same deployment. Not a fork.

## How it works

- **Scale side** (silverbirchgrowth/scalehealthnew, Vercel project `scalehealth`, `vercel.json`): two external
  rewrites, ahead of Scale's `/api` and SPA catch-alls.
  - `/intake` -> `https://birchreserve.net/intake?br_mirror=scale`
  - `/intake/:path*` -> `https://birchreserve.net/intake/:path*?br_mirror=scale`
  Visitor query strings (`ref`, `sid`, `utm_*`, `brand`, `mock`) are merged through unchanged.
- **Birch side**
  - `/intake/_m/<path>` serves any Birch path (`scripts/vercel-build.mjs` routes + `middlewares/mirrorHost.ts`).
    The mirror never touches Scale's own `/assets`, `/api`, or hub slugs.
  - An `/intake` page requested with `br_mirror=scale` gets a boot script (`window.__BR_MIRROR`) that sends
    same-origin fetch / beacon / XHR / `src` through `/intake/_m`, sends links that leave `/intake` to
    birchreserve.net, and skips the service-worker cleanup. Without the tag the HTML is byte-identical.
  - Source tag: `mirrorSource()` returns `scale_mirror`, so share events and intake records carry `src=scale_mirror`.
    Share links made on the mirror stay on scalehealth.ca and keep `src=scale_mirror`.
  - SEO: canonical and og:url stay `https://birchreserve.net/...`; the mirror shell is `Cache-Control: private, no-store`.
- **Iframe fallback**: `MIRROR_FRAME_HOSTS` (`middlewares/mirrorFrame.ts`), off by default. Not used by the proxy.

## Known edges

- The private report (`/kit/r/<token>`) and every non-intake page open on birchreserve.net.
- Clerk does not load on the mirror host (no sign-in on /intake); the page does not depend on it.

## Scale skin (Randy, Nov 20 2026 8:20 AM ET)

scalehealth.ca/intake must look and feel like Scale Health but stay the same intake. Still one deployment, one form:

- `MIRROR_SKINS` (`middlewares/mirrorHost.ts`) maps `scale_mirror` -> `scale`. The boot script puts `skin: "scale"` on
  `window.__BR_MIRROR` and `data-skin="scale"` on `<html>` before the bundle runs (no Birch flash). `scaleHead()` swaps
  the title / og:title / twitter:title brand name, theme colour and favicon, and loads Plus Jakarta Sans.
- Client: `lib/siteSkin.ts` (`isScaleSkin()`, `skinText()`). `Layout` renders `components/scale-chrome.tsx` (Scale's
  header + footer, links back to scalehealth.ca with `data-mirror-keep`) instead of Birch's. `usePageMeta` and the
  few visible "Birch Reserve" review lines go through `skinText()`.
- Colours and type: unlayered `html[data-skin="scale"]` block at the end of `src/index.css` (Scale palette, lime ramp ->
  Scale green, Plus Jakarta Sans). Never applies on birchreserve.net.
- Assets: `attached_assets/brand/scalehealth-logo-srgb-v2.png` and `public/brand/scale/favicon.svg` are byte copies of
  scalehealthnew `public/home-assets/scalehealth-logo-srgb-v2.png` and `public/favicon.svg`; `tests/mirrorHost.test.ts`
  pins their git blob ids.
- Rule: the skin may change chrome, colours, type and the brand NAME only. Fields, logic, payloads, endpoints and
  tracking must stay shared. Never fork intake components per site.
