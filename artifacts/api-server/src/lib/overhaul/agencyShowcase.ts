/**
 * Agency showcase (birchreserve.net home, Nov 12 2026, Randy via Emma 7:34 PM ET).
 * Pure numbers shared by the home page and its tests. No Node imports.
 *
 * Every figure here is re-used from an existing source, never invented:
 *   - agency cut: AGENCY_CASH_PCT in ./mediaKit = AGENCY.commissionPct in ./model (live
 *     /agencies + AGENCY.line: "10% of media spend, paid in cash to the agency of record" (Randy 8:14 PM ET).
 *   - starting CPMs: SURFACES (./model) / RATE_SURFACES (./pricing), illustrative estimates.
 *   - 20MM+ orders: TAM.ordersLabel (./model), modelled.
 *   - sell assumption: Randy 7:33 PM ET, "20% of available display space". An ASSUMPTION.
 * No payout schedule is stated anywhere: timing reads "per the IO", never a date.
 */
import { AGENCY_CASH_PCT, MEDIA_KIT_OFFERS, agencyCash } from "./mediaKit";
import { AGENCY, DEPOSIT_TIERS, SURFACES, TAM, INVENTORY } from "./model";
import { RATE_SURFACES } from "./pricing";
import { isPremiumPlacement } from "../premiumInquireOnly";

/** Randy, Nov 12 2026 7:33 PM ET: default sell assumption. Planning only, not a delivery commitment. */
export const SELL_ASSUMPTION_PCT = 20;
export const SELL_ASSUMPTION_LINE = `Planning assumption: we model selling ${SELL_ASSUMPTION_PCT}% of available display space on each placement. An assumption, not a delivery commitment; your IO sizes views against live hub supply.`;

/** Randy, Nov 12 2026 8:14 PM ET: 10% of media spend, paid in cash to the agency of record. */
export const AGENCY_SHARE = {
  pct: AGENCY_CASH_PCT,
  matchesModel: AGENCY_CASH_PCT === AGENCY.commissionPct,
  line: `The agency of record earns ${AGENCY_CASH_PCT}% of media spend, paid in cash.`,
  timing: "Paid to the agency of record per the IO.",
} as const;

/**
 * Brand bonus credit: already stated for brands on /advertise/brands (DEPOSIT_TIERS, +5/+10/+15%).
 * It is the client's media credit, separate from the agency's 10% cash.
 */
export const BRAND_BONUS_LINE = `Client tests start self-serve on the $190 USD 7-day look or the $490 USD reserve; premium slots by inquiry. Separate from your ${AGENCY_CASH_PCT}% cash.`;

/** Worked examples on the public tiers: $490 seat (card) and the $25K premium floor (inquire). */
export const AGENCY_EXAMPLES = [
  { label: "$490 USD reserve (card)", spend: 490 },
  { label: `Premium slot from $${MEDIA_KIT_OFFERS.premium.spendLo / 1000}K (inquire)`, spend: MEDIA_KIT_OFFERS.premium.spendLo },
].map((e) => ({ ...e, cash: agencyCash(e.spend) }));

/** Agency client test band ($1K–$5K, one IO per client). Same figures as AGENCY_TEST in ../twoLane. */
export const AGENCY_CLIENT_TEST = { lo: 1_000, hi: 5_000 } as const;

/**
 * The /agencies payout table in the visitor's currency (daily scan Nov 23 2026).
 * Bug fixed: CAD visitors saw "$690 CAD reserve -> $49 agency cash" because the page relabelled USD
 * text but kept the USD cash figure. Cash is now 10% of the seat price actually shown ($690 CAD -> $69 CAD).
 * Other rows keep the same number in both currencies (the site rule when no CAD table exists).
 * No new prices: seat price comes from /api/currency (priceFor), bands are the ones already on /agencies.
 */
export function agencyPayoutRows(seatPrice: number, cur: "USD" | "CAD") {
  const m = (n: number) => `$${n.toLocaleString("en-US")}`;
  return [
    { key: "seat", label: `${m(seatPrice)} ${cur} reserve (card)`, spend: m(seatPrice), cash: m(agencyCash(seatPrice)) },
    {
      key: "client_test",
      label: `Client test, ${m(AGENCY_CLIENT_TEST.lo / 1000)}K–${m(AGENCY_CLIENT_TEST.hi / 1000)}K (IO)`,
      spend: `${m(AGENCY_CLIENT_TEST.lo)}–${m(AGENCY_CLIENT_TEST.hi)}`,
      cash: `${m(agencyCash(AGENCY_CLIENT_TEST.lo))}–${m(agencyCash(AGENCY_CLIENT_TEST.hi))}`,
    },
    {
      key: "premium",
      label: `Premium slot from ${m(MEDIA_KIT_OFFERS.premium.spendLo / 1000)}K (inquire)`,
      spend: m(MEDIA_KIT_OFFERS.premium.spendLo),
      cash: m(agencyCash(MEDIA_KIT_OFFERS.premium.spendLo)),
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
  { q: "Is there a commission?", a: "Yes: 10% of media spend, paid in cash to the agency of record. Small tests can start self-serve on the $190 USD look or the $490 USD reserve." },
  { q: "Which placement fits which goal?", a: "Awareness: the hub home page. Consideration: product, services and booking pages. Conversion: post-purchase, right after a paid order or booking (premium, by insertion order). Retention and loyalty: the member dashboard behind login. One IO can mix them." },
  { q: "How is performance tracked?", a: "Every placement carries your UTM parameters and, if you want, a promo code. We report views and clicks per hub and surface. Aggregate only." },
  { q: "Do brokers and media resellers qualify?", a: "Yes. When you are the agency of record on the insertion order, you earn 10% of media spend, paid in cash, the same as an agency. List every brand you represent in one inquiry; each gets its own IO and reporting." },
  { q: "Why lock a test now?", a: "New placements open at starter rates, and a placement's rate can step up only once reporting shows it performs. Prepaid credit keeps its rate for its term, and the $490 USD reserve stays fully refundable until 14 days before the launch date on the IO." },
  { q: "Can our bots read this site?", a: "Yes: see /llms.txt, /sitemap.xml and the structured data on each page." },
];

/** schema.org FAQPage for a list of Q&As (one per page; Google flags duplicate FAQPage blocks). */
export function faqPageJsonLd(items: Array<{ q: string; a: string }>): Record<string, unknown> {
  return { "@type": "FAQPage", mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })) };
}

export const INVENTORY_LINE = `First-party post-purchase and member-hub placements across private, co-branded health and wellness hubs.`;
export const SPEND_DOWN_MONTHS = INVENTORY.liveSpendDownMonths;
