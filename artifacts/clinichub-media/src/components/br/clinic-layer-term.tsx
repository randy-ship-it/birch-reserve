/**
 * "Clinic layer" term with a quick visual reference (Randy, Nov 27 2026 call: rename user-facing "hub" to
 * "clinic layer" and show example clinic layers on hover so visitors get it at a glance).
 * Hover or focus opens it on desktop, tap opens it on touch. No brackets around names: the thumbnails carry the names.
 *
 * Pool (Randy, Nov 27 2026 7:14 PM ET): real, live clinic layers on scalehealth.ca that are not Align Network clinics,
 * shown two at a time and rotated per page view so it is never the same pair. Crops come from the live public pages
 * and were checked for "exclusive" text, Align branding and zero counts. Never add a never-mention name or an Align Network clinic.
 */
import { useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

export type ClinicLayerExample = { key: string; name: string; where: string; img: string; pos: string };
export const CLINIC_LAYER_POOL: ReadonlyArray<ClinicLayerExample> = [
  { key: "dima-lates", name: "Dima-lates", where: "Pilates · Ajax, ON", img: "/hub-gallery/thumbs/dima-lates-layer.webp", pos: "50% 50%" },
  { key: "sole", name: "SOLE", where: "Footwear brand", img: "/hub-gallery/thumbs/sole-layer.webp", pos: "0% 50%" },
  { key: "dr-ho", name: "DR-HO\u2019S", where: "Pain relief brand", img: "/hub-gallery/thumbs/drho-layer.webp", pos: "0% 0%" },
];

/** Two examples, rotated: a random pair per page view (stable while the page is open). */
export function pickClinicLayerExamples(n = 2, rand: () => number = Math.random): ClinicLayerExample[] {
  const pool = [...CLINIC_LAYER_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  return pool.slice(0, n);
}
let pageExamples: ClinicLayerExample[] | null = null;
const examplesForPage = () => (pageExamples ??= pickClinicLayerExamples());

const INK = "#0b1f3a";

export function ClinicLayerCard() {
  const [examples] = useState(examplesForPage);
  return (
    <div data-testid="clinic-layer-card" style={{ color: INK }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(11,31,58,.5)" }}>What&rsquo;s a clinic layer?</p>
      <p className="mt-1.5 text-[14px] leading-snug">A co-branded members&rsquo; storefront on Scale Health. Its audience books care and buys products there. Two live ones:</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {examples.map((x) => (
          <figure key={x.key} className="m-0">
            <div className="aspect-[4/3] overflow-hidden rounded-lg" style={{ background: "#eef1f4", border: "1px solid rgba(11,31,58,.12)" }}>
              <img src={x.img} alt={`${x.name} clinic layer`} loading="lazy" decoding="async" className="size-full object-cover" style={{ objectPosition: x.pos }} />
            </div>
            <figcaption className="mt-1.5">
              <span className="block text-[13px] font-semibold leading-tight">{x.name}</span>
              <span className="block text-[11px]" style={{ color: "rgba(11,31,58,.55)" }}>{x.where}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Inline term. `children` defaults to "clinic layer"; keeps the surrounding type style, adds a quiet dotted underline. */
export function ClinicLayerTerm({ children = "clinic layer", testId = "clinic-layer-term", className = "" }: { children?: ReactNode; testId?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const t = useRef<number | undefined>(undefined);
  const hover = (v: boolean) => { window.clearTimeout(t.current); t.current = window.setTimeout(() => setOpen(v), v ? 80 : 160); };
  const fine = () => typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          data-testid={testId}
          aria-label="What is a clinic layer? See two live examples"
          onMouseEnter={() => fine() && hover(true)}
          onMouseLeave={() => fine() && hover(false)}
          onClick={(e) => { e.stopPropagation(); }}
          className={`inline cursor-help appearance-none border-0 bg-transparent p-0 text-inherit [font:inherit] [letter-spacing:inherit] underline decoration-dotted decoration-[1.5px] underline-offset-[0.22em] transition-colors hover:decoration-solid focus-visible:rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 ${className}`}
          style={{ textDecorationColor: "color-mix(in srgb, currentColor 45%, transparent)" }}
        >
          {children}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          onMouseEnter={() => fine() && hover(true)}
          onMouseLeave={() => fine() && hover(false)}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-[80] w-[min(296px,calc(100vw-24px))] rounded-2xl bg-white p-3.5 text-left normal-case tracking-normal outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          style={{ boxShadow: "0 1px 2px rgba(11,31,58,.06), 0 12px 32px -8px rgba(11,31,58,.22)", border: "1px solid rgba(11,31,58,.08)", fontFamily: "inherit" }}
        >
          <ClinicLayerCard />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** For labels that sit inside a button (role cards): a separate quiet trigger under the card copy, outside the button. */
export function ClinicLayerPeek({ testId = "clinic-layer-peek" }: { testId?: string }) {
  return (
    <span className="mt-2 block pl-8 text-[12.5px] text-foreground/60">
      <ClinicLayerTerm testId={testId}>What&rsquo;s a clinic layer?</ClinicLayerTerm>
    </span>
  );
}
