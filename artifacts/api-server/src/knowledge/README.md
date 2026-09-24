# Vendored voice-closer knowledge (runtime snapshot)

**Source of truth:** `/workspace/sales-brain/` (edit there, then run `./build.sh`).
`build.sh` generates the mirror at `/workspace/birch-live-ops/voice-closer/knowledge/`.
This folder is a byte-identical copy of that mirror so the Autoscale api-server can load it at runtime.
Never hand-edit this folder or the mirror.

## Sync rule (before ship)

```bash
(cd /workspace/sales-brain && ./build.sh)
cp -a /workspace/birch-live-ops/voice-closer/knowledge/*.md \
  artifacts/api-server/src/knowledge/voice-closer/
diff -r /workspace/birch-live-ops/voice-closer/knowledge artifacts/api-server/src/knowledge/voice-closer
```

## Load order (`src/lib/voiceCloserKnowledge.ts`)

1. `SYSTEM-PROMPT.md` (sales-brain core 00-30: identity, qualify then AI call then Cal, routing URLs, phone phrasing)
2. `BIRCH-OFFER.md`
3. `CROSS-PORTFOLIO.md`
4. `HANDOFF-CHECKLIST.md`
5. `SCALE.md`
6. `ALIGN.md`
7. `RDGDH-PORTFOLIO.md`
8. `TEAM-ACCESS.md`
9. `NEVER-SAY.md` (last, so it wins)

`ROUTING-URLS.md` is vendored but not loaded: its table is already in SYSTEM-PROMPT.md, and its tail is the ops verification log.
HTML comments (GENERATED headers) and anything after `<!-- ROUTING-VERIFICATION-LOG` are stripped before the prompt is sent.
The birchreserve.net site scope (Birch-only opener, identity, routing rule) is layered on in `src/routes/randyChat.ts`.
