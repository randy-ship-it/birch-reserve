/**
 * Agency showcase (birchreserve.net home, Nov 12 2026, Randy via Emma 7:34 PM ET).
 * Pure numbers shared by the home page and its tests. No Node imports.
 *
 * Every figure here is re-used from an existing source, never invented:
 *   - agency cut: AGENCY_CASH_PCT in ./mediaKit = AGENCY.commissionPct in ./model (live
 *     /agencies: "10% of media spend, paid to the agency of record"); Randy 8:14 PM ET: paid in cash.
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
export const BRAND_BONUS_LINE = `Brand bonus credit (the client's, separate from your ${AGENCY_CASH_PCT}% cash): ${DEPOSIT_TIERS.map((t) => `+${t.bonusPct}% from $${t.usd.toLocaleString("en-US")}`).join(", ")} USD prepay.`;

/** Worked examples on prices already on the site ($490 seat, $10,000 Test Rail on /media-kit). */
export const AGENCY_EXAMPLES = [
  { label: "$490 category seat (card)", spend: 490 },
  { label: `${MEDIA_KIT_OFFERS.testRail.name} (media kit)`, spend: MEDIA_KIT_OFFERS.testRail.spend },
].map((e) => ({ ...e, cash: agencyCash(e.spend) }));

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

export const INVENTORY_LINE = `First-party post-purchase and member-hub placements across co-branded Scale Health hubs, with ${TAM.ordersLabel} orders being onboarded (modelled).`;
export const SPEND_DOWN_MONTHS = INVENTORY.liveSpendDownMonths;
