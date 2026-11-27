/**
 * Advertiser guides (Randy, Nov 15 2026): server-rendered SEO pages for brands
 * searching for compliant places to advertise outside crowded public auctions.
 *
 * Rules for this copy: every number is cited and labelled as a third-party
 * estimate; no Birch prices (link to /media-kit instead); no guarantees; never
 * framed as a way around platform or regulator rules. Birch does not run
 * prescription-drug promotion.
 */

import { BUYER_PAGES } from "./buyerAnswers";

export type GuideSource = { label: string; url: string };
export type GuideSection = { h2: string; paras?: string[]; bullets?: string[] };
export type AdvertiserGuide = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  lede: string;
  sections: GuideSection[];
  sources: GuideSource[];
  /** Buyer-answer / category pages (lib/buyerAnswers.ts, Nov 22 2026). Optional; classic guides leave them out. */
  group?: "answer" | "category";
  /** Answer-first box under the H1 (the sentence an AI assistant should quote). */
  answer?: string;
  tiles?: { k: string; v: string }[];
  compare?: { caption: string; head: string[]; rows: string[][] };
  faq?: { q: string; a: string }[];
  /** Small illustrative placement mock (no brand creative). */
  mock?: boolean;
  status?: string;
  /** /exclusive category option to preselect (TWO_LANE_CATEGORIES label). */
  exclusiveCategory?: string;
  related?: { label: string; href: string }[];
};

export const GUIDES_INDEX_PATH = "/advertiser-guides";
export const GUIDES_REVIEWED = "November 15, 2026";

const SRC = {
  googleRx: { label: "Google Ads Help: Prescription drug services policy", url: "https://support.google.com/adspolicy/answer/15598647?hl=en" },
  googleHealth: { label: "Google Ads Help: Healthcare and medicines policy", url: "https://support.google.com/adspolicy/answer/176031?hl=en" },
  googleNov26: { label: "Google Ads Help: Update to Healthcare and Medicines Policy (November 2026)", url: "https://support.google.com/adspolicy/answer/18794834" },
  metaRx: { label: "Meta Transparency Center: Drugs and pharmaceuticals ad standard", url: "https://transparency.meta.com/en-us/policies/ad-standards/restricted-goods-services/drugs-pharmaceuticals/" },
  fdaMar26: { label: "FDA: FDA warns 30 telehealth companies against illegal marketing of compounded GLP-1s (Mar 3, 2026)", url: "https://www.fda.gov/news-events/press-announcements/fda-warns-30-telehealth-companies-against-illegal-marketing-compounded-glp-1s" },
  sheppard: { label: "Sheppard Mullin: Another wave of FDA warning letters (June 2026)", url: "https://www.sheppard.com/insights/blogs/fdas-focus-returns-to-compounding-and-telehealth-another-wave-of-warning-letters" },
  hcRx: { label: "Health Canada: Illegal marketing of prescription drugs", url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/marketing-drugs-devices/illegal-marketing/prescription-drugs.html" },
  hcC01044: { label: "Food and Drug Regulations, section C.01.044", url: "https://laws-lois.justice.gc.ca/eng/regulations/c.r.c.,_c._870/section-c.01.044.html" },
  hcNhp: { label: "Health Canada: Illegal marketing of natural and non-prescription health products", url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/marketing-drugs-devices/illegal-marketing/health-providers/natural-non-prescription.html" },
  hcPreclear: { label: "Health Canada: Health Canada and advertising preclearance agencies' roles", url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/regulatory-requirements-advertising/policies-guidance-documents/advertising-preclearance-agencies-health-product.html" },
  hcGeneric: { label: "Health Canada: Canada approves first generic semaglutide (Apr 28, 2026)", url: "https://www.canada.ca/en/health-canada/news/2026/04/canada-becomes-the-first-g7-country-to-approve-a-generic-version-of-semaglutide.html" },
  nutraGlp1: { label: "NutraIngredients: GLP-1 nutrition race heats up (Aug 25, 2026)", url: "https://www.nutraingredients.com/Article/2026/08/25/glp-1-nutrition-race-heats-up-as-nestle-supplements-and-pharma-target-companion-market/" },
  mhiSupp: { label: "MHI Media: Meta ads benchmarks for supplement brands 2026 (9 DTC brands)", url: "https://mhigrowthengine.com/blog/meta-ads-supplements-benchmarks-2026/" },
  mhiHw: { label: "MHI Media: Meta ads benchmarks for health and wellness brands 2026 (17 DTC brands)", url: "https://mhigrowthengine.com/blog/meta-ads-health-wellness-benchmarks-2026/" },
  adlibRlt: { label: "AdLibrary: Meta ad benchmarks, beauty industry 2026 (devices sub-vertical)", url: "https://adlibrary.com/posts/meta-ad-benchmarks-beauty-industry-2026" },
  kwsRlt: { label: "KWS Trends: 'red light therapy' US search volume and CPC", url: "https://www.kwstrends.com/keywords/us/red-light-therapy" },
  rokt: { label: "Rokt case study: BetterHelp on Rokt Ads", url: "https://www.rokt.com/case-studies/how-betterhelp-scales-their-online-therapy-platform-and-acquires-new-users-with-rokt" },
  aftersell: { label: "Aftersell case study: Exhale Coffee", url: "https://www.aftersell.com/case-study/exhale-coffee" },
  loblaw: { label: "Loblaw: Criteo and Loblaw Advance partner on retail media", url: "https://www.loblaw.ca/en/criteo-and-loblaw-advance-partner-to-expand-advertiser-access-to-premium-retail-media-network/" },
  medspaCpc: { label: "Pronk: Med spa digital marketing benchmarks 2026", url: "https://pronkmedspamarketing.com/blog/med-spa-digital-marketing-benchmarks/" },
} as const;

const BIRCH_FIT =
  "Birch Reserve sells prepaid display credit inside co-branded Scale Health Network hubs, with category exclusivity available on a premium slot set on an insertion order. The surfaces are post-purchase pages, member dashboards, hub home pages and product and service pages, seen by recovery, physio and wellness customers, mostly in Ontario and Quebec plus the US. Audience volumes on our pages are modelled until an insertion order names a hub.";

const BIRCH_RULES =
  "Every placement follows the rules that already apply to your brand: Health Canada, the Competition Act, the FTC and FDA. Birch does not run prescription-drug promotion, and nothing runs until an insertion order names the hub and the creative. We report aggregate results only. There are no guaranteed outcomes.";

export const ADVERTISER_GUIDES: AdvertiserGuide[] = [
  {
    slug: "glp-1-brand-advertising",
    title: "GLP-1 brand advertising in 2026: rules, costs and compliant placements | Birch Reserve",
    h1: "GLP-1 brand advertising: what's allowed, what it costs, and where else to show up",
    description:
      "What Google, Meta, the FDA and Health Canada allow for GLP-1 and GLP-1 companion brands in 2026, what weight-loss clicks cost, and compliant curated placements for companion nutrition.",
    lede:
      "GLP-1 brands aren't banned from search and social. They're squeezed: certification gates, a run of FDA warning letters, and auctions where weight-loss clicks are some of the priciest in health. Here's what's confirmed, and where companion brands can reach recovery and wellness buyers with plain, compliant creative.",
    sections: [
      {
        h2: "What the platforms allow right now",
        bullets: [
          "Google: telemedicine and online pharmacy advertisers must be certified to promote prescription drug services, and approved to bid on prescription drug keywords such as semaglutide. Some third-party accreditation, such as LegitScript or NABP, comes first.",
          "Google added NABP's Healthcare Merchant Accreditation as another route to telemedicine certification in Canada, the UK and the US in November 2026.",
          "Meta: prescription drug ads need LegitScript certification, or Meta's own review for manufacturers, plus Meta authorization. They may only target adults 18+ in the US, Canada or New Zealand.",
          "Supplements can't claim to work like a prescription drug on Google.",
        ],
      },
      {
        h2: "What regulators have done",
        paras: [
          "FDA sent 30 warning letters to telehealth companies over compounded GLP-1 claims on March 3, 2026, and 25 more in June 2026, after roughly 80 in September 2025. The recurring problems are claims implying sameness with FDA-approved drugs, calling compounded products 'generic', and branding that suggests the telehealth company is the compounder.",
          "In Canada, consumer ads for a prescription drug may only state its name, price and quantity (Food and Drug Regulations C.01.044). Health Canada approved the first generic semaglutide on April 28, 2026, but that doesn't change the advertising rule.",
        ],
      },
      {
        h2: "What clicks cost (third-party estimates)",
        paras: [
          "Agency benchmarks put 'semaglutide / weight loss' search clicks around $14 on average, with a $8–$22 range (Pronk, 2026, from Keyword Planner and client data). Other agencies report higher figures in big metros. These are vendor estimates, not audited data.",
          "Across 9 DTC supplement brands, the median Meta cost per first purchase was $80.50 against a $68.68 average order, which means the first order loses money (MHI Media, Oct 2026).",
        ],
      },
      {
        h2: "Where Birch fits, and where it doesn't",
        paras: [
          "Birch does not run GLP-1 drug, compounded drug or prescription promotion. What fits is the companion category: protein and muscle-preservation products, fibre, electrolytes, coaching and other non-prescription support, with claims that stay inside your product licence or label.",
          BIRCH_FIT,
          BIRCH_RULES,
        ],
      },
    ],
    sources: [SRC.googleRx, SRC.googleNov26, SRC.metaRx, SRC.fdaMar26, SRC.sheppard, SRC.hcC01044, SRC.hcGeneric, SRC.medspaCpc, SRC.mhiSupp, SRC.nutraGlp1],
  },
  {
    slug: "advertise-supplements-canada",
    title: "Advertising supplements in Canada: rules, costs and curated placements | Birch Reserve",
    h1: "Advertising supplements in Canada: the rules, the costs, and a curated placement option",
    description:
      "How natural health product advertising works in Canada, what supplement brands pay on Meta, and how to reach recovery and wellness buyers with compliant, curated placements.",
    lede:
      "Supplement brands in Canada play by two rulebooks: Health Canada's rules on claims, and the ad platforms' own policies. Both apply wherever you advertise, including with us. Here's the short version, plus what the auctions cost right now.",
    sections: [
      {
        h2: "The Canadian rules in brief",
        bullets: [
          "Natural health products are regulated under the Food and Drugs Act and the Natural Health Products Regulations.",
          "Promotional claims must match the product licence or label, which Health Canada calls the Terms of Market Authorization.",
          "Don't say a product is 'safe', 'side effect free' or has 'no known side effects'. Don't suggest 'natural' is safer than a pharmaceutical.",
          "Health Canada encourages advertisers to use independent preclearance agencies before ads run.",
        ],
      },
      {
        h2: "What the public auctions cost (third-party estimates)",
        paras: [
          "MHI Media's October 2026 benchmark of 9 DTC supplement brands found a median Meta cost per first purchase of $80.50, rising to $92.34 in October. The median first-order return on ad spend was 0.90, so the typical brand is relying on repeat orders to break even.",
          "Those numbers are one agency's client sample, in USD. Your own figures will differ, but the direction is clear: buying a first order from a cold audience is expensive.",
        ],
      },
      {
        h2: "A curated alternative to cold audiences",
        paras: [
          "Recovery and physio customers already spend on their health and are in a buying moment right after a purchase or booking. That makes protein, creatine, collagen, joint support and electrolytes natural fits.",
          BIRCH_FIT,
          BIRCH_RULES,
        ],
      },
    ],
    sources: [SRC.hcNhp, SRC.hcPreclear, SRC.googleHealth, SRC.mhiSupp],
  },
  {
    slug: "recovery-device-advertising",
    title: "Recovery device advertising: red light, compression and percussion brands | Birch Reserve",
    h1: "Recovery device advertising: reach people already paying for recovery",
    description:
      "What red light, compression and percussion device brands pay on public channels in 2026, the claim rules that apply, and curated placements in front of physio and recovery customers.",
    lede:
      "Recovery devices sell best to people who already think about recovery. On public channels you pay to find them. In a physio or recovery hub, they're the audience.",
    sections: [
      {
        h2: "What public channels cost (third-party estimates)",
        bullets: [
          "Device brands in the beauty sector report cold Meta costs per purchase of about $90–$200 (AdLibrary, 2026, vendor estimate).",
          "Across 17 DTC health and wellness brands, a mix of devices, personal care, fitness and services, the median Meta cost per purchase was $59.44. The middle half ran from $41.45 to $131.83, the widest spread of any vertical (MHI Media, Oct 2026).",
          "Search clicks for 'red light therapy' are cheaper, about $1.90 estimated in the US (KWS Trends), but they're research-heavy and convert slowly.",
        ],
      },
      {
        h2: "Claims that keep you safe",
        paras: [
          "Keep health claims inside what your device is cleared or licensed for: FDA clearance in the US, a Health Canada medical device licence in Canada. Wellness language like 'part of your recovery routine' is fine. 'Heals injuries' needs the clearance to back it.",
        ],
      },
      {
        h2: "Why recovery hubs fit",
        paras: [
          "Placements sit on the pages recovery customers use: after they book or buy, in their member dashboard, and on hub and service pages. For a dedicated package, start with the $1,900 Starter placement or ask about a larger block on the insertion order.",
          BIRCH_FIT,
          BIRCH_RULES,
        ],
      },
    ],
    sources: [SRC.adlibRlt, SRC.mhiHw, SRC.kwsRlt],
  },
  {
    slug: "post-purchase-ads-health-brands",
    title: "Post-purchase ads for health and wellness brands | Birch Reserve",
    h1: "Post-purchase ads for health and wellness brands",
    description:
      "How post-purchase and thank-you page placements work for health brands, what published case studies show, and how Birch Reserve places brand offers in recovery and wellness hubs.",
    lede:
      "The moment after someone pays is the highest-intent screen on the web. They've just decided to spend on their health, and they're paying attention. Post-purchase ads put a relevant offer there.",
    sections: [
      {
        h2: "What published case studies say",
        bullets: [
          "Exhale Coffee reported about 25% lower upfront acquisition cost than Meta from Rokt's checkout and thank-you page ads (Aftersell / Rokt case study).",
          "BetterHelp reported cost per acquisition below target on Rokt's transaction-moment ads (Rokt case study).",
          "These are vendor-published case studies, chosen by the vendor. Treat them as signals, not benchmarks.",
        ],
      },
      {
        h2: "How Birch post-purchase placements work",
        paras: [
          "Birch places brand offers on the thank-you and confirmation pages of co-branded Scale Health Network hubs. Those hubs serve recovery, physio and wellness customers. The same credit can also run on member dashboards, hub home pages and product and service pages.",
          BIRCH_FIT,
          BIRCH_RULES,
        ],
      },
      {
        h2: "Who it suits",
        bullets: [
          "Companion nutrition, protein and electrolytes.",
          "Recovery devices, compression and percussion.",
          "Sleep products, orthotics and footwear.",
          "Hearing, lab testing and midlife health services that advertise compliantly.",
        ],
      },
    ],
    sources: [SRC.aftersell, SRC.rokt],
  },
  {
    slug: "health-wellness-retail-media-canada",
    title: "Health and wellness retail media in Canada: options for brands | Birch Reserve",
    h1: "Health and wellness retail media in Canada",
    description:
      "The retail media options open to health and wellness brands in Canada, from pharmacy loyalty networks to curated clinic and recovery hubs, and how to pick one.",
    lede:
      "Retail media in Canada used to mean the grocery and pharmacy giants. They're still the biggest option, but brands that sell to active, health-focused adults have another choice: placements inside the hubs where those customers book and buy care.",
    sections: [
      {
        h2: "The big networks",
        paras: [
          "Loblaw Advance runs retail media across Loblaw, Shoppers Drug Mart and PC Optimum, and works with Criteo as a sales agent for some placements. It suits brands sold at those retailers that want loyalty-linked audiences at national scale.",
        ],
      },
      {
        h2: "Curated health hubs",
        paras: [
          "Birch Reserve is smaller and narrower by design: curated placements on recovery, physio and wellness hubs, whether or not you're sold at a pharmacy.",
          BIRCH_FIT,
          BIRCH_RULES,
        ],
      },
      {
        h2: "How to choose",
        bullets: [
          "Sold in pharmacy and need national reach: start with the pharmacy networks.",
          "DTC brand selling to active adults managing pain, injury or ageing well: test a curated hub.",
          "Either way, make sure your claims match your product licence (Health Canada) before anything runs.",
        ],
      },
    ],
    sources: [SRC.loblaw, SRC.hcNhp, SRC.hcRx],
  },
];

export const CLASSIC_GUIDES: readonly AdvertiserGuide[] = [...ADVERTISER_GUIDES];
ADVERTISER_GUIDES.push(...BUYER_PAGES);

export const GUIDE_PATHS = ADVERTISER_GUIDES.map((g) => `/${g.slug}`);
