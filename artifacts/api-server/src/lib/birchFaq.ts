/**
 * Deterministic Birch FAQ answers for the site chat when the LLM provider is
 * down (Randy Nov 13 2026: chat must always answer). Same facts as
 * birchCanonicalFacts(); no model call, no invented numbers.
 */
import { BIRCH_SALES_EMAIL, BIRCH_SALES_PHONE } from "./birchFacts";

type Msg = { role: "user" | "assistant"; content: string };
export type FaqResult = { text: string; callback: Record<string, string> | null; intent: string };

const BUY = "https://birchreserve.net/buycalc";
const REQ = "https://birchreserve.net/buycalc#request";
const KIT = "https://birchreserve.net/media-kit";

const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const BIG_RE = /premium|exclusiv|\$?\s?\d{2,3}\s?k\b|\$\s?\d{2,3},\d{3}|10,?000|25,?000|50,?000|partnership|national|enterprise|call ?back|call me|talk to (a )?(person|human|someone|randy)|speak (to|with)/i;

function field(text: string, re: RegExp): string {
  const m = text.match(re);
  return (m?.[1] ?? "").trim().replace(/[.,;]+$/, "");
}

export function parseCallbackDetails(text: string): Record<string, string> {
  const phone = text.match(PHONE_RE)?.[0] ?? "";
  const email = text.match(EMAIL_RE)?.[0] ?? "";
  let name = field(text, /(?:my name is|name is|name:|i'm|i am|this is)\s+([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,3})/i);
  if (!name) {
    const first = text.split(/[,\n]/)[0]?.replace(/^(sure|yes|ok(ay)?|yeah)[.!,]?\s*/i, "").trim() ?? "";
    if (first && first.length <= 40 && !PHONE_RE.test(first) && !EMAIL_RE.test(first)) name = first;
  }
  const company = field(text, /(?:company|brand|from|at|with)\s*(?:is|:)?\s+([^,\n]+?)(?=,|\n|$| phone| email)/i);
  const best_time = field(text, /(?:best time(?: to call)?|call me|reach me)\s*(?:is|:)?\s*([^,\n]+)/i);
  return Object.fromEntries(Object.entries({ name, company, phone, email, best_time }).filter(([, v]) => v));
}

export function birchFaqAnswer(messages: Msg[]): FaqResult {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const t = lastUser.toLowerCase();
  const history = messages.map((m) => m.content).join("\n");
  const inCallbackFlow = BIG_RE.test(history) && /name, company, phone|best time to call/i.test(messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n"));

  if ((PHONE_RE.test(lastUser) || EMAIL_RE.test(lastUser)) && (inCallbackFlow || BIG_RE.test(history))) {
    const c = parseCallbackDetails(lastUser);
    const interest = field(history, /(premium[^.\n]{0,80}|exclusive[^.\n]{0,80}|partnership[^.\n]{0,80})/i);
    const budget = field(history, /(\$\s?\d[\d,.]*\s?k?\b|\b\d{2,3}\s?k\b)/i);
    const callback = { ...c, ...(interest ? { interest } : {}), ...(budget ? { budget } : {}) };
    return {
      intent: "callback_submit",
      callback,
      text: `Thanks${c.name ? `, ${c.name.split(" ")[0]}` : ""}. I've sent your call-back request to the Birch team${c.best_time ? ` for ${c.best_time}` : ""}. They'll reach you at ${c.phone || c.email}. If you'd rather not wait, call ${BIRCH_SALES_PHONE}.`,
    };
  }
  if (/exclusiv|one brand/.test(t) && /490|seat/.test(t) && !/premium|\d{2,3}\s?k\b/.test(t)) {
    return { intent: "exclusive", callback: null, text: `The $490 seat isn't exclusive. It takes one of 8 self-serve seats, and seats are open to more than one brand per category. Category exclusivity (one brand per category for the term) is a premium slot, $25,000 to $50,000, inquire only. Want the team to call you about premium?` };
  }
  if (BIG_RE.test(t)) {
    return {
      intent: "premium",
      callback: null,
      text: `Premium slots run $25,000 to $50,000 USD and are inquire only: one brand per category for the term, a larger display share and priority placement, set on an insertion order. Randy's team will call you. What's your name, company, phone, email and best time to call? Or call ${BIRCH_SALES_PHONE} now.`,
    };
  }
  if (/guarantee|ctr|click|impression|reach|results|roi/.test(t)) {
    return { intent: "guarantee", callback: null, text: `No. We don't guarantee impressions, clicks, reach or a CTR. Any impression figure we show is a modelled estimate (about $8 to $12 CPM). Reporting is aggregate only: UTM links and promo codes per hub and surface. All spend is media credit until the insertion order names the hub and surface.` };
  }
  if (/agenc|commission|cut|kickback|referral fee/.test(t)) {
    return { intent: "agency", callback: null, text: `The agency of record earns 10% of media spend, paid in cash per the IO. A $490 seat pays the agency $49; a $25,000 premium slot pays $2,500. You can book a client seat yourself at ${BUY}.` };
  }
  if (/exclusiv|one brand|competitor|lock (the|my) category/.test(t)) {
    return { intent: "exclusive", callback: null, text: `The $490 seat isn't exclusive. It takes one of 8 self-serve seats, and seats are open to more than one brand per category. Category exclusivity (one brand per category for the term) is a premium slot, $25,000 to $50,000, inquire only.` };
  }
  if (/refund|cancel|money back|terms/.test(t)) {
    return { intent: "refund", callback: null, text: `The $490 seat is 100% media credit until the insertion order. It's fully refundable until 14 days before the launch date on the IO, then usable for 12 months. If no approved surface is named within 60 days, it's a cash refund. The $190 look converts in full to the seat within 7 days, otherwise it's refunded.` };
  }
  if (/buy|checkout|purchase|sign up|get started|how do i|pay|490|190|seat|look|book/.test(t)) {
    return { intent: "buy", callback: null, text: `Here's how: open ${BUY}, pick the $490 seat (or the $190 7-day look), pick your category, add your brand name and work email, tick the terms box, then pay on the secure Stripe checkout. Prices show in USD or CAD. Not ready, or your category isn't listed? Use the request form at ${REQ}. No card needed.` };
  }
  if (/categor|open|available|left|inventory|spots|slots/.test(t)) {
    return { intent: "categories", callback: null, text: `There are 8 categories: pain relief / topicals, recovery hardware, nutrition, sleep, meal prep, women's health, men's health, and diagnostics / services. There are 8 self-serve seats in total, and the live open count is at ${BUY}.` };
  }
  if (/proof|see|example|hub|where|show|who sees/.test(t)) {
    return { intent: "proof", callback: null, text: `See the face before the flight: live hubs anyone can open now are https://www.scalehealth.ca/integrity (Integrity Fitness x Scale Health) and https://physio.drhonow.com (DR-HO'S). Ads sit on the thank-you page, the hub home page, product and services pages, and the member dashboard. The media kit is ${KIT}.` };
  }
  if (/price|cost|how much|rate|pricing|budget|package/.test(t)) {
    return { intent: "price", callback: null, text: `Three ways in. The 7-day look is $190 USD ($270 CAD), and it converts to a seat within 7 days or is refunded. A category seat is $490 USD ($690 CAD), 100% media credit until the IO. Premium slots run $25,000 to $50,000 and are inquire only. Start at ${BUY}.` };
  }
  if (/phone|call|email|contact|reach/.test(t)) {
    return { intent: "contact", callback: null, text: `Call ${BIRCH_SALES_PHONE} or email ${BIRCH_SALES_EMAIL}. For a premium slot, send me your name, company, phone, email and best time, and the team will call you.` };
  }
  return {
    intent: "general",
    callback: null,
    text: `Birch Reserve sells display seats inside private Scale Health hubs, right after a member books or buys. A seat is $490 (or take a 7-day look for $190), and premium slots are $25,000 and up. Want to lock a seat at ${BUY}, or have the team call you?`,
  };
}
