/**
 * Brand intake → Friday CRM, server-to-server (Randy, Nov 18 2026 10:23 PM ET: "every submission must create a
 * lead in Friday CRM through the brand-intake-v1 POST, server-side, X-Intake-Secret").
 *
 * The browser only ever talks to these same-origin Birch routes. Birch forwards to Friday's brand-intake-v1
 * endpoints with the intake secret in the X-Intake-Secret header (plus X-Org-Id: birchreserve). The secret is
 * read from env on the server, never logged, never returned and never shipped in the client bundle.
 *
 *   POST  /v1/brand-intake                 → POST  {FRIDAY}/api/public/brand-intake          (creates the lead)
 *   PATCH /v1/brand-intake/:id             → PATCH {FRIDAY}/api/public/brand-intake/:id      (X-Edit-Token passthrough)
 *   POST  /v1/brand-intake/:id/kit         → POST  {FRIDAY}/api/public/brand-intake/:id/kit
 *   POST  /v1/brand-kit/download           → POST  {FRIDAY}/api/public/brand-kit/download
 *   GET   /v1/brand-report/:token?view=    → GET   {FRIDAY}/api/public/brand-report/:token?view=
 *
 * Env (existing Birch names, same secret as the /api/intake push):
 *   FRIDAY_API_URL   e.g. https://fridayapp.org
 *   FRIDAY_API_KEY   the Friday deploy's INTAKE_WEBHOOK_SECRET value
 *   FRIDAY_WORKSPACE Friday org id (default "birchreserve")
 * Unset → 503 {error:"friday_not_configured"}; the client then uses its labelled preview mock.
 *
 * Belt and braces: if Friday answers 404 on the v1 create route (brand-intake-v1 not deployed yet), a SUBMISSION
 * (submit:true + email) is pushed to Friday's existing POST /api/intake (lib/overhaul/fridayIntake.ts) so the lead
 * still lands. Drafts without contact details are never pushed (the client keeps them locally).
 */
import { onIntakeSubmitted } from "../lib/adserver/promo";
import { promoCtxOf } from "../lib/adserver/promoContext";
import { Router, json, text, type Request, type Response } from "express";
import { MIRROR_ORIGIN_HOSTS } from "../middlewares/mirrorHost";
import { sendIntake } from "../lib/overhaul/fridayIntake";
import { coarseRegion, recordPulse } from "../lib/activityPulse";
import { hasValidQaHeader, isSyntheticIntake, isTestIdentity } from "../lib/testTraffic";
import { sendSalesAlert, type SalesAlertResult } from "../lib/salesAlert";
import { FRIENDLY_429, limiter } from "../lib/rateLimit";
import { isIP } from "node:net";
import { visitorDayHash } from "../lib/siteAnalytics";
import { FRIDAY_CATEGORIES, toV1Body } from "../lib/kitCalc/fridayV12";
import { NEVER_HUB_NAME } from "../lib/overhaul/hubNameFilter";

type Env = NodeJS.ProcessEnv;
const ID_RE = /^bi_[A-Za-z0-9_-]{4,64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,200}$/;
const VIEWS = new Set(["brand", "publisher", "supplier", "sponsor"]);

export function fridayBrandConfig(env: Env = process.env): { base: string; key: string; org: string } | null {
  if (env.FRIDAY_PUSH_DISABLED === "true") return null;
  const base = env.FRIDAY_API_URL?.trim().replace(/\/+$/, "").replace(/\/api(\/intake)?$/i, "");
  // brand-intake-v1 names INTAKE_WEBHOOK_SECRET; the existing Birch → Friday key is the fallback.
  const key = (env.INTAKE_WEBHOOK_SECRET || env.FRIDAY_API_KEY)?.trim();
  if (!base || !key) return null;
  return { base, key, org: env.FRIDAY_WORKSPACE?.trim() || "birchreserve" };
}

/** The visitor's IP as seen by Birch's edge (first value only), or null when it is not a valid IPv4/IPv6. */
export function clientIp(req: Request): string | null {
  const first = (v: string | undefined) => v?.split(",")[0]?.trim();
  const c = first(req.get("x-vercel-forwarded-for")) || first(req.get("x-real-ip")) || first(req.get("x-forwarded-for")) || req.ip || "";
  const ip = c.replace(/^::ffff:/i, "");
  return isIP(ip) ? ip : null;
}

/** Headers for forwarding one /br-t.js beacon to Friday's /api/track (contract: friday-crm docs/contracts/track-forwarding.md). */
export function trackForwardHeaders(req: Request, env: Env = process.env): Record<string, string> {
  let host = "";
  try { host = new URL(req.get("origin") ?? "").hostname; } catch { /* none */ }
  const ua = (req.get("user-agent") ?? "").slice(0, 400);
  const ip = clientIp(req);
  const key = (env.INTAKE_WEBHOOK_SECRET || env.FRIDAY_API_KEY)?.trim();
  const h: Record<string, string> = {
    "content-type": "text/plain",
    origin: MIRROR_ORIGIN_HOSTS.has(host) ? "https://www.scalehealth.ca" : "https://birchreserve.net",
    "user-agent": ua,
  };
  if (key) h["x-intake-secret"] = key;
  if (ip) h["x-client-ip"] = ip;
  if (ua) h["x-visitor-id"] = visitorDayHash(ip ?? "", ua);
  return h;
}

/**
 * The ONLY gate for Friday's legacy /api/intake from the brand-intake flow: a final submit (submit === true) with a
 * real email address. Drafts, autosaves, PATCHes, kit requests and downloads never qualify.
 * (Nov 18 2026, 10:35 PM ET leak: commit 6a32485 pushed every POST /v1/brand-intake to /api/intake when Friday's v1
 * route 404'd, including email-less autosave drafts. See PLAN.md.)
 */
const LEGACY_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export function legacyIntakeAllowed(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.submit === true && typeof b.email === "string" && LEGACY_EMAIL_RE.test(b.email.trim());
}

/**
 * Partial-lead capture (Randy via Emma, Nov 19 2026 10:21 AM ET). Deliberately relaxes "only a final submit reaches
 * Friday": once the visitor has typed a VALID email, the browser saves a partial lead (stage "partial", debounced) and
 * keeps PATCHing the same record. Each partial save is tagged ABANDONED in the v1 blurb; the final submit (PATCH
 * submit:true, from_partial:true) re-sends the blurb without that tag and with a SUBMITTED line, which flips it.
 * Guards kept: never written without a valid email (400 partial_needs_email, nothing forwarded), and the 404 legacy
 * /api/intake fallback still only fires for a final submit (legacyIntakeAllowed), so partials never go there.
 * `stage`, `from_partial` and `src` are Birch-only keys: stripped here before Friday sees the body (strict v1).
 */
export const PARTIAL_TAG = "[ABANDONED · partial lead] Email captured on the Monetization Kit form; not submitted yet. Flips to submitted on the final click.";
export const SUBMITTED_TAG = "[SUBMITTED · was a partial lead]";
export type Stage = "partial" | "submitted" | null;
export function stageOf(body: unknown): Stage {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.stage === "partial") return "partial"; // explicit partial wins: a partial save never submits
  return b.submit === true ? "submitted" : null;
}
/**
 * Supplier hub request (/intake/supplier, Randy voice Nov 19 2026 1:37 PM ET via Emma). A supplier's submit creates
 * their own hub record in "pending_approval": Birch Reserve (Randy or Jon) approves it before it goes live; nothing
 * auto-publishes. brand-intake v1 has no approval field, so `hub_request` is a Birch-only key: stripped here (strict
 * v1) and carried as a tagged first line of the v1 blurb, and as BR leads meta (intake_role / hub_status / hub_slug).
 */
export const HUB_PENDING_TAG = "[SUPPLIER HUB · PENDING APPROVAL]";
export type HubRequest = { role: "supplier"; status: "pending_approval"; hub_name: string | null; hub_slug: string | null };
const HUB_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export function hubRequestOf(raw: unknown): HubRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.role !== "supplier") return null;
  const name = typeof r.hub_name === "string" ? r.hub_name.replace(/[\r\n"]+/g, " ").trim().slice(0, 120) || null : null;
  const slug = typeof r.hub_slug === "string" && HUB_SLUG_RE.test(r.hub_slug) ? r.hub_slug : null;
  return { role: "supplier", status: "pending_approval", hub_name: name, hub_slug: slug }; // status is always pending: never approved from the browser
}
export const hubPendingLine = (h: HubRequest) => `${HUB_PENDING_TAG} role=supplier status=pending_approval${h.hub_slug ? ` hub_slug=${h.hub_slug}` : ""}${h.hub_name ? ` hub_name="${h.hub_name}"` : ""}. Own hub created from /intake/supplier; needs Birch Reserve approval (Randy or Jon) before it goes live. Do not auto-publish.`;
/** Read the tag back from a prepared body (BR leads mirror). */
export function hubPendingOf(b: Record<string, unknown>): { hub_status: "pending_approval"; hub_slug?: string } | null {
  if (typeof b.blurb !== "string" || !b.blurb.includes(HUB_PENDING_TAG)) return null;
  const slug = /\bhub_slug=([a-z0-9-]{1,64})/.exec(b.blurb)?.[1];
  return { hub_status: "pending_approval", ...(slug ? { hub_slug: slug } : {}) };
}
/** Mirror hosts (SCALE-MIRROR.md): a short, allow-listed source tag only. */
const SRC_RE = /^[a-z0-9_]{2,32}$/;
export function prepareStage(body: unknown): { body: Record<string, unknown>; stage: Stage; src: string | null; ref: string | null; error?: string } {
  const b = { ...((body ?? {}) as Record<string, unknown>) };
  const stage = stageOf(b);
  const fromPartial = b.from_partial === true;
  const src = typeof b.src === "string" && SRC_RE.test(b.src) ? b.src : null;
  const ref = typeof b.ref === "string" && SRC_RE.test(b.ref) ? b.ref : null;
  const hub = hubRequestOf(b.hub_request);
  delete b.stage;
  delete b.from_partial;
  delete b.src;
  delete b.ref;
  delete b.hub_request;
  if (hub && !(typeof b.blurb === "string" && b.blurb.includes(HUB_PENDING_TAG))) b.blurb = [hubPendingLine(hub), typeof b.blurb === "string" ? b.blurb : ""].filter(Boolean).join("\n").slice(0, 6000);
  if (stage === "partial") {
    if (!legacyIntakeAllowed({ ...b, submit: true })) return { body: b, stage, src, ref, error: "partial_needs_email" };
    delete b.submit;
  }
  const lines = [stage === "partial" ? PARTIAL_TAG : stage === "submitted" && fromPartial ? SUBMITTED_TAG : null, src ? `Source: ${src.replace(/_/g, " ")}.` : null].filter(Boolean) as string[];
  if (lines.length) b.blurb = [...lines, typeof b.blurb === "string" ? b.blurb : ""].filter(Boolean).join("\n").slice(0, 6000);
  return { body: b, stage, src, ref };
}

/** Headers Birch sends to Friday. The secret only ever goes in X-Intake-Secret. */
export function fridayHeaders(cfg: { key: string; org: string }, req: Request, env: Env = process.env): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", "X-Intake-Secret": cfg.key, "X-Org-Id": cfg.org };
  const edit = req.get("x-edit-token");
  if (edit && TOKEN_RE.test(edit)) h["X-Edit-Token"] = edit;
  // v1.2 §3: Friday rate-limits per visitor via X-Client-IP (server-to-server only; one IP, validated).
  const ip = clientIp(req);
  if (ip) h["X-Client-IP"] = ip;
  if (isSyntheticIntake(req, env)) h["X-Intake-Synthetic"] = "1";
  return h;
}

/** Map a v1 body to the legacy /api/intake lead (fallback only). Aggregate fields only; no free text beyond the blurb. */
function legacyLead(body: Record<string, unknown>, path: string) {
  const roles = Array.isArray(body.roles) ? (body.roles as string[]).join(", ") : "";
  const calc = (body.calculator ?? {}) as Record<string, unknown>;
  return {
    kind: "brand_intake" as const,
    email: typeof body.email === "string" ? body.email : undefined,
    website: typeof body.website === "string" ? body.website : undefined,
    message: `Brand intake (brand-intake-v1 fallback). Roles: ${roles || "brand"}.`,
    path,
    meta: {
      roles,
      submitted: body.submit === true,
      avg_cart_usd: typeof calc.avg_cart_usd === "number" ? calc.avg_cart_usd : undefined,
      orders_per_month: typeof calc.orders_per_month === "number" ? calc.orders_per_month : undefined,
      margin_band: typeof calc.margin_band === "string" ? calc.margin_band : undefined,
    },
  };
}

/** QA submissions from Birch previews (test@ / test+…@silverbirchgrowth.com) are marked TEST in Friday. */
export const TEST_EMAIL_RE = /^test(\+[a-z0-9._-]+)?@silverbirchgrowth\.com$/i;
export function markTest(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;
  if (typeof b.email !== "string" || !TEST_EMAIL_RE.test(b.email)) return body;
  const note = "[TEST] Birch preview QA record (br-preview). Not a real brand. Safe to delete.";
  return { ...b, blurb: typeof b.blurb === "string" && b.blurb ? `${note} ${b.blurb}`.slice(0, 6000) : note };
}

/**
 * Friday v1.1 §3: match results (existing hub partner lead, is-a-hub, proposed deltas) are INTERNAL ONLY and are
 * never returned to the submitter or the public payload. Defence in depth: if any such key ever appears in a
 * Friday response, Birch drops it here before it reaches a browser. No match badge is rendered anywhere.
 */
const INTERNAL_KEYS = ["partner_match", "existing_hub_partner_lead", "is_a_hub", "match", "matches", "friday_match", "deltas", "proposed_deltas", "inventory_approval", "approvers", "audit"];
/**
 * Friday excludes competing hubs server-side (report-design-system v2: the "excluded: competes" list is INTERNAL
 * ONLY). If any of it reaches Birch anyway, drop it: any key naming exclusion/competition, at any depth, and any
 * array item flagged excluded. Hub-like items whose name is on Birch's never-mention list are dropped too.
 */
const EXCLUDED_KEY = /exclu|compet/i;
export function stripExcluded(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v
      .filter((x) => {
        if (!x || typeof x !== "object") return true;
        const o = x as Record<string, unknown>;
        if (o.excluded === true || o.competes === true) return false;
        if (typeof o.status === "string" && EXCLUDED_KEY.test(o.status)) return false;
        if (typeof o.state === "string" && EXCLUDED_KEY.test(o.state)) return false;
        if (typeof o.name === "string" && NEVER_HUB_NAME.test(o.name)) return false;
        return true;
      })
      .map(stripExcluded);
  }
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (!EXCLUDED_KEY.test(k)) out[k] = stripExcluded(x);
    return out;
  }
  return v;
}
export function publicGates(text: string): string {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    return text;
  }
  if (!d || typeof d !== "object") return text;
  const clean = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    for (const k of INTERNAL_KEYS) delete (o as Record<string, unknown>)[k];
  };
  const root = stripExcluded(d) as Record<string, unknown>;
  clean(root);
  const rep = root.report as Record<string, unknown> | undefined;
  if (rep && typeof rep === "object") {
    clean(rep);
    clean(rep.status);
    clean(rep.geo);
  }
  return JSON.stringify(root);
}

export type IntakeLeadEvent = { fridayId: string | null; email: string; website: string | null; stage: "partial" | "submitted"; roles: string[]; path: string; /** Supplier hub request: always pending_approval until Randy or Jon approve. */ hub?: { hub_status: "pending_approval"; hub_slug?: string } | null };

/** Sales alerts for kit intake go only to randy@scalehealth.ca (care@ is the Resend sender). Never SBG addresses. */
export const KIT_INTAKE_ALERT_TO = ["randy@scalehealth.ca"] as const;

export function isScaleIntakeSource(input: { src?: string | null; ref?: string | null; host?: string | null; origin?: string | null }): boolean {
  const src = (input.src ?? "").toLowerCase();
  const ref = (input.ref ?? "").toLowerCase();
  const host = (input.host ?? "").toLowerCase();
  const origin = (input.origin ?? "").toLowerCase();
  return src === "scale_mirror" || src === "scale" || ref === "scale" || /(^|[./])scalehealth\.ca(?=$|[/:])/.test(host) || /scalehealth\.ca/.test(origin);
}

export function requestHost(req: { get: (n: string) => string | undefined }): { host: string; origin: string } {
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0]!.trim().toLowerCase().replace(/:\d+$/, "");
  const origin = String(req.get("origin") || req.get("referer") || "").toLowerCase();
  return { host, origin };
}

export type KitIntakeAlert = {
  event: "inquiry";
  tag: string;
  title: string;
  rows: Array<[string, string]>;
  replyTo?: string;
  isTest: boolean;
  to: string[];
};

export function kitIntakeAlert(input: {
  body: Record<string, unknown>;
  src: string | null;
  ref: string | null;
  host: string;
  origin: string;
  fridayId: string | null;
  path: string;
}): KitIntakeAlert {
  const b = input.body;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const website = typeof b.website === "string" ? b.website.trim() : "";
  const brand = typeof b.company_name === "string" ? b.company_name.trim() : "";
  const roles = Array.isArray(b.roles) ? (b.roles as unknown[]).map(String).slice(0, 6).join(", ") : "";
  const scale = isScaleIntakeSource({ src: input.src, ref: input.ref, host: input.host, origin: input.origin });
  const isTest = TEST_EMAIL_RE.test(email) || isTestIdentity({ email, name: brand }) || /\bTEST\b/.test(brand);
  const source = scale ? (input.ref === "scale" ? "Scale (ref=scale)" : "Scale (scalehealth.ca / scale_mirror)") : "Birch Reserve";
  return {
    event: "inquiry",
    tag: scale ? "SCALE KIT" : "BIRCH KIT",
    title: `Monetization Kit: ${brand || website || email || "new inquiry"}`,
    rows: [
      ["Form", "Monetization Kit intake"],
      ["Source", source],
      ["Host", input.host],
      ["Ref", input.ref || ""],
      ["Src tag", input.src || ""],
      ["Brand", brand],
      ["Email", email],
      ["Website", website],
      ["Roles", roles],
      ["Friday id", input.fridayId || ""],
      ["Page", input.path],
    ],
    replyTo: email || undefined,
    isTest,
    to: [...KIT_INTAKE_ALERT_TO],
  };
}

export function createBrandIntakeProxy(opts: { env?: Env; fetchImpl?: typeof fetch; log?: (msg: string, extra?: Record<string, unknown>) => void; recordLead?: (e: IntakeLeadEvent) => Promise<void>; sendAlert?: (a: KitIntakeAlert) => Promise<SalesAlertResult> } = {}) {
  const router = Router();
  const body = json({ limit: "64kb" });
  // Per-IP cap on new intakes / kit sends (security audit Nov 21 2026). Autosave PATCHes stay unlimited here; they need
  // the edit token and Friday applies its own limits. Valid X-Birch-QA traffic is exempt.
  const createLimiter = limiter({ max: 30, windowMs: 10 * 60_000 });
  const capped = (req: Request, res: Response, next: () => void) => {
    if (hasValidQaHeader(req) || isSyntheticIntake(req, env)) return next();
    const hit = createLimiter.hit(req.ip || "unknown");
    if (!hit.limited) return next();
    res.setHeader("Retry-After", String(hit.retryAfterSec));
    res.status(429).json({ ok: false, error: "rate_limited", message: FRIENDLY_429 });
  };
  const env = opts.env ?? process.env;
  const f = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => undefined);

  async function forward(req: Request, res: Response, method: "GET" | "POST" | "PATCH", path: string, payload?: unknown) {
    res.setHeader("Cache-Control", "private, no-store");
    const cfg = fridayBrandConfig(env);
    if (!cfg) {
      res.status(503).json({ ok: false, error: "friday_not_configured" });
      return null;
    }
    try {
      const r = await f(`${cfg.base}${path}`, { method, headers: fridayHeaders(cfg, req, env), body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
      const text = await r.text();
      const retry = r.headers.get("retry-after");
      if (retry) res.setHeader("Retry-After", retry);
      log("brand-intake forward", { path: path.replace(/\/[A-Za-z0-9_-]{8,}(?=\/|\?|$)/g, "/:x"), status: r.status }); // never log tokens or the secret
      return { status: r.status, text };
    } catch {
      res.status(503).json({ ok: false, error: "friday_unreachable" });
      return null;
    }
  }
  /**
   * Contract version: v1.2 is detected by its public GET /api/public/brand-categories (cached 5 min). On strict v1
   * the body is downgraded before sending (toV1Body). No retry-without-geo path any more (v1.2 §7).
   */
  let probe: { at: number; v12: boolean; categories: unknown } | null = null;
  async function fridayV12(): Promise<{ v12: boolean; categories: unknown }> {
    if (probe && Date.now() - probe.at < 5 * 60_000) return probe;
    const cfg = fridayBrandConfig(env);
    let v12 = false;
    let categories: unknown = null;
    if (cfg) {
      try {
        const r = await f(`${cfg.base}/api/public/brand-categories`, { method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5_000) });
        if (r.ok) {
          const d = (await r.json().catch(() => null)) as { categories?: unknown } | null;
          if (d && Array.isArray(d.categories)) (v12 = true), (categories = d);
        }
      } catch {
        /* treat as v1 */
      }
    }
    probe = { at: Date.now(), v12, categories };
    return probe;
  }
  async function shaped(body: unknown): Promise<unknown> {
    const b = markTest(body ?? {}) as Record<string, unknown>;
    return (await fridayV12()).v12 ? b : toV1Body(b);
  }
  const send = (res: Response, out: { status: number; text: string }) => {
    const gated = publicGates(out.text || "{}");
    if (out.status >= 500) {
      try { JSON.parse(gated); } catch {
        return res.status(out.status).json({ ok: false, error: "upstream_error", error_message: "Something went wrong on our side. Please try again." });
      }
    }
    return res.status(out.status).type("application/json").send(gated);
  };
  /** BR leads mirror of partial + submitted intakes (same pipeline as full submissions). Never throws, never blocks. */
  const recordLead = opts.recordLead ?? defaultRecordLead(env);
  const alerter = opts.sendAlert ?? ((a: KitIntakeAlert) => sendSalesAlert(a));
  function fridayIdOf(out: { status: number; text: string }, id?: string): string | null {
    if (id) return id;
    try {
      const d = JSON.parse(out.text || "{}") as { id?: unknown };
      if (typeof d.id === "string" && ID_RE.test(d.id)) return d.id;
    } catch {
      /* ignore */
    }
    return null;
  }
  async function notifySubmitted(prep: { body: Record<string, unknown>; src: string | null; ref: string | null }, out: { status: number; text: string }, req: Request, id?: string) {
    if (prep.body && typeof prep.body.email !== "string") return;
    const { host, origin } = requestHost(req);
    const path = hubPendingOf(prep.body) ? "/intake/supplier" : "/intake";
    await alerter(kitIntakeAlert({ body: prep.body, src: prep.src, ref: prep.ref, host, origin, fridayId: fridayIdOf(out, id), path })).catch(() => undefined);
  }
  function noteLead(b: Record<string, unknown>, stage: Stage, out: { status: number; text: string }, id?: string, region: string | null = null) {
    if (!stage || out.status >= 300 || typeof b.email !== "string") return;
    let fid: string | null = id ?? null;
    try {
      const d = JSON.parse(out.text || "{}") as { id?: unknown };
      if (typeof d.id === "string" && ID_RE.test(d.id)) fid = d.id;
    } catch {
      /* keep id */
    }
    // Activity pulse (lib/activityPulse.ts): a real, submitted brand-side kit request. Category only; no identity.
    const roles = Array.isArray(b.roles) ? (b.roles as unknown[]).map(String) : [];
    if (stage === "submitted" && !hubPendingOf(b) && (!roles.length || roles.includes("supplier") || roles.includes("kit"))) {
      const sp = b.sponsor as { categories?: unknown } | undefined;
      const cat = b.category ?? (Array.isArray(sp?.categories) ? sp!.categories[0] : null);
      const email = b.email.trim().toLowerCase();
      void recordPulse("kit_request", cat, { isTest: TEST_EMAIL_RE.test(email) || isTestIdentity({ email }) || /@(silverbirchgrowth\.com|scalehealth\.ca|birchreserve\.net|example\.(com|org))$/.test(email), src: typeof b.src === "string" ? b.src : null, region });
    }
    void recordLead({ fridayId: fid, email: b.email.trim().toLowerCase(), website: typeof b.website === "string" ? b.website.slice(0, 200) : null, stage, roles: Array.isArray(b.roles) ? (b.roles as unknown[]).map(String).slice(0, 6) : [], path: hubPendingOf(b) ? "/intake/supplier" : "/intake", hub: hubPendingOf(b) }).catch(() => undefined);
  }

  router.post("/v1/brand-intake", capped, body, async (req, res) => {
    const fast = (req.body as Record<string, unknown> | undefined)?.submit_mode === "fast";
    if (fast) {
      // v1.3 §1 fast mode: website + email required (checked here too, so nothing is sent without them).
      const fb = req.body as Record<string, unknown>;
      if (typeof fb.website !== "string" || !fb.website.trim() || !legacyIntakeAllowed({ ...fb, submit: true })) return void res.status(400).json({ ok: false, error: "fast_needs_website_email" });
      if (env.FRIDAY_FAST_MODE === "off") return void res.status(409).json({ ok: false, error: "fast_unsupported" });
    }
    const prep = prepareStage(fast ? { ...(req.body as object), submit: true } : req.body ?? {});
    if (prep.error) return void res.status(400).json({ ok: false, error: prep.error });
    const eff = prep.body;
    const out = await forward(req, res, "POST", "/api/public/brand-intake", await shaped(eff));
    if (!out) return;
    if (fast && out.status === 400 && /"invalid"/.test(out.text) && !/fast_needs_website_email|"website"|"email"|too_fast/.test(out.text)) {
      // Friday not on v1.3 yet (strict body rejects submit_mode). A 400 creates nothing; the browser falls back to a
      // v1 create + submit with labelled defaults and Birch's instant calculator.
      return void res.status(409).json({ ok: false, error: "fast_unsupported" });
    }
    if (out.status === 404) {
      // v1 not deployed. Drafts (no email yet) stay in the browser; only a submission with contact details is
      // pushed to /api/intake, so autosave never creates anonymous leads.
      const b = eff;
      if (!legacyIntakeAllowed(b)) {
        res.status(202).json({ ok: true, fallback: "api_intake", lead: false, draft: "local" });
        return;
      }
      const r = await sendIntake(legacyLead(b, "/intake"), env);
      if (r.status === "sent") await notifySubmitted(prep, { status: 202, text: "{}" }, req);
      res.status(r.status === "sent" ? 202 : 503).json({ ok: r.status === "sent", fallback: "api_intake", lead: r.status === "sent", status: "submitted", version: 1, approvals: {}, error: r.status === "sent" ? undefined : "intake_failed" });
      return;
    }
    const synthetic = isSyntheticIntake(req, env);
    if (!synthetic) noteLead(eff, prep.stage, out, undefined, coarseRegion((h) => req.get(h)));
    if (!synthetic && prep.stage === "submitted" && out.status < 300) {
      await notifySubmitted(prep, out, req);
      await onIntakeSubmitted(promoCtxOf(req), String((eff as Record<string, unknown>).email ?? ""), typeof (eff as Record<string, unknown>).website === "string" ? ((eff as Record<string, unknown>).website as string) : null);
    }
    send(res, out);
  });
  router.patch("/v1/brand-intake/:id", body, async (req, res) => {
    const id = String(req.params.id);
    if (!ID_RE.test(id)) return void res.status(404).json({ ok: false, error: "not_found" });
    // v1.3 §2: fast is create-only; an upgrade PATCHes with submit_mode "expanded". Never forward a fast PATCH.
    if ((req.body as Record<string, unknown> | undefined)?.submit_mode === "fast") return void res.status(400).json({ ok: false, error: "fast_create_only" });
    // PATCH (autosave or submit) only ever goes to brand-intake v1; it never falls back to /api/intake.
    const prep = prepareStage(req.body);
    if (prep.error) return void res.status(400).json({ ok: false, error: prep.error });
    const out = await forward(req, res, "PATCH", `/api/public/brand-intake/${encodeURIComponent(id)}`, await shaped(prep.body));
    if (!out) return;
    const synthetic = isSyntheticIntake(req, env);
    if (!synthetic) noteLead(prep.body, prep.stage, out, id);
    if (!synthetic && prep.stage === "submitted" && out.status < 300) {
      await notifySubmitted(prep, out, req, id);
      await onIntakeSubmitted(promoCtxOf(req), String((prep.body as Record<string, unknown>)?.email ?? ""), typeof (prep.body as Record<string, unknown>)?.website === "string" ? ((prep.body as Record<string, unknown>).website as string) : null);
    }
    send(res, out);
  });
  router.post("/v1/brand-intake/:id/kit", capped, body, async (req, res) => {
    const id = String(req.params.id);
    if (!ID_RE.test(id)) return void res.status(404).json({ ok: false, error: "not_found" });
    const out = await forward(req, res, "POST", `/api/public/brand-intake/${encodeURIComponent(id)}/kit`, req.body ?? {});
    if (out) send(res, out);
  });
  router.post("/v1/brand-kit/download", capped, body, async (req, res) => {
    const out = await forward(req, res, "POST", "/api/public/brand-kit/download", req.body ?? {});
    if (out) send(res, out);
  });
  /** Same-origin copy of the backend's analytics snippet, so no backend name appears in Birch's HTML. Cached 1h. */
  let tjs: { at: number; body: string } | null = null;
  router.get("/br-t.js", async (_req, res) => {
    res.type("application/javascript").setHeader("Cache-Control", "public, max-age=3600");
    if (tjs && Date.now() - tjs.at < 3_600_000) return void res.send(tjs.body);
    try {
      const r = await f("https://fridayapp.org/t.js", { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error(String(r.status));
      tjs = { at: Date.now(), body: await r.text() };
      res.send(tjs.body);
    } catch {
      res.send("/* analytics unavailable */");
    }
  });
  /**
   * The same-origin analytics snippet (/br-t.js) posts page / section / CTA / form events to /api/track on THIS host.
   * They are forwarded server-side to Friday's traffic endpoint, body unchanged (the snippet's own cookieless payload, no
   * PII), per Friday's docs/contracts/track-forwarding.md (friday-crm PR #233):
   *   X-Intake-Secret  the existing Friday intake secret (INTAKE_WEBHOOK_SECRET, else FRIDAY_API_KEY); omitted if unset
   *   X-Client-IP      the visitor's IP from the trusted Vercel headers (clientIp), only when it is a valid IPv4/IPv6
   *   X-Visitor-Id     our daily-rotating visitor hash (the same one site analytics stores), replaces IP+UA in Friday's hash
   *   User-Agent       the visitor's real user agent; Origin = the page's site (birchreserve.net or the Scale mirror)
   * No geo is forwarded. Do Not Track / GPC: dropped, nothing sent. TRACK_FORWARD_DISABLED=true turns forwarding off.
   * Server-to-server, so the backend name never appears in the page. Always 204 to the browser.
   */
  let forwardLogged = false;
  router.post("/api/track", text({ type: "*/*", limit: "4kb" }), async (req, res) => {
    const done = () => void res.status(204).end();
    if (env.TRACK_FORWARD_DISABLED === "true" || req.get("dnt") === "1" || req.get("sec-gpc") === "1") return done();
    const raw = typeof req.body === "string" ? req.body : "";
    if (!raw || raw.length > 4096) return done();
    const headers = trackForwardHeaders(req, env);
    if (!forwardLogged) {
      forwardLogged = true;
      log("track forward ready", { intake_secret: Boolean(headers["x-intake-secret"]), client_ip: Boolean(headers["x-client-ip"]) });
    }
    // Awaited (3 s cap) so the serverless function is not frozen mid-request; the browser's beacon never waits on it.
    await f("https://fridayapp.org/api/track", { method: "POST", headers, body: raw, signal: AbortSignal.timeout(3000) })
      .then((r) => r.arrayBuffer()).catch(() => undefined);
    done();
  });
  /** v1.2 §6 shared category keys (Friday's list when it serves one, else the static copy of the contract table). */
  router.get("/v1/brand-categories", async (_req, res) => {
    const p = await fridayV12();
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(p.v12 && p.categories ? p.categories : { categories: FRIDAY_CATEGORIES, source: "static" });
  });
  router.get("/v1/brand-report/:token", async (req, res) => {
    const token = String(req.params.token);
    if (!TOKEN_RE.test(token)) return void res.status(404).json({ ok: false, error: "not_found" });
    const view = VIEWS.has(String(req.query.view)) ? String(req.query.view) : "brand";
    res.setHeader("Referrer-Policy", "no-referrer");
    const expo = req.query.expo === "max" ? "&expo=max" : "";
    const h = req.query.h === "later" ? "&h=later" : "";
    const out = await forward(req, res, "GET", `/api/public/brand-report/${encodeURIComponent(token)}?view=${view}${expo}${h}`);
    if (out) send(res, out);
  });
  return router;
}

/**
 * Default BR leads writer: production only (previews and tests never touch the prod store), one row per Friday
 * record (`brandintake:<id>`, or the email when Friday had no id). Friday already holds the record via brand-intake
 * v1, so the row is marked sent to Friday and is never re-pushed to /api/intake (no duplicate CRM lead).
 */
function defaultRecordLead(env: Env) {
  return async (e: IntakeLeadEvent) => {
    if (env.VERCEL_ENV !== "production") return;
    const { upsertLeadSafe, getLeadStore } = await import("../lib/leads");
    const id = `brandintake:${e.fridayId ?? e.email}`.slice(0, 200);
    const lead = await upsertLeadSafe({ id, source: "brand_intake", sourceRef: e.fridayId ?? e.email, email: e.email, company: e.website, need: `${e.hub ? "Supplier hub request · pending approval (Randy or Jon) · " : ""}Monetization Kit intake (${e.roles.join(", ") || "brand"}) · ${e.stage === "partial" ? "abandoned (partial)" : "submitted"}`, pagePath: e.path, isTest: TEST_EMAIL_RE.test(e.email), meta: { stage: e.stage === "partial" ? "abandoned" : "submitted", friday_intake_id: e.fridayId ?? undefined, ...(e.hub ? { intake_role: "supplier", hub_status: e.hub.hub_status, hub_slug: e.hub.hub_slug } : {}) } });
    if (lead) await getLeadStore().markFriday(lead.id, { status: "sent", contactId: e.fridayId, dealId: null }, new Date(), false).catch(() => undefined);
  };
}
