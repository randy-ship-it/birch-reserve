/**
 * Standalone Friday intake push for overhaul forms (no DB dependency so the
 * preview function can run it). Same contract as lib/fridayPush.ts:
 * POST {FRIDAY_API_URL}/api/intake, Bearer FRIDAY_API_KEY, org=birchreserve.
 * Unset env -> { status: "skipped" } and the caller still answers the visitor.
 */
import { createHash } from "node:crypto";
import { alertWithin, type AlertAction, type AlertResult, type SeatAlert } from "../seats/alerts";

export type IntakeKind = "match_tool" | "hub_access" | "cobranded_hub_inquiry" | "display_cpc_inquiry" | "publisher_studio" | "area_lock_interest" | "agency_inquiry" | "deposit_interest" | "agent_checkout" | "seat_hold" | "seat_lock" | "seat_lock_request" | "seat_waitlist" | "seat_block_request" | "seat_paid";

export type IntakeInput = {
  kind: IntakeKind;
  email?: string;
  name?: string;
  company?: string;
  phone?: string;
  website?: string;
  message?: string;
  path?: string;
  meta?: Record<string, string | number | boolean | undefined>;
  utm?: Record<string, string | undefined>;
  /** Fixed Friday externalId (seat paid re-POST reuses the request's id: "birch-<leadId>"). */
  externalId?: string;
  /** Top-level deal value (seat SKUs: 190 / 490). */
  value?: number;
  currency?: string;
};

export type IntakeResult = { status: "sent" | "skipped" | "failed"; httpStatus?: number; externalId: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SOURCE: Record<IntakeKind, string> = {
  match_tool: "Birch match-your-audience tool",
  hub_access: "Birch brand-hub access (email gate)",
  cobranded_hub_inquiry: "Birch publisher: co-branded hub inquiry",
  display_cpc_inquiry: "Birch publisher: display / CPC ex-hub inquiry",
  publisher_studio: "Birch publisher: studio / retail clinic hub",
  area_lock_interest: "Birch lock-down-my-area",
  agency_inquiry: "Birch agency inquiry",
  deposit_interest: "Birch deposit interest",
  agent_checkout: "Birch AI buying agent checkout",
  seat_hold: "Birch category seat: hold ($190 7-day look)",
  seat_lock: "Birch category seat: lock ($490 named seat)",
  seat_lock_request: "Birch category seat: lock request form",
  seat_waitlist: "Birch category seat: waitlist",
  seat_block_request: "Birch impression block request",
  seat_paid: "Birch category seat: paid checkout",
};

export function intakeExternalId(input: IntakeInput): string {
  if (input.externalId && /^birch-[A-Za-z0-9_-]{4,120}$/.test(input.externalId)) return input.externalId;
  // Seat actions key on category + SKU too, so a buyer holding two categories gets two records.
  const seat = input.kind.startsWith("seat_") ? `|${input.meta?.category ?? ""}|${input.meta?.sku ?? ""}` : "";
  const basis = `${input.kind}|${(input.email ?? "").toLowerCase()}|${(input.website ?? "").toLowerCase()}|${input.message ?? ""}${seat}`;
  return `birch-ovh-${input.kind}-${createHash("sha256").update(basis).digest("hex").slice(0, 16)}`;
}

export function buildIntakePayload(input: IntakeInput, workspace = "birchreserve"): Record<string, unknown> {
  const email = input.email && EMAIL_RE.test(input.email) ? input.email.slice(0, 320) : undefined;
  const [firstName, ...rest] = (input.name ?? "").trim().split(/\s+/).filter(Boolean);
  const meta: Record<string, string | number | boolean> = { source: "form" };
  for (const [k, v] of Object.entries(input.meta ?? {})) if (v !== undefined && v !== "") meta[k] = typeof v === "string" ? v.slice(0, 500) : v;
  for (const [k, v] of Object.entries(input.utm ?? {})) if (v) meta[k] = v.slice(0, 120);
  const lines = [
    `${SOURCE[input.kind]} (Birch inbound).`,
    input.website ? `Website: ${input.website}` : "",
    input.message ? `Message: ${input.message}` : "",
    ...Object.entries(input.meta ?? {}).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}: ${v}`),
  ].filter(Boolean);
  return {
    externalId: intakeExternalId(input),
    ...(email ? { email } : {}),
    ...(firstName ? { firstName: firstName.slice(0, 80) } : {}),
    ...(rest.length ? { lastName: rest.join(" ").slice(0, 80) } : {}),
    ...(input.phone ? { phone: input.phone.slice(0, 40) } : {}),
    ...(input.company || input.website ? { company: (input.company || hostOf(input.website!)).slice(0, 160) } : {}),
    message: lines.join("\n").slice(0, 4000),
    site: "birchreserve.net",
    org: workspace,
    source: SOURCE[input.kind],
    kind: "form",
    ...(input.path ? { path: input.path.slice(0, 200) } : {}),
    stage: "Birch inbound",
    ...(typeof input.value === "number" ? { value: input.value } : {}),
    ...(input.currency ? { currency: input.currency.toUpperCase().slice(0, 3) } : {}),
    tags: ["birch-inbound", "stage:birch-inbound", `birch:${input.kind.replace(/_/g, "-")}`],
    meta,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function sendIntake(input: IntakeInput, env: NodeJS.ProcessEnv = process.env): Promise<IntakeResult> {
  const externalId = intakeExternalId(input);
  if (env.FRIDAY_PUSH_DISABLED === "true") return { status: "skipped", externalId };
  const base = env.FRIDAY_API_URL?.trim();
  const key = env.FRIDAY_API_KEY?.trim();
  if (!base || !key) return { status: "skipped", externalId };
  const b = base.replace(/\/+$/, "");
  const url = /\/api\/intake$/i.test(b) ? b : /\/api$/i.test(b) ? `${b}/intake` : `${b}/api/intake`;
  try {
    const res = await fetch(url, {
      method: "POST",
      // Friday accepts either; PR #159 documents X-Intake-Secret.
      headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-intake-secret": key },
      body: JSON.stringify(buildIntakePayload(input, env.FRIDAY_WORKSPACE?.trim() || "birchreserve")),
      signal: AbortSignal.timeout(8000),
    });
    return { status: res.ok ? "sent" : "failed", httpStatus: res.status, externalId };
  } catch {
    return { status: "failed", externalId };
  }
}

/**
 * Every meaningful action: Friday intake AND the instant email alert, in parallel.
 * Neither can block the other; both statuses come back for the response/logs.
 */

const KIND_ACTION: Partial<Record<IntakeKind, AlertAction>> = {
  seat_hold: "hold",
  seat_lock: "lock",
  seat_lock_request: "lock_request",
  seat_waitlist: "waitlist",
  seat_block_request: "block_request",
  seat_paid: "reservation",
  agent_checkout: "reservation",
  area_lock_interest: "reservation",
  deposit_interest: "reservation",
};

export async function sendIntakeAndAlert(
  input: IntakeInput,
  alert: Partial<SeatAlert> = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<IntakeResult & { alert: AlertResult }> {
  const m = input.meta ?? {};
  const [friday, alertRes] = await Promise.all([
    sendIntake(input, env),
    alertWithin(
      {
        action: KIND_ACTION[input.kind] ?? "form_submit",
        form: input.kind,
        brand: input.company,
        name: input.name,
        email: input.email,
        phone: input.phone,
        website: input.website,
        category: typeof m.category_label === "string" ? m.category_label : typeof m.category === "string" ? m.category : undefined,
        sku: typeof m.sku === "string" ? m.sku : typeof m.offer === "string" ? m.offer : undefined,
        amount: m.amount !== undefined ? `${m.amount}${m.currency ? ` ${String(m.currency).toUpperCase()}` : ""}` : undefined,
        message: input.message,
        page: input.path,
        test: m.is_test === true || m.is_test === "true",
        ...alert,
      },
      6000,
      env,
    ),
  ]);
  return { ...friday, alert: alertRes };
}
