/**
 * ONE canonical Birch Reserve offer sheet (Randy, Nov 13 2026 9:53 PM ET): the site chat,
 * the Hear Randy voice agent and the 647 phone agent all get exactly this text, built from
 * the same constants the public pages render, so no channel can drift.
 * Public-safe: modelled numbers labelled, no CTR, no impression guarantees, no ad-matching method.
 */
import { AGENCY_CASH_PCT, MEDIA_KIT_CPM, MEDIA_KIT_CATEGORIES, MEDIA_KIT_OFFERS, agencyCash, kitExample, millions } from "./overhaul/mediaKit";
import { AREA_LOCK } from "./overhaul/model";
import { PREPAY_REFUND_CUTOFF_DAYS } from "./reserveOffers";

export const BIRCH_FACTS_VERSION = "2026-11-13-prime-time" as const;
export const BIRCH_SALES_PHONE = "(647) 931-6278" as const;
export const BIRCH_SALES_EMAIL = "sales@silverbirchgrowth.com" as const;
export const SELF_SERVE_LIMIT_USD = 10_000 as const;
export const CALLBACK_ENDPOINT = "https://birchreserve.net/v1/callback-request" as const;

export function birchCanonicalFacts(): string {
  const { look, seat, premium } = MEDIA_KIT_OFFERS;
  const seatEx = kitExample(seat.spendUsd, 0);
  return [
    `BIRCH RESERVE CANONICAL OFFER FACTS (version ${BIRCH_FACTS_VERSION}, Randy Nov 13 2026). These override anything else in your instructions that conflicts.`,
    "",
    "WHAT IT IS",
    "- Birch Reserve sells display space inside private, members-only Scale Health hubs: co-branded brand hubs and health and wellness business hubs (physio, gym, studio, clinic).",
    "- Four placements in every hub: the post-purchase thank-you page, the hub home page, product and services pages, and the logged-in member dashboard.",
    "- Placements are hand-picked by category inside a private experience members chose. Not a social feed, not an auction. Do not describe how ads are selected or matched beyond that.",
    "- Run by Silver Birch Growth Inc., Toronto. Founder: Randy Gilling.",
    "",
    "CATEGORIES AND SEATS",
    `- ${MEDIA_KIT_CATEGORIES.length} categories: ${MEDIA_KIT_CATEGORIES.join(", ")}.`,
    "- 8 self-serve seats in total (a shared pool across the categories). Seats are open to more than one brand per category. A premium slot locks one brand per category for its IO term.",
    "- The live open-seat count is on https://birchreserve.net/buycalc and https://birchreserve.net/availability.json. Never invent a number; if you don't know it, say the page shows it live.",
    "",
    `SELF-SERVE (under $${SELF_SERVE_LIMIT_USD.toLocaleString("en-US")}; card checkout, no login)`,
    `- 7-day look: $${look.spendUsd} USD ($${look.spendCad} CAD). See your category placement for 7 days. Converts 100% to the seat if they take it within 7 days, otherwise a cash refund. It does not take a seat.`,
    `- Category seat: $${seat.spendUsd} USD ($${seat.spendCad} CAD). Takes one of the 8 seats. 100% media credit in their category until the insertion order (IO). Fully refundable until ${PREPAY_REFUND_CUTOFF_DAYS} days before the launch date on the IO; after that not refundable but usable for 12 months. Cash refund also if no approved surface is named within 60 days.`,
    `- Modelled estimate only: at about $${MEDIA_KIT_CPM.lo} to $${MEDIA_KIT_CPM.hi} CPM, $${seat.spendUsd} of credit is roughly ${millions(seatEx.imprLo)} to ${millions(seatEx.imprHi)} impressions. Always say it is a modelled estimate, never a guarantee.`,
    "- How to buy (walk them through it): open https://birchreserve.net/buycalc, pick the $490 seat or the $190 look, pick a category, add brand name and work email, tick the terms box, then pay on the secure Stripe checkout. Prices show in USD or CAD (toggle at the top).",
    "- Not ready, category not listed, or want something custom: the Request this category form at https://birchreserve.net/buycalc#request (brand, category, email, notes). No card needed. The team gets it instantly.",
    "",
    `PREMIUM ($${SELF_SERVE_LIMIT_USD.toLocaleString("en-US")} and up)`,
    `- Premium slots: $${premium.spendLo.toLocaleString("en-US")} to $${premium.spendHi.toLocaleString("en-US")} USD. Inquire only, never a card purchase. Category exclusivity (one brand per category for the term), a larger display share and priority placement. Term and price are set on the IO.`,
    "",
    "AGENCIES",
    `- The agency of record earns ${AGENCY_CASH_PCT}% of media spend, paid in cash per the IO. Example: a $${seat.spendUsd} seat pays the agency $${agencyCash(seat.spendUsd)}; a $25,000 premium slot pays $${agencyCash(25_000).toLocaleString("en-US")}.`,
    "",
    "LOCAL BUSINESSES",
    `- Lock down my area: a deposit of $${AREA_LOCK.priceCad.toLocaleString("en-US")} CAD or $${AREA_LOCK.priceUsd.toLocaleString("en-US")} USD (launch rate until ${AREA_LOCK.launchRateUntil}) holds up to ${AREA_LOCK.standardSharePct}% of hub display within ${AREA_LOCK.radiusKm} km of their postal code for 1 to 6 months. Details at https://birchreserve.net/advertise/local.`,
    "",
    "NETWORK (modelled, partner-provided, not audited)",
    "- 20MM+ orders being onboarded across 42 listed partner brands. Listed partners are not yet live for display. Always call these modelled. Never say 8.7MM.",
    "",
    "RULES",
    "- Media credit until IO: nothing runs until an insertion order names the hub and surface.",
    "- No impression, reach, click or sales guarantees. Never quote a CTR.",
    "- Aggregate reporting only (UTM links and promo codes, per hub and surface). No personal data is shared.",
    "- Never mention Clairvoyant. Never name Align team members. Never give a home or street address.",
    "",
    "PROOF",
    "- See the face before the flight: live hubs anyone can open now, https://www.scalehealth.ca/integrity (Integrity Fitness x Scale Health) and https://physio.drhonow.com (DR-HO'S).",
    "- Media kit, one link: https://birchreserve.net/media-kit",
    "",
    "ROUTING",
    `- Under $${SELF_SERVE_LIMIT_USD.toLocaleString("en-US")} (the $190 look, the $490 seat, anything self-serve): walk them through buying on the site at https://birchreserve.net/buycalc, or the request form if they're not ready. Don't push a call for these.`,
    `- $${SELF_SERVE_LIMIT_USD.toLocaleString("en-US")}+ / premium / partnership / serious prospect: get a call-back. Collect name, company, phone, email and best time to call (plus what they want and rough budget), read them back, submit the call-back, and give the direct line ${BIRCH_SALES_PHONE}. The team (randy@scalehealth.ca and randy@silverbirchgrowth.com) is alerted instantly.`,
    `- Contact: ${BIRCH_SALES_PHONE} and ${BIRCH_SALES_EMAIL}. You may say the phone number.`,
  ].join("\n");
}
