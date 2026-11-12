import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

/** The five rate-card surfaces (same keys as RATE_SURFACES in overhaul/pricing.ts). */
export type PlacementKey = "landing" | "dashboard" | "products" | "services" | "post_purchase";

/** Per-hub kit slots (sponsorKit SLOTS) → the surface example that shows them. */
export const SLOT_TO_PLACEMENT: Record<string, PlacementKey> = {
  hub_hero: "landing",
  member_dashboard: "dashboard",
  product_services: "products",
  thank_you: "post_purchase",
};

const COPY: Record<PlacementKey, { title: string; caption: string }> = {
  landing: { title: "Hub landing banner and tiles", caption: "A banner under the hub header and native tiles on the co-branded hub home, before login." },
  dashboard: { title: "Member dashboard tile", caption: "A native tile next to a logged-in member's orders, plans and bookings." },
  products: { title: "Product page unit", caption: "A sponsored card in the product grid while members shop." },
  services: { title: "Services and booking unit", caption: "A native unit on a service or booking page, beside the time picker." },
  post_purchase: { title: "Post-purchase thank-you", caption: "A splash on the order or booking confirmation page, right after checkout." },
};

function Badge() {
  return <span className="rounded-sm bg-foreground px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-background">Example placement</span>;
}

/** The highlighted "your ad here" box drawn inside each example. */
function Unit({ className = "", label = "Your brand" }: { className?: string; label?: string }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-md border-2 border-dashed border-emerald-600 bg-emerald-50/95 px-2 py-1.5 text-emerald-900 shadow-sm ${className}`}>
      <span className="min-w-0 truncate text-[10px] font-semibold leading-tight">{label}</span>
      <span className="shrink-0 rounded-sm bg-emerald-700 px-1 text-[8px] font-semibold uppercase tracking-wider text-white">Sponsored</span>
    </div>
  );
}

/** Mock hub chrome for the examples we have no screenshot for. */
function HubFrame({ children, tabs }: { children: ReactNode; tabs?: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-foreground/15 bg-white text-left">
      <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
        <span className="text-[10px] font-semibold text-foreground/70">Partner brand × Scale Health</span>
        <span className="h-4 w-12 rounded-sm bg-foreground/10" />
      </div>
      {tabs ? <div className="flex gap-3 border-b border-foreground/10 px-3 py-1.5 text-[9px] text-foreground/55">{tabs.split("|").map((t, i) => <span key={t} className={i === 0 ? "font-semibold text-foreground" : ""}>{t}</span>)}</div> : null}
      <div className="p-3">{children}</div>
    </div>
  );
}
const Bar = ({ w = "w-full", h = "h-2" }: { w?: string; h?: string }) => <div className={`${w} ${h} rounded-sm bg-foreground/10`} />;

function Shot({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-foreground/15 bg-muted">
      <img src={src} alt={alt} loading="lazy" decoding="async" className="block h-auto w-full" width={1280} height={760} />
      {children}
    </div>
  );
}

export function PlacementVisual({ k }: { k: PlacementKey }) {
  switch (k) {
    case "landing":
      return (
        <Shot src="/hub-gallery/integrity.webp" alt="Integrity Fitness × Scale Health hub home page, with an example banner and tile drawn on top">
          <Unit className="absolute left-[4%] right-[4%] top-[14%] py-2" label="Your brand · hub banner" />
          <Unit className="absolute bottom-[6%] left-[6%] w-[36%]" label="Your brand · native tile" />
        </Shot>
      );
    case "products":
      return (
        <Shot src="/hub-proof/roll-marketplace-grid.webp" alt="ROLL Recovery member marketplace product grid, with an example sponsored card drawn on top">
          <div className="absolute bottom-[3%] right-[15%] w-[17%] rounded-md border-2 border-dashed border-emerald-600 bg-emerald-50/95 p-1.5 text-emerald-900 shadow">
            <div className="aspect-[4/3] w-full rounded-sm bg-emerald-200/70" />
            <p className="mt-1 truncate text-[9px] font-semibold">Your product</p>
            <span className="rounded-sm bg-emerald-700 px-1 text-[7px] font-semibold uppercase tracking-wider text-white">Sponsored</span>
          </div>
        </Shot>
      );
    case "dashboard":
      return (
        <HubFrame tabs="Dashboard|Marketplace|Services|Guidance">
          <p className="text-[11px] font-semibold">Welcome back</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["Orders", "Plan", "Bookings"].map((t) => (
              <div key={t} className="rounded-md border border-foreground/10 p-2"><p className="text-[9px] text-foreground/55">{t}</p><Bar w="w-2/3" h="h-3" /></div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
            <div className="space-y-1.5 rounded-md border border-foreground/10 p-2"><p className="text-[9px] text-foreground/55">Recent activity</p><Bar /><Bar w="w-4/5" /><Bar w="w-3/5" /></div>
            <div className="flex flex-col rounded-md border-2 border-dashed border-emerald-600 bg-emerald-50 p-2 text-emerald-900">
              <div className="aspect-[3/2] w-full rounded-sm bg-emerald-200/70" />
              <p className="mt-1 text-[10px] font-semibold">Your brand · native tile</p>
              <span className="mt-0.5 self-start rounded-sm bg-emerald-700 px-1 text-[8px] font-semibold uppercase tracking-wider text-white">Sponsored</span>
            </div>
          </div>
        </HubFrame>
      );
    case "services":
      return (
        <HubFrame tabs="Services|Dashboard|Marketplace">
          <p className="text-[11px] font-semibold">Book a 1:1 virtual session</p>
          <div className="mt-2 grid grid-cols-[1.3fr_1fr] gap-2">
            <div className="rounded-md border border-foreground/10 p-2">
              <p className="text-[9px] text-foreground/55">Pick a time</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1">{Array.from({ length: 6 }, (_, i) => <div key={i} className={`h-4 rounded-sm ${i === 1 ? "bg-foreground/70" : "bg-foreground/10"}`} />)}</div>
              <div className="mt-2 h-5 rounded-sm bg-foreground/80" />
            </div>
            <div className="flex flex-col rounded-md border-2 border-dashed border-emerald-600 bg-emerald-50 p-2 text-emerald-900">
              <div className="aspect-[3/2] w-full rounded-sm bg-emerald-200/70" />
              <p className="mt-1 text-[10px] font-semibold">Your brand · booking unit</p>
              <span className="mt-0.5 self-start rounded-sm bg-emerald-700 px-1 text-[8px] font-semibold uppercase tracking-wider text-white">Sponsored</span>
            </div>
          </div>
        </HubFrame>
      );
    case "post_purchase":
      return (
        <HubFrame>
          <div className="text-center">
            <p className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs text-white">✓</p>
            <p className="mt-1 text-[11px] font-semibold">Thanks, your order is confirmed</p>
            <div className="mx-auto mt-1 w-1/2 space-y-1"><Bar /><Bar w="w-3/4 mx-auto" /></div>
          </div>
          <div className="mt-3 rounded-md border-2 border-dashed border-emerald-600 bg-emerald-50 p-2 text-emerald-900">
            <div className="flex items-center gap-2">
              <div className="h-12 w-20 shrink-0 rounded-sm bg-emerald-200/70" />
              <div className="min-w-0"><p className="text-[10px] font-semibold">Your brand · thank-you splash</p><p className="text-[9px] opacity-80">Your offer and link</p></div>
              <span className="ml-auto shrink-0 rounded-sm bg-emerald-700 px-1 text-[8px] font-semibold uppercase tracking-wider text-white">Sponsored</span>
            </div>
          </div>
        </HubFrame>
      );
  }
}

function Body({ k }: { k: PlacementKey }) {
  const c = COPY[k];
  const shot = k === "landing" || k === "products";
  return (
    <div>
      <PlacementVisual k={k} />
      <div className="mt-2 flex items-center gap-2"><Badge /><span className="text-[11px] text-muted-foreground">{shot ? "Drawn on a real hub screenshot" : "Mockup of a hub page"}</span></div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.caption} Illustration only: creative and exact position are set in your insertion order.</p>
    </div>
  );
}

/** One dialog per card: bottom sheet under md, centred modal on desktop. Esc, overlay click and the close button all close it. */
export function PlacementDialog({ open, onClose }: { open: PlacementKey | null; onClose: () => void }) {
  return (
    <Dialog open={open !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      {open ? (
        <DialogContent
          data-testid="placement-dialog"
          className="bottom-0 top-auto max-h-[88vh] max-w-none translate-y-0 rounded-t-xl p-4 pb-20 data-[state=open]:slide-in-from-top-[100%] sm:rounded-t-xl md:bottom-auto md:top-[50%] md:max-w-2xl md:translate-y-[-50%] md:rounded-lg md:p-6 md:pb-6"
        >
          <DialogTitle className="pr-8 font-display text-xl font-normal">{COPY[open].title}</DialogTitle>
          <DialogDescription className="sr-only">Example placement: {COPY[open].caption}</DialogDescription>
          <Body k={open} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

/** Surface label: hover (desktop pointer) previews the example; click or Enter opens the full pop-out. */
export function PlacementTrigger({ k, onOpen, children, className = "" }: { k: PlacementKey; onOpen: (k: PlacementKey) => void; children: ReactNode; className?: string }) {
  const [hover, setHover] = useState(false);
  return (
    <HoverCard open={hover} onOpenChange={setHover} openDelay={250} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          data-placement={k}
          aria-haspopup="dialog"
          onClick={(e) => { e.stopPropagation(); setHover(false); onOpen(k); }}
          className={`group text-left underline decoration-foreground/25 decoration-dotted underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 ${className}`}
        >
          {children}
          <span className="ml-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-emerald-700 no-underline">See example</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="hidden w-[420px] p-3 md:block" data-testid="placement-hover">
        <p className="mb-2 text-sm font-semibold">{COPY[k].title}</p>
        <Body k={k} />
      </HoverCardContent>
    </HoverCard>
  );
}
