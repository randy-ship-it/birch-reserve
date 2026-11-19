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
