import { useState } from "react";
import { activatingHubs, hubHref, liveHubs, retailSceneSrc, LABEL_ACTIVATING, LABEL_LIVE, MORE_LAUNCHING, MOCK_LABEL, RETAIL_MICRO_HUBS, RETAIL_MICRO_LABEL, type LadderHub } from "../../../../api-server/src/lib/hubLadder";
import { isScaleSkin } from "@/lib/siteSkin";

/**
 * The hub status ladder as visuals (one source: api-server/src/lib/hubLadder.ts, Randy Nov 23 2026):
 *   LiveHubGrid  = "Live now" cards (real capture, one audience line, link to the real hub page)
 *   HubFunnel    = "Activating" list (name + one audience line) and "and more launching"
 * Thumbs are small static captures served from this site (never iframes).
 */
const TINT: Record<string, string> = {
  "dr-ho": "from-[#2b2d8f] to-[#4a4cc0]",
  sole: "from-[#e5532a] to-[#f08a5d]",
  "calm-joints": "from-[#2f3e5c] to-[#5b6f94]",
  "integrity-fitness": "from-[#7a1f3d] to-[#c0507a]",
};
const hostOf = (u?: string) => (u ? u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "");

export type LiveHubTile = LadderHub & { tid: string };
export const LIVE_HUB_TILES: LiveHubTile[] = liveHubs().map((h) => ({ ...h, tid: `live-hub-${h.key}` }));

/** Image that can never leave a blank tile: eager load, and a tinted fallback card with the hub name if it fails. */
export function HubThumb({ h, className = "" }: { h: LadderHub; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${TINT[h.key] ?? "from-[#2f3e5c] to-[#5b6f94]"} ${className}`}>
      {failed || !h.thumb ? (
        <span className="absolute inset-0 grid place-items-center px-3 text-center font-display text-lg font-bold text-white">{h.name}</span>
      ) : (
        <img src={h.thumb} alt={`${h.name} members-only hub`} width={1000} height={625} loading="eager" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover object-top" />
      )}
    </div>
  );
}

/** Live now cards: 1 column on phones, 2 from 640px, 4 from 1024px. */
export function LiveHubGrid({ light = true }: { light?: boolean; dense?: boolean }) {
  const scale = isScaleSkin();
  return (
    <div data-testid="live-hub-grid" data-hub-tier="live">
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0b1f3a]/65">{LABEL_LIVE}</p>
      <div className={`-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 ${LIVE_HUB_TILES.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        {LIVE_HUB_TILES.map((h) => {
          const href = hubHref(h, scale);
          const body = (
            <>
              <span className="relative block">
                <HubThumb h={h} />
                <span className="absolute left-2 top-2 whitespace-nowrap rounded-full bg-lime-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0b1f3a] shadow-sm" data-testid={`${h.tid}-live`}>{LABEL_LIVE}</span>
              </span>
              <span className="block px-3 py-2.5">
                <span className="flex items-center justify-between gap-2 font-bold leading-tight text-[#0b1f3a]">
                  <span className="min-w-0">{h.name}</span>
                  {href ? <span className="shrink-0 text-sm font-semibold group-hover:underline">Visit ↗</span> : null}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-foreground/70" data-testid={`${h.tid}-audience`}>{h.audience}</span>
                {href ? <span className="mt-0.5 block truncate text-[11px] text-foreground/45">{hostOf(href)}</span> : null}
              </span>
            </>
          );
          const cls = `group block w-[250px] shrink-0 snap-start overflow-hidden sm:w-auto sm:shrink rounded-2xl border shadow-sm transition hover:shadow-lg ${light ? "border-[#0b1f3a]/10 bg-white" : "border-foreground/15 bg-white"}`;
          return href ? (
            <a key={h.key} href={href} target="_blank" rel="noopener" data-testid={h.tid} data-mirror-keep className={cls} aria-label={`Visit the ${h.name} hub`}>{body}</a>
          ) : (
            <div key={h.key} data-testid={h.tid} className={cls}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}

/** Example ad card drawn over a hub page or a retail scene. Placeholder lines only: never a real brand or a real placement. */
function AdCardMock({ surface }: { surface: string }) {
  return (
    <span className="absolute bottom-2 right-2 w-[40%] rounded-md bg-white p-1.5 shadow-lg ring-1 ring-black/10" aria-hidden="true" title={surface}>
      <span className="block text-[7px] font-bold uppercase leading-none tracking-wider text-[#0b1f3a]/55">Your brand</span>
      <span className="mt-1 block h-1.5 w-4/5 rounded bg-[#0b1f3a]/25" />
      <span className="mt-1 block h-1.5 w-3/5 rounded bg-[#0b1f3a]/12" />
      <span className="mt-1 block h-2 w-1/2 rounded bg-[#1f8a4c]" />
    </span>
  );
}

function ExampleCard({ tid, img, imgClass = "object-top", style, name, chip, audience, surface, sub }: { tid: string; img: string; imgClass?: string; style?: React.CSSProperties; name: string; chip: string; audience: string; surface: string; sub?: string }) {
  return (
    <li data-testid={tid} className="w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl border border-dashed border-[#0b1f3a]/30 bg-white shadow-sm sm:w-auto sm:shrink">
      <span className="relative block aspect-[16/10] w-full overflow-hidden bg-[#e9e3d6]">
        <img src={img} alt={`${MOCK_LABEL}: ${name}`} width={960} height={600} loading="lazy" decoding="async" style={style} className={`absolute inset-0 size-full object-cover ${imgClass}`} />
        <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900 shadow-sm">{chip}</span>
          <span className="whitespace-nowrap rounded-full bg-[#0b1f3a]/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">{MOCK_LABEL}</span>
        </span>
        <AdCardMock surface={surface} />
      </span>
      <span className="block px-3 py-2.5">
        <span className="block font-bold leading-tight text-[#0b1f3a]">{name}</span>
        {sub ? <span className="block text-[11px] font-semibold text-[#0b1f3a]/55">{sub}</span> : null}
        <span className="mt-0.5 block text-[13px] leading-snug text-foreground/70">{audience}</span>
      </span>
    </li>
  );
}

/** Activating hubs with an example ad-card mockup on each hub's page, then 5 generic retail micro-hub examples, then "and more launching". */
export function HubFunnel({ compact = false }: { compact?: boolean }) {
  const list = activatingHubs();
  const strip = "-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0";
  return (
    <div className={compact ? "mt-4" : "mt-6"} data-testid="hub-funnel" data-hub-tier="activating" aria-label={`${LABEL_ACTIVATING} hubs, ${MORE_LAUNCHING}`}>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0b1f3a]/65">{LABEL_ACTIVATING}<span className="font-semibold normal-case tracking-normal text-foreground/55">Example mockups of the ad card on each hub's page. Not live placements.</span></p>
      <ul className={`${strip} ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`} data-testid="hub-funnel-soon">
        {list.map((h) => (
          <ExampleCard key={h.key} tid={`activating-${h.key}`} img={h.banner ?? ""} name={h.name} chip={LABEL_ACTIVATING} audience={h.audience} surface={h.surface ?? "Hub card"} />
        ))}
      </ul>
      {(
        <div className="mt-5" data-testid="retail-micro-hubs">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0b1f3a]/65">{RETAIL_MICRO_LABEL}s · {LABEL_ACTIVATING}<span className="font-semibold normal-case tracking-normal text-foreground/55">Signed clinic partners, shown as generic examples. Illustrations, not photos.</span></p>
          <ul className={`${strip} ${compact ? "sm:grid-cols-3" : "sm:grid-cols-3 lg:grid-cols-5"}`}>
            {RETAIL_MICRO_HUBS.map((h) => (
              <ExampleCard key={h.key} tid={`retail-${h.key}`} img={retailSceneSrc(h)} imgClass="object-cover" style={{ filter: `hue-rotate(${h.hue}deg)` }} name={h.name} sub={h.label} chip={LABEL_ACTIVATING} audience={h.audience} surface={h.surface} />
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-sm font-semibold text-[#0b1f3a]/70" data-testid="hub-funnel-count">{MORE_LAUNCHING}</p>
    </div>
  );
}
