/**
 * Per-channel geography, config-driven (Randy via Emma, Nov 18 2026 10:48 PM ET). One place to change it.
 * Countries are ISO codes; Street Team is Ontario now, Canada-wide later. Shared by the client and server.
 * Friday v1.1 will return per-channel eligibility; when it does, the client uses Friday's answer instead.
 */
export type Country = "CA" | "US";
export type Market = { sells_in: Country[]; ships_to: Country[]; regions?: string[] };
export type Eligibility = "now" | "later" | "not_available";
export type ChannelGeo = { key: "scale-hubs" | "calm-joints" | "street-team" | "retail-network"; friday_key: "hubs" | "calm_joints" | "street_team" | "retail"; now: { countries: Country[]; regions?: string[] }; later?: { countries: Country[]; regions?: string[] }; label: string };

export const CHANNEL_GEO: readonly ChannelGeo[] = [
  { key: "scale-hubs", friday_key: "hubs", now: { countries: ["CA", "US"] }, label: "Canada + USA" },
  { key: "calm-joints", friday_key: "calm_joints", now: { countries: ["CA", "US"] }, label: "Canada + USA" },
  { key: "street-team", friday_key: "street_team", now: { countries: ["CA"], regions: ["ON"] }, later: { countries: ["CA"] }, label: "Ontario now, Canada later" },
  { key: "retail-network", friday_key: "retail", now: { countries: ["CA", "US"] }, label: "Canada + USA" },
] as const;

export const COUNTRY_LABEL: Record<Country, string> = { CA: "Canada", US: "USA" };
export const CA_PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;
export const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"] as const;

/** "ON, bc; NY" → ["ON","BC","NY"]; codes only, anything else is dropped (no free text goes to Friday). */
export function parseRegions(text: string): string[] {
  const ok = new Set<string>([...CA_PROVINCES, ...US_STATES]);
  return [...new Set(text.toUpperCase().split(/[^A-Z]+/).filter((c) => ok.has(c)))].slice(0, 20);
}

const reach = (m: Market): Country[] => [...new Set([...m.sells_in, ...m.ships_to])];

/** Can this brand use the channel now, later, or not in its markets? */
export function channelEligibility(key: ChannelGeo["key"], m: Market | null | undefined): Eligibility {
  const g = CHANNEL_GEO.find((c) => c.key === key);
  if (!g) return "not_available";
  if (!m || !reach(m).length) return "now"; // no answer yet: show the channel
  const cs = reach(m);
  const caRegions = (m.regions ?? []).filter((r) => (CA_PROVINCES as readonly string[]).includes(r));
  const inScope = (s: { countries: Country[]; regions?: string[] }) => cs.some((c) => s.countries.includes(c)) && (!s.regions || !cs.includes("CA") || !caRegions.length || caRegions.some((r) => s.regions!.includes(r)));
  if (inScope(g.now)) return "now";
  if (g.later && inScope(g.later)) return "later";
  return "not_available";
}

export function marketLabel(m: Market): string {
  const c = reach(m).map((x) => COUNTRY_LABEL[x]).join(" + ") || "Not set";
  return m.regions?.length ? `${c} (${m.regions.join(", ")})` : c;
}

/** v1 has no geo block yet (strict body): send it as the allowed profile.geography text. */
export function marketToGeographyText(m: Market): string {
  return `Sells in: ${m.sells_in.map((x) => COUNTRY_LABEL[x]).join(" + ") || "-"}; ships to: ${m.ships_to.map((x) => COUNTRY_LABEL[x]).join(" + ") || "-"}${m.regions?.length ? `; regions: ${m.regions.join(", ")}` : ""}`;
}
