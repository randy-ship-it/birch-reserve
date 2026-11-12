import { BRAND_HUBS, CLINIC_NETWORK, SLOTS, toCad, type Currency, type Hub } from "../../../../api-server/src/lib/overhaul/model";
import { Modelled } from "./ui";

const SOV = 0.2;
const AVAIL = 0.75;
export function sponsorImps(h: Hub, key: (typeof SLOTS)[number]["key"]) {
  return Math.round((h.views[key] * AVAIL * SOV) / 100) * 100;
}
export function slotPrice(h: Hub, s: (typeof SLOTS)[number], currency: Currency) {
  const usd = Math.max(10, Math.round((sponsorImps(h, s.key) * s.cpmUsd) / 1000 / 10) * 10);
  return currency === "cad" ? toCad(usd) : usd;
}

/** Per-hub rate card (same model as /kit and /sponsor) at starter CPMs from overhaul/pricing.ts. One sponsor position = 20% share of voice at 75% availability. */
export function RateCard({ currency }: { currency: Currency }) {
  const hubs: Hub[] = [...BRAND_HUBS, CLINIC_NETWORK];
  const core = SLOTS.filter((s) => s.core);
  return (
    <div className="overflow-x-auto" data-testid="rate-card">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-foreground">
            <th className="py-3 pr-3 font-semibold">Hub</th>
            {core.map((s) => (
              <th key={s.key} className="py-3 pr-3 font-semibold">
                {s.label}
                <span className="block text-[11px] font-normal text-muted-foreground">from ${s.cpmUsd} CPM USD</span>
              </th>
            ))}
            <th className="py-3 font-semibold">Core package / mo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {hubs.map((h) => {
            const total = Math.max(currency === "cad" ? toCad(190) : 190, core.reduce((a, s) => a + slotPrice(h, s, currency), 0));
            return (
              <tr key={h.key}>
                <td className="py-3 pr-3">
                  <span className="font-medium">{h.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{h.category}</span>
                </td>
                {core.map((s) => (
                  <td key={s.key} className="py-3 pr-3">
                    {sponsorImps(h, s.key).toLocaleString()} views
                    <span className="block text-xs text-muted-foreground">${slotPrice(h, s, currency).toLocaleString()}</span>
                  </td>
                ))}
                <td className="py-3 font-semibold">${total.toLocaleString()} {currency.toUpperCase()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Prices are starting-at (starter) rates from the <a href="/rates" className="underline underline-offset-2">rate card</a> <Modelled>Illustrative estimate</Modelled>: not sold rates or a quote; your insertion order sets the final rate. Views per month per sponsor position <Modelled />: one of five rotating positions (20% share of voice) at 75% availability. Hubs without their own feed row use the network median partner until their feed lands. Core package floor $190 USD / $270 CAD. Partner email and partner-site display are available on request.
      </p>
    </div>
  );
}
