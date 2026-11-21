# Scale Health ad system (sold by Birch Reserve and by Scale Health direct)

One ad rig. Birch Reserve (birchreserve.net) is a **seller/channel** on it; Scale Health runs its own proprietary ads on the same rig.
Every campaign carries `seller` = `birch` | `scale` (default `birch`). Inventory, ledger, statements and payouts are shared; reporting can split by seller.
Positioning: Randy voice, Nov 21 2026 1:41 PM.

## Where things live
| What | Where |
|---|---|
| Server (Express, Vercel function) | `artifacts/api-server` → project `birch-reserve` (prj_pZirY7s6xQzJBEAcomPWrw5sqQTg) |
| Ad engine (pure: rate card, eligibility, pacing, pick) | `src/lib/adserver/engine.ts`, `config.ts` |
| Storage (Postgres, additive DDL on boot) | `src/lib/adserver/store.ts` (production: `public` schema; previews: `ads_preview`) |
| Payout split (pure) | `src/lib/adserver/payoutSplit.ts` |
| Serve / track / checkout → campaign | `src/lib/adserver/service.ts`, `embed.ts` (embed.js, px.js) |
| HTTP routes | `src/routes/adserver.ts` (+ `/buy` in `routes/buy.ts`, promo in `routes/promo.ts`) |
| Admin UI `/ads/admin` | `src/lib/adserver/adminPage.ts` (anchors `#onboard`, `#campaigns`, `#creatives`, `#payout-settings`, `#royalties`, `#ledger`) |
| Buyer dashboard `/account` | `src/lib/adserver/accountPage.ts` |
| Emails | `src/lib/adserver/mail.ts`; every site email uses `src/lib/emailLayout.ts` (/intake design tokens, inline logo `cid:br-mark`) |
| Hub slot on scalehealth.ca | scalehealthnew `src/components/BirchAdSlot.tsx` (flag `VITE_BIRCH_ADS`), mounted on `/sole` |
| Tests | `artifacts/api-server/tests/adserver.test.ts`, `promo.test.ts` (PGlite) |

## Flows
1. **Inventory**: admin onboards a hub on contract (`POST /ads/admin/hubs`, contract ref required) → `ad_hubs` → slots `<hub>.landing … <hub>.post_purchase` become sellable at card rates. Going live triggers new-hub alerts (once per subscriber).
2. **Sell**: `/buy` ($190 look / $490 reserve / exclusive) → Stripe Checkout → `POST /api/stripe/webhook` (`checkout.session.completed`, paid) → `draftCampaignFromCheckoutSafe` → `ad_campaigns` + credit line in `ad_ledger` (idempotent on `order_ref`). Promo codes (STREET100) create a $0 promo-credit campaign. Admin can draft manual campaigns (pick seller).
3. **Creative**: buyer uploads (`/buy` or `/account/creative`) → `ad_creatives` pending → admin approves/rejects (a reason is required) → activate the campaign.
4. **Serve / track**: hub page loads `/ads/embed.js`, which calls `/v1/ads/serve`, `/v1/ads/v` (viewable 50%/1s) and `/v1/ads/c` (click → landing with `br_click`). Conversions go through `/v1/ads/px` (pixel) or `/v1/ads/postback`. Events are stored in `ad_events`; charges are hourly bucket lines in `ad_ledger` with `partner` per slot. DNT/GPC are honoured, and no cookies are set.
5. **Royalties / payouts**: charged (collected) revenue → 20% override off the top → hub 35% of net (dated rates `ad_rate_history`, optional per-hub tiers) → override pool split to `ad_override_recipients` → Birch/SBG keeps the rest. Promo delivery earns nothing. Lines are **held** until the hub gate passes (`ad_hub_gates`: live + transactions + audience, or override with a note). Approve freezes into `ad_payouts`; "Pay" builds a batch + Stripe-ready CSV (no Connect accounts yet) and then you mark it paid with a reference. No money moves automatically.
6. **Friday**: `/api/cron/ads-friday` syncs campaigns to Friday.

## Tables (all additive)
`ad_campaigns` (incl. `seller`, `order_kind`, `is_test`), `ad_creatives`, `ad_events`, `ad_ledger`, `ad_hubs`, `ad_partners` (legacy shares), `ad_rate_history`, `ad_override_recipients`, `ad_hub_gates`, `ad_settings` (payout timing), `ad_payouts`, `ad_alert_prefs`, `ad_hub_alerts_sent`, `ad_audit`, `ad_promo_codes`, `ad_promo_redemptions`, `ad_street_members`, `ad_street_qrs`, `ad_street_events`.

## Env vars (birch-reserve project; names only)
| Var | Purpose |
|---|---|
| `ADS_ADMIN_KEY` | admin sign-in key (allowlist in `config.ts` `DEFAULT_ADMIN_EMAILS`, override `ADS_ADMIN_EMAILS`) |
| `ADS_SERVING_ENABLED` | kill switch for serving |
| `ADS_STORE` | storage backend selector |
| `ADS_LOGIN_EMAIL_ENABLED`, `ADS_HUB_ALERT_EMAIL_ENABLED` | system emails (on since Nov 21 2026) |
| `ADS_EMAIL_FROM` | sender override (default: the existing verified sender) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CHECKOUT_DISABLED` | checkout + webhook (production = live keys) |
| `RESEND_API_KEY`, `BIRCH_REPLY_TO` | email |
| `CRON_SECRET` | cron auth |
| scalehealthnew: `VITE_BIRCH_ADS` | `on` shows the hub slot |

## Known gaps (Nov 21 2026)
- Reporting: `seller` is stored and shown on campaigns and in the campaigns CSV, but statements and summaries don't split by seller yet.
- Scale-direct campaigns are created by an admin only (no Scale-branded checkout); they share the Birch admin UI and allowlist.
- Code and project names still say "birch" (repo, Vercel project, `/ads/admin` on birchreserve.net). Moving the core under a Scale domain would be a hosting change, not a data change.
- No Stripe test keys exist on previews, so a sandbox checkout needs `STRIPE_SECRET_KEY` (sk_test) + `STRIPE_WEBHOOK_SECRET` (test endpoint) on Preview.
- Stripe Connect isn't set up, so payouts are a batch + CSV.
