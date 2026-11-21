/**
 * GTM setup packages (Randy t332u, Nov 21 2026). One source of truth for the homepage block, the media-kit block,
 * the /intake/gtm form, the site chat and llms.txt. Anonymous by design: no client names, logos, cities, categories
 * that identify, or numbers. Separate from the ad inventory product; same systems. No outcome guarantees.
 */
export const GTM_SETUP_PRICE_USD = 3500;
export const GTM_SETUP_HREF = "/intake/gtm";
export const GTM_SETUP_URL = "https://birchreserve.net/intake/gtm";
export const GTM_SETUP_KIND = "gtm_setup_inquiry" as const;

export const GTM_SETUP = {
  eyebrow: "GTM setup packages · from $3,500 USD",
  title: "We set up the partnership bot we use. Then you run it.",
  sub: "For health and wellness businesses that want efficient outreach and commercial conversations.",
  steps: [
    { n: "1", t: "We set it up", d: "The same in-house partnership / B2B go-to-market bot and console we use." },
    { n: "2", t: "Your motion starts running", d: "We get your outreach and partner conversations moving." },
    { n: "3", t: "We hand over the keys", d: "You run it yourselves." },
  ],
  separate: "Separate from the ad inventory product (the $190 USD look, reserves and packs), and it runs on the same systems.",
  cases: [
    "Virtual care partner: first email to ready to sign in 19 days, run by our field sales bot.",
    "Same thread: prospect tone rose from 55 on the first reply to 94 at ready to sign, across 12 scored emails (our read of the wording).",
  ],
  casesNote: "Examples are anonymous. No outcomes are guaranteed.",
  cta: "Start with a $3,500 setup",
  detailsLabel: "What's included and how it works",
  details: [
    "Setup of the same partnership / B2B go-to-market bot and console we use in-house.",
    "We get your motion running, then hand over the keys so you can run it yourselves.",
    "Priced from $3,500 USD. Nothing is charged online: the form sends us your details and we reply by email.",
    "Ad inventory works as before: modelled inventory is labelled, reporting is aggregate only, and nothing runs before an insertion order.",
  ],
} as const;

export const GTM_PARTNER_TYPES = ["Clinics & studios", "Retailers", "Brands", "Distributors & resellers", "Not sure yet"] as const;

/** One short paragraph for the chat prompt and llms.txt. */
export const GTM_SETUP_FACT =
  "GTM setup packages start at $3,500 USD: we set up the same in-house partnership / B2B go-to-market bot and console we use, get the client's motion running, then hand over the keys so they run it themselves. For health and wellness businesses. Separate from the ad inventory product but runs on the same systems. Nothing is charged online; start at https://birchreserve.net/intake/gtm and the team replies by email. Examples are anonymous (a virtual care partner went from first email to ready to sign in 19 days through our field sales bot, across 12 scored emails). No outcomes are guaranteed.";

/** Chat-only guardrail. */
export const GTM_SETUP_CHAT_RULE = "If asked who the examples are, say they are anonymous and you can't share client details. Never name, describe or hint at any client, and never promise outcomes or give numbers for them.";
