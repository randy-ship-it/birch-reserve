/** Primary self-serve buy CTA → /buy (Randy, Nov 19 2026 10:10 PM ET). One line, no jargon. */
import { ArrowRight } from "lucide-react";
import { CHECKOUT_TAGLINE } from "../../../../api-server/src/lib/checkoutCopy";
import { isScaleSkin } from "@/lib/siteSkin";

export const BUY_HREF = "/buy";

export function BuyCta({ placement, className = "", onClick }: { placement: string; className?: string; onClick?: () => void }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`} data-testid={`buy-cta-${placement}`}>
      <a
        href={`${BUY_HREF}?ref=${encodeURIComponent(placement)}`}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-lime-300 px-6 text-base font-bold text-[#0b1f3a] shadow-sm hover:bg-[#0b1f3a] hover:text-white"
        onClick={onClick}
        data-testid={`buy-cta-${placement}-link`}
      >
        Buy ads now <ArrowRight className="size-4" aria-hidden />
      </a>
      <span className="text-sm font-semibold text-[#0b1f3a]">{/* Scale skin speaks as Scale Health (same rename as the server-side scaleText). */}{isScaleSkin() ? CHECKOUT_TAGLINE.replace(/Buy Scale Health ads through Birch Reserve\./g, "Buy Scale Health ads.") : CHECKOUT_TAGLINE}</span>
    </div>
  );
}
