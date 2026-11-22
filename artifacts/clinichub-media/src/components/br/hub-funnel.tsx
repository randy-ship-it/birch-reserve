import { useState } from "react";

/** The 4 hubs that are live and activating. Thumbs are small static captures served from this site (never iframes). */
export const LIVE_HUB_TILES = [
  { key: "drho", name: "DR-HO'S physio", host: "physio.drhonow.com", href: "https://physio.drhonow.com", img: "/hub-gallery/thumbs/drho.webp", tid: "live-hub-drho", tint: "from-[#2b2d8f] to-[#4a4cc0]" },
  { key: "sole", name: "SOLE", host: "scalehealth.ca/sole", href: "https://www.scalehealth.ca/sole", img: "/hub-gallery/thumbs/sole.webp", tid: "live-hub-sole", tint: "from-[#e5532a] to-[#f08a5d]" },
  { key: "effortless", name: "Effortless Admin", host: "scalehealth.ca/effortlessadmin", href: "https://www.scalehealth.ca/effortlessadmin", img: "/hub-gallery/thumbs/effortless.webp", tid: "live-hub-effortless", tint: "from-[#1b8fd6] to-[#6cc1f0]" },
  { key: "calmjoints", name: "Calm Joints", host: "scalehealth.ca/calmjoints", href: "https://www.scalehealth.ca/calmjoints", img: "/hub-gallery/thumbs/calmjoints.webp", tid: "live-hub-calmjoints", tint: "from-[#2f3e5c] to-[#5b6f94]" },
] as const;
export type LiveHubTile = (typeof LIVE_HUB_TILES)[number];

/** Image that can never leave a blank tile: eager load, and a tinted fallback card with the hub name if it fails. */
export function HubThumb({ h, className = "" }: { h: LiveHubTile; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br ${h.tint} ${className}`}>
      {failed ? (
        <span className="absolute inset-0 grid place-items-center px-3 text-center font-display text-lg font-bold text-white">{h.name}</span>
      ) : (
        <img src={h.img} alt={`${h.name} members-only hub`} width={1000} height={625} loading="eager" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover object-top" />
      )}
    </div>
  );
}

/** 2x2 grid of the live hubs (or 1 column on phones). */
export function LiveHubGrid({ light = true, dense = false }: { light?: boolean; dense?: boolean }) {
  return (
    <div className={`grid sm:grid-cols-2 ${dense ? "grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4" : "gap-3"}`} data-testid="live-hub-grid">
      {LIVE_HUB_TILES.map((h) => (
        <a key={h.tid} href={h.href} target="_blank" rel="noopener" data-testid={h.tid} className={`group block overflow-hidden rounded-2xl border shadow-sm transition hover:shadow-lg ${light ? "border-[#0b1f3a]/10 bg-white" : "border-foreground/15 bg-white"}`} aria-label={`Visit the ${h.name} hub`}>
          {/* Dense: the Live label sits on the thumbnail so every card keeps one tidy name row (no stacked badge). */}
          <span className="relative block">
            <HubThumb h={h} />
            {dense ? <span className="absolute left-2 top-2 whitespace-nowrap rounded-full bg-lime-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0b1f3a] shadow-sm" data-testid={`${h.tid}-live`}>Live</span> : null}
          </span>
          <span className={`flex items-center justify-between ${dense ? "gap-1.5 px-2.5 py-2 sm:gap-3 sm:px-3" : "gap-3 px-4 py-3"}`}>
            <span className="min-w-0">
              {dense ? (
                <span className="block text-sm font-bold leading-tight text-[#0b1f3a] sm:truncate">{h.name}</span>
              ) : (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-bold text-[#0b1f3a]">{h.name} <span className="whitespace-nowrap rounded-full bg-lime-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#0b1f3a]">Live · activating</span></span>
              )}
              <span className="block truncate text-xs text-foreground/55">{h.host}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-[#0b1f3a] group-hover:underline">Visit ↗</span>
          </span>
        </a>
      ))}
    </div>
  );
}

const SOON = ["Fitness", "Longevity", "Sleep", "Nutrition", "Pets", "Mental Health"] as const;
const SOON_TINT = ["from-rose-200 to-orange-100", "from-emerald-200 to-teal-100", "from-indigo-200 to-sky-100", "from-lime-200 to-amber-100", "from-amber-200 to-yellow-100", "from-violet-200 to-fuchsia-100"];

/**
 * Funnel: the 4 live hubs sit at the narrow, solid bottom; rows widen upward toward "20+ more hubs coming".
 * Placeholders are abstract, blurred category cards with no names. Wording is "coming" / "activating" only.
 */
export function HubFunnel({ compact = false }: { compact?: boolean }) {
  if (compact) {
    // One row: the live four are already shown above, so only the pipeline line remains (no pyramid, no dead space).
    return (
      <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="hub-funnel" aria-label="Four hubs live and activating, 20 plus more hubs coming">
        <p className="mr-1 text-base font-bold text-[#0b1f3a]" data-testid="hub-funnel-count">20+ more hubs coming</p>
        <ul className="flex flex-wrap gap-1.5" data-testid="hub-funnel-soon">
          {SOON.map((c, i) => (
            <li key={c} className={`rounded-full bg-gradient-to-br ${SOON_TINT[i]} px-2.5 py-1 text-[12px] font-semibold text-[#0b1f3a]/80`}>{c}</li>
          ))}
        </ul>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0b1f3a]/55">Coming soon</span>
      </div>
    );
  }
  return (
    <div className="mx-auto mt-8 max-w-3xl" data-testid="hub-funnel" aria-label="Four hubs live and activating, 20 plus more hubs coming">
      <p className="mb-2 text-center font-display text-2xl font-bold text-[#0b1f3a] md:text-3xl" data-testid="hub-funnel-count">20+ more hubs coming</p>
      {/* widest row: abstract, blurred, no text */}
      <div className="mx-auto grid grid-cols-8 gap-1.5" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => <span key={i} className={`aspect-square rounded-md bg-gradient-to-br ${SOON_TINT[i % 6]} opacity-70 blur-[1.5px]`} />)}
      </div>
      {/* category row */}
      <div className="mx-auto mt-1.5 grid w-[84%] grid-cols-6 gap-1.5" data-testid="hub-funnel-soon">
        {SOON.map((c, i) => (
          <span key={c} className={`relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${SOON_TINT[i]} text-center`}>
            <span className="absolute inset-0 backdrop-blur-[2px]" aria-hidden />
            <span className="relative px-0.5 text-[clamp(8px,2.2vw,12px)] font-bold leading-tight text-[#0b1f3a]/80">{c}</span>
            <span className="relative mt-0.5 text-[clamp(6px,1.6vw,9px)] font-semibold uppercase tracking-wider text-[#0b1f3a]/55">Coming soon</span>
          </span>
        ))}
      </div>
      {/* narrow solid bottom: the live four */}
      <div className="mx-auto mt-1.5 grid w-[64%] grid-cols-4 gap-1.5" data-testid="hub-funnel-live">
        {LIVE_HUB_TILES.map((h) => (
          <a key={h.key} href={h.href} target="_blank" rel="noopener" aria-label={`${h.name}, live and activating`} className="block overflow-hidden rounded-md ring-2 ring-lime-300 shadow">
            <HubThumb h={h} className="!aspect-[4/3]" />
          </a>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#0b1f3a]/60">Live · activating</p>
    </div>
  );
}
