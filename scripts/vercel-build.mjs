/**
 * Produce a Vercel Build Output API v3 directory at .vercel/output.
 *
 * static/  Vite client (artifacts/clinichub-media/dist/public)
 * functions/api.func/  one Node function that runs the Express app
 *
 * Routing lives in .vercel/output/config.json. A request keeps its original
 * path, so Express still sees /api/launch/randy-chat, /v1/checkout, and the
 * public pages. The function does not parse the body before Express, so the
 * Stripe webhook still receives the raw bytes.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(repoRoot, ".vercel", "output");
const staticDir = path.join(outputRoot, "static");
const funcDir = path.join(outputRoot, "functions", "api.func");
const clientDist = path.join(repoRoot, "artifacts", "clinichub-media", "dist", "public");

const requireFromApi = createRequire(
  new URL("../artifacts/api-server/package.json", import.meta.url),
);
const { build } = requireFromApi("esbuild");
const esbuildPluginPino = requireFromApi("esbuild-plugin-pino");

const API_PATHS = [
  "/api(?:/.*)?",
  "/v1(?:/.*)?",
  "/ucp(?:/.*)?",
  "/\\.well-known/ucp",
  "/\\.well-known/agent\\.json",
  "/llms\\.txt",
  "/llms-full\\.txt",
  "/vs-google-ads/?",
  "/how-fast/?",
  "/openapi\\.yaml",
  "/buycalc/?",
  "/oatmeal/?",
  "/advertise/?",
  "/availability\\.json",
  "/kit/?",
  "/kit/r/[^/]+/?",
  "/brand-kit/?",
  "/sponsor/?",
  "/exclusive/?",
  // Overhaul routes: the function serves the SPA shell with per-route head + JSON-LD.
  "/advertise/(?:brands|local)/?",
  "/publish(?:/(?:brands|studios))?/?",
  "/match/?",
  "/hubs/?",
  "/media-kit/?",
  "/for(?:/.*)?",
  "/mediakit/?",
  "/agencies/?",
  "/media-buyers/?",
  "/intake(?:/(?:publisher|supplier|sponsor|report))?/?",
  "/ai-buyers/?",
  "/terms/?",
  "/privacy/?",
  "/sample-io/?",
  "/insights(?:/.*)?",
  "/ops(?:/.*)?",
  "/sitemap\\.xml",
  "/about/?",
  "/sell-ads/?",
  "/list-inventory/?",
  "/sellads/?",
  "/buy-ads/?",
  "/buyads/?",
  "/marketplace/?",
  "/success/?",
  "/splash/activation/?",
  "/ad-examples/?",
  // Advertiser guides (server-rendered).
  "/advertiser-guides/?",
  "/glp-1-brand-advertising/?",
  "/advertise-supplements-canada/?",
  "/recovery-device-advertising/?",
  "/post-purchase-ads-health-brands/?",
  "/health-wellness-retail-media-canada/?",
  // Self-serve buy (server-rendered).
  "/buy/?",
  // Blog (server-rendered).
  "/blog(?:/[a-z0-9-]+)?/?",
];

// Real client routes that stay on the static shell. Anything else that misses
// the filesystem is the function, which answers unknown pages with 404.
const SPA_INDEX_PATHS = [
  "/sales(?:/.*)?",
  "/sign-in(?:/.*)?",
  "/sign-up(?:/.*)?",
  "/editorial(?:/.*)?",
];

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const buildEnv = {
  ...process.env,
  PORT: process.env.PORT || "3000",
  BASE_PATH: process.env.BASE_PATH || "/",
};

run("pnpm", ["--filter", "@workspace/clinichub-media", "run", "build"], buildEnv);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(funcDir, { recursive: true });
await cp(clientDist, staticDir, { recursive: true });
await cp(path.join(clientDist, "index.html"), path.join(funcDir, "spa-index.html"));

await build({
  entryPoints: {
    index: path.join(repoRoot, "artifacts", "api-server", "src", "vercel.ts"),
  },
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: funcDir,
  entryNames: "[name]",
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: [
    "*.node",
    "sharp",
    "better-sqlite3",
    "sqlite3",
    "canvas",
    "bcrypt",
    "argon2",
    "fsevents",
    "re2",
    "pg-native",
    "bufferutil",
    "utf-8-validate",
  ],
  sourcemap: "linked",
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: {
    js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`,
  },
});

await cp(
  path.join(repoRoot, "artifacts", "api-server", "src", "knowledge"),
  path.join(funcDir, "knowledge"),
  { recursive: true },
);
await mkdir(path.join(funcDir, "lib", "api-spec"), { recursive: true });
await cp(
  path.join(repoRoot, "lib", "api-spec", "openapi.yaml"),
  path.join(funcDir, "lib", "api-spec", "openapi.yaml"),
);
await mkdir(path.join(funcDir, "artifacts", "clinichub-media", "public", "ops"), {
  recursive: true,
});
await cp(
  path.join(repoRoot, "artifacts", "clinichub-media", "public", "ops", "rdgd-bulletin.html"),
  path.join(funcDir, "artifacts", "clinichub-media", "public", "ops", "rdgd-bulletin.html"),
);

await writeFile(
  path.join(funcDir, "package.json"),
  JSON.stringify({ type: "module", private: true }, null, 2),
);
await writeFile(
  path.join(funcDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      maxDuration: 60,
    },
    null,
    2,
  ),
);

const routes = [
  // Scale mirror (artifacts/api-server/src/middlewares/mirrorHost.ts): every path is also served at /intake/_m/<path>,
  // so scalehealth.ca can forward only its /intake namespace. Static files resolve through the filesystem check;
  // everything else falls through to the function, which strips the same prefix.
  { src: "^/intake/_m/?$", dest: "/api" },
  { src: "^/intake/_m/(.+)$", dest: "/$1", check: true },
  // The home page is served by the function so its Offer JSON-LD matches the visitor's currency.
  { src: "^/$", dest: "/api" },
  { handle: "filesystem" },
  ...API_PATHS.map((src) => ({ src, dest: "/api" })),
  ...SPA_INDEX_PATHS.map((src) => ({ src, dest: "/index.html" })),
  { src: "/(.*)", dest: "/api" },
];

// Crons live in vercel.json only. Copying them here as well makes Vercel
// reject the deploy with duplicated_cron_job.
await writeFile(
  path.join(outputRoot, "config.json"),
  JSON.stringify({ version: 3, routes }, null, 2),
);

console.log("Vercel Build Output API written to .vercel/output");
