# Hub-reported audience profiles (Friday) — preview, flag OFF by default

Source: Friday hub inventory feed `GET https://fridayapp.org/api/tam/partners` (header `X-TAM-Key`, env
`FRIDAY_TAM_KEY`, optional `FRIDAY_TAM_URL`). Records whose hub has a matched, non-TEST profile carry an `audience`
block labelled `hub-reported`, `aggregate_only: true`. Read server-side only, cached 10 minutes, never throws.
Matching: hub name (normalized) against `BRAND_HUBS`. Hubs without a profile show nothing.

Code: `artifacts/api-server/src/lib/overhaul/hubAudience.ts`.

## Modes (server-side flag `BIRCH_HUB_AUDIENCE_PUBLIC`)

| Value | Mode | What happens |
|---|---|---|
| unset / anything else (default) | **private** | Profile used for pricing, targeting and quote / IO output only: `GET /v1/agent/quote?offer=…&hub=<key>` returns `hub_audience` (no FSAs, only a count) and `io_rate_guidance`. `/v1/hubs/audience-summaries` returns no items, so nothing renders on any public page. |
| `summary` | **public summary** | Also one aggregate line per profiled hub on `/hubs` listings and in quotes (`public_summary`), e.g. "Mostly women 25–44 · Toronto · $100K+ HHI · also buys sleep, meal kits · hub-reported". |

Off production only (Vercel preview / local), `?audience_mode=summary` forces mode (b) for review. Production ignores it.

Never public: submitter names or emails, raw free text, phone numbers, FSAs / postal codes (geography must be a city or
region), audience sizes, spend, channels, anything individual. No booked / sold / signed counts. USD only.

## Pricing rule (IO-priced lines only)

Base = the published per-surface CPM / CPC floor (unchanged). When a hub has a hub-reported profile:

- +5% if the hub-reported household income band is $100K or more;
- +5% if the advertiser's category matches the hub's also-buy (`cross_sell`) or `interests` categories;
- capped at +10% total. No profile = no change.

Applies to IO-quoted custom CPM / CPC lines only. The $190 USD 7-day look, the $490 USD reserve, the media-kit rates
and checkout do not change. Shown transparently in `io_rate_guidance` (base, uplift %, reasons, adjusted rate).

## Tests

`pnpm --filter @workspace/api-server run test:hub-audience` uses `tests/fixtures/hub-audience.EXAMPLE.json`, an
EXAMPLE fixture with invented values (the live feed had 0 profiled hubs on Nov 18 2026). It is never imported by site
code; a test enforces that.
