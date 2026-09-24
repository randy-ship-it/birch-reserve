/**
 * Friday CRM push (fridayapp.org). Best-effort, non-blocking, retried.
 *
 * Friday's intake contract (randy-ship-it/friday-crm PR #31, docs/INTAKE.md):
 *   POST {FRIDAY_API_URL}/api/intake
 *   Authorization: Bearer <Friday INTAKE_WEBHOOK_SECRET>   (or X-Intake-Secret)
 *   JSON { externalId, email, firstName, lastName, phone, title, company,
 *          message, site, org, source, kind, tags[] }
 *   + (7:21pm) meta { category, hubs, source, sku, utm_source, utm_campaign, need,
 *          size, timing, is_test, paid?, stripe_session_id? } and value (number) when
 *          known. Unknown keys are omitted, never sent as empty strings.
 *   → 201 created / 200 idempotent: { orgId, contactId, companyId, dealId, ... }
 * Friday upserts a contact (+ company) and an open deal on the workspace's
 * "Sales Pipeline", idempotent by externalId (then email). birchreserve.net maps
 * to the `birchreserve` workspace.
 *
 * Stage: the intake API has no stage field today; new deals land in the "Lead"
 * stage. We send `stage: "Birch inbound"` (ignored by current Friday, ready for
 * when intake honours it) plus the tags `birch-inbound` and `stage:birch-inbound`
 * so the deals are filterable now. Creating the stage requires a signed-in
 * Friday session (POST /api/stages, Clerk auth); we never create it from here.
 *
 * Env (all optional; unset → push is skipped and recorded as `skipped`):
 *   FRIDAY_API_URL     e.g. https://fridayapp.org
 *   FRIDAY_API_KEY     the Friday deploy's INTAKE_WEBHOOK_SECRET value
 *   FRIDAY_WORKSPACE   Friday org id (default "birchreserve")
 *   FRIDAY_STAGE       stage label to request (default "Birch inbound")
 *   FRIDAY_PUSH_DISABLED=true  hard off switch
 * The key is only ever sent in the Authorization header; never logged, stored,
 * or returned.
 */
import { logger } from "./logger";
import { getLeadStore, leadIsActionable, type FridayResult, type Lead } from "./leads";

export type FridayConfig = { url: string; key: string; workspace: string; stage: string };

export const FRIDAY_ENV = {
  url: "FRIDAY_API_URL",
  key: "FRIDAY_API_KEY",
  workspace: "FRIDAY_WORKSPACE",
  stage: "FRIDAY_STAGE",
} as const;
export const DEFAULT_FRIDAY_WORKSPACE = "birchreserve";
export const DEFAULT_FRIDAY_STAGE = "Birch inbound";

const MAX_INLINE_ATTEMPTS = 3;
const MAX_TOTAL_ATTEMPTS = 8;
const SENDING_STALE_MS = 2 * 60_000;
const RETRY_AFTER_MS = 10 * 60_000;
const SWEEP_INTERVAL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;

export function fridayConfig(env: NodeJS.ProcessEnv = process.env): FridayConfig | null {
  if (env["FRIDAY_PUSH_DISABLED"] === "true") return null;
  const url = env[FRIDAY_ENV.url]?.trim();
  const key = env[FRIDAY_ENV.key]?.trim();
  if (!url || !key) return null;
  return {
    url,
    key,
    workspace: env[FRIDAY_ENV.workspace]?.trim() || DEFAULT_FRIDAY_WORKSPACE,
    stage: env[FRIDAY_ENV.stage]?.trim() || DEFAULT_FRIDAY_STAGE,
  };
}

/** Accepts a bare origin (https://fridayapp.org), .../api, or the full .../api/intake. */
export function fridayIntakeUrl(base: string): string {
  const b = base.trim().replace(/\/+$/, "");
  if (/\/api\/intake$/i.test(b)) return b;
  if (/\/api$/i.test(b)) return `${b}/intake`;
  return `${b}/api/intake`;
}

const SOURCE_LABEL: Record<Lead["source"], string> = {
  chat_intake: "Birch chat intake",
  chat_callback: "Birch chat callback",
  voice: "Birch voice call",
  web_voice: "Birch web voice call",
  advertiser_intake: "Birch advertiser form",
  email_capture: "Birch email capture",
  checkout: "Birch checkout (paid)",
};

/** meta.source buckets Emma asked for. */
const META_SOURCE: Record<Lead["source"], "chat" | "voice" | "form" | "email_capture" | "checkout"> = {
  chat_intake: "chat",
  chat_callback: "chat",
  voice: "voice",
  web_voice: "voice",
  advertiser_intake: "form",
  email_capture: "email_capture",
  checkout: "checkout",
};

/** Public SKUs only: $190 hold, $490 seat. */
export const SKU_VALUE: Record<string, number> = { "hold-190": 190, "reserve-490": 490 };

export function fridayExternalId(lead: Pick<Lead, "id" | "meta">): string {
  return (lead.meta.friday_external_id || `birch-${lead.id}`).slice(0, 160);
}

/** Friday `meta` object: only keys we actually know. */
export function buildFridayMeta(lead: Lead): Record<string, string | number | boolean> {
  const meta: Record<string, string | number | boolean> = {};
  const put = (k: string, v: string | null | undefined, max = 300) => {
    const t = v?.trim();
    if (t) meta[k] = t.slice(0, max);
  };
  put("category", lead.meta.category);
  put("hubs", lead.meta.hubs);
  meta["source"] = META_SOURCE[lead.source];
  put("sku", lead.meta.sku);
  put("utm_source", lead.utmSource);
  put("utm_campaign", lead.utmCampaign);
  put("need", lead.need, 500);
  put("size", lead.size);
  put("timing", lead.timing);
  meta["is_test"] = lead.isTest;
  if (lead.meta.paid) meta["paid"] = true;
  put("stripe_session_id", lead.meta.stripe_session_id);
  return meta;
}

export function fridayValue(lead: Pick<Lead, "meta">): number | undefined {
  if (typeof lead.meta.value === "number") return lead.meta.value;
  return lead.meta.sku ? SKU_VALUE[lead.meta.sku] : undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function splitName(name: string | null): { firstName?: string; lastName?: string } {
  const n = name?.trim();
  if (!n) return {};
  const [first, ...rest] = n.split(/\s+/);
  return { firstName: first!.slice(0, 80), ...(rest.length ? { lastName: rest.join(" ").slice(0, 80) } : {}) };
}

/** Friday /api/intake payload for a lead (matches Friday's parseIntakeBody limits). */
export function buildFridayPayload(lead: Lead, cfg: Pick<FridayConfig, "workspace" | "stage">): Record<string, unknown> {
  const email = lead.email && EMAIL_RE.test(lead.email) && lead.email.length <= 320 ? lead.email : undefined;
  const details = [
    `${SOURCE_LABEL[lead.source]} (${cfg.stage}).`,
    lead.need ? `Need: ${lead.need}` : "",
    lead.size ? `Size: ${lead.size}` : "",
    lead.timing ? `Timing: ${lead.timing}` : "",
    lead.role ? `Role: ${lead.role}` : "",
    lead.utmSource || lead.utmMedium || lead.utmCampaign
      ? `UTM: ${[lead.utmSource, lead.utmMedium, lead.utmCampaign].map((x) => x ?? "-").join(" / ")}`
      : "",
    lead.referrer ? `Referrer: ${lead.referrer}` : "",
    lead.landingPage ? `Landing page: ${lead.landingPage}` : "",
    lead.meta.paid ? `Paid checkout: ${lead.meta.sku ?? "unknown sku"}${lead.meta.stripe_session_id ? ` (Stripe ${lead.meta.stripe_session_id})` : ""}` : "",
    lead.isTest ? "QA TEST LEAD (is_test): safe to ignore / delete." : "",
    `Birch lead id: ${lead.id}`,
  ].filter(Boolean);
  const payload: Record<string, unknown> = {
    externalId: fridayExternalId(lead),
    ...(email ? { email } : {}),
    ...splitName(lead.name),
    ...(lead.phone ? { phone: lead.phone.slice(0, 40) } : {}),
    ...(lead.role ? { title: lead.role.slice(0, 120) } : {}),
    ...(lead.company ? { company: lead.company.slice(0, 160) } : {}),
    message: details.join("\n").slice(0, 4000),
    site: "birchreserve.net",
    org: cfg.workspace,
    source: SOURCE_LABEL[lead.source],
    kind: lead.source === "voice" || lead.source === "web_voice" ? "bot" : "form",
    ...(lead.pagePath ? { path: lead.pagePath.slice(0, 200) } : {}),
    stage: cfg.stage,
    tags: [
      "birch-inbound",
      "stage:birch-inbound",
      `birch:${lead.source.replace(/_/g, "-")}`,
      ...(lead.meta.sku && SKU_VALUE[lead.meta.sku] ? [`birch:${lead.meta.sku}`] : []),
      ...(lead.isTest ? ["birch:qa-test"] : []),
    ],
    meta: buildFridayMeta(lead),
  };
  const value = fridayValue(lead);
  if (value !== undefined) payload["value"] = value;
  return payload;
}

export type FridayFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

type SendOutcome =
  | { ok: true; contactId: string | null; dealId: string | null }
  | { ok: false; error: string; retryable: boolean };

function redact(text: string, secret: string): string {
  let out = text.replace(/\s+/g, " ");
  if (secret) out = out.split(secret).join("[redacted]");
  return out;
}

function idOf(v: unknown): string | null {
  return typeof v === "number" || (typeof v === "string" && v) ? String(v) : null;
}

export async function sendToFriday(
  lead: Lead,
  cfg: FridayConfig,
  fetchImpl: FridayFetch,
  opts: { attempts?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<SendOutcome> {
  const attempts = opts.attempts ?? MAX_INLINE_ATTEMPTS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const body = JSON.stringify(buildFridayPayload(lead, cfg));
  let last: SendOutcome = { ok: false, error: "not_attempted", retryable: true };
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(500 * 4 ** (i - 1));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchImpl(fridayIntakeUrl(cfg.url), {
        method: "POST",
        headers: {
          authorization: `Bearer ${cfg.key}`,
          "content-type": "application/json",
          "x-birch-lead-id": lead.id,
        },
        body,
        signal: controller.signal,
      });
      const text = await res.text().catch(() => "");
      if (res.ok) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(text) as Record<string, unknown>;
        } catch {
          /* tolerate empty / non-JSON success */
        }
        return { ok: true, contactId: idOf(parsed["contactId"]), dealId: idOf(parsed["dealId"]) };
      }
      let detail = "";
      try {
        const e = (JSON.parse(text) as { error?: unknown }).error;
        if (typeof e === "string") detail = e;
      } catch {
        /* non-JSON error body: keep status only */
      }
      const retryable = res.status === 429 || res.status >= 500;
      last = { ok: false, error: redact(`Friday HTTP ${res.status}${detail ? `: ${detail}` : ""}`, cfg.key).slice(0, 200), retryable };
      if (!retryable) return last;
    } catch (error) {
      const msg = error instanceof Error ? (error.name === "AbortError" ? "timeout" : error.message) : "network_error";
      last = { ok: false, error: redact(`Friday request failed: ${msg}`, cfg.key).slice(0, 200), retryable: true };
    } finally {
      clearTimeout(timeout);
    }
  }
  return last;
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

let fetchImpl: FridayFetch = (url, init) => fetch(url, init);
let sleepImpl: ((ms: number) => Promise<void>) | undefined;
let timer: ReturnType<typeof setInterval> | null = null;

export function setFridayDepsForTests(deps: { fetch?: FridayFetch; sleep?: (ms: number) => Promise<void> }): void {
  if (deps.fetch) fetchImpl = deps.fetch;
  if (deps.sleep) sleepImpl = deps.sleep;
}

/**
 * Push one lead now and record the outcome on the lead row. Never throws.
 * Unset env → status `skipped` (error "friday_not_configured").
 */
export async function pushLeadToFriday(leadId: string, now: Date = new Date()): Promise<FridayResult | undefined> {
  const store = getLeadStore();
  try {
    const current = await store.get(leadId);
    if (!current || !leadIsActionable(current)) return undefined;
    if (current.isTest && !current.meta.friday_qa_ok) {
      // Test traffic (6:50pm): stored, never pushed to Friday (unless the QA Friday check opted in).
      const result: FridayResult = { status: "skipped", error: "is_test" };
      if (current.fridayStatus !== "sent") await store.markFriday(leadId, result, now, false);
      return result;
    }
    const cfg = fridayConfig();
    if (!cfg) {
      const result: FridayResult = { status: "skipped", error: "friday_not_configured" };
      if (current.fridayStatus !== "sent") await store.markFriday(leadId, result, now, false);
      return result;
    }
    const claimed = await store.claimFriday(leadId, now, SENDING_STALE_MS);
    if (!claimed) return undefined;
    const outcome = await sendToFriday(claimed, cfg, fetchImpl, sleepImpl ? { sleep: sleepImpl } : {});
    const result: FridayResult = outcome.ok
      ? { status: "sent", contactId: outcome.contactId, dealId: outcome.dealId }
      : { status: "failed", error: outcome.error };
    await store.markFriday(leadId, result, new Date());
    if (!outcome.ok) {
      logger.warn({ lead: leadId, err: outcome.error, retryable: outcome.retryable }, "Friday CRM push failed");
    } else {
      logger.info({ lead: leadId, fridayDealId: outcome.dealId }, "Friday CRM push ok");
    }
    return result;
  } catch (error) {
    logger.warn({ lead: leadId, err: error instanceof Error ? error.message : "friday_push_failed" }, "Friday CRM push errored");
    return undefined;
  }
}

/** Fire-and-forget push (never blocks the chat or webhook response). */
export function queueFridayPush(leadId: string): void {
  ensureFridayRetryTimer();
  void pushLeadToFriday(leadId);
}

/** Retry pending/failed pushes (and skipped ones once Friday env is set). */
export async function retryFridayPushes(now: Date = new Date()): Promise<number> {
  try {
    const ids = await getLeadStore().listFridayRetryable({
      now,
      retryAfterMs: RETRY_AFTER_MS,
      maxAttempts: MAX_TOTAL_ATTEMPTS,
      includeSkipped: fridayConfig() !== null,
      limit: 20,
    });
    for (const id of ids) await pushLeadToFriday(id, now);
    return ids.length;
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : "friday_retry_failed" }, "Friday retry sweep failed");
    return 0;
  }
}

/** 5-minute unref'd retry sweep (never keeps an idle Autoscale instance alive). */
export function ensureFridayRetryTimer(): void {
  if (timer || process.env["NODE_ENV"] === "test") return;
  timer = setInterval(() => void retryFridayPushes(), SWEEP_INTERVAL_MS);
  timer.unref?.();
}

export function stopFridayRetryTimerForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
