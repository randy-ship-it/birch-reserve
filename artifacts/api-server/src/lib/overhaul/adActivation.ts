/**
 * Ad activation questions (Randy voice, Nov 21 2026 6:02 PM ET). Asked at the "getting your ads turned on" stage, never
 * at the start of intake. Pure + dependency-free: shared by the SPA (chips), the /v1/activation route, the lead row,
 * the Friday push and /ads/admin.
 *   1. Your inventory estimate: ranges (never exact numbers), used for the INTERNAL inventory count only. The public
 *      inventory figures are never changed by these answers.
 *   2. Which ads can run on your hubs: curated health & wellness only / open to other premium brands / any approved ad.
 * Every ad is reviewed; nothing runs on a hub without our ad system plus Randy or Jon permission.
 */
export const ACT_KIND = "ad_activation";
export const ACT_ROLES = [
  { key: "brand", label: "Brand with hubs" },
  { key: "supplier", label: "Supplier / brand" },
  { key: "provider", label: "Provider / hub owner" },
] as const;
export type ActRole = (typeof ACT_ROLES)[number]["key"];

export type Range = { key: string; label: string; mid: number };
const R = (key: string, label: string, mid: number): Range => ({ key, label, mid });
/** mid = 0 means "unknown": counted as "not sure" and never added to the roll-up. */
export const PAGES_RANGES: Range[] = [R("lt10", "Under 10", 5), R("10-50", "10–50", 30), R("50-250", "50–250", 150), R("250-1k", "250–1,000", 600), R("1k+", "1,000+", 1500), R("unsure", "Not sure", 0)];
export const VIEWS_RANGES: Range[] = [R("lt5k", "Under 5K", 2500), R("5-25k", "5K–25K", 15000), R("25-100k", "25K–100K", 60000), R("100-500k", "100K–500K", 300000), R("500k+", "500K+", 750000), R("unsure", "Not sure", 0)];
export const LIST_RANGES: Range[] = [R("none", "No email or SMS list", 0), R("lt1k", "Under 1K", 500), R("1-10k", "1K–10K", 5000), R("10-50k", "10K–50K", 30000), R("50k+", "50K+", 75000), R("unsure", "Not sure", 0)];

export const ACT_OPENNESS = [
  { key: "curated", label: "Curated health & wellness only", hint: "Only recovery and health and wellness ads on your hubs." },
  { key: "premium", label: "Open to other premium brands (non-wellness), with category exclusions", hint: "High-value advertisers outside wellness, minus the categories you exclude." },
  { key: "any", label: "Open to any approved ad", hint: "Any ad that passes our review, minus nothing unless you exclude it." },
] as const;
export type ActOpenness = (typeof ACT_OPENNESS)[number]["key"];
export const ACT_EXCLUSIONS = [
  { key: "alcohol", label: "Alcohol" },
  { key: "gambling", label: "Gambling" },
  { key: "cannabis", label: "Cannabis" },
  { key: "tobacco", label: "Tobacco & vape" },
  { key: "competitors", label: "Competitors" },
  { key: "political", label: "Political" },
] as const;
export type ActExclusion = (typeof ACT_EXCLUSIONS)[number]["key"];

/** Public copy: names no people. The internal rule (our ad system plus Randy or Jon permission) is unchanged and lives in the admin + docs. */
export const ACT_REVIEW_NOTE = "Every ad is reviewed, and nothing runs on your hubs without explicit approval from our team.";
export const ACT_OTHER_MAX = 300;
/** Open to ads beyond curated health and wellness. */
export const isNonCore = (o: string | undefined | null): boolean => o === "premium" || o === "any";

const label = (list: Range[], k: string) => list.find((r) => r.key === k)?.label ?? "";

export type ActivationClean = {
  role: ActRole;
  pages: string; views: string; list: string;
  other: string;
  openness: ActOpenness;
  exclusions: ActExclusion[];
  hubSlug: string;
  fridayId: string;
};

/** Strict server-side validation. Returns the clean record or a user-facing error. Exclusions only count when open to non-core. */
export function parseActivation(raw: unknown): { ok: true; v: ActivationClean } | { ok: false; error: string } {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (x: unknown, n: number) => String(x ?? "").trim().slice(0, n);
  const role = ACT_ROLES.find((r) => r.key === b["role"])?.key;
  if (!role) return { ok: false, error: "Pick who you are." };
  const pages = s(b["pages"], 20), views = s(b["views"], 20), list = s(b["list"], 20);
  if (!PAGES_RANGES.some((r) => r.key === pages)) return { ok: false, error: "Pick a pages or hub screens range." };
  if (!VIEWS_RANGES.some((r) => r.key === views)) return { ok: false, error: "Pick a monthly views range." };
  if (!LIST_RANGES.some((r) => r.key === list)) return { ok: false, error: "Pick an email or SMS list range." };
  const openness = ACT_OPENNESS.find((o) => o.key === b["openness"])?.key;
  if (!openness) return { ok: false, error: "Pick which ads can run on your hubs." };
  if (b["ack"] !== true) return { ok: false, error: "Please confirm you understand every ad is reviewed and nothing runs without approval." };
  const ex = Array.isArray(b["exclusions"]) ? (b["exclusions"] as unknown[]).map(String) : [];
  const keys = ACT_EXCLUSIONS.map((e) => e.key as string);
  if (ex.some((k) => !keys.includes(k))) return { ok: false, error: "Unknown exclusion." };
  // eslint-disable-next-line no-control-regex
  const other = s(b["other"], ACT_OTHER_MAX + 1).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ");
  if (other.length > ACT_OTHER_MAX) return { ok: false, error: `Keep other ad data under ${ACT_OTHER_MAX} characters.` };
  const hubSlug = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(s(b["hub_slug"], 64)) ? s(b["hub_slug"], 64) : "";
  const fridayId = /^[A-Za-z0-9_-]{1,64}$/.test(s(b["friday_id"], 64)) ? s(b["friday_id"], 64) : "";
  return { ok: true, v: { role, pages, views, list, other, openness, exclusions: openness === "curated" ? [] : (keys.filter((k) => ex.includes(k)) as ActExclusion[]), hubSlug, fridayId } };
}

/** Lead-row meta (strings, plus numeric midpoints for the internal roll-up). "none" marks an empty exclusion list so a re-submit clears it. */
export function activationMeta(v: ActivationClean): Record<string, string | number> {
  const mid = (l: Range[], k: string) => l.find((r) => r.key === k)?.mid ?? 0;
  return {
    act_role: v.role, act_pages: v.pages, act_views: v.views, act_list: v.list,
    act_openness: v.openness, act_excl: v.exclusions.join(",") || "none",
    act_pages_mid: mid(PAGES_RANGES, v.pages), act_views_mid: mid(VIEWS_RANGES, v.views), act_list_mid: mid(LIST_RANGES, v.list),
    ...(v.hubSlug ? { hub_slug: v.hubSlug } : {}),
    ...(v.fridayId ? { friday_intake_id: v.fridayId } : {}),
  };
}

export function activationSummary(v: ActivationClean): { need: string; size: string } {
  const open = ACT_OPENNESS.find((o) => o.key === v.openness)!.label;
  const ex = v.exclusions.length ? ` · excludes ${v.exclusions.join(", ")}` : "";
  return {
    size: `Pages/screens ${label(PAGES_RANGES, v.pages)} · views/mo ${label(VIEWS_RANGES, v.views)} · list ${label(LIST_RANGES, v.list)}`.slice(0, 300),
    need: [`Ad activation (${v.role}). Self-reported estimate, ranges only.`, `Ads allowed: ${open}${ex}`, v.other ? `Other ad data: ${v.other}` : ""].filter(Boolean).join("\n").slice(0, 1000),
  };
}

/** Prefilled link to the activation step (emails, admin rows). The page is noindex and sets no data on its own. */
export function activationUrl(o: { email?: string | null; company?: string | null; role?: ActRole; hub?: string | null }, site = "https://birchreserve.net"): string {
  const q = new URLSearchParams();
  if (o.role) q.set("role", o.role);
  if (o.email) q.set("email", o.email.trim().slice(0, 254));
  if (o.company?.trim()) q.set("company", o.company.trim().slice(0, 80));
  if (o.hub?.trim()) q.set("hub", o.hub.trim().slice(0, 64));
  const qs = q.toString();
  return `${site}/intake/activate${qs ? `?${qs}` : ""}`;
}
