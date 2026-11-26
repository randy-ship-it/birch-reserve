/**
 * Server-only gate for the /advertise/brands detail list (names + per-hub volumes).
 * Public totals live in publicBrandTotals.ts so the client can render them without
 * this module (or BRAND_HUBS) in the public bundle.
 *
 * Access code: BRANDS_ACCESS_CODE, else TAM_ACCESS_CODE (same code as /inventory),
 * else the long-standing TAM access code. Compared case-insensitively via SHA-256
 * + timingSafeEqual. Never returned in responses.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BRAND_HUBS, CLINIC_NETWORK, SLOTS, toCad, type BrandHub, type Currency, type Hub } from "./model";
import type { BrandsAccessHub, BrandsAccessPayload, BrandsAccessSurface } from "./brandsAccessTypes";

export type { BrandsAccessHub, BrandsAccessPayload, BrandsAccessSurface } from "./brandsAccessTypes";

const SOV = 0.2;
const AVAIL = 0.75;
const KIND = "brands-access";
const TTL_MS = 12 * 60 * 60 * 1000;

let ephemeral: string | null = null;
function secret(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.SESSION_SECRET?.trim();
  if (s) return `brands-access:${s}`;
  ephemeral ??= randomBytes(32).toString("hex");
  return ephemeral;
}

const mac = (data: string, env?: NodeJS.ProcessEnv) => createHmac("sha256", secret(env)).update(data).digest("base64url");

export function accessCodeOf(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BRANDS_ACCESS_CODE || env.TAM_ACCESS_CODE || "gwen2027").trim();
}

export function codeMatches(got: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  const want = accessCodeOf(env).toLowerCase();
  const have = String(got ?? "").trim().toLowerCase();
  if (!have) return false;
  const a = createHash("sha256").update(want).digest();
  const b = createHash("sha256").update(have).digest();
  return timingSafeEqual(a, b);
}

export function signBrandsAccessToken(now = Date.now(), env?: NodeJS.ProcessEnv): string {
  const body = Buffer.from(JSON.stringify({ k: KIND, x: now + TTL_MS })).toString("base64url");
  return `${body}.${mac(body, env)}`;
}

export function verifyBrandsAccessToken(token: unknown, now = Date.now(), env?: NodeJS.ProcessEnv): boolean {
  if (typeof token !== "string" || token.length > 2000) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const want = Buffer.from(mac(body, env));
  const got = Buffer.from(sig);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { k?: string; x?: number };
    return p.k === KIND && typeof p.x === "number" && p.x >= now;
  } catch {
    return false;
  }
}

/** Same view and price math as RateCard on /advertise/brands. Do not change rates. */
function sponsorImps(h: Hub, key: (typeof SLOTS)[number]["key"]): number {
  return Math.round((h.views[key] * AVAIL * SOV) / 100) * 100;
}

function slotPrice(h: Hub, s: (typeof SLOTS)[number], currency: Currency): number {
  const usd = Math.max(10, Math.round((sponsorImps(h, s.key) * s.cpmUsd) / 1000 / 10) * 10);
  return currency === "cad" ? toCad(usd) : usd;
}

function corePackage(h: Hub, currency: Currency): number {
  const core = SLOTS.filter((s) => s.core);
  return Math.max(currency === "cad" ? toCad(190) : 190, core.reduce((a, s) => a + slotPrice(h, s, currency), 0));
}

function row(h: Hub, extra?: Partial<BrandHub>): BrandsAccessHub {
  const core = SLOTS.filter((s) => s.core);
  return {
    key: h.key,
    name: h.name,
    kind: h.kind,
    category: h.category,
    recovery: extra?.recovery,
    audience: extra?.audience,
    bannerStatus: extra?.bannerStatus,
    logo: extra?.logo,
    banner: extra?.banner,
    url: h.url || undefined,
    basis: h.basis,
    surfaces: core.map((s) => ({
      key: s.key,
      label: s.label,
      views: sponsorImps(h, s.key),
      priceUsd: slotPrice(h, s, "usd"),
      priceCad: slotPrice(h, s, "cad"),
      cpmUsd: s.cpmUsd,
    })),
    corePackageUsd: corePackage(h, "usd"),
    corePackageCad: corePackage(h, "cad"),
  };
}

export function buildBrandsAccessPayload(token: string): BrandsAccessPayload {
  const brandRows = BRAND_HUBS.map((h) => row(h, h));
  const clinic = row(CLINIC_NETWORK);
  return {
    ok: true,
    token,
    claim: "Modelled estimates from listed partners",
    modelled: "Per-hub views are modelled estimates for one sponsor position (20% share of voice at 75% availability), not measured delivery or a guarantee. Prices are starting-at rates, illustrative estimates, not sold rates or a quote.",
    hubs: [...brandRows, clinic],
  };
}
