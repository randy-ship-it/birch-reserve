/**
 * PREMIUM_INQUIRE_ONLY (Randy, Nov 12 2026, via Emma): premium slots are
 * inquire-only and can never be bought by card. Edit this one list to move a
 * slot in or out. Pure module (no Node imports) so the browser bundle and the
 * API share it.
 *
 * Card self-serve stays open for the $190 7-day look and the $490 category
 * seat on Hub Home, Product / Services and Member Dashboard.
 */
export const PREMIUM_INQUIRE_ONLY = {
  /** /buycalc + /v1/checkout "Where it shows" (format_pref) values. */
  formats: ["post_checkout"],
  /** Overhaul / quick-buy placement keys (SURFACES). */
  placements: ["post_purchase"],
  /** Rate-card view blocks (views per surface). */
  viewBlocks: [100_000, 250_000, 1_000_000],
  /** Offer / SKU keys that are a category or area lock, or a view block. */
  offers: ["area-lock", "category-lock", "block-100k", "block-250k", "block-1m"],
} as const;

export const PREMIUM_INQUIRY_MESSAGE =
  "This is a premium slot and is inquire-only, so it can't be paid by card. Send an inquiry and we'll reply with an insertion order (a signed order form).";

/** Where a premium buyer is sent (the existing inquiry form posts to /v1/leads). */
export const PREMIUM_INQUIRY_PATH = "/#quick-buy";
export const PREMIUM_INQUIRY_KIND = "premium_inquiry" as const;

const has = (list: readonly (string | number)[], v: unknown) => (typeof v === "string" || typeof v === "number") && list.includes(v as never);

export const isPremiumFormat = (format: unknown): boolean => has(PREMIUM_INQUIRE_ONLY.formats, format);
export const isPremiumPlacement = (placement: unknown): boolean => has(PREMIUM_INQUIRE_ONLY.placements, placement);
export const isPremiumViewBlock = (views: unknown): boolean => has(PREMIUM_INQUIRE_ONLY.viewBlocks, typeof views === "string" ? Number(views) : views);
export const isPremiumOffer = (offer: unknown): boolean => has(PREMIUM_INQUIRE_ONLY.offers, offer);

/** One check for any card path: true when any pick is premium. */
export function isInquireOnly(picks: { format?: unknown; placement?: unknown; block?: unknown; offer?: unknown; areaLock?: boolean; categoryLock?: boolean }): boolean {
  return Boolean(
    picks.areaLock ||
      picks.categoryLock ||
      isPremiumFormat(picks.format) ||
      isPremiumPlacement(picks.placement) ||
      (picks.block !== undefined && isPremiumViewBlock(picks.block)) ||
      isPremiumOffer(picks.offer),
  );
}

/** Body returned by every card path that refuses a premium pick. */
export function inquireOnlyResponse(extra: Record<string, unknown> = {}) {
  return { error: PREMIUM_INQUIRY_MESSAGE, inquire_only: true, inquiry_url: PREMIUM_INQUIRY_PATH, checkout_url: null, ...extra };
}
