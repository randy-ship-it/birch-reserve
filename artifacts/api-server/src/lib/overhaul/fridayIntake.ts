/**
 * Standalone Friday intake push for overhaul forms (no DB dependency so the
 * preview function can run it). Same contract as lib/fridayPush.ts:
 * POST {FRIDAY_API_URL}/api/intake, Bearer FRIDAY_API_KEY, org=birchreserve.
 * Unset env -> { status: "skipped" } and the caller still answers the visitor.
 */
import { createHash } from "node:crypto";

export type IntakeKind = "match_tool" | "hub_access" | "cobranded_hub_inquiry" | "display_cpc_inquiry" | "publisher_studio" | "area_lock_interest" | "agency_inquiry" | "deposit_interest" | "agent_checkout";

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
};

export function intakeExternalId(input: IntakeInput): string {
  const basis = `${input.kind}|${(input.email ?? "").toLowerCase()}|${(input.website ?? "").toLowerCase()}|${input.message ?? ""}`;
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
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(buildIntakePayload(input, env.FRIDAY_WORKSPACE?.trim() || "birchreserve")),
      signal: AbortSignal.timeout(8000),
    });
    return { status: res.ok ? "sent" : "failed", httpStatus: res.status, externalId };
  } catch {
    return { status: "failed", externalId };
  }
}
