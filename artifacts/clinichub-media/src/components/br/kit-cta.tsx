/**
 * The intake is the main thing on birchreserve.net (Randy via Emma, Nov 19 2026 8:35 AM ET). One high-contrast CTA
 * used in heroes, the nav and a sticky mobile bar. Every placement carries its own ?ref so clicks and arrivals show
 * up in share/referral tracking (lib/shareTrack.ts).
 */
import { ArrowRight, Sparkles } from "lucide-react";
import { logCtaClick } from "@/lib/shareTrack";

export const KIT_CTA_LABEL = "Get my Monetization Kit";
export const intakeHref = (ref: string) => `/intake?ref=${encodeURIComponent(ref)}`;

export function KitCta({ placement, size = "lg", tone = "lime", label = KIT_CTA_LABEL, sub, className = "", testId }: { placement: string; size?: "sm" | "md" | "lg"; tone?: "lime" | "ink"; label?: string; sub?: string | null; className?: string; testId?: string }) {
  const h = size === "lg" ? "h-14 px-7 text-base md:text-lg" : size === "md" ? "h-12 px-5 text-base" : "h-9 px-3.5 text-sm";
  const colors = tone === "lime" ? "bg-lime-300 text-[#0b1f3a] shadow-lime-400/40 hover:bg-white" : "bg-[#0b1f3a] text-white shadow-black/20 hover:bg-lime-300 hover:text-[#0b1f3a]";
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <a href={intakeHref(placement)} onClick={() => logCtaClick(placement)} data-testid={testId ?? `kit-cta-${placement}`} className={`group inline-flex items-center justify-center gap-2 rounded-full font-bold shadow-lg ring-2 ring-[#0b1f3a]/10 transition ${h} ${colors}`}>
        <Sparkles className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
        {label}
        <ArrowRight className={`${size === "sm" ? "size-4" : "size-5"} transition-transform group-hover:translate-x-0.5`} aria-hidden />
      </a>
      {sub === null ? null : sub ? <span className="text-xs opacity-75">{sub}</span> : null}
    </span>
  );
}

/** Sticky bottom bar on phones (hidden on the intake itself, private reports and staff pages). */
export function StickyKitCta({ path }: { path: string }) {
  if (/^\/(intake|kit\/r|sales|sign-in|sign-up|success)(\/|$)/.test(path)) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#0b1f3a]/10 bg-[#0b1f3a]/95 px-4 py-2.5 backdrop-blur lg:hidden print:hidden" data-testid="sticky-kit-cta" style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
      <a href={intakeHref("sticky_mobile")} onClick={() => logCtaClick("sticky_mobile")} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime-300 text-base font-bold text-[#0b1f3a]">
        <Sparkles className="size-5" aria-hidden />{KIT_CTA_LABEL}<ArrowRight className="size-5" aria-hidden />
      </a>
    </div>
  );
}
