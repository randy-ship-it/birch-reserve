---
name: Reservation alert delivery boundary
description: Reliability boundary for immediate staff notifications after a buyer reservation is saved.
---

Start reservation alerts only after the buyer record is durably saved, but start them independently of slower downstream synchronization. Alert delivery must have a short end-to-end deadline and must never gate the buyer’s receipt or checkout handoff.

**Why:** Delivery providers and data-sync services can stall rather than reject. Awaiting either in sequence can leave a successfully saved buyer request looking hung and can prevent an otherwise valid checkout from starting.

**How to apply:** For any new reservation notification channel, preserve the save-first boundary, launch notification work before optional pipeline sync, cap the complete provider interaction, and persist private sent/failed state for recovery.