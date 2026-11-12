/**
 * Seat availability: Friday App first, then the BR ledger, then "call to confirm".
 * Never invents a count and never shows a fake "sold": any doubt -> unknown.
 *
 * Friday contract (friday-crm PR #159, docs/BIRCH_SEATS.md; ours: docs/SEATS-FRIDAY-CONTRACT.md):
 *   GET {FRIDAY_SEATS_URL}   e.g. https://fridayapp.org/api/public/birch/seats (no auth, CORS *, cached 15s)
 *   200 { org, source, as_of, total, open, held, locked,
 *         categories: [{ slug, name, status: "open"|"held"|"locked", holder, held_until, requests, waitlist }] }
 * FRIDAY_SEATS_URL set   -> Friday answer, else "call to confirm" (no ledger guess).
 * FRIDAY_SEATS_URL unset -> BR ledger (14 days), else "call to confirm".
 */
import { CONTACT, SEAT_CATEGORIES, SEAT_TOTAL, SEATS_VERSION, categoryBySlug } from "./catalog";
import { LEDGER_MAX_AGE_DAYS, SEAT_LEDGER, type SeatLedger } from "./ledger";

export type SeatStatus = "open" | "held" | "locked" | "unknown";
export type AvailabilitySource = "friday" | "ledger" | "none";

export type SeatAvailability = {
  version: string;
  source: AvailabilitySource;
  as_of: string | null;
  total: number;
  open: number | null;
  confirm_by_phone: boolean;
  categories: { slug: string; label: string; status: SeatStatus; until?: string }[];
  note: string;
  contact: { phone: string; email: string };
};

type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const VALID = new Set(["open", "held", "locked"]);

function build(source: AvailabilitySource, asOf: string | null, statuses: Map<string, { status: SeatStatus; until?: string }>, note: string): SeatAvailability {
  const categories = SEAT_CATEGORIES.map((c) => {
    const s = statuses.get(c.slug);
    return { slug: c.slug, label: c.label, status: s?.status ?? "unknown", ...(s?.until ? { until: s.until } : {}) };
  });
  const known = categories.every((c) => c.status !== "unknown");
  return {
    version: SEATS_VERSION,
    source,
    as_of: asOf,
    total: SEAT_TOTAL,
    open: known ? categories.filter((c) => c.status === "open").length : null,
    confirm_by_phone: !known,
    categories,
    note,
    contact: { phone: CONTACT.phoneDisplay, email: CONTACT.email },
  };
}

export function unknownAvailability(): SeatAvailability {
  return build("none", null, new Map(), `Live availability is being confirmed. Call ${CONTACT.phoneDisplay} or email ${CONTACT.email} and we'll confirm your category today.`);
}

/** Strict parse of Friday's seat payload. Anything off -> null (fallback). */
export function parseFridaySeats(body: unknown, now = Date.now(), opts: { allowFixture?: boolean } = {}): SeatAvailability | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { as_of?: unknown; categories?: unknown; org?: unknown; fixture?: unknown };
  if (!Array.isArray(b.categories)) return null;
  if (b.org !== undefined && b.org !== "birchreserve") return null;
  // Friday's ?fixture=1 sample rows are preview-only: never shown as live on production.
  if (b.fixture === true && opts.allowFixture !== true) return null;
  const asOf = typeof b.as_of === "string" && !Number.isNaN(Date.parse(b.as_of)) ? b.as_of : null;
  if (!asOf) return null;
  // A Friday answer older than a day is stale: do not show it as live.
  if (now - Date.parse(asOf) > 24 * 3600_000) return null;
  const map = new Map<string, { status: SeatStatus; until?: string }>();
  for (const raw of b.categories as unknown[]) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as { slug?: unknown; status?: unknown; held_until?: unknown };
    const slug = categoryBySlug(r.slug)?.slug ?? "";
    const status = String(r.status ?? "");
    if (!SEAT_CATEGORIES.some((c) => c.slug === slug) || !VALID.has(status)) return null;
    let s = status as SeatStatus;
    let until: string | undefined;
    if (s === "held" && typeof r.held_until === "string" && !Number.isNaN(Date.parse(r.held_until))) {
      until = r.held_until;
      // An expired 7-day hold is not shown as open either: Randy confirms first.
      if (Date.parse(until) < now) s = "unknown";
    }
    map.set(slug, { status: s, ...(until ? { until } : {}) });
  }
  if (map.size !== SEAT_TOTAL) return null;
  return build("friday", asOf, map, b.fixture === true ? "Preview sample data from Friday (fixture), not live seats." : "Live from the Birch Reserve pipeline in Friday.");
}

/** Ledger -> availability, or null when the ledger is stale or malformed. */
export function ledgerAvailability(ledger: SeatLedger, now = Date.now()): SeatAvailability | null {
  const asOfMs = Date.parse(`${ledger.as_of}T23:59:59-05:00`);
  if (Number.isNaN(asOfMs) || now - asOfMs > LEDGER_MAX_AGE_DAYS * 86_400_000) return null;
  const map = new Map<string, { status: SeatStatus; until?: string }>();
  for (const c of SEAT_CATEGORIES) {
    const e = ledger.seats[c.slug];
    if (!e || !VALID.has(e.status)) return null;
    let status: SeatStatus = e.status;
    if (status === "held" && e.until && Date.parse(e.until) < now) status = "unknown";
    map.set(c.slug, { status, ...(e.until ? { until: e.until } : {}) });
  }
  return build("ledger", ledger.as_of, map, `Confirmed by Birch Reserve as of ${ledger.as_of}. Call to confirm before you pay.`);
}

function ledgerFromEnv(env: NodeJS.ProcessEnv): SeatLedger {
  const raw = env.SEAT_LEDGER_JSON?.trim();
  if (!raw) return SEAT_LEDGER;
  try {
    const parsed = JSON.parse(raw) as SeatLedger;
    if (parsed && typeof parsed.as_of === "string" && parsed.seats && typeof parsed.seats === "object") return parsed;
  } catch {
    /* fall through */
  }
  return { as_of: "1970-01-01", basis: "invalid SEAT_LEDGER_JSON", seats: {} };
}

/** Seat read URL comes only from env: preview -> Friday preview fixture, prod -> fridayapp.org once PR #159 ships. */
export function fridaySeatsUrl(env: NodeJS.ProcessEnv): string | null {
  const explicit = env.FRIDAY_SEATS_URL?.trim();
  return explicit && /^https:\/\//i.test(explicit) ? explicit : null;
}

/** Fixture rows are allowed only off production (Vercel preview / local). */
export function fixtureAllowed(env: NodeJS.ProcessEnv): boolean {
  return env.VERCEL_ENV !== "production" && env.SEATS_ALLOW_FIXTURE !== "false";
}

let cache: { at: number; value: SeatAvailability } | null = null;
const CACHE_MS = 15_000; // matches Friday max-age=15

export function clearAvailabilityCacheForTests(): void {
  cache = null;
}

export async function getSeatAvailability(
  env: NodeJS.ProcessEnv = process.env,
  deps: { fetch?: FetchLike; now?: () => number } = {},
): Promise<SeatAvailability> {
  const now = deps.now?.() ?? Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  let value: SeatAvailability | null = null;
  const url = env.FRIDAY_SEATS_DISABLED === "true" ? null : fridaySeatsUrl(env);
  if (url) {
    // Public endpoint: no auth needed. An optional key is sent only if one is configured.
    const key = env.FRIDAY_SEATS_KEY?.trim();
    try {
      const f: FetchLike = deps.fetch ?? ((u, init) => fetch(u, init));
      const res = await f(url, { headers: { accept: "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, signal: AbortSignal.timeout(2500) });
      if (res.ok) value = parseFridaySeats(await res.json(), now, { allowFixture: fixtureAllowed(env) });
    } catch {
      value = null;
    }
    // Friday configured but unreachable or invalid: fail safe to "call to confirm".
    value ??= unknownAvailability();
  }
  value ??= ledgerAvailability(ledgerFromEnv(env), now) ?? unknownAvailability();
  cache = { at: now, value };
  return value;
}
