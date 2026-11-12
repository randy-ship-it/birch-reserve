import { BRAND_HUBS, CLINIC_NETWORK, SLOTS, toCad, type Currency, type Hub } from "../../../../api-server/src/lib/overhaul/model";
import { useState } from "react";
import { Modelled } from "./ui";
import { PlacementDialog, PlacementTrigger, SLOT_TO_PLACEMENT, type PlacementKey } from "./placement-example";

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
  const corePackage = (h: Hub) => Math.max(currency === "cad" ? toCad(190) : 190, core.reduce((a, s) => a + slotPrice(h, s, currency), 0));
  const [ex, setEx] = useState<PlacementKey | null>(null);
  const label = (s: (typeof SLOTS)[number], cls = "") => {
    const k = SLOT_TO_PLACEMENT[s.key];
    return k ? <PlacementTrigger k={k} onOpen={setEx} className={cls}>{s.label}</PlacementTrigger> : s.label;
  };
  return (
    <div data-testid="rate-card">
      <p className="mb-3 text-xs text-muted-foreground">Tap or hover a placement to see an example inside a hub.</p>
      {/* Mobile: one card per hub (no sideways scroll) */}
      <div className="grid gap-3 md:hidden" data-testid="rate-card-mobile">
        {hubs.map((h) => (
          <article key={h.key} className="border border-foreground/15 bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-xl leading-tight">{h.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{h.category}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Core / mo</p>
                <p className="font-semibold">${corePackage(h).toLocaleString()} {currency.toUpperCase()}</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
              {core.map((s) => (
                <div key={s.key}>
                  <dt className="text-[11px] font-semibold leading-snug text-foreground/70">{label(s)}</dt>
                  <dd>{sponsorImps(h, s.key).toLocaleString()} views</dd>
                  <dd className="text-xs text-muted-foreground">${slotPrice(h, s, currency).toLocaleString()} · from ${s.cpmUsd} CPM USD</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-foreground">
            <th className="py-3 pr-3 font-semibold">Hub</th>
            {core.map((s) => (
              <th key={s.key} className="py-3 pr-3 font-semibold">
                {label(s)}
                <span className="block text-[11px] font-normal text-muted-foreground">from ${s.cpmUsd} CPM USD</span>
              </th>
            ))}
            <th className="py-3 font-semibold">Core package / mo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {hubs.map((h) => {
            const total = corePackage(h);
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
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Prices are starting-at (starter) rates from the <a href="/rates" className="underline underline-offset-2">rate card</a> <Modelled>Illustrative estimate</Modelled>: not sold rates or a quote; your insertion order sets the final rate. Views per month per sponsor position <Modelled />: one of five rotating positions (20% share of voice) at 75% availability. Hubs without their own feed row use the network median partner until their feed lands. Core package floor $190 USD / $270 CAD. Partner email and partner-site display are available on request.
      </p>
      <PlacementDialog open={ex} onClose={() => setEx(null)} />
    </div>
  );
}
