/**
 * Activity pulse (Randy t291u, Nov 20 2026): a quiet "recent activity" strip fed ONLY by real, server-side events.
 *
 * Honesty rules (BR decision, told to Randy): nothing here is invented or padded. An event is written only when a real
 * visitor completes a real action on our own server (a submitted Monetization Kit request, a category / placement
 * question from the media kit). Each row keeps a fixed action key, a category label and the time. No names, no
 * emails, no company, no IP. QA / test identities are never recorded. The public feed returns the latest N events in
 * a rolling window, with relative times, and returns nothing (the strip hides) when there are fewer than
 * PULSE_MIN_EVENTS. It never claims a sale, a hold or a brand.
 *
 * Store: production writes the activity_pulse_events Postgres table (created on first use, additive). Every other
 * environment keeps events in memory, so preview QA never writes into the production table.
 */
import { sql } from "drizzle-orm";
import { FRIDAY_CATEGORIES } from "./kitCalc/fridayV12";
import { MEDIA_KIT_CATEGORIES } from "./overhaul/mediaKit";
import { PULSE_SEED } from "./activityPulseSeed";

export const PULSE_ACTIONS = {
  kit_request: "requested a Monetization Kit",
  placement_question: "asked about a placement",
  sponsor_checkout: "started a sponsorship pack checkout",
  buy_order: "started a placement order",
  chat_pricing: "asked the site chat about pricing",
  chat_hub: "asked the site chat about hosting a hub",
  chat_mock: "asked the site chat about a mock",
  chat_reporting: "asked the site chat about reporting",
  chat_question: "asked the site chat a question",
  // Seeded from real inbox replies (lib/activityPulseSeed.ts).
  hub_hosting: "is exploring hosting a hub for their patients",
  provider_agreement: "requested our provider agreement to review",
  fee_structure: "asked how the fee structure works",
  fees_markets: "asked about fees and the markets we reach",
  hub_members: "asked about the members inside our hubs",
  how_it_works: "wanted to know how it works",
  program_summary: "asked for a program overview",
  call_booked: "lined up an intro call with our team",
  agency_partnership: "replied about partnering on media buying",
  // t295u: more real inbox replies, plus the keys the Instantly ingest (lib/pulseIngest.ts) can assign.
  placements_interest: "wants to learn more about placements in our recovery hubs",
  placements_team: "brought their placements lead into the conversation",
  examples_shared: "is sharing our placement examples with their team",
  canada_shipping: "is lining up easier shipping to Canada",
  samples_coming: "is lining up samples so we can try them before listing",
  samples_confirmed: "confirmed samples are on the way, so we can try before listing",
  concept_interest: "said the concept has lots of potential",
  passed_along: "passed our note to their partnerships contact",
  ask_performance: "asked how placements perform",
  ask_display: "asked about display placements",
  ask_cpc: "asked about CPC and CPM pricing",
  compliment: "said the concept sounds promising",
  // Confirmed launches (Randy Nov 20 5:24 PM): shown as "New physio hub launched", highlighted, 180-day window.
  location_launched: "launched",
} as const;
/** Launch events: highlighted on the site and kept for LAUNCH_WINDOW_DAYS instead of the 90-day window. */
export const LAUNCH_ACTIONS: ReadonlySet<string> = new Set(["location_launched"]);
export const LAUNCH_WINDOW_DAYS = 180;
export type PulseAction = keyof typeof PULSE_ACTIONS;

export const PULSE_MIN_EVENTS = 3;
export const PULSE_WINDOW_DAYS = 90;
/** Events sent to the browser; the toast rotates through them weighted toward the newest. */
export const PULSE_LIMIT = 40;

/** Fixed "who" labels. Anything else is dropped to the generic label; the store never keeps free text. */
export const PULSE_WHO = ["Health and wellness brand", "Site visitor", "Physio clinic", "Studio", "Agency", "Sleep brand", "Recovery equipment brand", "Pain relief brand", "Supplement distributor", "Beverage brand", "Recovery hardware brand", "Nutrition brand", "Snack bar brand", "Wellness product maker", "Golf club", "Venue", "New physio hub", "New recovery hub", "New Pilates studio", "New physio clinic", "New stretch studio"] as const;

/** Short public label for a category key or label. Unknown or "other" → null (shown as a health and wellness brand). */
export function pulseCategoryLabel(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const v = raw.trim();
  const f = FRIDAY_CATEGORIES.find((c) => c.key === v || c.label === v);
  if (f) return f.label;
  const slug = (x: string) => x.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const m = MEDIA_KIT_CATEGORIES.find((c) => c === v || slug(c) === slug(v));
  return m ?? null;
}

const CA_REGIONS: Record<string, string> = { ON: "Ontario", QC: "Quebec", BC: "British Columbia", AB: "Alberta", MB: "Manitoba", SK: "Saskatchewan", NS: "Nova Scotia", NB: "New Brunswick", NL: "Newfoundland", PE: "PEI", YT: "Yukon", NT: "NWT", NU: "Nunavut" };
/** Coarse region from Vercel's IP geo headers: a Canadian province, or "US". Nothing finer, never the IP. */
export function coarseRegion(get: (h: string) => string | undefined): string | null {
  const c = (get("x-vercel-ip-country") ?? "").toUpperCase();
  if (c === "US") return "US";
  if (c === "CA") return CA_REGIONS[(get("x-vercel-ip-country-region") ?? "").toUpperCase()] ?? "Canada";
  return null;
}

/** Chat topic from the visitor's first message. Only the topic key is stored, never the text. */
export function chatTopic(text: string): PulseAction {
  const t = text.toLowerCase();
  if (/(price|pricing|cost|\$|cpm|rate|budget|how much)/.test(t)) return "chat_pricing";
  if (/(host|my clinic|my studio|my gym|become a hub|publisher|earn)/.test(t)) return "chat_hub";
  if (/(mock|sample|preview|see (my|our) (ad|card))/.test(t)) return "chat_mock";
  if (/(report|utm|track|measure|result)/.test(t)) return "chat_reporting";
  return "chat_question";
}

export type PulseEvent = { action: PulseAction; category: string | null; who?: string | null; region?: string | null; src: string | null; createdAt: Date; srcId?: string | null };
export type PulseStore = { name: "postgres" | "memory"; add(e: PulseEvent): Promise<void>; list(sinceDays: number, limit: number): Promise<PulseEvent[]> };

export function memoryPulseStore(): PulseStore {
  const rows: PulseEvent[] = [];
  return {
    name: "memory",
    async add(e) {
      if (e.srcId && rows.some((r) => r.srcId === e.srcId)) return;
      rows.push(e);
      if (rows.length > 500) rows.splice(0, rows.length - 500);
    },
    async list(sinceDays, limit) {
      const since = Date.now() - sinceDays * 864e5;
      return rows.filter((r) => r.createdAt.getTime() >= since).slice(-limit).reverse();
    },
  };
}

/** Same rule as lib/shareEvents.ts. The DB module loads lazily so routes that import this file work without DATABASE_URL. */
const isProductionRuntime = () => process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production" && process.env.SHARE_EVENTS_STORE === "postgres");
const getDb = async () => (await import("@workspace/db")).db;

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= getDb()
    .then((db) => db.execute(sql`CREATE TABLE IF NOT EXISTS activity_pulse_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL, category text, src text,
      created_at timestamptz NOT NULL DEFAULT now());
      ALTER TABLE activity_pulse_events ADD COLUMN IF NOT EXISTS who text;
      ALTER TABLE activity_pulse_events ADD COLUMN IF NOT EXISTS region text;
      ALTER TABLE activity_pulse_events ADD COLUMN IF NOT EXISTS src_id text;
      CREATE UNIQUE INDEX IF NOT EXISTS activity_pulse_events_src_id_idx ON activity_pulse_events (src_id) WHERE src_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS activity_pulse_events_created_idx ON activity_pulse_events (created_at);`))
    .then(() => undefined)
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

export function postgresPulseStore(): PulseStore {
  return {
    name: "postgres",
    async add(e) {
      await ensureTable();
      const db = await getDb();
      await db.execute(sql`INSERT INTO activity_pulse_events (action, category, who, region, src, src_id, created_at) VALUES (${e.action}, ${e.category}, ${e.who ?? null}, ${e.region ?? null}, ${e.src}, ${e.srcId ?? null}, ${e.createdAt.toISOString()}::timestamptz) ON CONFLICT DO NOTHING`);
    },
    async list(sinceDays, limit) {
      await ensureTable();
      const since = new Date(Date.now() - sinceDays * 864e5).toISOString();
      const db = await getDb();
      const res = await db.execute(sql`SELECT action, category, who, region, src, created_at FROM activity_pulse_events WHERE created_at >= ${since}::timestamptz ORDER BY created_at DESC LIMIT ${limit}`);
      const rows = ((res as unknown as { rows?: unknown[] }).rows ?? (res as unknown as unknown[])) as Array<{ action: string; category: string | null; who: string | null; region: string | null; src: string | null; created_at: string | Date }>;
      return rows
        .filter((r) => r.action in PULSE_ACTIONS)
        .map((r) => ({ action: r.action as PulseAction, category: r.category, who: r.who, region: r.region, src: r.src, createdAt: new Date(r.created_at) }));
    },
  };
}

let store: PulseStore | null = null;
export function pulseStore(): PulseStore {
  store ??= isProductionRuntime() ? postgresPulseStore() : memoryPulseStore();
  return store;
}
export function setPulseStoreForTests(s: PulseStore | null): void {
  store = s;
}

/** Record one real event. Callers pass isTest for QA traffic; it is dropped here. Never throws. */
export const allowedWho = (w: unknown): string | null => (typeof w === "string" && (PULSE_WHO as readonly string[]).includes(w) ? w : null);
export const allowedRegion = (r: unknown): string | null => (typeof r === "string" && (Object.values(CA_REGIONS).includes(r) || r === "US" || r === "Canada") ? r : null);
export const isPulseAction = (a: unknown): a is PulseAction => typeof a === "string" && Object.prototype.hasOwnProperty.call(PULSE_ACTIONS, a);

export async function recordPulse(action: PulseAction, category: unknown, opts: { isTest?: boolean; src?: string | null; who?: string | null; region?: string | null; at?: Date; srcId?: string | null } = {}): Promise<void> {
  if (opts.isTest) return;
  const who = allowedWho(opts.who);
  const region = allowedRegion(opts.region);
  try {
    await pulseStore().add({ action, category: pulseCategoryLabel(category), who, region, src: opts.src ?? null, createdAt: opts.at ?? new Date(), srcId: opts.srcId ?? null });
  } catch {
    /* the pulse is decorative; a failed write never blocks the real request */
  }
}

export function relTime(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.round(d / 7)}w ago`;
  return `${Math.round(d / 30)}mo ago`;
}

export type PulseFeedEvent = { who: string; region: string | null; action: string; ago: string; age_h: number; source: "site" | "inbox"; kind?: "launch" };
export type PulseFeed = { show: boolean; window_days: number; events: PulseFeedEvent[]; counts: { this_week: number; window: number } };

const whoOf = (r: PulseEvent) => r.who ?? (r.category ? `${r.category} brand` : r.action.startsWith("chat_") ? "Site visitor" : "Health and wellness brand");

export function toFeed(rows: Array<PulseEvent & { source?: "site" | "inbox" }>, now = Date.now()): PulseFeed {
  const windowMs = (r: PulseEvent) => (LAUNCH_ACTIONS.has(r.action) ? LAUNCH_WINDOW_DAYS : PULSE_WINDOW_DAYS) * 864e5;
  const inWindow = rows.filter((r) => now - r.createdAt.getTime() <= windowMs(r) && r.createdAt.getTime() <= now).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const counts = { this_week: inWindow.filter((r) => now - r.createdAt.getTime() <= 7 * 864e5).length, window: inWindow.length };
  if (inWindow.length < PULSE_MIN_EVENTS) return { show: false, window_days: PULSE_WINDOW_DAYS, events: [], counts };
  return {
    show: true,
    window_days: PULSE_WINDOW_DAYS,
    counts,
    events: inWindow.slice(0, PULSE_LIMIT).map((r) => ({ who: whoOf(r), region: r.region ?? null, action: PULSE_ACTIONS[r.action], ago: relTime(now - r.createdAt.getTime()), age_h: Math.round((now - r.createdAt.getTime()) / 36e5), source: r.source ?? "site", ...(LAUNCH_ACTIONS.has(r.action) ? { kind: "launch" as const } : {}) })),
  };
}

export async function pulseFeed(now = Date.now()): Promise<PulseFeed> {
  let live: PulseEvent[] = [];
  try {
    live = await pulseStore().list(PULSE_WINDOW_DAYS, 200);
  } catch {
    live = [];
  }
  return toFeed([...live.map((e) => ({ ...e, source: e.src === "instantly" || e.src === "inbox" ? ("inbox" as const) : ("site" as const) })), ...PULSE_SEED.map((e) => ({ ...e, source: "inbox" as const }))], now);
}

/** Themes behind the real events (for the chat's "what are people asking" answer). No counts, no names. */
const THEME_OF: Partial<Record<PulseAction, string>> = {
  hub_hosting: "hosting a hub for their patients or members", provider_agreement: "hosting a hub for their patients or members", hub_members: "who the members inside the hubs are", chat_hub: "hosting a hub for their patients or members",
  samples_coming: "sending samples so we can try products before listing", samples_confirmed: "sending samples so we can try products before listing",
  ask_cpc: "pricing: CPC, CPM and the fee structure", fee_structure: "pricing: CPC, CPM and the fee structure", fees_markets: "pricing: CPC, CPM and the fee structure", chat_pricing: "pricing: CPC, CPM and the fee structure",
  ask_display: "which placements and display surfaces they can use", placements_interest: "which placements and display surfaces they can use", placement_question: "which placements and display surfaces they can use", examples_shared: "which placements and display surfaces they can use", placements_team: "which placements and display surfaces they can use", chat_mock: "seeing a mock of their card on a live hub",
  ask_performance: "how placements perform and what reporting shows", chat_reporting: "how placements perform and what reporting shows",
  how_it_works: "how the program works end to end", program_summary: "how the program works end to end", chat_question: "how the program works end to end",
  call_booked: "booking a quick intro call", canada_shipping: "shipping into Canada", agency_partnership: "agency and media-buying partnerships",
};
export function pulseThemes(rows: Array<Pick<PulseEvent, "action" | "createdAt">>, now = Date.now()): string[] {
  const score = new Map<string, number>();
  for (const r of rows) {
    const t = THEME_OF[r.action];
    if (!t || now - r.createdAt.getTime() > PULSE_WINDOW_DAYS * 864e5) continue;
    score.set(t, (score.get(t) ?? 0) + Math.pow(0.5, (now - r.createdAt.getTime()) / (14 * 864e5)));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
let themeCache: { at: number; themes: string[] } | null = null;
/** Current themes from live events + seed, cached 5 min. Never throws. */
export async function currentPulseThemes(now = Date.now()): Promise<string[]> {
  if (themeCache && now - themeCache.at < 300000) return themeCache.themes;
  let live: PulseEvent[] = [];
  try {
    live = await pulseStore().list(PULSE_WINDOW_DAYS, 200);
  } catch {
    live = [];
  }
  const themes = pulseThemes([...live, ...PULSE_SEED], now);
  themeCache = { at: now, themes };
  return themes;
}
