---
name: Concierge privacy boundary
description: Why Birch Guide uses local intent classification instead of transmitting buyer questions.
---

Birch Guide must keep raw buyer questions in the browser and transmit only anonymous boolean intent signals. Its API must reject message-text fields, and model output may select only an approved advertising-interest enum; public prose stays server-owned.

**Why:** Keyword-based sensitive-data detection cannot guarantee that every health, contact, payment, credential, or identity disclosure will be recognized. Structural data minimization is the only reliable way to keep such text out of the API, AI provider, logs, and transcript state.

**How to apply:** Preserve the signal-only contract when changing the concierge. Add new structured intents only when needed; do not reintroduce free-text API or model payloads. Keep handoff behavior limited to preselection, never submission.