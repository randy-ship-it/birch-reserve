---
name: Inventory hold clocks
description: Capacity and expiry rules for current and legacy Birch Reserve offers.
---

Start the unpaid expiry clock when a transition actually acquires inventory, not when an earlier interest or review request was created. Repeated reads, reviews, and checkout retries must not extend that clock.

**Why:** Approval may happen long after submission. Using submission age can release a newly approved seat immediately, while resetting on retries lets an unpaid buyer hold inventory forever.

**How to apply:** Persist an inventory-held timestamp in the same compare-and-set transaction that admits the reservation. Cleanup compares that timestamp atomically and uses historical timestamps only as a fallback for old rows.

All offer keys that remain payable must count against and participate in the same cleanup boundary until they are explicitly migrated or retired.

**Why:** Omitting a supported legacy offer from counts allows a new buyer to claim inventory already promised to an existing payable reservation.

**How to apply:** Keep one eligibility set shared by counting, locked approval, and cleanup. Adding or retiring a payable offer must update that set and include a final-seat regression.