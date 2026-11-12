# Birch Reserve category seats ⇄ Friday App

Friday App is the source of truth for seat state and buyers. Friday published its side in
**randy-ship-it/friday-crm PR #159** (draft, preview only; spec `docs/BIRCH_SEATS.md` on branch
`birch-seat-inventory`). Birch Reserve (BR) reads availability from it and writes every seat action to it.
BR never marks a seat taken itself: an unpaid request does not change availability.

ScaleHealth Connect and Align ops are untouched. scalehealth.ca/localdemand is linked, not read.

## 1. Read: availability

| Env | `FRIDAY_SEATS_URL` |
|---|---|
| Preview (now) | `https://friday-crm-git-birch-seat-inventory-sbg-516724e0.vercel.app/api/public/birch/seats?fixture=1` |
| Production (after Randy approves Friday PR #159) | `https://fridayapp.org/api/public/birch/seats` |

`GET`, no auth, CORS `*`, `Cache-Control: max-age=15`. Shape:
`{org, source, as_of, total:8, open, held, locked, categories:[{slug, name, status: open|held|locked, holder:{brand}|null, held_until, requests, waitlist}]}`.

Slugs (same as Friday): `pain-relief-topicals`, `recovery-hardware`, `nutrition`, `sleep`, `meal-prep`,
`womens-health`, `mens-health`, `diagnostics-services` (`pain-relief` still accepted as an alias).

BR rules (`artifacts/api-server/src/lib/seats/availability.ts`):
- `FRIDAY_SEATS_URL` set: use Friday only if 200 and strictly valid (org birchreserve, all 8 slugs, known
  status, `as_of` < 24 h). 2.5 s timeout, 15 s cache. Expired `held_until` → shown as unknown, not open.
  **Unreachable / 503 / invalid → "call to confirm"** (`open: null`, no count, never a fake "sold").
- `fixture: true` answers are accepted only off production (`VERCEL_ENV !== "production"`), labelled
  "Preview sample data", and rejected on prod.
- `holder.brand` is not displayed (cards just say Locked).
- `FRIDAY_SEATS_URL` unset: BR ledger (`lib/seats/ledger.ts` / `SEAT_LEDGER_JSON`, valid 14 days;
  all 8 open as of 2026-11-12), else call to confirm. `FRIDAY_SEATS_DISABLED=true` skips Friday.
- The intake secret is never sent to the public read.

## 2. Write: every seat action → `POST {FRIDAY_API_URL}/api/intake`

Headers: `X-Intake-Secret: {FRIDAY_API_KEY}` (plus the legacy `Authorization: Bearer`, same key).

| BR action | `externalId` | `meta.seat_action` | `meta.sku` | `value` | `meta.paid` |
|---|---|---|---|---|---|
| One-click Hold | `birch-seat-<uuid>` | `hold` | `hold-190` | 190 (or 270 CAD) | false |
| One-click Lock | `birch-seat-<uuid>` | `lock` | `reserve-490` | 490 (or 690 CAD) | false |
| "Request a category lock" form | `birch-seat-<uuid>` | `lock` | `reserve-490` | 490 | false |
| Waitlist | `birch-seat-<uuid>` | `waitlist` | `waitlist` | – | false |
| Impression block request | `birch-seat-<uuid>` | – | `block-*` | block price | false |
| **Paid** (Stripe webhook, once `SEATS_ENABLED`/`SEATS_LIVE`) | **same id as the request** (carried in Stripe `metadata.intake_external_id`) | `hold`/`lock` | `hold-190`/`reserve-490` | amount paid | **true**, + `stripe_session_id`, `order_id` |

Always: `org=birchreserve`, `site=birchreserve.net`, `meta.category=<slug>`, `meta.lead_source`,
`company`, `email`, `currency`. Test submits (`?seats_test=1`) carry `meta.is_test=true`, which Friday
ignores for seat state. BR does **not** send the `birch:hold-190` / `birch:reserve-490` tags on unpaid
requests, so a deal never advances a stage without money; Friday's forward-only `meta.sku + paid=true`
rule does the stage move on payment.

## 3. Alerts (BR side)

Every action in §2 also emails **only** randy@scalehealth.ca, randy@silverbirchgrowth.com,
sales@silverbirchgrowth.com via Resend (`RESEND_API_KEY`), Reply-To = buyer, no buyer auto-reply.
Body: action, buyer, email, phone, category, SKU, amount, time (America/Toronto), availability source.
`SEAT_ALERTS_DISABLED=true` mutes.
