/**
 * Unlisted brand customer-fit pages at /for/:slug (noindex, not in nav or sitemap).
 *
 * To add the next brand:
 *  1. Add a BrandFit object to BRAND_FITS, keyed by a kebab-case slug.
 *     Include the brand site, a customer profile from their public site (plus
 *     any facts they shared), overlap with verified live hubs / pipeline /
 *     street team, 2–4 best-fit channels, and the cataloged launching brands.
 *     Optional: logoSrc, products (local photos with attribution), hubTiles,
 *     and a qualitative strength ("strong" | "good") on each overlap item.
 *     Do not invent percentages or counts.
 *  2. Deploy. The page is live at https://birchreserve.net/for/<slug>.
 *     Do not add the slug to the nav or the sitemap.
 *
 * Real data only. No invented counts. Label live vs pipeline honestly.
 * Any modelled figure must carry an Estimate tag in the page component.
 * Focus on customer exposure fit; no CPC, CPM or performance-vs-display math.
 */
export type FitStatus = "live" | "activating" | "pipeline" | "street-team";

/** Qualitative only — never a percentage or invented score. */
export type FitStrength = "strong" | "good";

export type FitLink = {
  title: string;
  href: string;
};

export type ProfilePoint = {
  label: string;
  text: string;
  /** Shown in the sources pop-out. */
  source: "public site" | "shared with Scale Health" | "Friday / Birch snapshot";
};

export type OverlapItem = {
  status: FitStatus;
  title: string;
  line: string;
  links?: FitLink[];
  strength?: FitStrength;
};

export type BestFitIcon = "purchase" | "racquet" | "clinic" | "street";

export type BestFit = {
  title: string;
  why: string;
  links?: FitLink[];
  icon?: BestFitIcon;
};

export type LaunchingBrand = {
  name: string;
  logoSrc?: string;
  href?: string;
};

export type ProductVisual = {
  src: string;
  alt: string;
  title: string;
  href?: string;
};

export type HubTile = {
  title: string;
  /** Only for verified live hubs, pipeline, etc. Omit on consumer pages. */
  status?: FitStatus;
  badge?: string;
  imageSrc: string;
  imageAlt: string;
  logoSrc?: string;
  href?: string;
  hrefTitle?: string;
};

export type BrandFit = {
  slug: string;
  name: string;
  site: FitLink;
  eyebrow: string;
  headline: string;
  lede: string;
  logoSrc?: string;
  logoAlt?: string;
  photoCredit?: string;
  photoCreditHref?: string;
  products?: ProductVisual[];
  hubTiles?: HubTile[];
  profile: ProfilePoint[];
  overlap: OverlapItem[];
  bestFits: BestFit[];
  launchingBrands: LaunchingBrand[];
  launchingNote: string;
  /** At most one plain line; no CPC/CPM math. */
  performanceOnlyLine: string;
  heroVisuals: Array<{ src: string; alt: string; caption: string; href?: string; hrefTitle?: string }>;
  sources: Array<{ label: string; text: string }>;
};

const STATUS_LABEL: Record<FitStatus, string> = {
  live: "Live",
  activating: "Activating",
  pipeline: "Pipeline",
  "street-team": "Street team",
};

const STRENGTH_LABEL: Record<FitStrength, string> = {
  strong: "Strong fit",
  good: "Good fit",
};

export function statusLabel(status: FitStatus): string {
  return STATUS_LABEL[status];
}

export function strengthLabel(strength: FitStrength): string {
  return STRENGTH_LABEL[strength];
}

/**
 * RAD Roller — first /for/:brand instance (Nov 17 2026).
 * Profile: radroller.com plus facts RAD shared with Scale Health.
 * Overlap and launching brands: Birch media kit + TAM/audience snapshot
 * (Friday-fed, read 2026-11-13). No unverified counts.
 * Product photos and logo: official radroller.com assets, served locally.
 */
const radRoller: BrandFit = {
  slug: "rad-roller",
  name: "RAD Roller",
  site: { title: "RAD Roller", href: "https://radroller.com/" },
  eyebrow: "Customer exposure fit · RAD Roller",
  headline: "Your customer, inside our hubs.",
  lede: "People who use self-myofascial release tools between physio or chiro visits, after sport, and at a desk — the same moments our live recovery hubs and Calm Joints racquet pages already serve.",
  logoSrc: "/for-brands/rad-roller/logo-white.png",
  logoAlt: "RAD",
  photoCredit: "Product photos from RAD Roller",
  photoCreditHref: "https://radroller.com/",
  products: [
    {
      src: "/for-brands/rad-roller/neuro-roller.jpg",
      alt: "RAD Neuro Roller, the split foot-recovery tool with textured and smooth halves",
      title: "Neuro Roller",
      href: "https://radroller.com/products/neuro-roller",
    },
    {
      src: "/for-brands/rad-roller/muscle-flushing-kit.jpg",
      alt: "RAD Muscle Flushing Kit: Helix and Rod used together",
      title: "Muscle Flushing Kit",
      href: "https://radroller.com/products/muscleflushingkit",
    },
    {
      src: "/for-brands/rad-roller/point-release-kit.jpg",
      alt: "RAD Point Release Kit: Block with Roller and Rounds",
      title: "Point Release Kit",
      href: "https://radroller.com/products/pointreleasekit",
    },
  ],
  hubTiles: [
    {
      title: "Integrity Fitness hub",
      status: "live",
      imageSrc: "/hub-gallery/integrity.webp",
      imageAlt: "Integrity Fitness × Scale Health members-only hub, live",
      href: "https://www.scalehealth.ca/integrity",
      hrefTitle: "Integrity Fitness hub",
    },
    {
      title: "DR-HO'S physio hub",
      status: "live",
      imageSrc: "/hub-gallery/drho.webp",
      imageAlt: "DR-HO'S physio hub, live",
      logoSrc: "/partner-logos/dr-ho.png",
      href: "https://physio.drhonow.com",
      hrefTitle: "DR-HO'S physio hub",
    },
    {
      title: "Calm Joints squash",
      badge: "Calm Joints",
      imageSrc: "/for-brands/hubs/cj-squash.webp",
      imageAlt: "Calm Joints squash page",
      logoSrc: "/for-brands/hubs/calm-joints-mark.svg",
      href: "https://calmjoints.org/squash",
      hrefTitle: "Calm Joints squash",
    },
    {
      title: "Calm Joints tennis",
      badge: "Calm Joints",
      imageSrc: "/for-brands/hubs/cj-tennis.webp",
      imageAlt: "Calm Joints tennis page",
      logoSrc: "/for-brands/hubs/calm-joints-mark.svg",
      href: "https://calmjoints.org/tennis",
      hrefTitle: "Calm Joints tennis",
    },
    {
      title: "Calm Joints pickleball",
      badge: "Calm Joints",
      imageSrc: "/for-brands/hubs/cj-pickleball.webp",
      imageAlt: "Calm Joints pickleball page",
      logoSrc: "/for-brands/hubs/calm-joints-mark.svg",
      href: "https://calmjoints.org/pickleball",
      hrefTitle: "Calm Joints pickleball",
    },
    {
      title: "Calm Joints padel",
      badge: "Calm Joints",
      imageSrc: "/for-brands/hubs/cj-padel.webp",
      imageAlt: "Calm Joints padel page",
      logoSrc: "/for-brands/hubs/calm-joints-mark.svg",
      href: "https://calmjoints.org/padel",
      hrefTitle: "Calm Joints padel",
    },
  ],
  profile: [
    {
      label: "Clinician-recommended, used at home",
      text: "RAD positions itself as a top choice for physical therapists. Product copy describes use for recovery between chiropractic or physical therapy visits, trigger-point work, and everyday tightness.",
      source: "public site",
    },
    {
      label: "Athletes, racquet players, and desk workers",
      text: "The site speaks to runners, strength athletes, yoga and training clients, travelers, and people tight from desk work. RAD also publishes a pickleball recovery guide.",
      source: "public site",
    },
    {
      label: "Canada / US mix",
      text: "About 20% Canada and 80% US, as shared with Scale Health.",
      source: "shared with Scale Health",
    },
    {
      label: "Starter tools already in the conversation",
      text: "Neuro Roller, Muscle Flushing Kit, and Point Release Kit.",
      source: "shared with Scale Health",
    },
  ],
  overlap: [
    {
      status: "live",
      title: "Live recovery hubs",
      line: "Two hubs anyone can open today: Integrity Fitness and the DR-HO'S physio hub. These are the only hubs we call live.",
      links: [
        { title: "Integrity Fitness hub", href: "https://www.scalehealth.ca/integrity" },
        { title: "DR-HO'S physio hub", href: "https://physio.drhonow.com" },
      ],
      strength: "strong",
    },
    {
      status: "live",
      title: "Calm Joints racquet pages",
      line: "Squash, tennis, pickleball and padel pages already serve players looking after their body. RAD publishes pickleball recovery guidance.",
      links: [
        { title: "Calm Joints squash", href: "https://calmjoints.org/squash" },
        { title: "Calm Joints tennis", href: "https://calmjoints.org/tennis" },
        { title: "Calm Joints pickleball", href: "https://calmjoints.org/pickleball" },
        { title: "Calm Joints padel", href: "https://calmjoints.org/padel" },
      ],
      strength: "strong",
    },
    {
      status: "pipeline",
      title: "Private brick-and-mortar recovery locations",
      line: "An extended pipeline of stretch, Pilates, chiropractic, personal training and fitness studios — the same recovery-oriented rooms RAD tools are already used in. Pipeline, not a signed placement list.",
      strength: "good",
    },
    {
      status: "street-team",
      title: "Street team, retail hub footprint",
      line: "The street team follows the retail hub footprint in the Greater Toronto and Hamilton Area, in studios and recovery rooms.",
      strength: "good",
    },
    {
      status: "activating",
      title: "Hubs activating",
      line: "More co-branded recovery and wellness hubs are launching. Placements are curated as each one goes live. We don't list those as live until they are.",
      strength: "good",
    },
  ],
  bestFits: [
    {
      title: "Post-purchase on live recovery hubs",
      why: "The thank-you page after a care booking or recovery purchase is the moment people are sent home with a mobility tool.",
      icon: "purchase",
      links: [
        { title: "Integrity Fitness hub", href: "https://www.scalehealth.ca/integrity" },
        { title: "DR-HO'S physio hub", href: "https://physio.drhonow.com" },
      ],
    },
    {
      title: "Calm Joints racquet pages",
      why: "Squash, tennis, pickleball and padel pages already serve players looking after their body; RAD already publishes pickleball recovery guidance.",
      icon: "racquet",
      links: [
        { title: "Calm Joints squash", href: "https://calmjoints.org/squash" },
        { title: "Calm Joints tennis", href: "https://calmjoints.org/tennis" },
        { title: "Calm Joints pickleball", href: "https://calmjoints.org/pickleball" },
        { title: "Calm Joints padel", href: "https://calmjoints.org/padel" },
      ],
    },
    {
      title: "Physio and chiro locations",
      why: "RAD's own positioning is recovery between physical therapy and chiropractic visits — the same rooms in our extended network.",
      icon: "clinic",
    },
    {
      title: "Street team at GTHA studios",
      why: "Trainers and instructors in stretch, Pilates and fitness studios already put SMR tools in people's hands in person.",
      icon: "street",
    },
  ],
  launchingBrands: [
    { name: "DR-HO'S", logoSrc: "/partner-logos/dr-ho.png", href: "https://physio.drhonow.com" },
    { name: "Roll Recovery", logoSrc: "/partner-logos/roll-recovery.png" },
    { name: "Sole", logoSrc: "/partner-logos/sole.png" },
    { name: "Jack Health", logoSrc: "/partner-logos/jack-health.png" },
    { name: "Jill Health", logoSrc: "/partner-logos/jill-health.png" },
    { name: "Bird & Be", logoSrc: "/partner-logos/bird-and-be.png" },
    { name: "Calm Joints", href: "https://calmjoints.org/pickleball", logoSrc: "/for-brands/hubs/calm-joints-mark.svg" },
  ],
  launchingNote: "Cataloged brands already launching on Scale Health hubs and Calm Joints — the company RAD would sit with.",
  performanceOnlyLine: "A performance-only path is also available.",
  heroVisuals: [
    {
      src: "/hub-gallery/integrity.webp",
      alt: "Integrity Fitness × Scale Health members-only hub, live",
      caption: "Integrity Fitness hub, live",
      href: "https://www.scalehealth.ca/integrity",
      hrefTitle: "Integrity Fitness hub",
    },
    {
      src: "/hub-gallery/drho.webp",
      alt: "DR-HO'S physio hub, live",
      caption: "DR-HO'S physio hub, live",
      href: "https://physio.drhonow.com",
      hrefTitle: "DR-HO'S physio hub",
    },
  ],
  sources: [
    {
      label: "RAD's public site",
      text: "Customer and product positioning, including physical therapists, recovery between visits, athletes and desk users, and the pickleball recovery guide. Product photos and the RAD logo are from radroller.com.",
    },
    {
      label: "Shared with Scale Health",
      text: "The roughly 20% Canada / 80% US mix, and the Neuro Roller, Muscle Flushing Kit and Point Release Kit as starter tools.",
    },
    {
      label: "Friday / Birch snapshot",
      text: "Live hubs named in the Birch media kit (Integrity Fitness and DR-HO'S physio). Cataloged launching brands and Calm Joints racquet pages from the audience snapshot fed by the TAM / Friday inventory read on Nov 13, 2026. Street team footprint follows the retail hubs in the GTHA.",
    },
  ],
};

export const BRAND_FITS: Record<string, BrandFit> = {
  "rad-roller": radRoller,
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getBrandFit(slug: string | undefined): BrandFit | undefined {
  const key = (slug ?? "").trim().toLowerCase();
  if (!SLUG.test(key)) return undefined;
  return BRAND_FITS[key];
}

export function isBrandFitPath(pathname: string): boolean {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const path = (clean.length > 1 ? clean.replace(/\/+$/, "") : "/") || "/";
  const parts = path.split("/");
  return parts.length === 3 && parts[1] === "for" && Boolean(getBrandFit(parts[2]));
}

export function brandFitSlugFromPath(pathname: string): string | undefined {
  const clean = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const path = (clean.length > 1 ? clean.replace(/\/+$/, "") : "/") || "/";
  const parts = path.split("/");
  if (parts.length !== 3 || parts[1] !== "for") return undefined;
  return getBrandFit(parts[2])?.slug;
}
