/**
 * Where the brand sells and ships, per-channel availability, and the now-vs-later activation range
 * (Randy via Emma, Nov 18 2026 10:48 PM ET). All values are Estimate / Modelled. Friday's values are used
 * when present (v1.1); otherwise a labelled mock, modelled here from the shared config.
 */
import { useState } from "react";
import { CHANNEL_GEO, COUNTRY_LABEL, channelEligibility, parseRegions, type Country, type Eligibility, type Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { readActivation, type ActivationBlock } from "../../../../api-server/src/lib/kitCalc/activation";
import { EstimateTag } from "@/components/br/intake-kit";
import { trackIntake, type IntakeSide } from "@/lib/intakeTrack";

export const DEFAULT_MARKET: Market = { sells_in: [], ships_to: [] };
const CHOICES: Array<{ key: "CA" | "US" | "both"; label: string; c: Country[] }> = [
  { key: "CA", label: "Canada", c: ["CA"] },
  { key: "US", label: "USA", c: ["US"] },
  { key: "both", label: "Both", c: ["CA", "US"] },
];
const pickKey = (c: Country[]) => (c.length === 2 ? "both" : c[0] ?? null);

/** One question: where do you sell and ship? Plus optional provinces / states (codes only). */
export function MarketPicker({ value, onChange, side = "advertiser", compact = false }: { value: Market; onChange: (m: Market) => void; side?: IntakeSide; compact?: boolean }) {
  const [regionsText, setRegionsText] = useState((value.regions ?? []).join(", "));
  const [shipsSame, setShipsSame] = useState(true);
  const chips = (sel: Country[], set: (c: Country[]) => void, id: string) => (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" data-testid={id}>
      {CHOICES.map((o) => {
        const on = pickKey(sel) === o.key;
        return <button key={o.key} type="button" role="radio" aria-checked={on} data-testid={`${id}-${o.key}`} onClick={() => { trackIntake(side, "field_start", "market", { dedupe: true }); set(o.c); }} className={`h-11 rounded-xl text-sm font-bold transition ${on ? "bg-foreground text-background shadow" : "bg-foreground/[0.06] hover:bg-foreground/[0.1]"}`}>{o.label}</button>;
      })}
    </div>
  );
  return (
    <div data-testid="market-picker" className={compact ? "" : "rounded-2xl border border-foreground/10 bg-white/70 p-3"}>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-foreground/60">{side === "publisher" ? "Where is your hub's audience?" : "Where do you sell and ship?"}</span>
      <div className="mt-1">{chips(value.sells_in, (c) => onChange({ ...value, sells_in: c, ships_to: shipsSame ? c : value.ships_to }), "market-sells")}</div>
      {side === "advertiser" ? (
        <label className="mt-2 flex items-center gap-2 text-xs text-foreground/70">
          <input type="checkbox" checked={shipsSame} onChange={(e) => { setShipsSame(e.target.checked); if (e.target.checked) onChange({ ...value, ships_to: value.sells_in }); }} data-testid="market-ships-same" />
          I ship to the same places
        </label>
      ) : null}
      {side === "advertiser" && !shipsSame ? <div className="mt-2"><span className="block text-[11px] font-bold uppercase tracking-wider text-foreground/60">Ships to</span><div className="mt-1">{chips(value.ships_to, (c) => onChange({ ...value, ships_to: c }), "market-ships")}</div></div> : null}
      <input data-testid="market-regions" value={regionsText} onChange={(e) => { setRegionsText(e.target.value); onChange({ ...value, regions: parseRegions(e.target.value) }); }} onFocus={() => trackIntake(side, "field_start", "regions", { dedupe: true })} placeholder="Provinces / states, optional (e.g. ON, BC, NY)" aria-label="Provinces or states, optional" className="mt-2 h-10 w-full rounded-xl border border-foreground/20 bg-white px-3 text-sm outline-none focus:border-foreground" />
    </div>
  );
}

export const ELIG_LABEL: Record<Eligibility, string> = { now: "Available now", later: "Later", not_available: "Not in your markets yet" };

/** Friday's per-channel eligibility when present (v1.1), else the config. */
export function eligibilityOf(key: (typeof CHANNEL_GEO)[number]["key"], market: Market | null | undefined, friday?: Array<{ key: string; eligibility: Eligibility }>): { e: Eligibility; source: "friday" | "config" } {
  const g = CHANNEL_GEO.find((c) => c.key === key)!;
  const f = friday?.find((c) => c.key === g.friday_key || c.key === g.key);
  if (f && (f.eligibility === "now" || f.eligibility === "later" || f.eligibility === "not_available")) return { e: f.eligibility, source: "friday" };
  return { e: channelEligibility(key, market), source: "config" };
}

export function EligChip({ e, geo }: { e: Eligibility; geo: string }) {
  const tone = e === "now" ? "bg-lime-300 text-[#0b1f3a]" : e === "later" ? "bg-amber-200 text-amber-950" : "bg-white/20 text-white";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-testid={`elig-${e}`}>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}>{ELIG_LABEL[e]}</span>
      <span className="text-[10px] font-semibold text-white/75">{geo}</span>
    </span>
  );
}

const $ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Illustration for each end of the range: a few lit screens (now) vs the full network lit (later). */
function EndArt({ end }: { end: "now" | "later" }) {
  const lit = end === "now" ? 5 : 24;
  return (
    <svg viewBox="0 0 120 72" className="h-16 w-28" aria-hidden data-testid={`activation-art-${end}`}>
      <rect width="120" height="72" rx="10" fill="#0b1f3a" />
      {[...Array(24)].map((_, i) => {
        const x = 10 + (i % 8) * 13, y = 12 + Math.floor(i / 8) * 18;
        const on = i < lit;
        return <rect key={i} x={x} y={y} width="9" height="12" rx="2" fill={on ? "#d9f99d" : "#ffffff"} opacity={on ? 0.95 : 0.12} />;
      })}
    </svg>
  );
}

export type ActivationSource = "friday" | "mock" | "sample";
/** Now / minimum ← range bar → later / maximum. */
export function ActivationRange({ kind, block, source, testId }: { kind: "advertiser" | "publisher"; block: ActivationBlock; source: ActivationSource; testId?: string }) {
  const lo = block.now.min;
  const hi = Math.max(block.later.max, lo + 1);
  const pct = (n: number) => `${Math.min(100, Math.max(0, ((n - lo) / (hi - lo)) * 100))}%`;
  const per = block.period === "month" ? " / month" : block.period === "test" ? " per test" : "";
  const title = kind === "publisher" ? "Publisher monetization" : "Advertiser exposure value";
  const srcLabel = source === "friday" ? "From Friday" : source === "sample" ? "Sample · example values" : "Mock · modelled until Friday sends it";
  return (
    <section data-testid={testId ?? `activation-${kind}`} data-source={source} className="rounded-2xl border border-foreground/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-xl">{title}</h3>
        <EstimateTag />
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Modelled</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${source === "friday" ? "bg-lime-300 text-[#0b1f3a]" : "bg-violet-100 text-violet-900"}`} data-testid="activation-source">{srcLabel}</span>
      </div>
      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <figure className="m-0 text-center">
          <EndArt end="now" />
          <figcaption className="mt-1 text-[10px] font-bold uppercase tracking-wider text-foreground/60">Now · minimum</figcaption>
          <p className="font-display text-lg tabular-nums" data-testid="activation-now-min">{$(block.now.min)}</p>
        </figure>
        <div className="relative h-3 rounded-full bg-foreground/[0.08]" data-testid="activation-bar" aria-label={`${title}: ${$(block.now.min)} now to ${$(block.later.max)} later${per}, estimate`}>
          <div className="absolute inset-y-0 rounded-full bg-lime-300" style={{ left: pct(block.now.min), width: `calc(${pct(block.now.max)} - ${pct(block.now.min)})`, minWidth: 6 }} title="Now" />
          <div className="absolute inset-y-0 rounded-full bg-[#0b1f3a]/70" style={{ left: pct(block.later.min), width: `calc(${pct(block.later.max)} - ${pct(block.later.min)})`, minWidth: 6, top: 3, bottom: 3 }} title="Later" />
        </div>
        <figure className="m-0 text-center">
          <EndArt end="later" />
          <figcaption className="mt-1 text-[10px] font-bold uppercase tracking-wider text-foreground/60">Later · maximum</figcaption>
          <p className="font-display text-lg tabular-nums" data-testid="activation-later-max">{$(block.later.max)}</p>
        </figure>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Now {$(block.now.min)}–{$(block.now.max)}, later {$(block.later.min)}–{$(block.later.max)}{per} USD. {kind === "publisher" ? "Now = the surfaces you switched on; later = every surface live." : "Now = channels live in your markets today; later = channels as they open (e.g. Street Team: Ontario now, Canada later)."} Estimates, not guarantees.
      </p>
    </section>
  );
}

/** Friday's block when present and well-formed, else the modelled mock. */
export function pickActivation(friday: unknown, modelled: ActivationBlock): { block: ActivationBlock; source: "friday" | "mock" } {
  const f = readActivation(friday);
  return f ? { block: { ...f, period: f.period ?? modelled.period }, source: "friday" } : { block: modelled, source: "mock" };
}

export { COUNTRY_LABEL };
