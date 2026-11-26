/**
 * Self-serve ad buy at /buy (Randy, voice, Nov 19 2026 10:10 PM ET).
 * "Buy Scale Health ads through Birch Reserve."
 *
 * Three steps on one page:
 *   1. Account   name, work email, company website. Light ownership check: the email domain should match the
 *                website domain. A mismatch or a free-mail address is FLAGGED for human review, never blocked.
 *                The account is a signed token (HMAC, SESSION_SECRET), so no password and no visitor email.
 *                Email verification by code is built but OFF (BUY_EMAIL_VERIFY_ENABLED, no visitor email today).
 *   2. Creative  one PNG / JPEG / WebP / GIF, max 2 MB, 300 to 4000 px a side. Type is checked from the file
 *                bytes, not the name. Held for human approval before anything runs.
 *   3. Slot      where it shows + plan. $190 / $490 go to the SAME Stripe Checkout path as /buycalc
 *                (POST /v1/checkout: Stripe verifies the card, Radar scores it, 3DS when the bank asks).
 *                Starter placement: the $1,900 starter placement by card (POST /v1/exclusive/reserve), which holds a $5K–$50K
 *                dedicated package pending an insertion order. All prices in the visitor's currency (lib/priceLadder.ts).
 *
 * Store: production (VERCEL_ENV=production) writes buy_creatives / buy_orders in Postgres (created on first use,
 * additive). Every other environment keeps them in this instance's memory, so preview QA never writes prod data.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { ReserveCurrency } from "./reserveOffers";
import { priceLadder } from "./priceLadder";
import { PREMIUM_INQUIRE_ONLY } from "./premiumInquireOnly";
import { FixedWindowLimiter } from "./rateLimit";

export const BUY_PATH = "/buy" as const;
export const BUY_TAGLINE = "Buy Scale Health ads through Birch Reserve." as const;

/* ------------------------------------------------------------------ slots */
export type BuyPlan = {
  key: "hold-190" | "reserve-490" | "exclusive";
  price: string;
  name: string;
  line: string;
  /** card: $190 / $490 checkout. reserve: the $1,900 starter placement checkout (internal pay key unchanged). */
  pay: "card" | "reserve";
};

/** /buy plan cards from the one price source, in the visitor's currency. */
export function buyPlans(currency: ReserveCurrency): readonly BuyPlan[] {
  const L = Object.fromEntries(priceLadder(currency).map((s) => [s.key, s]));
  return [
    { key: "reserve-490", price: L["reserve-490"]!.price, name: "Reserve your space", line: "Shared category seat. 100% media credit. Refundable until 14 days before launch.", pay: "card" },
    { key: "hold-190", price: L["hold-190"]!.price, name: "7-day look", line: "See your placement for 7 days. Converts in full, or refunded.", pay: "card" },
    { key: "exclusive", price: L["exclusive"]!.price, name: "Starter placement", line: `${L["exclusive"]!.line.replace(/ All \$1,900 counts toward it\.$/, "")} One brand per category; the IO sets hub and dates.`, pay: "reserve" },
  ];
}

export const BUY_PLANS: readonly BuyPlan[] = buyPlans("usd");

export type BuyFormat = { key: string; label: string; hint: string; premium: boolean };
/** Display slots that take a still image. Motion 15s is by request (video), so it is not on this page. */
export const BUY_FORMATS: readonly BuyFormat[] = [
  { key: "recovery_plan", label: "Recovery plan", hint: "Next to the plan a member follows at home", premium: false },
  { key: "scheduled_service", label: "Booking page", hint: "Where members book their next visit", premium: false },
  { key: "member_hub", label: "Member hub", hint: "The member's home screen in the hub", premium: false },
  { key: "post_checkout", label: "After checkout", hint: "Right after a member pays. Starter placement only", premium: true },
] as const;

for (const f of BUY_FORMATS) {
  if (f.premium !== (PREMIUM_INQUIRE_ONLY.formats as readonly string[]).includes(f.key)) {
    throw new Error(`buyFlow: ${f.key} premium flag is out of sync with PREMIUM_INQUIRE_ONLY`);
  }
}

export const findPlan = (key: unknown) => BUY_PLANS.find((p) => p.key === key) ?? null;
export const findFormat = (key: unknown) => BUY_FORMATS.find((f) => f.key === key) ?? null;

/** A pick is valid when a card plan is on a self-serve slot, or the exclusive plan is on any slot. */
export function validPick(plan: BuyPlan | null, format: BuyFormat | null): boolean {
  if (!plan || !format) return false;
  if (plan.pay === "card" && format.premium) return false;
  return true;
}

/* ------------------------------------------------------------------ account */
const EMAIL_RE = /^[^\s@]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.ca", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "yandex.com", "rogers.com", "bell.net", "shaw.ca", "sympatico.ca",
]);

export type BuyAccountInput = { name: string; email: string; company: string; website: string };
export type DomainCheck = "match" | "mismatch" | "free_email";
export type BuyAccount = BuyAccountInput & { domainCheck: DomainCheck; websiteHost: string };

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function websiteHost(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || h.length > 120) return null;
    return h;
  } catch {
    return null;
  }
}

/** Registrable-ish base: last two labels, or three for co.uk-style / .com.au-style suffixes. */
function baseDomain(host: string): string {
  const p = host.split(".");
  const two = p.slice(-2).join(".");
  if (p.length >= 3 && /^(co|com|net|org|gov|ac)\.[a-z]{2}$/.test(two)) return p.slice(-3).join(".");
  return two;
}

export function domainCheck(email: string, host: string): DomainCheck {
  const ed = email.split("@")[1]?.toLowerCase() ?? "";
  if (FREE_MAIL.has(ed)) return "free_email";
  return baseDomain(ed) === baseDomain(host) ? "match" : "mismatch";
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };

export function parseAccount(body: unknown): ParseResult<BuyAccount> {
  const r = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const name = clean(r.name, 120);
  const email = clean(r.email, 200).toLowerCase();
  const company = clean(r.company, 160);
  const website = clean(r.website, 300);
  if (name.length < 2) return { ok: false, error: "Add your name.", field: "name" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Add a work email.", field: "email" };
  if (company.length < 2) return { ok: false, error: "Add your company.", field: "company" };
  const host = websiteHost(website);
  if (!host) return { ok: false, error: "Add your company website.", field: "website" };
  return { ok: true, value: { name, email, company, website: `https://${host}`, websiteHost: host, domainCheck: domainCheck(email, host) } };
}

/* ------------------------------------------------------------------ signed tokens */
let ephemeralSecret: string | null = null;
function secret(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.SESSION_SECRET?.trim();
  if (s) return `buyflow:${s}`;
  ephemeralSecret ??= randomBytes(32).toString("hex"); // local/tests only; prod and preview have SESSION_SECRET
  return ephemeralSecret;
}
const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signToken(kind: "acct" | "crv", payload: Record<string, unknown>, ttlMs = 2 * 3600_000, now = Date.now()): string {
  const body = b64u(JSON.stringify({ k: kind, x: now + ttlMs, ...payload }));
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyToken<T extends Record<string, unknown>>(kind: "acct" | "crv", token: unknown, now = Date.now()): T | null {
  if (typeof token !== "string" || token.length > 4000) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", secret()).update(body).digest();
  let got: Buffer;
  try {
    got = Buffer.from(mac, "base64url");
  } catch {
    return null;
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (p.k !== kind || typeof p.x !== "number" || p.x < now) return null;
    return p as T;
  } catch {
    return null;
  }
}

export type AccountClaims = { e: string; n: string; c: string; w: string; d: DomainCheck; id: string };
/* ------------------------------------------------------------------ kit -> /buy prefill */
/**
 * Post-kit checkout prefill (Randy, Nov 20 2026 9:47 AM ET). The kit already has brand, email and website, so /buy
 * step 1 opens filled in. The values travel as an ENCRYPTED short-lived token (AES-256-GCM, key from SESSION_SECRET),
 * so the email is never readable in a URL, a log line or analytics. Nothing is stored server-side.
 */
export type BuyPrefill = { name?: string; email?: string; company?: string; website?: string };
export const PREFILL_TTL_MS = 2 * 3600_000;
const prefillKey = () => createHash("sha256").update(`${secret()}:prefill`).digest();

export function parsePrefill(body: unknown): BuyPrefill {
  const r = (body && typeof body === "object" && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const out: BuyPrefill = {};
  const name = clean(r.name, 120);
  const email = clean(r.email, 200).toLowerCase();
  const company = clean(r.company, 160);
  const host = websiteHost(clean(r.website, 300));
  if (name.length >= 2) out.name = name;
  if (EMAIL_RE.test(email)) out.email = email;
  if (company.length >= 2) out.company = company;
  if (host) out.website = host;
  return out;
}

export function sealPrefill(p: BuyPrefill, now = Date.now(), ttlMs = PREFILL_TTL_MS): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", prefillKey(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify({ x: now + ttlMs, ...p }), "utf8"), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), enc]));
}

export function openPrefill(token: unknown, now = Date.now()): BuyPrefill | null {
  if (typeof token !== "string" || token.length < 40 || token.length > 2000) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    const d = createDecipheriv("aes-256-gcm", prefillKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    const j = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as BuyPrefill & { x?: number };
    if (typeof j.x !== "number" || j.x < now) return null;
    return parsePrefill(j);
  } catch {
    return null;
  }
}

export function accountToken(a: BuyAccount): string {
  return signToken("acct", { e: a.email, n: a.name, c: a.company, w: a.website, d: a.domainCheck, id: randomUUID() });
}

/* ------------------------------------------------------------------ creative */
export const CREATIVE_MAX_BYTES = 2 * 1024 * 1024;
export const CREATIVE_MIN_PX = 300;
export const CREATIVE_MAX_PX = 4000;
export const CREATIVE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export type CreativeType = (typeof CREATIVE_TYPES)[number];

/** Image type and size from the bytes themselves. Null when it is not one of the four types. */
export function sniffImage(buf: Buffer): { mime: CreativeType; width: number; height: number } | null {
  if (buf.length < 24) return null;
  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buf.toString("ascii", 12, 16) === "IHDR") {
    return { mime: "image/png", width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a") {
    return { mime: "image/gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP" && buf.length >= 30) {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { mime: "image/webp", width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (chunk === "VP8 ") return { mime: "image/webp", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === "VP8L" && buf[20] === 0x2f) {
      const b = buf.readUInt32LE(21);
      return { mime: "image/webp", width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  // JPEG: walk the markers to the first SOFn
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const m = buf[i + 1]!;
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { mime: "image/jpeg", height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  return null;
}

export function checkCreative(buf: Buffer, min: { width?: number; height?: number } = {}): ParseResult<{ mime: CreativeType; width: number; height: number; bytes: number; sha256: string }> {
  if (!buf.length) return { ok: false, error: "Choose an image to upload." };
  if (buf.length > CREATIVE_MAX_BYTES) return { ok: false, error: "That file is over 2 MB. Export a smaller PNG, JPG or WebP." };
  const img = sniffImage(buf);
  if (!img) return { ok: false, error: "Use a PNG, JPG, WebP or GIF image." };
  const minW = min.width ?? CREATIVE_MIN_PX;
  const minH = min.height ?? CREATIVE_MIN_PX;
  if (img.width < minW || img.height < minH) {
    return { ok: false, error: minW === minH ? `Image is too small. Use at least ${minW} px on each side.` : `Image is too small. Use at least ${minW} px wide and ${minH} px tall.` };
  }
  if (img.width > CREATIVE_MAX_PX || img.height > CREATIVE_MAX_PX) return { ok: false, error: `Image is too large. Keep each side under ${CREATIVE_MAX_PX} px.` };
  return { ok: true, value: { ...img, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") } };
}

export type CreativeClaims = { id: string; a: string; e: string; m: CreativeType; w: number; h: number; b: number; s: string };

/* ------------------------------------------------------------------ store */
export type StoredCreative = { id: string; accountId: string; email: string; mime: string; width: number; height: number; bytes: number; sha256: string; data: Buffer; createdAt: Date };
export type StoredOrder = {
  id: string; accountId: string; name: string; email: string; company: string; website: string; domainCheck: DomainCheck;
  plan: string; format: string; creativeId: string | null; reviewStatus: "pending_review"; ip: string; createdAt: Date;
};

export type BuyStore = {
  name: "postgres" | "memory";
  putCreative(c: StoredCreative): Promise<void>;
  getCreative(id: string): Promise<StoredCreative | null>;
  putOrder(o: StoredOrder): Promise<void>;
  listOrders(limit: number): Promise<StoredOrder[]>;
};

export function memoryBuyStore(maxCreatives = 200): BuyStore {
  const creatives = new Map<string, StoredCreative>();
  const orders: StoredOrder[] = [];
  return {
    name: "memory",
    async putCreative(c) {
      creatives.set(c.id, c);
      if (creatives.size > maxCreatives) creatives.delete(creatives.keys().next().value!);
    },
    async getCreative(id) {
      return creatives.get(id) ?? null;
    },
    async putOrder(o) {
      orders.push(o);
      if (orders.length > 1000) orders.shift();
    },
    async listOrders(limit) {
      return orders.slice(-limit).reverse();
    },
  };
}

type Pool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };

export function postgresBuyStore(getPool: () => Promise<Pool>): BuyStore {
  let ready: Promise<void> | null = null;
  const ensure = async () => {
    const pool = await getPool();
    ready ??= pool
      .query(`CREATE TABLE IF NOT EXISTS buy_creatives (
        id uuid PRIMARY KEY, account_id text NOT NULL, email text NOT NULL, mime text NOT NULL, width integer NOT NULL,
        height integer NOT NULL, bytes integer NOT NULL, sha256 text NOT NULL, data bytea NOT NULL,
        review_status text NOT NULL DEFAULT 'pending_review', created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS buy_orders (
        id uuid PRIMARY KEY, account_id text NOT NULL, name text NOT NULL, email text NOT NULL, company text NOT NULL,
        website text NOT NULL, domain_check text NOT NULL, plan text NOT NULL, format text NOT NULL, creative_id uuid NOT NULL,
        review_status text NOT NULL DEFAULT 'pending_review', ip text, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS buy_orders_created_idx ON buy_orders (created_at);
      ALTER TABLE buy_orders ALTER COLUMN creative_id DROP NOT NULL;`)
      .then(() => undefined)
      .catch((e) => {
        ready = null;
        throw e;
      });
    await ready;
    return pool;
  };
  return {
    name: "postgres",
    async putCreative(c) {
      const pool = await ensure();
      await pool.query(
        "INSERT INTO buy_creatives (id, account_id, email, mime, width, height, bytes, sha256, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING",
        [c.id, c.accountId, c.email, c.mime, c.width, c.height, c.bytes, c.sha256, c.data],
      );
    },
    async getCreative(id) {
      const pool = await ensure();
      const { rows } = await pool.query("SELECT * FROM buy_creatives WHERE id = $1", [id]);
      const r = rows[0];
      if (!r) return null;
      return { id: String(r.id), accountId: String(r.account_id), email: String(r.email), mime: String(r.mime), width: Number(r.width), height: Number(r.height), bytes: Number(r.bytes), sha256: String(r.sha256), data: r.data as Buffer, createdAt: new Date(String(r.created_at)) };
    },
    async putOrder(o) {
      const pool = await ensure();
      await pool.query(
        "INSERT INTO buy_orders (id, account_id, name, email, company, website, domain_check, plan, format, creative_id, ip) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [o.id, o.accountId, o.name, o.email, o.company, o.website, o.domainCheck, o.plan, o.format, o.creativeId, o.ip],
      );
    },
    async listOrders(limit) {
      const pool = await ensure();
      const { rows } = await pool.query("SELECT * FROM buy_orders ORDER BY created_at DESC LIMIT $1", [limit]);
      return rows.map((r) => ({
        id: String(r.id), accountId: String(r.account_id), name: String(r.name), email: String(r.email), company: String(r.company), website: String(r.website),
        domainCheck: r.domain_check as DomainCheck, plan: String(r.plan), format: String(r.format), creativeId: r.creative_id == null ? null : String(r.creative_id), reviewStatus: "pending_review" as const,
        ip: String(r.ip ?? ""), createdAt: new Date(String(r.created_at)),
      }));
    },
  };
}

export const isProductionRuntime = () => process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production" && process.env.BUY_STORE === "postgres");

let store: BuyStore | null = null;
export function buyStore(): BuyStore {
  store ??= isProductionRuntime()
    ? postgresBuyStore(async () => (await import("@workspace/db")).pool as unknown as Pool)
    : memoryBuyStore();
  return store;
}
export function setBuyStoreForTests(s: BuyStore | null): void {
  store = s;
}

/* ------------------------------------------------------------------ limits + flags */
const W = 10 * 60_000;
export const buyLimiters = {
  accountIp: new FixedWindowLimiter({ max: 12, windowMs: W }),
  accountEmail: new FixedWindowLimiter({ max: 6, windowMs: W }),
  creativeIp: new FixedWindowLimiter({ max: 12, windowMs: W }),
  creativeAccount: new FixedWindowLimiter({ max: 5, windowMs: W }),
  orderIp: new FixedWindowLimiter({ max: 8, windowMs: W }),
  orderEmail: new FixedWindowLimiter({ max: 4, windowMs: W }),
  prefillIp: new FixedWindowLimiter({ max: 30, windowMs: W }),
};
export function resetBuyLimitsForTests(): void {
  for (const l of Object.values(buyLimiters)) l.reset();
}

/** Email verification by one-time code. OFF: visitor emails stay off (Randy). Flip only when sending is approved. */
export const emailVerifyEnabled = (env: NodeJS.ProcessEnv = process.env) => env.BUY_EMAIL_VERIFY_ENABLED === "true";
