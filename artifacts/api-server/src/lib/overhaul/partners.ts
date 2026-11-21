/**
 * Partnerships (Randy, voice, Nov 21 2026 4:51 PM ET). One source of truth for the home teaser, /partners, the intake form
 * and the admin filter. Three tracks. Rules: no numbers, no forecasts or guarantees, no client names, no wholesale prices
 * or margins stated ("wholesale terms discussed directly"). Nothing is promised or charged from the form.
 */
export const PARTNERS_HREF = "/partners";
export const PARTNERS_URL = "https://birchreserve.net/partners";
export const PARTNERS_KIND = "partner_inquiry" as const;

export const PARTNER_GROUPS = [
  {
    key: "vendor",
    eyebrow: "A · Service vendors",
    title: "Partner with us as a service vendor.",
    sub: "We only sell our own proprietary ads, so we do not compete with traditional agencies today. We want partners for the work a full-service agency normally does.",
    pitch: "We pave new display real estate. We can create deals and relationships with agencies that others can't.",
  },
  {
    key: "inventory",
    eyebrow: "B · Inventory and reach partners",
    title: "Use our display inventory for your customers.",
    sub: "Agencies, media houses, newspapers and anyone with inventory and customers: offer our display inventory to your customers and still earn your margins.",
    pitch: "Wholesale terms discussed directly.",
  },
] as const;

export const PARTNER_TRACKS = [
  { key: "adbuying", group: "vendor", name: "Ad-buying and media experts", tag: "Service vendor", short: "Help our customers buy and run ads well.", detail: "We supply the inventory where the demand actually is. Media buyers and consultants can work with our customers on planning, setup and optimization." },
  { key: "creative", group: "vendor", name: "Creative", tag: "Service vendor", short: "Make the ads and landing pages our customers run.", detail: "Designers, copywriters and video producers who can turn a customer's offer into placements that fit our formats." },
  { key: "flyer", group: "vendor", name: "Flyer and distribution partners", tag: "Service vendor", short: "Extend reach alongside our street team.", detail: "We run an in-person, hand-to-hand street team. Distributors who cover neighbourhoods, events or routes can partner with us on part of it and extend the reach." },
  { key: "othervendor", group: "vendor", name: "Other services", tag: "Service vendor", short: "Anything else a full-service agency would do.", detail: "Strategy, analytics, PR, web, email or something we have not listed. Tell us what you do well." },
  { key: "media", group: "inventory", name: "Inventory and reach partners", tag: "Reseller", short: "Agencies, media houses and newspapers: resell our display inventory and keep your margin.", detail: "Offer our curated display inventory to your existing customers through wholesale inventory deals. It adds value and reach for them and extends the inventory you can offer. Wholesale terms discussed directly." },
] as const;
export type PartnerTrackKey = (typeof PARTNER_TRACKS)[number]["key"];
export const PARTNER_TRACK_KEYS: readonly string[] = PARTNER_TRACKS.map((t) => t.key);
export const partnerTrackName = (k: string | undefined | null): string => PARTNER_TRACKS.find((t) => t.key === k)?.name ?? "";

/** Curated demand audiences by health and wellness category (inventoryPlan: Recovery live, the rest queued). */
export const PARTNER_CATEGORIES = [
  { name: "Recovery", live: true },
  { name: "Longevity", live: false },
  { name: "Sleep", live: false },
  { name: "Food & Nutrition", live: false },
  { name: "Medi/Spa", live: false },
  { name: "Pets", live: false },
] as const;

export const PARTNERS = {
  eyebrow: "Partnerships",
  title: "Partner with Birch Reserve.",
  sub: "We pave new display real estate. Two ways to work with us.",
  terms: "Wholesale terms discussed directly. Nothing is charged or promised from the form.",
  cta: "Tell us about your business",
  teaserTitle: "Partner with us",
  teaserSub: "Service vendors, and agencies, media houses and newspapers with inventory and customers.",
} as const;

/** Server-side limits for the partner form (also enforced in the browser). */
export const PARTNER_LIMITS = { name: 120, company: 160, email: 320, phone: 40, website: 300, region: 200, reach: 200, notes: 1500 } as const;

/** Accepts a track key or its display name (the form's chips send the name); returns the key or "". */
export function partnerTrackKey(v: string | undefined | null): string {
  const t = (v ?? "").trim();
  if (PARTNER_TRACK_KEYS.includes(t)) return t;
  return PARTNER_TRACKS.find((x) => x.name === t)?.key ?? "";
}
