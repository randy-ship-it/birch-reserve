---
name: Splash checkout state transitions
description: Safety rules for public seat holds and Stripe checkout lifecycle.
---

The public reserve must be persisted before attempting Stripe Checkout. If Stripe is unavailable, misconfigured, or returns a mismatched price, keep the seat held and never imply that a charge occurred. Private activation payment attempts still require an atomic claim before creating a Checkout Session.

**Why:** The public offer must remain usable before payments are connected, while checkout races and webhook retries must never create orphaned or falsely reported charges.

The Replit Stripe connector can create and retrieve Checkout Sessions without exposing credentials, but it does not provide a webhook signing secret to application code. Treat authenticated session retrieval on Stripe's return redirect as a valid payment-confirmation path; keep signed webhooks as an optional second path when separately configured.

**Why:** A connector-only installation must not leave successfully paid reservations stuck in `payment_pending`, and a browser query string must never be trusted as proof of payment.

**How to apply:** Persist the fixed offer and amount first, validate the live Stripe Price before redirecting, and degrade to a truthful held-seat receipt on any checkout failure. Confirm returning sessions by retrieving them through Stripe and validating their stored metadata, amount, and currency before marking paid. Keep monotonic attempts, bind webhooks to stored sessions, and expire unattached sessions.

If Stripe Checkout creation has an ambiguous outcome, keep the attempt in a reconciliation-required state that continues holding inventory. Do not make it retryable or release its seat unless the session is found non-payable or is successfully canceled.

**Why:** Stripe may accept a creation request even when the application loses the response. Releasing that seat or issuing a new attempt can produce both an orphan charge and an over-capacity paid reservation.

**How to apply:** Treat timeouts, lost responses, and crashed attachment steps as unresolved payment attempts. Use the original idempotency key during reconciliation; only confirmed cancellation or final nonpayment may return the seat.

Persist the original checkout parameters, idempotency key, and immutable attempt start time before contacting Stripe. Never replay creation after the provider's guaranteed idempotency-retention window; keep an older ambiguous attempt held for staff investigation instead.

**Why:** Reusing an idempotency key after Stripe may have pruned it can create a second Checkout Session rather than recover the first.

**How to apply:** Automatic reconciliation may replay only within a conservative window shorter than Stripe's guarantee. A recovered open session may restart the buyer's hold clock once because the buyer never received it; ordinary retries and repeated reconciliation must not extend that clock.

Any checkout renewal must compare-and-set the reservation's active lifecycle status as well as its Stripe session and payment state.

**Why:** Cleanup may release inventory while renewal is inspecting Stripe. A renewal that checks only payment fields can resurrect an expired row after a replacement buyer has claimed the seat.

**How to apply:** Require the expected active status in the renewal update. If cleanup won, return a terminal conflict; intentional reacquisition must go through the inventory lock and a fresh capacity check.

Verified payment must converge through webhook delivery, the browser's server-verified return, or lifecycle reconciliation; no single delivery mechanism may be required for a paid row to advance.

**Why:** Connector checkout can succeed without a configured webhook, and browser returns can also be interrupted. Treating either path as mandatory leaves paid reservations held but unpaid forever.

**How to apply:** Bind the returned Stripe session to the stored order before recording payment. Cleanup should record a remotely paid session rather than skipping it, and every payment transition must preserve Stripe identifiers and price/currency checks.

A validated paid event for the exact recovered Stripe session must be allowed to restore an expired recovery row, regardless of whether payment or confirmed expiration committed first.

**Why:** Webhook delivery can race recovery, and a valid payment must not disappear. Capacity repair after an unusually late payment is a separate operational concern.

**How to apply:** Match the stored session ID and fixed amount/currency, then let payment win monotonically over recovery failure or expiration.

Failure webhooks must identify the checkout attempt before they can release an unattached `checkout_creating` claim; reservation identity alone is insufficient.

**Why:** A delayed failure from an older attempt can arrive while a newer Stripe request is unresolved. Downgrading the newer claim makes cleanup release inventory while its payment outcome is still unknown.

**How to apply:** Put the attempt number in Stripe session metadata. For pre-attachment failures, compare it to the stored attempt; for attached sessions, exact Stripe session identity remains authoritative for legacy compatibility.

Buyer-initiated cancellation must resolve and expire any attached open Checkout Session before compare-and-set releases inventory. Preserve the payment state and Stripe identity on the terminal row.

**Why:** Clearing capacity first can oversell while Stripe remains payable, while rewriting payment fields can erase evidence needed for a late verified payment to win.

**How to apply:** Exclude unresolved checkout creation, let paid and terminal rows return unchanged, and make repeated cancellation converge on the stored terminal state.

Delegated token-payment recovery must distinguish an initial creation rejection, replay of an unknown outcome, and retrieval of a known PaymentIntent. Only a verified initial non-creation or a matching terminal PaymentIntent may release the hold.

**Why:** A replay or retrieval can fail after the original request was accepted. Treating that later error as proof of nonpayment can permit a duplicate charge or release inventory while payment still settles.

**How to apply:** Persist an immutable attempt key and non-secret credential fingerprint before charging. Keep unresolved replays and retrieval failures held, preserve known PaymentIntent IDs, and stop automatic replay before idempotency retention expires. A configured platform credential remains required even when payment discovery is disabled. If interactive authentication is required, release the attempt only after Stripe confirms cancellation; cancellation errors keep it unresolved.