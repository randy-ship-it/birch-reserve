/**
 * Public insights copy that can ship without an editor session.
 * $899 / reserve-899 is unpublished legacy and must not remain in published text.
 */

export const SCALE_HUBS_ARTICLE = {
  slug: "after-booking-category-seats-scale-hubs",
  title: "After the booking: why exclusive categories beat open-web noise",
  authorName: "Birch Reserve Editorial",
  topic: "Closed-hub advertising",
  summary:
    "Brand display works differently when it sits after a purchase or booking inside a signed recovery hub. Birch Reserve sells exclusive brand categories on those hubs—Hold $190 or Reserve $490—not guaranteed impressions on the open web.",
  publishedAt: new Date("2026-09-24T16:00:00.000Z"),
  body: `# After the booking: why exclusive categories beat open-web noise

Most performance channels buy attention before someone has decided anything. Scale Health hubs flip that sequence. A person has already booked care, bought a product, or started a plan inside a closed customer environment. The next brand they see can sit next to that moment—not in a stranger’s feed.

## What a Birch Reserve exclusive category actually is

Birch Reserve is the paid-display layer for signed Scale Health recovery hubs. Inventory is eight advertiser categories across those hubs, not eight websites. One brand per aisle. Live proof of a participating hub: https://physio.drhonow.com/dr-ho/portal.

Public offers (USD):

Hold $190 — seven-day category look. Does not take an exclusive category. Convert to the full reserve within seven days and the Hold becomes 100% media credit; otherwise cash refund.

Reserve $490 — locks your exclusive category among eight brand categories. 100% media credit toward flight. An insertion order names the surface before anything runs. Credit expires at twelve months.

Book a call — multi-hub, exclusive, or on-prem Align surfaces.

Reporting is aggregate only. No patient-level data. No clinical pixels. No open auction.

## How this relates to Scale Health (without mixing contracts)

Scale Health builds the rails: clinic hubs, booking, and partner fulfillment. Birch Reserve is a separate commercial product—category display on those hubs after the customer is already inside. Providers who join Scale are not buying Birch categories, and brands who buy Birch categories are not buying patient leads. Care, commerce, and display stay three contracts.

Useful mental model: the hub earns trust; Birch lets a fitting brand show up in that trusted context with category exclusivity. The insertion order—not a media plan of guaranteed impressions—is what names where the unit runs.

## What we do not claim

We do not sell guaranteed impression counts, CTR floors, or “how many people will see this.” If a brand asks for a reach number, the honest answer is: you buy first-right on a category inside signed hubs; the IO names the surface. Anything else is a different product.

## Practical next step

If the category fits a recovery or wellness brand that already belongs beside booking and plan moments, start with Hold $190 to look without taking an exclusive category, or Reserve $490 to lock the aisle. Custom or multi-hub work goes to Book a call with Silver Birch Growth.

Seller: Silver Birch Growth Inc., Toronto · randy@silverbirchgrowth.com · https://birchreserve.net
`,
} as const;

export const SHELF_AFTER_RECEIPT_ARTICLE = {
  slug: "the-shelf-after-the-receipt",
  title: "The shelf after the receipt",
  authorName: "Birch Reserve Editorial",
  topic: "Closed-hub advertising",
  summary:
    "Paying for a Birch exclusive category is media credit, not a flight that starts itself. The insertion order names the hub. The unit only sits after checkout, on a plan, or at a booking. That shelf after the receipt is the product.",
  publishedAt: new Date("2026-09-27T16:00:00.000Z"),
  body: `# The shelf after the receipt

Most ad products sell you a start date. Birch sells you a shelf that only appears after someone already finished a real step inside a signed Scale Health hub.

That is the whole point.

## What you buy

Hold $190 is a seven-day category look. It does not take an exclusive category. Convert to the full reserve within seven days and the Hold becomes 100% media credit. Otherwise cash refund.

Reserve $490 locks your exclusive category among eight brand categories. Again, 100% media credit. Credit expires at twelve months.

Neither amount is “run my ad tomorrow.” Both are credit toward a unit that only runs after the paperwork names where it lives.

## The three steps after you pay

1. Pay $190 for a look or $490 for an exclusive category. That money is 100% media credit.
2. An insertion order names the hub. Nothing runs before step 2.
3. The unit sits after checkout, on a plan, or at a booking inside that named hub. Not in a stranger’s feed.

If a brand wants flight math before an IO, they are shopping a different product. Birch is first-right on a category aisle inside closed recovery hubs. Live proof of a participating hub: https://physio.drhonow.com/dr-ho/portal.

## Why the shelf matters

Open-web ads interrupt people who have not decided anything. The shelf after the receipt sits next to a person who already bought, booked, or started a plan. Trust is already warm. Category exclusivity keeps the aisle clean. Reporting stays aggregate. No patient-level data. No clinical pixels. No open auction.

Care, commerce, and display stay three contracts. Scale builds the rails. Birch sells the exclusive category. Providers joining Scale are not buying Birch inventory, and brands buying Birch are not buying patient leads.

## What we refuse to claim

No guaranteed impression counts. No CTR floors. No “how many people will see this.” If someone needs that story, Carbon-style native networks with published specs and crawlable FAQs are a better fit for that buyer. Birch wins on entry price and on honesty about what a credit is. Birch loses when the buy path is confusing. That is why the site must make the three steps obvious.

## Practical next step

If your category belongs beside recovery checkout and booking moments, start at https://birchreserve.net. Hold $190 to look. Reserve $490 to lock the aisle. Multi-hub or exclusive work is a call with Silver Birch Growth.

Seller: Silver Birch Growth Inc., Toronto · randy@silverbirchgrowth.com · https://birchreserve.net
`,
} as const;

export const PUBLIC_INSIGHT_ARTICLES = [
  SCALE_HUBS_ARTICLE,
  SHELF_AFTER_RECEIPT_ARTICLE,
] as const;

const ALIGN_NETWORK_CLINIC_SENTENCE =
  "describes virtual rehab embedded into clinic, studio, and wellness businesses [2].";
const ALIGN_NETWORK_SENTENCE =
  "describes virtual rehab embedded into health and wellness businesses [2].";

/** One published sentence. Align's network is health and wellness businesses. */
export function rewriteAlignNetworkCopy(text: string): string {
  if (!text.includes(ALIGN_NETWORK_CLINIC_SENTENCE)) return text;
  return text.replaceAll(ALIGN_NETWORK_CLINIC_SENTENCE, ALIGN_NETWORK_SENTENCE);
}

const PUBLIC_OFFER_SENTENCE =
  "Public offers are Hold $190 for a seven-day category look that does not take an exclusive category, or Reserve $490 to lock your exclusive category among eight brand categories. Both amounts are media credit, and the insertion order names the surface before anything runs.";

const LEGACY_DISPLAY_RESERVE_SENTENCE =
  /The first Display Reserve is deliberately concrete:\s*a fixed \$899(?:\.00)?\s*USD reservation for eight seats, with a media credit and a final insertion order\./g;

const LEGACY_HERO_PRICE = /\$899|reserve-899|hero\s*899|\b899(?:\.00)?\s*USD\b/i;

export function mentionsLegacyHeroPrice(text: string): boolean {
  return LEGACY_HERO_PRICE.test(text.replaceAll("\u00a0", " ").replaceAll("\u202f", " "));
}

export function rewriteLegacyReserveCopy(text: string): string {
  if (!mentionsLegacyHeroPrice(text)) return text;
  const normalized = text.replaceAll("\u00a0", " ").replaceAll("\u202f", " ");
  const replaced = normalized.replaceAll(LEGACY_DISPLAY_RESERVE_SENTENCE, PUBLIC_OFFER_SENTENCE);
  if (!mentionsLegacyHeroPrice(replaced)) return replaced;
  return replaced
    .replaceAll(/reserve-899/gi, "reserve-490")
    .replaceAll(/\$899(?:\.00)?\s*USD reservation/gi, "Hold $190 or Reserve $490")
    .replaceAll(/\$899(?:\.00)?(?:\s*USD)?/g, "Hold $190 or Reserve $490")
    .replaceAll(/hero\s*899/gi, "Hold $190 or Reserve $490")
    .replaceAll(/\b899(?:\.00)?\s*USD\b/gi, "Hold $190 or Reserve $490");
}

export function legacyReserveCopyPatch(
  summary: string,
  body: string,
): { summary: string; body: string } | null {
  const nextSummary = rewriteLegacyReserveCopy(summary);
  const nextBody = rewriteLegacyReserveCopy(body);
  if (nextSummary === summary && nextBody === body) return null;
  return { summary: nextSummary, body: nextBody };
}
