# Hub drop-in kit (handoff for hub builders)

Send this link: **https://birchreserve.net/ads/hub-kit** (unlisted, `noindex`; mirror https://www.scalehealth.ca/ads/hub-kit).
This file is the same content for people working in the repo.

Hubs are built separately (Scale Health Connect). **We never edit their code or open PRs in their repos.** The hub team
pastes one script and one tag per agreed slot. Everything else happens on our side.

## 1. Paste

```html
<!-- once per page, or once in the app shell -->
<script async src="https://birchreserve.net/ads/embed.js"></script>

<!-- one tag per agreed slot; empty = 0 px -->
<div data-br-slot="HUB.dashboard" data-br-format="card,hero_phone"></div>
```

React / SPA: render `<div data-br-slot={slot} data-br-format={format} />`. The embed watches the DOM (MutationObserver)
and fills new tags after route changes; `window.__brAds.scan()` forces a rescan.

## 2. Slot map

Slot id = `<hub id>.<placement>`. The hub id comes with the agreement (it is the `ad_hubs.key` set when the hub is
onboarded in `/ads/admin#onboard`).

| Ends in | Where it goes | `data-br-format` (all allowed) | Container |
|---|---|---|---|
| `.landing` | Hub home, under the hero / first block, never above the hero | `hero_wide,hero_phone,leaderboard,video_landscape` | full width, ≤1200 px |
| `.dashboard` | Member home after sign-in, between first and second cards | `hero_phone,vertical,card,video_vertical` | 320–728 px |
| `.products` | Product list / page, after first row or under buy box | `card,mrec,video_landscape` | 300–728 px |
| `.services` | Service and booking pages, under details | `card,mrec,video_landscape` | 300–728 px |
| `.post_purchase` | Order / booking confirmation, under the message | `splash,vertical,video_vertical` | 320–728 px |

Formats and sizes: `docs/ads/CREATIVE-SPECS.md`. Leaving `data-br-format` off accepts every format made for that
placement.

## 3. Attributes

| Attribute | Needed | Effect |
|---|---|---|
| `data-br-slot` | yes | slot id |
| `data-br-format` | no | comma list; only those formats fill this tag (`/v1/ads/serve?fmt=`) |
| `data-br-reserve` | no | holds the first format's aspect ratio while loading (first-screen slots); collapses on no fill |
| `data-br-text="off"` | no | hides the optional headline/button row |
| `data-br-test="1"` | no | test mode for that tag |
| children | no | house card: stays when no paid ad, hidden when one shows |
| `<script data-test="1">` | no | test mode for the page |

## 4. Behaviour

- **Empty takes no space**: no fill leaves an empty tag (`data-br-state="house"`). Hubs must not give the tag height,
  padding or border.
- **No layout shift**: every ad has real `width`/`height` + CSS `aspect-ratio`. Slots below the first screen load before
  the visitor reaches them; first-screen slots use `data-br-reserve` or a house card.
- **Tracking**: only `/v1/ads/serve`, `/v1/ads/v` (viewable 50%/1 s; 2 s for video), `/v1/ads/c` (click). Media from
  `/v1/ads/cr/:id` and `/v1/ads/crv/:id`. No cookies; DNT and GPC honoured (no visitor id, no view history). Visitor id
  for frequency caps lives in the hub's own localStorage and is hashed server-side with a daily salt.
- **Motion**: video is `muted playsinline loop`, autoplays only without `prefers-reduced-motion`, poster first; if the
  browser can't play it the poster shows as a still.
- **Failure**: server slow/down → tag stays empty (or keeps the house card).

## 5. CSP and domains

```
script-src  https://birchreserve.net
connect-src https://birchreserve.net
img-src     https://birchreserve.net
media-src   https://birchreserve.net
```

No iframes, no third-party ad networks, no eval. Clicks open a new tab with `rel="sponsored noopener"`. Sandboxed
iframe: `allow-scripts allow-popups allow-same-origin`, or keep the tag outside it.

## 6. Verify

1. Open the hub page with `?br_ads=test` (embed reads it from the page URL). Only `is_test` campaigns fill; label reads
   "Sponsored · TEST".
2. Console: `[...document.querySelectorAll('[data-br-slot]')].map(e => e.dataset.brSlot + ' ' + e.dataset.brState)` →
   `paid` or `house`.
3. Network: one `/v1/ads/serve?slot=…` per tag.
4. Terminal: `curl -s "https://birchreserve.net/v1/ads/serve?slot=HUB.dashboard&test=1"` → `unknown_slot` means a wrong
   id; `no_eligible_campaign` means right id, nothing booked.

On our side: `/ads/admin#inventory` shows served / viewable / clicks per slot key.

## 7. Contact

sales@silverbirchgrowth.com, subject "Hub drop-in kit", with hub id and page URL.

## Don'ts (for the hub team)

Crop/stretch/overlay the ad, wrap it in another link, hide the "Sponsored" label, copy ad files to their servers, add
slots outside the agreement.

## Code

`artifacts/api-server/src/lib/adserver/embed.ts` (embed v2), `specsPage.ts` (`hubKitPage`), `service.ts` (`formats`
filter), `routes/adserver.ts` (`/ads/hub-kit`, `/v1/ads/serve?fmt=`). On scalehealth.ca the existing
`BirchAdSlot.tsx` (/sole) is the reference implementation of this snippet.
