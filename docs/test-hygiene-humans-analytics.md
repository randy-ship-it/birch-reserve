# Test hygiene, humans-only guards, analytics, linger capture, Friday meta (2026-09-24)

## Env vars (all optional; unset = safe default)
| Var | Purpose | Unset behaviour |
| --- | --- | --- |
| `BIRCH_QA_SECRET` | Value QA sends in header `X-Birch-QA` to mark traffic is_test and bypass UA block / rate limits / Turnstile | Falls back to `VOICE_WEBHOOK_SECRET` |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (managed widget, `interaction-only`) before chat opens a Grok session and on voice start routes | Gate skipped; everything else stays on |
| `VITE_PLAUSIBLE_DOMAIN` | Plausible analytics (`birchreserve.net`) | `track()` no-ops |
| `VITE_PLAUSIBLE_SRC` | Custom Plausible script URL | `https://plausible.io/js/script.js` |
| `VITE_GA4_ID` | Real GA4 id (G-...), only if a property is created | Not loaded |
| `FRIDAY_WORKSPACE` | Friday org | `birchreserve` |

`VITE_*` are build-time: set them before the publish build.

## SQL (run in DEV before publish, then PROD)
1. `scripts/sql/2026-09-24-test-hygiene-attribution.sql`: schema, ADD COLUMN IF NOT EXISTS only.
2. After deploy: `scripts/sql/2026-09-24-test-hygiene-backfill.sql`: only SETs is_test = true on past QA rows.

## Friday
Every intake payload now carries `meta` { category, hubs, source, sku, utm_source, utm_campaign,
need, size, timing, is_test, paid?, stripe_session_id? } (unknown keys omitted) plus `value`
(190 / 490) when a SKU is known. A paid `checkout.session.completed` upserts lead
`checkout:<reservationId>` and re-posts under the visitor's prior lead externalId (else
`birch-checkout-<reservationId>`), tags `birch:hold-190` / `birch:reserve-490`. Idempotent per
session; never fails the webhook; skipped for is_test.

Live QA check (reaches Friday on purpose, obviously named, tagged `birch:qa-test`):
```
curl -sS -X POST https://birchreserve.net/api/launch/qa/friday-test-lead \
  -H "X-Birch-QA: $BIRCH_QA_SECRET" -H 'content-type: application/json' \
  -d '{"source":"checkout","sku":"reserve-490","category":"Physio (QA)"}'
```
Without a valid header the route is a 404.

## Phone
tel: links can't be gated. If spam calls show up, filter at the Twilio number (spam/robocall
screening or a Studio "press 1" pre-screen).

## Reply-To and mail test (Randy 7:27pm)
- `BIRCH_REPLY_TO` (default `sales@silverbirchgrowth.com`): Reply-To on every buyer-facing email the
  site sends (`sendBuyerEmail` in lib/siteMail.ts). Today the site sends no buyer email itself:
  Stripe sends checkout receipts (set the Stripe account's support email / customer-email reply
  address to sales@ in the Stripe dashboard), the media kit is delivered in-page, and intake
  confirmations are on-screen. Internal notifications still go TO randy@ + jon@ (Reply-To = visitor).
- `POST /api/ops/mail-test` with header `X-Birch-QA: $BIRCH_QA_SECRET` sends one fixed email to
  sales@silverbirchgrowth.com (subject "Birch site test — sales@ routing", Reply-To sales@) and
  returns `{accepted, id, sentAt}`. 3 per hour. 401 without the header, 503 if RESEND_API_KEY is unset.
```
curl -sS -X POST https://birchreserve.net/api/ops/mail-test -H "X-Birch-QA: $BIRCH_QA_SECRET"
```
