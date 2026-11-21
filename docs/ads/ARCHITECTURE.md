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
| Creative specs (formats, upload checks, templates) | `src/lib/adserver/creativeSpec.ts`; browser side `creativeUploadJs.ts`; pages `specsPage.ts` (`/ads/specs`, `/ads/hub-kit`). See [CREATIVE-SPECS.md](CREATIVE-SPECS.md) |
| Hub drop-in kit | [HUB-DROP-IN.md](HUB-DROP-IN.md), public handoff `/ads/hub-kit` |
| Tests | `artifacts/api-server/tests/adserver.test.ts`, `creativeSpec.test.ts`, `promo.test.ts` (PGlite) |

## Flows
1. **Inventory**: admin onboards a hub on contract (`POST /ads/admin/hubs`, contract ref required) → `ad_hubs` → slots `<hub>.landing … <hub>.post_purchase` become sellable at card rates. Going live triggers new-hub alerts (once per subscriber).
2. **Sell**: `/buy` ($190 look / $490 reserve / exclusive) → Stripe Checkout → `POST /api/stripe/webhook` (`checkout.session.completed`, paid) → `draftCampaignFromCheckoutSafe` → `ad_campaigns` + credit line in `ad_ledger` (idempotent on `order_ref`). Promo codes (STREET100) create a $0 promo-credit campaign. Admin can draft manual campaigns (pick seller).
3. **Creative**: buyer uploads (`/buy` or `/account/creative`) → `creativeSpec.checkUpload` (type sniffed from bytes, weight, size, ratio → `format`, video length/codec/fast start, colour, alt/headline/CTA) → `ad_creatives` pending. The uploader's browser then sends WebP/AVIF sizes or a video poster (`/account/creative/:id/variant`, checked by `checkVariant`) → `ad_creative_variants`. Admin approves/rejects (a reason is required; a video needs a poster) → activate the campaign.
4. **Serve / track**: hub page loads `/ads/embed.js` (v2: `<picture>` with WebP/AVIF `srcset`, or muted looping video with poster; `data-br-format` limits formats via `fmt=`; `?br_ads=test` on the page = test mode), which calls `/v1/ads/serve` (prefers a creative whose format fits the placement), `/v1/ads/v` (viewable 50%/1s) and `/v1/ads/c` (click → landing with `br_click`). Conversions go through `/v1/ads/px` (pixel) or `/v1/ads/postback`. Events are stored in `ad_events`; charges are hourly bucket lines in `ad_ledger` with `partner` per slot. DNT/GPC are honoured, and no cookies are set.
5. **Royalties / payouts**: charged (collected) revenue → Birch override off the top (rate depends on the sales channel, below) → hub 35% of net (dated rates `ad_rate_history`, optional per-hub tiers) → override pool split to `ad_override_recipients` → Birch/SBG keeps the rest. Promo delivery earns nothing. Lines are **held** until the hub gate passes (`ad_hub_gates`: live + transactions + audience, or override with a note). Approve freezes into `ad_payouts`; "Pay" builds a batch + Stripe-ready CSV (no Connect accounts yet) and then you mark it paid with a reference. No money moves automatically.
6. **Friday**: `/api/cron/ads-friday` syncs campaigns to Friday.

## Royalty math: override by sales channel (Randy, Nov 21 2026 2:45 PM)
Each charge is stamped with its **channel** (`ad_ledger.channel`) when it's charged, using the campaign at that moment:

| Channel | When | Birch override (default) | Where it's set |
|---|---|---|---|
| Birch brokerage | `seller = birch`, not internal | 20% of gross | Payout split → default Birch override (per-hub override allowed), `ad_rate_history` |
| Scale direct | `seller = scale` (sold organically off the Scale Health site) | 5% of gross | Payout split → "Birch override by sales channel", `ad_channel_rates` |
| Internal (cost accounting) | campaign `internal = true` (wins over seller) | 5% of gross | same form, `ad_channel_rates` |

Every rate is dated (`effective_at`, next full hour or a date you pick) and never retroactive. Editing a campaign's seller or internal flag only changes charges made from then on, because past lines keep the channel they were stamped with. Ledger lines from before this change have no stamp and count as brokerage, which is what they were. Each royalty line shows the override that applied, e.g. "override 20% Birch brokerage" or "override 20% Birch brokerage · 5% Scale direct" for a mixed month, and the royalties CSV has an `override` column. After the override, the hub gets its % of **net** (default 35%, or its own rate/tiers). Override recipients split whatever pool the channel produced, and Birch/SBG keeps the rest.

**Worked example, Birch brokerage ($1,000 collected, defaults 20% / 35%):**
- Birch override: 20% × $1,000 = **$200**. With a 50% brokerage recipient, that's $100 to them and $100 unallocated, which stays with Birch.
- Net: $1,000 − $200 = **$800**.
- Hub royalty: 35% × $800 = **$280** (28% of gross).
- Retained by Birch/SBG (net after hub): $800 − $280 = **$520**.

**Worked example, Scale direct or internal ($1,000 collected, 5% / 35%):**
- Birch fee: 5% × $1,000 = **$50**. A 50% recipient gets $25.
- Net: $1,000 − $50 = **$950**.
- Hub royalty: 35% × $950 = **$332.50** (33.25% of gross).
- Retained by Birch/SBG: $950 − $332.50 = **$617.50**.

**Dated change:** if Scale direct moves to 8% effective Dec 1, November delivery stays at 5% ($50 per $1,000) and December delivery pays 8% ($80 override, $920 net, $322 hub, $598 retained). Brokerage is unaffected.

**Setting to revisit (Randy, Nov 21 2026 2:57 PM):** override recipients stay on the proportional default. They share whatever pool the channel produces, so on a $1,000 Scale direct or internal sale a 50% recipient gets $25, versus $100 on brokerage. If they should earn on brokerage only, scope them per campaign or add a channel filter to `ad_override_recipients`.

## Referral attribution: QR codes, street team, partner links (Randy, Nov 21 2026 4:07 PM)
"Monica's and other QR codes need to track clicks through BR's site / checkout and Scale's all the same for when people buy ads so that we can pay them out commission rates."

**Who counts as a referrer.** An active row in `ad_street_members` (admin → Street team → "Mint a member link + QR"). Seeded: `bridget` (Bridget) and `mona` (Mona, i.e. Monica). Each member's links / QR codes live in `ad_street_qrs`, e.g. `https://scalehealth.ca/intake?code=STREET100&st=mona&qr=scale-intake-digital`.

**The rule.**
- **Params.** `?st=<member>` is the referrer (always taken). `?ref=` / `?via=` count only once `/v1/promo/scan` confirms an active member, because our own links also use `?ref=` (`home_tile`, `share_*`, placement keys) and must never wipe a real referrer. `?qr=<label>` names the QR or link (`qr=1` = "qr"). `?code=` is a promo code (STREET100), carried separately.
- **Window: 30 days from the referring click, last click wins.** A new member link replaces the old one and restarts the 30 days; a code alone does not change the referrer.
- **Storage.** First-party only: `localStorage.br_promo_v1` plus cookies `br_st`, `br_qr`, `br_pc` and `br_at` (`SameSite=Lax; Secure`), scoped `Domain=.birchreserve.net` or `Domain=.scalehealth.ca` so apex and www share it. Nothing else is stored, and nothing is shared across the two sites.
- **Carry.** The site script (`promoBoxJs.ts`, loaded by the React app and every server-rendered buy page) adds `x-br-attr: st=…&qr=…&code=…` to same-origin POSTs under `/v1/` and `/launch/`. On the Scale mirror the boot script (`middlewares/mirrorHost.ts`) then routes the call through `/intake/_m/…`. The header wins over cookies, since cookies don't survive every proxy hop. `promoContext()` turns it into Checkout Session metadata `st`, `st_qr`, `promo` and `site` (`scale` when the request came from scalehealth.ca). Every session builder adds this: `/v1/checkout` (buy, buycalc), sponsor packs, the exclusive reserve, splash, and the area lock.
- **Record.** On a paid session, the Stripe webhook runs `draftCampaignFromCheckoutSafe` → `afterOrderCampaign`, which resolves the member (unknown → ignored). The order (`ad_campaigns.referrer`, `referrer_qr`, `referrer_site`) is stamped once, the street-team `order` event is counted, and one `ad_referral_orders` row is written per session, idempotent on `session_id`. Test identities (qa+ emails, test sessions) are flagged and kept out of real totals.
- **Commission** (`payoutSplit.splitReferralOrders`) uses existing rates only:
  - **Pool** = amount collected × the Birch override for the order's channel at payment time: brokerage uses the default Birch override (20% now); Scale direct and internal use their dated channel rate (5% now).
  - A referrer earns its share once you add a payout recipient with **Referrer = that member** (Payout split → recipients); otherwise $0 and the order is still listed.
  - Example: a $490 brokerage order referred by Bridget, with a 25% share, gives a $98 pool and $24.50 to Bridget.
  - Shares are dated and never retroactive. Referrer-scoped recipients are paid on the sale only, never again on hub delivery.
  - Their lines (`ref:<recipient>`) join the royalty statements without the hub gate, so Approve, Pay batch and Mark paid work as usual.
- **Where Randy sees it:** `/ads/admin` → Money → **Referral orders**: per referrer (paid orders, collected, pool, share, commission) and per order (brand, session, member, QR, Birch / Scale mirror, channel, override, commission). There's also `/ads/admin/export/referrals.csv`. Campaign rows show "Referred by …".

**Which channel applies to a sale through the Scale mirror** (Randy, Nov 21 2026 4:30 PM, going forward only):
- A checkout started on `scalehealth.ca/intake/_m/…` (request site `scale`) is **Scale Health direct (5% override)**, referred or not. `promoMetadata()` stamps `sold_by=scale` (and `site=scale`) on the Checkout Session when it is created, and `draftCampaignFromCheckoutSafe` opens the campaign with `seller = scale` when it sees `sold_by=scale`.
- Checkouts on birchreserve.net stay **Birch brokerage (20%)**.
- Never backdated: campaigns that already exist keep their seller, and a session opened before this shipped (no `sold_by`) still opens as Birch even if it is paid later.
- Admin can still override per campaign ("Sold by"). Delivery charges are stamped with the channel at charge time. A referral line follows the campaign's current flag until it is approved, and approval freezes it.

**QA.** `tests/referralAttribution.test.ts` covers the server context, metadata, webhook stamp, commission math and statements, plus the browser script in a VM (Scale cookie scope, mirror routing, `?ref=home_tile` not wiping a referrer). The live e2e on both hosts is `artifacts/clinichub-media/tests/browser/referral-attribution.spec.ts` (opt-in `REFERRAL_E2E_LIVE=1`). It uses a qa+ email and never pays. `POST /v1/promo/attribution` echoes `st` / `st_qr` / `promo` / `site` / `sold_by` only for an open, unpaid, under-an-hour-old session with a qa+ email. The e2e browser sends the user-agent token `BirchQA/1` (and `X-Birch-QA` when `BIRCH_QA_SECRET` is set), so every visit and scan it causes is stored `is_test` and never counts in street-team stats. The Nov 21 4:25–4:28 PM ET e2e rows were flagged by a one-shot migration in `store.ts` (audit `street.qa_flag`, which lists the ids).

## Where ads run (Randy, Nov 21 2026 3:42 PM t396u + 3:43 PM t397u)
- **Allowed:** Birch / Scale marketing and intake pages that sell ads, listed explicitly in `config.ts` `MARKETING_SLOTS`:
  `mkt-birch.media_kit` (birchreserve.net/media-kit), `mkt-birch.buy_ads` (/buy-ads), `mkt-birch.specs` (/ads/specs),
  `mkt-scale.intake` (scalehealth.ca/intake). A marketing slot serves **only** a campaign that names it in `hubs`
  (`mkt-birch` / `mkt-scale`), never by auto-move. No royalty (no hub partner). **None is embedded on a page yet.** Embedding
  one is its own approved change.
- **Hubs: OFF by default.** Hub slots (`<hub>.<placement>`) stay in the system, but `serve()` refuses them
  (`hub_not_enabled`) unless that hub is enabled in `ad_hub_serving`. Only Randy or Jon (by signed-in admin email) can turn a
  hub on, with a note. Every change is a new row plus an audit line (`hub.serving_on|off`, "approved by …"). This also stops
  auto-move: a campaign can't substitute onto a hub that's off. QA test hubs (`is_test`) carry test campaigns only.
- The SOLE embed on scalehealth.ca/sole was removed (scalehealthnew #1272). Calm Joints (899bcb46) is paused, with its creative still approved.
- Explainer only: /buy step 3 shows a labelled screenshot of an example ad on a hub page ("Example, not a live placement").

## QA guard
Box QA browsers send `x-br-qa: 1` on every request. The server refuses to approve a non-test creative (403, audited `creative.qa_approve_blocked`) when that header is present, and the box `post()` helper refuses approve calls locally too. Real ads are approved by hand in the admin.

## Tables (all additive)
`ad_campaigns` (incl. `seller`, `internal`, `order_kind`, `is_test`), `ad_creatives` (incl. `kind`, `format`, `duration_ms`, `headline`, `cta`, `warnings`), `ad_creative_variants`, `ad_events`, `ad_ledger` (incl. `channel`), `ad_channel_rates`, `ad_hubs`, `ad_partners` (legacy shares), `ad_rate_history`, `ad_override_recipients`, `ad_hub_gates`, `ad_hub_serving`, `ad_settings` (payout timing), `ad_payouts`, `ad_alert_prefs`, `ad_hub_alerts_sent`, `ad_audit`, `ad_promo_codes`, `ad_promo_redemptions`, `ad_street_members`, `ad_street_qrs`, `ad_street_events`, `ad_referral_orders` (plus `ad_campaigns.referrer` / `referrer_qr` / `referrer_site` and `ad_override_recipients.scope_referrer`).

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

## Creative bytes
`/v1/ads/cr/:id` (original) and `/v1/ads/crv/:id` (variant/poster) serve from Postgres `bytea` with HTTP Range (206) for
Safari/iOS video. Approved: public, CORS, cached a day. Pending/rejected: owner or admin only. Uploads go through the
Vercel function, so files stay under its 4.5 MB body limit (images 2 MB, video 4 MB).

## Known gaps (Nov 21 2026)
- Responsive variants and video posters are made in the uploader's browser (canvas). Server-side transcoding (sharp /
  ffmpeg) isn't bundled into the function; a /buy upload that's attached later has no variants until re-uploaded.
- Reporting: `seller` is stored and shown on campaigns and in the campaigns CSV, but statements and summaries don't split by seller yet.
- Scale-direct campaigns are created by an admin only (no Scale-branded checkout); they share the Birch admin UI and allowlist.
- Code and project names still say "birch" (repo, Vercel project, `/ads/admin` on birchreserve.net). Moving the core under a Scale domain would be a hosting change, not a data change.
- No Stripe test keys on Preview yet. Once `STRIPE_SECRET_KEY` (sk_test) is there, `scripts/stripe-test-setup.mjs` creates the test prices + webhook and sets `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` on Preview (dry run unless `--apply`; refuses live keys).
- Stripe Connect isn't set up, so payouts are a batch + CSV.
