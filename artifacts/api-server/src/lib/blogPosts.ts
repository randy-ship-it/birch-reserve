/**
 * Birch Reserve blog (Randy, Nov 19 2026): evergreen posts on ads and distribution.
 * Each post takes one credible outside idea, rewrites it fully in Birch's voice, and credits the original
 * with an "Inspired by" line and link. Standalone: no DB imports.
 *
 * Copy rules: say "retail hubs"; no impression guarantees and no CTR/ROAS claims for Birch (Estimate/Modelled
 * labels only); USD only; no invented stats (an outside number is attributed to its author or left out);
 * no em dashes in body copy. The CTA is always /intake.
 */

export type BlogVisual =
  | { kind: "steps"; title: string; items: { label: string; sub: string }[] }
  | { kind: "split"; title: string; note: string; items: { label: string; pct: number; sub: string }[] }
  | { kind: "loop"; title: string; items: { label: string; sub: string }[] };

export type BlogSection = { h2: string; paras?: string[]; bullets?: string[]; quote?: string };

export type BlogPost = {
  slug: string;
  title: string;
  h1: string;
  kicker: string;
  description: string;
  lede: string;
  minutes: number;
  tldr: [string, string, string];
  visual: BlogVisual;
  sections: BlogSection[];
  birch: { h2: string; bullets: string[] };
  inspired: { by: string; work: string; url: string };
};

export const BLOG_INDEX_PATH = "/blog";
export const BLOG_PUBLISHED = "2026-11-19";
export const NETWORK_LINE = "120+ retail hubs · 1MM+ recovery customers (est., growing to 300–500+ hubs)";
export const STREET_TEAM_LINE = "Our Street Team reaches an estimated 2MM+ doors targeted around the retail network.";

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "paid-ads-are-fuel-not-a-fix",
    title: "Paid ads are fuel, not a fix: a playbook for brands | Birch Reserve",
    h1: "Paid ads are fuel, not a fix",
    kicker: "Ads",
    description:
      "Why the offer matters more than the targeting, how to judge an ad by its first seconds, and the two numbers that tell you when to spend more.",
    lede: "Ads multiply whatever you already have. Pour them on an offer people want and it spreads. Pour them on a weak one and you just lose money faster.",
    minutes: 4,
    tldr: [
      "Make the offer impossible to ignore before you touch targeting.",
      "Most ads lose. Run enough of them to find the few that carry you.",
      "Spend more only while a customer is worth far more than they cost.",
    ],
    visual: {
      kind: "split",
      title: "One way to split a test budget",
      note: "Alex Hormozi's rule of thumb. A starting point, not a law.",
      items: [
        { label: "More of what works", pct: 70, sub: "Your proven ads, scaled" },
        { label: "Twists on winners", pct: 20, sub: "New hooks, same core" },
        { label: "Wild swings", pct: 10, sub: "Ideas that might flop" },
      ],
    },
    sections: [
      {
        h2: "Start with something people already buy",
        paras: [
          "Ads are a way to rent attention from strangers. They do not create demand for a product nobody wants. If word of mouth is quiet and repeat buyers are rare, fix that first.",
          "The best offers make one narrow problem disappear completely, quickly, with little effort from the buyer. Raise the payoff and the odds it works. Cut the time and hassle. That is where most of the gains hide.",
        ],
        quote: "A sharp offer with plain creative beats beautiful creative on a tired offer.",
      },
      {
        h2: "Give every ad three jobs",
        bullets: [
          "Stop the right person. Name who it is for, out loud.",
          "Give them a reason. What they get, and how soon they feel it.",
          "Tell them the next step. One action, with a reason to take it now.",
        ],
        quote: "The landing page should repeat the ad's promise, word for word. Any gap leaks buyers.",
      },
      {
        h2: "The opening does most of the work",
        paras: [
          "If the first few seconds miss, nothing after them gets seen. Film many openings, a few middles and one or two closes, then mix and match. Your best organic posts are strong candidates because the audience already voted for them.",
        ],
      },
      {
        h2: "Know two numbers",
        bullets: [
          "What it costs to win a customer.",
          "The gross profit that customer brings over their lifetime.",
          "Hormozi's bar: lifetime gross profit around three times the cost to win them. Below that, fix the business. Above it, spend more.",
        ],
        quote: "If you cannot see which ad made the sale, you are guessing.",
      },
      {
        h2: "Expect to pay tuition",
        paras: [
          "Early spend buys lessons. Set a learning budget you can afford to lose, track every dollar, and only scale once the math holds. When results slow, look past the ad: the offer, the page or the follow-up is often the real limit.",
        ],
      },
    ],
    birch: {
      h2: "How this plays at Birch",
      bullets: [
        "Suppliers start performance-only: no setup fee and no monthly fee. You share revenue only on activated sales, so the learning phase does not come out of an ad budget.",
        "Your offer reaches recovery customers inside retail hubs right after a purchase, when the problem is top of mind. The brand approves every placement.",
        "Once you know your two numbers, upgrade to display on CPM or CPC and scale what works.",
      ],
    },
    inspired: {
      by: "Alex Hormozi, as summarised by Gaurav (@gauravsbuilding) on X",
      work: "Alex Hormozi on how to actually run paid ads",
      url: "https://x.com/gauravsbuilding/status/2123310308215431492",
    },
  },
  {
    slug: "every-channel-wears-out",
    title: "Every ad channel wears out. Plan for it | Birch Reserve",
    h1: "Every channel wears out. Plan for it.",
    kicker: "Distribution",
    description:
      "Why every marketing channel gets less effective as it matures, and how brands stay ahead by rotating creative and moving early into less crowded places.",
    lede: "The channel that works brilliantly today will work less well next year. That is not bad luck. It is how attention behaves.",
    minutes: 3,
    tldr: [
      "Novelty fades, copycats arrive, audiences learn to look away.",
      "Fresh creative slows the decline but does not stop it.",
      "The edge belongs to brands that move into new, uncrowded places early.",
    ],
    visual: {
      kind: "steps",
      title: "The life of a channel",
      items: [
        { label: "Discovery", sub: "Few brands, lots of attention" },
        { label: "Copycats", sub: "Rivals see it working and pile in" },
        { label: "Tune-out", sub: "People learn to skip the format" },
        { label: "Next channel", sub: "Early movers win again" },
      ],
    },
    sections: [
      {
        h2: "Why results slide",
        bullets: [
          "Novelty wears off. People engage with a new format out of curiosity, then stop noticing it.",
          "Competition piles in. Once a tactic works, rivals can see it and copy it, and prices climb.",
          "Audiences adapt. Eye-tracking research has long shown people steering their eyes around anything that looks like a banner.",
        ],
        quote: "Whatever looks like an ad gets skipped. Sooner or later, that includes yours.",
      },
      {
        h2: "Slow the slide",
        bullets: [
          "Rotate creative on a schedule, before fatigue shows up in your numbers.",
          "Be genuinely useful. Ads that solve a real problem in the moment get filtered out less.",
          "Show up where the context explains why you are there.",
        ],
      },
      {
        h2: "Move before the crowd",
        paras: [
          "New channels perform well for a simple reason: few brands are there yet. The brands that test early, learn fast and scale before prices rise get the best years of every channel. Keep a slice of budget for exploring, always.",
        ],
        quote: "Do not ask which channel works. Ask which channel is still early.",
      },
    ],
    birch: {
      h2: "How this plays at Birch",
      bullets: [
        "Retail hubs put your brand inside a recovery customer's purchase journey, a context far less crowded than public social feeds.",
        "Every placement is curated and approved by the brand, so your offer sits next to care the customer already chose.",
        "Start performance-only to test the channel cheaply, then add display on CPM or CPC once it earns it. Reach figures are modelled estimates, never guarantees.",
      ],
    },
    inspired: {
      by: "Andrew Chen",
      work: "The Law of Shitty Clickthroughs",
      url: "https://andrewchen.com/the-law-of-shitty-clickthroughs/",
    },
  },
  {
    slug: "product-channel-fit",
    title: "Product-channel fit: your product needs a channel that fits | Birch Reserve",
    h1: "Your product needs a channel that fits it",
    kicker: "Go-to-market",
    description:
      "Great products still stall when the market, product, channel and business model do not fit together. Here is how to check all four.",
    lede: "Plenty of good products never grow. Usually the product is fine. It is the path to the buyer that does not fit.",
    minutes: 4,
    tldr: [
      "Growth needs four pieces to fit: market, product, channel and model.",
      "You cannot bolt a channel onto a product. Build them for each other.",
      "Fits break as you grow, so revisit all four, not just one.",
    ],
    visual: {
      kind: "loop",
      title: "Four fits that feed each other",
      items: [
        { label: "Market", sub: "A real group with a real problem" },
        { label: "Product", sub: "Solves it clearly for them" },
        { label: "Channel", sub: "Reaches them at a cost that works" },
        { label: "Model", sub: "Price and margin that pay for the channel" },
      ],
    },
    sections: [
      {
        h2: "Product-market fit is only one of four",
        paras: [
          "A product people love still needs a way to reach them that the business can afford. Price sets the channel. A low-ticket product cannot carry an expensive sales team. A high-ticket one may need a human conversation that a cheap ad cannot deliver.",
        ],
        quote: "Design the product and the path to the buyer together, or one will fight the other.",
      },
      {
        h2: "Check the fits honestly",
        bullets: [
          "Market and product: does a specific group pull the product toward them?",
          "Product and channel: does the product suit how that channel works, its format and its pace?",
          "Channel and model: does the price and margin cover what the channel costs?",
          "Model and market: is the market big enough at that price to matter?",
        ],
      },
      {
        h2: "Expect the fits to break",
        paras: [
          "Channels mature, prices change and markets shift. When one fit breaks, changing a single piece rarely fixes it. Step back and look at all four together.",
        ],
      },
    ],
    birch: {
      h2: "How this plays at Birch",
      bullets: [
        "Recovery products often sell best on a trusted recommendation. Retail hubs put them in front of customers right after a related purchase.",
        "Performance-only terms line the channel cost up with your margin: you share revenue only when a sale activates.",
        "Agencies can test channel fit for several brands at once and scale the ones that click.",
      ],
    },
    inspired: {
      by: "Brian Balfour",
      work: "Why Product Market Fit Isn't Enough",
      url: "https://brianbalfour.com/essays/product-market-fit-isnt-enough",
    },
  },
  {
    slug: "do-things-that-dont-scale-distribution",
    title: "Hand-built distribution: do things that don't scale | Birch Reserve",
    h1: "Hand-built distribution beats waiting for scale",
    kicker: "Distribution",
    description:
      "Why the brands that grow fastest start by recruiting customers by hand, in a narrow market, and how to turn that into a repeatable channel.",
    lede: "No brand starts with momentum. The ones that grow go out and get their first customers by hand, one conversation and one doorstep at a time.",
    minutes: 3,
    tldr: [
      "Recruit early customers manually. It is the job, not a detour.",
      "Win a narrow market completely before spreading wide.",
      "Over-deliver for the first buyers. They become the channel.",
    ],
    visual: {
      kind: "steps",
      title: "From hand-built to repeatable",
      items: [
        { label: "Go to them", sub: "Find buyers in person" },
        { label: "Delight them", sub: "Service that feels personal" },
        { label: "Own a niche", sub: "Win one dense pocket" },
        { label: "Systemise", sub: "Turn what worked into a channel" },
      ],
    },
    sections: [
      {
        h2: "Recruiting by hand is the work",
        paras: [
          "Founders often hope a launch or a viral moment will do the selling. It rarely does. The early wins come from going to where buyers already are and asking them directly.",
        ],
        quote: "Lighting a fire takes a match and patience, not a bigger fireplace.",
      },
      {
        h2: "Go narrow, then go deep",
        paras: [
          "A small, dense market is easier to win than a big, thin one. Saturate one group so thoroughly that people hear about you from each other, then expand to the next.",
        ],
      },
      {
        h2: "Over-deliver early",
        bullets: [
          "Treat first customers like partners, not numbers.",
          "Do some of the setup for them. Watch where they struggle.",
          "Write down what worked so it can be repeated by a team.",
        ],
      },
    ],
    birch: {
      h2: "How this plays at Birch",
      bullets: [
        STREET_TEAM_LINE,
        "Retail hubs give you dense, local pockets of recovery customers to win one at a time.",
        "Placements are curated by hand and approved by your brand, which is slow by design and lets you learn before you scale.",
      ],
    },
    inspired: {
      by: "Paul Graham",
      work: "Do Things that Don't Scale",
      url: "https://paulgraham.com/ds.html",
    },
  },
  {
    slug: "brand-and-activation-balance",
    title: "Build the brand and the sale at the same time | Birch Reserve",
    h1: "Build the brand and the sale at the same time",
    kicker: "Media buying",
    description:
      "Short-term response ads and long-term brand building work differently. Here is how to fund both without letting quick metrics run the show.",
    lede: "Some ads sell this week. Others make next year easier. Brands that only buy the first kind slowly run out of people who already want them.",
    minutes: 4,
    tldr: [
      "Activation captures people ready to buy now.",
      "Brand building grows the pool of future buyers, and it compounds.",
      "Quick metrics flatter activation, so protect the brand budget on purpose.",
    ],
    visual: {
      kind: "split",
      title: "A widely cited balance",
      note: "Les Binet and Peter Field's often-quoted guideline from their IPA research. The right mix varies by category.",
      items: [
        { label: "Brand building", pct: 60, sub: "Broad reach, memorable, lasting" },
        { label: "Activation", pct: 40, sub: "Targeted, timely, sells now" },
      ],
    },
    sections: [
      {
        h2: "Two jobs, two timelines",
        bullets: [
          "Activation: reach people already shopping, with a reason to buy now. Effects are quick and fade fast.",
          "Brand building: reach many people, most of whom are not shopping yet, and give them something to remember. Effects build slowly and last.",
        ],
        quote: "The ad that sells today and the ad that sells next year are rarely the same ad.",
      },
      {
        h2: "Why quick metrics mislead",
        paras: [
          "Short-term numbers are easy to see, so they win budget arguments. But they mostly measure people who were going to buy anyway. Cut brand building and sales hold for a while, then sag as the pool of warm buyers drains.",
        ],
      },
      {
        h2: "Fund both on purpose",
        bullets: [
          "Decide the split before the campaign, not after the first dashboard.",
          "Judge brand spend over months, activation over weeks.",
          "Keep your look and voice consistent so every impression adds up.",
        ],
      },
    ],
    birch: {
      h2: "How this plays at Birch",
      bullets: [
        "Performance-only placements in retail hubs are your activation: offers in front of customers right after a purchase.",
        "Display on CPM or CPC adds steady, broad presence across the network. Reach figures are modelled estimates.",
        STREET_TEAM_LINE,
      ],
    },
    inspired: {
      by: "Les Binet and Peter Field (IPA)",
      work: "The Long and the Short of It",
      url: "https://ipa.co.uk/knowledge/publications-reports/the-long-and-the-short-of-it-balancing-short-and-long-term-marketing-strategies",
    },
  },
  {
    slug: "mental-and-physical-availability",
    title: "Be easy to think of and easy to buy | Birch Reserve",
    h1: "Be easy to think of and easy to buy",
    kicker: "Retail media",
    description:
      "Brands grow by reaching more buyers, not just squeezing loyal ones. The two levers: coming to mind at the right moment and being easy to find.",
    lede: "Big brands are not big because a few fans buy a lot. They are big because lots of people buy them now and then. Growth means reaching more of those people.",
    minutes: 4,
    tldr: [
      "Growth comes mostly from more buyers, including light, occasional ones.",
      "Mental availability: come to mind in the buying moment.",
      "Physical availability: be easy to find and buy wherever they shop.",
    ],
    visual: {
      kind: "steps",
      title: "The two levers of growth",
      items: [
        { label: "Reach widely", sub: "Talk to all category buyers" },
        { label: "Be memorable", sub: "Distinctive look, used every time" },
        { label: "Be findable", sub: "Present where they buy" },
        { label: "Grow buyers", sub: "More people, buying now and then" },
      ],
    },
    sections: [
      {
        h2: "More buyers beats more loyalty",
        paras: [
          "It is tempting to focus all spend on your best customers. The research from the Ehrenberg-Bass Institute points the other way: brands grow mainly by adding buyers, and most of those buyers are light ones you will rarely hear from.",
        ],
        quote: "Do not over-target. The buyer you ignored this year is next year's growth.",
      },
      {
        h2: "Come to mind at the right moment",
        bullets: [
          "Link your brand to the situations where people need it, not just to your features.",
          "Build distinctive assets: colours, shapes, a voice. Then use them everywhere, for years.",
          "Reach broadly and keep reaching. Memories fade without reminders.",
        ],
      },
      {
        h2: "Be easy to buy",
        paras: [
          "Being remembered is wasted if the product is hard to find. Be present in the places category buyers already go, with packaging and placement they can spot fast.",
        ],
      },
    ],
    birch: {
      h2: "How this plays at Birch",
      bullets: [
        `The network: ${NETWORK_LINE}.`,
        "Retail hubs add physical availability: your product is presented where recovery customers already buy care.",
        "Display on CPM or CPC builds mental availability with consistent creative across the network. Reach is a modelled estimate.",
      ],
    },
    inspired: {
      by: "Byron Sharp and the Ehrenberg-Bass Institute",
      work: "How Brands Grow",
      url: "https://global.oup.com/academic/product/how-brands-grow-9780195573565",
    },
  },
];

export const BLOG_PATHS: readonly string[] = BLOG_POSTS.map((p) => `${BLOG_INDEX_PATH}/${p.slug}`);
