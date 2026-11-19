/**
 * Prefilled brand-intake links: adapter (PREVIEW ONLY). Contract: /workspace/hub-intake-prefill/BIRCH-CONTRACT.md.
 *
 *   GET   /v1/brand-intake/:id          X-Edit-Token (brand or staff link) → read-back: fields, access, can_confirm, can_edit
 *   GET   /v1/brand-intake/:id/preview  X-Edit-Token → "Draft preview · Estimated" report from the saved answers (v1.4 r2 §2)
 *   PATCH /v1/brand-intake/:id          X-Edit-Token → save changed keys (full blocks) + if_version (r3 G3); 200 echoes
 *                                       the merged fields/prefill/rev/link (G5); 409 stale carries the fresh ones;
 *                                       submit:true = brand confirm (version, public_mirror: G6)
 *   GET   /v1/brand-report/:reportToken ?view=      → recalibrated report after confirm
 *
 * Birch's same-origin /v1/* routes forward server-to-server (the browser never holds the backend secret).
 * Mock: ?mock=1 (or a session already in mock) → everything stays in this browser's localStorage. Unlike the main
 * intake adapter, a live failure NEVER falls back to mock here: a real brand link must not silently go local.
 */
import { adapterMode, type FridayReport, type ReportView, type SubmitResult } from "./fridayBrandIntake";
import { mockReport } from "./fridayMockReport";
import type { IntakePayload } from "../../../api-server/src/lib/overhaul/brandIntake";
import { afterSave, clone, deepMerge, leafPaths, pickFields, slugify, type PrefillFields, type PrefillMarkers, type PrefillRef } from "./prefillDraft";

export type LinkAccess = "brand" | "staff";
/** rev = save revision (sent back as if_version, r3 G3), NOT the report version. contract = X-Brand-Intake-Contract. */
export type DraftMeta = { access: LinkAccess; can_confirm: boolean; can_edit: boolean; status: "draft" | "submitted" | "pending_review" | "approved" | "declined"; version: number; rev: number | null; saved_at: string; prefilled_by: "staff" | null; expires_at: string | null; markers: PrefillMarkers; email_on_file: boolean; email_hint: string | null; confirmed_at: string | null; contract: string | null; mock?: boolean };
export type DraftRead = { fields: PrefillFields; meta: DraftMeta };
/** PATCH 200 (r3 G5): the merged result, so the page re-baselines without another read. */
export type SaveResult = { fields: PrefillFields | null; markers: PrefillMarkers | undefined; rev: number | null; saved_at: string; expires_at: string | null | undefined; status?: DraftMeta["status"]; version?: number };
export type ConfirmResult = SubmitResult & { rev?: number | null; fields?: PrefillFields | null; markers?: PrefillMarkers };
/** Read-back failures the page explains in plain words. */
export type PrefillError = "not_found" | "link_expired" | "link_replaced" | "link_revoked" | "unavailable" | "rate_limited" | "individual_data" | "email" | "website" | "too_fast" | "invalid" | "confirm_needs_email" | "brand_token_required" | "staff_edit_closed" | "brand_contact_only" | "needs_website" | "stale";
const KNOWN = new Set<PrefillError>(["not_found", "link_expired", "link_replaced", "link_revoked", "unavailable", "rate_limited", "individual_data", "email", "website", "too_fast", "invalid", "confirm_needs_email", "brand_token_required", "staff_edit_closed", "brand_contact_only", "needs_website", "stale"]);
const errOf = (code: unknown): PrefillError => (KNOWN.has(code as PrefillError) ? (code as PrefillError) : "unavailable");
/** Fresh state carried by a 409 stale (r3 G3): nothing was written. */
export type StaleData = { fields: PrefillFields; markers: PrefillMarkers | undefined; rev: number | null; saved_at: string; expires_at: string | null | undefined };
/** A failed call: `message` is the code; 429 carries Retry-After in seconds (G9); 409 stale carries the fresh state. */
export class PrefillFail extends Error {
  constructor(public code: PrefillError, public retryAfter?: number, public stale?: StaleData) {
    super(code);
  }
}
/** Retry-After as seconds (delta or HTTP date), clamped to 1–300; 30 when missing or unreadable. */
export function retryAfterSeconds(h: string | null | undefined, now = Date.now()): number {
  const v = (h ?? "").trim();
  let n = /^\d+$/.test(v) ? Number(v) : v ? Math.ceil((Date.parse(v) - now) / 1000) : NaN;
  if (!Number.isFinite(n)) n = 30;
  return Math.min(300, Math.max(1, n));
}
const markersOf = (p: unknown): PrefillMarkers | undefined => {
  if (p === null) return null;
  if (!p || typeof p !== "object") return undefined;
  const o = p as { fields?: unknown; edited?: unknown };
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { fields: strs(o.fields), edited: strs(o.edited) };
};
const revOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
/** email may be blank when the backend already has one on file (v1.4 §4). */
export type Contact = { email: string; website: string; elapsed_ms: number };

/* ------------------------------ report (shared by draft estimate + mock confirm) ------------------------------ */
const SURF_BACK: Record<string, string> = { dashboard: "member_dashboard" };
const DEFAULT_SURFACES = ["post_purchase", "home", "product", "dashboard", "newsletter"];
/** Report computed in the browser from the draft (labelled Estimate). Same shared calculator as the main intake. */
export function draftReport(f: PrefillFields, o: { version?: number; mock?: boolean } = {}): FridayReport {
  const roles = (f.roles?.length ? f.roles : ["supplier", "publisher"]).filter((r) => r !== "brand");
  const name = f.company_name?.trim() || (f.website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "Your brand";
  const surfaces = (f.publisher?.surfaces?.length ? f.publisher.surfaces : DEFAULT_SURFACES).map((k) => ({ key: SURF_BACK[k] ?? k, on: true }));
  const payload = { kit_calculator: { brand_label: name, category: f.category ?? "recovery_devices" }, publisher: { mode: "display", size_x: 1, conversion_pct: 1, value_per_conversion_usd: 0, surfaces } } as unknown as IntakePayload;
  const c = f.calculator ?? {};
  const body = { calculator: { avg_cart_usd: c.avg_cart_usd ?? 80, orders_per_month: c.orders_per_month ?? 500, purchases_per_year: c.purchases_per_year ?? 2, margin_band: c.margin_band ?? "30_50" } };
  const domain = (f.website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || undefined;
  const view: ReportView = roles.includes("publisher") ? "publisher" : "brand";
  const r = mockReport(payload, body, view, o.version ?? 1, new Date().toISOString(), roles, undefined, { domain, category: f.category });
  r.brand = { name, domain, category: f.category };
  const unmock = (s: string) => s.replace(/\s*\(mock\)/g, "");
  if (r.demand_fit) {
    r.demand_fit.channels = r.demand_fit.channels.map((x) => ({ ...x, fit_label: unmock(x.fit_label) }));
    r.demand_fit.anchor_hubs = r.demand_fit.anchor_hubs.map((h) => ({ ...h, fit_label: unmock(h.fit_label) }));
  }
  r.mock = !!o.mock;
  return r;
}

/* ------------------------------ mock (this browser only) ------------------------------ */
const MOCK_KEY = "br_prefill_mock_v1";
type MockRow = { editToken: string; staffToken: string; replaced: string[]; reportToken: string; slug: string; fields: PrefillFields; meta: DraftMeta; patches: Array<Record<string, unknown>>; revoked?: boolean; limited?: number };
const rand = (n = 24) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join("");
const rows = (): Record<string, MockRow> => {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) || "{}");
  } catch {
    return {};
  }
};
const saveRows = (r: Record<string, MockRow>) => localStorage.setItem(MOCK_KEY, JSON.stringify(r));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Preview fixtures: a staff draft as the backend would hold it. Brand-level, public info only. */
export const MOCK_FIXTURES: Record<string, PrefillFields> = {
  "northline-recovery": {
    company_name: "Northline Recovery",
    website: "northlinerecovery.example",
    roles: ["supplier", "publisher"],
    category: "recovery_devices",
    geo: { sells: ["CA", "US"], ships: ["CA", "US"] },
    calculator: { avg_cart_usd: 120, orders_per_month: 1800, purchases_per_year: 2, margin_band: "50_70" },
    publisher: { surfaces: ["post_purchase", "home", "product"] },
    profile: { geography: "Canada + USA", interests: "Recovery Devices", reach: { metrics: { web_visitors: { value: 45000, period: "per month", source: "staff-estimate" } } } },
    blurb: "Active adults and physio patients buying at-home recovery tools (massage guns, compression).",
  },
};
const FALLBACK_FIXTURE = (slug: string): PrefillFields => ({ ...clone(MOCK_FIXTURES["northline-recovery"]!), company_name: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), website: `${slug}.example` });

export type MockState = "ok" | "staff" | "expired" | "revoked" | "replaced" | "invalid" | "busy";
/**
 * Preview only: create the staff draft for a slug in this browser and return a link ref, as Friday's staff page
 * (/birch/prefill-links) would hand it out. "staff" = the staff link (edits, can't confirm); "replaced" = a brand
 * link that was re-issued (rotate), so the old key no longer opens anything.
 */
export function seedMockDraft(slug: string, state: MockState = "ok"): PrefillRef {
  const all = rows();
  const s = slugify(slug);
  const existing = Object.entries(all).find(([, r]) => r.slug === s);
  if (existing && (state === "ok" || state === "staff") && !existing[1].revoked && !existing[1].limited && !existing[1].meta.expires_at?.startsWith("2000")) {
    const [id, r] = existing;
    return { id, editToken: state === "staff" ? r.staffToken : r.editToken, reportToken: r.reportToken, version: r.meta.version };
  }
  const id = `bi_MOCK${rand(10)}`;
  const row: MockRow = { editToken: `mock-edit-${rand()}`, staffToken: `mock-staff-${rand()}`, replaced: [], reportToken: `mock-report-${rand()}`, slug: s, fields: clone(MOCK_FIXTURES[s] ?? FALLBACK_FIXTURE(s)), meta: { access: "brand", can_confirm: true, can_edit: true, status: "draft", version: 0, rev: 1, saved_at: new Date().toISOString(), prefilled_by: "staff", expires_at: state === "expired" ? "2000-01-01T00:00:00.000Z" : new Date(Date.now() + 30 * 864e5).toISOString(), markers: { fields: leafPaths(MOCK_FIXTURES[s] ?? FALLBACK_FIXTURE(s)), edited: [] }, email_on_file: false, email_hint: null, confirmed_at: null, contract: "1.4-prefill", mock: true }, patches: [], revoked: state === "revoked", limited: state === "busy" ? 1 : 0 };
  all[id] = row;
  saveRows(all);
  if (state === "replaced") return { id, editToken: mockRotate(id, "brand")!, reportToken: row.reportToken, version: 0 };
  if (state === "invalid") return { id, editToken: `mock-edit-${rand()}`, reportToken: row.reportToken, version: 0 };
  return { id, editToken: state === "staff" ? row.staffToken : row.editToken, reportToken: row.reportToken, version: 0 };
}
/** Preview only: mock of POST /api/birch/brand-intakes/:id/rotate. Returns the OLD token (now dead), for QA. */
export function mockRotate(id: string, which: "brand" | "staff"): string | null {
  const all = rows();
  const r = all[id];
  if (!r) return null;
  const old = which === "brand" ? r.editToken : r.staffToken;
  r.replaced.push(old);
  if (which === "brand") r.editToken = `mock-edit-${rand()}`;
  else r.staffToken = `mock-staff-${rand()}`;
  saveRows(all);
  return old;
}
/** Preview only: another tab (e.g. the staff link) saves this draft, so this tab's next PATCH gets 409 stale. */
export function mockEditElsewhere(id: string, body: Record<string, unknown>) {
  const all = rows();
  const r = all[id];
  if (!r) return;
  r.fields = mergeV14(r.fields, body);
  r.meta.rev = (r.meta.rev ?? 0) + 1;
  r.meta.markers = { fields: [...new Set([...(r.meta.markers?.fields ?? []), ...leafPaths(pickFields(body))])], edited: r.meta.markers?.edited ?? [] };
  r.meta.saved_at = new Date().toISOString();
  saveRows(all);
}
/** Preview only: what the mock backend received (tests read this to prove saves never wipe fields). */
export function mockPatches(id: string): Array<Record<string, unknown>> {
  return rows()[id]?.patches ?? [];
}
function mockRow(ref: PrefillRef): { all: Record<string, MockRow>; row: MockRow; access: LinkAccess } {
  const all = rows();
  const row = all[ref.id];
  // r3 G1: a rotated key answers 410 link_replaced; an unknown key stays 404 (invalid, no enumeration).
  if (row?.replaced.includes(ref.editToken)) throw new PrefillFail("link_replaced");
  if (!row || (row.editToken !== ref.editToken && row.staffToken !== ref.editToken)) throw new PrefillFail("not_found");
  const access: LinkAccess = row.staffToken === ref.editToken ? "staff" : "brand";
  if (row.revoked) throw new PrefillFail("link_revoked");
  if (row.meta.expires_at && Date.parse(row.meta.expires_at) < Date.now()) throw new PrefillFail("link_expired");
  // QA only (mockstate=busy): the first call gets 429 with Retry-After: 2 (G9).
  if (row.limited && row.limited > 0) {
    row.limited -= 1;
    saveRows(all);
    throw new PrefillFail("rate_limited", 2);
  }
  return { all, row, access };
}
const permsOf = (row: MockRow, access: LinkAccess) => ({ access, can_confirm: access === "brand", can_edit: access === "brand" || row.meta.status === "draft" });
/** Mock of v1.4 §2 field-level merge (simplified: objects merge per key, arrays/scalars replace, null clears). */
function mergeV14(row: PrefillFields, body: Record<string, unknown>): PrefillFields {
  const merge = (a: unknown, b: unknown): unknown => {
    if (b === null) return undefined;
    if (typeof b !== "object" || Array.isArray(b) || typeof a !== "object" || a === null || Array.isArray(a)) return clone(b);
    const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) {
      const m = merge(out[k], v);
      if (m === undefined) delete out[k];
      else out[k] = m;
    }
    return out;
  };
  return pickFields(merge(row, body));
}
const mock = {
  async get(ref: PrefillRef): Promise<DraftRead> {
    await sleep(60);
    const { row, access } = mockRow(ref);
    localStorage.setItem("br_prefill_mock_reads", String(Number(localStorage.getItem("br_prefill_mock_reads") || 0) + 1)); // QA: proves no re-read after saves
    return { fields: clone(row.fields), meta: { ...row.meta, ...permsOf(row, access) } };
  },
  /** v1.4 semantics: field-level merge, omitted keys kept, null clears. r3: if_version → 409 stale; 200 echoes. */
  async save(ref: PrefillRef, body: Record<string, unknown>, ifVersion?: number | null): Promise<SaveResult> {
    await sleep(60);
    const { all, row, access } = mockRow(ref);
    if (access === "staff" && row.meta.status !== "draft") throw new PrefillFail("staff_edit_closed");
    if (typeof ifVersion === "number" && ifVersion !== row.meta.rev) throw new PrefillFail("stale", undefined, { fields: clone(row.fields), markers: clone(row.meta.markers), rev: row.meta.rev, saved_at: row.meta.saved_at, expires_at: row.meta.expires_at });
    row.patches.push(clone(typeof ifVersion === "number" ? { ...body, if_version: ifVersion } : body));
    row.fields = mergeV14(row.fields, body);
    // r2/r3: "edited" counts brand-link edits only (dotted leaf paths); staff-link edits add to the drafted fields.
    const keys = leafPaths(pickFields(body));
    row.meta.markers = access === "brand" ? { fields: row.meta.markers?.fields ?? [], edited: [...new Set([...(row.meta.markers?.edited ?? []), ...keys])] } : { fields: [...new Set([...(row.meta.markers?.fields ?? []), ...keys])], edited: row.meta.markers?.edited ?? [] };
    row.meta.saved_at = new Date().toISOString();
    row.meta.rev = (row.meta.rev ?? 0) + 1;
    saveRows(all);
    return { fields: clone(row.fields), markers: clone(row.meta.markers), rev: row.meta.rev, saved_at: row.meta.saved_at, expires_at: row.meta.expires_at, status: row.meta.status, version: row.meta.version };
  },
  async confirm(ref: PrefillRef, body: Record<string, unknown>, contact: Contact, ifVersion?: number | null): Promise<ConfirmResult> {
    await sleep(160);
    if (contact.elapsed_ms < 2500) throw new Error("too_fast");
    const { all, row, access } = mockRow(ref);
    if (access !== "brand") throw new PrefillFail("brand_token_required");
    if (typeof ifVersion === "number" && ifVersion !== row.meta.rev) throw new PrefillFail("stale", undefined, { fields: clone(row.fields), markers: clone(row.meta.markers), rev: row.meta.rev, saved_at: row.meta.saved_at, expires_at: row.meta.expires_at });
    const email = contact.email.trim() || (row.meta.email_on_file ? ((row as MockRow & { email?: string }).email ?? "") : "");
    if (!email) throw new Error("confirm_needs_email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("email");
    if (!/\./.test(contact.website)) throw new Error("website");
    row.patches.push(clone({ ...body, submit: true, ...(contact.email.trim() ? { email: contact.email.trim() } : {}), website: contact.website, elapsed_ms: contact.elapsed_ms }));
    row.fields = { ...mergeV14(row.fields, body), website: contact.website };
    (row as MockRow & { email?: string }).email = email;
    const now = new Date().toISOString();
    // r3: once the brand confirms, their link stops expiring.
    row.meta = { ...row.meta, status: "submitted", version: row.meta.version + 1, rev: (row.meta.rev ?? 0) + 1, saved_at: now, expires_at: null, email_on_file: true, email_hint: `${email[0]}•••@${email.split("@")[1]}`, confirmed_at: row.meta.confirmed_at ?? now };
    saveRows(all);
    const host = contact.website.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    return { status: "submitted", version: row.meta.version, approvals: { kit: "pending_review" }, report_ready: true, public_mirror: email.split("@")[1]!.toLowerCase() === host ? "published" : "held", mock: true, rev: row.meta.rev, fields: clone(row.fields), markers: clone(row.meta.markers) };
  },
  /** Mock of GET …/:id/preview: from the SAVED answers, no fit adjectives, version null, labelled. Saves nothing. */
  async preview(ref: PrefillRef, _view?: ReportView): Promise<FridayReport> {
    await sleep(60);
    const { row } = mockRow(ref);
    if (!row.fields.website) throw new PrefillFail("needs_website");
    return asPreview(draftReport(row.fields, { mock: true }));
  },
  async report(ref: PrefillRef): Promise<FridayReport | null> {
    await sleep(80);
    const { row } = mockRow(ref);
    if (row.meta.status === "draft") return null;
    return draftReport(row.fields, { version: row.meta.version, mock: true });
  },
};

export const PREVIEW_LABEL = "Draft preview · Estimated";
/** Friday's preview rules (§2), applied to the local/mock stand-in too: no fit adjectives, draft flags. */
export function asPreview(r: FridayReport): FridayReport {
  const out = clone(r) as FridayReport & { draft?: boolean; basis?: string; label?: string };
  if (out.demand_fit) {
    out.demand_fit.channels = out.demand_fit.channels.map((c) => ({ ...c, fit_label: "" }));
    out.demand_fit.anchor_hubs = out.demand_fit.anchor_hubs.map((h) => ({ ...h, fit_label: "" }));
  }
  out.channels = out.channels?.map((c) => ({ ...c, fit_label: "" }));
  out.placements = out.placements?.map((p) => ({ ...p, fit_label: "" }));
  delete out.status;
  return { ...out, draft: true, basis: "estimated", label: PREVIEW_LABEL } as FridayReport;
}

/* ------------------------------ live (same-origin Birch routes) ------------------------------ */
const H = (ref: PrefillRef) => ({ "Content-Type": "application/json", "X-Edit-Token": ref.editToken });
async function j<T>(r: Response): Promise<T> {
  const d = (await r.json().catch(() => ({}))) as { error?: string } & T;
  if (r.ok) return d;
  if (r.status === 429) throw new PrefillFail("rate_limited", retryAfterSeconds(r.headers.get("retry-after")));
  if (r.status === 503) throw new PrefillFail("unavailable");
  const code = errOf(d.error);
  if (code === "stale") {
    const x = d as unknown as { fields?: unknown; prefill?: unknown; rev?: unknown; saved_at?: string; link?: { expires_at?: string | null } };
    throw new PrefillFail("stale", undefined, { fields: pickFields(x.fields), markers: markersOf(x.prefill), rev: revOf(x.rev), saved_at: x.saved_at ?? new Date().toISOString(), expires_at: x.link?.expires_at });
  }
  throw new PrefillFail(code);
}
/** r3 G3: if_version only when the backend says it understands it (strict bodies reject unknown keys). */
const withRev = (body: Record<string, unknown>, ifVersion: number | null | undefined) => (typeof ifVersion === "number" ? { ...body, if_version: ifVersion } : body);
const echoOf = (d: { fields?: unknown; prefill?: unknown; rev?: unknown; saved_at?: string; link?: { expires_at?: string | null }; status?: DraftMeta["status"]; version?: number }): SaveResult => ({
  fields: d.fields && typeof d.fields === "object" ? pickFields(d.fields) : null,
  markers: markersOf(d.prefill),
  rev: revOf(d.rev),
  saved_at: d.saved_at ?? new Date().toISOString(),
  expires_at: d.link ? (d.link.expires_at ?? null) : undefined,
  status: d.status,
  version: typeof d.version === "number" ? d.version : undefined,
});
const live = {
  async get(ref: PrefillRef): Promise<DraftRead> {
    const r = await fetch(`/v1/brand-intake/${encodeURIComponent(ref.id)}`, { headers: H(ref), cache: "no-store", referrerPolicy: "no-referrer" });
    // v1.4 §1 read-back (r3: rev, link.expires_at; X-Brand-Intake-Contract header = G7 capability).
    const d = await j<{ fields?: unknown; status?: DraftMeta["status"]; version?: number; rev?: unknown; saved_at?: string; access?: string; can_confirm?: boolean; can_edit?: boolean; email_on_file?: boolean; email_hint?: string | null; prefill?: { by?: string; fields?: unknown; edited?: unknown; confirmed_at?: string | null } | null; link?: { expires_at?: string | null } }>(r);
    const p = d.prefill ?? null;
    const contract = r.headers.get("x-brand-intake-contract");
    // Missing permission flags fail closed: no Confirm unless the backend says this is the brand link.
    const access: LinkAccess = d.access === "brand" ? "brand" : "staff";
    return { fields: pickFields(d.fields), meta: { access, can_confirm: access === "brand" && d.can_confirm === true, can_edit: d.can_edit !== false, status: d.status ?? "draft", version: Number(d.version) || 0, rev: /^1\.4/.test(contract ?? "") ? revOf(d.rev) : null, saved_at: d.saved_at ?? new Date().toISOString(), prefilled_by: p?.by === "staff" ? "staff" : null, expires_at: d.link?.expires_at ?? null, markers: markersOf(p) ?? null, email_on_file: !!d.email_on_file, email_hint: typeof d.email_hint === "string" ? d.email_hint : null, confirmed_at: p?.confirmed_at ?? null, contract } };
  },
  async save(ref: PrefillRef, body: Record<string, unknown>, ifVersion?: number | null): Promise<SaveResult> {
    const r = await fetch(`/v1/brand-intake/${encodeURIComponent(ref.id)}`, { method: "PATCH", headers: H(ref), body: JSON.stringify(withRev(body, ifVersion)), referrerPolicy: "no-referrer" });
    return echoOf(await j<Parameters<typeof echoOf>[0]>(r));
  },
  async confirm(ref: PrefillRef, body: Record<string, unknown>, contact: Contact, ifVersion?: number | null): Promise<ConfirmResult> {
    const r = await fetch(`/v1/brand-intake/${encodeURIComponent(ref.id)}`, { method: "PATCH", headers: H(ref), body: JSON.stringify(withRev({ ...body, ...(contact.email.trim() ? { email: contact.email.trim() } : {}), website: contact.website, elapsed_ms: contact.elapsed_ms, submit: true }, ifVersion)), referrerPolicy: "no-referrer" });
    // r3 G6: version (N) and public_mirror ("held" | "published") are read from the confirm response.
    const d = await j<SubmitResult & Parameters<typeof echoOf>[0]>(r);
    const e = echoOf(d);
    return { ...d, version: Number(d.version) || 0, public_mirror: d.public_mirror === "published" ? "published" : "held", rev: e.rev, fields: e.fields, markers: e.markers };
  },
  async preview(ref: PrefillRef, view: ReportView): Promise<FridayReport> {
    const r = await fetch(`/v1/brand-intake/${encodeURIComponent(ref.id)}/preview?view=${view}`, { headers: H(ref), cache: "no-store", referrerPolicy: "no-referrer" });
    const d = await j<{ preview?: FridayReport }>(r);
    if (!d.preview) throw new Error("unavailable");
    return { ...d.preview, label: PREVIEW_LABEL } as FridayReport;
  },
  async report(ref: PrefillRef, view: ReportView): Promise<FridayReport | null> {
    const r = await fetch(`/v1/brand-report/${encodeURIComponent(ref.reportToken)}?view=${view}`, { cache: "no-store", referrerPolicy: "no-referrer" });
    if (r.status === 202 || r.status === 404) return null;
    return (await j<{ report: FridayReport }>(r)).report;
  },
};

export const prefillMode = (): "mock" | "live" => adapterMode();
export const prefillApi = () => (prefillMode() === "mock" ? mock : live);

/* ------------------------------ link ref (this browser only, never analytics) ------------------------------ */
const REF_KEY = (slug: string) => `br_prefill_ref_${slugify(slug)}_v1`;
export const EARLY_HASH_KEY = "br_prefill_hash_v1";
export function loadPrefillRef(slug: string): PrefillRef | null {
  try {
    return JSON.parse(localStorage.getItem(REF_KEY(slug)) || "null");
  } catch {
    return null;
  }
}
export function savePrefillRef(slug: string, ref: PrefillRef) {
  try {
    localStorage.setItem(REF_KEY(slug), JSON.stringify(ref));
  } catch {
    /* storage blocked: the link still works this visit */
  }
}
export function forgetPrefillRef(slug: string) {
  try {
    localStorage.removeItem(REF_KEY(slug));
  } catch {
    /* ignore */
  }
}
/** The #edit= fragment, captured before analytics runs (index.html stashes it) or read from the address bar. */
export function takeEarlyHash(): string {
  if (typeof window === "undefined") return "";
  let h = "";
  try {
    h = sessionStorage.getItem(EARLY_HASH_KEY) ?? "";
    sessionStorage.removeItem(EARLY_HASH_KEY);
  } catch {
    /* ignore */
  }
  if (!h && /(?:^#|&)edit=/.test(window.location.hash)) h = window.location.hash;
  if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  return h;
}
export { afterSave, deepMerge };
