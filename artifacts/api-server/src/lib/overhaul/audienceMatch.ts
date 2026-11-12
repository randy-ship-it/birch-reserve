/**
 * Match your audience (modelled). Deterministic keyword / category weighting of
 * a site's public text against the Scale Activity launch audience PROFILE
 * (a defined profile, not customer records). No customer data is read.
 *
 * Calibration target (Randy, Nov 12): typical health, wellness, fitness, food
 * and local-service sites land 70-95%; unrelated sites score lower but never
 * brutally (floor 38%).
 */

export type SiteSignals = {
  url: string;
  host: string;
  fetched: boolean;
  fetchNote?: string;
  title: string;
  description: string;
  keywords: string;
  headings: string;
  products: string[];
  categories: string[];
  body: string;
  commerce: { cart: boolean; booking: boolean; shopify: boolean; schemaProduct: boolean };
  geo: { canada: boolean; us: boolean };
};

type Category = { key: string; label: string; hubs: string[]; weight: number; terms: string[] };

/** The Scale Activity launch audience profile. Weights sum is irrelevant; saturation does the work. */
export const PROFILE: Category[] = [
  { key: "recovery", label: "Recovery", hubs: ["Roll Recovery", "DR-HO’S", "Bird & Be"], weight: 1.2, terms: ["recovery", "recover", "physio", "physiotherapy", "physical therapy", "rehab", "rehabilitation", "massage", "foam roll", "massage gun", "percussion", "stretch", "stretching", "sore", "soreness", "injury", "injuries", "compression", "cold plunge", "sauna", "cryotherapy", "postpartum", "pelvic floor", "chiropract", "osteopath", "kinesiology", "athletic therapy"] },
  { key: "pain", label: "Pain relief", hubs: ["DR-HO’S", "SOLE"], weight: 1.2, terms: ["pain", "relief", "ache", "aches", "back pain", "neck pain", "knee pain", "joint", "joints", "arthritis", "sciatica", "tens unit", "tens machine", "ems device", "muscle stimulator", "topical", "plantar", "fasciitis", "inflammation", "tendon", "muscle relief", "heat therapy"] },
  { key: "mobility", label: "Mobility", hubs: ["SOLE", "Roll Recovery"], weight: 1.0, terms: ["mobility", "flexibility", "posture", "balance", "orthotic", "orthotics", "insole", "insoles", "footbed", "footwear", "shoes", "walking", "gait", "ergonomic", "range of motion", "brace", "support"] },
  { key: "longevity", label: "Longevity", hubs: ["Jack Health", "Jill Health"], weight: 1.1, terms: ["longevity", "healthy aging", "aging", "anti-aging", "hormone", "hormones", "menopause", "perimenopause", "testosterone", "trt", "sleep", "energy", "metabolic", "biomarker", "blood test", "lab test", "peptide", "nad", "weight loss", "glp-1", "heart health", "brain health", "midlife"] },
  { key: "fitness", label: "Fitness", hubs: ["Roll Recovery", "Jack Health"], weight: 1.1, terms: ["fitness", "gym", "workout", "workouts", "training", "trainer", "personal training", "strength", "pilates", "yoga", "barre", "spin", "cycling", "running", "run club", "athlete", "athletes", "crossfit", "hiit", "studio", "class", "classes", "membership", "boxing", "climbing", "squash", "tennis", "pickleball", "golf", "swim", "marathon", "sport", "sports"] },
  { key: "food", label: "Food & nutrition", hubs: ["NutriProCan"], weight: 1.1, terms: ["nutrition", "nutritionist", "dietitian", "diet", "protein", "meal", "meals", "meal prep", "recipe", "recipes", "organic", "snack", "snacks", "greens", "vitamin", "vitamins", "supplement", "supplements", "collagen", "electrolyte", "hydration", "probiotic", "gut health", "plant-based", "keto", "gluten-free", "food", "grocery", "kitchen", "coffee", "tea", "smoothie", "juice", "meal kit", "meal kits", "meal delivery", "ingredients", "chef", "dinner", "healthy eating", "whole foods", "macros"] },
  { key: "pets", label: "Pets (in queue)", hubs: [], weight: 0.8, terms: ["pet", "pets", "dog", "dogs", "puppy", "cat", "cats", "canine", "feline", "vet", "veterinary", "pet food", "treats", "hip and joint", "pet food", "dog food", "cat food", "pet supplies", "pet store", "kibble", "litter", "grooming"] },
  { key: "services", label: "Wellness services", hubs: ["Clinic hub network", "Effortless Admin"], weight: 1.0, terms: ["clinic", "clinics", "wellness", "health", "healthcare", "therapy", "therapist", "naturopath", "acupuncture", "registered massage", "rmt", "dental", "dentist", "optometr", "dermatolog", "skin", "skincare", "spa", "medspa", "mental health", "counselling", "counseling", "book an appointment", "appointment", "benefits", "insurance", "employee benefits", "care"] },
];

/** Words that also appear on unrelated sites: count only in title/meta/headings, at a third of the weight. */
const GENERIC = new Set(["support", "class", "classes", "sport", "sports", "training", "trainer", "energy", "care", "health", "balance", "membership", "studio", "walking", "shoes", "food", "coffee", "tea", "juice", "kitchen", "appointment", "benefits", "insurance", "therapy", "wellness", "skin", "diet", "aging", "sleep", "running", "spin", "relief", "joint", "joints", "pain", "recover", "meal", "meals", "snack", "snacks", "grocery", "ache", "aches", "brace", "posture", "golf", "tennis", "swim", "vet", "treats", "pet", "pets", "clinic", "clinics", "healthcare", "healthy aging"]);

const COMMERCE_TERMS = ["add to cart", "shop now", "buy now", "checkout", "free shipping", "subscribe & save", "book now", "book online", "schedule", "membership", "join now"];
const CA_TERMS = ["canada", "canadian", ".ca", "ontario", "toronto", "vancouver", "montreal", "calgary", "ottawa", "british columbia", "alberta", "quebec", "manitoba", "nova scotia", "cad"];
const US_TERMS = ["united states", "usa", "u.s.", "california", "texas", "new york", "florida", "washington", "colorado", "illinois", "usd"];

function countHits(text: string, term: string): number {
  // whole-word for short terms, substring for multi-word / stems
  if (term.length <= 4 && !term.includes(" ")) {
    const re = new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "g");
    return (text.match(re) ?? []).length;
  }
  let n = 0;
  let i = text.indexOf(term);
  while (i !== -1 && n < 50) {
    n++;
    i = text.indexOf(term, i + term.length);
  }
  return n;
}

export type MatchReason = { title: string; detail: string };
export type MatchResult = {
  score: number;
  label: string;
  reasons: MatchReason[];
  topCategories: Array<{ key: string; label: string; strength: number; evidence: string[] }>;
  bestHubs: string[];
  recommended: { product: "area_lock" | "brand_deposit" | "starter_slot" | "display_cpc_inquiry"; label: string; href: string; why: string };
  businessType: "local" | "brand" | "digital";
  modelled: true;
  method: "deterministic-v1";
  basis: string;
};

export function classifyBusiness(s: SiteSignals, blurb: string): "local" | "brand" | "digital" {
  const t = `${s.title} ${s.description} ${s.headings} ${s.body.slice(0, 6000)} ${blurb}`.toLowerCase();
  const local = ["book now", "book online", "book an appointment", "our location", "locations", "visit us", "studio", "clinic", "class schedule", "timetable", "near you", "hours", "directions", "local"].reduce((a, k) => a + countHits(t, k), 0);
  const brand = (s.commerce.cart || s.commerce.shopify || s.commerce.schemaProduct ? 4 : 0) + ["shop", "add to cart", "free shipping", "products", "collection", "buy now"].reduce((a, k) => a + countHits(t, k), 0);
  if (local >= 3 && local >= brand * 0.6) return "local";
  if (brand >= 3) return "brand";
  return local > 0 ? "local" : "digital";
}

export function scoreMatch(s: SiteSignals, blurbRaw: string): MatchResult {
  const blurb = String(blurbRaw ?? "").slice(0, 2000);
  // Weighted text: title/meta/headings count more than body.
  const strong = `${s.title} ${s.description} ${s.keywords} ${s.headings} ${s.categories.join(" ")} ${s.products.join(" ")} ${blurb}`.toLowerCase();
  const body = `${s.body} ${s.host.replace(/[.-]/g, " ")}`.toLowerCase();

  const cats = PROFILE.map((c) => {
    let hits = 0;
    const evidence: string[] = [];
    let distinct = 0;
    for (const term of c.terms) {
      const generic = GENERIC.has(term);
      const h = generic ? countHits(strong, term) : countHits(strong, term) * 3 + Math.min(6, countHits(body, term));
      if (h > 0) {
        hits += generic ? h * 0.5 : h;
        distinct += generic ? 0.5 : 1;
        if (evidence.length < 4 && (!generic || evidence.length < 2)) evidence.push(term);
      }
    }
    // Saturating strength in [0,1]; one specific word alone is not a category.
    let strength = 1 - Math.exp(-hits / 10);
    if (distinct < 2) strength *= 0.45;
    return { key: c.key, label: c.label, hubs: c.hubs, weight: c.weight, strength, evidence };
  }).sort((a, b) => b.strength * b.weight - a.strength * a.weight);

  const top = cats.slice(0, 3);
  // Primary fit is the best category; breadth adds a little.
  const primary = top[0]!.strength * top[0]!.weight;
  const breadth = (top[1]!.strength * top[1]!.weight + top[2]!.strength * top[2]!.weight) / 2;
  const geo = s.geo.canada || s.geo.us ? 1 : 0;
  const commerce = s.commerce.cart || s.commerce.booking || s.commerce.schemaProduct || s.commerce.shopify ? 1 : 0;

  // 38 floor; ~70+ once one profile category is clearly present; 95 cap.
  const fit = Math.min(1.25, primary * 0.75 + breadth * 0.5);
  let score = 38 + 46 * (1 - Math.exp(-fit * 2.4)) + geo * 4 + commerce * 4 + (blurb.trim().length > 20 ? 2 : 0);
  if (!s.fetched && blurb.trim().length < 20) score = Math.min(score, 72);
  score = Math.max(38, Math.min(95, Math.round(score)));

  const label = score >= 85 ? "Excellent match" : score >= 75 ? "Strong match" : score >= 65 ? "Good match" : score >= 55 ? "Promising match" : "Worth a test";
  const businessType = classifyBusiness(s, blurb);
  const hubs = [...new Set(top.filter((c) => c.strength > 0.15).flatMap((c) => c.hubs))].slice(0, 3);

  const reasons: MatchReason[] = [];
  const strongCats = top.filter((c) => c.strength > 0.2);
  if (strongCats.length) {
    reasons.push({
      title: `Your site speaks ${strongCats.map((c) => c.label.toLowerCase()).join(", ")}`,
      detail: `We found ${strongCats.flatMap((c) => c.evidence.slice(0, 2)).map((e) => `“${e}”`).join(", ")} on your pages. Those are core interests in the Scale Activity launch audience profile.`,
    });
  } else {
    reasons.push({
      title: "Adjacent to the wellness audience",
      detail: "Your pages don't lean on recovery, fitness or food words yet, but hub members are health-minded adults who buy for themselves and their families. A short, practical offer usually travels well.",
    });
  }
  reasons.push(
    hubs.length
      ? { title: `Best-fit hubs: ${hubs.join(", ")}`, detail: "Your ad would sit inside these co-branded hubs, on the home page, in product and service pages, and after checkout." }
      : { title: "Best fit: the clinic hub network", detail: "Clinic, gym and studio member hubs give broad health-and-wellness reach while brand-specific hubs fill in." },
  );
  if (businessType === "local") {
    reasons.push({ title: "You serve a local area", detail: "Hub members near you can be reached by postal code. Lock down your 5 km area so nearby members see you first." });
  } else if (commerce) {
    reasons.push({ title: "Your customers buy online", detail: "Post-purchase placements reach people who just finished buying something, the moment an offer is most welcome." });
  } else {
    reasons.push({ title: geo ? "Canada / US adults" : "North American adults", detail: "The launch audience is Canadian and US adults. Your offer can run in both currencies." });
  }

  const recommended: MatchResult["recommended"] =
    businessType === "local"
      ? { product: "area_lock", label: "Lock down my area", href: "/advertise/local", why: "Hold up to 50% of hub display within 5 km of you (25% in dense downtown cores)." }
      : score >= 70
        ? { product: "brand_deposit", label: "Brand spend commit", href: "/advertise/brands", why: "Prepay a test budget across the best-fit hubs and get bonus credit." }
        : score >= 55
          ? { product: "starter_slot", label: "Starter slot", href: "/advertise/brands#slots", why: "Start small with a non-exclusive slot and see the response." }
          : { product: "display_cpc_inquiry", label: "Talk to us about display / CPC", href: "/publish/brands#display-cpc", why: "We'll suggest the hubs and formats where your offer fits." };

  return {
    score,
    label,
    reasons: reasons.slice(0, 3),
    topCategories: top.map((c) => ({ key: c.key, label: c.label, strength: Math.round(c.strength * 100) / 100, evidence: c.evidence })),
    bestHubs: hubs,
    recommended,
    businessType,
    modelled: true,
    method: "deterministic-v1",
    basis: "Modelled audience match: your public site text compared with the Scale Activity launch audience profile (recovery, pain relief, mobility, longevity, fitness, food/nutrition, pets in queue, wellness services; Canada/US adults). Not a comparison of customer records.",
  };
}

// ---------------------------------------------------------------- extraction

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function metaContent(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  if (!tag) return "";
  return decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? "");
}

export function extractSignals(url: string, html: string, extraProducts: string[] = [], extraCategories: string[] = []): SiteSignals {
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  })();
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "");
  const description = metaContent(html, "description") || metaContent(html, "og:description");
  const keywords = metaContent(html, "keywords");
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => decodeEntities(m[1]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 40)
    .join(" · ");
  const products: string[] = [...extraProducts];
  const categories: string[] = [...extraCategories];
  let schemaProduct = false;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]!);
      const walk = (n: unknown): void => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(walk);
        const o = n as Record<string, unknown>;
        const type = String(o["@type"] ?? "");
        if (/Product/i.test(type)) {
          schemaProduct = true;
          if (typeof o.name === "string") products.push(o.name);
          if (typeof o.category === "string") categories.push(o.category);
        }
        if (/(HealthClub|ExerciseGym|MedicalClinic|Physiotherapy|DaySpa|HealthAndBeautyBusiness|SportsActivityLocation|LocalBusiness|Store|Restaurant)/i.test(type)) categories.push(type);
        Object.values(o).forEach(walk);
      };
      walk(data);
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30000);
  const lower = `${html.slice(0, 200000)}`.toLowerCase();
  const tl = `${title} ${description} ${text}`.toLowerCase();
  return {
    url,
    host,
    fetched: true,
    title: title.slice(0, 300),
    description: description.slice(0, 600),
    keywords: keywords.slice(0, 600),
    headings: headings.slice(0, 3000),
    products: products.slice(0, 40),
    categories: [...new Set(categories)].slice(0, 30),
    body: text,
    commerce: {
      cart: /add[ -]to[ -]cart|\/cart\b|shopping cart/.test(lower),
      booking: /book (now|online|an appointment|a class)|janeapp|mindbody|schedule (a|your)|calendly|booking/.test(lower),
      shopify: /cdn\.shopify\.com|shopify\.theme|myshopify/.test(lower),
      schemaProduct,
    },
    geo: {
      canada: host.endsWith(".ca") || CA_TERMS.some((t) => tl.includes(t)),
      us: US_TERMS.some((t) => tl.includes(t)),
    },
  };
}

export function emptySignals(url: string, note: string): SiteSignals {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return {
    url,
    host,
    fetched: false,
    fetchNote: note,
    title: "",
    description: "",
    keywords: "",
    headings: "",
    products: [],
    categories: [],
    body: "",
    commerce: { cart: false, booking: false, shopify: false, schemaProduct: false },
    geo: { canada: host.endsWith(".ca"), us: false },
  };
}

export function normalizeUrl(raw: string): string | null {
  let v = String(raw ?? "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

/** Reject loopback / private / link-local targets (SSRF guard). */
export function isPrivateAddress(ip: string): boolean {
  if (/^(::1|::|fe80:|fc|fd)/i.test(ip)) return true;
  const v4 = ip.replace(/^::ffff:/, "");
  const p = v4.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p as [number, number, number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
