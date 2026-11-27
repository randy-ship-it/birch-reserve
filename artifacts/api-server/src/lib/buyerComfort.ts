/**
 * Buyer-comfort additions (Randy, Nov 17 2026 ET): one source for the copy shared by
 * /buycalc (server HTML) and /media-kit (React). Pure module, no Node imports.
 *
 * Rules this copy keeps:
 * - Every number comes from existing terms: $190 / $490 USD, 7 days, 14 days before the
 *   IO launch date, 60 days from payment, 12 months, 6-month spend-down, $8–$12 CPM band,
 *   $25,000–$1.5M USD premium.
 * - Seats are shared, not exclusive. No seat, booked, availability or hub counts.
 * - Nothing runs during the 7-day look. No payment-to-IO turnaround time.
 * - The sample report uses placeholders only.
 */
import { scaleVoiceDeep } from "./scaleVoice";

export type BuyerLink = { label: string; href: string };

export const SAMPLE_IO_HREF = "/sample-io";
export const SAMPLE_REPORT_HREF = "/media-kit#sample-report";
export const CREATIVE_BRIEF_HREF = "/insights/what-you-send-for-a-seat";
export const SEE_THE_UNIT_IMAGE = "/hub-proof/see-the-unit-mock.jpg";
export const LIVE_HUB_LINKS: BuyerLink[] = [
  { label: "DR-HO'S physio hub", href: "https://physio.drhonow.com" },
  { label: "SOLE hub", href: "https://www.scalehealth.ca/sole" },
];

/** 6. Curated network strap (sits under the existing "Curated placements" strip). */
export const EARLY_SLOTS = {
  label: "Curated network",
  line: "We're curating the network hub by hub. Brands take shared category seats as each hub launches, at starter rates. Every seat is shared by more than one brand.",
} as const;

/**
 * Dual sales motion (Randy, Nov 17 2026 8:56 PM ET): self-serve plus phone / premium closes.
 * The 647 line is a phone assistant that books a call back, so copy says "request a call back",
 * never "the sales team walks you through" on the call.
 */
export const SALES_EMAIL = "randy@scalehealth.ca";
export const REQUEST_HREF = "/buycalc#request";
export const REPLY_LINE = "We reply within 1 business day.";

export const DUAL_MOTION = {
  /** A1: /buycalc subhead under the H1. */
  heroSub: "Start yourself with a $190 USD look or $490 USD category placement. Or ask about a larger display share, priority placement, or a program across more than one hub.",
  /** A2: secondary inquire link under the self-serve buttons. */
  inquireLabel: "Ask about a premium slot or multi-hub program",
  callBack: "to request a call back",
  /** B1: one line under the offer cards. */
  sampleIoLead: "Before you pay: read the",
  sampleIoLabel: "sample insertion order",
  sampleIoTail: "you'd approve before anything runs.",
  /** A3: /media-kit, under the tier cards. */
  programsTitle: "Larger or multi-hub programs start with a call.",
  programsBody: "We'll walk through display share, priority placement and the sample insertion order, and the scope is set on your IO.",
  /** A4 (merged with the early-slots strap on /buycalc; short form under A3 on /media-kit). */
  sharedBuycalc: "Self-serve seats stay shared, open to more than one brand, while the network is curated hub by hub. Premium slots add a larger share.",
  sharedKit: "Self-serve seats stay shared by more than one brand while the network is curated hub by hub. Larger shares are a premium slot only.",
  /** B3: added to the live hub proof line on /buycalc. */
  liveHubLead: "Ready to bid, or have a question?",
} as const;

/** 1. How a test dollar becomes a flight. */
export const FLIGHT_TIMELINE = {
  kicker: "From card to flight",
  title: "How a test dollar becomes a flight.",
  steps: [
    { n: "1", t: "Pay credit", d: "Pay $190 USD for a 7-day look or $490 USD to reserve, by card on Stripe. Every dollar is media credit. Nothing runs yet." },
    { n: "2", t: "The IO names the hub and surface", d: "We send an insertion order naming the hub, surface, format, category and dates. Nothing runs until you approve it." },
    { n: "3", t: "Your card runs where members act", d: "After you approve the IO, your card shows on the surface it names: the hub home, a product, service or booking page, or the member dashboard. Credit spends down on live hubs over the 6 months after it lands and stays usable for 12 months." },
  ],
  refundTitle: "Three ways your money comes back",
  refunds: [
    { k: "Day 7 · the look", d: "Move to the $490 USD category placement within 7 days and all $190 USD carries over. Otherwise it is refunded." },
    { k: "Day 60 · no hub named", d: "If no approved surface is named within 60 days of your payment, you get a cash refund." },
    { k: "14 days before launch", d: "The $490 USD category placement is fully refundable until 14 days before the launch date on your IO. After that it stays credit, usable for 12 months." },
  ],
} as const;

/** 2. See the unit before you lock (the $190 USD 7-day look). */
const SEE_THE_UNIT_BASE = {
  kicker: "The 7-day look",
  title: "See the unit before you lock.",
  body: "Your $190 USD look gives you 7 days to see where your card would sit before you decide. During those 7 days, Birch sends you a custom mock of your card on a hub surface. It is a preview: nothing runs on a live hub during the look.",
  getTitle: "What you get during the 7 days",
  gets: [
    "A custom mock of your card on the hub surface, made by Birch from your square still. Illustrative, not a live ad.",
    "The live hubs, open to anyone right now.",
    "The creative brief and the sample insertion order, so you know what the next step asks for.",
    "Questions by email: randy@scalehealth.ca.",
  ],
  decide: "Then decide: move to the $490 USD category placement within 7 days and all $190 USD carries over, otherwise it is refunded. The look does not lock a category; seats are shared by more than one brand.",
  imageAlt: "Illustrative mock: an example brand card drawn beside the recovery path on the live DR-HO'S hub dashboard",
  caption: "Example of the mock Birch sends: an illustrative card drawn on a live hub page (DR-HO'S recovery path). Not a live ad and not a Birch result. Your IO names the hub and surface.",
} as const;
export const SEE_THE_UNIT = scaleVoiceDeep(SEE_THE_UNIT_BASE);

/** 3. Questions buyers ask. Answers match /terms. B2 (Nov 17 8:56 PM ET) added the three dual-motion questions. */
export const BUYER_FAQ_TITLE = "Questions buyers ask.";
export const BUYER_FAQ: Array<{ q: string; a: string; link?: BuyerLink; tail?: string }> = [
  {
    q: "Can I start with a small test and grow?",
    a: "Yes. The $190 USD look and the $490 USD category placement are media credit, paid by card. A larger display share, priority placement or a program across more than one hub is a conversation:",
    link: { label: "ask about a premium slot", href: "/buycalc#request" },
  },
  {
    q: "What happens after I pay?",
    a: "Your payment is media credit. An insertion order names the hub and surface before anything runs. The $490 USD category placement is fully refundable until 14 days before the launch date on your IO. The $190 USD look converts in full to the category placement within 7 days, otherwise it's refunded.",
  },
  {
    q: "Is my category mine alone, or shared?",
    a: "Shared. The $490 USD category placement is a shared category seat, open to more than one brand in the same category. It does not lock your category, and neither does the $190 USD look. Dedicated placements start with the $1,900 Starter placement, which holds a $5,000 to $50,000 package in your currency pending your IO, or a premium slot ($25,000 to $1.5M USD, inquire only). Both are set on an insertion order.",
  },
  {
    q: "How do larger or priority placements work?",
    a: "Premium slots are inquire only, never a card purchase. Send a request and we reply by email with an insertion order that sets the term, display share and placement.",
    link: { label: "Ask about a premium slot", href: "/buycalc#request" },
  },
  {
    q: "What if we can't name a hub?",
    a: "You don't need to. We name it. Your insertion order names the hub and surface before anything runs, and you approve it. If no approved surface is named within 60 days of your payment, you get a cash refund.",
  },
  {
    q: "What does aggregate reporting look like?",
    a: "Totals per hub and per surface: views, clicks, UTM-tagged visits and promo-code redemptions. Never who saw your card. No user-level rows, no health data and no clinical pixels.",
    link: { label: "See a sample report layout", href: SAMPLE_REPORT_HREF },
  },
  {
    q: "How are the modelled view numbers derived?",
    a: "Media credit ÷ CPM × 1,000. The CPM is the starting-at rate shown for that surface, or the ~$8–$12 USD band in the media kit. These are planning estimates, not measured delivery and not a guarantee. Your insertion order sizes views against live hub supply and sets the final rate.",
  },
  {
    q: "What creative do I need to send?",
    a: "A square still of the product, one destination URL with your UTMs, your category, and a contact who can approve the insertion order. Optional: a silent 15-second motion cut and a promo code.",
    link: { label: "Read the full creative brief", href: CREATIVE_BRIEF_HREF },
  },
];

/** 4. Sample report layout. Placeholders only, never numbers that could read as a result. */
const SAMPLE_REPORT_BASE = {
  kicker: "Measurement",
  title: "What your report looks like.",
  body: "Aggregate totals per hub and per surface, week by week. No names, no user-level rows, no health data.",
  columns: ["Week", "Hub", "Surface", "Views", "Clicks", "UTM visits", "Promo redemptions"],
  rows: [
    ["Week 1", "[Hub on your IO]", "Hub Home", "x,xxx", "xx", "xx", "x"],
    ["Week 1", "[Hub on your IO]", "Member Dashboard", "x,xxx", "xx", "xx", "x"],
    ["Week 2", "[Hub on your IO]", "Product / Services", "x,xxx", "xx", "xx", "x"],
  ],
  total: ["Total", "", "", "x,xxx", "xx", "xx", "x"],
  caption: "Sample layout with placeholder values. Illustrative only: not a Birch result and not a forecast. Campaign figures come from your UTMs and promo codes.",
} as const;
export const SAMPLE_REPORT = scaleVoiceDeep(SAMPLE_REPORT_BASE);

/** 5. Sample IO links on the buy path. */
export const SAMPLE_IO_LINKS = {
  factLead: "See exactly what you'd sign:",
  factLabel: "sample insertion order",
  checkoutLead: "Before anything runs, you approve an insertion order like this",
  checkoutLabel: "sample",
  kitLabel: "See a sample IO",
} as const;

/** 7. One modelling sentence next to view and rate numbers. */
export const MODELLING_NOTE =
  "Modelled: views = media credit ÷ CPM × 1,000 at the starting-at rate shown. An estimate, not measured delivery and not a guarantee; your insertion order sets the final rate.";
