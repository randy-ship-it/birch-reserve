#!/usr/bin/env bash
# Regenerates the PNG safe-zone templates served at /ads-specs/templates/<format>.png from the same SVGs the API serves
# (artifacts/api-server/src/lib/adserver/creativeSpec.ts templateSvg). Needs Python Playwright + Chromium.
# Run after changing FORMATS: bash scripts/gen-creative-templates.sh
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=artifacts/clinichub-media/public/ads-specs/templates
TMP=$(mktemp -d)
cat > "$TMP/dump.ts" <<TS
import { writeFileSync } from "node:fs";
import { FORMATS, templateSvg } from "$PWD/artifacts/api-server/src/lib/adserver/creativeSpec";
for (const f of FORMATS) writeFileSync("$TMP/" + f.key + ".svg", templateSvg(f));
writeFileSync("$TMP/list.json", JSON.stringify(FORMATS.map((f) => [f.key, f.upload[0], f.upload[1]])));
TS
artifacts/api-server/node_modules/.bin/esbuild "$TMP/dump.ts" --bundle --platform=node --outfile="$TMP/dump.cjs" --log-level=error
node "$TMP/dump.cjs"
python3 - "$TMP" "$OUT" <<'PY'
import json, sys, pathlib
from playwright.sync_api import sync_playwright
tmp, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    for key, w, h in json.loads((tmp / "list.json").read_text()):
        pg = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        pg.set_content(f'<html><body style="margin:0">{(tmp / (key + ".svg")).read_text()}</body></html>')
        pg.screenshot(path=str(out / f"{key}.png"), clip={"x": 0, "y": 0, "width": w, "height": h})
        pg.close()
    b.close()
print("templates written to", out)
PY
