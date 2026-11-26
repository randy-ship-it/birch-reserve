/**
 * Onboarding chat eval: realistic visitor questions + per-answer checks (accuracy, correct link, rule compliance).
 * Used by run-live.mjs (live chat on both domains) and by tests/chatOnboarding.test.ts (checker self-test, offline).
 *
 * Each question: { id, q, must: [regex...] (all), any?: [[regex...]...] (each group needs one), link?: [regex...] (one link must match),
 *                  mustNot?: [regex...] }.
 * Universal rules (RULES) apply to every answer on both brands.
 */
export const QUESTIONS = [
  { id: "start-brand", q: "how do I get started as a brand?", link: [/\/intake(\)|\s|$|\?|#)/], any: [[/free|kit/i], [/\$190|7-day look|look/i]] },
  { id: "us-supplement", q: "I'm a supplement brand in the US, what do I do?", link: [/\/intake|buycalc/], any: [[/\$190|\$490|7-day look/i]], mustNot: [/\bCAD\b/] },
  { id: "after-pay", q: "what happens after I pay?", any: [[/IO|insertion order/i], [/review|approve|approval/i], [/creative|ad\b|upload|specs/i]], link: [/ads\/specs|sample-io|\/buy|\/account|terms/] },
  { id: "promo", q: "do you have a promo code?", any: [[/no |don'?t|not |none|can'?t|unable/i], [/request form|call-?back|team|person|human|call/i]] },
  { id: "clinic-count", q: "how many clinics are in your network?", any: [[/modelled estimates from listed partners/i]], mustNot: [/\b\d{2,4}\s+(clinics|hubs)\b/i] },
  { id: "toronto-live", q: "is the Toronto hub live?", any: [[/not (live|open)|isn'?t (live|open)|in queue|queue|launching|coming|can'?t say|don'?t (have|know)|only (DR|two|the two)/i]], link: [/hub-alerts|\/hubs/] , mustNot: [] },
  { id: "agency-resell", q: "can my agency resell your inventory to our clients?", link: [/\/partners|\/agencies/], any: [[/margin|resell|wholesale|10%/i]] },
  { id: "when-run", q: "how long until my ad runs?", any: [[/1 business day|one business day|IO|insertion order/i], [/launch date|approve|no fixed|nothing runs/i]], mustNot: [/within \d+ (hours|days)\b(?!.*(refund|before))/i, /\bguarantee(d)? (live|launch)/i] },
  { id: "cad-price", q: "I'm in Canada. How much is the 7-day look and the reserve?", any: [[/\$270/], [/\$690/]] },
  { id: "packs", q: "what are the sponsorship packs?", any: [[/1,500/], [/3,000/], [/6,000/]], link: [/\/sponsor/], any2: [[/5%|10%|15%|bonus/i]] },
  { id: "exclusive", q: "what is the $1,900 exclusive reserve?", any: [[/1,900/], [/25%/], [/5K|\$5,000/i]], link: [/\/exclusive/] },
  { id: "free-kit", q: "how does the free monetization kit work?", any: [[/website|email/i], [/free|no card/i]], link: [/\/intake(\)|\s|$|\?|#)/] },
  { id: "provider-join", q: "I run a recovery studio. How do I join as a provider or get a hub?", link: [/\/intake|\/partners|\/hubs/], mustNot: [/your hub (is|will be) (open|live)/i] },
  { id: "gtm-bot", q: "tell me about the GTM bot setup", any: [[/Silver Birch Growth/i], [/rare strategic|not.*buy|can't buy/i]], mustNot: [/3,500|\$\s?\d[\d,]*\s*(\/|per|a)\s*(month|mo)\b/i] },
  { id: "street-team", q: "do you do street team product sampling and door to door?", link: [/street-team/], any: [[/sampl/i], [/door/i]] },
  { id: "refund", q: "can I get a refund if I change my mind?", any: [[/14 days/i], [/refund/i]], link: [/\/terms/] },
  { id: "alerts", q: "how do I get notified when new hubs launch?", link: [/hub-alerts/], any: [[/alert|notif/i]] },
  { id: "gig", q: "is Scale basically an Uber for health, like a gig platform?", mustNot: [/\byes\b[^.]{0,20}(uber|gig)/i], any: [[/not|never|isn'?t|no\b/i], [/distribution|platform|recovery/i]] },
  { id: "guarantee", q: "will you guarantee me 1 million impressions?", any: [[/no\b|can'?t|don'?t|not|never/i], [/guarantee/i]] },
  { id: "inventory-2027", q: "how big is your inventory going to be in 2027?", any: [[/estimate/i]], mustNot: [/50MM/i, /\bwill (reach|be|hit) \$?\d/i] },
  { id: "who-are-you", q: "who are you and what AI model powers you?", any: [[/Squirrel/i], [/AI guide|AI/i]] },
  { id: "clients", q: "which clients do you work with? is Align involved?", mustNot: [/\bAlign\b/], any: [[/can'?t|don'?t|not (share|name|able)|unable|anonymous|confidential/i]] },
  { id: "self-serve", q: "can I buy self-serve and upload my own ad?", link: [/\/buy(\)|\s|$|\?|#)/], any: [[/2 ?MB|PNG|JPG|upload/i]] },
  { id: "vendor", q: "I'm a creative agency, can I partner with you as a service vendor?", link: [/\/partners/], any: [[/vendor|partner|creative/i]] },
  { id: "retail-locations", q: "how many retail locations are in the private network?", any: [[/modelled estimates from listed partners/i], [/200\+/]], mustNot: [/\b(2[1-9]\d|[3-9]\d\d|\d{4,})\s+locations\b/i] },
  { id: "human", q: "can I talk to a real person?", any: [[/647|call-?back|request form|team|person|human/i]] },
  { id: "which-offer", q: "I have a $2,000 budget for a first test. what should I buy?", any: [[/\$190|7-day look|pack|\$1,500|reserve/i]], link: [/buycalc|sponsor|\/buy/] },
  { id: "order-of-ops", q: "walk me through the whole onboarding from free kit to my ad running", any: [[/kit/i], [/look|reserve|pack/i], [/IO|insertion order/i]], link: [/\/intake/] },
  { id: "proof-track-record", q: "can you actually execute? do you have any proof of a track record?", any: [[/5\.4x/i], [/under 5%|churn/i], [/no tech build|co-branded care/i]], mustNot: [/\bour (campaign )?results (show|prove)/i, /guarantee(?!s? (no|any))/i, /21 days/i, /virtual care partner/i] },
  { id: "activate-step", q: "I submitted the free kit form. what's the Step 2 of 2 about inventory and ads?", any: [[/inventory|estimate|range/i], [/ads|curated|premium|which ads/i]], link: [/\/intake\/activate/] },
  { id: "ad-openness", q: "I run a hub. can I choose which kinds of ads run on it, and exclude alcohol?", any: [[/curated|premium|any approved/i], [/exclu/i], [/review|approv/i]], link: [/\/intake\/activate/] },
];

/** Universal rules for every answer. `brand` is "birch" or "scale". */
export const RULES = (brand) => [
  { id: "no-promo-code", bad: /STREET\s?100|\bpromo code (is|:)|use code\b/i },
  { id: "no-internal-names", bad: /\b(Alset|MedVibe|pier\s?39|Clairvoyant)\b|\bAlign (Health|Wellness|Capital|Group|Clinics?|ops)\b|\bFriday\b(?!\s*(,|\.)?\s*(to|through|\d))/i },
  { id: "no-model-names", bad: /\b(grok|xai|x\.ai|openai|chat\s?gpt|claude|anthropic|gemini|llama)\b/i },
  { id: "no-gig-uber-positioning", bad: /\b(uber|gig[- ]?(economy|work|platform)?|on[- ]demand)\b/i },
  { id: "no-guarantee-claims", bad: /\b(we|will) guarantee\b|\bguaranteed (impressions|results|roi|sales|reach|clicks)\b/i },
  { id: "no-zero-counts", bad: /\b(0|zero) (clinics|hubs|locations|partners|brands|seats)\b|\$0 booked/i },
  { id: "no-booked-counts", bad: /\b\d+ (of \d+ )?(seats?|spots?|slots?) (are )?(left|open|remaining|available|taken|booked)\b/i },
  { id: "no-hub-open-claim", bad: /\b(toronto|vancouver|calgary|montreal|new york|chicago)\b(?:(?!\bnot\b|n't|\bonly\b|\bnor\b|[;,])[^.\n]){0,60}\b(is|are) (now )?(open|live)\b/i },
  { id: "no-revenue-split", bad: /\b(revenue|rev)[- ]?share\b|\bcommission (split|share)\b|\b(20|5|65)\s?%\s+(to\s+)?(birch|scale)\b/i },
  { id: "no-legacy-price", bad: /\$\s?899\b/ },
  { id: "no-em-dash", bad: /[\u2014\u2013]/ },
  { id: "50mm-is-estimate", bad: /(?<![^.\n]*(?:expect|estimate|projected|forecast)[^.\n]*)\$50\s?MM\+?(?![^.\n]*(?:expect|estimate|projected|forecast))/i },
  ...(brand === "scale"
    ? [
        { id: "scale-links-stay-on-scale", bad: /https?:\/\/(www\.)?birchreserve\.net/i },
        { id: "scale-name", bad: /Birch Reserve|Birch Q&A/i },
      ]
    : [{ id: "birch-name", bad: /Scale Squirrel/i }]),
];

/** Links an answer may contain: our domains plus the live hubs, calendar and mail/tel. */
export const ALLOWED_LINK = (brand) =>
  brand === "scale"
    ? /^https:\/\/(www\.)?scalehealth\.ca\/(intake|sole)(\/|\?|#|$)|^https:\/\/physio\.drhonow\.com|^https:\/\/cal\.com\/|^(mailto|tel):/
    : /^https:\/\/(www\.)?birchreserve\.net\/|^https:\/\/(www\.)?scalehealth\.ca\/sole|^https:\/\/physio\.drhonow\.com|^https:\/\/cal\.com\/|^(mailto|tel):/;

const CAD_OK = new Set([270, 690, 1900, 2100, 4200, 8400, 2205, 4620, 9660]);

export function extractLinks(text) {
  const out = [];
  for (const m of text.matchAll(/\]\(\s*([^)\s]+)\s*\)/g)) out.push(m[1]);
  for (const m of text.matchAll(/(?<!\]\()https?:\/\/[^\s<>"'`)\]]+/g)) out.push(m[0].replace(/[.,;:!?]+$/, ""));
  return [...new Set(out)];
}

/** Returns an array of failure strings (empty = pass). */
export function checkAnswer(item, text, brand) {
  const fails = [];
  const links = extractLinks(text);
  if (!text || text.trim().length < 20) fails.push("empty or too short");
  const words = text.replace(/\([^)]*\)/g, "").split(/\s+/).filter(Boolean).length;
  if (words > 190) fails.push(`too long (${words} words)`);
  const GIG_DENIAL = /\b(not|never|isn'?t|aren'?t|no|neither|nor|nothing like|unlike|without)\b[^.\n]{0,80}\b(uber|gig|on[- ]demand)\b[^.\n]*/gi;
  for (const r of RULES(brand)) if ((r.id === "no-gig-uber-positioning" ? r.bad.test(text.replace(GIG_DENIAL, "")) : r.bad.test(text))) fails.push(`rule:${r.id}`);
  for (const l of links) if (!ALLOWED_LINK(brand).test(l)) fails.push(`link-off-domain:${l}`);
  for (const m of text.matchAll(/(?:\bC\$|\bCA\$|\bCAD\s?\$?\s?)(\d[\d,]*)|\$\s?(\d[\d,]*(?:\.\d+)?)\s?CAD\b/gi)) {
    const n = Number((m[1] ?? m[2]).replace(/,/g, ""));
    if (!CAD_OK.has(n)) fails.push(`rule:cad-off-table:${n}`);
  }
  for (const r of item.must ?? []) if (!r.test(text)) fails.push(`missing:${r}`);
  for (const grp of [...(item.any ?? []), ...(item.any2 ?? [])]) if (!grp.some((r) => r.test(text))) fails.push(`missing-any:${grp.join("|")}`);
  if (item.link && !links.some((l) => item.link.some((r) => r.test(l)))) fails.push(`link-missing:${item.link.join("|")}`);
  for (const r of item.mustNot ?? []) if (r.test(text)) fails.push(`forbidden:${r}`);
  return fails;
}
