# Stripe / SBG checkout audit (Birch Reserve)

**Catalog update 2026-09-24:** new Access Reserve checkout is `reserve-899` at $899 USD (89900 cents). `reserve-990` remains payable only for existing holds. The 2026-09-09 notes below describe the catalog as it was on that date.

Date: 2026-09-09 (America/Toronto)  
Branch: `grok/stripe-sbg-audit`  
Scope: read-only analysis of how `checkout_url` is produced for POST `/v1/checkout`, then verified env/wiring fixes only.

## Executive summary

- Human/machine public checkout is **Stripe Checkout Sessions**. When `STRIPE_PRICE_HOLD_190`, `STRIPE_PRICE_RESERVE_490`, or `STRIPE_PRICE_RESERVE_899` is set, that SKU uses the Price ID from the env var. Otherwise checkout uses inline `price_data`. Price ID values stay in host secrets and are not committed. Payment Links are not used.
- Canonical SKUs: `reserve-990` ($990), `pilot-4900` ($4,900), `network-9900` ($9,900) USD.
- Live symptom `checkout_url: null` + `"Reservation saved, but secure checkout is unavailable."` means the seat was claimed, `checkoutConfigured()` passed, then **session create / match / attach failed** in the try/catch of `handleMachineCheckout`.
- Historical env names like `STRIPE_PRICE_ID` / `STRIPE_PRICE_RESERVE_1900` / Payment Link fallbacks are **stale relative to current code** and must not be restored.
- Primary wiring gap verified in code: Checkout Session create/retrieve/expire went only through **Replit Connectors** `proxy("stripe", ...)`, while `STRIPE_SECRET_KEY` was only used by `getStripeClient()` (webhooks). If the connector is incomplete/broken but a public HTTPS base URL is set, reservations save and checkout returns 503 with null `checkout_url`.

## Canonical public origin (2026-09-10)

Randy lock via Emma: product door is **https://www.birchreserve.net** (not bare apex).

- `PUBLIC_BASE_URL` / `SPLASH_AD_PUBLIC_URL` / editorial `PUBLIC_SITE_ORIGIN` should use the www origin once DNS + Replit Domains attach land.
- Webhook endpoint prefer `https://www.birchreserve.net/api/stripe/webhook` (keep apex working until cutover).
- Hands off live SKU/pricing while Randy edits Replit; this branch only documents + sets editorial origin constant.

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

Related (activation-token) path: `artifacts/api-server/src/routes/splashAdReservations.ts` `POST /launch/splash/checkout` — same `createStripeCheckoutSession`, different success/cancel URLs. A set `STRIPE_PRICE_*` env wins over inline `price_data`.

## Price IDs vs `price_data` vs Payment Links vs Checkout Session

| Mechanism | Used for new public checkout? | Evidence |
| --- | --- | --- |
| Checkout Session `mode: "payment"` | **Yes** | `handleMachineCheckout` / splash checkout builders |
| Inline `line_items[].price_data` | **Yes, when no Price env is set** | `reserveCheckoutLineItem()` — amount from `reserveOffers` |
| Catalog `price` ID via env | **Yes, when set** | `STRIPE_PRICE_HOLD_190`, `STRIPE_PRICE_RESERVE_490`, `STRIPE_PRICE_RESERVE_899`. Values are host secrets, not committed. |
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
2. `STRIPE_WEBHOOK_SECRET` — endpoint signing secret (`whsec_…`) for `https://www.birchreserve.net/api/stripe/webhook` (apex also OK until www is sole door)  
3. `PUBLIC_BASE_URL` or `SPLASH_AD_PUBLIC_URL` — HTTPS canonical site origin — **https://www.birchreserve.net** (Randy lock 2026-09-10; apex secondary)  
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

## Live Stripe account checklist (authorized connector — read-only)

Retrieved via Randy’s authorized Stripe MCP connection (`SBG APIs` / livemode). No browser automation. No live Stripe mutations. No secrets, bank/payout, tax, or identity-verification data included.

### ACCOUNT

1. **Completed SBG / Silver Birch Growth account?** **Yes.** Legal company name on the account is **Silver Birch Growth Inc.**; dashboard display name **SBG APIs**. Country CA; charges and details submitted.
2. **Stripe account ID (final six characters only):** `…wsLJND`
3. **Country / default currency:** `CA` / `cad`
4. **details_submitted:** `true`
5. **charges_enabled:** `true`
6. **payouts_enabled:** `true`
7. **Public business-profile name:** `SBG APIs`
8. **Public website URL:** `SilverBirchGrowth.com` (as stored on `business_profile.url`)
9. **Public support URL:** *not set* (`null`)
10. **Support email / telephone configured?** Email: **no**. Telephone: **yes** (number omitted).
11. **Customer-facing statement descriptor:** `SBG SWEEPSTAKES TICKET` (payments statement descriptor). Card statement prefix: `SILVERGUAR`.
12. **Live or test data?** **Live** (`livemode: true`). Only this live account is connected in the session (no testmode account listed).

### BIRCH RESERVE PRODUCTS

Searched active products, inactive/archived products (`active: false` → empty), and product search by name (`Access Reserve`, `Placement Pilot`, `Network Pilot`, `reserve-990`, `Birch Reserve`).

App checkout uses a matching `STRIPE_PRICE_*` env when set, and otherwise **inline `price_data`**. Catalog Products/Prices are not required for `/v1/checkout` once `STRIPE_SECRET_KEY` is set. Still documenting Catalog state for SBG ops.

#### reserve-990 — Access Reserve — $990 USD one-time (99000¢)

| Field | Result |
| --- | --- |
| Product name | **NOT FOUND** |
| Product ID | — |
| Active Price ID | — |
| Currency | — |
| Unit amount (cents) | expected `99000` — **no matching Catalog price** |
| Active / archived | — |
| Live / test | Live search only |
| Product metadata | — |
| Duplicates | none |

#### pilot-4900 — Placement Pilot — $4,900 USD one-time (490000¢)

| Field | Result |
| --- | --- |
| Product name | **NOT FOUND** |
| Product ID | — |
| Active Price ID | — |
| Currency | — |
| Unit amount (cents) | expected `490000` — **no matching Catalog price** |
| Active / archived | — |
| Live / test | Live search only |
| Product metadata | — |
| Duplicates | none |

#### network-9900 — Network Pilot — $9,900 USD one-time (990000¢)

| Field | Result |
| --- | --- |
| Product name | **NOT FOUND** |
| Product ID | — |
| Active Price ID | — |
| Currency | — |
| Unit amount (cents) | expected `990000` — **no matching Catalog price** |
| Active / archived | — |
| Live / test | Live search only |
| Product metadata | — |
| Duplicates | none |

#### Legacy (do not reuse for the three packages; do not delete/archive)

| Field | Value |
| --- | --- |
| Product name | Birch Reserve Ad |
| Product ID | `prod_VECW1NASrdM4I3` |
| Active Price ID | `price_1UDk7WDxmCwsLJNDN33kvt1x` |
| Currency | `usd` |
| Unit amount (cents) | `190000` ($1,900) |
| Status | active |
| Mode | live |
| Metadata | `offer=splash-1900`, `site=birchreserve.net` |
| Duplicates | single price on this product |

**Instruction honored:** do not reuse the $1,900 Product/Price for reserve-990 / pilot-4900 / network-9900. Do not delete or archive this legacy product in this pass.

### WEBHOOKS

App expects (from code): `POST https://birchreserve.net/api/stripe/webhook` (`app.ts` → `handleStripeWebhook`). Signing secret must live only in `STRIPE_WEBHOOK_SECRET` (never in git).

Live webhook endpoints on this account (hostname + path only; **no `whsec` returned**):

| Destination | Status | Mode | Notes / events (relevant subset) |
| --- | --- | --- | --- |
| `sales-bridge.replit.app` `/api/stripe/webhook` | enabled | live | Broad set incl. `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled` (+ many others). Metadata `managed_by=stripe-sync`. **Not birchreserve.net.** |
| `getsilverguard.com` `/api/silverguard/stripe/webhook` | enabled | live | Includes `checkout.session.completed`; subscription/invoice events. **Not Birch.** |
| `getsilverguard.com` `/api/silverguard/webhook` | enabled | live | `checkout.session.completed` + subscription events. **Not Birch.** |

**Birch gap:** No enabled live webhook endpoint was found whose destination is `birchreserve.net` (or `/api/stripe/webhook` on that host). Until one is created (Randy approval) and `STRIPE_WEBHOOK_SECRET` is set, Checkout Sessions may create successfully after the SDK wiring fix, but paid-seat settlement via webhook will not fire on Birch.

Checked-for event types present on at least one account endpoint: `checkout.session.completed` ✓, `checkout.session.expired` ✓ (sales-bridge), `payment_intent.succeeded` ✓, `payment_intent.payment_failed` ✓, `payment_intent.canceled` ✓ — but **not wired to Birch’s hostname**.

### Checklist conclusions (no mutations performed)

1. Account is completed live **Silver Birch Growth Inc. / SBG APIs** (`…wsLJND`).
2. Catalog Products/Prices for the three current packages **do not exist** yet (optional for app `price_data` path).
3. Legacy $1,900 Birch product remains; leave it alone; do not map new SKUs to it.
4. Birch webhook endpoint on `birchreserve.net` is **missing** — separate ops step after Randy approval.
5. Still no secret keys or `whsec` values in this document.


## Autoscale HARD 500 recovery note (2026-09-11)

Live apex + `birch-list-ad-agency.replit.app` returned Google Frontend 500 on all paths (including static) after failed publishes the afternoon of Sep 10. Operator Replit UI jammed on Cloudflare Verify.

**Boot risk:** `@workspace/api-server` `prestart` ran `pnpm --filter @workspace/db run push` (integrity check + drizzle-kit push + security guards). Any failure there prevents `start` → process never listens → GF 500 everywhere.

**Code harden (this branch):** `prestart` is best-effort — db push failure logs a warning and continues so HTTP can bind. Explicit `pnpm --filter @workspace/api-server run db:push` remains for intentional migrations.

**Still required for live recovery:** republish/restart Autoscale from a desktop that can open Replit (or clear CF on the bot box). GitHub PR alone does not restart a hung Autoscale until Replit pulls/redeploys.
