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
