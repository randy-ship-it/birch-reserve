/**
 * The report's two views (Randy, Nov 19 2026 9:39 AM ET): one form, both answers.
 *   (a) Supplier exposure view, performance-only terms (pay on results, no CPC/CPM) vs with Accelerate (premium display, optional).
 *   (b) Hub max-exposure + earnings view.
 * Every number is derived from existing model inputs only:
 *   - network figures and targets (CHANNEL_TILES / activation.ts FIG, as reported by Scale Health),
 *   - the placeholder activation shares (MOCK_SHARES 1%–5%, or Friday's `exposure.activation` when present),
 *   - rate-card CPMs (report placements) for Accelerate display views per $1,000,
 *   - the hub surface model (PUBLISHER_SURFACES median views, 35% base share) or Friday's publisher figures.
 * Tiers are a modelling choice on the placeholder range: performance-only = lower half (min → mid share),
 * Accelerate = upper half (mid → max share). Low / likely / high = the ends and middle of each half.
 * Labelled Estimate / Modelled everywhere. USD. No CTR/ROAS, no guarantees.
 */
import { useState, type ReactNode } from "react";
import { Check, Rocket, Store, Package } from "lucide-react";
import { RT, RT_SERIF, RT_SANS, RT_SHADOW } from "@/lib/reportTokens";
import type { FridayExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import { MOCK_SHARES } from "../../../../api-server/src/lib/kitCalc/activation";
import { PAYOUT, PUBLISHER_SURFACES, RETAIL_COPY, RETAIL_TAG, STREET_REACH_LINE } from "../../../../api-server/src/lib/overhaul/brandIntake";
import type { ReportModel } from "@/components/br/report-v2";
import { Details } from "@/components/br/details";
import { useCurrency } from "@/lib/currency";
import { SELL_ASSUMPTION_PCT } from "../../../../api-server/src/lib/overhaul/agencyShowcase";
import { CAD_PER_USD } from "../../../../api-server/src/lib/overhaul/model";
import { IN_LOCATION, inLocationReach, type PhysicalAnswer } from "../../../../api-server/src/lib/overhaul/inLocation";

/** In-location display (Randy, Nov 19 2026 10:54 AM ET): the brand's own locations × monthly visitors. Estimate; no rate
 * is invented (priced by IO, the same per-door economics as Street Team). */
export function InLocationRow({ physical, testId }: { physical: PhysicalAnswer | null | undefined; testId: string }) {
  const r = inLocationReach(physical);
  if (!r) return null;
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 px-3 py-2.5 text-[13px] md:grid-cols-[1.3fr_1fr_1fr]" style={{ borderTop: `1px solid ${RT.line}`, background: "#F3FBF6" }} data-testid={testId}>
      <span className="min-w-0"><span className="font-semibold" style={{ color: RT.ink }}>{IN_LOCATION.name}</span><span className="block text-[11px]" style={{ color: RT.mute }}>{IN_LOCATION.unit}{r.locations ? ` · ${r.locations.toLocaleString("en-US")} location${r.locations === 1 ? "" : "s"}` : ""}</span></span>
      <span className="text-right tabular-nums"><span className="text-[17px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{big(r.monthlyVisits)}</span><span className="block text-[10px] font-bold uppercase tracking-wider" style={{ color: RT.mintInk }}>Estimate</span></span>
      <span className="col-span-2 text-[11px] md:col-span-1 md:text-right" style={{ color: RT.mute }}>{IN_LOCATION.pricing} · from your numbers</span>
    </div>
  );
}

type LoHi = { low: number; high: number };
type LLH = { low: number; likely: number; high: number };
const card = { background: RT.surface, border: `1px solid ${RT.line}`, borderRadius: 24, boxShadow: RT_SHADOW } as const;
const eyebrow = "text-[11px] font-bold uppercase tracking-[0.14em]";
export const big = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}MM` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.round(n)));
export const usd = (n: number) => (n >= 1e5 ? `$${Math.round(n / 1e3).toLocaleString("en-US")}K` : `$${(n >= 1e4 ? Math.round(n / 10) * 10 : Math.round(n)).toLocaleString("en-US")}`);
const llh = (lo: number, hi: number): LLH => ({ low: lo, likely: (lo + hi) / 2, high: hi });
const scale = (r: LLH, f: number): LLH => ({ low: r.low * f, likely: r.likely * f, high: r.high * f });

/* ------------------------------------------------------------------ model */
const NAMES: Record<string, { name: string; unit: string; monthly: boolean }> = {
  hubs: { name: "Branded ScaleHealth.ca hubs", unit: "page views", monthly: true },
  retail: { name: "Private retail network", unit: "your slice of the 1MM+ captive recovery consumers", monthly: false },
  street_team: { name: "Calm Joints + Street Team", unit: "homes", monthly: false },
  calm_joints: { name: "Calm Joints", unit: "", monthly: false },
};
const ORDER = ["hubs", "retail", "street_team", "calm_joints"];
/** performance_only = performance-only TERMS (pay on results, no CPC/CPM), not a kind of brand. */
export type Tier = "performance_only" | "accelerate";
export type ChannelRow = { key: string; name: string; unit: string; monthly: boolean; geo: string; range: LLH | null; later: LLH | null; note: string | null };

export function sharesOf(ex: FridayExposure) {
  const a = ex.activation ?? MOCK_SHARES;
  const min = a.min_share, max = a.max_share, mid = (min + max) / 2;
  return { min, mid, max, placeholder: a.placeholder !== false };
}
/** Channel rows for one tier: base figure (= channel now.min ÷ min share) × the tier's share band. */
/** Street Team row note: text reach, never a homes figure (Randy, Nov 19 2026 2:27 PM ET). */
export const STREET_ROW_NOTE = "2MM+ homes by 2027, based on signed partnership contracts";

export function channelRows(ex: FridayExposure, tier: Tier): ChannelRow[] {
  const s = sharesOf(ex);
  const [lo, hi] = tier === "performance_only" ? [s.min, s.mid] : [s.mid, s.max];
  return ORDER.map((key) => {
    const c = ex.channels.find((x) => x.key === key);
    const n = NAMES[key]!;
    if (key === "street_team") {
      // Street Team: text reach only ("2MM+ homes reached by 2027"), never a homes figure.
      // Shown as text, never as a homes figure (Randy, Nov 19 2026 2:27 PM ET).
      const range = null;
      const later = null;
      const note = !c?.eligible_now ? (c?.reason ?? "Not in your markets yet") : STREET_ROW_NOTE;
      return { key, name: n.name, unit: n.unit, monthly: n.monthly, geo: c?.geo_label ?? "", range, later, note };
    }
    const base = c?.now ? c.now.min / s.min : null;
    const baseLater = c?.later ? c.later.min / s.min : null;
    const range = base && base > 0 ? llh(base * lo, base * hi) : null;
    const later = baseLater && base && baseLater > base ? llh(baseLater * lo, baseLater * hi) : null;
    const note = c?.needs_figure ? "2MM+ homes by 2027, based on signed partnership contracts" : !c?.eligible_now ? (c?.reason ?? "Not in your markets yet") : null;
    return { key, name: n.name, unit: n.unit, monthly: n.monthly, geo: c?.geo_label ?? "", range, later, note };
  });
}
/** Accelerate display: views a $1,000 test buys at the report's rate-card CPM (views = budget ÷ CPM × 1,000). */
export function displayPer1k(cpm: LoHi | null): LLH | null {
  if (!cpm || !(cpm.low > 0)) return null;
  return llh(1e6 / cpm.high, 1e6 / cpm.low);
}
/** The hub's own surfaces (network median hub, modelled): surfaces on by default vs every surface with views. */
export function ownHubViews(): { on: number; all: number } {
  const on = PUBLISHER_SURFACES.filter((s) => s.defaultOn && s.monthlyViews).reduce((a, s) => a + (s.monthlyViews ?? 0), 0);
  const all = PUBLISHER_SURFACES.filter((s) => s.monthlyViews).reduce((a, s) => a + (s.monthlyViews ?? 0), 0);
  return { on, all };
}

/* ------------------------------------------------------------------ primitives */
const Pill = ({ children, tone = "model" }: { children: ReactNode; tone?: "model" | "mint" }) => (
  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={tone === "mint" ? { background: RT.mint, color: RT.forest } : { background: RT.track, color: RT.mute }}>{children}</span>
);
function Headline({ value, unit, range, fmt, dark, testId }: { value: number; unit: string; range: LLH; fmt: (n: number) => string; dark?: boolean; testId: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-[52px] leading-none tabular-nums md:text-[64px]" style={{ fontFamily: RT_SERIF, color: dark ? "#fff" : RT.ink }}>{fmt(value)}</p>
      <p className="mt-1 text-[13px] font-semibold" style={{ color: dark ? RT.mint : RT.mintInk }}>{unit}</p>
      <LowLikelyHigh r={range} fmt={fmt} dark={dark} />
    </div>
  );
}
function LowLikelyHigh({ r, fmt, dark }: { r: LLH; fmt: (n: number) => string; dark?: boolean }) {
  const c = dark ? "rgba(255,255,255,.7)" : RT.mute;
  return (
    <dl className="mt-2 flex gap-4 text-[12px] tabular-nums" style={{ color: c }} data-testid="llh">
      <div><dt className="inline">Low </dt><dd className="inline font-bold" style={{ color: dark ? "#fff" : RT.ink }}>{fmt(r.low)}</dd></div>
      <div><dt className="inline">Likely </dt><dd className="inline font-bold" style={{ color: dark ? "#fff" : RT.ink }}>{fmt(r.likely)}</dd></div>
      <div><dt className="inline">High </dt><dd className="inline font-bold" style={{ color: dark ? "#fff" : RT.ink }}>{fmt(r.high)}</dd></div>
    </dl>
  );
}
function ChannelTable({ rows, extra, testId }: { rows: ChannelRow[]; extra?: ReactNode; testId: string }) {
  return (
    <div className="mt-4 overflow-hidden" style={{ border: `1px solid ${RT.line}`, borderRadius: 14 }} data-testid={testId}>
      <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider md:grid-cols-[1.3fr_1fr_1fr]" style={{ background: RT.paper, color: RT.mute }}>
        <span>By channel</span><span className="text-right">Monthly · low–high</span><span className="hidden text-right md:block">12 months · likely</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[1fr_auto] items-baseline gap-2 px-3 py-2.5 text-[13px] md:grid-cols-[1.3fr_1fr_1fr]" style={{ borderTop: `1px solid ${RT.line}` }} data-testid={`${testId}-${r.key}`}>
          <span className="min-w-0">
            <span className="font-semibold" style={{ color: RT.ink }}>{r.name}</span>
            <span className="block text-[11px]" style={{ color: RT.mute }}>{r.key === "street_team" ? "homes · " : r.unit ? `${r.unit}${r.monthly ? " / month" : " in reach"} · ` : ""}{r.geo}</span>
          </span>
          {r.range ? (
            <>
              <span className="text-right tabular-nums" style={{ color: RT.ink }}><span className="text-[17px]" style={{ fontFamily: RT_SERIF }}>{big(r.range.likely)}</span><span className="block text-[11px]" style={{ color: RT.mute }}>{big(r.range.low)}–{big(r.range.high)}</span></span>
              <span className="col-span-2 text-[11px] md:col-span-1 md:text-right md:text-[13px]" style={{ color: RT.mute }}>
                <span className="md:hidden">12 months: </span>
                {r.monthly ? <span className="font-semibold tabular-nums" style={{ color: RT.ink }}>{big(r.range.likely * 12)}</span> : <span>same audience, all year</span>}
                {r.later && r.monthly ? <span className="block text-[11px]">2027 target: {big(r.later.likely)} / mo</span> : null}
              </span>
            </>
          ) : (
            <span className="col-span-2 min-w-0 text-left text-[12px] md:text-right" style={{ color: RT.mute }}>{r.note ?? "Counted with the Street Team"}</span>
          )}
        </div>
      ))}
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------ (a) supplier exposure view */
export function SupplierExposureView({ m, exposure, source, cta, onAccelerate, physical }: { m: ReportModel; exposure: FridayExposure; source: "report" | "mock" | "sample"; cta?: ReactNode; onAccelerate?: ReactNode; physical?: PhysicalAnswer | null }) {
  const [tier, setTier] = useState<Tier>(m.isAccelerate ? "accelerate" : "performance_only");
  const perf = channelRows(exposure, "performance_only");
  const acc = channelRows(exposure, "accelerate");
  const rows = tier === "accelerate" ? acc : perf;
  const hubs = rows.find((r) => r.key === "hubs")?.range ?? null;
  const reach = rows.filter((r) => !r.monthly && r.range).reduce((a, r) => ({ low: a.low + r.range!.low, likely: a.likely + r.range!.likely, high: a.high + r.range!.high }), { low: 0, likely: 0, high: 0 });
  const disp = tier === "accelerate" ? displayPer1k(m.cpm) : null;
  const own = ownHubViews();
  const s = sharesOf(exposure);
  const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;
  return (
    <section data-testid="view-supplier" data-tier={tier} className="overflow-hidden" style={{ ...card, fontFamily: RT_SANS, color: RT.body }}>
      <div className="p-5 md:p-6" style={{ background: RT.forest, color: "#fff" }}>
        <div className="flex flex-wrap items-center gap-2">
          <Package className="size-4" style={{ color: RT.mint }} aria-hidden />
          <span className={eyebrow} style={{ color: RT.mint }}>Supplier · exposure view</span>
          <span className="ml-auto"><Pill tone="mint">Estimate</Pill></span>
        </div>
        <h3 className="mt-3 text-[26px] leading-tight md:text-[32px]" style={{ fontFamily: RT_SERIF }}>Where your products get seen</h3>
        <div className="mt-4 grid w-full grid-cols-2 rounded-full p-1 sm:inline-grid sm:w-auto" style={{ background: "rgba(255,255,255,.1)" }} role="tablist" aria-label="Supplier tier">
          {(["performance_only", "accelerate"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tier === t} onClick={() => setTier(t)} data-testid={`supplier-tier-${t}`} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition sm:px-4" style={tier === t ? { background: RT.mint, color: RT.forest } : { color: "rgba(255,255,255,.75)" }}>
              {(t === "accelerate") === m.isAccelerate ? <Check className="size-3.5" aria-hidden /> : t === "accelerate" ? <Rocket className="size-3.5" aria-hidden /> : null}{t === "performance_only" ? "Performance-only" : "With Accelerate"}{(t === "accelerate") === m.isAccelerate ? <span className="sr-only"> (your pick)</span> : null}
            </button>
          ))}
        </div>
        {hubs ? (
          <div className="mt-5" data-testid="supplier-headline-wrap">
            <Headline value={hubs.likely} unit="page-view exposures a month, likely" range={hubs} fmt={big} dark testId="supplier-headline-month" />
            <p className="mt-2 text-[13px] text-white/75" data-testid="supplier-headline-year">About {big(hubs.likely * 12)} over 12 months at that run-rate.</p>
          </div>
        ) : null}
        {reach.likely > 0 ? <p className="mt-4 text-[14px] text-white/85" data-testid="supplier-reach">Plus about <strong className="text-white">{big(reach.likely)}</strong> captive recovery consumers across our private retail network (200+ locations, 500+ soon), plus Calm Joints and the Street Team, {STREET_REACH_LINE}.</p> : null}
      </div>
      <div className="p-5 md:p-6">
        <Details label="By channel" testId="supplier-channels-details">
        <ChannelTable
          rows={rows}
          testId="supplier-channels"
          extra={
            <>
              {disp ? (
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 px-3 py-2.5 text-[13px] md:grid-cols-[1.3fr_1fr_1fr]" style={{ borderTop: `1px solid ${RT.line}`, background: "#F3FBF6" }} data-testid="supplier-channels-display">
                  <span><span className="font-semibold" style={{ color: RT.ink }}>Premium display · Accelerate</span><span className="block text-[11px]" style={{ color: RT.mute }}>extra views per $1,000 test · rate-card CPM</span></span>
                  <span className="text-right tabular-nums"><span className="text-[17px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{big(disp.likely)}</span><span className="block text-[11px]" style={{ color: RT.mute }}>{big(disp.low)}–{big(disp.high)}</span></span>
                  <span className="col-span-2 text-[11px] md:col-span-1 md:text-right" style={{ color: RT.mute }}>per test, scales with budget</span>
                </div>
              ) : null}
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 px-3 py-2.5 text-[13px] md:grid-cols-[1.3fr_1fr_1fr]" style={{ borderTop: `1px solid ${RT.line}`, background: m.isPublisher ? "#F3FBF6" : undefined }} data-testid="supplier-channels-own-hub">
                <span><span className="font-semibold" style={{ color: RT.ink }}>{m.isPublisher ? "Your own hub" : "Add your hub"}</span><span className="block text-[11px]" style={{ color: RT.mute }}>views / month on your own surfaces · typical hub, modelled</span></span>
                <span className="text-right tabular-nums"><span className="text-[17px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{big(own.on)}</span><span className="block text-[11px]" style={{ color: RT.mute }}>up to {big(own.all)}</span></span>
                <span className="col-span-2 text-[11px] md:col-span-1 md:text-right" style={{ color: RT.mute }}>{m.isPublisher ? "max exposure: on" : "unlocks max exposure"}</span>
              </div>
              <InLocationRow physical={physical} testId="supplier-channels-in-location" />
            </>
          }
        />
        </Details>
        <Details label="How we estimate this" testId="supplier-details">
              <p>Exposure = network figures and targets × an activation share, scoped to where you sell and ship. Activation shares are placeholders ({pct(s.min)}–{pct(s.max)}) until real placements confirm them.</p>
              <p><strong>Performance-only</strong> (pay on results, no CPC/CPM) uses the lower half of that range ({pct(s.min)}–{pct(s.mid)}). You pay on results, not for ad space.</p>
              {tier === "accelerate" ? <p><strong>Accelerate</strong> adds premium display placements, modelled as the upper half ({pct(s.mid)}–{pct(s.max)}), plus the display views a $1,000 test buys at rate-card CPM (budget ÷ CPM × 1,000).</p> : <p><strong>Accelerate</strong> (optional) adds premium display placements, modelled as the upper half ({pct(s.mid)}–{pct(s.max)}). Switch to With Accelerate to see how it is sized.</p>}
              <p>12 months = the monthly figure × 12 for page views. Customers and doors are an audience in reach, so they are not multiplied.</p>
              <p style={{ color: RT.mute }}>Network figures as reported by Scale Health; targets are goals. Estimates in USD where money is shown. Not a forecast or a promise of any result.</p>
            
          <p>{RETAIL_COPY} · {RETAIL_TAG}. Estimates, not guarantees.</p>
        </Details>
        {onAccelerate && !m.isAccelerate ? <div className="mt-4">{onAccelerate}</div> : null}
        {cta ? <div className="mt-4">{cta}</div> : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ (b) hub max-exposure + earnings view */
/**
 * Hub earnings calculator (Randy, Nov 21 2026 9:37 PM ET: "these #s are low and I don't know what they're from"):
 * one big number, one "based on X views a month" line, two controls (hub size, surfaces on). Same model as the
 * hub intake (PUBLISHER_SURFACES x rate-card starter CPMs x 20% planning sell-through x 35% base share), computed here
 * so the number moves live. Low / likely / high flex the two things that are genuinely uncertain: how much of the
 * space is sold (10% / 20% / 30%, around the 20% planning assumption) and the CPM inside the published starter range.
 * The model runs in USD; a Canadian visitor sees it converted at the site's 1.4 CAD per USD (not just relabelled).
 */
const HUB_SIZES = [0.25, 0.5, 1, 2, 3, 5, 7.5, 10] as const;
export const HUB_DEFAULT_SIZE_IDX = 2; // 1x = the network median hub
const SELL_BAND = [SELL_ASSUMPTION_PCT / 2, SELL_ASSUMPTION_PCT, SELL_ASSUMPTION_PCT * 1.5] as const;
const hubMid = (r: readonly [number, number]) => (r[0] + r[1]) / 2;
const PRICED = PUBLISHER_SURFACES.filter((s) => s.monthlyViews && s.cpm);
/** Pure model: monthly payout (USD) for a hub of `sizeX` x the median hub with the given surfaces on. */
export function hubEarnings(sizeX: number, on: Record<string, boolean>): { low: number; likely: number; high: number; views: number; rows: Array<{ key: string; label: string; on: boolean; likely: number; views: number }> } {
  const share = PAYOUT.basePct / 100;
  const pay = (views: number, pct: number, cpm: number) => (views * pct / 100 / 1000) * cpm * share;
  const rows = PRICED.map((s) => {
    const views = Math.round((s.monthlyViews ?? 0) * sizeX);
    const isOn = on[s.key] ?? false;
    return { s, views, isOn };
  });
  let low = 0, likely = 0, high = 0, views = 0;
  for (const r of rows) {
    if (!r.isOn) continue;
    low += pay(r.views, SELL_BAND[0], r.s.cpm![0]);
    likely += pay(r.views, SELL_BAND[1], hubMid(r.s.cpm!));
    high += pay(r.views, SELL_BAND[2], r.s.cpm![1]);
    views += r.views;
  }
  return { low, likely, high, views, rows: rows.map((r) => ({ key: r.s.key, label: r.s.label, on: r.isOn, views: r.views, likely: pay(r.views, SELL_BAND[1], hubMid(r.s.cpm!)) })) };
}
const money = (n: number, cad: boolean) => {
  const v = cad ? n * CAD_PER_USD : n;
  return `$${(v >= 1e4 ? Math.round(v / 10) * 10 : Math.round(v)).toLocaleString("en-US")}`;
};
const compact = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}MM` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

export function HubView({ cta, exposure, m, physical }: { m: ReportModel; exposure: FridayExposure; cta?: ReactNode; physical?: PhysicalAnswer | null }) {
  const { currency } = useCurrency();
  const cad = currency === "cad";
  const cur = cad ? "CAD" : "USD";
  const [sizeIdx, setSizeIdx] = useState<number>(HUB_DEFAULT_SIZE_IDX);
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(PRICED.map((s) => [s.key, true])));
  const sizeX = HUB_SIZES[sizeIdx]!;
  const e = hubEarnings(sizeX, on);
  const rows = channelRows(exposure, m.isAccelerate ? "accelerate" : "performance_only");
  const orders = Math.round((PUBLISHER_SURFACES.find((s) => s.key === "post_purchase")?.monthlyViews ?? 0) * sizeX);
  const anyOn = e.views > 0;
  const top = Math.max(1, ...e.rows.map((r) => r.likely));
  const axis = Math.max(1, e.high * 1.08);
  const perSurface = [...e.rows].sort((a, b) => b.views * 1 - a.views * 1);
  return (
    <section data-testid="view-hub" data-currency-fixed className="overflow-hidden" style={{ ...card, fontFamily: RT_SANS, color: RT.body }}>
      <div className="p-5 md:p-6" style={{ background: "#0B1F3A", color: "#fff" }}>
        <div className="flex flex-wrap items-center gap-2">
          <Store className="size-4 text-lime-300" aria-hidden />
          <span className={eyebrow} style={{ color: "#BEF264" }}>Your hub</span>
          <span className="ml-auto"><Pill tone="mint">Estimate · {cur}</Pill></span>
        </div>
        <h3 className="mt-3 text-[26px] leading-tight md:text-[32px]" style={{ fontFamily: RT_SERIF }}>What your hub could earn</h3>
        <div className="mt-4" data-testid="hub-headline-month" aria-live="polite">
          <p className="text-[56px] leading-none tabular-nums md:text-[72px]" style={{ fontFamily: RT_SERIF }}>{anyOn ? money(e.likely, cad) : "—"}</p>
          <p className="mt-1 text-[14px] font-semibold" style={{ color: RT.mint }}>{anyOn ? "a month, likely" : "Turn on a surface to see an estimate"}</p>
          {anyOn ? (
            <>
              <p className="mt-2 text-[13px] text-white/85" data-testid="hub-basis">Based on {compact(e.views)} views a month at a hub with about {compact(orders)} orders a month. Range {money(e.low, cad)}–{money(e.high, cad)}.</p>
              <div className="relative mt-3 h-2.5 rounded-full" style={{ background: "rgba(255,255,255,.14)" }} data-testid="hub-range-bar" role="img" aria-label={`Range ${money(e.low, cad)} to ${money(e.high, cad)} a month, likely ${money(e.likely, cad)}`}>
                <span className="absolute inset-y-0 rounded-full" style={{ left: `${(e.low / axis) * 100}%`, width: `${((e.high - e.low) / axis) * 100}%`, background: RT.mint, opacity: 0.55 }} />
                <span className="absolute -top-1 w-1.5 rounded-full bg-white" style={{ left: `calc(${(e.likely / axis) * 100}% - 3px)`, height: 18 }} />
              </div>
              <p className="mt-3 text-[13px] text-white/75" data-testid="hub-headline-year">About {money(e.likely * 12, cad)} over 12 months at that run-rate.</p>
            </>
          ) : null}
        </div>
      </div>
      <div className="p-5 md:p-6">
        <div data-testid="hub-controls">
          <label htmlFor="hub-size" className="flex items-baseline justify-between gap-3 text-[13px] font-bold" style={{ color: RT.ink }}>
            <span>How big is your hub?</span>
            <span className="tabular-nums font-semibold" style={{ color: RT.mintInk }} data-testid="hub-size-label">about {compact(orders)} orders a month{sizeX === 1 ? " (typical)" : ""}</span>
          </label>
          <input id="hub-size" data-testid="hub-size-slider" type="range" min={0} max={HUB_SIZES.length - 1} step={1} value={sizeIdx} onChange={(ev) => setSizeIdx(Number(ev.target.value))} aria-valuetext={`${compact(orders)} orders a month`} className="mt-2 h-8 w-full" style={{ accentColor: "#0b1f3a" }} />
          <div className="flex justify-between text-[11px]" style={{ color: RT.mute }}><span>Smaller</span><span>Larger</span></div>
          <p className="mt-4 text-[13px] font-bold" style={{ color: RT.ink }}>Where we show offers</p>
          <ul className="mt-2 space-y-1.5" data-testid="hub-surfaces">
            {perSurface.map((r) => (
              <li key={r.key}>
                <button type="button" role="switch" aria-checked={r.on} onClick={() => setOn((o) => ({ ...o, [r.key]: !r.on }))} data-testid={`hub-surface-${r.key}`} className="grid min-h-11 w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-2 text-left" style={{ background: r.on ? "#F3FBF6" : RT.paper, border: `1px solid ${r.on ? RT.mint : RT.line}` }}>
                  <span className="grid size-5 place-items-center rounded-md" style={{ background: r.on ? "#0b1f3a" : "#fff", border: `1.5px solid ${r.on ? "#0b1f3a" : RT.line}` }} aria-hidden>{r.on ? <Check className="size-3.5 text-white" /> : null}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold" style={{ color: RT.ink }}>{r.label}</span>
                    <span className="mt-1 block h-1.5 rounded-full" style={{ background: RT.track }}><span className="block h-full rounded-full" style={{ width: `${r.on ? Math.max(3, (r.likely / top) * 100) : 0}%`, background: RT.mintInk }} /></span>
                  </span>
                  <span className="text-right text-[13px] tabular-nums" style={{ color: r.on ? RT.ink : RT.mute }}>{r.on ? `${money(r.likely, cad)}/mo` : "off"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Details label="How we estimate this" testId="hub-details">
          <p><strong>Your share:</strong> {PAYOUT.basePct}% of the media revenue from offers shown on your hub. Higher tiers aren't set yet.</p>
          <p><strong>Views:</strong> a typical hub (the network median, modelled) scaled by the size slider. Your real numbers replace these once you share them.</p>
          <p><strong>Revenue:</strong> views × the share of space sold ({SELL_BAND[0]}–{SELL_BAND[2]}%, around a {SELL_BAND[1]}% planning assumption) × the published starter price per 1,000 views for that surface, then your {PAYOUT.basePct}%. Low uses the low end of both, high the top end, likely the middle.</p>
          <p>The newsletter carries a single published price, so it moves with how much is sold, not with price.</p>
          <p>{cad ? "Shown in CAD, converted from our USD model at 1.4 CAD per USD." : "Shown in USD."} A planning estimate, not a quote, a forecast or a guaranteed payout.</p>
        </Details>
        <Details label="Your products across the network" testId="hub-network">
          <p>{RETAIL_COPY} · {RETAIL_TAG}. Estimates, not guarantees.</p>
          <ChannelTable rows={rows} testId="hub-channels" extra={<InLocationRow physical={physical} testId="hub-channels-in-location" />} />
        </Details>
        {cta ? <div className="mt-4">{cta}</div> : null}
      </div>
    </section>
  );
}
