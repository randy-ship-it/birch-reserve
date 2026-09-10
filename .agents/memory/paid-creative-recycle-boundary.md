---
name: Paid creative recycle boundary
description: Safety rule for time-based recycling of paid inventory awaiting creative.
---

Only enable automatic recycling of a paid seat when staff have a durable way to record creative arrival, and make both transitions compare-and-set against the active lifecycle state. Advance deadline warnings must be claimed atomically, suppress repeat success, retain failed attempts for retry, and never gate recycling.

**Why:** A timer cannot know that creative arrived through an off-platform handoff unless receipt is persisted. Without atomic lifecycle and warning transitions, concurrent workers can recycle a paid buyer despite timely delivery, send duplicate warnings, or let an alert outage stop inventory cleanup.

**How to apply:** Creative receipt must move the paid reservation out of the recycle predicate without reopening terminal inventory. Cleanup and warnings apply only to paid, awaiting-creative rows; warning delivery uses durable claim/sent/failed state, and cleanup proceeds after failures.