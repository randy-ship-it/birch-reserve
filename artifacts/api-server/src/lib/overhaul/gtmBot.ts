/**
 * B2B go-to-market note (Silver Birch Growth Inc.). Replaces the former $3,500 GTM bot offer:
 * SBG takes on only rare strategic projects and is pointed at portfolio value creation right now,
 * so it isn't something you can buy. No price, no client names, no guarantees.
 */
export const GTM_BOT_HREF = "/gtm-bot";
export const GTM_BOT_URL = "https://birchreserve.net/gtm-bot";
export const GTM_BOT_KIND = "gtm_bot_inquiry" as const;
export const GTM_BOT_SOURCE = "gtm_bot" as const;
export const GTM_BOT_BUSINESS_LINE = "SBG" as const;
export const GTM_BOT_ALERT_TO = ["randy@silverbirchgrowth.com"] as const;

export const GTM_BOT = {
  eyebrow: "B2B go-to-market · Silver Birch Growth Inc.",
  title: "B2B go-to-market, powered by Silver Birch Growth Inc.",
  sub: "Built on decades of go-to-market experience and trained on Silver Birch Growth's own data.",
  teaserTitle: "B2B go-to-market, powered by Silver Birch Growth Inc.",
  teaserBody: "SBG takes on only rare strategic projects and is pointed at portfolio value creation right now — so it isn't something you can buy.",
  teaserCta: "Read the note",
  points: [
    { t: "Built on real GTM experience", d: "Decades of go-to-market work, sales turnarounds and commercial judgment, put into an internal system." },
    { t: "Trained on our own data", d: "Designed and trained on Silver Birch Growth's proprietary data, with Randy and Jon directly at the controls." },
    { t: "Pointed at portfolio value creation", d: "Applied across our own portfolio. We don't name portfolio companies." },
  ],
  selective: { t: "Rare strategic projects only", d: "Silver Birch Growth takes on only rare strategic projects and is pointed at portfolio value creation right now." },
  availability: { t: "Not something you can buy", d: "No setup packages, no rate card, and no open client roster. If an unusual strategic fit comes along, we'll say so." },
  how: [
    { n: "1", t: "Portfolio first", d: "Our B2B go-to-market capacity is pointed at portfolio value creation." },
    { n: "2", t: "Rare exceptions only", d: "Every outside inquiry is reviewed directly — most are a polite no." },
    { n: "3", t: "Ad inventory stays open", d: "For media placements inside Scale Health hubs, Birch Reserve's rate card is open." },
  ],
  note: "Not an offer for sale. No outcomes are guaranteed and nothing is charged from this page.",
  cta: "Share a strategic note",
} as const;

export const GTM_BOT_FIELDS = ["what_they_sell", "stage", "bots_preference"] as const;
export const GTM_BOT_STAGES = ["Pre-launch", "Early sales", "Growing", "Established"] as const;
export const GTM_BOT_PREFS = ["Strategic partnership", "Distribution fit", "Not sure yet"] as const;

export const GTM_BOT_FACT =
  "B2B go-to-market, powered by Silver Birch Growth Inc.: built on decades of go-to-market experience, sales turnarounds and commercial judgment; designed and trained on Silver Birch Growth's proprietary data with Randy and Jon at the controls. SBG takes on only rare strategic projects and is pointed at portfolio value creation right now, so it isn't something you can buy. Never quote a price or promise outcomes. Note page: https://birchreserve.net/gtm-bot.";
