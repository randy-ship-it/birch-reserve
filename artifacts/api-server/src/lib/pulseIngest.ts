/**
 * Pulse ingest (Randy t295u, Nov 20 2026): pulls new Instantly replies hourly, keeps only positive or curious ones,
 * and appends them to the activity pulse as a fixed action key + a fixed "who" label + coarse region + the reply time.
 *
 * Nothing from the email is stored: no name, company, address, domain, subject or quote. Only the campaign decides
 * the "who" label (e.g. Providers campaigns → "Physio clinic") and a QC campaign → "Quebec". Each reply is deduped by
 * a hash of its Instantly id. Conservative by design: declines, unsubscribes, auto-replies, bounces, internal mail,
 * vendors and anything naming a banned party are dropped; if no rule matches, the reply is skipped, never guessed.
 */
import { createHash } from "node:crypto";
import { recordPulse, type PulseAction } from "./activityPulse";

export type InstantlyEmail = {
  id: string;
  timestamp_email?: string;
  from_address_email?: string;
  subject?: string;
  campaign_id?: string | null;
  body?: { text?: string; html?: string } | null;
  content_preview?: string;
};

const INTERNAL = /@(?:[\w-]+\.)*(silverbirchgrowth\.com|scalehealth\.ca|scalehealthpartners\.com|birchreserve\.net|calmjoints\.org|getcalmjoints\.com|alignwellness\.ca|x\.ai|google\.com|instantly\.ai)$/i;
const BANNED = /(align|clairvoyant|alset|medvibe|friday|integrity fitness|pier39|ankita|reiss|80 locations|signed partner|publisher)/i;
const AUTO = /(out of (the )?office|automatic reply|auto-?reply|away from (the|my)|received your (message|email|request)|request received|ticket|check (the )?status of|business hours|currently closed|we are closed|we.re closed|closed for (a|the)|thanks for choosing|undeliverable|delivery (status|failure)|mailer-daemon|postmaster|no-?reply)/i;
/** "Thanks for reaching out" is only an auto-ack when it comes with a we'll-get-back-to-you line. */
const ACK = /thank(s| you) for (reaching out|contacting|emailing|writing|your (email|message|inquiry))/i;
const ACK_TAIL = /(we.?ve received|we have received|(will|shall) (get back|respond|reply|be in touch)|within (\d+|one|1) (business )?(day|hour)|our team (will|is))/i;
const NEGATIVE = /(not interested|pas intéress|no thank|unsubscribe|remove (me|us)|stop (emailing|sending)|not (a fit|a good fit|looking|the right)|pass on this|decline|don.?t think this would work|not at this time|we.?re all set|please don.?t|spam)/i;

/** Campaign name → fixed public "who" label, or null to skip (unknown / internal / contest campaigns). */
export function whoForCampaign(name: string): string | null {
  if (/providers|physio|clinic/i.test(name)) return "Physio clinic";
  if (/cold-75|\bLB\b|studio|hub door/i.test(name)) return "Studio";
  if (/\bCJ\b|venue|sports|golf|hockey|league/i.test(name)) return "Venue";
  if (/brand|\bBR\b|curating|sponsor|nutrition/i.test(name)) return "Health and wellness brand";
  return null;
}
export const regionForCampaign = (name: string): string | null => (/\(QC\)|quebec/i.test(name) ? "Quebec" : null);

/** The new part of a reply: quoted history and signatures cut off, whitespace collapsed. */
export function replyText(e: InstantlyEmail): string {
  const raw = e.body?.text || (e.body?.html ?? "").replace(/<[^>]+>/g, " ") || e.content_preview || "";
  const cut = raw.split(/\n\s*On .{5,120}wrote:|\n>|\nFrom: |-----Original|Le .{5,80}a écrit|Sent from my|Get Outlook/)[0] ?? "";
  return cut.replace(/\s+/g, " ").trim().slice(0, 800);
}

/** Fixed action key for a reply, or null (skip). Order matters: the most specific signal wins. */
export function classifyReply(text: string, subject = ""): PulseAction | null {
  const t = `${subject} ${text}`;
  if (!text || AUTO.test(t) || (ACK.test(text) && ACK_TAIL.test(text)) || NEGATIVE.test(text) || BANNED.test(t)) return null;
  if (/\bsamples?\b.{0,60}\b(on (the|its) way|shipp|sent|sending|send (them|you)|mail|out to you)/i.test(text)) return "samples_confirmed";
  if (/\b(cpc|cpm|cost per (click|thousand)|per click|impressions?)\b/i.test(text)) return "ask_cpc";
  if (/\b(perform|performance|results|conversion|roi|track(ing)?|report(ing|s)?)\b/i.test(text) && /\?/.test(text)) return "ask_performance";
  if (/\b(display|screen|signage|poster|tv|monitor)\b/i.test(text) && /\?/.test(text)) return "ask_display";
  if (/\b(call|chat|meet|zoom|calendar invite|book a time|works for me|i.?m available|let.?s connect)\b/i.test(text)) return "call_booked";
  if (/\b(price|pricing|cost|fee|fees|rates?)\b/i.test(text) && /\?/.test(text)) return "fee_structure";
  if (/\b(love (this|the|it)|great idea|interesting|exciting|impressive|sounds great|cool concept|potential|nice work|well done)\b/i.test(text)) return "compliment";
  if (/\b(tell me more|how does (it|this) work|send (me |us )?more (info|details)|(interested in|like to) (learn|hear|know)(ing)? more)\b/i.test(text)) return "how_it_works";
  return null;
}

export const srcIdFor = (id: string) => `instantly:${createHash("sha256").update(id).digest("hex").slice(0, 20)}`;

export type IngestResult = { ok: true; fetched: number; appended: number; skipped: number } | { ok: false; error: string };

type Fetcher = (path: string) => Promise<unknown>;

function instantlyFetcher(key: string): Fetcher {
  return async (path) => {
    const r = await fetch(`https://api.instantly.ai/api/v2${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`instantly ${r.status}`);
    return r.json();
  };
}

/** Pull received emails newer than `sinceHours`, classify, append. Never throws. */
export async function ingestInstantly(opts: { key?: string; sinceHours?: number; fetcher?: Fetcher; now?: number } = {}): Promise<IngestResult> {
  const key = opts.key ?? process.env.INSTANTLY_API_KEY;
  if (!key && !opts.fetcher) return { ok: false, error: "INSTANTLY_API_KEY not set" };
  const get = opts.fetcher ?? instantlyFetcher(key!);
  const now = opts.now ?? Date.now();
  const since = now - (opts.sinceHours ?? 72) * 36e5;
  try {
    const camps = (await get("/campaigns?limit=100")) as { items?: Array<{ id: string; name: string }> };
    const names = new Map((camps.items ?? []).map((c) => [c.id, c.name]));
    let fetched = 0;
    let appended = 0;
    let skipped = 0;
    let after: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const d = (await get(`/emails?limit=100&email_type=received${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`)) as { items?: InstantlyEmail[]; next_starting_after?: string };
      const items = d.items ?? [];
      let older = false;
      for (const e of items) {
        const at = Date.parse(e.timestamp_email ?? "");
        if (!Number.isFinite(at) || at < since) {
          older = true;
          continue;
        }
        fetched += 1;
        const camp = (e.campaign_id && names.get(e.campaign_id)) || "";
        const who = whoForCampaign(camp);
        const from = e.from_address_email ?? "";
        const action = who && !INTERNAL.test(from) && !BANNED.test(from) ? classifyReply(replyText(e), e.subject ?? "") : null;
        if (!action || !who) {
          skipped += 1;
          continue;
        }
        await recordPulse(action, null, { src: "instantly", who, region: regionForCampaign(camp), at: new Date(at), srcId: srcIdFor(e.id) });
        appended += 1;
      }
      after = d.next_starting_after;
      if (older || !after || !items.length) break;
    }
    return { ok: true, fetched, appended, skipped };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 80) : "ingest failed" };
  }
}
