/**
 * Hero visual (Randy item 1): co-branded hubs come off a conveyor belt and fan
 * out into display + CPC inventory on four placements: Post-Purchase, Hub Home Page,
 * Product / Services pages, Post-Purchase. Pure CSS/DOM animation (no video
 * dependency); a recorded MP4 loop of this component ships at
 * /hub-video/conveyor-loop.mp4 for decks and social.
 */
import { useEffect, useRef, useState } from "react";
import { BRAND_HUBS } from "../../../../api-server/src/lib/overhaul/model";

const SURFACE_COLS = [
  { key: "post", label: "Post-Purchase", short: "Post-purchase", sub: "thank-you · confirmation" },
  { key: "home", label: "Hub Home Page", short: "Hub home", sub: "banner · native tile" },
  { key: "products", label: "Product / Services", short: "Products", sub: "sponsored card · display" },
  { key: "dash", label: "Member Dashboard", short: "Dashboard", sub: "behind login" },
] as const;

type Layout = {
  w: number;
  h: number;
  belt: { x: number; y: number; w: number };
  drop: Array<{ x: number; y: number }>;
  cols: Array<{ x: number; y: number; w: number }>;
  card: { w: number; h: number };
  tile: { w: number; h: number; gap: number; rows: number };
};

const DESKTOP: Layout = {
  w: 1200,
  h: 520,
  belt: { x: 20, y: 330, w: 500 },
  drop: [
    { x: 600, y: 120 },
    { x: 750, y: 120 },
    { x: 900, y: 120 },
    { x: 1050, y: 120 },
  ],
  cols: [
    { x: 580, y: 40, w: 140 },
    { x: 730, y: 40, w: 140 },
    { x: 880, y: 40, w: 140 },
    { x: 1030, y: 40, w: 140 },
  ],
  card: { w: 160, h: 108 },
  tile: { w: 66, h: 46, gap: 8, rows: 6 },
};

const MOBILE: Layout = {
  w: 600,
  h: 700,
  belt: { x: 10, y: 170, w: 580 },
  drop: [
    { x: 20, y: 420 },
    { x: 168, y: 420 },
    { x: 316, y: 420 },
    { x: 464, y: 420 },
  ],
  cols: [
    { x: 6, y: 330, w: 140 },
    { x: 154, y: 330, w: 140 },
    { x: 302, y: 330, w: 140 },
    { x: 450, y: 330, w: 140 },
  ],
  card: { w: 176, h: 118 },
  tile: { w: 66, h: 64, gap: 6, rows: 4 },
};

const CYCLE_S = 16;

export function ConveyorHero({ className = "", captionless = false }: { className?: string; captionless?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const L = width < 720 ? MOBILE : DESKTOP;
  const scale = width / L.w;
  const hubs = BRAND_HUBS;

  return (
    <div className={className}>
      <div ref={ref} className="relative w-full overflow-hidden" style={{ height: L.h * scale }} data-testid="conveyor-hero" aria-label="Animation: co-branded hubs roll off a conveyor belt and become display and CPC ad slots on post-purchase pages, the hub home page, product and services pages, and the member dashboard behind login." role="img">
        <div className="br-stage absolute left-0 top-0 origin-top-left" style={{ width: L.w, height: L.h, transform: `scale(${scale})` }}>
          {/* backdrop grid */}
          <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "linear-gradient(hsl(var(--foreground)/0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

          {/* label for the belt */}
          <div className="absolute font-semibold uppercase tracking-[0.2em] text-foreground/55" style={{ left: L.belt.x + 8, top: L.belt.y - L.card.h - 44, fontSize: 13 }}>
            Co-branded hubs coming off the line
          </div>

          {/* belt */}
          <div className="absolute" style={{ left: L.belt.x, top: L.belt.y, width: L.belt.w, height: 34 }}>
            <div className="br-belt absolute inset-0 border-2 border-foreground bg-foreground" />
            {[0, 1].map((i) => (
              <div key={i} className="br-roller absolute top-1/2 size-11 -translate-y-1/2 rounded-full border-[3px] border-foreground bg-accent" style={{ [i ? "right" : "left"]: -18 } as React.CSSProperties}>
                <div className="absolute left-1/2 top-0 h-1/2 w-[3px] -translate-x-1/2 bg-foreground" />
              </div>
            ))}
            {/* legs */}
            {[0.12, 0.5, 0.88].map((p) => (
              <div key={p} className="absolute w-[6px] bg-foreground/80" style={{ left: `${p * 100}%`, top: 34, height: L === MOBILE ? 40 : 90 }} />
            ))}
          </div>

          {/* fan-out beams */}
          <svg className="absolute inset-0" width={L.w} height={L.h} aria-hidden>
            {L.drop.map((d, i) => (
              <path key={i} className="br-beam" d={`M ${L.belt.x + L.belt.w - 20} ${L.belt.y} C ${L.belt.x + L.belt.w + 40} ${L.belt.y - 60}, ${d.x + 40} ${d.y + 220}, ${L.cols[i]!.x + L.cols[i]!.w / 2} ${L.cols[i]!.y + 70}`} fill="none" stroke="hsl(var(--foreground))" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="6 8" />
            ))}
          </svg>

          {/* surface columns with proliferating tiles */}
          {SURFACE_COLS.map((col, ci) => {
            const c = L.cols[ci]!;
            return (
              <div key={col.key} className="absolute" style={{ left: c.x, top: c.y, width: c.w }}>
                <div className="flex flex-col justify-end border-b-2 border-foreground pb-1.5" style={{ minHeight: 58 }}>
                  <div className="font-display leading-tight text-foreground" style={{ fontSize: L === MOBILE ? 20 : 15 }}>{L === MOBILE ? col.short : col.label}</div>
                  <div className="text-foreground/55" style={{ fontSize: L === MOBILE ? 13 : 11 }}>{L === MOBILE ? (ci === 3 ? "behind login" : "display · CPC") : col.sub}</div>
                </div>
                <div className="mt-2 grid grid-cols-2" style={{ gap: L.tile.gap }}>
                  {Array.from({ length: L.tile.rows * 2 }).map((_, ti) => {
                    const cpc = ti % 2 === 1;
                    const delay = (1.2 + ci * 0.3 + ti * 0.45).toFixed(2);
                    return (
                      <div key={ti} className={`br-tile flex flex-col justify-between border px-1.5 py-1 ${cpc ? "border-foreground bg-foreground text-background" : "border-foreground/30 bg-accent text-accent-foreground"}`} style={{ height: L.tile.h, animationDelay: `${delay}s` }}>
                        <span className="font-semibold uppercase tracking-wider" style={{ fontSize: L === MOBILE ? 11 : 9 }}>{cpc ? "CPC" : "Display"}</span>
                        <span className="block h-1.5 w-3/4 bg-current opacity-30" />
                        <span className="block h-1.5 w-1/2 bg-current opacity-20" />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* hubs riding the belt then flying into the columns */}
          {hubs.map((hub, i) => {
            const d = L.drop[i % 4]!;
            const startX = L.belt.x - L.card.w - 20;
            const endX = L.belt.x + L.belt.w - L.card.w;
            const y = L.belt.y - L.card.h - 4;
            return (
              <div
                key={hub.key}
                className="br-hub absolute left-0 top-0 border border-foreground/20 bg-white shadow-[0_10px_30px_-12px_rgba(7,26,57,0.45)]"
                style={{
                  width: L.card.w,
                  height: L.card.h,
                  animationDelay: `${(i * CYCLE_S) / hubs.length}s`,
                  animationDuration: `${CYCLE_S}s`,
                  ["--sx" as string]: `${startX}px`,
                  ["--ex" as string]: `${endX}px`,
                  ["--by" as string]: `${y}px`,
                  ["--dx" as string]: `${d.x}px`,
                  ["--dy" as string]: `${d.y}px`,
                }}
              >
                <div className="flex items-center gap-1 border-b border-foreground/10 bg-secondary/60 px-2 py-1">
                  <span className="size-1.5 rounded-full bg-foreground/30" />
                  <span className="size-1.5 rounded-full bg-foreground/30" />
                  <span className="size-1.5 rounded-full bg-foreground/30" />
                  <span className="ml-1 truncate text-foreground/50" style={{ fontSize: 9 }}>{hub.name} × Scale hub</span>
                </div>
                <div className="relative h-[calc(100%-22px)] overflow-hidden">
                  <img src={hub.banner} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-60" loading="lazy" />
                  <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-foreground/10 bg-white px-2.5 py-1.5 shadow-sm" style={{ maxWidth: L.card.w - 30 }}>
                    <img src={hub.logo} alt={hub.name} className="max-h-7 w-auto object-contain" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* static fallback for reduced motion */}
          <div className="br-static absolute hidden gap-3" style={{ left: L.belt.x + 20, top: L.belt.y - L.card.h - 4 }}>
            {hubs.slice(0, 3).map((hub) => (
              <div key={hub.key} className="flex items-center justify-center border border-foreground/20 bg-white" style={{ width: L.card.w, height: L.card.h }}>
                <img src={hub.logo} alt={hub.name} className="max-h-8 w-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
      {captionless ? null : (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid="conveyor-caption">
          Each live hub adds display and CPC slots on four placements: post-purchase, hub home, product and services pages, and the member dashboard behind login. Slots fill based on each hub’s audience and the purchase moment. Illustrative animation.
        </p>
      )}
    </div>
  );
}
