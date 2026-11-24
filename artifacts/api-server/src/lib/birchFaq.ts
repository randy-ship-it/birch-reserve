/**
 * Deterministic Birch FAQ answers for the site chat when the LLM provider is
 * down (Randy Nov 13 2026: chat must always answer). Same facts as
 * birchCanonicalFacts(); no model call, no invented numbers.
 */
import { BIRCH_SALES_EMAIL } from "./birchFacts";
import { ladderLine, liveLine, activatingLine, ladderMarkdown, MORE_LAUNCHING } from "./hubLadder";

type Msg = { role: "user" | "assistant"; content: string };
export type FaqResult = { text: string; callback: Record<string, string> | null; intent: string };

const BUY = "https://birchreserve.net/buycalc";
const REQ = "https://birchreserve.net/buycalc#request";
const KIT = "https://birchreserve.net/media-kit";
const INTAKE = "https://birchreserve.net/intake";

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
      text: `Thanks${c.name ? `, ${c.name.split(" ")[0]}` : ""}. I've sent your request to the Birch team. They'll reply by email at ${c.email || c.phone}.`,
    };
  }
  if (/get(ting)? started|onboard|how do i (start|sign up|begin|join|apply)|where do i (start|sign up)|what do i do/.test(t)) {
    return { intent: "start", callback: null, text: `Here's the path for a brand:\n1. Get the free Monetization Kit (website and email, no card): [Start the kit](${INTAKE})\n2. Pick your channels: branded hubs, the private retail network across Canada and the USA, or Calm Joints with the Street Team\n3. Start small: the $190 USD 7-day look ($270 CAD in Canada): [See the look](${BUY}?sku=hold-190)\n4. Scale up with a sponsorship pack or the exclusive reserve\nNothing runs until you approve an insertion order. Want the request form? [Request form](${REQ})` };
  }
  if (/\buber\b|\bgig\b|on-?demand|taskrabbit|freelanc/.test(t)) {
    return { intent: "positioning", callback: null, text: `No. Scale Health is a distribution platform that started in Recovery, where it is vertically integrated, and it is growing into more health and wellness categories. It is never gig, Uber-type or on-demand. Want the free kit or the request form? [Start the kit](${INTAKE})` };
  }
  if (/which clients|your clients|client list|who do you work with|case stud|testimonial|\balign\b|\balset\b|clairvoyant|medvibe|pier\s?39|investor/.test(t)) {
    return { intent: "confidential", callback: null, text: `We keep client and partner details confidential, so I can't share or confirm names. What I can share: ${liveLine()} Want the request form? [Request form](${REQ})` };
  }
  if (/\bcad\b|canadian|canada|currency|us dollars|\busd\b|exchange rate/.test(t)) {
    return { intent: "currency", callback: null, text: `Visitors in Canada see and pay CAD ($270 CAD for the 7-day look, $690 CAD to reserve); everyone else pays USD ($190 and $490). The currency shown at checkout is the currency you're charged, and there's a toggle on the page. Start at ${BUY}, or ask us anything first at ${REQ}.` };
  }
  if (/anyone else|who else|other brands?|competitor|already (in|taken|booked)|someone else/.test(t)) {
    return { intent: "competition", callback: null, text: `We don't share who has reserved or how much space is taken. The $490 USD reserve is a shared category reserve, so it isn't exclusive; owning your category is a premium slot ($25,000 to $50,000 USD, inquire only). Placements are curated hub by hub, so reserving now gets you in as hubs launch: ${BUY}` };
  }
  if (/\b(how (long|soon|quickly|fast)|when)\b.*\b(live|run|running|start|launch|show|showing|appear|up)\b|\b(go|goes|going) live\b|turnaround|lead time/.test(t)) {
    return { intent: "timing", callback: null, text: `There's no fixed go-live time. After checkout a person reviews your ad, and we reply within 1 business day with the insertion order naming the hub, placement and launch date. Your ad runs from that launch date once you approve the IO; nothing runs before that. The quickest first step is the $190 USD 7-day look: ${BUY}` };
  }
  if (/how (does|do|would) (it|this|birch|the reserve)( \w+)? work|how it works|what happens (after|next|when)|the process/.test(t)) {
    return { intent: "how", callback: null, text: `Three steps: reserve your space for $490 USD (or take a $190 USD 7-day look first), pay by card on the Stripe checkout with no login, then approve the insertion order that names the hub and placement. After you pay you get a receipt, send your ad (specs at https://birchreserve.net/ads/specs), and a person reviews it. Nothing runs before you approve the IO, and the full amount is media credit. Start at ${BUY}` };
  }
  if (/audience|who (will |would )?(see|sees)|who are (the )?members|demographic|who do (you|i) reach|who('s| is) the (audience|customer)/.test(t)) {
    return { intent: "audience", callback: null, text: `Members of private, members-only health and wellness hubs, reached right after they book or buy and when they log back in. ${ladderLine()} You can open a live hub now at https://physio.drhonow.com (DR-HO'S) or https://www.scalehealth.ca/sole (SOLE), or reserve at ${BUY}.` };
  }
  if (/exclusiv|one brand/.test(t) && /490|seat/.test(t) && !/premium|\d{2,3}\s?k\b/.test(t)) {
    return { intent: "exclusive", callback: null, text: `The $490 reserve isn't exclusive. It reserves a share of display space across the hub network, curated as hubs launch. Exclusivity is a premium slot, $25,000 to $50,000, inquire only. Want the team to call you about premium?` };
  }
  if (BIG_RE.test(t)) {
    return {
      intent: "premium",
      callback: null,
      text: `Premium slots run $25,000 to $50,000 USD and are inquire only: exclusivity, a larger display share and priority placement, set on an insertion order. Send the request form at ${BUY}#request and we reply by email.`,
    };
  }
  if (/guarantee|ctr|click|impression|reach|results|roi/.test(t)) {
    return { intent: "guarantee", callback: null, text: `No. We don't guarantee impressions, clicks, reach or a CTR. Any impression figure we show is a modelled estimate (about $8 to $12 CPM). Reporting is aggregate only: UTM links and promo codes per hub and surface. All spend is media credit until the insertion order names the hub and surface.` };
  }
  if (/agenc|commission|cut|kickback|referral fee/.test(t)) {
    return { intent: "agency", callback: null, text: `The agency of record earns 10% of media spend, paid in cash per the IO. A $490 reserve pays the agency $49; a $25,000 premium slot pays $2,500. You can reserve space for a client yourself at ${BUY}.` };
  }
  if (/exclusiv|one brand|competitor|lock (the|my) category/.test(t)) {
    return { intent: "exclusive", callback: null, text: `The $490 reserve isn't exclusive. It reserves a share of display space across the hub network, curated as hubs launch. Exclusivity is a premium slot, $25,000 to $50,000, inquire only.` };
  }
  if (/refund|cancel|money back|terms/.test(t)) {
    return { intent: "refund", callback: null, text: `The $490 reserve is 100% media credit until the insertion order. It's fully refundable until 14 days before the launch date on the IO, then usable for 12 months. If no approved surface is named within 60 days, it's a cash refund. The $190 look converts in full to the reserve within 7 days, otherwise it's refunded.` };
  }
  if (/buy|checkout|purchase|sign up|get started|how do i|pay|490|190|seat|look|book/.test(t)) {
    return { intent: "buy", callback: null, text: `Here's how: open ${BUY}, pick the $490 reserve (or the $190 7-day look), add your brand name and work email, tick the terms box, then pay on the secure Stripe checkout. Prices are in USD (CAD for visitors in Canada). Not ready, or want something custom? Use the request form at ${REQ}. No card needed.` };
  }
  if (/categor|open|available|left|inventory|spots|slots/.test(t)) {
    return { intent: "categories", callback: null, text: `You get a share of display space across our growing network of private, members-only health and wellness hubs, with more launching. Placements are curated by hand as each hub launches. Reserve at ${BUY}.` };
  }
  if (/proof|see|example|hub|where|show|who sees/.test(t)) {
    return { intent: "proof", callback: null, text: `See the face before the flight: live hubs anyone can open now are https://physio.drhonow.com (DR-HO'S), https://www.scalehealth.ca/sole (SOLE), https://www.scalehealth.ca/integrity (Integrity Fitness) and https://www.scalehealth.ca/calmjoints (Calm Joints). Ads sit on the thank-you page, the hub home page, product and services pages, and the member dashboard. The media kit is ${KIT}.` };
  }
  if (/price|cost|how much|rate|pricing|budget|package/.test(t)) {
    return { intent: "price", callback: null, text: `Three ways in. The 7-day look is $190 USD, and it converts to the reserve within 7 days or is refunded. Reserving is $490 USD, 100% media credit until the IO. Premium slots run $25,000 to $50,000 and are inquire only. Start at ${BUY}.` };
  }
  if (/phone|call|email|contact|reach/.test(t)) {
    return { intent: "contact", callback: null, text: `Email ${BIRCH_SALES_EMAIL}, or buy ads now at ${BUY}. For a premium slot, use the request form at ${BUY}#request.` };
  }
  return {
    intent: "general",
    callback: null,
    text: `Birch Reserve sells display space inside private, members-only health and wellness hubs, right after a member books or buys. Reserve for $490 USD or take a 7-day look for $190 USD at ${BUY}. Not ready? Send a quick question with no card at ${REQ}, or email ${BIRCH_SALES_EMAIL}.`,
  };
}
