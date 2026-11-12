/**
 * Birch Reserve sponsorship + marketing kit model (PREVIEW, not live).
 *
 * Every impression figure here is MODELLED, not measured. Inputs come from the
 * public aggregate feed https://birchreserve.net/inventory/api/tam (read
 * 2026-11-12): ~128MM monthly views, 20MM+ orders being onboarded, 42 listed
 * partners, 0 signed. Per-hub rows use the partner feed row where one exists
 * (DR-HO's) and the network median partner where the hub has no feed row yet.
 * Monthly views per channel are scaled from the partner feed by the same 2.34x
 * factor the TAM feed uses to reach its 20MM+ order total.
 */

export type Currency = "usd" | "cad";

/** CAD list prices follow the existing ladder ($190→$270, $490→$690): ~1.4x, rounded to $10. */
export function toCad(usd: number): number {
  return Math.round((usd * 1.4) / 10) * 10;
}

export function money(amount: number, currency: Currency): string {
  return `$${Math.round(amount).toLocaleString("en-US")} ${currency.toUpperCase()}`;
}

export type SlotKey = "thank_you" | "member_dashboard" | "hub_hero" | "partner_email" | "partner_site";

export type Slot = {
  key: SlotKey;
  label: string;
  where: string;
  size: string;
  cpmUsd: number;
  core: boolean;
  comp: string;
};

/** Proposed CPMs (USD). Comps are cited on the kit page. */
export const SLOTS: Slot[] = [
  {
    key: "thank_you",
    label: "Thank-you (after buy or book)",
    where: "Order confirmation or booking confirmation on the hub",
    size: "656×280 splash · 360×640 vertical",
    cpmUsd: 30,
    core: true,
    comp: "Post-purchase pages pay merchants $0.25–$0.80 per order (Rokt Thanks); onsite retail display runs $7–$22 CPM.",
  },
  {
    key: "member_dashboard",
    label: "Member dashboard tile",
    where: "Logged-in member home on the hub",
    size: "Native tile 600×400",
    cpmUsd: 18,
    core: true,
    comp: "Logged-in, owned inventory; priced inside the $7–$22 onsite retail display band.",
  },
  {
    key: "hub_hero",
    label: "Hub hero banner",
    where: "Top of the hub home page",
    size: "1200×300 desktop · 640×320 phone",
    cpmUsd: 15,
    core: true,
    comp: "Health display $10–$25 CPM; retail onsite display median about $12.50.",
  },
  {
    key: "partner_email",
    label: "Partner email module",
    where: "Native module in the hub brand's own customer email",
    size: "600×200 native",
    cpmUsd: 30,
    core: false,
    comp: "Health and wellness newsletter sponsorships run $40–$100 per 1,000 sends.",
  },
  {
    key: "partner_site",
    label: "Partner site display",
    where: "Display unit on the hub brand's own website",
    size: "300×250 · 728×90",
    cpmUsd: 8,
    core: false,
    comp: "Retail media onsite display median $8.40 CPM; native display $6–$11.",
  },
];

/** Monthly modelled views per slot (100% share of voice). */
type SlotViews = Record<SlotKey, number>;

const DRHO: SlotViews = { thank_you: 45197, member_dashboard: 38648, hub_hero: 38648, partner_email: 867787, partner_site: 1807890 };
const MEDIAN_PARTNER: SlotViews = { thank_you: 24900, member_dashboard: 18583, hub_hero: 18583, partner_email: 478087, partner_site: 996014 };
const CLINIC_NETWORK: SlotViews = { thank_you: 33166, member_dashboard: 5979, hub_hero: 5979, partner_email: 154774, partner_site: 46064 };

export type Hub = {
  key: string;
  name: string;
  kind: "brand" | "clinic";
  status: string;
  url: string;
  category: string;
  basis: string;
  views: SlotViews;
};

export const HUBS: Hub[] = [
  { key: "dr-ho", name: "DR-HO’S", kind: "brand", status: "Live proof hub", url: "https://physio.drhonow.com/dr-ho/portal", category: "Pain relief", basis: "Partner feed row (DR-HO’S)", views: DRHO },
  { key: "jack-health", name: "Jack Health", kind: "brand", status: "Live hub", url: "https://scalehealth.ca/jack-health", category: "Men’s health", basis: "Network median partner (no hub feed yet)", views: MEDIAN_PARTNER },
  { key: "jill-health", name: "Jill Health", kind: "brand", status: "Live hub", url: "https://scalehealth.ca/jill-health", category: "Women’s health", basis: "Network median partner (no hub feed yet)", views: MEDIAN_PARTNER },
  { key: "bird-and-be", name: "Bird & Be", kind: "brand", status: "Launching", url: "https://scalehealth.ca/bird-and-be", category: "Women’s health (postpartum)", basis: "Network median partner (no hub feed yet)", views: MEDIAN_PARTNER },
  { key: "roll-recovery", name: "Roll Recovery", kind: "brand", status: "Launching", url: "https://scalehealth.ca/roll-recovery", category: "Recovery hardware", basis: "Network median partner (no hub feed yet)", views: MEDIAN_PARTNER },
  { key: "nutriprocan", name: "NutriProCan", kind: "brand", status: "Launching", url: "https://scalehealth.ca/nutriprocan", category: "Nutrition", basis: "Network median partner (no hub feed yet)", views: MEDIAN_PARTNER },
  { key: "sole", name: "SOLE", kind: "brand", status: "Launching", url: "https://scalehealth.ca/sole", category: "Footwear and insoles", basis: "Network median partner (no hub feed yet)", views: MEDIAN_PARTNER },
  { key: "clinic-network", name: "Clinic hub network (pooled)", kind: "clinic", status: "Onboarding", url: "https://scalehealth.ca/clinichubs", category: "Physio, mobility, gym and studio members", basis: "TAM feed provider-network row", views: CLINIC_NETWORK },
];

/** A sponsor buys one of five rotating positions (20% share of voice) at the low end of availability (75%). */
export const SHARE_OF_VOICE = 0.2;
export const AVAILABILITY = 0.75;

export function sponsorImpressions(hub: Hub, slot: Slot): number {
  return Math.round((hub.views[slot.key] * AVAILABILITY * SHARE_OF_VOICE) / 100) * 100;
}

export function slotPriceUsd(hub: Hub, slot: Slot): number {
  const raw = (sponsorImpressions(hub, slot) * slot.cpmUsd) / 1000;
  return Math.max(10, Math.round(raw / 10) * 10);
}

/** Core package = thank-you + dashboard + hero, priced on the existing $190 floor. */
export function corePackageUsd(hub: Hub): number {
  const sum = SLOTS.filter((s) => s.core).reduce((acc, s) => acc + slotPriceUsd(hub, s), 0);
  return Math.max(190, Math.round(sum / 10) * 10);
}

export type DepositTier = { key: string; label: string; usd: number; cad: number; bonusPct: number };

export const DEPOSIT_TIERS: DepositTier[] = [
  { key: "sponsor-1500", label: "Starter sponsor", usd: 1500, cad: 2100, bonusPct: 5 },
  { key: "sponsor-3000", label: "Partner sponsor", usd: 3000, cad: 4200, bonusPct: 10 },
  { key: "sponsor-6000", label: "Founding sponsor", usd: 6000, cad: 8400, bonusPct: 15 },
];

export const CUSTOM_MIN = { usd: 490, cad: 690 };
export const CUSTOM_MAX = { usd: 50000, cad: 70000 };

export const TAM_FACTS = {
  ordersLabel: "20MM+",
  ordersNote: "orders being onboarded now (modelled)",
  viewsLabel: "~128MM",
  viewsNote: "monthly views across the listed partners (modelled)",
  listedPartners: 42,
  signedPartners: 0,
  source: "https://scalehealth.ca/tam",
  readOn: "Nov 12, 2026",
};

export const SMB_LADDER = [
  { customers: 25, cashCad: 500, creditCad: 700 },
  { customers: 50, cashCad: 750, creditCad: 1050 },
  { customers: 100, cashCad: 1000, creditCad: 1500 },
];
