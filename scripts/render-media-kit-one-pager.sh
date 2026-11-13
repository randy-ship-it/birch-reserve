#!/usr/bin/env bash
# Render scripts/media-kit-one-pager.html to artifacts/clinichub-media/public/birch-reserve-one-pager.pdf
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cp "$ROOT/scripts/media-kit-one-pager.html" "$TMP/one-pager.html"
cp "$ROOT/attached_assets/brand/birch-reserve-mark-v2.svg" "$TMP/mark.svg"
OUT="$ROOT/artifacts/clinichub-media/public/birch-reserve-one-pager.pdf"
google-chrome --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$OUT" --no-sandbox --disable-dev-shm-usage \
  --virtual-time-budget=20000 "file://$TMP/one-pager.html"
rm -rf "$TMP"
pdfinfo "$OUT" | grep Pages
