/**
 * Lead capture for the non-voice sources, all into the single `leads` table:
 *   - Chat Randy: qualify answers / callback intake (randy_chat_sessions qualify +
 *     contact jsonb, #18) → leads row `chat:<sessionId>`
 *   - Advertiser follow-up form (advertiser_intakes) → leads row `intake:<id>`
 * Each upsert queues a non-blocking Friday CRM push. Never throws.
 */
import { leadIsActionable, upsertLeadSafe, type Lead } from "./leads";
import { queueFridayPush } from "./fridayPush";
import { getTranscriptSession, type TranscriptSession } from "./randyChatTranscripts";

/** Widget events that carry intake worth a lead row. */
export const CHAT_LEAD_EVENTS = new Set(["callback_request", "qualified", "tel_click"]);

export function chatLeadInput(s: TranscriptSession, event: string) {
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
  };
}

export async function captureChatLead(sessionId: string, event: string): Promise<Lead | undefined> {
  if (!CHAT_LEAD_EVENTS.has(event)) return undefined;
  const s = await getTranscriptSession(sessionId);
  if (!s) return undefined;
  const input = chatLeadInput(s, event);
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
}): Promise<Lead | undefined> {
  const lead = await upsertLeadSafe({
    id: `intake:${intake.id}`,
    source: "advertiser_intake",
    sourceRef: intake.id,
    email: intake.email,
    need: [intake.advertisingIntent, intake.adInterest].filter(Boolean).join(" / ") || undefined,
    size: intake.advertiserSize ?? undefined,
  });
  if (lead) queueFridayPush(lead.id);
  return lead;
}
