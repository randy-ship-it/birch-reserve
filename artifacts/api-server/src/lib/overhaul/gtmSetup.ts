/**
 * B2B go-to-market aside (Silver Birch Growth Inc.). Replaces the former $3,500 GTM setup offer:
 * SBG takes on only rare strategic projects and is pointed at portfolio value creation right now,
 * so it isn't something you can buy. No price, no package pitch, no client names, no guarantees.
 */
export const GTM_SETUP_HREF = "/intake/gtm";
export const GTM_SETUP_URL = "https://birchreserve.net/intake/gtm";
export const GTM_SETUP_KIND = "gtm_setup_inquiry" as const;

export const GTM_SETUP = {
  eyebrow: "B2B go-to-market · Silver Birch Growth Inc.",
  title: "B2B go-to-market, powered by Silver Birch Growth Inc.",
  sub: "Silver Birch Growth takes on only rare strategic projects and is pointed at portfolio value creation right now — so it isn't something you can buy.",
  separate: "Separate from Birch Reserve ad placements.",
  notes: [
    "Built and run internally across our own portfolio.",
    "Not sold as a package, setup tier, or rate-card service.",
  ],
} as const;

export const GTM_PARTNER_TYPES = ["Clinics & studios", "Retailers", "Brands", "Distributors & resellers", "Not sure yet"] as const;

/** One short paragraph for the chat prompt and llms.txt. */
export const GTM_SETUP_FACT =
  "B2B go-to-market, powered by Silver Birch Growth Inc.: SBG takes on only rare strategic projects and is pointed at portfolio value creation right now, so it isn't something you can buy. Separate from Birch Reserve ad placements. Never quote a price.";

/** Chat-only guardrail. */
export const GTM_SETUP_CHAT_RULE =
  "Never quote a price or offer GTM setup for sale. Explain plainly that Silver Birch Growth takes on only rare strategic projects and is pointed at portfolio value creation right now, so it isn't something you can buy.";
