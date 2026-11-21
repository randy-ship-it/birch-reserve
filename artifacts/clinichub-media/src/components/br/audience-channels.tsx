/**
 * One audience framing, three channels, everywhere (Randy Nov 21 2026 1:00 PM).
 * Big number per tile, detail in an expander. Reach and audience, not delivered impressions.
 */
import { Globe2, Store, Home } from "lucide-react";
import { AUDIENCE_CHANNELS, AUDIENCE_FINE } from "../../../../api-server/src/lib/overhaul/brandIntake";

const ICONS = { "scale-hubs": Globe2, "retail-network": Store, "calm-street": Home } as const;
const MORE: Record<string, string> = {
  "scale-hubs": "Branded ScaleHealth.ca hubs are private, members-only pages where recovery and wellness customers already shop and book care. 700MM+ captive page views are activating as brand hubs go live.",
  "retail-network": "Our private network of fitness & recovery retailers in Canada and the USA: 200+ locations today and 500+ soon, with 1MM+ captive recovery consumers.",
  "calm-street": "Calm Joints is our owned digital clinic. Together with our Street Team Ambassadors on the ground, the plan is to reach 2MM+ homes by 2027.",
};

export function AudienceChannels({ testId = "audience-channels", dark = false }: { testId?: string; dark?: boolean }) {
  return (
    <div data-testid={testId}>
      <div className="grid gap-3 md:grid-cols-3">
        {AUDIENCE_CHANNELS.map((c) => {
          const Icon = ICONS[c.key];
          return (
            <div key={c.key} className={`rounded-2xl p-5 shadow-sm ${dark ? "bg-white/[0.06] text-white ring-1 ring-white/15" : "border border-[#0b1f3a]/10 bg-white text-[#0b1f3a]"}`} data-testid={`${testId}-${c.key}`}>
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${dark ? "text-lime-300" : "text-[#0E3B2A]"}`} aria-hidden />
                <span className={`text-[11px] font-bold uppercase tracking-[0.16em] ${dark ? "text-lime-300" : "text-[#0b1f3a]/70"}`}>{c.name}</span>
              </div>
              <p className="mt-3 font-display text-[2.8rem] leading-none tabular-nums md:text-5xl">{c.v}</p>
              <p className={`mt-1.5 text-sm leading-tight ${dark ? "text-white/75" : "text-foreground/75"}`}>{c.l}</p>
              <details className={`mt-3 text-[12px] ${dark ? "text-white/70" : "text-foreground/70"}`}>
                <summary className="cursor-pointer font-semibold">Details</summary>
                <p className="mt-1.5 leading-snug">{MORE[c.key]}</p>
              </details>
            </div>
          );
        })}
      </div>
      <p className={`mt-2 text-[11px] ${dark ? "text-white/60" : "text-foreground/60"}`}>{AUDIENCE_FINE}</p>
    </div>
  );
}
