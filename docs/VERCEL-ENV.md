# Environment variables the API server reads

Names below are every `process.env` key read by the server. The scan is `artifacts/api-server/src`, `lib/db`, and `lib/integrations-openai-ai-server` (imported by editorial drafting and concierge). A few keys are read through a helper whose default argument is `process.env` (`env["NAME"]` or `process.env[envName]`). Those are included.

**Required** means the process throws at boot, or that feature fails closed, when the name is unset. Optional names have a default or the route keeps working without them.

Set these in the Vercel project (Preview and Production). Do not commit values.

## Required

| Name | When it is required |
| --- | --- |
| `DATABASE_URL` | Always. `@workspace/db` throws on import if it is unset, so the Vercel function and `node dist/index.mjs` both refuse to boot. Transcripts, checkout, and launch events use this Postgres URL. |
| `XAI_API_KEY` | Live Randy chat. Required unless `GROK_API_KEY` is set. Chat returns an error when both are empty and `RANDY_CHAT_AI_DISABLED` is not `true`. |
| `GROK_API_KEY` | Same chat path as `XAI_API_KEY`. Either key is enough. |
| `PORT` | Only `artifacts/api-server/src/index.ts` (the long-running listener). It throws if unset. The Vercel function does not read `PORT`. |
| `STRIPE_SECRET_KEY` | Stripe Checkout. Without it, checkout does not create a session. |
| `STRIPE_WEBHOOK_SECRET` | `POST /api/stripe/webhook`. Signature checks fail without it. |
| `SESSION_SECRET` | Marketplace token crypto. Those routes throw if it is unset. Also the fallback admin secret for splash reservations when `SPLASH_AD_ADMIN_SECRET` is unset. |
| `CLERK_SECRET_KEY` | Every `/api/*` route that runs after `clerkMiddleware`. It throws when this is unset. Also required for the `/api/__clerk` proxy. `GET /api/cron/splash-expiry` is mounted before Clerk and does not read this key. |
| `CRON_SECRET` | `GET /api/cron/splash-expiry`. The route returns 401 when this is unset or the `Authorization: Bearer` token does not match. Vercel Cron sends that header from this variable. The one-minute interval in `src/index.ts` does not read it. |

## Optional

| Name | If unset |
| --- | --- |
| `NODE_ENV` | Logging, Clerk proxy, and a few test-only branches. Vercel sets this to `production`. |
| `GROK_MODEL` | Chat uses `grok-4.3`. |
| `RANDY_CHAT_AI_DISABLED` | Chat calls the model. Set to `true` to skip the model. |
| `RANDY_CHAT_ADMIN_TOKEN` | `POST /api/launch/randy-chat/transcript-test` stays closed. |
| `RANDY_CHAT_TO` | Transcript mail uses the built-in recipient. |
| `RANDY_CHAT_FROM` | Transcript mail uses the built-in from-address. |
| `RANDY_TEL` | Transcript matching uses `+16479316278`. |
| `RANDY_TRANSCRIPTS_DISABLED` | Transcript rows are written. Set to `true` to skip them. |
| `RESEND_API_KEY` | Outbound mail is skipped. |
| `BIRCH_REPLY_TO` | Buyer mail Reply-To is `sales@silverbirchgrowth.com`. |
| `VOICE_WEBHOOK_SECRET` | `POST /api/voice/call-ended` stays closed. Also the fallback for `BIRCH_QA_SECRET`. |
| `BIRCH_LOCAL_BIZ_SECRET` | `POST /api/launch/local-biz-lead` stays closed. |
| `BIRCH_QA_SECRET` | QA header checks fall back to `VOICE_WEBHOOK_SECRET`, then fail. |
| `CONCIERGE_AI_DISABLED` | Concierge may call the model. Set to `true` to skip it. |
| `EDITORIAL_AI_DISABLED` | Editorial drafting may call the model. Set to `true` to skip it. |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Required only if editorial drafting or concierge actually imports the OpenAI client. That import throws when the key is missing. |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Same import. Required together with the API key. |
| `SEATS_TOTAL` | Seat cap defaults to `8`. |
| `SPLASH_AD_ADMIN_SECRET` | Splash admin routes fall back to `SESSION_SECRET`. |
| `SPLASH_AD_PUBLIC_URL` | Public links fall through to `PUBLIC_BASE_URL`, then `REPLIT_DOMAINS`. |
| `PUBLIC_BASE_URL` | Public links fall through to `SPLASH_AD_PUBLIC_URL`, then `REPLIT_DOMAINS`. On Vercel set this to the site origin (for example `https://birchreserve.net`) so checkout return URLs are not a Replit host. |
| `REPLIT_DOMAINS` | Last-resort public origin. Leave unset on Vercel. |
| `STRIPE_CHECKOUT_DISABLED` | Checkout stays enabled when the secret key is present. Set to `true` to refuse new sessions. |
| `STRIPE_PRICE_HOLD_190` | Checkout uses inline `price_data` for the $190 hold. |
| `STRIPE_PRICE_RESERVE_490` | Checkout uses inline `price_data` for the $490 reserve. |
| `STRIPE_PRICE_RESERVE_899` | No catalog price id for that SKU. |
| `SPLASH_RESERVE_SLACK_CHANNEL_ID` | Alerts use channel `C0AUSTA1V9D`. |
| `SLACK_BOT_TOKEN` | Off Replit, splash reserve Slack alerts are recorded as failed and the process keeps running. On Replit this variable is ignored and the Replit Slack connector is used, same as before. |
| `SPLASH_RESERVE_ALERT_TIMEOUT_MS` | Alert wait uses the built-in timeout. |
| `SPLASH_RESERVE_ALERTS_DISABLED` | Alerts run. Set to `true` to skip them. |
| `SPLASH_PIPELINE_SYNC_DISABLED` | Sheet sync runs when a spreadsheet id is set. Set to `true` to skip it. |
| `SPLASH_PIPELINE_SPREADSHEET_ID` | Sheet sync is skipped. |
| `LOG_LEVEL` | Logs at `info`. |
| `UCP_PROXY_MISMATCH_WINDOW_MS` | UCP proxy-mismatch alert uses its built-in window. |
| `UCP_PROXY_MISMATCH_ALERT_THRESHOLD` | Built-in threshold. |
| `UCP_PROXY_MISMATCH_ALERT_COOLDOWN_MS` | Built-in cooldown. |
| `TURNSTILE_SITE_KEY` | Human gate is skipped until both Turnstile keys are set. |
| `TURNSTILE_SECRET_KEY` | Same. Both must be set or the gate stays off. |
| `FRIDAY_API_URL` | Friday lead push is skipped until URL and key are both set. |
| `FRIDAY_API_KEY` | Same. |
| `FRIDAY_WORKSPACE` | Defaults to `birchreserve`. |
| `FRIDAY_STAGE` | Defaults to `Birch inbound`. |
| `FRIDAY_PUSH_DISABLED` | Push stays on when URL and key exist. Set to `true` to stop it. |

## Build settings (not server `process.env`)

`vercel.json` does not set `outputDirectory`. `node scripts/vercel-build.mjs` writes the [Build Output API](https://vercel.com/docs/build-output-api/v3) tree `.vercel/output`:

| Setting | Value |
| --- | --- |
| Install | `pnpm install --no-frozen-lockfile` |
| Build | `node scripts/vercel-build.mjs` |
| Framework | none |
| Static files | `.vercel/output/static` (Vite `artifacts/clinichub-media/dist/public`) |
| Function | `.vercel/output/functions/api.func` (Express `app`, Node 22, 60s, body parser off) |
| Routes | filesystem, then `/api`, `/v1`, `/ucp`, `/.well-known/ucp`, `/llms.txt`, `/openapi.yaml`, `/buycalc`, `/oatmeal`, `/advertise`, `/availability.json`, `/kit`, `/terms`, `/privacy`, `/sample-io`, `/insights`, `/ops`, then `index.html` |

The Vite build inside that script needs `PORT` and `BASE_PATH`. The script sets `PORT=3000` and `BASE_PATH=/` when they are missing. These are build-time only.

The browser bundle also reads these at **build** time. They are not server `process.env` keys:

| Name | If unset |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk derives a key from the hostname. A `*.vercel.app` preview usually needs the real publishable key or the signed-out home does not render. |
| `VITE_CLERK_PROXY_URL` | Clerk uses its default frontend API host. |
| `VITE_RANDY_TEL` | The phone button stays `tel:+16479316278`. |
| `VITE_ELEVENLABS_AGENT_ID` | The voice widget uses the built-in agent id. |
| `VITE_PLAUSIBLE_DOMAIN` | Plausible is not injected. |
| `VITE_PLAUSIBLE_SRC` | Default Plausible script URL, only if a domain is set. |
| `VITE_GA4_ID` | GA4 is not injected. |
| `VITE_BROWSER_TEST_AUTH` | Must stay unset on Vercel. `true` skips Clerk and renders the public home for browser tests. |
| `VITE_EDITORIAL_WATCHDOG_INTERVAL_MS` | Editorial watchdog uses 30s. |

## Splash expiry

`src/index.ts` still owns the one-minute splash-reservation expiry interval for the long-running process. The Vercel function does not start that interval. Production cron `*/10 * * * *` in `vercel.json` calls `GET /api/cron/splash-expiry`, which runs `cleanupSplashReservations()` once. The Build Output `config.json` does not repeat that cron: Vercel rejects a deploy that lists the same path and schedule twice. Set `CRON_SECRET` or every invocation is rejected.

On a cold start the function still tries the public-insights seed and the additive splash column, and it logs if the database refuses.
