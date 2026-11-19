/**
 * Prefilled brand-intake links (PREVIEW ONLY, Randy via Emma, Nov 19 2026 12:54 PM ET).
 * Pure helpers, no imports, so node --test can run them directly.
 *
 * Contract: brand-intake v1.4-prefill (read-back GET, field-level merge PATCH; omitted keys kept, null clears) and
 * the Birch notes in /workspace/hub-intake-prefill/BIRCH-CONTRACT.md. Safe on v1.4 AND on the older whole-block PATCH:
 *   - an untouched form never PATCHes (no dirty keys → no request);
 *   - a save sends only the top-level keys the brand changed; each block is sent whole (baseline deep-merged under
 *     the edit), so prefilled sub-fields survive either merge rule;
 *   - a sub-field the brand cleared is sent as an explicit null ("" / [] for profile text and lists), because on
 *     v1.4 leaving it out would keep the old value.
 *
 * Link: /intake/b/<slug>#edit=<base64url {i, e, r, v}>. The slug is the brand's public name only (no people, no
 * emails). The edit token lives in the #fragment: browsers never send it to a server or in a Referer, and the page
 * strips it from the address bar on load. Unguessable (backend-minted), revocable by rotating the edit token,
 * expiry enforced by the backend (410 link_expired).
 */

/** Editable fields the read-back GET returns (BIRCH-CONTRACT.md §2). Everything is optional. */
export type PrefillFields = {
  website?: string;
  company_name?: string;
  roles?: string[];
  category?: string;
  blurb?: string;
  profile?: Record<string, unknown>;
  publisher?: { surfaces?: string[]; monthly_views?: Record<string, number> } & Record<string, unknown>;
  supplier?: Record<string, unknown>;
  sponsor?: Record<string, unknown>;
  calculator?: { avg_cart_usd?: number; orders_per_month?: number; purchases_per_year?: number; margin_band?: string; repeat_band?: string } & Record<string, unknown>;
  geo?: { sells?: string[]; ships?: string[]; regions?: Record<string, string[]>; hub_audience?: unknown } & Record<string, unknown>;
};
export const FIELD_KEYS = ["website", "company_name", "roles", "category", "blurb", "profile", "publisher", "supplier", "sponsor", "calculator", "geo"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
/** Object blocks the backend replaces whole on PATCH. */
export const BLOCK_KEYS: ReadonlySet<FieldKey> = new Set(["profile", "publisher", "supplier", "sponsor", "calculator", "geo"]);

export type PrefillRef = { id: string; editToken: string; reportToken: string; version: number };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
export const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
/** b over a, recursively for plain objects (arrays and scalars in b replace a). */
export function deepMerge<T>(a: T, b: unknown): T {
  if (!isObj(a) || !isObj(b)) return (b === undefined ? a : b) as T;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v === undefined ? out[k] : isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  return out as T;
}

/** Keep only contract keys (the backend body is .strict()). */
export function pickFields(raw: unknown): PrefillFields {
  const out: Record<string, unknown> = {};
  if (!isObj(raw)) return out;
  for (const k of FIELD_KEYS) if (raw[k] !== undefined && raw[k] !== null) out[k] = clone(raw[k]);
  return out as PrefillFields;
}

/** Top-level keys that differ from the baseline (what the brand changed). */
export function dirtyKeys(baseline: PrefillFields, current: PrefillFields): FieldKey[] {
  return FIELD_KEYS.filter((k) => !deepEqual(baseline[k], current[k]));
}

/**
 * The PATCH body for a save: only changed top-level keys; blocks are sent whole (baseline merged under the edit, so
 * a sub-field the form never showed survives). Returns null when nothing changed (never PATCH an untouched form).
 */
export function buildPatch(baseline: PrefillFields, current: PrefillFields): Record<string, unknown> | null {
  const keys = dirtyKeys(baseline, current);
  if (!keys.length) return null;
  const body: Record<string, unknown> = {};
  for (const k of keys) {
    const cur = current[k];
    if (BLOCK_KEYS.has(k)) body[k] = withClears(baseline[k], clone(deepMerge(baseline[k] ?? {}, cur ?? {})), cur, k === "profile");
    else if (cur === undefined) body[k] = k === "roles" ? baseline[k] : k === "category" ? null : ""; // a cleared field is a real edit
    else body[k] = clone(cur);
  }
  return body;
}
/** Leaves present in the baseline but removed in the edit become explicit clears (v1.4: omitted = kept). */
function withClears(base: unknown, merged: unknown, cur: unknown, inProfile: boolean, depth = 0): unknown {
  if (!isObj(base) || !isObj(merged)) return merged;
  const c = isObj(cur) ? cur : {};
  const out: Record<string, unknown> = { ...merged };
  for (const [k, bv] of Object.entries(base)) {
    if (bv === undefined || bv === null) continue;
    if (!(k in c) || c[k] === undefined) out[k] = inProfile && depth === 0 ? (Array.isArray(bv) ? [] : typeof bv === "string" ? "" : null) : null;
    else if (isObj(bv) && isObj(c[k])) out[k] = withClears(bv, out[k], c[k], inProfile, depth + 1);
  }
  return out;
}
/** After a successful save, the sent keys become the new baseline (later saves only send newer edits). */
export function afterSave(baseline: PrefillFields, sent: Record<string, unknown>): PrefillFields {
  const next = clone(baseline);
  for (const k of FIELD_KEYS) if (k in sent) (next as Record<string, unknown>)[k] = clone(sent[k]);
  return next;
}

/* ------------------------------ field paths (marking prefilled vs edited) ------------------------------ */
export function getPath(o: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (isObj(v) ? v[k] : undefined), o);
}
export function setPath<T extends object>(o: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const src = o as Record<string, unknown>;
  if (!rest.length) {
    const out = { ...src };
    if (value === undefined) delete out[head!];
    else out[head!] = value;
    return out as T;
  }
  return { ...src, [head!]: setPath(isObj(src[head!]) ? (src[head!] as object) : {}, rest.join("."), value) } as T;
}
const filled = (v: unknown) => !(v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || (isObj(v) && !Object.keys(v).length));
export type FieldMark = "drafted" | "edited" | "added" | null;
/** "drafted" = we filled it and it's unchanged; "edited" = we filled it and the brand changed it; "added" = brand filled a blank. */
export type PrefillMarkers = { fields: string[]; edited: string[] } | null;
const covers = (keys: string[], path: string) => keys.some((k) => k === path || path.startsWith(`${k}.`) || k.startsWith(`${path}.`));
/**
 * With the backend's markers (v1.4 `prefill.fields` / `prefill.edited`), only keys we drafted and the brand hasn't
 * edited (on the backend or here) say "Drafted". Without markers, any value present at load counts as drafted.
 */
export function fieldMark(initial: PrefillFields, current: PrefillFields, path: string, markers: PrefillMarkers = null): FieldMark {
  const a = getPath(initial, path);
  const b = getPath(current, path);
  const ours = markers ? covers(markers.fields, path) && !covers(markers.edited, path) : true;
  if (filled(a)) return !deepEqual(a, b) ? "edited" : ours ? "drafted" : null;
  return filled(b) ? "added" : null;
}

/* ------------------------------ link ------------------------------ */
const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
export function slugify(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "brand";
}
/** One copy-paste link per brand. Same fragment format as the resume link, so either page can adopt it. */
export function prefillLink(slug: string, ref: PrefillRef, origin = "https://birchreserve.net"): string {
  return `${origin}/intake/b/${encodeURIComponent(slugify(slug))}#edit=${b64u(JSON.stringify({ i: ref.id, e: ref.editToken, r: ref.reportToken, v: ref.version }))}`;
}
export function parsePrefillHash(hash: string): PrefillRef | null {
  const m = /(?:^#|&)edit=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const o = JSON.parse(unb64u(m[1]!)) as { i?: unknown; e?: unknown; r?: unknown; v?: unknown };
    if (typeof o.i !== "string" || typeof o.e !== "string" || typeof o.r !== "string") return null;
    if (![o.i, o.e, o.r].every((s) => /^[\w-]{4,200}$/.test(s as string))) return null;
    return { id: o.i, editToken: o.e, reportToken: o.r, version: Number(o.v) || 0 };
  } catch {
    return null;
  }
}
/** The staff tool's edit_link (…/brand-kit#edit=…) → this brand's /intake/b/<slug> link. Same key, no network. */
export function fromEditLink(editLink: string, slug: string, origin = "https://birchreserve.net"): string | null {
  const i = editLink.indexOf("#");
  const ref = i >= 0 ? parsePrefillHash(editLink.slice(i)) : null;
  return ref ? prefillLink(slug, ref, origin) : null;
}
/** Nothing that looks like a person's contact may ride in the link (path or fragment). */
export function linkHasPii(link: string): boolean {
  return /[^\s@/#]+@[^\s@/#]+\.[a-z]{2,}/i.test(decodeURIComponent(link)) || /\+?\d[\d ().-]{8,}\d/.test(link.split("#")[0]!);
}
