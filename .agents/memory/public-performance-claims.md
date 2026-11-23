---
name: Public performance claims
description: Rules for separating internal ad-planning assumptions from claims that can appear on Birch Reserve public pages.
---

Never publish 50MM visitors, 5–9% CTR, impression guarantees, Align CIM revenue/EBITDA/NDR/partner payouts, rdgdh “100MM pageviews by Dec 2026” as current traffic, or “1MM patients” as Birch monthly uniques.

Public-safe proof is the live hub https://physio.drhonow.com, named launching brands, eight category seats, 100% media credit, and “the insertion order names the surface.” Align’s ~80 partner doors are on request only, never the homepage hero.

**Approved audience framing (Randy, 2026-11-21, supersedes the old "never 1MM" line):** three channels, shown as reach and audience, never as delivered impressions or a guarantee.
1. Branded ScaleHealth.ca hubs: 700MM+ captive page views activating.
2. Private retail network of fitness & recovery retailers: 200+ locations, 500+ soon, 1MM+ captive recovery consumers.
3. Owned digital clinic Calm Joints and Street Team Ambassadors: 1MM+ consumers now (provider network activating + Street Team), expanding to an estimated 3MM+ in 2027 (Randy, 2026-11-23; replaces the old 2MM+ homes by 2027; Street Team is Canada for now, mention lightly once).
Single source in code: AUDIENCE_CHANNELS / AUDIENCE_LINE in artifacts/api-server/src/lib/overhaul/brandIntake.ts. The old 120+ hubs, 300–500+ hubs, 2MM+ doors/homes, >20MM and >5B lines are retired. TAM feed figures (20MM+ orders, ~128MM modelled views) are modelling inputs for pricing only, labelled modelled, never presented as reach. Still never: Align, Clairvoyant, Alset, MedVibe, Friday, "signed partners", "80 locations", or "1MM patients" as Birch uniques.

**Qualifier (Randy, 2026-11-21 1:36 PM):** wherever a modelled demand figure (audience orders, views, queue, 2027 inventory) appears on birchreserve.net, /media-kit, /audiences, /inventory or scalehealth.ca/tam, say it is "based on signed partnership contracts". This overrides the "signed partners" ban for that qualifier only; never add counts (feed still holds signed_partners: 0, never publish it). Never use forecast, projection, projected, planning estimate, expected or model assumption beside these figures. Keep "not delivered impressions, not a guarantee". Keep the street team "2MM+ homes by 2027" target wording. CPM-derived impression estimates stay "modelled estimate" (they are price math, not contract demand).

**Why:** The 2026-09-24 commercial lock forbids reach and financial claims that earlier planning notes treated as publishable.

**How to apply:** If a page, guide answer, or llms.txt would state a visitor count, CTR, or CIM figure, delete it. Answer “how many people will see my ad?” with: we do not sell a guaranteed impression count.
