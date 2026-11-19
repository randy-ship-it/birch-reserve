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
import { Router, json, type Request, type Response } from "express";
import { sendIntake } from "../lib/overhaul/fridayIntake";

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

/** Headers Birch sends to Friday. The secret only ever goes in X-Intake-Secret. */
export function fridayHeaders(cfg: { key: string; org: string }, req: Request): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", "X-Intake-Secret": cfg.key, "X-Org-Id": cfg.org };
  const edit = req.get("x-edit-token");
  if (edit && TOKEN_RE.test(edit)) h["X-Edit-Token"] = edit;
  if (req.ip) h["X-Forwarded-For"] = req.ip; // so Friday rate-limits per visitor, not per Birch server
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
const NEVER_NAME = /medvibe|clairvoyant|\balign\b|alset|kalaya/i;
export function stripExcluded(v: unknown): unknown {
  if (Array.isArray(v)) {
    return v
      .filter((x) => {
        if (!x || typeof x !== "object") return true;
        const o = x as Record<string, unknown>;
        if (o.excluded === true || o.competes === true) return false;
        if (typeof o.status === "string" && EXCLUDED_KEY.test(o.status)) return false;
        if (typeof o.state === "string" && EXCLUDED_KEY.test(o.state)) return false;
        if (typeof o.name === "string" && NEVER_NAME.test(o.name)) return false;
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

export function createBrandIntakeProxy(opts: { env?: Env; fetchImpl?: typeof fetch; log?: (msg: string, extra?: Record<string, unknown>) => void } = {}) {
  const router = Router();
  const body = json({ limit: "64kb" });
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
      const r = await f(`${cfg.base}${path}`, { method, headers: fridayHeaders(cfg, req), body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
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
  /** Friday v1 is strict: if it rejects the v1.1-only keys, retry once without them (v1.1 tolerance). */
  async function forwardTolerant(req: Request, res: Response, method: "POST" | "PATCH", path: string, payload: unknown) {
    const out = await forward(req, res, method, path, payload);
    if (!out || out.status !== 400 || !payload || typeof payload !== "object") return out;
    const b = payload as Record<string, unknown>;
    if (!("geo" in b) && !("company_name" in b)) return out;
    if (!/"invalid"/.test(out.text)) return out;
    const { geo: _g, company_name: _c, ...v1 } = b;
    log("brand-intake v1.1 keys rejected; retried as v1", { path: path.replace(/\/[A-Za-z0-9_-]{8,}(?=\/|\?|$)/g, "/:x") });
    return forward(req, res, method, path, v1);
  }
  const send = (res: Response, out: { status: number; text: string }) => res.status(out.status).type("application/json").send(publicGates(out.text || "{}"));

  router.post("/v1/brand-intake", body, async (req, res) => {
    const out = await forwardTolerant(req, res, "POST", "/api/public/brand-intake", markTest(req.body ?? {}));
    if (!out) return;
    if (out.status === 404) {
      // v1 not deployed. Drafts (no email yet) stay in the browser; only a submission with contact details is
      // pushed to /api/intake, so autosave never creates anonymous leads.
      const b = (req.body ?? {}) as Record<string, unknown>;
      if (b.submit !== true || typeof b.email !== "string") {
        res.status(202).json({ ok: true, fallback: "api_intake", lead: false, draft: "local" });
        return;
      }
      const r = await sendIntake(legacyLead(b, "/intake"), env);
      res.status(r.status === "sent" ? 202 : 503).json({ ok: r.status === "sent", fallback: "api_intake", lead: r.status === "sent", status: "submitted", version: 1, approvals: {}, error: r.status === "sent" ? undefined : "intake_failed" });
      return;
    }
    send(res, out);
  });
  router.patch("/v1/brand-intake/:id", body, async (req, res) => {
    const id = String(req.params.id);
    if (!ID_RE.test(id)) return void res.status(404).json({ ok: false, error: "not_found" });
    const out = await forwardTolerant(req, res, "PATCH", `/api/public/brand-intake/${encodeURIComponent(id)}`, markTest(req.body ?? {}));
    if (!out) return;
    send(res, out);
  });
  router.post("/v1/brand-intake/:id/kit", body, async (req, res) => {
    const id = String(req.params.id);
    if (!ID_RE.test(id)) return void res.status(404).json({ ok: false, error: "not_found" });
    const out = await forward(req, res, "POST", `/api/public/brand-intake/${encodeURIComponent(id)}/kit`, req.body ?? {});
    if (out) send(res, out);
  });
  router.post("/v1/brand-kit/download", body, async (req, res) => {
    const out = await forward(req, res, "POST", "/api/public/brand-kit/download", req.body ?? {});
    if (out) send(res, out);
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
