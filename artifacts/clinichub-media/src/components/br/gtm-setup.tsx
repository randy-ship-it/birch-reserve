/**
 * "B2B go-to-market, powered by Silver Birch Growth Inc." aside (replaces the former $3,500 GTM setup offer).
 * Copy lives in api-server/src/lib/overhaul/gtmSetup.ts.
 */
import { GTM_SETUP } from "../../../../api-server/src/lib/overhaul/gtmSetup";

export function GtmSetup({ where }: { where: "home" | "media_kit" | "intake" }) {
  return (
    <div className="rounded-3xl border border-[#0b1f3a]/10 bg-white p-5 shadow-sm md:p-8" data-testid={`gtm-setup-${where}`} id="gtm-setup">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/60" data-testid={`gtm-eyebrow-${where}`}>{GTM_SETUP.eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">{GTM_SETUP.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{GTM_SETUP.sub}</p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2" data-testid={`gtm-notes-${where}`}>
        {GTM_SETUP.notes.map((n) => (
          <li key={n} className="rounded-2xl border border-[#0b1f3a]/10 bg-[#0b1f3a]/[0.03] p-4 text-sm font-medium text-[#0b1f3a]">{n}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-foreground/60" data-testid={`gtm-separate-${where}`}>{GTM_SETUP.separate}</p>
    </div>
  );
}
