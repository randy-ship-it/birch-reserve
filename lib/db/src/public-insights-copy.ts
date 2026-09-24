/**
 * Public insights copy that can ship without an editor session.
 * $899 / reserve-899 is unpublished legacy and must not remain in published text.
 */

export const SCALE_HUBS_ARTICLE = {
  slug: "after-booking-category-seats-scale-hubs",
  title: "After the booking: why category seats beat open-web noise",
  authorName: "Birch Reserve Editorial",
  topic: "Closed-hub advertising",
  summary:
    "Brand display works differently when it sits after a purchase or booking inside a signed recovery hub. Birch Reserve sells named category seats on those hubs—Hold $190 or Reserve $490—not guaranteed impressions on the open web.",
  publishedAt: new Date("2026-09-24T16:00:00.000Z"),
  body: `# After the booking: why category seats beat open-web noise

Most performance channels buy attention before someone has decided anything. Scale Health hubs flip that sequence. A person has already booked care, bought a product, or started a plan inside a closed customer environment. The next brand they see can sit next to that moment—not in a stranger’s feed.

## What a Birch Reserve seat actually is

Birch Reserve is the paid-display layer for signed Scale Health recovery hubs. Inventory is eight advertiser categories across those hubs, not eight websites. One brand per aisle. Live proof of a participating hub: https://physio.drhonow.com/dr-ho/portal.

Public offers (USD):

Hold $190 — seven-day category look. Does not consume one of the eight seats. Convert to a named seat within seven days and the Hold becomes 100% media credit; otherwise cash refund.

Reserve $490 — named category seat in the eight-pool. 100% media credit toward flight. An insertion order names the surface before anything runs. Credit expires at twelve months.

Book a call — multi-hub, exclusive, or on-prem Align surfaces.

Reporting is aggregate only. No patient-level data. No clinical pixels. No open auction.

## How this relates to Scale Health (without mixing contracts)

Scale Health builds the rails: clinic hubs, booking, and partner fulfillment. Birch Reserve is a separate commercial product—category display on those hubs after the customer is already inside. Providers who join Scale are not buying Birch seats, and brands who buy Birch seats are not buying patient leads. Care, commerce, and display stay three contracts.

Useful mental model: the hub earns trust; Birch lets a fitting brand show up in that trusted context with category exclusivity. The insertion order—not a media plan of guaranteed impressions—is what names where the unit runs.

## What we do not claim

We do not sell guaranteed impression counts, CTR floors, or “how many people will see this.” If a brand asks for a reach number, the honest answer is: you buy first-right on a category inside signed hubs; the IO names the surface. Anything else is a different product.

## Practical next step

If the category fits a recovery or wellness brand that already belongs beside booking and plan moments, start with Hold $190 to look without burning a seat, or Reserve $490 to lock the aisle. Custom or multi-hub work goes to Book a call with Silver Birch Growth.

Seller: Silver Birch Growth Inc., Toronto · randy@silverbirchgrowth.com · https://birchreserve.net
`,
} as const;

const PUBLIC_OFFER_SENTENCE =
  "Public offers are Hold $190 for a seven-day category look that does not consume one of the eight seats, or Reserve $490 for a named category seat in the eight-pool. Both amounts are media credit, and the insertion order names the surface before anything runs.";

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
