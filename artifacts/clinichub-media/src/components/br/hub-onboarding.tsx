import { HUB_ONBOARDING, onboardingWaived } from "../../../../api-server/src/lib/overhaul/brandIntake";

/** Short visual onboarding-fee note. The $5,000 shows struck through (waived) once the hub's modelled monthly views reach the 1MM+ tier, otherwise "may apply". */
export function HubOnboardingNote({ views, compact = false, dark = false }: { views: number; compact?: boolean; dark?: boolean }) {
  const waived = onboardingWaived(views);
  if (compact) {
    return (
      <p data-currency-fixed data-testid="hub-onboarding-chip" data-waived={waived ? "1" : "0"} className={`mt-3 text-[13px] ${dark ? "text-white/85" : "text-foreground/80"}`}>
        {waived ? <><s className={dark ? "text-white/55" : "text-foreground/45"} data-testid="hub-onboarding-struck">${HUB_ONBOARDING.feeUsd.toLocaleString("en-US")} USD</s> {HUB_ONBOARDING.chipLarge}</> : HUB_ONBOARDING.chipSmall}
      </p>
    );
  }
  return (
    <div data-currency-fixed data-testid="hub-onboarding" data-waived={waived ? "1" : "0"} className="mt-3 space-y-2 rounded-xl border border-foreground/10 bg-white px-3 py-3 text-sm">
      <p className="font-semibold text-[#0b1f3a]">{HUB_ONBOARDING.target}</p>
      <p className="text-muted-foreground">{waived ? <><s data-testid="hub-onboarding-struck" className="text-foreground/45">${HUB_ONBOARDING.feeUsd.toLocaleString("en-US")} USD</s> onboarding fee <strong className="text-[#0b1f3a]">waived</strong>. </> : null}{waived ? HUB_ONBOARDING.larger : HUB_ONBOARDING.smaller}</p>
      {waived ? null : <p className="text-xs text-muted-foreground">{HUB_ONBOARDING.larger}</p>}
    </div>
  );
}
