# Attention metrics (home page)

Web equivalents of CTR / AVD / AVP. First-party, aggregate, no personal data, no typed brand names or file names.
Stored in `site_cta_events` (event, path, created_at) through `/v1/ui-events`; mirrored to Plausible/GA4 as event `attention` (prop `name`) when configured.
Event list lives in `artifacts/api-server/src/lib/attentionEvents.ts`. Client: `artifacts/clinichub-media/src/lib/attention.ts`.

| Lesson metric | Events | Read it as |
|---|---|---|
| CTR | `attn.hero_cta.buy|kit|look` ÷ `attn.view` | hero click-through |
| AVP | `attn.scroll_25|50|75|100` ÷ `attn.view` | how far people get (once per page load) |
| AVD proxy | `attn.first_touch`, `attn.tfi_lt3s|3_10s|10_30s|gt30s` | time to first interaction |
| Re-engagement | `attn.beat.audience|hubs|ladder|street|details|end` | where people drop between beats |
| Wow | `attn.preview.type|logo|hub` ÷ `attn.view` | share who try "see your ad on a live hub" |
| Stakes | `attn.ladder.look|reserve|sponsor|premium` | which step people click |

Existing events kept: `cta_*`, `intake.*`, `checkout_click`.

```sql
select event, count(*) from site_cta_events
where path = '/' and event like 'attn.%' and created_at > now() - interval '7 days'
group by 1 order by 1;
-- hero CTR
select 100.0 * count(*) filter (where event like 'attn.hero_cta.%') / nullif(count(*) filter (where event = 'attn.view'), 0) as hero_ctr_pct
from site_cta_events where path = '/' and created_at > now() - interval '7 days';
```

## Site analytics (Nov 23 2026): every page, both skins

Same pipe (`/v1/ui-events` → `site_cta_events`), new `a.*` events from `clinichub-media/src/lib/siteAnalytics.ts`:
`a.pv`, `a.scroll_25|50|75|100`, `a.click.<name>` (get_my_kit, buy_ads_now, look_7day, reserve, inquire_premium, chat_open,
call_voice, call_phone, hub_chip, media_kit, pdf_download, other; `label` = data-testid, `area` = header/sticky/hero/body/footer/chat/widget),
`a.form_start|form_submit` (page forms; the chat is excluded). Server adds skin (birch | scale), coarse device/browser/os,
a daily-rotating visitor hash (no IP / UA stored) and is_test (bots, BirchQA UA, X-Birch-QA, `?ref=qa`). Do Not Track / GPC: nothing stored.

Live dashboard: `/ads/admin/analytics` (admin sign-in), polling every 5 s. "Make Friday link" mints a read-only
`/analytics/live?k=…` link (frameable by fridayapp.org only; revoke all by changing `ANALYTICS_LINK_VERSION`).
Funnel: visited → buy page (/intake, /exclusive, /buy…) → form start → form submit → Stripe Checkout Session opened → paid
(the last two read from Stripe, QA emails excluded). The `/br-t.js` beacon (`/api/track`) is now forwarded to Friday's traffic
endpoint instead of being dropped (`TRACK_FORWARD_DISABLED=true` turns that off).

```sql
select event, label, skin, device, count(*), count(distinct vh) from site_cta_events
where event like 'a.%' and not coalesce(is_test,false) and created_at > now() - interval '7 days'
group by 1,2,3,4 order by 5 desc;
```
