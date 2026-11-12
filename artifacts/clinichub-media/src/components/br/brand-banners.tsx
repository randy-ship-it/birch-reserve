/**
 * Brand banners in the CalmJoints.org "brands we power" style: browser-window
 * cards with the real hub screenshot, a floating logo pill, the hub name and a
 * status badge, in a snap carousel with arrows and dots. Logos and screenshots
 * are the brands' real assets (Scale Health repo / live hub captures, Nov 12).
 */
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BRAND_HUBS, type BrandHub } from "../../../../api-server/src/lib/overhaul/model";

function Badge({ status }: { status: BrandHub["bannerStatus"] }) {
  return <span className="bg-[#1f8a4c] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{status}</span>;
}

export function BrandBannerCard({ hub, locked = false }: { hub: BrandHub; locked?: boolean }) {
  return (
    <figure className="group w-[300px] shrink-0 snap-start md:w-[380px]" data-testid={`brand-banner-${hub.key}`}>
      <div className="relative border border-foreground/15 bg-white shadow-[0_18px_40px_-24px_rgba(7,26,57,0.45)] transition-transform duration-300 group-hover:-translate-y-1">
        <div className="flex items-center gap-1.5 border-b border-foreground/10 bg-secondary/50 px-3 py-2">
          <span className="size-2 rounded-full bg-foreground/25" />
          <span className="size-2 rounded-full bg-foreground/25" />
          <span className="size-2 rounded-full bg-foreground/25" />
          <span className="ml-2 truncate text-[11px] text-foreground/45">{hub.name} × Scale</span>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden">
          <img src={hub.banner} alt={`${hub.name} co-branded hub`} className={`h-full w-full object-cover object-top ${locked ? "blur-[2px]" : ""}`} loading="lazy" />
        </div>
        <div className="absolute left-1/2 top-9 flex h-12 -translate-x-1/2 items-center justify-center border border-foreground/10 bg-white px-4 shadow-md">
          <img src={hub.logo} alt={`${hub.name} logo`} className="max-h-8 w-auto max-w-[150px] object-contain" />
        </div>
      </div>
      <figcaption className="mt-3 flex items-center gap-2">
        <span className="font-display text-lg">{hub.name}</span>
        <Badge status={hub.bannerStatus} />
        <span className="ml-auto text-xs text-muted-foreground">{hub.recovery}</span>
      </figcaption>
    </figure>
  );
}

export function BrandBanners({ title = "Live co-branded hubs listed with Scale", hubs = BRAND_HUBS }: { title?: string; hubs?: BrandHub[] }) {
  const track = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const scrollBy = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * 400, behavior: "smooth" });
  };
  return (
    <div data-testid="brand-banners">
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-foreground/55">{title}</p>
      {/* logo strip */}
      <ul className="mb-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-5" data-testid="brand-logo-strip">
        {hubs.map((h) => (
          <li key={h.key} className="flex h-10 items-center opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0">
            <img src={h.logo} alt={h.name} className="max-h-9 w-auto max-w-[130px] object-contain" />
          </li>
        ))}
      </ul>
      <div
        ref={track}
        onScroll={(e) => setPage(Math.round((e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.scrollWidth - e.currentTarget.clientWidth)) * (hubs.length - 1)))}
        className="-mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-4 [scrollbar-width:none]"
      >
        {hubs.map((h) => (
          <BrandBannerCard key={h.key} hub={h} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous hubs" className="flex size-10 items-center justify-center border border-foreground/25 hover:bg-foreground hover:text-background">
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex gap-1.5">
          {hubs.map((h, i) => (
            <span key={h.key} className={`h-1.5 transition-all ${i === page ? "w-6 bg-foreground" : "w-1.5 bg-foreground/25"}`} />
          ))}
        </div>
        <button type="button" onClick={() => scrollBy(1)} aria-label="Next hubs" className="flex size-10 items-center justify-center border border-foreground/25 hover:bg-foreground hover:text-background">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Listed partners, live inventory. Audience and view figures are modelled.</p>
    </div>
  );
}
