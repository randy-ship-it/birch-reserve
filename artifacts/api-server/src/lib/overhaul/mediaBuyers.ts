/**
 * /media-buyers (Nov 18 2026 preview): Birch Reserve for media buyers and performance marketers who already run
 * display and paid-social campaigns. Copy only restates terms already published on /media-kit, /agencies, /rates
 * and /terms: the same two USD offers, the same premium inquiry, prepaid media credit until the IO, aggregate
 * reporting only. No impression guarantees, no CTR or ROAS claims, no partner counts.
 */

export const MEDIA_BUYERS_PATH = "/media-buyers";

/** Where Birch sits next to the channels a performance team already buys. Birch facts only; no competitor claims. */
export const MIX_ROWS: Array<{ key: string; channel: string; youBuyItFor: string; birchAdds: string }> = [
  {
    key: "programmatic",
    channel: "Programmatic display and retargeting",
    youBuyItFor: "Reach and frequency across the open web, bought through a DSP.",
    birchAdds: "Hand-placed display inside private health and wellness hubs. Not an open auction and not sold through a DSP; the IO names the hub and placement.",
  },
  {
    key: "social",
    channel: "Paid social",
    youBuyItFor: "Prospecting and retargeting in the feed.",
    birchAdds: "A placement on the pages members use right after they buy or book, and when they log back in.",
  },
  {
    key: "retail-media",
    channel: "Retail media",
    youBuyItFor: "Shoppers on a retailer's own site and app.",
    birchAdds: "The same first-party idea, inside health and wellness businesses: recovery brands, studios and physio clinics.",
  },
  {
    key: "newsletters",
    channel: "Newsletter and creator sponsorships",
    youBuyItFor: "A trusted voice in front of a niche audience.",
    birchAdds: "A fixed placement on a hub page for the term on the IO, tracked with your UTM links and promo codes.",
  },
];

/**
 * "Two ways to buy" for direct media buyers (daily scan Nov 25 2026). Same compare pattern as BUY_PATHS on /agencies,
 * minus the agency-discount row (direct buyers pay the published rate card). Restates published terms only; no new
 * price points (premium stays inquire-only on this page).
 */
export const MB_BUY_PATHS = {
  card: {
    key: "card",
    kicker: "Card · self-serve",
    price: "From $190 USD",
    sub: "7-day look, or the $490 USD category placement",
  },
  io: {
    key: "io",
    kicker: "Premium · insertion order (IO)",
    price: "By inquiry",
    sub: "Exclusivity and priority placement",
  },
  rows: [
    { k: "Best for", card: "A first test, starting now", io: "Several hubs or a bigger test" },
    { k: "Pay", card: "Card on a Stripe-hosted page, no login", io: "Rate, currency and term set on your IO" },
    { k: "Before it runs", card: "You approve an IO naming the hub and placement", io: "Send the brief; we reply with hub fit and a draft IO" },
    { k: "Refunds", card: "$490 refundable until 14 days before launch; $190 converts or is refunded", io: "Set on your IO before anything runs" },
  ],
} as const;

/**
 * "What to check before you buy", folded under Two ways to buy. Six answers restated from the published
 * /media-buyers and /agencies terms. {look} and {reserve} are filled on the page from the live price labels
 * (hold-190 / reserve-490); this copy names no price of its own.
 */
export const MB_BUY_CHECKLIST: ReadonlyArray<{ label: string; answer: string }> = [
  {
    label: "Where it shows",
    answer: "Four placements: post-purchase (premium, by IO), hub home page, product / services pages, member dashboard behind login. The IO names the hub, surface, format and dates.",
  },
  {
    label: "Controls",
    answer: "Nothing runs until you approve an insertion order naming the hub, placement and flight dates. No open web, no user-generated content, no programmatic resale.",
  },
  {
    label: "Cost",
    answer: "From {look} for a 7-day look, or the {reserve} category placement by card. Premium and several hubs by IO.",
  },
  {
    label: "Refunds",
    answer: "The category placement is media credit, fully refundable until 14 days before the launch date on the IO. The look converts in full to the category placement within 7 days, or it's refunded.",
  },
  {
    label: "Tracking",
    answer: "Your UTM links and promo codes. No clinical pixels and no patient data on hub pages.",
  },
  {
    label: "Reporting",
    answer: "Aggregate views and clicks per hub and surface, plus UTM visits and redemptions. Pre-launch figures are labelled Modelled. No impression guarantees.",
  },
];

/** How a test is read. Aggregate only; matches /agencies plain terms and /terms. */
export const MEASUREMENT_STEPS: Array<{ k: string; t: string; d: string }> = [
  { k: "1", t: "Your UTM links", d: "Every placement carries the UTM parameters you send, so Birch traffic shows up as its own line in the analytics you already use." },
  { k: "2", t: "Your promo code", d: "Add a code per hub or per placement if you want redemptions you can count on your side." },
  { k: "3", t: "Our report", d: "Views and clicks per hub and surface, plus UTM visits and promo-code redemptions. Aggregate only: never names, contact details or health information." },
  { k: "4", t: "Labelled figures", d: "Anything we estimate before launch is labelled Modelled. It is an estimate, not measured delivery and not a guarantee." },
];

/**
 * "How we count" (Nov 27 2026): one compact disclosure of the counting rules, in the order commerce-media buyers
 * compare networks (cost model, what a view is, clicks, filtering, frequency, attribution, identity). Every row
 * restates the public developer docs (/ads/docs, lib/adserver/docsPage.ts) and lib/adserver/config.ts values
 * (VIEWABILITY 50% / 1 s, freqCapPerDay 6, clickWindowDays 7, viewWindowDays 1). A test keeps them in sync.
 */
export const HOW_WE_COUNT_DOCS_HREF = "/ads/docs";
export const HOW_WE_COUNT: ReadonlyArray<{ label: string; answer: string }> = [
  { label: "Cost model", answer: "Display is billed per thousand viewable views (CPM). CPC is billed per click. No auction." },
  { label: "A view", answer: "Half the ad on screen for one continuous second, with the tab visible (IAB/MRC display standard)." },
  { label: "A click", answer: "Counted once per served ad, then sent to your page with your UTM tags." },
  { label: "Filtering", answer: "Known bots, crawlers, previews and headless browsers are never counted. Instant clicks are dropped. Repeats count once." },
  { label: "Frequency", answer: "Up to 6 viewable views per visitor per campaign per day by default." },
  { label: "Attribution", answer: "Optional pixel or server postback: last click within 7 days, adjustable per campaign. On carts inside a hub, a view within 1 day can also count." },
  { label: "Identity", answer: "Aggregate counts only. No names, emails, IP addresses or cross-site cookies. Do Not Track and GPC are honoured." },
];

/** Answer-ready FAQ for performance teams. Emitted once as FAQPage JSON-LD, server-side (seo.ts). */
export const MEDIA_BUYER_FAQ: Array<{ q: string; a: string }> = [
  { q: "What is Birch Reserve, for a media buyer?", a: "A first-party display channel inside private, co-branded health and wellness hubs. Four placements: post-purchase (right after a paid order or booking, premium by IO), the hub home page, product and services pages, and the member dashboard behind login. Bought as display (per thousand views) or CPC (per click)." },
  { q: "Is this programmatic? Can we buy it through our DSP?", a: "No. It is not an open auction and is not sold through a DSP. Placements are curated by hand as each hub launches, and nothing runs until an insertion order names the hub, surface, format and dates." },
  { q: "How does it fit an existing display mix?", a: "Run it as its own line item next to your programmatic, paid social and retail media buys. Tag it with your UTM links and promo codes so it reads as a separate source in your own analytics." },
  { q: "How is a test measured?", a: "Aggregate reporting per hub and surface: views, clicks, UTM visits and promo-code redemptions. Never names, contact details or health information. Any pre-launch view figure is labelled Modelled and is not a guarantee." },
  { q: "Do you guarantee impressions, CTR or ROAS?", a: "No. There are no impression guarantees and no promised click-through or return figures. Your campaign is measured with your UTM links and promo codes." },
  { q: "What does the smallest test cost?", a: "The $190 USD 7-day category look, which converts in full to the $490 USD category placement within 7 days or is refunded. The $490 USD category placement is 100% media credit, fully refundable until 14 days before the launch date on the IO and usable for 12 months. Premium slots are inquire-only." },
  { q: "Which placement suits a performance goal?", a: "Conversion: post-purchase, right after a paid order or booking (premium, by insertion order). Consideration: product, services and booking pages. Retention: the member dashboard behind login. Awareness: the hub home page. One IO can mix them." },
  { q: "Do you drop tracking pixels on hub pages?", a: "No clinical pixels and no patient data. Measurement runs on your UTM links, your promo codes and our aggregate hub analytics." },
];
