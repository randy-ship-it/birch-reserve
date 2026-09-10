---
name: Shared admission test isolation
description: Why shared profile-admission tests need durable-state cleanup and bounded worker concurrency.
---

Shared profile-admission tests must isolate every durable client bucket they use and keep worker concurrency below the production admission deadline.

**Why:** The test database persists across invocations, so fixed synthetic client keys can inherit depleted budgets. Large simultaneous worker bursts can also exceed the production deadline and activate the intentional per-process fallback, invalidating assertions about shared coordination.

**How to apply:** Use unique client keys or explicitly delete fixed synthetic keys before and after a test. Keep separate workers concurrent to exercise shared coordination, but issue each worker's claims in a bounded sequence unless the test is specifically about timeout fallback.