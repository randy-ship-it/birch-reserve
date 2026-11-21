# AGENTS.md: start here (AI agents and new developers)

birchreserve.net: Birch Reserve sells display placements inside private health and wellness hubs. It runs on the
Scale Health ad system (one ad rig, sold by Birch Reserve and by Scale Health direct). This repo is the site, the API
and the ad server. Docs index: [`docs/README.md`](docs/README.md).

## Repo map

| Path | What |
|---|---|
| `artifacts/api-server` | Express 5 API + server-rendered pages. Runs as one Vercel function (`src/vercel.ts`) or `node dist/index.mjs` |
| `artifacts/api-server/src/lib/adserver` | Ad system: engine, store (Postgres), serve/track, embed.js, creative specs, admin + buyer pages |
| `artifacts/api-server/src/routes` | HTTP routes (`adserver.ts` = ads, `buy.ts` = /buy, many marketing routes) |
| `artifacts/api-server/tests` | node:test suites, one npm script each (`test:<name>`); PGlite for Postgres |
| `artifacts/clinichub-media` | Vite + React SPA (marketing pages, /intake). `public/` is served as static files |
| `artifacts/mockup-sandbox` | design mockups, not deployed |
| `lib/db`, `lib/api-spec`, `lib/api-zod`, `lib/api-client-react` | shared Drizzle DB, OpenAPI spec and generated clients |
| `scripts/vercel-build.mjs` | builds `.vercel/output` (static SPA + one function) and the routing table |
| `docs/` | how things work; start with `docs/README.md` |

## Run

```bash
pnpm install --no-frozen-lockfile        # Node 24, pnpm 9
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run test:adserver      # any test:<name>; see package.json
pnpm --filter @workspace/api-server run test:creative-spec
pnpm --filter @workspace/clinichub-media run dev           # SPA
```

The API needs `DATABASE_URL` to boot. Ad-system tests use PGlite and need no database or network. The full
`pnpm --filter @workspace/api-server test` chain stops at the first failure; run the suite you touched.
Known failing on main (not yours to fix in passing): public-seo, overhaul dual-sales-motion, brand-intake hero path,
ui-events ×2, ai-discovery llms copy, launch, marketplace-safety, clinichub-media kitView typecheck.

## Deploy

- Vercel team `sbg-516724e0`, project `birch-reserve`. Merging to `main` deploys production via the Git integration.
  PRs get preview deployments. Previews use the `ads_preview` Postgres schema; production uses `public`.
- Commits that ship: author `randy-ship-it <randy@silverbirchgrowth.com>`.
- Rollback: promote the previous production deployment in Vercel (Deployments → … → Promote / Instant Rollback).
- Verifying live pages from a server IP can hit Vercel 429s; use a normal browser user agent (Playwright).

## Flags and env (names only; values live in Vercel, never in code)

`docs/VERCEL-ENV.md` lists every variable. Ads: `ADS_SERVING_ENABLED` (kill switch), `ADS_ADMIN_KEY`, `ADS_ADMIN_EMAILS`,
`ADS_LOGIN_EMAIL_ENABLED`, `ADS_HUB_ALERT_EMAIL_ENABLED`, `STRIPE_*`, `RESEND_API_KEY`, `SESSION_SECRET`, `CRON_SECRET`.
Scale side (`silverbirchgrowth/scalehealthnew`): `VITE_BIRCH_ADS=on` shows the hub slot.

## Data model (ads)

Additive DDL in `src/lib/adserver/store.ts` (runs on boot). Core: `ad_campaigns`, `ad_creatives` (+ `kind`, `format`,
`duration_ms`, `headline`, `cta`, `warnings`), `ad_creative_variants`, `ad_events`, `ad_ledger`, `ad_hubs`, payout tables.
Full list and flows: `docs/ads/ARCHITECTURE.md`.

## Rules (never do)

1. **No secrets in code, commits, issues or chat.** Env vars go in Vercel. If you see a token, don't copy it; tell the owner.
2. **Don't touch ScaleHealth Connect** (the hubs are built separately by their team) **or Align ops.** For hubs, hand
   over the drop-in kit (`docs/ads/HUB-DROP-IN.md`); never open PRs in their repos.
3. **No fake activity.** Every count, pulse, or report number comes from real rows. Modelled figures are labelled.
4. **Visitor copy:** no impression, CTR or ROAS guarantees; USD pricing; no client names, partner counts or forecast
   wording on public pages; no Align, Clairvoyant, MedVibe or Friday mentions.
5. **DDL is additive only** (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). No drops or renames in prod.
6. **Money never moves automatically.** Payouts are manual batches.
7. **Scale mirror:** skin may change chrome/colour/name only, never fields, payloads or tracking (`docs/SCALE-MIRROR.md`).
8. Don't send email, Slack or texts to real people from tests or scripts.

## Where to change common things

| Change | File |
|---|---|
| Creative sizes, file rules, copy limits | `src/lib/adserver/creativeSpec.ts` (then `docs/ads/CREATIVE-SPECS.md`, `scripts/gen-creative-templates.sh`) |
| How ads render on hubs/partner pages | `src/lib/adserver/embed.ts` |
| Rates | `src/lib/overhaul/pricing.ts` (`RATE_SURFACES`) |
| Payout split | `src/lib/adserver/payoutSplit.ts` |
| Ad admin / buyer UI | `adminPage.ts`, `accountPage.ts` (styles: `ui.ts`, intake tokens: ink #071A39, paper #F9F8F6, lime #C8F55A) |
