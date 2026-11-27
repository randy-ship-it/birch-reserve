/**
 * Buyer-answer and category pages (Randy, Nov 22 2026 5:31 PM ET: Granola AEO playbook, "take initiative and get
 * people buying ads", ditto Scale). Same server-rendered guide shell as lib/advertiserGuides.ts, answer-first.
 *
 * Playbook mapping: start with buyer decisions (each page = one question a brand asks before buying display);
 * OWN (what it is, who sees it), CLAIM (specific, supportable: the reserve terms), CONTEST (honest trade-offs vs
 * other channels). FAQ blocks carry FAQPage schema. Every third-party number is cited and already on the site.
 *
 * Copy rules: no guarantees, never say a hub is open, no zero counts, no ownership talk, no client names,
 * network figures only as "modelled estimates from listed partners", Scale never gig / on-demand, no promo codes.
 */
import { AI_NETWORK_LINE } from "./aiDiscovery";
import { EXCLUSIVE_RESERVE } from "./exclusiveReserveTerms";
import type { AdvertiserGuide } from "./advertiserGuides";

const SRC = {
  hcNhp: { label: "Health Canada: Illegal marketing of natural and non-prescription health products", url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/marketing-drugs-devices/illegal-marketing/health-providers/natural-non-prescription.html" },
  hcPreclear: { label: "Health Canada: Health Canada and advertising preclearance agencies' roles", url: "https://www.canada.ca/en/health-canada/services/drugs-health-products/regulatory-requirements-advertising/policies-guidance-documents/advertising-preclearance-agencies-health-product.html" },
  hcC01044: { label: "Food and Drug Regulations, section C.01.044", url: "https://laws-lois.justice.gc.ca/eng/regulations/c.r.c.,_c._870/section-c.01.044.html" },
  googleHealth: { label: "Google Ads Help: Healthcare and medicines policy", url: "https://support.google.com/adspolicy/answer/176031?hl=en" },
  metaRx: { label: "Meta Transparency Center: Drugs and pharmaceuticals ad standard", url: "https://transparency.meta.com/en-us/policies/ad-standards/restricted-goods-services/drugs-pharmaceuticals/" },
  mhiSupp: { label: "MHI Media: Meta ads benchmarks for supplement brands 2026 (9 DTC brands)", url: "https://mhigrowthengine.com/blog/meta-ads-supplements-benchmarks-2026/" },
  mhiHw: { label: "MHI Media: Meta ads benchmarks for health and wellness brands 2026 (17 DTC brands)", url: "https://mhigrowthengine.com/blog/meta-ads-health-wellness-benchmarks-2026/" },
  loblaw: { label: "Loblaw: Criteo and Loblaw Advance partner on retail media", url: "https://www.loblaw.ca/en/criteo-and-loblaw-advance-partner-to-expand-advertiser-access-to-premium-retail-media-network/" },
  rokt: { label: "Rokt case study: BetterHelp on Rokt Ads", url: "https://www.rokt.com/case-studies/how-betterhelp-scales-their-online-therapy-platform-and-acquires-new-users-with-rokt" },
  googleReview: { label: "Google Ads Help: About the ad review process", url: "https://support.google.com/google-ads/answer/9208915" },
} as const;

const R = EXCLUSIVE_RESERVE;
/** The $1,900 starter placement, in the terms' own words (lib/exclusiveReserveTerms.ts). */
const RESERVE_ANSWER = `Dedicated placements from $1,900, paid by card (CAD in Canada, USD elsewhere). A starter placement holds one ${R.packageRange} dedicated package in your category pending your insertion order, and all $1,900 counts toward that package. You are refunded in full if you are bumped by another advertiser before you have finalized payment. Nothing runs until you sign an insertion order naming the clinic layer, placement and dates. Refundable until 14 days before the IO launch date, and refunded in full if your category is committed to another brand before your IO is signed.`;
const NETWORK_ANSWER = `${AI_NETWORK_LINE}. Audience volumes on a specific clinic layer are modelled until an insertion order names it. No impression guarantee; reporting is aggregate only.`;
const PRIVACY_ANSWER = "No. Placements are chosen by clinic layer and category, never by anyone's health data. You get aggregate views, clicks, UTM visits and promo redemptions per clinic layer and surface. Nobody's identity or condition is shared.";

const SHARED_FAQ = [
  { q: "What does it cost to start?", a: RESERVE_ANSWER },
  { q: "How many people will see my ad?", a: NETWORK_ANSWER },
  { q: "Can I target people by health condition?", a: PRIVACY_ANSWER },
];

const PLACEMENT_TILES = [
  { k: "Where", v: "Booking confirmations, member dashboards, clinic layer home and product pages" },
  { k: "Who", v: "Recovery, physio and wellness customers, mostly Ontario and Quebec plus the US" },
  { k: "How", v: "A dedicated package, set on an insertion order" },
];

export const BUYER_ANSWERS: AdvertiserGuide[] = [
  {
    slug: "advertise-to-recovery-patients-canada",
    group: "answer",
    title: "How to advertise to recovery, physio and wellness patients in Canada | Birch Reserve",
    h1: "How to advertise to recovery, physio and wellness patients in Canada",
    description: "Where to reach physio, recovery and wellness customers in Canada, the claim rules that apply, and how dedicated placements work in Scale Health Network clinic layers.",
    lede: "Show up on the pages those customers already use, keep claims inside your product licence, and buy by insertion order.",
    answer: "Reach them inside the clinic layers where they book and buy care: booking confirmations, member dashboards and product pages. Birch Reserve sells dedicated placements there, starting from $1,900, which counts in full toward your package.",
    tiles: PLACEMENT_TILES,
    sections: [
      { h2: "Where these customers already are", bullets: ["Right after they book a physio or recovery visit.", "In their member dashboard between sessions.", "On clinic layer product and service pages.", "On the thank-you screen after an order."] },
      { h2: "Rules that apply in Canada", bullets: ["Claims must match your product licence or label (Health Canada's Terms of Market Authorization).", "Consumer ads for a prescription drug may only state name, price and quantity. Birch does not run prescription-drug promotion.", "Health Canada encourages independent preclearance before ads run."] },
    ],
    compare: {
      caption: "Three ways to reach recovery and physio customers",
      head: ["Channel", "Good for", "Trade-off"],
      rows: [
        ["Paid social and search", "Reach and fast tests", "You pay to find the audience in a crowded auction"],
        ["Clinic waiting-room screens", "In-clinic awareness", "Only while they wait; measurement varies by vendor"],
        ["Clinic layer display (Birch Reserve)", "Customers already acting on a recovery plan", "Smaller than social; sold by category, not by the click"],
      ],
    },
    faq: [
      { q: "Is it compliant to advertise supplements or devices to physio patients?", a: "Yes, when your claims stay inside your product licence or device licence and follow the platform and Health Canada rules that already apply to you. Health Canada encourages preclearance. Nothing here is legal advice." },
      ...SHARED_FAQ,
    ],
    sources: [SRC.hcNhp, SRC.hcC01044, SRC.hcPreclear],
  },
  {
    slug: "clinic-waiting-room-advertising",
    group: "answer",
    title: "Clinic waiting room and clinic layer display advertising for health brands | Birch Reserve",
    h1: "Clinic waiting-room advertising vs clinic layer display",
    description: "How clinic waiting-room screens compare with clinic layer display on clinic and recovery brands' own pages, and how health brands buy dedicated clinic layer placements by category.",
    lede: "Waiting-room screens reach people for a few minutes in the clinic. Clinic layer display reaches the same customers on their phone, before and after the visit.",
    answer: "Clinic layer display puts your brand on the clinic or recovery brand's own booking, dashboard and thank-you pages. Birch Reserve sells it by category, on a dedicated package, starting from $1,900.",
    tiles: PLACEMENT_TILES,
    mock: true,
    sections: [
      { h2: "What can run", bullets: ["Clinic layer banner: top of the member dashboard.", "Product page unit: a sponsored card in the clinic layer's shop grid.", "Native tile row: next to the clinic layer's recovery tools.", "Thank-you card: right after a booking or order."] },
    ],
    compare: {
      caption: "Waiting room vs clinic layer display",
      head: ["", "Waiting-room screens", "Clinic layer display (Birch Reserve)"],
      rows: [
        ["Where", "TV screens or posters in the clinic", "Clinic layer booking, dashboard, product and thank-you pages"],
        ["When", "While the patient waits", "Before and after the visit, on their phone"],
        ["Measurement", "Varies by vendor", "Aggregate views, clicks, UTM visits, promo redemptions"],
        ["Dedicated package", "Varies by vendor", "A dedicated package, set on the IO"],
        ["How you buy", "Vendor contract", "$1,900 starter placement, then an insertion order"],
      ],
    },
    faq: [
      { q: "Do I need a screen or hardware in the clinic?", a: "No. Clinic layer display runs on the clinic layer's own web pages. You send a square image, a headline and a link; creatives get a quick human review before they run." },
      ...SHARED_FAQ,
    ],
    sources: [SRC.hcNhp, SRC.hcPreclear],
  },
  {
    slug: "meta-ads-alternatives-health-brands",
    group: "answer",
    title: "Alternatives to Meta ads for health and wellness brands (2026) | Birch Reserve",
    h1: "Alternatives to Meta ads for health and wellness brands",
    description: "The main alternatives to Meta ads for supplement, recovery and wellness brands: search, retail media, post-purchase networks, creators and curated clinic layer display, with honest trade-offs.",
    lede: "If Meta's cost per first order is eating your margin, here are the alternatives and what each trades away.",
    answer: "The main alternatives are Google search, retail media networks, post-purchase ad networks, creator and affiliate programs, and curated clinic layer display. Birch Reserve is the curated-hub option: dedicated placements inside recovery, physio and wellness clinic layers, sold by category.",
    sections: [
      { h2: "Why brands look for an alternative", paras: ["Across 9 DTC supplement brands, the median Meta cost per first purchase was $80.50 against a $68.68 average order, so the first order loses money (MHI Media, Oct 2026, USD, one agency's client sample). Health and prescription categories also face extra policy gates on Meta and Google."] },
    ],
    compare: {
      caption: "Alternatives to Meta, side by side",
      head: ["Option", "Best for", "Trade-off"],
      rows: [
        ["Google search", "Capturing people already searching", "Healthcare policy gates; review and verification can take days"],
        ["Retail media (e.g. pharmacy and grocery networks)", "Brands sold at those retailers", "Built for national retail scale, not DTC"],
        ["Post-purchase networks", "Offers at the moment after checkout", "Runs on other brands' checkouts, not in a health context"],
        ["Creators and affiliates", "Trust and content", "Slow to scale; claim control is harder"],
        ["Clinic layer display (Birch Reserve)", "Recovery, physio and wellness customers mid-plan", "Smaller than Meta; choose it for context, not reach"],
      ],
    },
    faq: [
      { q: "Should I stop Meta ads?", a: "Not necessarily. Most brands add a curated channel as its own line item next to Meta and compare cost per order with UTM links and promo codes." },
      ...SHARED_FAQ,
    ],
    related: [{ label: "Speed versus Google Ads", href: "/vs-google-ads" }],
    sources: [SRC.mhiSupp, SRC.mhiHw, SRC.metaRx, SRC.googleHealth, SRC.googleReview, SRC.loblaw, SRC.rokt],
  },
];

type Cat = { key: string; name: string; status: "now" | "queued"; who: string; fits: string[]; exclusiveCategory?: string };
/** Scale Health categories (Recovery first; the rest queued). No reach numbers per category. */
export const AD_CATEGORIES: Cat[] = [
  { key: "recovery", name: "Recovery", status: "now", who: "Physio, mobility and recovery customers working through pain, injury or training load.", fits: ["Topicals and pain relief (non-prescription)", "Recovery hardware: rollers, percussion, compression", "Braces, orthotics and footwear", "Electrolytes and sports nutrition"] },
  { key: "longevity", name: "Longevity", status: "queued", who: "Members on longevity, hormone and rehab programs.", fits: ["Biomarker and lab testing", "Healthy-ageing supplements", "Strength and mobility programs", "Wearables"] },
  { key: "sleep", name: "Sleep", status: "queued", who: "Recovery and longevity members for whom sleep is part of the plan.", fits: ["Mattresses and pillows", "Sleep wearables", "Non-prescription sleep support", "Cooling and recovery bedding"], exclusiveCategory: "Sleep" },
  { key: "food-nutrition", name: "Food & Nutrition", status: "queued", who: "Members who plan what they eat around training and recovery.", fits: ["Protein, creatine and collagen", "Meal prep and delivery", "Functional food and drinks", "Hydration"], exclusiveCategory: "Nutrition" },
  { key: "medi-spa", name: "Medi/Spa", status: "queued", who: "Members who book aesthetic, massage and spa services.", fits: ["Skincare and personal care", "Recovery and spa devices", "Massage and wellness services", "At-home care kits"] },
  { key: "pet-wellness", name: "Pets", status: "queued", who: "Members who care for their pets' mobility and recovery as much as their own.", fits: ["Joint and mobility support for pets", "Pet nutrition", "Orthopedic beds", "Pet wellness services"] },
];

export const categorySlug = (key: string) => `advertise-${key}-brands`;

export const CATEGORY_PAGES: AdvertiserGuide[] = AD_CATEGORIES.map((c) => ({
  slug: categorySlug(c.key),
  group: "category",
  status: c.status === "now" ? "Reserving now" : "Queued · reserve ahead",
  exclusiveCategory: c.exclusiveCategory,
  title: `${c.name} brand advertising in Scale Health Network clinic layers | Birch Reserve`,
  h1: `Advertise your ${c.name.toLowerCase()} brand in Scale Health Network clinic layers`,
  description: `Dedicated placements for ${c.name.toLowerCase()} brands inside Scale Health Network clinic layers: who sees it, what fits, and how the $1,900 starter placement works.`,
  lede: c.who,
  answer: `${c.status === "now" ? `${c.name} is the first Scale Health category in market.` : `${c.name} is queued after Recovery.`} One brand gets the dedicated package for the category. Start with $1,900, counted in full toward a ${R.packageRange} package; the package rate is set on the IO, at or below the rate card.`,
  tiles: [{ k: "Who", v: c.who }, { k: "Fits", v: c.fits.slice(0, 2).join(" · ") }, { k: "Status", v: c.status === "now" ? "Reserving now" : "Queued: reserve ahead" }],
  sections: [
    { h2: "Brands that fit", bullets: c.fits },
    { h2: "All Scale Health categories", bullets: AD_CATEGORIES.map((x) => `${x.name}: ${x.status === "now" ? "reserving now" : "queued"}`) },
  ],
  faq: [
    { q: `What does a dedicated placement mean for ${c.name}?`, a: "A dedicated package. That starts when you sign the insertion order, which names the clinic layer, placement and dates. The $1,900 is refunded in full if you are bumped by another advertiser before you have finalized payment." },
    ...SHARED_FAQ,
  ],
  sources: [SRC.hcNhp, SRC.hcPreclear],
}));

export const BUYER_PAGES: AdvertiserGuide[] = [...BUYER_ANSWERS, ...CATEGORY_PAGES];
