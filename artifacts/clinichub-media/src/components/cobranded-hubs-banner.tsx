/**
 * Public co-branded hubs banner (Randy HARD via Emma 2026-09-25).
 *
 * Public labels ONLY: "Co-Branded Hubs with Available Ad Slots" | "In Queue" | "LIVE" on DR-HO's.
 * Never surface internal stage words (Contract Out / Late Discussions / Revisiting).
 * Clear chips = live + signed/launching. Blurred chips = In Queue (pipe + supply-only).
 */
export type HubBannerChip = {
  id: string;
  name: string;
  /** Optional wordmark/logo when an asset exists under /partner-logos. */
  logoSrc?: string;
  live?: boolean;
};

/** LIVE + signed/launching — clear (unblurred). */
export const CLEAR_HUBS: ReadonlyArray<HubBannerChip> = [
  { id: "dr-ho", name: "DR-HO's", live: true },
  { id: "kalaya", name: "Kalaya" },
  { id: "jill-health", name: "Jill Health" },
  { id: "jack-health", name: "Jack Health" },
  { id: "integrity", name: "Integrity Fitness" },
  { id: "bird-and-be", name: "Bird & Be" },
  { id: "nutriprocan", name: "NutriProCan" },
  { id: "roll-recovery", name: "Roll Recovery" },
  { id: "sole", name: "Sole" },
];

/** Non-signed pipe — In Queue, blurred. */
export const QUEUE_PIPE_HUBS: ReadonlyArray<HubBannerChip> = [
  { id: "airwaav", name: "AirWaav" },
  { id: "effortless-admin", name: "Effortless Admin" },
  { id: "genuine-health", name: "Genuine Health" },
  { id: "vivobarefoot", name: "Vivobarefoot" },
  { id: "inbody", name: "Inbody" },
  { id: "aetrex", name: "Aetrex" },
  { id: "castleflexx", name: "CastleFlexx" },
  { id: "urestra", name: "Urestra" },
  { id: "native-shoes", name: "Native Shoes" },
  { id: "built-with-science", name: "Built with Science" },
  { id: "orange-theory", name: "Orange Theory Fitness" },
  { id: "30-minute-hiit", name: "30 Minute HIIT" },
  { id: "medi-dyne", name: "Medi-Dyne" },
];

/** Supply-only — In Queue, blurred. */
export const QUEUE_SUPPLY_HUBS: ReadonlyArray<HubBannerChip> = [
  { id: "bionic-gym", name: "Bionic Gym" },
  { id: "magnum-supps", name: "Magnum Supps" },
  { id: "kgoal", name: "KGoal" },
  { id: "fresh-prep", name: "Fresh Prep" },
  { id: "no-days-wasted", name: "No Days Wasted" },
  { id: "medistick", name: "Medistick" },
  { id: "lyfefuel", name: "LyfeFuel" },
  { id: "apollo-neuro", name: "Apollo Neuro" },
  { id: "renpho", name: "RenPho" },
  { id: "bet-jet", name: "Bet Jet" },
  { id: "flora-health", name: "Flora Health" },
  { id: "sierra-sil", name: "Sierra Sil" },
  { id: "resolve-sleep", name: "Resolve Sleep" },
  { id: "sensate", name: "Sensate" },
];

export const IN_QUEUE_HUBS: ReadonlyArray<HubBannerChip> = [
  ...QUEUE_PIPE_HUBS,
  ...QUEUE_SUPPLY_HUBS,
];

function HubChip({
  hub,
  blurred,
}: {
  hub: HubBannerChip;
  blurred?: boolean;
}) {
  return (
    <li
      className={[
        "inline-flex items-center gap-2 border border-border bg-background px-3.5 py-2.5 font-display text-base tracking-tight text-foreground md:px-4 md:py-3 md:text-lg",
        blurred ? "pointer-events-none select-none opacity-45 [filter:blur(3px)]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={blurred ? true : undefined}
      data-testid={`hub-chip-${hub.id}`}
      data-hub-state={blurred ? "in-queue" : hub.live ? "live" : "clear"}
    >
      {hub.logoSrc ? (
        <img
          src={hub.logoSrc}
          alt=""
          aria-hidden
          className="h-5 w-auto max-w-[7rem] object-contain md:h-6"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span>{hub.name}</span>
      {hub.live ? (
        <span className="ml-0.5 border border-accent/40 bg-accent/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-accent">
          LIVE
        </span>
      ) : null}
    </li>
  );
}

type CobrandedHubsBannerProps = {
  /** Optional section id for aria / anchors. */
  id?: string;
  className?: string;
  /** Compact density for tight kit/home slots. */
  compact?: boolean;
};

/**
 * Full-width centered banner: clear live/signed hubs + blurred In Queue row.
 */
export function CobrandedHubsBanner({
  id = "cobranded-hubs",
  className = "",
  compact = false,
}: CobrandedHubsBannerProps) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={[
        "border-b border-border bg-secondary/10",
        compact ? "py-10 md:py-12" : "py-12 md:py-16",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="cobranded-hubs-banner"
    >
      <div className="container mx-auto px-6 text-center">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
          Scale Health network
        </p>
        <h2
          id={titleId}
          className="mx-auto max-w-4xl font-display text-2xl tracking-tight text-foreground md:text-3xl lg:text-4xl"
        >
          Co-Branded Hubs with Available Ad Slots
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground md:text-sm">
          Clear names are live or launching. Blurred names are In Queue — logos, not reach.
        </p>

        <ul
          className="mt-8 flex w-full flex-wrap items-center justify-center gap-2.5 md:gap-3"
          data-testid="cobranded-hubs-clear"
          aria-label="Live and launching co-branded hubs"
        >
          {CLEAR_HUBS.map((hub) => (
            <HubChip key={hub.id} hub={hub} />
          ))}
        </ul>

        <p
          className="mt-10 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50"
          data-testid="cobranded-hubs-queue-label"
        >
          In Queue
        </p>
        <ul
          className="mt-4 flex w-full flex-wrap items-center justify-center gap-2 md:gap-2.5"
          data-testid="cobranded-hubs-queue"
          aria-label="In Queue hubs"
        >
          {IN_QUEUE_HUBS.map((hub) => (
            <HubChip key={hub.id} hub={hub} blurred />
          ))}
        </ul>
      </div>
    </section>
  );
}
