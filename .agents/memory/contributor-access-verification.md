---
name: Contributor access verification
description: How contributor-first review stays auditable without letting public requesters grant themselves priority.
---

Public marketplace requests may identify the contributor route, but a public submission must never grant verified or priority status.

**Why:** Contributor-first review is a real operating policy, while the public form has no trusted contributor identity. Treating a client-selected buyer type as proof would make the policy misleading and easy to self-escalate.

**How to apply:** Persist access route separately from buyer type. Derive only a pending state for contributor-route submissions and a not-applicable state for open-market submissions. Only trusted private review may verify eligibility, and public copy must disclose that verification step.