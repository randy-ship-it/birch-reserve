/**
 * Quiet alternative EXAMPLE exclusive-placement properties (not Scale hubs).
 *
 * WePrize already soft-links brands to birchreserve.net to buy space; Birch
 * must reciprocate so the inventory is not random. Keep placements subtle:
 * Digital inventory line, kit live-proof secondary line, muted footer —
 * NEVER hero / Featured Format / CLEAR_HUBS co-branded banner / Example hubs gallery.
 */
export type ExampleExclusiveProperty = {
  id: string;
  name: string;
  /** Short public one-liner for humans + AI. */
  blurb: string;
  href: string;
  /** Placement kind shown on chips / kit. */
  kind: string;
};

export const EXAMPLE_EXCLUSIVE_PROPERTIES: ReadonlyArray<ExampleExclusiveProperty> = [
  {
    id: "weprize",
    name: "WePrize",
    blurb:
      "Live SBG / Birch Reserve exclusive display placement example (placement example only — not a Scale hub seat; no reach claim).",
    href: "https://weprize.net",
    kind: "Exclusive display · example",
  },
];

export const WEPRIZE = EXAMPLE_EXCLUSIVE_PROPERTIES[0]!;
