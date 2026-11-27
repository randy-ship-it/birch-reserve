/**
 * "Clinic layer" term with a quick visual reference (Randy, Nov 27 2026 call: rename user-facing "hub" to
 * "clinic layer" and show example hubs on hover so visitors get it at a glance).
 * Hover or focus opens it on desktop, tap opens it on touch. Only real, live examples: Integrity Fitness and
 * Dima-lates (both verified live on scalehealth.ca). No brackets around names: the thumbnails carry the names.
 */
import { useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

export const CLINIC_LAYER_EXAMPLES = [
  { name: "Integrity Fitness", where: "Fitness · live", img: "/hub-gallery/thumbs/integrity.webp", pos: "50% 0%" },
  { name: "Dima-lates", where: "Pilates · Ajax, ON", img: "/hub-gallery/dima-lates.webp", pos: "50% 25%" },
] as const;

const INK = "#0b1f3a";

export function ClinicLayerCard() {
  return (
    <div data-testid="clinic-layer-card" style={{ color: INK }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(11,31,58,.5)" }}>What&rsquo;s a clinic layer?</p>
      <p className="mt-1.5 text-[14px] leading-snug">A co-branded members&rsquo; storefront on Scale Health. Its audience books care and buys products there. Two live ones:</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {CLINIC_LAYER_EXAMPLES.map((x) => (
          <figure key={x.name} className="m-0">
            <div className="aspect-[4/3] overflow-hidden rounded-lg" style={{ background: "#eef1f4", boxShadow: "inset 0 0 0 1px rgba(11,31,58,.08)" }}>
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
          className={`inline cursor-help appearance-none border-0 bg-transparent p-0 text-inherit [font:inherit] [letter-spacing:inherit] underline decoration-dotted decoration-[1.5px] underline-offset-[0.22em] transition-colors hover:decoration-solid focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
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

/** For labels that sit inside a button (role cards): a separate small trigger with the two thumbnails, outside the button. */
export function ClinicLayerPeek({ testId = "clinic-layer-peek" }: { testId?: string }) {
  return (
    <span className="mt-2.5 flex items-center gap-2 pl-8 text-[12px] text-foreground/60">
      <span className="flex -space-x-1.5" aria-hidden>
        {CLINIC_LAYER_EXAMPLES.map((x) => (
          <img key={x.name} src={x.img} alt="" className="size-5 rounded-full object-cover ring-2 ring-white" style={{ objectPosition: x.pos }} loading="lazy" />
        ))}
      </span>
      <ClinicLayerTerm testId={testId}>What&rsquo;s a clinic layer?</ClinicLayerTerm>
    </span>
  );
}
