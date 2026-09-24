# Birch Reserve — Voice Closer Knowledge Pack

**Owner:** Birch Reserve lane (pack SoT).  
**Consumers (order):** Scale → Align → then rest of RDGDH portfolio.  
**As of:** 2026-09-24 ~2:25pm ET  
**Rule:** One source of truth. Do not fork this pack into siloed Scale/Align copies. Consume via CROSS-PORTFOLIO.md + HANDOFF-CHECKLIST.md.

## What this pack is

Instructions + facts for a Grok voice (or chat) agent that **sounds like Randy Gilling** and can close or triage across:

1. **Birch Reserve** — click-to-callback closer + site chat “Randy” avatar (same pack)
2. **Scale Health** — providers / clinichubs / brand hubs (consumer #1)
3. **Align Wellness / CHI** — fulfillment / MSP network (consumer #2)
4. **RDGDH portfolio** — SBG, Friday, WePrize, WeFlush, ParKings/GetParkings when present

The agent is **portfolio-aware Randy**, not a Birch-only pusher. Birch owns the files; other lanes pull the same locks.

## How to use (system prompt sections)

Paste into Voice Agent Builder / `session.instructions` in this order:

| # | Section | Source file |
|---|---------|-------------|
| 1 | Identity + tone (Randy) | `SYSTEM-PROMPT.md` § Identity |
| 2 | HARD offer locks + when to book vs Hold/Reserve | `SYSTEM-PROMPT.md` § Offer + `BIRCH-OFFER.md` |
| 3 | Never-say / never-promise | `NEVER-SAY.md` (also summarized in SYSTEM-PROMPT) |
| 4 | Handoff rules (Scale / Align / call / email) | `SYSTEM-PROMPT.md` § Handoff + `HANDOFF-CHECKLIST.md` |
| 5 | Cross-portfolio routing | `CROSS-PORTFOLIO.md` |
| 6 | Lane deep facts (load on demand / RAG) | `SCALE.md`, `ALIGN.md`, `RDGDH-PORTFOLIO.md` |
| 7 | Team share / demo access | `TEAM-ACCESS.md` |

**Minimum paste for Birch click-to-callback:** SYSTEM-PROMPT.md (full) + NEVER-SAY.md hard list. Keep BIRCH-OFFER.md / SCALE.md / ALIGN.md available as retrieval context.

## File map

| File | Purpose |
|------|---------|
| `README.md` | This map |
| `SYSTEM-PROMPT.md` | Ready-to-paste agent instructions (Randy voice, portfolio-aware) |
| `BIRCH-OFFER.md` | Public SKUs, 8 seats, proof URL, checkout OFF until Gordon |
| `SCALE.md` | Scale Health: rails-not-leads, link order, CA vs US posture |
| `ALIGN.md` | Align / CHI / physio network as fulfillment |
| `RDGDH-PORTFOLIO.md` | Holdco + sister products (factual only) |
| `NEVER-SAY.md` | Forbidden claims from Randy HARD locks |
| `CROSS-PORTFOLIO.md` | One SoT; consumer order; no siloed forks |
| `HANDOFF-CHECKLIST.md` | When to route Scale vs Align vs Birch vs Book a call |
| `TEAM-ACCESS.md` | Shared demo URL plan for Randy / Jon / Simar / Chris / Barb |

## Source locks (do not invent beyond these)

- `/workspace/birch-live-ops/locks/BIRCH-RESERVE-BOT-LOCK-2026-09-24.md`
- `/workspace/birch-live-ops/AD-SALES-LOCK-2026-09-24.md`
- `/workspace/birch-live-ops/locks/BIRCH-LOCK-companion-2.md`
- `/workspace/birch-live-ops/voice-closer/VOICE-CLOSER-V1-BUILT-IN.md`
- `/workspace/scale-biz-knowledge/HARD-Scale-Provider-TalkTrack-24Sep2026.md`
- `/workspace/scale-biz-knowledge/INTERNAL-Clinic-Hubs-Launch-Queue-24Sep2026.md`
- `/workspace/scale-biz-knowledge/INTERNAL-Scale-Align-Monetization-23Sep2026.md` (**internal economics only — never speak % to prospects**)
- `/workspace/scale-us/HARD-TALKTRACK-REFRESH-2026-09-24.md`
- `/workspace/scale-clinic-fulfillment/ICA_TALKTRACK_LOCK_2026-09-22.md` (CA ON / US STOP reopen note)
- `/workspace/friday-crm/docs/PORTFOLIO.md`
- Live portfolio JSON-LD on https://rdgdh.com/portfolio

Anything not in those files → mark **UNKNOWN** and offer Book a call / email randy@silverbirchgrowth.com.

## Checkout / voice status (ops)

- Checkout on birchreserve.net stays **OFF** until Gordon stamps (`approval_status=pending_gordon`).
- **HARD voice direction:** Randy clone is the product voice. Built-in (`eve`/`ara`) is scaffolding only until clone audio + provision land.
- Phone provision: in flight (prefer 647/416). Private team demo URL waits on number + agent (see `TEAM-ACCESS.md`).
- Birch owns this folder; Scale → Align pull — do not fork.

## Cal / Book a call

HARD: no bare Cal. Qualify in chat/voice first; Cal https://cal.com/randy-gilling/30min only post-qualify. See CROSS-PORTFOLIO.md.
