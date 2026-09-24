/**
 * Lead capture for the non-voice sources, all into the single `leads` table:
 *   - Chat Randy: qualify answers / callback intake (randy_chat_sessions qualify +
 *     contact jsonb, #18) → leads row `chat:<sessionId>`
 *   - Advertiser follow-up form (advertiser_intakes) → leads row `intake:<id>`
 *   - Linger email capture → leads row `email:<sha256(email)>` (source email_capture)
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
