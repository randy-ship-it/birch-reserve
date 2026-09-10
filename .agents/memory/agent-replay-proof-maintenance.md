---
name: Agent replay-proof maintenance
description: Performance and correctness boundary for maintaining signed-request nonce proofs.
---

Keep each signed-request nonce claim atomic and on the authenticated request path. Expired-proof pruning must be bounded, rate-limited, and outside the claim transaction; concurrent workers should skip rows another cleanup has locked.

**Why:** A broad delete in every request transaction preserves correctness but adds avoidable write contention as signed traffic and proof history grow. Cleanup must not weaken the unique nonce claim or delay authentication.

**How to apply:** When changing agent authentication or proof retention, treat the database uniqueness constraint as the replay authority. Exercise duplicate claims concurrently with cleanup, and do not couple successful authentication to cleanup success.