---
name: Advertiser intake session deduplication
description: How completed public advertising follow-ups remain non-repeatable without retaining contact or conversation data in browser session state.
---

A successful advertising follow-up must reopen as a completed, read-only state for the rest of the browser tab session. Persist only the opaque receipt and bounded intake selections; never persist the email address or chat text in session state.

**Why:** In-memory completion flags can be lost during a page reload or development hot reload, which can re-enable the form and create a second durable follow-up request. Retaining contact or conversation data just to prevent that duplicate would weaken the privacy boundary.

**How to apply:** Every public advertising-intake entry point should consult the shared tab-session completion state before showing an email field or submit action. Format-neutral learning requests must remain format-neutral when restored.