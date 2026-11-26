/**
 * Agency showcase (birchreserve.net home, Nov 12 2026, Randy via Emma 7:34 PM ET).
 * Pure numbers shared by the home page and its tests. No Node imports.
 *
 * Every figure here is re-used from an existing source, never invented:
 *   - agency discount: AGENCY_CASH_PCT in ./mediaKit = AGENCY.commissionPct in ./model
 *     (live /agencies + AGENCY.line: standard 15% agency commission off the gross rate card).
 *   - starting CPMs: SURFACES (./model) / RATE_SURFACES (./pricing), illustrative estimates.
 *   - 20MM+ orders: TAM.ordersLabel (./model), modelled.
 *   - sell assumption: Randy 7:33 PM ET, "20% of available display space". An ASSUMPTION.
 * No payout schedule is stated anywhere: timing reads "per the IO", never a date.
 */
import { AGENCY_CASH_PCT, BLOCK_BAND_LINE, MEDIA_KIT_OFFERS, agencyCash } from "./mediaKit";
import { AGENCY, DEPOSIT_TIERS, SURFACES, TAM, INVENTORY } from "./model";
import { RATE_SURFACES } from "./pricing";
import { isPremiumPlacement } from "../premiumInquireOnly";

/** Randy, Nov 12 2026 7:33 PM ET: default sell assumption. Planning only, not a delivery commitment. */
export const SELL_ASSUMPTION_PCT = 20;
export const SELL_ASSUMPTION_LINE = `Planning assumption: we model selling ${SELL_ASSUMPTION_PCT}% of available display space on each placement. An assumption, not a delivery commitment; your IO sizes views against live hub supply.`;

/** Randy, Nov 24 2026: standard 15% agency commission off the gross rate card. */
export const AGENCY_SHARE = {
  pct: AGENCY_CASH_PCT,
  matchesModel: AGENCY_CASH_PCT === AGENCY.commissionPct,
  line: `Agencies earn the standard ${AGENCY_CASH_PCT}% agency commission off the gross rate card.`,
  timing: "The discount is written into the insertion order.",
} as const;

/**
 * Brand bonus credit: already stated for brands on /advertise/brands (DEPOSIT_TIERS, +5/+10/+15%).
 * It is the client's media credit, separate from the standard 15% agency commission.
 */
export const BRAND_BONUS_LINE = `Client tests start self-serve on the $190 USD 7-day look or the $490 USD reserve; premium slots by inquiry. Separate from the standard ${AGENCY_CASH_PCT}% agency commission.`;

/** Worked examples on the public tiers: $490 seat (card) and the $25K premium floor (inquire). */
export const AGENCY_EXAMPLES = [
  { label: "$490 USD reserve (card)", spend: 490 },
  { label: `Premium slot from $${MEDIA_KIT_OFFERS.premium.spendLo / 1000}K (inquire)`, spend: MEDIA_KIT_OFFERS.premium.spendLo },
].map((e) => ({ ...e, cash: agencyCash(e.spend) }));

/** Agency client test band ($1K–$5K, one IO per client). Same figures as AGENCY_TEST in ../twoLane. */
export const AGENCY_CLIENT_TEST = { lo: 1_000, hi: 5_000 } as const;

/**
 * The /agencies payout table in the visitor's currency (daily scan Nov 23 2026).
 * Bug fixed: CAD visitors saw "$690 CAD reserve vs $49 USD discount" because the page relabelled USD
 * text but kept the USD cash figure. Cash is now 10% of the seat price actually shown ($690 CAD -> $69 CAD).
 * Other rows keep the same number in both currencies (the site rule when no CAD table exists).
 * No new prices: seat price comes from /api/currency (priceFor), bands are the ones already on /agencies.
 */
export function agencyPayoutRows(seatPrice: number, cur: "USD" | "CAD") {
  const m = (n: number) => `$${n.toLocaleString("en-US")}`;
  const pays = (n: number) => m(n - agencyCash(n));
  return [
    { key: "seat", label: `${m(seatPrice)} ${cur} reserve (card)`, spend: m(seatPrice), cash: m(agencyCash(seatPrice)), pays: pays(seatPrice) },
    {
      key: "client_test",
      label: "Client test (IO)",
      spend: `${m(AGENCY_CLIENT_TEST.lo / 1000)}K–${m(AGENCY_CLIENT_TEST.hi / 1000)}K`,
      cash: `${m(agencyCash(AGENCY_CLIENT_TEST.lo))}–${m(agencyCash(AGENCY_CLIENT_TEST.hi))}`,
      pays: `${pays(AGENCY_CLIENT_TEST.lo)}–${pays(AGENCY_CLIENT_TEST.hi)}`,
    },
    {
      key: "premium",
      label: `Premium slot from ${m(MEDIA_KIT_OFFERS.premium.spendLo / 1000)}K (inquire)`,
      spend: m(MEDIA_KIT_OFFERS.premium.spendLo),
      cash: m(agencyCash(MEDIA_KIT_OFFERS.premium.spendLo)),
      pays: pays(MEDIA_KIT_OFFERS.premium.spendLo),
    },
  ];
}

const CPC_BY_SURFACE: Record<(typeof SURFACES)[number]["key"], number> = {
  post_purchase: RATE_SURFACES.find((s) => s.key === "post_purchase")!.cpcStarter[0],
  hub_home: RATE_SURFACES.find((s) => s.key === "landing")!.cpcStarter[0],
  product_services: RATE_SURFACES.find((s) => s.key === "products")!.cpcStarter[0],
  member_dashboard: RATE_SURFACES.find((s) => s.key === "dashboard")!.cpcStarter[0],
};

const UNITS: Record<(typeof SURFACES)[number]["key"], string> = {
  post_purchase: "Post-checkout module",
  hub_home: "Top-of-hub banner, native tiles",
  product_services: "In-page display, booking confirmation",
  member_dashboard: "Native hub module, logged-in",
};

const MOMENT: Record<(typeof SURFACES)[number]["key"], string> = {
  post_purchase: "Right after a paid order or booking",
  hub_home: "Arrival on the co-branded hub",
  product_services: "Browsing products, services and booking",
  member_dashboard: "Return visits behind login",
};

/** One row per hub placement: the spec sheet. Post-Purchase is inquire-only (PREMIUM_INQUIRE_ONLY). */
export const SPEC_ROWS = SURFACES.map((s) => ({
  key: s.key,
  label: s.label,
  unit: UNITS[s.key],
  moment: MOMENT[s.key],
  cpmFloorUsd: s.cpmUsd,
  cpcFloorUsd: CPC_BY_SURFACE[s.key],
  inquire: isPremiumPlacement(s.key),
}));

/**
 * Plan by goal (daily scan, Nov 17 2026; Uber Advertising-style full-funnel framing).
 * Maps a client brief's goal to the hub placement that fits it. Rates and "how to buy" are read
 * from SPEC_ROWS (no new prices); "measured by" lists only the reporting already published
 * (views, clicks, UTM visits, promo-code redemptions). No lift, CTR or reach claims.
 */
const GOALS: Array<{ key: string; goal: string; brief: string; placement: (typeof SURFACES)[number]["key"]; measure: string }> = [
  { key: "awareness", goal: "Awareness", brief: "Get the brand seen by health and wellness members.", placement: "hub_home", measure: "Views and clicks" },
  { key: "consideration", goal: "Consideration", brief: "Sit next to products, services and bookings while members browse.", placement: "product_services", measure: "Clicks and UTM visits" },
  { key: "conversion", goal: "Conversion", brief: "Reach members right after they've paid for an order or booking.", placement: "post_purchase", measure: "UTM visits and promo-code redemptions" },
  { key: "loyalty", goal: "Retention & loyalty", brief: "Stay in front of members who come back to their account.", placement: "member_dashboard", measure: "Clicks and promo-code redemptions" },
];

export const GOAL_PLAN = GOALS.map((g) => {
  const row = SPEC_ROWS.find((r) => r.key === g.placement)!;
  return { ...g, label: row.label, moment: row.moment, cpmFloorUsd: row.cpmFloorUsd, cpcFloorUsd: row.cpcFloorUsd, inquire: row.inquire, buy: row.inquire ? "Insertion order (inquire)" : "Card reserve or insertion order" };
});

/**
 * In plain terms (Nov 18 2026 daily scan; CVS Media Exchange-style category explainer).
 * Five answers a planner can forward to a client. Every answer restates copy already published on
 * home, /audiences, /agencies, /media-kit or /terms: no new prices, no counts, no reach or lift claims.
 * Rendered on /agencies#plain-terms and emitted server-side as FAQPage JSON-LD (crawlable without JS).
 */
export const PLAIN_TERMS: Array<{ key: string; q: string; a: string }> = [
  {
    key: "what",
    q: "What is Birch Reserve?",
    a: "Display and CPC ad space inside private health and wellness hubs: co-branded hubs from Recovery Brands, and health and wellness business hubs such as physio, gym, studio and clinic hubs. It is not an open auction or a public ad network. Placements run inside a private member experience, and every brand is hand-picked to fit the audience.",
  },
  {
    key: "moment",
    q: "Which moment does a placement reach?",
    a: "Each hub has four placements: post-purchase, right after a paid order or booking (premium, by insertion order); the hub home page; product and services pages; and the member dashboard behind login. Each can be bought as display (priced per thousand views) or CPC (priced per click).",
  },
  {
    key: "data",
    q: "Where do the audience figures come from?",
    a: "Every figure is labelled. Measured figures come from our own hub analytics and are shown as shares. Modelled figures are built from the customers of the brands launching on the network. Market context is cited public research about the population, not our reach. None of it is audited delivery; your campaign itself is measured with UTM links and promo codes.",
  },
  {
    key: "report",
    q: "What does the client get back?",
    a: "Aggregate reporting per hub and surface: views, clicks, UTM visits and promo-code redemptions. Never names, contact details or health information.",
  },
  {
    key: "start",
    q: "How does a client start, and what is the risk?",
    a: "Self-serve with the $190 USD 7-day look, which converts in full to the reserve within 7 days or is refunded, or the $490 USD reserve: 100% media credit, fully refundable until 14 days before the launch date on the insertion order. Premium slots are by inquiry. Nothing runs until the IO names the hub and surface.",
  },
];

/** The /agencies FAQ (moved here from the page on Nov 18 2026 so the server can emit one FAQPage). */
export const AGENCY_FAQ: Array<{ q: string; a: string }> = [
  { q: "Can we prepay for several clients?", a: "Yes. One prepay can be split across clients; each client gets its own insertion order and reporting." },
  { q: "Is there an agency commission?", a: "Yes. Agencies, brokers and media resellers earn the standard 15% agency commission off the gross rate card. You set your own resale price and handle your own client disclosure. Direct buyers pay the rate card. We do not undercut an agency's client. Small tests can start self-serve on the $190 USD look or the $490 USD reserve." },
  { q: "Which placement fits which goal?", a: "Awareness: the hub home page. Consideration: product, services and booking pages. Conversion: post-purchase, right after a paid order or booking (premium, by insertion order). Retention and loyalty: the member dashboard behind login. One IO can mix them." },
  { q: "How is performance tracked?", a: "Every placement carries your UTM parameters and, if you want, a promo code. We report views and clicks per hub and surface. Aggregate only." },
  { q: "What is reserved partner inventory?", a: "A limited set-aside of exclusive packages and newly activating hubs, for a few agencies. Agencies that commit to an inventory block get a further 10–20% off the net agency rate, on top of the standard 15% agency commission. Block size and term set the tier. Partners also get first look as new hubs activate. Send a note on the agency form if that is useful." },
  { q: "Do brokers and media resellers qualify?", a: "Yes. When you are the agency of record on the insertion order, you earn the same standard 15% agency commission. You set your own resale price and handle your own client disclosure. List every brand you represent in one inquiry; each gets its own IO and reporting." },
  { q: "Is it brand safe?", a: "Ads run in post-purchase moments and inside health and wellness member hubs: pages a brand, clinic or retailer runs for its own paying customers. No open web, no user-generated content, no programmatic resale. Nothing runs until you approve an insertion order naming the hub, placement and flight dates." },
  { q: "What if a placement under-delivers?", a: "We run makegoods on equal or better placements, per IAB standard terms. Every IO states the flight dates for each hub and placement, and reporting shows views and clicks per hub and surface." },
  { q: "Can we cancel?", a: "Yes. Cancel for a full refund up to 14 days before a flight starts. The $190 USD 7-day look converts in full to the reserve within 7 days or is refunded." },
  { q: "How does billing work?", a: "Small tests pay by card on a Stripe-hosted page. Blocks run on an insertion order: deposit collected at confirmation, then payment by cheque, wire or EFT to Silver Birch Growth Inc. Ask about terms for upfront blocks when you request the draft IO." },
  { q: "Why lock a test now?", a: "New placements open at starter rates, and a placement's rate can step up only once reporting shows it performs. Prepaid credit keeps its rate for its term, and the $490 USD reserve stays fully refundable until 14 days before the launch date on the IO." },
];

/** schema.org FAQPage for a list of Q&As (one per page; Google flags duplicate FAQPage blocks). */
export function faqPageJsonLd(items: Array<{ q: string; a: string }>): Record<string, unknown> {
  return { "@type": "FAQPage", mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })) };
}

export const INVENTORY_LINE = `First-party post-purchase and member-hub placements across private, co-branded health and wellness hubs.`;
export const SPEND_DOWN_MONTHS = INVENTORY.liveSpendDownMonths;

/**
 * "Two ways to buy" on /agencies (daily scan Nov 24 2026; Lyft Ads / Walgreens wag put managed and
 * self-serve side by side with the minimum stated plainly). Replaces the mid-page "Same two offers" block
 * and sits right under the hero so an agency picks a path first. Every line restates terms already
 * published on /agencies, /media-kit, /terms and the start-small tiers. No new price, no time promise.
 */
export const BUY_PATHS = {
  card: {
    key: "card",
    kicker: "Card · self-serve",
    price: "From $190 USD",
    sub: "7-day look, or the $490 USD category reserve",
  },
  io: {
    key: "io",
    kicker: "Insertion order (IO) · managed",
    price: `$${AGENCY_CLIENT_TEST.lo / 1000}K–$${AGENCY_CLIENT_TEST.hi / 1000}K USD`,
    sub: "Per client test · premium slots by inquiry",
  },
  rows: [
    { k: "Best for", card: "One client, starting now", io: "Several clients or a bigger test" },
    { k: "Pay", card: "Card on a Stripe-hosted page, no login", io: "Deposit collected at confirmation" },
    { k: "Before it runs", card: "You approve an IO naming the hub and placement", io: "Send the brief; we reply with hub fit and a draft IO" },
    { k: "Refunds", card: "$490 refundable until 14 days before launch; $190 converts or is refunded", io: "Same terms as every deposit" },
    { k: "Agency commission", card: `${AGENCY_CASH_PCT}% off the published rate card`, io: `${AGENCY_CASH_PCT}% off the published rate card` },
  ],
} as const;


/**
 * Rate-card agency model (Randy, Nov 24 2026; commission moved to the industry-standard 15% off gross on Nov 25 2026):
 * published rate card, standard 15% agency commission, agencies set their own resale price, agencies handle their own client disclosure,
 * direct buyers pay the rate card, no undercutting of agency clients.
 * Shared by /agencies and the home Trusted Agency Partners section.
 */
export const AGENCY_DISCOUNT_PCT = AGENCY_CASH_PCT;
export const AGENCY_RATE_CARD = {
  discountPct: AGENCY_DISCOUNT_PCT,
  line: `Agencies earn the standard ${AGENCY_DISCOUNT_PCT}% agency commission off the gross rate card.`,
  resale: "You set your own resale price.",
  disclosure: "You handle your own client disclosure.",
  direct: "Direct buyers pay the published rate card.",
  noUndercut: "We do not undercut an agency's client.",
} as const;

export const AGENCY_RATE_RULES: ReadonlyArray<{ k: string; d: string }> = [
  { k: "Published rate card", d: "The same list prices every buyer can see. The 7-day look, the reserve and the $1,900 starter placement are on the media kit." },
  { k: "Standard 15% agency commission", d: "Agencies, brokers and media resellers earn the standard 15% commission off the gross rate card, written into every insertion order." },
  { k: "You set the resale price", d: "What you charge your client is yours. We do not set a resale price for you." },
  { k: "You disclose to your client", d: "Client disclosure sits with you. We do not brief your client on what you paid." },
  { k: "Direct buyers pay the card", d: "A brand buying for itself pays the published rate card. No agency discount." },
  { k: "No undercutting agency clients", d: "If you are the agency of record on an insertion order, we will not sell that client the same inventory cheaper behind you." },
  { k: "Committed-spend tiers", d: "Commit to an inventory block and a further 10–20% comes off the net agency rate. Block size and term set the tier." },
];

/** $10,000 USD worked example. Planning illustration only, not a quote. */
export const AGENCY_DISCOUNT_EXAMPLE = {
  list: 10_000,
  discountPct: AGENCY_DISCOUNT_PCT,
  discount: 10_000 * (AGENCY_DISCOUNT_PCT / 100),
  agencyPays: 10_000 * (1 - AGENCY_DISCOUNT_PCT / 100),
  note: "Illustrative example, modelled. Not a forecast or a quote. Assumes the standard 15% agency commission off the gross rate card. What you charge the client is yours. Nothing runs until an insertion order names the placement.",
} as const;

/**
 * Committed partner inventory (Randy, Nov 25 2026 t570u; reworded 5:21 PM ET as a committed-spend tier on top of the
 * standard 15% agency commission): a further 10–20% off the net agency rate (agencies earn the standard 15% agency commission
 * off the published rate card). Exact rate is set by committed volume or term. Range, not a
 * guarantee. The list-price ladder is unchanged.
 */
export const PARTNER_VALUE_VS_AGENCY_PCT = { lo: 10, hi: 20 } as const;
/** Percent better than regular agency pricing (not percent off the rate card). */
export const EXCLUSIVE_PARTNER_DISCOUNT = PARTNER_VALUE_VS_AGENCY_PCT;

export const PARTNER_VALUE = {
  pay: `15% + a further ${PARTNER_VALUE_VS_AGENCY_PCT.lo}–${PARTNER_VALUE_VS_AGENCY_PCT.hi}% off net`,
  line: `Committed-spend tiers: commit to an inventory block and a further ${PARTNER_VALUE_VS_AGENCY_PCT.lo}–${PARTNER_VALUE_VS_AGENCY_PCT.hi}% comes off the net agency rate.`,
  fine: "Block size and term set the tier.",
} as const;

/**
 * Committing inventory blocks (Randy, Nov 25 2026 5:21 PM ET): small first commitment that scales, standard
 * cancellation window, makegoods for under-delivery, clear flight dates. Every figure is an existing Birch price:
 * the $1K–$5K USD client test (AGENCY_CLIENT_TEST) and the $25,000–$1.5M USD premium band (MEDIA_KIT_OFFERS.premium).
 * Cancellation restates the 14-days-before-launch refund already on /terms; makegoods follow IAB (already on the spec).
 */
export const BLOCK_LADDER = [
  {
    key: "starter",
    step: "Start",
    name: "Starter block",
    price: `$${AGENCY_CLIENT_TEST.lo / 1000}K–$${AGENCY_CLIENT_TEST.hi / 1000}K USD`,
    line: "One client, one flight, one insertion order. Prove it before you scale.",
    rate: `${AGENCY_CASH_PCT}% agency commission`,
  },
  {
    key: "upfront",
    step: "Scale",
    name: "Upfront block",
    price: BLOCK_BAND_LINE,
    line: "Book premium and exclusive placements ahead, across several clients and flights.",
    rate: `${AGENCY_CASH_PCT}% + a further ${PARTNER_VALUE_VS_AGENCY_PCT.lo}–${PARTNER_VALUE_VS_AGENCY_PCT.hi}% off net`,
  },
] as const;

export const BLOCK_TERMS = [
  { k: "Flight dates", d: "Fixed start and end dates for every hub and placement, written on the insertion order." },
  { k: "Cancellation", d: "Cancel for a full refund up to 14 days before a flight starts." },
  { k: "Makegoods", d: "If a placement under-delivers against the IO, we run makegoods on equal or better placements, per IAB standard terms." },
] as const;

const agencyPaysOn = (list: number) => list * (1 - AGENCY_DISCOUNT_PCT / 100);
const partnerPaysOn = (list: number, betterPct: number) => agencyPaysOn(list) * (1 - betterPct / 100);

/** Illustrative $10,000 USD rate-card buy. A further 10–20% off the $8,500 net agency price is $7,650–$6,800. */
export const BUYER_VALUE_EXAMPLE = {
  list: 10_000,
  direct: 10_000,
  agency: agencyPaysOn(10_000),
  partnerLo: partnerPaysOn(10_000, PARTNER_VALUE_VS_AGENCY_PCT.hi),
  partnerHi: partnerPaysOn(10_000, PARTNER_VALUE_VS_AGENCY_PCT.lo),
  label: "Illustrative example",
  brief: "A $10,000 USD rate-card buy.",
  note: "Illustrative example, modelled. Not a quote. Block size and term set the tier.",
} as const;

export type AgencyTierKey = "direct" | "agency" | "exclusive";
export const AGENCY_TIERS: ReadonlyArray<{
  key: AgencyTierKey;
  name: string;
  who: string;
  pay: string;
  keep: string;
  badge?: string;
}> = [
  { key: "direct", name: "Direct buyers", who: "A brand buying space for itself.", pay: "The published rate card", keep: "Your own placement and reporting" },
  { key: "agency", name: "Agencies", who: "Agencies, brokers and media resellers buying for clients as agency of record.", pay: `${AGENCY_DISCOUNT_PCT}% off the published rate card`, keep: "You set your own resale price" },
  {
    key: "exclusive",
    name: "Trusted Agency Partners",
    who: "Agencies with reserved access to exclusive packages and newly activating hubs.",
    pay: PARTNER_VALUE.pay,
    keep: "By committing to inventory",
    badge: "First look",
  },
];

/** Access perks for Trusted Agency Partners. The committed-spend tier is stated in PARTNER_VALUE. */
export const EXCLUSIVE_PARTNER_PERKS = [
  "First look at new exclusive packages and hubs before they open publicly.",
  "Reserved access to exclusive packages and newly activating hubs.",
  "A named mention on the Birch Reserve site and in our sales materials.",
] as const;
