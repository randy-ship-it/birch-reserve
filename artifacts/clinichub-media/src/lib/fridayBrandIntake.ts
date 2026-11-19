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
import type { IntakePayload, IntakeRole, PubSurfaceKey } from "../../../api-server/src/lib/overhaul/brandIntake";
import { SUPPLIER_CATEGORIES } from "../../../api-server/src/lib/overhaul/brandIntake";
import { mockReport } from "./fridayMockReport";


export type IntakeRef = { id: string; editToken: string; reportToken: string; version: number; legacy?: boolean };
export type IntakeStatus = "draft" | "submitted" | "pending_review" | "approved" | "declined";
export type SubmitResult = { status: IntakeStatus; version: number; approvals: Record<string, string>; report_ready?: boolean; public_mirror?: "published" | "held" };
export type ReportView = "brand" | "publisher" | "supplier" | "sponsor";
type LoHi = { low: number; high: number };
/** brand-report.v1 (Friday), only the keys Birch renders. */
export type FridayReport = {
  schema?: string;
  brand?: { name: string; domain?: string };
  version: number;
  updated: string;
  roles: string[];
  view?: ReportView;
  status?: { public_mirror?: "published" | "held"; kits_pending?: number };
  ltv?: { label: string; model: string; inputs: Record<string, unknown>; lifetime_years: LoHi & { placeholder?: boolean }; missing: string[]; needs_input: boolean; gp_per_order_usd: LoHi | null; gp_ltv_usd: LoHi | null; monthly_gp_usd: LoHi | null; formula: string };
  demand_fit?: { label: string; channels: Array<{ key: string; name: string; fit: number; fit_label: string; subject_to_human_confirmation: boolean }>; anchor_hubs: Array<{ key: string; name: string; status: string; confirmed_anchor: boolean; fit: number; fit_label: string; reason: string | null; subject_to_human_confirmation: boolean }> };
  channels?: Array<{ key: string; name: string; figures: string[]; figures_label: string; fit: number; fit_label: string; line: string; image: string | null }>;
  placements?: Array<{ key: string; label: string; fit: number; fit_label: string; cpm_usd: LoHi | null; cpc_usd: LoHi | null; needs_rate: boolean }>;
  headline?: { best_fit_cpm_usd?: LoHi; best_fit_cpc_usd?: LoHi };
  role_data?: Record<string, unknown>;
  mock?: boolean;
};
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
    body.calculator = { avg_cart_usd: k.aov_usd, orders_per_month: k.monthly_orders, purchases_per_year: k.purchases_per_year, margin_band: k.margin_band };
  }
  if (extra.email) body.email = extra.email;
  if (extra.website) body.website = extra.website;
  if (extra.elapsed_ms != null) body.elapsed_ms = extra.elapsed_ms;
  if (extra.submit) body.submit = true;
  return body;
}

/* ------------------------------ mock (preview only) ------------------------------ */
const MOCK_KEY = "br_intake_mock_v1";
type MockRow = BrandReport & { public_mirror?: "published" | "held"; editToken: string; reportToken: string; body: Record<string, unknown>; payload: IntakePayload; events: Array<{ type: string; format?: string; at: string }>; kits: KitBody[] };
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
    const key = payload.role === "supplier" ? "supplier_first_look" : payload.role === "sponsor" ? "sponsor_lock" : "kit";
    row.approvals = { ...row.approvals, [key]: "pending_review" }; // never auto-accepted
    row.updated_at = new Date().toISOString();
    // Friday holds the public mirror when the email domain does not match the website domain.
    const held = contact.email.split("@")[1]!.toLowerCase().replace(/^www\./, "") !== contact.website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    row.public_mirror = held ? "held" : "published";
    mockSave(all);
    return { status: row.status, version: row.version, approvals: row.approvals, report_ready: true, public_mirror: row.public_mirror };
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
    return { ready: true, report: mockReport(row.payload, row.body, view, row.version, row.updated_at, row.roles, row.public_mirror) };
  },
};

/* ------------------------------ live (Friday) ------------------------------ */
async function j<T>(r: Response): Promise<T> {
  const d = (await r.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!r.ok || d.ok === false) throw new Error(d.error ?? `friday_${r.status}`);
  return d;
}
const H = (ref?: IntakeRef) => ({ "Content-Type": "application/json", ...(ref ? { "X-Edit-Token": ref.editToken } : {}) });
const BIRCH = ""; // same origin: Birch server routes, which forward to Friday server-side
const live = {
  async create(payload: IntakePayload): Promise<IntakeRef> {
    const d = await j<{ id: string; editToken: string; reportToken: string; version: number; fallback?: string }>(await fetch(`${BIRCH}/v1/brand-intake`, { method: "POST", headers: H(), body: JSON.stringify(toFridayBody(payload)) }));
    // brand-intake-v1 not deployed on Friday yet: the Birch server pushed the lead to Friday's /api/intake instead.
    if (d.fallback === "api_intake") return { id: "bi_LEGACYLEAD", editToken: "legacy-no-edit-token", reportToken: "legacy-no-report-token", version: 1, legacy: true };
    if (!d.id) throw new Error("dropped");
    return { id: d.id, editToken: d.editToken, reportToken: d.reportToken, version: d.version };
  },
  async update(ref: IntakeRef, payload: IntakePayload): Promise<IntakeRef> {
    const d = await j<{ version: number }>(await fetch(`${BIRCH}/v1/brand-intake/${encodeURIComponent(ref.id)}`, { method: "PATCH", headers: H(ref), body: JSON.stringify(toFridayBody(payload)) }));
    return { ...ref, version: d.version };
  },
  async submit(ref: IntakeRef, payload: IntakePayload, contact: SubmitContact): Promise<SubmitResult> {
    return j(await fetch(`${BIRCH}/v1/brand-intake/${encodeURIComponent(ref.id)}`, { method: "PATCH", headers: H(ref), body: JSON.stringify(toFridayBody(payload, { ...contact, submit: true })) }));
  },
  async kit(ref: IntakeRef, kit: KitBody): Promise<{ status: "pending_review" }> {
    return j(await fetch(`${BIRCH}/v1/brand-intake/${encodeURIComponent(ref.id)}/kit`, { method: "POST", headers: H(ref), body: JSON.stringify(kit) }));
  },
  async download(reportToken: string, format: "pdf" | "png"): Promise<void> {
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
  const next = prev ? await api.update(prev, payload).catch(() => api.create(payload)) : await api.create(payload);
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
