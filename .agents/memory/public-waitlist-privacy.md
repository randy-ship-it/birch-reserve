---
name: Public waitlist privacy
description: Privacy and ordering rules for public pilot-queue acknowledgements.
---

Keep exact waitlist rank and duplicate membership private on unauthenticated public endpoints. Serialize new-entry ordering, but return the same generic acknowledgement shape for both new and repeat submissions.

**Why:** An exact rank or duplicate flag lets anyone test guessed email addresses for marketplace participation. Concurrent rank calculation can also report a transient position that disagrees with the durable order.

**How to apply:** Use one serialized transaction for canonical queue insertion. Expose exact position only after proving email ownership, such as through a verified email link; until then, return an opaque per-request reference.