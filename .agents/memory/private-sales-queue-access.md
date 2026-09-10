---
name: Private sales queue access
description: Privacy boundary for staff review of advertiser follow-up requests.
---

Advertiser contact details may appear only after server-side staff authorization. Private responses must not be shared-cacheable, browser credentials must stay in memory, and clearing access must cancel and remove private queries while preventing late mutation callbacks from restoring them. Status-update responses should remain minimal and exclude contact details. Raw Guide questions and transcripts remain outside storage and every response.

**Why:** A status request can finish after staff clear access. Without an access-session guard, its callback can repopulate private client state even though the screen is locked.

**How to apply:** Any staff queue or mutation that carries private intake data must bind cache writes to the active access attempt, clear queries and pending mutation context on revocation or unmount, and return only the fields needed for each action.