import { useState } from "react";
import { activatingHubs, hubHref, liveHubs, LABEL_ACTIVATING, LABEL_LIVE, MORE_LAUNCHING, type LadderHub } from "../../../../api-server/src/lib/hubLadder";
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

/** Live now cards: 1 column on phones, 3 across from 640px. */
export function LiveHubGrid({ light = true }: { light?: boolean; dense?: boolean }) {
  const scale = isScaleSkin();
  return (
    <div data-testid="live-hub-grid" data-hub-tier="live">
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0b1f3a]/65">{LABEL_LIVE}</p>
      <div className="grid gap-3 sm:grid-cols-3">
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
          const cls = `group block overflow-hidden rounded-2xl border shadow-sm transition hover:shadow-lg ${light ? "border-[#0b1f3a]/10 bg-white" : "border-foreground/15 bg-white"}`;
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

/** Activating list + "and more launching". Compact: names and one line each, no thumbnails. */
export function HubFunnel({ compact = false }: { compact?: boolean }) {
  const list = activatingHubs();
  return (
    <div className={compact ? "mt-4" : "mt-6"} data-testid="hub-funnel" data-hub-tier="activating" aria-label={`${LABEL_ACTIVATING} hubs, ${MORE_LAUNCHING}`}>
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#0b1f3a]/65">{LABEL_ACTIVATING}</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="hub-funnel-soon">
        {list.map((h) => (
          <li key={h.key} className="min-w-0 rounded-xl border border-dashed border-[#0b1f3a]/25 bg-white/70 px-3 py-2" data-testid={`activating-${h.key}`}>
            <span className="flex items-center gap-2 text-sm font-bold text-[#0b1f3a]">{h.name}<span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wider text-amber-900">{LABEL_ACTIVATING}</span></span>
            <span className="block text-[12px] leading-snug text-foreground/65">{h.audience}</span>
          </li>
        ))}
        <li className="grid min-w-0 place-items-center rounded-xl border border-dashed border-[#0b1f3a]/20 px-3 py-2 text-sm font-semibold text-[#0b1f3a]/70" data-testid="hub-funnel-count">{MORE_LAUNCHING}</li>
      </ul>
    </div>
  );
}
