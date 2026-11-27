/**
 * Scale-skin lockup (Randy t427u, Nov 21 2026 5:36 PM): Scale Health primary, Birch Reserve smaller (~65% height), one
 * line introducing Birch Reserve as Scale Health's exclusive ad unit. Used on scalehealth.ca/intake/reel only.
 */
import scaleLogo from "@assets/brand/scalehealth-logo-srgb-v2.png";
import birchReserveMark from "@assets/brand/birch-reserve-mark-v2.svg";

export const SCALE_AD_UNIT_LINE = "Birch Reserve is Scale Health's ad unit, across Recovery and every Scale category.";

export function ScaleAdUnitLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 ${className}`} data-testid="scale-ad-unit">
      <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1" aria-label="Scale Health, ads by Birch Reserve">
        <img src={scaleLogo} alt="Scale Health" width={354} height={68} className="h-[26px] w-auto sm:h-[30px]" data-testid="scale-ad-unit-scale" />
        <span aria-hidden className="h-5 w-px bg-foreground/20" />
        <span className="flex items-center gap-1.5 whitespace-nowrap" data-testid="scale-ad-unit-birch">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/50">Ads by</span>
          <img src={birchReserveMark} alt="" aria-hidden width={20} height={20} className="h-[17px] w-[17px] sm:h-5 sm:w-5" />
          <span className="whitespace-nowrap font-display text-[15px] italic sm:text-[17px] leading-none text-[#0b1f3a]">Birch Reserve</span>
        </span>
      </div>
      <p className="text-[13px] leading-snug text-foreground/70 sm:border-l sm:border-foreground/15 sm:pl-4" data-testid="scale-ad-unit-line">{SCALE_AD_UNIT_LINE}</p>
    </div>
  );
}
