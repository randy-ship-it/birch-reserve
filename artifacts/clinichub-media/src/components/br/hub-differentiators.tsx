import { HeartPulse, Handshake } from "lucide-react";
import { skinText } from "@/lib/siteSkin";

/** Randy's two differentiators (Nov 22 2026 9:48 AM ET), shown short and visual on the hub sections. Brand name goes through skinText (Scale voice). */
export const HUB_DIFFERENTIATORS = [
  { key: "clinic", title: "A clinic layer built into the network", body: "Clinics are vertically integrated with the retail network, so your members can go from a product to care and back again." },
  { key: "performance", title: "Brands that pay on results", body: "Performance-based partnerships: brands pay when offers drive clicks and orders, based on signed partnership contracts. Estimates here, not guarantees." },
] as const;

export function HubDifferentiators({ dark = false }: { dark?: boolean }) {
  const Icon = { clinic: HeartPulse, performance: Handshake } as const;
  return (
    <ul data-testid="hub-differentiators" className="grid gap-2 sm:grid-cols-2">
      {HUB_DIFFERENTIATORS.map((d) => {
        const I = Icon[d.key];
        return (
          <li key={d.key} data-testid={`differentiator-${d.key}`} className={`flex items-start gap-3 rounded-2xl p-3 ${dark ? "bg-white/[0.08] text-white" : "border border-foreground/10 bg-white text-foreground"}`}>
            <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${dark ? "bg-lime-300 text-[#0b1f3a]" : "bg-lime-200 text-[#0b1f3a]"}`}><I className="size-4" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-snug">{skinText(d.title)}</span>
              <span className={`mt-0.5 block text-xs leading-snug ${dark ? "text-white/75" : "text-muted-foreground"}`}>{skinText(d.body)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
