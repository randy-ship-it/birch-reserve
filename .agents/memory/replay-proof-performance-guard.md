---
name: Replay-proof performance guard
description: How to keep replay-proof claim performance checks repeatable across shared CI runners.
---

Use a fixed mixed population of live and expired proofs, then measure concurrent
unique and duplicate claims while bounded cleanup is active. Keep the asserted
latency ceilings intentionally much broader than the observed local baseline.

**Why:** Shared CI runners have noisy timing. Tight microbenchmark thresholds
become flaky, while fixed cardinality plus broad p95 and wall-time ceilings still
catch query-plan regressions, lock waits, and accidentally unbounded cleanup.

**How to apply:** Preserve structured benchmark output so baseline movement is
visible. When changing proof indexes, claim semantics, or cleanup locking, update
the workload only for a realistic traffic-model change; do not tune thresholds
to a single fast machine.