/**
 * Placement diagram: each live hub adds display and CPC slots on four
 * surfaces. Quiet, static layout (no conveyor / factory animation).
 * A recorded MP4 of the older conveyor still ships at
 * /hub-video/conveyor-loop.mp4 for decks and social.
 */
import { BRAND_HUBS } from "../../../../api-server/src/lib/overhaul/model";

const PLACEMENTS = [
  { key: "post", label: "Post-purchase", sub: "thank-you" },
  { key: "home", label: "Hub home", sub: "banner" },
  { key: "products", label: "Products", sub: "product pages" },
  { key: "dash", label: "Dashboard", sub: "behind login" },
] as const;

const EXAMPLE_KEYS = ["sole", "nutriprocan"] as const;

function hubLabel(key: string, name: string): string {
  if (key === "sole") return "Sole";
  return name;
}

export function ConveyorHero({ className = "", captionless = false }: { className?: string; captionless?: boolean }) {
  const hubs = EXAMPLE_KEYS.map((key) => BRAND_HUBS.find((h) => h.key === key)).filter(
    (h): h is (typeof BRAND_HUBS)[number] => Boolean(h),
  );

  return (
    <div className={className}>
      <div
        data-testid="conveyor-hero"
        role="img"
        aria-label="Every live hub adds display and CPC slots on four placements: post-purchase, hub home, product and services pages, and the member dashboard behind login."
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/60">
            Every hub adds four placements
          </p>
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-foreground/40">Illustrative</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {hubs.map((hub) => (
            <div
              key={hub.key}
              className="inline-flex items-center gap-2 border border-foreground/15 bg-white px-3 py-2"
            >
              <img src={hub.logo} alt="" className="h-5 w-auto max-w-[4.75rem] object-contain object-left" />
              <span className="text-sm font-medium text-foreground">{hubLabel(hub.key, hub.name)} × Scale</span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-3">
          {PLACEMENTS.map((col) => (
            <div key={col.key} className="flex min-w-0 flex-col">
              <div className="flex min-h-[3.4rem] flex-col justify-end border-b border-foreground/20 pb-1.5 sm:min-h-0">
                <div className="font-display text-[13px] leading-tight text-foreground sm:text-base">{col.label}</div>
                <div className="text-[10px] leading-tight text-foreground/50 sm:text-xs">{col.sub}</div>
              </div>
              <div className="mt-2 flex w-full max-w-[10rem] flex-col gap-1.5">
                <div className="border border-foreground/20 bg-accent px-1.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-accent-foreground sm:px-2 sm:text-[11px]">
                  Display
                </div>
                <div className="border border-foreground bg-foreground px-1.5 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-background sm:px-2 sm:text-[11px]">
                  CPC
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {captionless ? null : (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid="conveyor-caption">
          Each live hub adds display and CPC slots on four placements: post-purchase, hub home, product and services pages, and the member dashboard behind login. Illustrative.
        </p>
      )}
    </div>
  );
}
