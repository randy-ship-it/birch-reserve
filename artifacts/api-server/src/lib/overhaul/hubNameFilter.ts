/**
 * Deny-filter for hub names arriving from Friday (Randy, Nov 18 2026 11:34–11:35 PM ET): these are never rendered.
 * Names on the never-mention list (including the former product-brand example) are denied too. Retail locations are only ever called "retail hubs". This file holds the filter, not copy.
 */
export const NEVER_HUB_NAME = new RegExp(["medvibe", "clairvoyant", "\\balign", "alset", "kalaya"].join("|"), "i");
