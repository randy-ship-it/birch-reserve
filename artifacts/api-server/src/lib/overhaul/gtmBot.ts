/**
 * GTM bot (Randy t415u/t416u, Nov 21 2026): the SBG-side offer, separate from the Birch ad product and from the
 * /intake/gtm setup packages block. One source of truth for the /gtm-bot page, the home teaser, SEO and chat.
 * Qualitative only: no client names, no numbers beyond the existing "from $3,500 USD" setup figure, no guarantees.
 */
export const GTM_BOT_HREF = "/gtm-bot";
export const GTM_BOT_URL = "https://birchreserve.net/gtm-bot";
export const GTM_BOT_KIND = "gtm_bot_inquiry" as const;
export const GTM_BOT_SOURCE = "gtm_bot" as const;
export const GTM_BOT_BUSINESS_LINE = "SBG" as const;
export const GTM_BOT_ALERT_TO = ["randy@silverbirchgrowth.com"] as const;

export const GTM_BOT = {
  eyebrow: "Silver Birch Growth · GTM bot",
  title: "The GTM bot, from the people who run it every day.",
  sub: "A go-to-market system built on decades of GTM experience, sales turnarounds and persuasive sales expertise.",
  teaserTitle: "Meet the GTM bot",
  teaserBody: "Built on decades of go-to-market experience and trained on Silver Birch Growth's own data. We stand it up selectively, for products that deserve it.",
  teaserCta: "See the GTM bot",
  points: [
    { t: "Built on real GTM experience", d: "Decades of go-to-market work, sales turnarounds and persuasive sales expertise, put into a system." },
    { t: "Trained on our own data", d: "Designed and trained on Silver Birch Growth's proprietary data, with Randy and Jon directly at the controls." },
    { t: "Proven on our own portfolio", d: "We apply it across our own portfolio to grow it. We don't name portfolio companies." },
  ],
  selective: { t: "Selective by design", d: "We stand these up only when you have a good product. If it isn't a fit, we'll say so." },
  pricing: { t: "How pricing works", d: "An initial setup, from $3,500 USD, then monthly ranges scoped to your needs. Performance models are available after setup. Your bots or ours." },
  how: [
    { n: "1", t: "Tell us about your product", d: "A short form. We review it ourselves." },
    { n: "2", t: "We tell you if it's a fit", d: "A direct reply by email, usually within 1 business day." },
    { n: "3", t: "Set up, then run it", d: "We stand it up, then you choose: your bot or ours." },
  ],
  note: "No outcomes are guaranteed and nothing here is a forecast. Nothing is charged from this form.",
  cta: "Tell us about your product",
} as const;

export const GTM_BOT_FIELDS = ["what_they_sell", "stage", "bots_preference"] as const;
export const GTM_BOT_STAGES = ["Pre-launch", "Early sales", "Growing", "Established"] as const;
export const GTM_BOT_PREFS = ["Your bots (we set up)", "Our bots (we run)", "Not sure yet"] as const;

export const GTM_BOT_FACT =
  "GTM bot (Silver Birch Growth side): built on decades of go-to-market experience, sales turnarounds and persuasive sales expertise; designed and trained on Silver Birch Growth's proprietary data with Randy and Jon directly at the controls; applied across the SBG portfolio. Selective: set up only for products that are a good fit. Pricing is an initial setup from $3,500 USD, then monthly ranges scoped to the client's needs, with performance models available after setup; your bots or ours. No guarantees or forecasts. Start at https://birchreserve.net/gtm-bot.";
