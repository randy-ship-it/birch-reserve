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

/** How a test is read. Aggregate only; matches /agencies plain terms and /terms. */
export const MEASUREMENT_STEPS: Array<{ k: string; t: string; d: string }> = [
  { k: "1", t: "Your UTM links", d: "Every placement carries the UTM parameters you send, so Birch traffic shows up as its own line in the analytics you already use." },
  { k: "2", t: "Your promo code", d: "Add a code per hub or per placement if you want redemptions you can count on your side." },
  { k: "3", t: "Our report", d: "Views and clicks per hub and surface, plus UTM visits and promo-code redemptions. Aggregate only: never names, contact details or health information." },
  { k: "4", t: "Labelled figures", d: "Anything we estimate before launch is labelled Modelled. It is an estimate, not measured delivery and not a guarantee." },
];

/** Answer-ready FAQ for performance teams. Emitted once as FAQPage JSON-LD, server-side (seo.ts). */
export const MEDIA_BUYER_FAQ: Array<{ q: string; a: string }> = [
  { q: "What is Birch Reserve, for a media buyer?", a: "A first-party display channel inside private, co-branded health and wellness hubs. Four placements: post-purchase (right after a paid order or booking, premium by IO), the hub home page, product and services pages, and the member dashboard behind login. Bought as display (per thousand views) or CPC (per click)." },
  { q: "Is this programmatic? Can we buy it through our DSP?", a: "No. It is not an open auction and is not sold through a DSP. Placements are curated by hand as each hub launches, and nothing runs until an insertion order names the hub, surface, format and dates." },
  { q: "How does it fit an existing display mix?", a: "Run it as its own line item next to your programmatic, paid social and retail media buys. Tag it with your UTM links and promo codes so it reads as a separate source in your own analytics." },
  { q: "How is a test measured?", a: "Aggregate reporting per hub and surface: views, clicks, UTM visits and promo-code redemptions. Never names, contact details or health information. Any pre-launch view figure is labelled Modelled and is not a guarantee." },
  { q: "Do you guarantee impressions, CTR or ROAS?", a: "No. There are no impression guarantees and no promised click-through or return figures. Your campaign is measured with your UTM links and promo codes." },
  { q: "What does the smallest test cost?", a: "The $190 USD 7-day category look, which converts in full to the $490 USD reserve within 7 days or is refunded. The $490 USD reserve is 100% media credit, fully refundable until 14 days before the launch date on the IO and usable for 12 months. Premium slots are inquire-only." },
  { q: "Which placement suits a performance goal?", a: "Conversion: post-purchase, right after a paid order or booking (premium, by insertion order). Consideration: product, services and booking pages. Retention: the member dashboard behind login. Awareness: the hub home page. One IO can mix them." },
  { q: "Do you drop tracking pixels on hub pages?", a: "No clinical pixels and no patient data. Measurement runs on your UTM links, your promo codes and our aggregate hub analytics." },
];
