# Creative specs (ad machine)

Public page: **https://birchreserve.net/ads/specs** (mirror: https://www.scalehealth.ca/ads/specs).
Source of truth: `artifacts/api-server/src/lib/adserver/creativeSpec.ts`. The page, the upload checks, the templates, the
embed's format choice and this file all read from it. Change the code first, then this table.

Basis: IAB New Ad Portfolio and LEAN (light files; viewable = 50% on screen for 1 s display, 2 s video), plus Google
Display and Meta creative guidance (export at 2×, short muted video with burned-in captions, sRGB), fitted to the slots
the embed renders today. No performance claims.

## Formats

| Format id | Kind | Shows at (CSS px) | Ratio | Export (2×) | Smallest | Safe zone (export px) | Aim for | Placements |
|---|---|---|---|---|---|---|---|---|
| `hero_wide` | still | 1200×300 | 4:1 | 2400×600 | 1200×300 | 48 | ≤150 KB | landing |
| `hero_phone` | still | 640×320 | 2:1 | 1280×640 | 640×320 | 40 | ≤150 KB | landing, dashboard |
| `leaderboard` | still | 728×90 | 728:90 | 1456×180 | 728×90 | 16 | ≤150 KB | landing (partner pages) |
| `splash` | still | 656×280 | 82:35 | 1312×560 | 656×280 | 40 | ≤300 KB | post_purchase |
| `vertical` | still | 360×640 | 9:16 | 1080×1920 | 360×640 | 72 | ≤500 KB | post_purchase, dashboard |
| `card` | still | 600×400 | 3:2 | 1200×800 | 600×400 | 40 | ≤300 KB | dashboard, products, services |
| `mrec` | still | 300×250 | 6:5 | 600×500 | 300×250 | 20 | ≤150 KB | products, services |
| `video_vertical` | video | 360×640 | 9:16 | 1080×1920 | 720×1280 | 72 | ≤3 MB, 6–10 s | post_purchase, dashboard |
| `video_landscape` | video | 640×360 | 16:9 | 1920×1080 | 1280×720 | 72 | ≤3 MB, 6–10 s | landing, products, services |

1:1 and 4:5 are not listed because no slot renders them today. Add a row to `FORMATS` when one does.

A file must match a format's ratio within 2% and be at least "Smallest". Under 2× is accepted with a tip. Admins can
tick "Allow a size outside the specs" (`force=true`); type, weight and safety checks still run.

## File rules

| | Still | Video |
|---|---|---|
| Types (sniffed from bytes) | JPG, PNG, WebP, AVIF; GIF accepted | MP4 (H.264 `avc1`/`avc3`, AAC optional), WebM (VP9/VP8/AV1) |
| Refused | SVG (script risk), HEIC, CMYK JPEG | MOV, HEVC/H.265, MP4 without fast start (moov after mdat) |
| Hard max | 2 MB, 4000 px a side | 4 MB (Vercel request bodies stop at 4.5 MB), 4000 px a side |
| Length | – | 3–15 s (6–10 s best), loops |
| Bitrate | – | ~2 Mbps at 1080p, ~1.2 Mbps at 720p, 24–30 fps, yuv420p |
| Sound | – | Plays muted; burn captions in |
| Poster | – | Required before approval. The uploader's browser grabs a frame at 0.5 s; admins can upload one |
| Colour | sRGB 8-bit; wide-gamut ICC (P3, Adobe RGB, ProPhoto, Rec.2020) gets a warning | same |
| Retina | export at 2× the shown size | 1080p export for 360/640-wide display |

## Copy fields

| Field | Rule |
|---|---|
| Alt text | Required, 5–125 characters. Describes what the ad shows and offers |
| Headline | Optional, ≤ 40 characters. Rendered under the creative by the embed |
| Button | Optional, one of: Shop now, Learn more, Book now, Get offer, See how, Try it |
| Text in the image | Brand, one line, one offer. Min 14 px at shown size (28 px in a 2× export) |

## Landing URL and UTMs

- `https://` only (admin check), on the brand's own domain, no shorteners or redirect chains, no personal data.
- The click redirect adds `utm_source=birchreserve`, `utm_medium=display`, `utm_campaign=br-<id8>`, `utm_content=<slot>`
  and `br_click`. UTMs the brand already set are kept (`engine.ts landingUrl`).

## How it is enforced

| Where | What |
|---|---|
| Browser (`creativeUploadJs.ts`) | Same rules before upload, friendly inline error (`.cu-msg`, `role="alert"`). After upload: WebP + AVIF (if the browser can encode it) at 1× and 2× widths, or a poster for video, sent as variants |
| Server (`creativeSpec.checkUpload`) | Type sniffing (PNG/JPEG/GIF/WebP/AVIF/MP4/WebM), weight, pixel size, ratio→format, video duration (mvhd / EBML Duration), codec, fast start, CMYK, ICC, copy fields |
| Variants (`checkVariant`) | Right type for the role, same ratio (±2%), never larger than the original. Buyers can add them only while the creative is pending; admins any time; max 8 |
| Approval | A video can't be approved without a poster |
| Serving (`service.serve`) | Prefers an approved creative whose format fits the slot's placement; legacy creatives (no format) fit anywhere. A slot with `data-br-format` only takes those formats |
| Bytes (`/v1/ads/cr/:id`, `/v1/ads/crv/:id`) | HTTP Range (206) so Safari/iOS play video; pending files are visible only to the owner and admins |

Errors are written for the uploader: what's wrong and what to export instead (e.g. "That MP4 isn't set up to stream…
run `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4`").

## Data

`ad_creatives` gained `kind`, `format`, `duration_ms`, `headline`, `cta`, `warnings` (additive). New table
`ad_creative_variants (id, creative_id, role webp|avif|poster, mime, width, height, bytes, data, created_by, created_at)`.
Creatives and variants are stored as `bytea` in Postgres (same as before).

## Templates

`/ads/specs/templates/<format>.svg` is generated live from `templateSvg()`. The PNGs at
`artifacts/clinichub-media/public/ads-specs/templates/<format>.png` are committed; regenerate with
`bash scripts/gen-creative-templates.sh` (Python Playwright + Chromium). `tests/creativeSpec.test.ts` fails if a PNG's
size drifts from the table.

## Tests

`pnpm --filter @workspace/api-server run test:creative-spec` (fixtures in `artifacts/api-server/tests/fixtures/creative`,
made with ffmpeg/Pillow: valid MP4/WebM, 2 s, 20 s, HEVC, no-faststart, square, CMYK JPEG, AVIF, WebP).
