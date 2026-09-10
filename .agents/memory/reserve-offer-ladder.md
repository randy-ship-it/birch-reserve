---
name: Reserve offer ladder
description: Durable pricing, inventory, and legacy-compatibility policy for Birch Reserve offers.
---

New Birch Reserve purchases use three one-time USD offers: Access Reserve at $990, Placement Pilot at $4,900, and Network Pilot at $9,900. Each payment is 100% media credit, uses one shared eight-seat inventory pool, requires a final insertion order before delivery, and does not guarantee impressions.

Stored reservation values are authoritative for checkout, payment verification, order views, and insertion orders. Existing legacy USD reservations remain readable and payable only at their stored price; historical CAD records remain visible for accounting and inventory but cannot enter a new USD checkout.

**Why:** The three levels map to distinct buying jobs while keeping the default entry commitment low. Immutable stored values and strict Stripe metadata matching prevent tier drift, cross-tier session reuse, or accidental conversion of historical records.

**How to apply:** Default human and machine buyers to Access Reserve, require an explicit canonical SKU for machine quotes, count canonical and supported legacy reservations against the same inventory boundary, and never expose legacy offers for new purchase creation.