/**
 * Lead capture for the non-voice sources, all into the single `leads` table:
 *   - Chat Randy: qualify answers / callback intake (randy_chat_sessions qualify +
 *     contact jsonb, #18) → leads row `chat:<sessionId>`
 *   - Advertiser follow-up form (advertiser_intakes) → leads row `intake:<id>`
 *   - Linger email capture → leads row `email:<sha256(email)>` (source email_capture)
 *   - Local Biz Bot shared write → leads row `localbiz:<externalId>` (source local_biz)
 *   - Ads-only inventory signup → leads row `ads:<id>` (source inventory_signup)
 * Each upsert queues a non-blocking Friday CRM push (skipped for is_test rows).
 * Attribution (utm_*, referrer, landing page) rides along, first-touch. Never throws.
 */
import { createHash } from "node:crypto";
import { leadIsActionable, upsertLeadSafe, upsertLeadSafeDetailed, type Attribution, type Lead } from "./leads";
import { queueFridayPush } from "./fridayPush";
import { getTranscriptSession, type TranscriptSession } from "./randyChatTranscripts";
import { isTestIdentity } from "./testTraffic";

/** Widget events that carry intake worth a lead row. */
export const CHAT_LEAD_EVENTS = new Set(["callback_request", "qualified", "tel_click"]);

export function chatLeadInput(s: TranscriptSession, event: string, attribution: Attribution = {}) {
  return {
    id: `chat:${s.id}`,
    source: event === "callback_request" || s.lastHandoff === "callback_request" ? ("chat_callback" as const) : ("chat_intake" as const),
    sourceRef: s.id,
    name: s.contact.name,
    company: s.qualify.company,
    role: s.contact.role,
    phone: s.contact.phone,
    email: s.contact.email,
    need: s.qualify.need ?? s.qualify.category,
    size: s.qualify.size,
    timing: s.qualify.timing,
    pagePath: s.pagePath ?? undefined,
    isTest: s.isTest,
    meta: { category: s.qualify.category, hubs: s.qualify.reach },
    ...attribution,
  };
}

export async function captureChatLead(sessionId: string, event: string, attribution: Attribution = {}): Promise<Lead | undefined> {
  if (!CHAT_LEAD_EVENTS.has(event)) return undefined;
  const s = await getTranscriptSession(sessionId);
  if (!s) return undefined;
  const input = chatLeadInput(s, event, attribution);
  if (!leadIsActionable({ phone: input.phone ?? null, email: input.email ?? null, name: input.name ?? null, company: input.company ?? null })) {
    return undefined;
  }
  const lead = await upsertLeadSafe(input);
  if (lead) queueFridayPush(lead.id);
  return lead;
}

export async function captureAdvertiserIntakeLead(intake: {
  id: string;
  email: string;
  advertisingIntent?: string | null;
  advertiserSize?: string | null;
  adInterest?: string | null;
  source?: string | null;
  isTest?: boolean;
  attribution?: Attribution;
}): Promise<Lead | undefined> {
  const lead = await upsertLeadSafe({
    id: `intake:${intake.id}`,
    source: "advertiser_intake",
    sourceRef: intake.id,
    email: intake.email,
    need: [intake.advertisingIntent, intake.adInterest].filter(Boolean).join(" / ") || undefined,
    size: intake.advertiserSize ?? undefined,
    isTest: Boolean(intake.isTest) || isTestIdentity({ email: intake.email }),
    ...(intake.attribution ?? {}),
  });
  if (lead) queueFridayPush(lead.id);
  return lead;
}

export function emailCaptureLeadId(normalizedEmail: string): string {
  return `email:${createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 32)}`;
}

/** Linger pop-up email capture → leads row (source email_capture) + Friday push. */
export async function captureEmailLead(input: {
  email: string;
  company?: string | null;
  pagePath?: string | null;
  isTest?: boolean;
  attribution?: Attribution;
  now?: Date;
}): Promise<{ lead: Lead | undefined; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const id = emailCaptureLeadId(email);
  const res = await upsertLeadSafeDetailed({
    id,
    source: "email_capture",
    sourceRef: id.slice("email:".length),
    email,
    company: input.company ?? undefined,
    need: "Birch Reserve media kit + seat updates",
    pagePath: input.pagePath ?? undefined,
    isTest: Boolean(input.isTest) || isTestIdentity({ email, name: input.company ?? null }),
    ...(input.attribution ?? {}),
    ...(input.now ? { now: input.now } : {}),
  });
  if (res) queueFridayPush(res.lead.id);
  return { lead: res?.lead, created: Boolean(res?.created) };
}

/** Sanitize Local Biz externalId to safe chars (alphanumeric, dash, underscore, colon, dot). Max 160. */
export function sanitizeLocalBizExternalId(raw: string): string | null {
  const t = raw.trim().slice(0, 160);
  if (!t) return null;
  const safe = t.replace(/[^a-zA-Z0-9_\-.:]/g, "");
  return safe.length ? safe.slice(0, 160) : null;
}

export type LocalBizLeadInput = {
  externalId: string;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  role?: string | null;
  website?: string | null;
  message?: string | null;
  need?: string | null;
  size?: string | null;
  timing?: string | null;
  pagePath?: string | null;
  category?: string | null;
  hubs?: string | null;
  isTest?: boolean;
  attribution?: Attribution;
  now?: Date;
};

function buildLocalBizName(input: LocalBizLeadInput): string | undefined {
  if (input.name?.trim()) return input.name.trim();
  const parts = [input.firstName, input.lastName].map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

function buildLocalBizNeed(input: LocalBizLeadInput): string | undefined {
  const bits = [input.need, input.message, input.website ? `Website: ${input.website.trim()}` : null]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  return bits.length ? bits.join("\n").slice(0, 1000) : undefined;
}

/**
 * Local Biz Bot → Birch Neon leads (source local_biz). Lead id `localbiz:<externalId>`.
 * meta.friday_external_id = externalId so Friday intake stays idempotent with Local Biz's own push.
 * Never throws.
 */
export async function captureLocalBizLead(
  input: LocalBizLeadInput,
): Promise<{ lead: Lead | undefined; created: boolean }> {
  const externalId = sanitizeLocalBizExternalId(input.externalId);
  if (!externalId) return { lead: undefined, created: false };
  const email = typeof input.email === "string" && input.email.trim() ? input.email.trim().toLowerCase() : undefined;
  const phone = typeof input.phone === "string" && input.phone.trim() ? input.phone.trim() : undefined;
  const name = buildLocalBizName(input);
  const company = typeof input.company === "string" && input.company.trim() ? input.company.trim() : undefined;
  if (!email && !phone) return { lead: undefined, created: false };
  const isTest =
    Boolean(input.isTest) ||
    isTestIdentity({ email: email ?? null, name: name ?? company ?? null, label: externalId });
  const res = await upsertLeadSafeDetailed({
    id: `localbiz:${externalId}`,
    source: "local_biz",
    sourceRef: externalId,
    name,
    company,
    role: typeof input.role === "string" && input.role.trim() ? input.role.trim() : undefined,
    phone,
    email,
    need: buildLocalBizNeed(input),
    size: typeof input.size === "string" && input.size.trim() ? input.size.trim() : undefined,
    timing: typeof input.timing === "string" && input.timing.trim() ? input.timing.trim() : undefined,
    pagePath: typeof input.pagePath === "string" && input.pagePath.trim() ? input.pagePath.trim() : undefined,
    isTest,
    meta: {
      friday_external_id: externalId,
      ...(typeof input.category === "string" && input.category.trim() ? { category: input.category.trim() } : {}),
      ...(typeof input.hubs === "string" && input.hubs.trim() ? { hubs: input.hubs.trim() } : {}),
    },
    ...(input.attribution ?? {}),
    ...(input.now ? { now: input.now } : {}),
  });
  if (res) queueFridayPush(res.lead.id);
  return { lead: res?.lead, created: Boolean(res?.created) };
}


/**
 * Ads-only inventory host signup -> leads row `ads:<id>` (source inventory_signup).
 * meta.friday_external_id = birch-ads-<id>. Notes fold into need for Friday message.
 * Never throws (upsertLeadSafe).
 */
export async function captureInventorySignupLead(input: {
  id: string;
  company: string;
  name: string;
  email: string;
  phone?: string;
  audienceEstimate: string;
  inventoryTypes: string[];
  notes?: string;
  pagePath?: string;
  isTest?: boolean;
  attribution?: Attribution;
}): Promise<Lead | undefined> {
  const types = input.inventoryTypes.map((x) => x.trim()).filter(Boolean);
  const needBase = types.join(",");
  const notes = typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : "";
  const need = (notes ? `${needBase}\nNotes: ${notes}` : needBase).slice(0, 1000);
  const email = input.email.trim().toLowerCase();
  const lead = await upsertLeadSafe({
    id: `ads:${input.id}`,
    source: "inventory_signup",
    sourceRef: input.id,
    name: input.name,
    company: input.company,
    email,
    phone: input.phone,
    need,
    size: input.audienceEstimate,
    pagePath: input.pagePath,
    isTest: Boolean(input.isTest) || isTestIdentity({ email, name: input.name }),
    meta: {
      friday_external_id: `birch-ads-${input.id}`.slice(0, 160),
    },
    ...(input.attribution ?? {}),
  });
  if (lead) queueFridayPush(lead.id);
  return lead;
}
