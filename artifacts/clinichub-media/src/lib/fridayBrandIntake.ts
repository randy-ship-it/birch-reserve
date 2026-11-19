/**
 * Thin adapter to Friday App's public brand-intake API, aligned to Friday's contract
 * /workspace/birch-friday-contract/brand-intake-v1.md (brand-intake.v1 / brand-report.v1, DRAFT, Nov 18 2026).
 *
 *   POST  /api/public/brand-intake                 create / first autosave → { ok, id, status, version, editToken, reportToken }
 *   PATCH /api/public/brand-intake/:id             merge changed fields (X-Edit-Token); submit:true → approvals pending_review
 *   POST  /api/public/brand-intake/:id/kit         kit request (X-Edit-Token) → { status: "pending_review" }
 *   POST  /api/public/brand-kit/download           { reportToken, format } → logs kit_download
 *   GET   /api/public/brand-report/:reportToken    202 draft | 200 { report }
 *
 * The browser calls these through Birch's same-origin /v1/* routes (server-to-server to Friday; see adapterMode()).
 * Bodies are .strict() on Friday's side, so toFridayBody() sends ONLY contract keys. UI-only fields are listed in
 * /workspace/br-intake/CONTRACT-GAPS.md. Labelled MOCK when the Birch server has no Friday config: nothing leaves
 * the browser and every screen says so. Nothing is ever auto-accepted.
 */
import { mirrorSource } from "./shareTrack";
import { marketToFridayGeo, marketToGeographyText, splitRegions, type Eligibility, type Market } from "../../../api-server/src/lib/kitCalc/channelGeo";
import { mockExposure, type FridayExposure } from "../../../api-server/src/lib/kitCalc/activation";
import type { IntakePayload, IntakeRole, PubSurfaceKey } from "../../../api-server/src/lib/overhaul/brandIntake";
import { SUPPLIER_CATEGORIES } from "../../../api-server/src/lib/overhaul/brandIntake";
import { mockReport } from "./fridayMockReport";
import { FRIDAY_CATEGORIES, V12_MARGIN, V12_REPEAT, toFridayCategory } from "../../../api-server/src/lib/kitCalc/fridayV12";


export type IntakeRef = { id: string; editToken: string; reportToken: string; version: number; legacy?: boolean; /** Started as a partial lead (email typed, not submitted yet). */ partial?: boolean; /** Friday answered in v1.3 (submit_mode): upgrades PATCH with submit_mode "expanded". */ v13?: boolean };
/** v1.3 §1b auto-fill field: {value, source:"site_autofill", confidence 0–1, evidence}. */
export type AutofillField<T = unknown> = { value: T; source: "site_autofill"; confidence: number; evidence?: string };
export type Autofill = { version?: string; fetched_at?: string; fields: { company_name?: AutofillField<string>; category?: AutofillField<string>; geo?: AutofillField<{ sells?: string[]; ships?: string[] }>; avg_cart_usd?: AutofillField<number>; price_points?: AutofillField<{ currency?: string; count?: number; min?: number; median?: number; max?: number }>; product_types?: AutofillField<string[]> }; needs_input: string[]; notes?: string[]; mock?: boolean };
/** Fast-mode result: v1.3 auto-fill when Friday has it; null when the adapter fell back to v1 + labelled defaults. */
export type FastResult = { ref: IntakeRef; sub: SubmitResult; autofill: Autofill | null; fallback: boolean };
export type IntakeStatus = "draft" | "submitted" | "pending_review" | "approved" | "declined";
/**
 * Review state shown to the submitter (Friday v1.1 §3–4). Friday's hub-partner MATCH results are INTERNAL ONLY:
 * per Friday's contract they are never returned to the submitter or the public payload, and Birch must never
 * render a match badge (the "Linked to an existing hub partner" badge is withheld on purpose). The only
 * submitter-facing state is a generic "In review, pending BR approval" when Friday reports pending_review.
 * Approvals are server-to-server (X-Approver-Email); Birch never calls them and has no approval UI.
 */
export type LeadGates = { review?: "pending_review"; mock?: boolean };
export function reviewGates(res: { status?: string; approvals?: Record<string, string> } | null | undefined, mock?: boolean): LeadGates | null {
  if (!res) return null;
  const pending = res.status === "pending_review" || Object.values(res.approvals ?? {}).includes("pending_review");
  return pending ? { review: "pending_review", mock } : null;
}
export type SubmitResult = { status: IntakeStatus; version: number; approvals: Record<string, string>; report_ready?: boolean; public_mirror?: "published" | "held"; mock?: boolean };
export type ReportView = "brand" | "publisher" | "supplier" | "sponsor";
type LoHi = { low: number; high: number };
/** brand-report.v1 (Friday), only the keys Birch renders. */
export type FridayReport = {
  schema?: string;
  brand?: { name: string; domain?: string; category?: string };
  version: number;
  updated: string;
  roles: string[];
  view?: ReportView;
  status?: { public_mirror?: "published" | "held"; kits_pending?: number };
  ltv?: { label: string; model: string; inputs: Record<string, unknown>; lifetime_years: LoHi & { placeholder?: boolean }; missing: string[]; needs_input: boolean; gp_per_order_usd: LoHi | null; gp_ltv_usd: LoHi | null; monthly_gp_usd: LoHi | null; formula: string };
  demand_fit?: { label: string; channels: Array<{ key: string; name: string; fit: number; fit_label: string; subject_to_human_confirmation: boolean }>; anchor_hubs: Array<{ key: string; name: string; status: string; confirmed_anchor: boolean; fit: number; fit_label: string; reason: string | null; subject_to_human_confirmation: boolean }> };
  /** v1.1 adds geo_label / eligible_now / later_option (+ reason) per tile. */
  channels?: Array<{ key: string; name: string; figures: string[]; figures_label: string; fit: number; fit_label: string; line: string; image: string | null; geo_label?: string; eligible_now?: boolean; later_option?: boolean; reason?: string | null }>;
  placements?: Array<{ key: string; label: string; fit: number; fit_label: string; cpm_usd: LoHi | null; cpc_usd: LoHi | null; needs_rate: boolean }>;
  headline?: { best_fit_cpm_usd?: LoHi; best_fit_cpc_usd?: LoHi };
  role_data?: Record<string, unknown>;
  /** v1.1 (Friday PR #213): geo-scoped markets and the advertiser exposure range. Used when present, else a labelled mock. */
  geo?: { markets?: string[]; markets_stated?: boolean; regions?: Record<string, string[]>; input?: unknown; channel_geo?: Record<string, unknown> };
  exposure?: FridayExposure;
  /** v1.2 §5: Scale-demand revenue opportunity (Estimate) or needs_input with missing[]. No partner names or counts. */
  demand_opportunity?: DemandOpportunity;
  mock?: boolean;
};
export type MinMax = { min: number; max: number };
export type DemandOpportunity = { label?: string; model?: string; basis?: string; needs_input: boolean; missing?: string[]; category?: { key: string; label: string } | null; scale_demand_orders_yr?: number | null; capture_share?: MinMax & { placeholder?: boolean }; annual_usd?: MinMax | null; monthly_usd?: MinMax | null; mock?: boolean };

/** v1.2 §7: Friday returns warnings[] only when it ignored something (e.g. "geo ignored: …"). Shown gently. */
export const WARN_EVENT = "br-intake-warnings";
function emitWarnings(d: unknown) {
  const w = (d as { warnings?: unknown })?.warnings;
  if (typeof window === "undefined" || !Array.isArray(w) || !w.length) return;
  window.dispatchEvent(new CustomEvent(WARN_EVENT, { detail: w.filter((x): x is string => typeof x === "string").slice(0, 5) }));
}
export type { Market };

/** Per-channel eligibility from a v1.1 report (exposure first, then channel tiles); [] on a v1 report. */
export function fridayEligibility(r: FridayReport | null | undefined): Array<{ key: string; eligibility: Eligibility; label?: string; reason?: string | null }> {
  if (!r) return [];
  const ex = r.exposure?.channels ?? [];
  const tiles = (r.channels ?? []).filter((c) => typeof c.eligible_now === "boolean");
  const keys = [...new Set([...ex.map((c) => c.key), ...tiles.map((c) => c.key)])];
  return keys.map((k) => {
    const e = ex.find((c) => c.key === k);
    const t = tiles.find((c) => c.key === k);
    const now = e ? e.eligible_now : !!t?.eligible_now;
    const later = e ? !!e.later : !!t?.later_option;
    return { key: k, eligibility: now ? "now" : later ? "later" : "not_available", label: e?.geo_label ?? t?.geo_label, reason: e?.reason ?? t?.reason ?? null };
  });
}
export type ReportResult = { ready: false } | { ready: true; report: FridayReport };
export type BrandReport = { id: string; version: number; status: IntakeStatus; updated_at: string; roles: string[]; approvals: Record<string, string>; mock?: boolean };
export type SubmitContact = { email: string; website: string; elapsed_ms: number };
export type KitBody = { email: string; placements: string[]; channels: string[]; goals: string[]; note?: string };

/**
 * live: the browser calls Birch's same-origin /v1/brand-intake* routes; the Birch server forwards to Friday with
 *       the intake secret header (routes/brandIntakeProxy.ts). The browser never sees the secret or calls Friday directly.
 * mock: labelled preview mock in this browser. Used when the Birch server says Friday isn't configured
 *       (friday_not_configured / friday_unreachable), on a bare local dev server, or with ?mock=1.
 */
const MOCK_SESSION = "br_intake_adapter_mock_v1";
const MODE_EVENT = "br-intake-adapter-mode";
export function adapterMode(): "mock" | "live" {
  if (typeof window === "undefined") return "mock";
  try {
    if (new URLSearchParams(window.location.search).get("mock") === "1") sessionStorage.setItem(MOCK_SESSION, "1");
    if (sessionStorage.getItem(MOCK_SESSION) === "1") return "mock";
  } catch {
    /* storage blocked */
  }
  return "live";
}
function fallToMock() {
  try {
    sessionStorage.setItem(MOCK_SESSION, "1");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(MODE_EVENT));
}
export function onAdapterModeChange(fn: () => void): () => void {
  window.addEventListener(MODE_EVENT, fn);
  return () => window.removeEventListener(MODE_EVENT, fn);
}

/* ------------------------------ payload → Friday IntakeBody (contract keys only) ------------------------------ */
const SURFACE_KEY: Record<PubSurfaceKey, string> = { newsletter: "newsletter", social: "social", post_purchase: "post_purchase", home: "home", product: "product", services: "services", member_dashboard: "dashboard" };
const ROLE: Record<IntakeRole, string> = { publisher: "publisher", supplier: "supplier", sponsor: "sponsor", kit: "brand" };

const FRIDAY_MARGIN = new Set(["under_20", "20_40", "40_60", "60_plus"]);
export function toFridayBody(p: IntakePayload, extra: Partial<SubmitContact> & { submit?: boolean } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { roles: [...new Set([p.role, ...(p.roles ?? [])].map((r) => ROLE[r]))], company_url: "" };
  if (p.publisher) body.publisher = { surfaces: p.publisher.surfaces.filter((s) => s.on).map((s) => SURFACE_KEY[s.key]) };
  if (p.supplier) {
    const label = (k: string) => SUPPLIER_CATEGORIES.find((c) => c.key === k)?.label ?? k;
    body.supplier = { first_look: Object.fromEntries(p.supplier.categories.map((c) => [label(c.key), c.state])) };
  }
  if (p.sponsor) body.sponsor = { skus: p.sponsor.interest, ...(p.sponsor.category ? { categories: [p.sponsor.category] } : {}), ...(p.sponsor.area ? { area: p.sponsor.area } : {}) };
  if (p.kit_calculator) {
    const k = p.kit_calculator;
    // Contract v1.2 §1–2: Birch margin keys are canonical and repeat_band is accepted. The Birch server downgrades
    // the body for strict v1 (toV1Body: v1 margin alias, no repeat_band/category/geo) until Friday deploys v1.2.
    const margin = (V12_MARGIN as readonly string[]).includes(k.margin_band) || FRIDAY_MARGIN.has(k.margin_band) ? k.margin_band : undefined;
    const repeat = k.repeat_band && (V12_REPEAT as readonly string[]).includes(k.repeat_band) ? k.repeat_band : undefined;
    body.calculator = { avg_cart_usd: k.aov_usd, orders_per_month: k.monthly_orders, purchases_per_year: k.purchases_per_year, ...(margin ? { margin_band: margin } : {}), ...(repeat ? { repeat_band: repeat } : {}) };
    const cat = toFridayCategory(k.category);
    if (cat) body.category = cat; // v1.2 §5–6 shared category key
  }
  if (p.market && (p.market.sells_in.length || p.market.ships_to.length)) {
    // v1.1 `geo` block (v1.2 §7: never a 400; Birch's server drops it for strict v1).
    body.geo = marketToFridayGeo(p.market, p.role === "publisher" ? "publisher" : "advertiser");
    body.profile = { geography: marketToGeographyText(p.market) };
  }
  if (!body.category && p.category) {
    const c = toFridayCategory(p.category);
    if (c) body.category = c; // fast mode: guessed from the site title / meta, or the labelled default
  }
  if (p.kit_calculator?.brand_label) body.company_name = p.kit_calculator.brand_label.slice(0, 120);
  oneFormFields(p, body);
  if (extra.email) body.email = extra.email;
  if (extra.website) body.website = extra.website;
  if (extra.elapsed_ms != null) body.elapsed_ms = extra.elapsed_ms;
  if (extra.submit) body.submit = true;
  return body;
}

/**
 * One-form intake → v1 keys (Randy via Emma, Nov 19 2026 9:34 AM ET). Shared answers are asked once and feed both
 * sides; role detail arrives after the fast submit on the same record. No v1 field → a labelled `blurb` line
 * (aggregate only, no names: the decision maker is a role/title). Gaps: /workspace/br-intake/CONTRACT-GAPS.md §H.
 */
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined);
export function oneFormFields(p: IntakePayload, body: Record<string, unknown>): void {
  const lines: string[] = [];
  const roles = new Set([p.role, ...(p.roles ?? [])]);
  const intent = roles.has("supplier") && roles.has("publisher") ? "supplier + hub" : roles.has("supplier") ? "supplier only (performance-only terms: pay on results, no CPC/CPM)" : roles.has("publisher") ? "hub only" : null;
  if (intent) lines.push(`Intake choice: ${intent}${roles.has("kit") ? " + Accelerate (premium display placements)" : ""}.`);
  if (p.company_name) {
    body.company_name = p.company_name.slice(0, 120);
    lines.push(`Brand: ${p.company_name.slice(0, 120)}.`);
  }
  const profile: Record<string, unknown> = { ...((body.profile as Record<string, unknown>) ?? {}) };
  const sh = p.shared ?? {};
  if (sh.categories?.length) {
    const labels = sh.categories.map((k) => FRIDAY_CATEGORIES.find((c) => c.key === k)?.label ?? k);
    if (!body.category) {
      const c = toFridayCategory(sh.categories[0]!);
      if (c) body.category = c;
    }
    if (roles.has("supplier")) body.supplier = { ...((body.supplier as Record<string, unknown>) ?? {}), first_look: { ...(((body.supplier as Record<string, unknown>)?.first_look as Record<string, string>) ?? {}), ...Object.fromEntries(labels.map((l) => [l, "on"])) } };
    profile.interests = labels.join(", ");
  }
  if (num(sh.skus) != null) lines.push(`Products / SKUs: ${num(sh.skus)}.`);
  const audience: Record<string, number> = {};
  if (num(sh.audience_customers) != null) audience.customers = num(sh.audience_customers)!;
  const h = p.hub;
  const metrics: Record<string, unknown> = {};
  if (h) {
    if (num(h.email_list) != null) audience.emails = num(h.email_list)!;
    if (num(h.web_visitors_month) != null) metrics.web_visitors = { value: num(h.web_visitors_month), period: "per month", source: "hub-reported" };
    if (h.surfaces?.length) body.publisher = { ...((body.publisher as Record<string, unknown>) ?? {}), surfaces: [...new Set([...((((body.publisher as Record<string, unknown>)?.surfaces as string[]) ?? [])), ...h.surfaces])] };
    const hubBits = [
      h.type ? `type ${h.type}` : null,
      num(h.locations) != null ? `${num(h.locations)} locations` : null,
      num(h.foot_traffic_month) != null ? `${num(h.foot_traffic_month)} in-person visits / month` : null,
      num(h.page_views_month) != null ? `${num(h.page_views_month)} page views / month` : null,
      num(h.screens) != null ? `${num(h.screens)} screens / display surfaces` : null,
      h.cities ? `cities: ${h.cities.slice(0, 200)}` : null,
      h.decision_maker_role ? `decision maker role: ${h.decision_maker_role.slice(0, 80)}` : null,
    ].filter(Boolean);
    if (hubBits.length) lines.push(`Hub (hub-reported): ${hubBits.join("; ")}.`);
  }
  if (Object.keys(audience).length) profile.audience = { ...((profile.audience as Record<string, unknown>) ?? {}), ...audience };
  if (Object.keys(metrics).length) profile.reach = { metrics };
  if (Object.keys(profile).length) body.profile = profile;
  const sd = p.supplier_detail;
  if (sd) {
    const calc: Record<string, unknown> = { ...((body.calculator as Record<string, unknown>) ?? {}) };
    if (num(sd.avg_price_usd) != null) calc.avg_cart_usd = num(sd.avg_price_usd);
    if (sd.margin_band && ((V12_MARGIN as readonly string[]).includes(sd.margin_band) || FRIDAY_MARGIN.has(sd.margin_band))) calc.margin_band = sd.margin_band;
    if (Object.keys(calc).length) body.calculator = calc;
    const supBits = [sd.retail_now ? `in retail now: ${sd.retail_now}` : null, sd.ships ? `fulfilment: ${sd.ships}` : null, sd.accelerate_budget ? `Accelerate test budget: ${sd.accelerate_budget}` : null].filter(Boolean);
    if (supBits.length) lines.push(`Supplier: ${supBits.join("; ")}.`);
  }
  for (const n of p.notes ?? []) if (n.trim()) lines.push(n.trim().slice(0, 600));
  if (lines.length) body.blurb = lines.join("\n").slice(0, 6000);
}

/* ------------------------------ mock (preview only) ------------------------------ */
const MOCK_KEY = "br_intake_mock_v1";
type MockRow = BrandReport & { stage?: "abandoned" | "submitted"; public_mirror?: "published" | "held"; editToken: string; reportToken: string; body: Record<string, unknown>; payload: IntakePayload; events: Array<{ type: string; format?: string; at: string }>; kits: KitBody[] };
const rand = (n = 18) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join("");
function mockAll(): Record<string, MockRow> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) || "{}");
  } catch {
    return {};
  }
}
const mockSave = (all: Record<string, MockRow>) => localStorage.setItem(MOCK_KEY, JSON.stringify(all));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mockRow = (ref: IntakeRef) => {
  const all = mockAll();
  const row = all[ref.id];
  if (!row || row.editToken !== ref.editToken) throw new Error("not_found");
  return { all, row };
};

const mock = {
  /** Preview mock of v1.3 fast mode: no site is read. Returns a labelled empty auto-fill with every gap in needs_input. */
  async fast(payload: IntakePayload, contact: SubmitContact): Promise<FastResult> {
    if (!contact.website.trim() || !/@/.test(contact.email)) throw new Error("fast_needs_website_email");
    const ref = await mock.create(payload);
    const sub = await mock.submit(ref, payload, contact);
    return { ref: { ...ref, version: sub.version }, sub, autofill: { fields: {}, needs_input: ["company_name", "category", "geo", "avg_cart_usd"], notes: ["Preview · mock data: your site is not read on the preview."], mock: true }, fallback: false };
  },
  /** Partial lead (valid email typed, not submitted): create once, then update the same record. Tagged abandoned. */
  async partial(prev: IntakeRef | null, payload: IntakePayload, contact: { email: string; website: string }): Promise<IntakeRef> {
    if (!PARTIAL_EMAIL_RE.test(contact.email.trim())) throw new Error("partial_needs_email");
    const ref = prev ?? { ...(await mock.create(payload)), partial: true };
    const { all, row } = mockRow(ref);
    row.payload = payload;
    row.body = { ...row.body, ...toFridayBody(payload, { email: contact.email, website: contact.website }), stage: "partial" };
    row.stage = "abandoned";
    row.updated_at = new Date().toISOString();
    mockSave(all);
    return ref;
  },
  /** Final click after a partial save: submit the SAME record (flips abandoned → submitted). */
  async finishPartial(ref: IntakeRef, payload: IntakePayload, contact: SubmitContact): Promise<FastResult> {
    const sub = await mock.submit(ref, payload, contact);
    return { ref: { ...ref, version: sub.version }, sub, autofill: { fields: {}, needs_input: ["company_name", "category", "geo", "avg_cart_usd"], notes: ["Preview · mock data: your site is not read on the preview."], mock: true }, fallback: false };
  },
  async create(payload: IntakePayload): Promise<IntakeRef> {
    await sleep(120);
    const row: MockRow = { id: `bi_MOCK${rand(8)}`, editToken: `mock-edit-${rand()}`, reportToken: `mock-report-${rand()}`, version: 0, status: "draft", updated_at: new Date().toISOString(), roles: toFridayBody(payload).roles as string[], approvals: {}, body: toFridayBody(payload), payload, events: [], kits: [], mock: true };
    const all = mockAll();
    all[row.id] = row;
    mockSave(all);
    return { id: row.id, editToken: row.editToken, reportToken: row.reportToken, version: row.version };
  },
  async update(ref: IntakeRef, payload: IntakePayload): Promise<IntakeRef> {
    await sleep(80);
    const { all, row } = mockRow(ref);
    row.payload = payload;
    row.body = { ...row.body, ...toFridayBody(payload) };
    row.updated_at = new Date().toISOString();
    mockSave(all);
    return { ...ref, version: row.version };
  },
  async submit(ref: IntakeRef, payload: IntakePayload, contact: SubmitContact): Promise<SubmitResult> {
    await sleep(200);
    if (contact.elapsed_ms < 2500) throw new Error("too_fast");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw new Error("email");
    if (!/\./.test(contact.website)) throw new Error("website");
    const { all, row } = mockRow(ref);
    row.body = { ...row.body, ...toFridayBody(payload, { ...contact, submit: true }) };
    row.version += 1;
    row.status = "submitted";
    if (row.stage) row.stage = "submitted"; // partial lead flips to submitted on the final click
    const key = payload.role === "supplier" ? "supplier_first_look" : payload.role === "sponsor" ? "sponsor_lock" : "kit";
    row.approvals = { ...row.approvals, [key]: "pending_review" }; // never auto-accepted
    row.updated_at = new Date().toISOString();
    // Friday holds the public mirror when the email domain does not match the website domain.
    const held = contact.email.split("@")[1]!.toLowerCase().replace(/^www\./, "") !== contact.website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    row.public_mirror = held ? "held" : "published";
    mockSave(all);
    return { status: row.status, version: row.version, approvals: row.approvals, report_ready: true, public_mirror: row.public_mirror, mock: true };
  },
  async kit(ref: IntakeRef, kit: KitBody): Promise<{ status: "pending_review" }> {
    await sleep(120);
    const { all, row } = mockRow(ref);
    if (row.version < 1) throw new Error("not_submitted");
    row.kits.push(kit);
    row.approvals = { ...row.approvals, kit: "pending_review" };
    mockSave(all);
    return { status: "pending_review" };
  },
  async download(reportToken: string, format: "pdf" | "png"): Promise<void> {
    const all = mockAll();
    const row = Object.values(all).find((r) => r.reportToken === reportToken);
    if (!row) return;
    row.events.push({ type: "kit_download", format, at: new Date().toISOString() });
    mockSave(all);
  },
  async report(reportToken: string): Promise<BrandReport | null> {
    await sleep(80);
    const row = Object.values(mockAll()).find((r) => r.reportToken === reportToken);
    if (!row) return null;
    return { id: row.id, version: row.version, status: row.status, updated_at: row.updated_at, roles: row.roles, approvals: row.approvals, mock: true };
  },
  /** GET brand-report?view=… : 202 until submit, then a MOCK brand-report.v1 (shape per contract, values from the shared module). */
  async reportView(reportToken: string, view: ReportView): Promise<ReportResult | null> {
    await sleep(120);
    const row = Object.values(mockAll()).find((r) => r.reportToken === reportToken);
    if (!row) return null;
    if (row.version < 1) return { ready: false };
    const rep = mockReport(row.payload, row.body, view, row.version, row.updated_at, row.roles, row.public_mirror);
    const m = row.payload.market;
    // v1.1 shape (mock): geo-scoped markets + exposure from Randy's figures with placeholder shares.
    return { ready: true, report: { ...rep, geo: m ? { markets: m.sells_in.filter((c) => m.ships_to.includes(c)), markets_stated: true, regions: splitRegions(m.regions) as Record<string, string[]> | undefined } : { markets: ["CA", "US"], markets_stated: false }, exposure: mockExposure(m) } };
  },
};

/* ------------------------------ live (Friday) ------------------------------ */
async function j<T>(r: Response): Promise<T> {
  const d = (await r.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!r.ok || d.ok === false) throw new Error(d.error ?? `friday_${r.status}`);
  return d;
}
export const PARTIAL_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
/** Served under a mirror host (SCALE-MIRROR.md): tag the record's source (Birch strips it into the blurb). */
const mirrorSrc = (): { src?: string } => (typeof window !== "undefined" && mirrorSource() ? { src: mirrorSource()! } : {});
const H = (ref?: IntakeRef) => ({ "Content-Type": "application/json", ...(ref ? { "X-Edit-Token": ref.editToken } : {}) });
const BIRCH = ""; // same origin: Birch server routes, which forward to Friday server-side
const live = {
  /** v1.3 fast mode: ONE POST with submit_mode "fast" + website + email; Friday auto-fills and submits. */
  async fast(payload: IntakePayload, contact: SubmitContact): Promise<FastResult> {
    const r = await fetch(`${BIRCH}/v1/brand-intake`, { method: "POST", headers: H(), body: JSON.stringify({ ...toFridayBody(payload, { ...contact, submit: true }), submit_mode: "fast" }) });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: string; editToken?: string; reportToken?: string; version?: number; submit_mode?: string; autofill?: Autofill; fallback?: string; status?: IntakeStatus; approvals?: Record<string, string>; public_mirror?: "published" | "held"; report_ready?: boolean };
    if (r.status === 409 && d.error === "fast_unsupported") {
      // Friday not on v1.3 yet: v1 create + submit (still one final click with the email); labelled defaults on screen.
      const ref = await live.create(payload);
      const sub = await live.submit(ref, payload, contact);
      return { ref: { ...ref, version: sub.version }, sub, autofill: null, fallback: true };
    }
    if (!r.ok || d.ok === false) throw new Error(d.error ?? `friday_${r.status}`);
    emitWarnings(d);
    const sub: SubmitResult = { status: d.status ?? "submitted", version: d.version ?? 1, approvals: d.approvals ?? {}, public_mirror: d.public_mirror, report_ready: d.report_ready };
    if (d.fallback === "api_intake") return { ref: { id: "bi_LEGACYLEAD", editToken: "legacy-no-edit-token", reportToken: "legacy-no-report-token", version: 1, legacy: true }, sub, autofill: null, fallback: true };
    if (!d.id || !d.editToken || !d.reportToken) throw new Error("dropped");
    return { ref: { id: d.id, editToken: d.editToken, reportToken: d.reportToken, version: d.version ?? 1, v13: typeof d.submit_mode === "string" }, sub, autofill: d.autofill ?? null, fallback: false };
  },
  /** Partial lead: POST once (stage "partial"; the Birch server requires a valid email), then PATCH the same record. */
  async partial(prev: IntakeRef | null, payload: IntakePayload, contact: { email: string; website: string }): Promise<IntakeRef> {
    if (!PARTIAL_EMAIL_RE.test(contact.email.trim())) throw new Error("partial_needs_email");
    const body = { ...toFridayBody(payload, { email: contact.email.trim(), website: contact.website.trim() || undefined }), stage: "partial", ...mirrorSrc() };
    if (prev) {
      if (prev.legacy) return prev; // v1 not deployed: the partial stays in this browser (legacy guard)
      const d = await j<{ version: number }>(await fetch(`${BIRCH}/v1/brand-intake/${encodeURIComponent(prev.id)}`, { method: "PATCH", headers: H(prev), body: JSON.stringify(body) }));
      return { ...prev, version: d.version ?? prev.version };
    }
    const d = await j<{ id: string; editToken: string; reportToken: string; version: number; fallback?: string }>(await fetch(`${BIRCH}/v1/brand-intake`, { method: "POST", headers: H(), body: JSON.stringify(body) }));
    if (d.fallback === "api_intake") return { id: "bi_LEGACYLEAD", editToken: "legacy-no-edit-token", reportToken: "legacy-no-report-token", version: 0, legacy: true };
    if (!d.id) throw new Error("dropped");
    return { id: d.id, editToken: d.editToken, reportToken: d.reportToken, version: d.version, partial: true };
  },
  async finishPartial(ref: IntakeRef, payload: IntakePayload, contact: SubmitContact): Promise<FastResult> {
    const sub = await live.submit(ref, payload, contact);
    if (ref.legacy) return { ref: { ...ref, version: Math.max(1, sub.version ?? 1) }, sub, autofill: null, fallback: true };
    return { ref: { ...ref, version: sub.version }, sub, autofill: null, fallback: true };
  },
  async create(payload: IntakePayload): Promise<IntakeRef> {
    const d = await j<{ id: string; editToken: string; reportToken: string; version: number; fallback?: string }>(await fetch(`${BIRCH}/v1/brand-intake`, { method: "POST", headers: H(), body: JSON.stringify(toFridayBody(payload)) }));
    emitWarnings(d);
    // brand-intake-v1 not deployed on Friday yet: the Birch server pushed the lead to Friday's /api/intake instead.
    if (d.fallback === "api_intake") return { id: "bi_LEGACYLEAD", editToken: "legacy-no-edit-token", reportToken: "legacy-no-report-token", version: 0, legacy: true }; // version 1 only after the submit push
    if (!d.id) throw new Error("dropped");
    return { id: d.id, editToken: d.editToken, reportToken: d.reportToken, version: d.version };
  },
  async update(ref: IntakeRef, payload: IntakePayload): Promise<IntakeRef> {
    if (ref.legacy) return ref; // v1 not deployed: the draft stays in this browser until submit
    const d = await j<{ version: number }>(await fetch(`${BIRCH}/v1/brand-intake/${encodeURIComponent(ref.id)}`, { method: "PATCH", headers: H(ref), body: JSON.stringify(toFridayBody(payload)) }));
    emitWarnings(d);
    return { ...ref, version: d.version };
  },
  async submit(ref: IntakeRef, payload: IntakePayload, contact: SubmitContact): Promise<SubmitResult> {
    // v1 not deployed: one-shot submit through the Birch server, which pushes the lead to Friday's /api/intake.
    // Already pushed once via the legacy fallback: an expanded-mode update must never create a second /api/intake lead.
    if (ref.legacy && ref.version >= 1) return { status: "submitted", version: ref.version, approvals: {} };
    if (ref.legacy) return j(await fetch(`${BIRCH}/v1/brand-intake`, { method: "POST", headers: H(), body: JSON.stringify({ ...toFridayBody(payload, { ...contact, submit: true }), ...mirrorSrc() }) }));
    // v1.3 §2 upgrade: same record (editToken), submit_mode "expanded" → version N+1, same reportToken and lead.
    const body = { ...toFridayBody(payload, { ...contact, submit: true }), ...(ref.v13 ? { submit_mode: "expanded" } : {}), ...(ref.partial ? { from_partial: true } : {}), ...mirrorSrc() };
    const d = await j<SubmitResult>(await fetch(`${BIRCH}/v1/brand-intake/${encodeURIComponent(ref.id)}`, { method: "PATCH", headers: H(ref), body: JSON.stringify(body) }));
    emitWarnings(d);
    return d;
  },
  async kit(ref: IntakeRef, kit: KitBody): Promise<{ status: "pending_review" }> {
    if (ref.legacy) throw new Error("not_submitted");
    return j(await fetch(`${BIRCH}/v1/brand-intake/${encodeURIComponent(ref.id)}/kit`, { method: "POST", headers: H(ref), body: JSON.stringify(kit) }));
  },
  async download(reportToken: string, format: "pdf" | "png"): Promise<void> {
    if (reportToken.startsWith("legacy-")) return;
    await fetch(`${BIRCH}/v1/brand-kit/download`, { method: "POST", headers: H(), body: JSON.stringify({ reportToken, format }) });
  },
  async report(reportToken: string): Promise<BrandReport | null> {
    const r = await fetch(`${BIRCH}/v1/brand-report/${encodeURIComponent(reportToken)}`, { cache: "no-store" });
    if (r.status === 404) return null;
    const d = await j<{ status?: IntakeStatus; report?: { version: number; updated: string; roles: string[]; status?: { kits_pending?: number } } }>(r);
    if (r.status === 202 || !d.report) return { id: "", version: 0, status: "draft", updated_at: new Date().toISOString(), roles: [], approvals: {} };
    return { id: "", version: d.report.version, status: "submitted", updated_at: d.report.updated, roles: d.report.roles, approvals: {} };
  },
};

Object.assign(live, {
  async reportView(reportToken: string, view: ReportView): Promise<ReportResult | null> {
    if (reportToken.startsWith("legacy-")) return { ready: false };
    const r = await fetch(`${BIRCH}/v1/brand-report/${encodeURIComponent(reportToken)}?view=${view}`, { cache: "no-store", referrerPolicy: "no-referrer" });
    if (r.status === 404) return null;
    if (r.status === 202) return { ready: false };
    const d = await j<{ report: FridayReport }>(r);
    return { ready: true, report: d.report };
  },
});

type Api = typeof mock;
const FALLBACK = new Set(["friday_not_configured", "friday_unreachable", "friday_503"]);
const isMockRef = (x: unknown) => typeof x === "object" && x !== null && String((x as IntakeRef).id ?? "").startsWith("bi_MOCK");
const isMockToken = (x: unknown) => typeof x === "string" && x.startsWith("mock-report-");
/** live with automatic, labelled fallback to the preview mock when the Birch server has no Friday config. */
const hybrid = new Proxy(mock, {
  get(target, prop: keyof Api) {
    return async (...args: unknown[]) => {
      const m = target[prop] as (...a: unknown[]) => Promise<unknown>;
      if (adapterMode() === "mock" || isMockRef(args[0]) || isMockToken(args[0])) return m(...args);
      const l = (live as unknown as Api)[prop] as (...a: unknown[]) => Promise<unknown>;
      try {
        return await l(...args);
      } catch (e) {
        if (!FALLBACK.has((e as Error).message) && !(e instanceof TypeError)) throw e; // TypeError = network down
        fallToMock();
        return m(...args);
      }
    };
  },
}) as Api;
export const fridayIntake = (): Api => hybrid;

/* ------------------------------ local ref (this browser only, never analytics) ------------------------------ */
const REF_KEY = (role: string) => `br_intake_ref_${role}_v1`;
export function loadRef(role: string): IntakeRef | null {
  try {
    return JSON.parse(localStorage.getItem(REF_KEY(role)) || "null");
  } catch {
    return null;
  }
}
export function saveRef(role: string, ref: IntakeRef) {
  localStorage.setItem(REF_KEY(role), JSON.stringify(ref));
}

/** Kit download: capture calculator inputs (create / PATCH `calculator`), then log one kit_download per format. */
export async function captureKitLead(payload: IntakePayload, formats: Array<"pdf" | "png">): Promise<IntakeRef> {
  const api = fridayIntake();
  const prev = loadRef("kit");
  if (!prev) throw new Error("not_submitted"); // never creates a record outside a final submit with email
  const next = await api.update(prev, payload).catch(() => prev);
  saveRef("kit", next);
  for (const f of formats) await api.download(next.reportToken, f).catch(() => undefined);
  return next;
}

/* ------------------------------ resume editing (#edit=…) ------------------------------ */
/** Held-report copy, verbatim from Randy (Nov 18 2026 10:11 PM ET). */
export const HELD_COPY = "Thanks, your kit is in review. We confirm brand ownership before releasing the full report, usually within one business day.";
export const EDIT_TOKEN_WARNING = "Keep this link private. It is the only way back into your draft: we can't recover the edit token, only rotate it.";
const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
/** The fragment never reaches a server (not sent in requests or Referer). */
export function resumeLink(ref: IntakeRef, path = "/brand-kit", origin = typeof window === "undefined" ? "" : window.location.origin): string {
  return `${origin}${path}#edit=${b64u(JSON.stringify({ i: ref.id, e: ref.editToken, r: ref.reportToken, v: ref.version }))}`;
}
export function parseResumeFragment(hash: string): IntakeRef | null {
  const m = /(?:^#|&)edit=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const o = JSON.parse(unb64u(m[1]!)) as { i?: unknown; e?: unknown; r?: unknown; v?: unknown };
    if (typeof o.i !== "string" || typeof o.e !== "string" || typeof o.r !== "string" || !/^[\w-]{4,200}$/.test(o.i + o.e + o.r)) return null;
    return { id: o.i, editToken: o.e, reportToken: o.r, version: Number(o.v) || 0 };
  } catch {
    return null;
  }
}
/** Store a #edit= ref in localStorage and strip it from the address bar. */
export function adoptResumeFragment(role = "kit"): IntakeRef | null {
  if (typeof window === "undefined") return null;
  const ref = parseResumeFragment(window.location.hash);
  if (!ref) return null;
  saveRef(role, ref);
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return ref;
}
export const reportPath = (reportToken: string) => `/kit/r/${encodeURIComponent(reportToken)}`;
