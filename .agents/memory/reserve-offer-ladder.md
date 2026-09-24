---
name: Reserve offer ladder
description: Durable pricing, inventory, and legacy-compatibility policy for Birch Reserve offers.
---

Public Birch Reserve purchases are two one-time USD offers: hold-190 at $190 (7-day category look, does not consume an 8-seat) and reserve-490 at $490 (named category seat, 100% media credit). Custom multi-hub, exclusive, and on-prem work is a call, not a homepage price.

reserve-899 stays in the catalog as unpublished/legacy so existing Stripe Checkout sessions still match. Older SKUs (reserve-990, pilot-4900, network-9900, splash-1900) stay payable for stored reservations and are not public.

**Why:** The live Stripe path must keep matching cs_live sessions while the public site stops heroing $899, $990, $4,900, and $9,900.

**How to apply:** Default buyers to reserve-490. Do not put $899, $4,900, or $9,900 on the homepage, og, llms.txt, JSON-LD, or Birch Guide. hold-190 must not count against the eight-seat pool. Checkout may use `STRIPE_PRICE_HOLD_190`, `STRIPE_PRICE_RESERVE_490`, and `STRIPE_PRICE_RESERVE_899` when those env vars are set. Do not commit Price ID values.
