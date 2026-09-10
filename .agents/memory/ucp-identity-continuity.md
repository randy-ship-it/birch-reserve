---
name: UCP identity continuity
description: Security boundary for moving an active machine checkout between agent profile URLs.
---

Treat a UCP profile URL as a locator, not proof of identity. Bind current ownership to the authenticated request-signing key. Authorize profile changes with the separately advertised continuity key recorded before the move, scoped to the checkout and replacement profile, short-lived, and replay-resistant.

**Why:** Negotiating a public profile verifies compatibility but does not prove the caller controls that URL. URL-only transfer would weaken cross-agent isolation; conflating request authentication with continuity prevents independent key rotation; incomplete retry-state transfer can disclose, duplicate, or strand an earlier checkout; pre-signing-key rows otherwise need a secure bridge from URL ownership; and nested pool acquisitions can deadlock at connection capacity.

**How to apply:** Persist continuity verification material before a move; verify current ownership on every read, retry, and mutation; move ownership and all retry identity mappings atomically; and keep an attributable, append-only audit independent of checkout deletion. A pre-signing-key checkout may enroll only through an authenticated request for its original profile plus the original idempotency capability; bind the verified key and continuity material atomically and audit the enrollment. Serialize operations that could race across that ownership boundary. When one operation needs multiple advisory locks, acquire them in deterministic order on one pool connection and bound connection acquisition itself.