/**
 * Activity pulse seed (Randy t293u, Nov 20 2026): real inbound replies to randy@scalehealth.ca and the Birch inbox,
 * read once (read-only) and reduced to a fixed type, a coarse region and the source date (rounded to the hour).
 * No names, companies, emails, domains or quotes. Declines, auto-replies, bounces, vendors, signed agreements and
 * internal mail were left out. Every row maps to one real message; nothing is invented. Rows age out of the 30-day
 * window on their own; new site events (lib/activityPulse.ts) append automatically.
 */
import type { PulseEvent } from "./activityPulse";

type Seed = Pick<PulseEvent, "action" | "who" | "region"> & { at: string };

const SEED: Seed[] = [
  { at: "2026-11-20T19:00:00Z", who: "Agency", region: "Canada", action: "agency_partnership" },
  { at: "2026-11-20T17:00:00Z", who: "Sleep brand", region: "US", action: "hub_members" },
  { at: "2026-11-19T16:00:00Z", who: "Recovery equipment brand", region: "US", action: "fees_markets" },
  { at: "2026-11-19T15:00:00Z", who: "Beverage brand", region: null, action: "how_it_works" },
  { at: "2026-11-18T19:00:00Z", who: "Pain relief brand", region: "US", action: "call_booked" },
  { at: "2026-11-18T03:00:00Z", who: "Supplement distributor", region: "Ontario", action: "call_booked" },
  { at: "2026-11-13T14:00:00Z", who: "Sleep brand", region: "US", action: "fee_structure" },
  { at: "2026-11-11T18:00:00Z", who: "Recovery hardware brand", region: "US", action: "call_booked" },
  { at: "2026-11-11T15:00:00Z", who: "Supplement distributor", region: "Ontario", action: "program_summary" },
  { at: "2026-11-10T17:00:00Z", who: "Recovery hardware brand", region: "US", action: "how_it_works" },
  { at: "2026-11-10T16:00:00Z", who: "Physio clinic", region: "Alberta", action: "provider_agreement" },
  { at: "2026-11-09T15:00:00Z", who: "Physio clinic", region: "PEI", action: "hub_hosting" },
];

export const PULSE_SEED: PulseEvent[] = SEED.map((s) => ({ action: s.action, category: null, who: s.who, region: s.region, src: "inbox", createdAt: new Date(s.at) }));
