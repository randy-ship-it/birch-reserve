# Vendored voice-closer knowledge (runtime snapshot)

**Source of truth (SoT):** `/workspace/birch-live-ops/voice-closer/knowledge/`  
Birch-live-ops remains the only talk-track SoT. This folder is a **synced snapshot** so Autoscale / api-server can load instructions at runtime (Repl cannot read birch-live-ops paths).

## Sync rule (before ship)

```bash
cp -a /workspace/birch-live-ops/voice-closer/knowledge/*.md \
  artifacts/api-server/src/knowledge/voice-closer/
```

Do **not** invent alternate talk-track here. Edit SoT first, then re-sync. Last sync should match SoT mtimes / content.

## Load order (system concat)

Prefer README paste order; practical concat used by `randyChat` route:

1. `SYSTEM-PROMPT.md`
2. `NEVER-SAY.md`
3. `BIRCH-OFFER.md`
4. `CROSS-PORTFOLIO.md`
5. `HANDOFF-CHECKLIST.md`
6. `SCALE.md`
7. `ALIGN.md`
8. `RDGDH-PORTFOLIO.md`
9. `TEAM-ACCESS.md` (optional / size-permitting)

Public locks still apply: hold-190 / reserve-490 only; checkout OFF until Gordon; no $899 hero; Cal only after qualify.
