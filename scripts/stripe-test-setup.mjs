#!/usr/bin/env node
/**
 * Stripe TEST-mode setup for birch-reserve Preview (Randy, Nov 21 2026 2:15 PM).
 *
 * Idempotent. Creates (or reuses) in the Stripe TEST account:
 *   - one Price per checkout SKU, found by lookup_key (birch_test_*), and
 *   - one webhook endpoint for the Preview URL with the events the server handles,
 * then writes STRIPE_WEBHOOK_SECRET + the STRIPE_PRICE_* envs to Vercel, target
 * PREVIEW only (optionally one git branch). Never touches Production.
 *
 * Safety: refuses any key that isn't sk_test_/rk_test_, aborts if Stripe ever
 * answers livemode=true, dry run unless --apply, never prints secret values.
 * Nothing here charges anyone (prices and endpoints only).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... VERCEL_TOKEN=... node scripts/stripe-test-setup.mjs \
 *     --webhook-url https://<preview-host>/api/stripe/webhook [--git-branch <branch>] \
 *     [--bypass-secret-env VERCEL_AUTOMATION_BYPASS_SECRET] [--rotate-webhook] [--apply]
 *
 * Preview deployments sit behind Vercel Deployment Protection, so Stripe can only
 * reach the webhook with a protection bypass. Pass --bypass-secret-env NAME (an env
 * var holding the project's "Protection Bypass for Automation" secret) and it is
 * appended as ?x-vercel-protection-bypass=... to the endpoint URL.
 * The webhook signing secret is only shown by Stripe when an endpoint is created;
 * if the endpoint already exists, use --rotate-webhook to recreate it and get a new one.
 */

export const PROJECT_ID = "prj_pZirY7s6xQzJBEAcomPWrw5sqQTg";
export const TEAM_ID = "team_lOeMvVi5qA620Xr4vVA0C59W";
export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
];
/** Mirrors artifacts/api-server/src/lib/reserveOffers.ts and exclusiveReserve.ts (amounts in cents). */
export const PRICES = [
  { env: "STRIPE_PRICE_HOLD_190", lookup: "birch_test_hold_190_usd", currency: "usd", amount: 19_000, name: "Birch Reserve — 7-day category look (TEST)" },
  { env: "STRIPE_PRICE_RESERVE_490", lookup: "birch_test_reserve_490_usd", currency: "usd", amount: 49_000, name: "Birch Reserve — Category prepay (TEST)" },
  { env: "STRIPE_PRICE_RESERVE_899", lookup: "birch_test_reserve_899_usd", currency: "usd", amount: 89_900, name: "Birch Reserve — Legacy category reserve (TEST)" },
  { env: "STRIPE_PRICE_HOLD_190_CAD", lookup: "birch_test_hold_190_cad", currency: "cad", amount: 27_000, name: "Birch Reserve — 7-day category look, CAD (TEST)" },
  { env: "STRIPE_PRICE_RESERVE_490_CAD", lookup: "birch_test_reserve_490_cad", currency: "cad", amount: 69_000, name: "Birch Reserve — Category prepay, CAD (TEST)" },
  { env: "STRIPE_PRICE_EXCLUSIVE_1900_CAD", lookup: "birch_test_exclusive_1900_cad", currency: "cad", amount: 190_000, name: "Birch Reserve — Exclusive display reserve (TEST)" },
];

export function assertTestKey(key) {
  if (!key || typeof key !== "string") throw new Error("STRIPE_SECRET_KEY is not set.");
  if (!/^(sk|rk)_test_/.test(key)) throw new Error("Refusing: STRIPE_SECRET_KEY is not a TEST key (sk_test_/rk_test_). This script never runs against live keys.");
}
const mask = (v) => (v ? `${String(v).slice(0, 6)}…(${String(v).length})` : "(none)");

function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x, `${key}[${i}]`, out) : out.append(`${key}[]`, String(x))));
    else if (v && typeof v === "object") form(v, key, out);
    else if (v !== undefined) out.append(key, String(v));
  }
  return out;
}

export function stripeClient(key, fetchImpl = fetch) {
  assertTestKey(key);
  return async (method, path, body) => {
    const r = await fetchImpl(`https://api.stripe.com/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, ...(body ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
      body: body ? form(body).toString() : undefined,
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`Stripe ${method} ${path}: ${j?.error?.message ?? r.status}`);
    const live = j?.livemode === true || (Array.isArray(j?.data) && j.data.some((x) => x?.livemode === true));
    if (live) throw new Error("Refusing: Stripe answered livemode=true. Stopping before anything else.");
    return j;
  };
}

export async function ensurePrices(stripe, { apply, log }) {
  const out = {};
  const q = PRICES.map((p) => `lookup_keys[]=${encodeURIComponent(p.lookup)}`).join("&");
  const found = (await stripe("GET", `/prices?active=true&limit=100&${q}`)).data ?? [];
  for (const p of PRICES) {
    const hit = found.find((x) => x.lookup_key === p.lookup && x.unit_amount === p.amount && x.currency === p.currency);
    if (hit) { out[p.env] = hit.id; log(`price ${p.env}: reuse ${hit.id}`); continue; }
    if (!apply) { out[p.env] = "(would create)"; log(`price ${p.env}: would create ${p.currency.toUpperCase()} ${(p.amount / 100).toFixed(2)} (${p.lookup})`); continue; }
    const price = await stripe("POST", "/prices", { currency: p.currency, unit_amount: p.amount, lookup_key: p.lookup, transfer_lookup_key: true, product_data: { name: p.name, metadata: { birch_test: "1" } }, metadata: { birch_test: "1", env: p.env } });
    out[p.env] = price.id; log(`price ${p.env}: created ${price.id}`);
  }
  return out;
}

export async function ensureWebhook(stripe, { url, apply, rotate, log }) {
  const base = url.split("?")[0];
  const list = (await stripe("GET", "/webhook_endpoints?limit=100")).data ?? [];
  const existing = list.find((e) => e.url.split("?")[0] === base);
  if (existing && !rotate) {
    const missing = WEBHOOK_EVENTS.filter((e) => !existing.enabled_events.includes(e) && !existing.enabled_events.includes("*"));
    if (missing.length && apply) await stripe("POST", `/webhook_endpoints/${existing.id}`, { enabled_events: [...new Set([...existing.enabled_events, ...WEBHOOK_EVENTS])] });
    log(`webhook: reuse ${existing.id}${missing.length ? ` (${apply ? "added" : "would add"} ${missing.join(", ")})` : ""}; signing secret unchanged (use --rotate-webhook for a new one)`);
    return { id: existing.id, secret: null };
  }
  if (!apply) { log(`webhook: would ${existing ? "recreate" : "create"} for ${base}`); return { id: null, secret: null }; }
  if (existing) { await stripe("DELETE", `/webhook_endpoints/${existing.id}`); log(`webhook: deleted ${existing.id} (rotate)`); }
  const ep = await stripe("POST", "/webhook_endpoints", { url, enabled_events: WEBHOOK_EVENTS, description: "birch-reserve Preview (TEST mode)", metadata: { birch_test: "1" } });
  log(`webhook: created ${ep.id}, secret ${mask(ep.secret)}`);
  return { id: ep.id, secret: ep.secret };
}

export async function setPreviewEnvs(envs, { token, gitBranch, apply, log, fetchImpl = fetch, projectId = PROJECT_ID, teamId = TEAM_ID }) {
  for (const [key, value] of Object.entries(envs)) {
    if (!value || value.startsWith("(")) continue;
    if (!apply) { log(`vercel env ${key}: would set on Preview${gitBranch ? ` (${gitBranch})` : ""}`); continue; }
    if (!token) throw new Error("VERCEL_TOKEN is not set.");
    const body = { key, value, type: "encrypted", target: ["preview"], ...(gitBranch ? { gitBranch } : {}), comment: "Stripe TEST mode (scripts/stripe-test-setup.mjs)" };
    if (body.target.includes("production")) throw new Error("Refusing: never writes Production.");
    const r = await fetchImpl(`https://api.vercel.com/v10/projects/${projectId}/env?upsert=true&teamId=${teamId}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Vercel env ${key}: HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    log(`vercel env ${key}: set on Preview${gitBranch ? ` (${gitBranch})` : ""}`);
  }
}

export async function run(argv, env, { fetchImpl = fetch, log = console.log } = {}) {
  const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const flag = (n) => argv.includes(`--${n}`);
  const apply = flag("apply");
  assertTestKey(env.STRIPE_SECRET_KEY);
  const hook = arg("webhook-url");
  if (!hook || !/^https:\/\/[^/]+\/api\/stripe\/webhook$/.test(hook)) throw new Error("--webhook-url must be https://<preview-host>/api/stripe/webhook");
  if (/(^|\.)birchreserve\.net$/.test(new URL(hook).hostname)) throw new Error("Refusing: that is the production host. Use a Preview URL.");
  const bypassName = arg("bypass-secret-env");
  const bypass = bypassName ? env[bypassName] : undefined;
  if (bypassName && !bypass) throw new Error(`${bypassName} is not set.`);
  const url = bypass ? `${hook}?x-vercel-protection-bypass=${encodeURIComponent(bypass)}` : hook;
  log(`${apply ? "APPLY" : "DRY RUN (add --apply to make changes)"} · Stripe key ${mask(env.STRIPE_SECRET_KEY)} · webhook ${hook}${bypass ? " (+bypass)" : ""}`);
  const stripe = stripeClient(env.STRIPE_SECRET_KEY, fetchImpl);
  const prices = await ensurePrices(stripe, { apply, log });
  const wh = await ensureWebhook(stripe, { url, apply, rotate: flag("rotate-webhook"), log });
  await setPreviewEnvs({ ...prices, ...(wh.secret ? { STRIPE_WEBHOOK_SECRET: wh.secret } : {}) }, { token: env.VERCEL_TOKEN, gitBranch: arg("git-branch"), apply, log, fetchImpl });
  log(apply ? "Done. Redeploy the Preview so it picks up the envs." : "Dry run complete; nothing was changed.");
  return { prices, webhook: wh.id };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2), process.env).catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
