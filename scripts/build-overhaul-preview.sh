#!/usr/bin/env bash
# Builds the preview-only bundle deployed to birch-reserve-cad-preview (no DB, no Clerk, no live Stripe).
# Output: /tmp/br-deploy/{public,api/index.mjs,vercel.json,package.json}. Never deploy this to production.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/clinichub-media run build
rm -rf /tmp/br-deploy && mkdir -p /tmp/br-deploy/api
cp -r artifacts/clinichub-media/dist/public /tmp/br-deploy/public
rm -f /tmp/br-deploy/public/hub-proof/kalaya-* /tmp/br-deploy/public/hub-gallery/kalaya.* /tmp/br-deploy/public/ops/rdgd-bulletin.html
(cd artifacts/api-server && npx esbuild src/preview/vercel.ts --bundle --platform=node --target=node20 --format=esm \
  --outfile=/tmp/br-deploy/api/index.mjs --loader:.html=text --external:pg-native \
  --banner:js='import { createRequire } from "node:module"; const require = createRequire(import.meta.url);')
cat > /tmp/br-deploy/vercel.json <<'JSON'
{
  "framework": null,
  "buildCommand": "",
  "installCommand": "",
  "outputDirectory": "public",
  "functions": { "api/index.mjs": { "maxDuration": 30 } },
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index" }],
  "headers": [{ "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex" }] }]
}
JSON
echo '{"name":"birch-reserve-cad-preview","private":true,"type":"module"}' > /tmp/br-deploy/package.json
echo "Preview bundle ready in /tmp/br-deploy (deploy as a preview to birch-reserve-cad-preview only)."
