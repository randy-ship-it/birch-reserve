/**
 * Hero path picks (Randy, Nov 18 2026 10:13 PM ET: "pick out of this what you think helps").
 * Pure copy + config, no Node imports. Reuses existing terms word for word (buyerComfort.ts, reserveOffers.ts).
 *
 * Rules kept: no reach numbers on category cards (none at all), no click-rate or return promises, seats are
 * shared, no turnaround promise, no outside platform price medians, no area-lock radius/share claims.
 */
import { FLIGHT_TIMELINE, SEE_THE_UNIT, LIVE_HUB_LINKS, SAMPLE_IO_HREF, SAMPLE_REPORT_HREF } from "../buyerComfort";
import { PUBLIC_RESERVE_OFFERS } from "../reserveOffers";

const LOOK = PUBLIC_RESERVE_OFFERS.find((o) => o.sku === "hold-190")!;

export const PILOT_HERO = {
  kicker: "Near-zero-risk pilot",
  title: "Start with the $190 USD 7-day look.",
  sub: "See a mock of your card on a live hub surface.",
  /** Existing terms, word for word. */
  lookTerms: LOOK.scope,
  decide: SEE_THE_UNIT.decide,
  refunds: FLIGHT_TIMELINE.refunds,
  lookHref: "/buycalc?sku=hold-190",
  kitHref: "/brand-kit#my-kit",
  liveHubs: LIVE_HUB_LINKS,
} as const;

/** Annotated real hub surfaces (both hubs are public; screenshots already ship on the site). */
export const HUB_SURFACE_SHOTS = [
  {
    key: "drho",
    hub: "DR-HO'S physio hub",
    src: "/hub-gallery/drho.webp",
    alt: "DR-HO'S physio hub home page with numbered example placements drawn on top",
    notes: [
      { n: 1, x: 4.5, y: 36, w: 91, h: 11, label: "Hub banner", d: "Where the browse strip sits, top of the dashboard." },
      { n: 2, x: 14, y: 13, w: 9, h: 5, label: "Product page unit", d: "Sponsored card in the Marketplace grid." },
      { n: 3, x: 4.5, y: 93, w: 91, h: 7, label: "Native tile row", d: "Next to the Scale recovery toolkit." },
    ],
  },
  {
    key: "sole",
    hub: "SOLE hub",
    src: "/hub-gallery/sole.webp",
    alt: "SOLE hub home page with numbered example placements drawn on top",
    notes: [
      { n: 1, x: 1, y: 13, w: 98, h: 5.5, label: "Hub banner", d: "Full-width strip under the hub header." },
      { n: 2, x: 1, y: 80, w: 44, h: 14, label: "Native tile", d: "Under the hero, next to the member's next step." },
      { n: 3, x: 62, y: 82, w: 34, h: 8, label: "Booking unit", d: "Inside the booking card, before the member books." },
    ],
  },
] as const;
export const HUB_SHOTS_FINE = "Real hub pages with example placements drawn on top. Illustrative, not live ads and not Birch results. Your IO names the hub and surface.";

export const EARLY_RATE_BADGE = "Early rate";
/** Audit #4 (Randy, Nov 20 2026): the one urgency line. Once per block, above the button, never next to numbers. */
export const URGENCY_LINE = "Early rate for pilot brands · first in each category get first-mover priority on pilot reporting.";
export const EARLY_RATE_FINE = "New placements open at starter rates. They only move up once your reporting proves they work. Seats are shared: a category can include more than one brand.";

/**
 * The 8 categories (same list as the home category seats). No reach numbers. Links point to the nearest
 * existing post: there is no category-specific Insights post yet (open question in PLAN.md).
 */
export const CATEGORY_AUDIENCES = [
  { key: "pain-relief", name: "Pain relief / topicals", who: "Members working through back, joint and muscle pain with a physio or recovery brand.", timing: "They are mid-plan and looking for what helps between sessions.", also: ["Recovery hardware", "Sleep", "Mobility"], post: { label: "After the booking: why category seats beat open-web noise", href: "/insights/after-booking-category-seats-scale-hubs" } },
  { key: "recovery-hardware", name: "Recovery hardware", who: "Active members who already buy recovery tools: rollers, massage guns, compression.", timing: "They are on a recovery brand's hub right after a purchase or booking.", also: ["Pain relief", "Sports nutrition", "Wearables"], post: { label: "Recovery device advertising guide", href: "/recovery-device-advertising" } },
  { key: "nutrition", name: "Nutrition", who: "Gym, studio and recovery members who plan what they eat around training.", timing: "Fitness goals are set and refreshed inside the hub, so food choices are in play.", also: ["Meal prep", "Supplements", "Sleep"], post: { label: "Advertising supplements in Canada", href: "/advertise-supplements-canada" } },
  { key: "sleep", name: "Sleep", who: "Recovery and longevity members for whom sleep is part of the plan.", timing: "Sleep comes up as soon as recovery does: it's the next question after pain and training.", also: ["Recovery", "Longevity", "Personal care"], post: { label: "The shelf after the receipt", href: "/insights/the-shelf-after-the-receipt" } },
  { key: "meal-prep", name: "Meal prep", who: "Busy members trying to stay on plan between workouts and appointments.", timing: "Right after a booking or order, when the routine is being set.", also: ["Nutrition", "Fitness", "Supplements"], post: { label: "Post-purchase ads for health brands", href: "/post-purchase-ads-health-brands" } },
  { key: "womens-health", name: "Women's health", who: "Members on physio, hormone, longevity and fitness plans.", timing: "They are already acting on a health plan inside a private, members-only hub.", also: ["Longevity", "Sleep", "Personal care"], post: { label: "Health and wellness retail media in Canada", href: "/health-wellness-retail-media-canada" } },
  { key: "mens-health", name: "Men's health", who: "Members on training, recovery and performance plans.", timing: "Performance and recovery goals are front of mind on the hub.", also: ["Supplements", "Fitness", "Recovery hardware"], post: { label: "Advertising supplements in Canada", href: "/advertise-supplements-canada" } },
  { key: "diagnostics", name: "Diagnostics / services", who: "Members who book providers: physio, rehab, testing and programs.", timing: "They are in booking mode, next to the time picker or confirmation.", also: ["Longevity", "Physio", "Women's and men's health"], post: { label: "What you send for a seat", href: "/insights/what-you-send-for-a-seat" } },
] as const;

export const REPORTING = {
  kicker: "Reporting",
  title: "What your report looks like.",
  metrics: ["Views", "Clicks", "UTM visits", "Promo redemptions"],
  aggregate: "Aggregate only: totals per hub and per surface. Never who saw your card.",
  commitment: "Pilot reporting commitment: first advertisers get an aggregate dashboard.",
  href: SAMPLE_REPORT_HREF,
} as const;

export const THREE_STEPS = {
  kicker: "Three steps",
  title: "Pay credit. Approve the IO. Your card runs.",
  steps: [
    { n: 1, t: "Pay credit", d: FLIGHT_TIMELINE.steps[0].d },
    { n: 2, t: "Approve the IO", d: "Hub + surface + format + dates. " + FLIGHT_TIMELINE.steps[1].d.split(". ").slice(-1)[0] },
    { n: 3, t: "The card runs", d: FLIGHT_TIMELINE.steps[2].d.split(". ")[0] + "." },
  ],
  sampleIoHref: SAMPLE_IO_HREF,
  sampleIoLabel: "Open the sample IO (print or save as PDF)",
} as const;

export const AGENT_LINE = { text: "Your AI agent can quote a seat and hand off to checkout.", href: "/ai-buyers" } as const;
