/**
 * Street team program, coming 2027 (Randy, voice, Nov 21 2026 2:03 PM ET). One source of truth for the homepage block,
 * the /street-team page, the /intake/street-team form, the site chat and llms.txt.
 * Rules: the high-touch version runs today only for Calm Joints (our in-house consumer brand), powered by the Scale
 * Health street team. Outside brands start in 2027. No minimum dollar amount is published (qualified on the inquiry).
 * No guarantees. No client names. No open-slot claims, no counts. The 2MM+ homes figure is STREET_REACH_FIG (brandIntake).
 */
export const STREET_TEAM_HREF = "/street-team";
export const STREET_TEAM_INTAKE_HREF = "/intake/street-team";
export const STREET_TEAM_URL = "https://birchreserve.net/street-team";
export const STREET_TEAM_KIND = "street_team_inquiry" as const;

export const STREET_TEAM_TIERS = [
  { key: "join", n: "1", name: "Join a running campaign", short: "Display and performance-based placement on routes already being walked.", detail: "Your brand rides on a campaign that is already running: display placement and performance-based placement on its routes. The fastest way in, scoped on your insertion order." },
  { key: "own", n: "2", name: "Your own focused campaign", short: "Your offer, on the specific routes you choose.", detail: "A campaign built for your brand and run on the specific routes you pick, by neighbourhood. Area-level planning only; no home or address lists." },
  { key: "door-drop", n: "3", name: "Door drop", short: "Straight door-to-door expansion. No conversation at the door.", detail: "Your material delivered door to door with no talking. The more commoditized tier: simple, scalable and priced by route." },
] as const;
export type StreetTeamTierKey = (typeof STREET_TEAM_TIERS)[number]["key"];

/** The high-touch version, as it runs today for Calm Joints only. */
export const STREET_TEAM_TODAY = {
  eyebrow: "Running today: Calm Joints only",
  title: "The high-touch version already runs for Calm Joints.",
  sub: "Calm Joints is our in-house consumer brand, powered by the Scale Health street team.",
  features: [
    { key: "qr", t: "QR-powered offers", d: "Every door gets an offer you can scan." },
    { key: "bags", t: "Sample bags", d: "Product in hand, left at the door." },
    { key: "gps", t: "GPS-tracked reps", d: "Reps log in on their phones and knock on doors." },
  ],
} as const;

export const STREET_TEAM = {
  badge: "Coming soon · 2027",
  eyebrow: "Street team program",
  title: "Door-to-door, by route. Open to outside brands in 2027.",
  sub: "An activatable program with a minimum campaign size. Birch Reserve will take on outside brands in 2027.",
  minimum: "Minimum campaign size applies. We qualify it on your inquiry.",
  outside: "Birch Reserve will take on outside brands in 2027. Tell us your brand, tiers and routes and we reply by email.",
  cta: "Tell us about your brand",
  tiersTitle: "Three ways in",
  detailsLabel: "How it works and what to expect",
  details: [
    "The program activates in 2027 for outside brands. Today the high-touch version runs only for Calm Joints.",
    "A minimum campaign size applies. We confirm what qualifies when we reply to your inquiry; nothing is charged from the form.",
    "Planning is by area and route. We do not share home or address lists.",
    "No outcomes are guaranteed. Reach figures are plans and audience, not delivered impressions, clicks or sales.",
  ],
  fine: "Reach figures are based on signed partnership contracts, as a plan and not a guarantee.",
} as const;

export const STREET_TEAM_TIMING = ["Early 2027 (Q1)", "Q2 2027", "Q3 2027", "Q4 2027", "Not sure yet"] as const;
export const STREET_TEAM_BUDGET = ["Under $10K", "$10K to $25K", "$25K to $50K", "$50K to $100K", "$100K+", "Not sure yet"] as const;

export const STREET_TEAM_FACT =
  "Street team program, coming soon in 2027: an activatable door-to-door program with a minimum campaign size (qualified on the inquiry; no public dollar minimum). Three tiers: 1) join a campaign already running, with display and performance-based placement; 2) your own focused campaign on specific routes; 3) door drop, straight door-to-door expansion with no talking (the more commoditized tier). The high-touch version (QR-powered offers, sample bags, GPS-tracked reps who log in on their phones and knock on doors) runs today only for our in-house consumer brand Calm Joints, powered by the Scale Health street team. Birch Reserve will take on outside brands in 2027. Calm Joints and the Street Team Ambassadors are planned to reach 2MM+ homes by 2027 (a plan, not a guarantee). Inquire at https://birchreserve.net/intake/street-team. No outcomes are guaranteed.";

/** One line for llms.txt. */
export const STREET_TEAM_LLMS =
  "Door-to-door by route: join a running campaign, run your own on specific routes, or door drop. The high-touch version (QR offers, sample bags, GPS-tracked reps) runs today only for in-house brand Calm Joints; outside brands from 2027.";

/** One-line mention for the media kit and site chat. */
export const STREET_TEAM_ONE_LINE = "Coming soon, 2027: street team program for outside brands (minimum campaign size applies). The high-touch version runs today only for Calm Joints.";
/** Chat-only guardrail. */
export const STREET_TEAM_CHAT_RULE = "Say it is coming soon in 2027 and link https://birchreserve.net/street-team. Never give a dollar minimum, never say a slot is open, never promise impressions, clicks or results, and don't call it gig or on-demand.";
