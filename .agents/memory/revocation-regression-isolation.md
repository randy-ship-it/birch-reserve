---
name: Revocation regression isolation
description: How to keep access-revocation browser tests deterministic across polling and mutation failure paths.
---

Test background access-watchdog revocation separately from immediate 401/403 mutation denial.

**Why:** When a browser suite accelerates the watchdog interval, flipping one shared “revoked” state before clicking a mutation can let polling lock and unmount the page first. The test then appears flaky or passes without proving the mutation error path.

**How to apply:** In watchdog cases, revoke all private reads and wait for the poll. In mutation cases, keep reads authorized and fail only the targeted mutation, then assert the same stable denial and private-state purge.