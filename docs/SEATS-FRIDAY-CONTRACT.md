# Birch Reserve category seats ⇄ Friday App contract

Friday App is the source of truth for buyers and seat state. Birch Reserve (BR) only *reads* seat
availability and *writes* intake records. BR never marks a seat taken on its own: a form submit or an
unpaid request does not change availability; Randy confirms in Friday.

ScaleHealth Connect and Align ops are untouched. scalehealth.ca/localdemand is linked, not read
(it exposes no public data API today).

## 1. Writes: every seat action → Friday intake (exists today)

`POST {FRIDAY_API_URL}/api/intake` · `Authorization: Bearer {FRIDAY_API_KEY}` · `org=birchreserve`

| BR action | `kind` | `meta.sku` | `meta.paid` | Stage effect in Friday |
|---|---|---|---|---|
| One-click Hold ($190 7-day look) | `seat_hold` | `hold-190` | `false` | New lead (no stage advance; unpaid) |
| One-click Lock ($490 named seat) | `seat_lock` | `reserve-490` | `false` | New lead |
| Waitlist ("tell me when it opens") | `seat_waitlist` | `hold-190` | `false` | New lead |
| "Request a category lock" form | `seat_lock_request` | `reserve-490` | `false` | New lead |
| Impression block request | `seat_block_request` | `block-*` | `false` | New lead |
| Stripe paid (once `SEATS_ENABLED`/`SEATS_LIVE`) | `seat_paid` | `hold-190` / `reserve-490` | `true` | Paid SKU → Hold $190 / Reserved $490 stage via existing sku rule |

Meta keys used (all on Friday's whitelist): `category`, `sku`, `amount`, `paid`, `lead_source`,
`timing`, `stripe_session_id`, `is_test`, `utm_*`, `referrer`. Extra context
(`category_label`, `currency`, `availability_source`, `category_status`, `time_toronto`) rides in the
message body so nothing is dropped by the whitelist. `external_id` includes kind + category + sku +
email so repeat clicks de-duplicate. The `birch:hold-190` / `birch:reserve-490` *tags* are **not** sent
on unpaid requests, so they never jump a stage without money.

Test records carry `is_test=true` (preview `?seats_test=1`).

## 2. Reads: seat availability — **Friday needs to expose this**

```
GET {FRIDAY_SEATS_URL || origin(FRIDAY_API_URL)}/api/birch/seats?org=birchreserve
Authorization: Bearer {FRIDAY_SEATS_KEY || FRIDAY_API_KEY}   (service key, read-only scope)

200 application/json
{
  "org": "birchreserve",
  "as_of": "2026-11-12T19:55:00Z",          // ISO-8601, must be < 24h old
  "categories": [                            // exactly these 8 slugs, each once
    { "slug": "pain-relief",          "status": "open" },
    { "slug": "recovery-hardware",    "status": "held", "held_until": "2026-11-19T17:00:00Z" },
    { "slug": "nutrition",            "status": "locked" },
    { "slug": "sleep",                "status": "open" },
    { "slug": "meal-prep",            "status": "open" },
    { "slug": "womens-health",        "status": "open" },
    { "slug": "mens-health",          "status": "open" },
    { "slug": "diagnostics-services", "status": "open" }
  ]
}
```

Public-safe only: **no buyer names, emails or amounts** (BR may echo this to the public page and
agents).

### Suggested Friday derivation (org=birchreserve deals tagged `seat:<slug>`)

| Friday deal state for the category | `status` |
|---|---|
| Any deal in Reserved $490 / IO sent / Live | `locked` |
| Else a deal in Hold $190 created/paid within the last 7 days | `held` + `held_until` = paid_at + 7 days |
| Else | `open` |

(Friday already has `inventory_units`, but only behind Clerk session auth; this endpoint is the
service-key view of it.)

### How BR uses it (artifacts/api-server/src/lib/seats/availability.ts)

1. Friday answer, if 200 and strictly valid (all 8 slugs, known status, `as_of` < 24h). 2.5 s timeout,
   cached 60 s. An expired `held_until` is shown as *unknown*, not open.
2. Else the BR ledger (`lib/seats/ledger.ts`, or `SEAT_LEDGER_JSON` env), valid for 14 days from
   `as_of`. Today: all 8 open as of 2026-11-12 (no paid or confirmed seats).
3. Else **"call to confirm"** — `open: null`, no count, never a fake "sold".

Kill switch: `FRIDAY_SEATS_DISABLED=true` skips step 1.

## 3. Alerts (BR side, not Friday)

Every action in §1 also emails **only** randy@scalehealth.ca, randy@silverbirchgrowth.com,
sales@silverbirchgrowth.com via Resend (`RESEND_API_KEY`), Reply-To = buyer. No buyer
auto-reply. Body: action, buyer, email, phone, category, SKU, amount, time (America/Toronto),
availability source. `SEAT_ALERTS_DISABLED=true` mutes.
