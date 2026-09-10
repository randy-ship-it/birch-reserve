# Stripe / SBG checkout audit (Birch Reserve)

Date: 2026-09-09 (America/Toronto)  
Branch: `grok/stripe-sbg-audit`  
Scope: read-only analysis of how `checkout_url` is produced for POST `/v1/checkout`, then verified env/wiring fixes only.

## Executive summary

- Human/machine public checkout is **Stripe Checkout Sessions** created with **inline `price_data`** (not Catalog Price IDs, not Payment Links).
- Canonical SKUs: `reserve-990` ($990), `pilot-4900` ($4,900), `network-9900` ($9,900) USD.
- Live symptom `checkout_url: null` + `"Reservation saved, but secure checkout is unavailable."` means the seat was claimed, `checkoutConfigured()` passed, then **session create / match / attach failed** in the try/catch of `handleMachineCheckout`.
- Historical env names like `STRIPE_PRICE_ID` / `STRIPE_PRICE_RESERVE_1900` / Payment Link fallbacks are **stale relative to current code** and must not be restored.
- Primary wiring gap verified in code: Checkout Session create/retrieve/expire went only through **Replit Connectors** `proxy("stripe", ...)`, while `STRIPE_SECRET_KEY` was only used by `getStripeClient()` (webhooks). If the connector is incomplete/broken but a public HTTPS base URL is set, reservations save and checkout returns 503 with null `checkout_url`.

## POST `/v1/checkout` → `checkout_url` path

| Step | File | Function / notes |
| --- | --- | --- |
| Route | `artifacts/api-server/src/routes/publicBuying.ts` | `router.post("/v1/checkout", …)` → `handleMachineCheckout` |
| Offer resolve | `artifacts/api-server/src/lib/reserveOffers.ts` | `getPublicReserveOfferBySku(body.sku)` |
| Seat claim | `artifacts/api-server/src/lib/splashReservationLifecycle.ts` | `claimSplashReserveSeat(...)` (inventory + idempotency) |
| Gate | `publicBuying.ts` `checkoutConfigured()` | Requires `STRIPE_CHECKOUT_DISABLED !== "true"`, HTTPS public base URL, and (after wiring fix) `STRIPE_SECRET_KEY` |
| Session create | `artifacts/api-server/src/lib/stripeClient.ts` | `createStripeCheckoutSession(params, idempotencyKey)` |
| Match | `splashReservationLifecycle.ts` | `stripeSessionMatchesReservation(session, reservation)` |
| Persist URL | `publicBuying.ts` | Writes `stripeCheckoutSessionId` / `stripeCheckoutUrl`; response `checkout_url: session.url` |
| Client redirect | buycalc inline JS in `publicBuying.ts`; media app fetch paths | Assigns `location` only when `checkout_url` is truthy |

OpenAPI contract: `lib/api-spec/openapi.yaml` — 200 requires string `checkout_url`; 503 allows `checkout_url: null` with `error`.

Related (activation-token) path: `artifacts/api-server/src/routes/splashAdReservations.ts` `POST /launch/splash/checkout` — same `createStripeCheckoutSession` + `price_data`, different success/cancel URLs.

## Price IDs vs `price_data` vs Payment Links vs Checkout Session

| Mechanism | Used for new public checkout? | Evidence |
| --- | --- | --- |
| Checkout Session `mode: "payment"` | **Yes** | `handleMachineCheckout` / splash checkout builders |
| Inline `line_items[].price_data` | **Yes** | `lineItem()` / `offerLineItem()` — amount from `reserveOffers` |
| Catalog `price` ID / `STRIPE_PRICE_*` | **No** (stale) | No runtime read of `STRIPE_PRICE_ID` / `STRIPE_PRICE_RESERVE_1900` in api-server src |
| Payment Links | **No** (forbidden fallback) | `deliverables/birch-reserve-stripe-setup-current.txt` |

Dashboard Products/Prices in the setup brief are optional catalog hygiene for SBG; the app does **not** require Price IDs in env to create sessions.

## SKUs

Defined in `artifacts/api-server/src/lib/reserveOffers.ts` (mirrored in media `reserve-offers.ts`):

| sku / offerKey | amountCents | dueTodayUsd |
| --- | --- | --- |
| `reserve-990` | 99000 | 990 |
| `pilot-4900` | 490000 | 4900 |
| `network-9900` | 990000 | 9900 |

Legacy payable lookup only: `splash-1900` / `seat-1900` ($1,900) via `getPayableReserveOffer` — not offered for new `/v1/checkout` SKUs.

## Why live returns null `checkout_url` + that exact error

Exact string is emitted only here:

`publicBuying.ts` catch after a claimed `checkout_creating` attempt:

```text
Reservation saved, but secure checkout is unavailable.
```

Therefore on live:

1. Reservation **was saved** (`claimSplashReserveSeat` succeeded).
2. `checkoutConfigured()` was **true** at request time (not the earlier `"…secure payment is not configured."` branch).
3. `createStripeCheckoutSession` threw, **or** `session.url` was missing, **or** `stripeSessionMatchesReservation` failed, **or** DB attach failed.

Most likely wiring cause verified in pre-fix code: session API calls used **only** Replit Connectors, while ops often set `STRIPE_SECRET_KEY` expecting SDK behavior (webhooks already use the secret). Incomplete Stripe connector → create fails → 503 + null URL while hold remains.

Secondary gates (different messages):

- Missing/non-HTTPS `PUBLIC_BASE_URL` / `SPLASH_AD_PUBLIC_URL` / `REPLIT_DOMAINS` → `"…secure payment is not configured."`
- `STRIPE_CHECKOUT_DISABLED=true` → same configured=false path
- Match failure if returned session metadata/`amount_total`/`client_reference_id`/`checkoutAttempt` disagree with the row

## All `STRIPE_*` env names (values redacted)

| Name | Role in current code |
| --- | --- |
| `STRIPE_SECRET_KEY` | Required for SDK client / webhook construct; **should** drive Checkout Session create/retrieve/expire when set |
| `STRIPE_WEBHOOK_SECRET` | Signature verify in `handleStripeWebhook` |
| `STRIPE_CHECKOUT_DISABLED` | When `"true"`, checkout treated as not configured |

**Not read by current api-server checkout code (stale / historical):**  
`STRIPE_PRICE_ID`, `STRIPE_PRODUCT_ID`, `STRIPE_PRICE_RESERVE_1900`, `STRIPE_PRICE_LOGO`, `STRIPE_PRICE_CARD`, `STRIPE_PRICE_JOURNEY`, `STRIPE_PRICE_LOCATOR`, `STRIPE_PRICE_NETWORK`, and any Payment Link URL env.

## Related non-`STRIPE_*` env for checkout URLs

| Name | Role |
| --- | --- |
| `PUBLIC_BASE_URL` | Preferred HTTPS origin for `/v1/checkout` success/cancel (and UCP) |
| `SPLASH_AD_PUBLIC_URL` | Fallback / splash activation success/cancel origin |
| `REPLIT_DOMAINS` | Last-resort `https://{first-domain}` |

## Secrets checklist for hosting (names only)

**Required for live paid checkout + webhook settle**

1. `STRIPE_SECRET_KEY` — live SBG secret (`sk_live_…`); Replit Secrets / host secrets only  
2. `STRIPE_WEBHOOK_SECRET` — endpoint signing secret (`whsec_…`) for `https://birchreserve.net/api/stripe/webhook` (or deployed equivalent)  
3. `PUBLIC_BASE_URL` or `SPLASH_AD_PUBLIC_URL` — HTTPS canonical site origin (e.g. `https://birchreserve.net`)  
4. `DATABASE_URL` — reservations durability  

**Optional / operational**

5. `STRIPE_CHECKOUT_DISABLED` — omit or set anything other than `"true"` for live checkout  
6. `SEATS_TOTAL` — inventory pool size (default 8)  
7. Replit Stripe **connector** — optional if `STRIPE_SECRET_KEY` SDK path is used; must not be the only broken dependency  

**Do not commit / do not paste into git or chat**

- Any `sk_…`, `whsec_…`, Price/Product IDs used as secrets, Payment Link URLs as fallbacks  

**Do not set for new checkout**

- Retired `STRIPE_PRICE_*` / `STRIPE_PRODUCT_ID` assumptions for the $1,900 offer  

## Verified code changes on this branch (post-audit)

1. `stripeClient.ts` — when `STRIPE_SECRET_KEY` is set, create/retrieve/expire Checkout Sessions (and PaymentIntent helpers) via Stripe SDK; keep Connectors as fallback when the secret is absent.  
2. `publicBuying.ts` + `splashAdReservations.ts` — treat checkout as configured only if the secret is present (in addition to public HTTPS URL and not disabled).  
3. `splashAdReservations.ts` — honor `PUBLIC_BASE_URL` the same way as `/v1/checkout` when building success/cancel URLs.

No live Stripe objects were modified. No secret values are committed.
