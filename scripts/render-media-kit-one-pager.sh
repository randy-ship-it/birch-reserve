#!/usr/bin/env bash
# Render scripts/media-kit-one-pager.html to Birch and Scale one-pagers in public/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/scripts/media-kit-one-pager.html"
MARK="$ROOT/attached_assets/brand/birch-reserve-mark-v2.svg"
SCALE_LOGO="$ROOT/attached_assets/brand/scalehealth-logo-srgb-v2.png"
PUB="$ROOT/artifacts/clinichub-media/public"
render() {
  local skin="$1" out="$2" cur="${3:-usd}"
  local TMP; TMP="$(mktemp -d)"
  local html="$TMP/one-pager.html"
  cp "$SRC" "$html"
  if [ "$skin" = "scale" ]; then
    cp "$SCALE_LOGO" "$TMP/logo.png"
    python3 - "$html" << 'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
repl = {
  "{{BRAND}}": "Scale Health",
  "{{SITE}}": "scalehealth.ca",
  "{{LOGO}}": "logo.png",
  "{{OPERATOR}}": "Scale Health is operated by Silver Birch Growth Inc., Toronto, Ontario.",
  "{{FOOTER_LINKS}}": "scalehealth.ca/intake/_m/media-kit · /terms · /sample-io",
  "{{TERMS}}": "scalehealth.ca/intake/_m/terms",
  "{{FINE_SITE}}": "scalehealth.ca",
}
for k,v in repl.items():
    s = s.replace(k, v)
p.write_text(s)
PY
  else
    cp "$MARK" "$TMP/mark.svg"
    python3 - "$html" << 'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
repl = {
  "{{BRAND}}": "Birch Reserve",
  "{{SITE}}": "birchreserve.net",
  "{{LOGO}}": "mark.svg",
  "{{OPERATOR}}": "Birch Reserve is operated by Silver Birch Growth Inc., Toronto, Ontario.",
  "{{FOOTER_LINKS}}": "birchreserve.net/media-kit · birchreserve.net/terms · birchreserve.net/sample-io",
  "{{TERMS}}": "birchreserve.net/terms",
  "{{FINE_SITE}}": "birchreserve.net",
}
for k,v in repl.items():
    s = s.replace(k, v)
p.write_text(s)
PY
  fi
  if [ "$cur" = "cad" ]; then
    # CAD copy (BR-81): same numbers the site shows Canadian visitors. Blocks stay in USD (site rule, #460).
    python3 - "$html" << 'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text()
for a, b in [("$190 USD", "$270 CAD"), ("$490 USD", "$690 CAD"), ("$1,900 USD", "$1,900 CAD"), ("$190", "$270"), ("$490", "$690")]:
    s = s.replace(a, b)
p.write_text(s)
PY
  fi
  google-chrome --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$out" --no-sandbox --disable-dev-shm-usage \
    --virtual-time-budget=20000 "file://$html"
  rm -rf "$TMP"
  echo "$skin $(pdfinfo "$out" | awk '/Pages/{print}')"
}
render birch "$PUB/birch-reserve-one-pager.pdf"
render scale "$PUB/scale-health-one-pager.pdf"
render birch "$PUB/birch-reserve-one-pager-cad.pdf" cad
render scale "$PUB/scale-health-one-pager-cad.pdf" cad
