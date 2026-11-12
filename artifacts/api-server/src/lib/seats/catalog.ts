/**
 * Category seats (Randy, Nov 12 2026 2:59 PM ET): "seats sell the moment they open".
 * Pure module shared by the API and the client (relative import). No Node imports.
 *
 * Packaging is Randy's, verbatim:
 *   - $190 7-day look              -> SKU hold-190 (existing SKU language)
 *   - $490 named category seat     -> SKU reserve-490 (one brand per category, media credit)
 *   - Optional impression blocks at starter rates (pricing model, starter CPM low end)
 *
 * Rules: no unverified reach or CTR claims, no impression guarantees, aggregate
 * reporting only, estimates labelled as estimates, no unaudited large totals.
 */
import { RATE_SURFACES, type RateSurface } from "../overhaul/pricing";

export const SEATS_VERSION = "2026-11-12";

export const CONTACT = {
  phoneDisplay: "(647) 931-6278",
  tel: "tel:+16479316278",
  email: "sales@silverbirchgrowth.com",
  mailto: "mailto:sales@silverbirchgrowth.com",
} as const;

/** Same eight labels as /kit and /buycalc. One brand per category. */
export const SEAT_CATEGORIES = [
  { slug: "pain-relief", label: "Pain relief / topicals" },
  { slug: "recovery-hardware", label: "Recovery hardware" },
  { slug: "nutrition", label: "Nutrition" },
  { slug: "sleep", label: "Sleep" },
  { slug: "meal-prep", label: "Meal prep" },
  { slug: "womens-health", label: "Women\u2019s health" },
  { slug: "mens-health", label: "Men\u2019s health" },
  { slug: "diagnostics-services", label: "Diagnostics / services" },
] as const;

export type SeatCategorySlug = (typeof SEAT_CATEGORIES)[number]["slug"];
export const SEAT_TOTAL = SEAT_CATEGORIES.length;

export function categoryBySlug(slug: unknown): (typeof SEAT_CATEGORIES)[number] | undefined {
  const s = String(slug ?? "").trim().toLowerCase();
  return SEAT_CATEGORIES.find((c) => c.slug === s || c.label.toLowerCase() === s);
}

/** The two public seat SKUs. Names and terms match the existing hold-190 / reserve-490 copy. */
export const SEAT_SKUS = [
  {
    sku: "hold-190",
    action: "hold",
    name: "7-day category look",
    short: "Hold 7 days",
    usd: 190,
    cad: 270,
    line: "Hold your category for 7 days. 100% credit if you move to the $490 seat within 7 days, else refunded. Does not lock the seat.",
  },
  {
    sku: "reserve-490",
    action: "lock",
    name: "Named category seat",
    short: "Lock the seat",
    usd: 490,
    cad: 690,
    line: "One brand per category. All $490 is media credit. Fully refundable until 14 days before your launch date.",
  },
] as const;

export type SeatSku = (typeof SEAT_SKUS)[number]["sku"];
export function seatSku(sku: unknown) {
  return SEAT_SKUS.find((s) => s.sku === sku);
}

/**
 * Optional impression blocks, priced at the LOW end of each surface's starter CPM
 * (pricing model, Nov 12). Views are estimated delivery targets, never guaranteed.
 */
const BLOCK_DEFS: { key: string; surface: RateSurface["key"]; name: string; views: number }[] = [
  { key: "block-dashboard-250k", surface: "dashboard", name: "Dashboard Zone", views: 250_000 },
  { key: "block-products-100k", surface: "products", name: "Products Surface", views: 100_000 },
  { key: "block-services-100k", surface: "services", name: "Services & Booking", views: 100_000 },
  { key: "block-post-purchase-100k", surface: "post_purchase", name: "Post-Purchase", views: 100_000 },
  { key: "block-landing-250k", surface: "landing", name: "Hub Landing", views: 250_000 },
];

export type ImpressionBlock = {
  key: string;
  surface: RateSurface["key"];
  surfaceLabel: string;
  name: string;
  views: number;
  starterCpmUsd: number;
  usd: number;
  cad: number;
};

export const IMPRESSION_BLOCKS: ImpressionBlock[] = BLOCK_DEFS.map((b) => {
  const s = RATE_SURFACES.find((r) => r.key === b.surface)!;
  const usd = Math.round((b.views / 1000) * s.cpmStarter[0]);
  return { ...b, surfaceLabel: s.label, starterCpmUsd: s.cpmStarter[0], usd, cad: Math.round((usd * 1.4) / 10) * 10 };
});

export function blockByKey(key: unknown): ImpressionBlock | undefined {
  return IMPRESSION_BLOCKS.find((b) => b.key === key);
}

export const BLOCK_NOTE =
  "Estimated views at starter rates. Not an impression guarantee: delivery is planned against live hub supply and reported in aggregate. Your insertion order sets the final count and rate.";

/**
 * "Hear from the Founder". The video at silverbirchgrowth.com/founders is marked
 * "Coming soon" (checked Nov 12 2026), so we link until videoUrl is set.
 * Quote: Randy's own words, from his written birchreserve.net brief
 * (Nov 12 2026, 11:28 AM ET), trimmed with an ellipsis, nothing added.
 */
export const FOUNDER = {
  name: "Randy Gilling",
  title: "Founder, Silver Birch Growth",
  pageUrl: "https://silverbirchgrowth.com/founders",
  pageLabel: "Founder Series: the demand flywheel for health & wellness",
  videoUrl: null as string | null,
  videoStatus: "The \u201cHow the stack fits together\u201d video is coming soon.",
  quote:
    "These are customers and members of brands with pre-established trust\u2026 you\u2019re marketing within an experience and post check out.",
  quoteSource: "Randy Gilling, written brief for birchreserve.net, Nov 12 2026",
} as const;

/** Randy's network line, verbatim (Nov 12 2026). */
export const NETWORK = {
  line: "These brand hubs and the growing network of providers (already >100 retailers / clinics on the map, rolling out) are the surfaces the category seats sit on.",
  mapUrl: "https://scalehealth.ca/localdemand",
  mapLabel: "Local demand map (postal-code map of trusted places + brand vibe estimates)",
  estimateNote: "Brand vibe figures on the map are estimates.",
  clinicHubsUrl: "https://www.scalehealth.ca/clinichubs",
} as const;

export const LIVE_HUB_EXAMPLES = [
  { name: "DR-HO’S physio hub", url: "https://physio.drhonow.com/dr-ho/portal", image: "/hub-proof/drho-hub-home.png", note: "Live co-branded hub. Your card sits at the booking and the plan, in your category." },
  { name: "Roll Recovery hub", url: "https://scalehealth.ca/roll-recovery", image: "/hub-proof/roll-marketplace-grid.png", note: "Recovery hardware shoppers inside a co-branded hub product grid." },
] as const;

export const FACE_BEFORE_FLIGHT = {
  title: "See the face before the flight",
  line: "You build the square still on the creative brief and see exactly how it sits on the hub page. Nothing runs until the insertion order names the hub.",
  href: "/insights/the-face-before-the-flight",
} as const;

export const HELD_MESSAGE = "Reserved by inquiry; we'll confirm within 1 business day.";

/** schema.org JSON-LD for the seat SKUs and impression blocks (public-safe). */
export function seatsJsonLd(
  statuses: { slug: string; status: string }[] | null,
  currency: "usd" | "cad",
  site = "https://birchreserve.net",
) {
  const avail = (slug: string) => {
    const st = statuses?.find((s) => s.slug === slug)?.status;
    return st === "open" ? "https://schema.org/InStock" : st === "locked" ? "https://schema.org/SoldOut" : "https://schema.org/LimitedAvailability";
  };
  const cur = currency.toUpperCase();
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Birch Reserve category seats and impression blocks",
    description: "Endemic recovery, health and wellness ad inventory inside co-branded hubs. One brand per category. Aggregate reporting only. No impression guarantees.",
    url: `${site}/buycalc#seats`,
    itemListElement: [
      ...SEAT_CATEGORIES.map((c) => ({
        "@type": "Product",
        name: `Category seat: ${c.label}`,
        category: "Endemic recovery ad inventory",
        brand: { "@type": "Brand", name: "Birch Reserve" },
        description: `One brand per category. ${SEAT_SKUS[0].name} or ${SEAT_SKUS[1].name}, paid as media credit.`,
        offers: SEAT_SKUS.map((s) => ({
          "@type": "Offer",
          sku: s.sku,
          name: `${s.name} · ${c.label}`,
          price: String(currency === "cad" ? s.cad : s.usd),
          priceCurrency: cur,
          availability: avail(c.slug),
          url: `${site}/buycalc?sku=${s.sku}#seats`,
          seller: { "@type": "Organization", name: "Silver Birch Growth Inc." },
        })),
      })),
      ...IMPRESSION_BLOCKS.map((b) => ({
        "@type": "Product",
        name: `${b.name} · ${b.views.toLocaleString("en-US")} views (estimated)`,
        sku: b.key,
        category: "Endemic recovery ad inventory",
        description: `${b.surfaceLabel}. Starter rate $${b.starterCpmUsd} CPM USD. ${BLOCK_NOTE}`,
        offers: { "@type": "Offer", price: String(currency === "cad" ? b.cad : b.usd), priceCurrency: cur, availability: "https://schema.org/LimitedAvailability", url: `${site}/buycalc#seats` },
      })),
    ],
  };
}
