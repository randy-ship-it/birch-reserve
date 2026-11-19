/**
 * Deny-filter for hub names arriving from Friday (Randy, Nov 18 2026 11:34–11:35 PM ET): these are never rendered.
 * Kalaya is allowed. Retail locations are only ever called "retail hubs". This file holds the filter, not copy.
 */
export const NEVER_HUB_NAME = new RegExp(["medvibe", "clairvoyant", "\\balign", "alset"].join("|"), "i");
