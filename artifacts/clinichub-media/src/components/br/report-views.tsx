/**
 * The report's two views (Randy, Nov 19 2026 9:39 AM ET): one form, both answers.
 *   (a) Supplier exposure view, performance-only terms (pay on results, no CPC/CPM) vs with Accelerate (premium display, optional).
 *   (b) Hub max-exposure + earnings view.
 * Every number is derived from existing model inputs only:
 *   - network figures and targets (CHANNEL_TILES / activation.ts FIG, as reported by Scale Health),
 *   - the placeholder activation shares (MOCK_SHARES 1%–5%, or Friday's `exposure.activation` when present),
 *   - rate-card CPMs (report placements) for Accelerate display views per $1,000,
 *   - the hub surface model (PUBLISHER_SURFACES median views, 70% base share) or Friday's publisher figures.
 * Tiers are a modelling choice on the placeholder range: performance-only = lower half (min → mid share),
 * Accelerate = upper half (mid → max share). Low / likely / high = the ends and middle of each half.
 * Labelled Estimate / Modelled everywhere. USD. No CTR/ROAS, no guarantees.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Rocket, Store, Package } from "lucide-react";
import { RT, RT_SERIF, RT_SANS, RT_SHADOW } from "@/lib/reportTokens";
import type { FridayExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import { MOCK_SHARES } from "../../../../api-server/src/lib/kitCalc/activation";
import { PUBLISHER_SURFACES, RETAIL_COPY, RETAIL_TAG, STREET_REACH_LINE } from "../../../../api-server/src/lib/overhaul/brandIntake";
import type { ReportModel } from "@/components/br/report-v2";
import { Details } from "@/components/br/details";
import { useCurrency } from "@/lib/currency";
import { CART_PRESETS, COMPARE_SOURCES, DEFAULT_INPUTS, EMAIL, SELL_BAND, SENDS_PER_MONTH, defaultVisitors, estimateHub, type Level } from "../../../../api-server/src/lib/overhaul/hubEstimate";
import { HubDifferentiators } from "@/components/br/hub-differentiators";
import { HubOnboardingNote } from "@/components/br/hub-onboarding";
import { PERFORMANCE_RANGES } from "../../../../api-server/src/lib/overhaul/proofContent";
import { saveHubEstimate } from "@/lib/hubEstimateNote";
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

/* ------------------------------------------------------------------ (b) hub earnings: simple form in, big numbers out */
const num = (v: string) => { const n = Number(v.replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };
const grp = (n: number) => Math.round(n).toLocaleString("en-US");
const compact = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}MM` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.round(n)));
const mny = (n: number, cad: boolean) => { const v = cad ? n * CAD_PER_USD : n; return `$${(v >= 1e4 ? Math.round(v / 10) * 10 : Math.round(v)).toLocaleString("en-US")}`; };
/** Count-up that eases to the target, skipping motion when the visitor prefers reduced motion. */
function useCountUp(target: number): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { from.current = target; setV(target); return; }
    const start = performance.now(), a = from.current, dur = 700;
    let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / dur); const e = 1 - Math.pow(1 - k, 3); const cur = a + (target - a) * e; from.current = cur; setV(cur); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}
const GREEN = "#4ADE80";
const field = "mt-1 h-12 w-full rounded-xl border bg-white px-3 text-[17px] font-semibold tabular-nums";
const seg = (on: boolean) => ({ background: on ? "#0b1f3a" : "#fff", color: on ? "#fff" : RT.ink, border: `1.5px solid ${on ? "#0b1f3a" : RT.line}` });

export function HubView({ cta, split = false }: { m?: ReportModel; exposure?: FridayExposure; cta?: ReactNode; physical?: PhysicalAnswer | null; split?: boolean }) {
  const { currency } = useCurrency();
  const cad = currency === "cad";
  const [orders, setOrders] = useState("25,000");
  const [visitors, setVisitors] = useState("");
  const [news, setNews] = useState(true);
  const [list, setList] = useState("120,000");
  const [locations, setLocations] = useState("");
  const [cart, setCart] = useState<number>(DEFAULT_INPUTS.cart);
  const [custom, setCustom] = useState("");
  const [level, setLevel] = useState<Level>("typical");
  const cartVal = custom.trim() ? num(custom) : cart;
  const cartUsd = cad ? cartVal / CAD_PER_USD : cartVal; // the cart is entered in the visitor's currency; the model runs in USD
  const inp = { orders: num(orders), visitors: visitors.trim() ? num(visitors) : null, newsletter: news, list: num(list), cart: cartUsd, level };
  const o = estimateHub(inp);
  const has = o.views > 0;
  useEffect(() => { saveHubEstimate({ orders: inp.orders, visitors: inp.visitors ?? defaultVisitors(inp.orders), newsletterList: news ? inp.list : 0, locations: locations.trim() ? num(locations) : null, cart: cartVal, level, likelyMonthlyUsd: o.earn.likely, lowUsd: o.earn.low, highUsd: o.earn.high, currency }); });
  const month = useCountUp(has ? o.earn.likely : 0);
  const year = useCountUp(has ? o.year : 0);
  const claim = () => { const el = document.querySelector<HTMLElement>('[data-testid="intake-email"]') ?? document.querySelector<HTMLElement>('[data-testid="intake-website"]'); el?.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => el?.focus({ preventScroll: true }), 450); };
  const levels: Array<[Level, string]> = [["low", "Low"], ["typical", "Typical"], ["high", "High"]];
  const ctrB = PERFORMANCE_RANGES.rows[0]!.ctr, cvB = PERFORMANCE_RANGES.rows[0]!.conversion;
  const chain: Array<[string, string, string]> = [
    ["Views", compact(o.views), "page views and email opens a month"],
    ["Clicks", compact(o.clicks), `about ${+o.ctrPct.toFixed(1)}% click on offers shown`],
    ["Orders", compact(o.orders), `${+o.convPct.toFixed(1)}% of clicks`],
    ["Sales for brands", mny(o.sales, cad), `at a $${grp(cartVal)} order`],
  ];
  return (
    <section data-testid="view-hub" data-currency-fixed className={split ? "overflow-hidden lg:contents" : "overflow-hidden"} style={{ ...card, fontFamily: RT_SANS, color: RT.body }}>
      <div className={`p-5 md:p-6 ${split ? "lg:rounded-3xl lg:border lg:bg-white lg:shadow-md" : ""}`} style={split ? { borderColor: RT.line, fontFamily: RT_SANS, color: RT.body } : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <Store className="size-4" style={{ color: RT.mintInk }} aria-hidden />
          <span className={eyebrow} style={{ color: RT.mintInk }}>Your hub</span>
        </div>
        <h3 className="mt-2 text-[26px] leading-tight md:text-[32px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>See what your hub could earn</h3>
        <p className="mt-1 text-[14px]">Four quick answers. The number updates as you type.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2" data-testid="hub-form">
          <label className="block text-[13px] font-bold" style={{ color: RT.ink }}>Orders or bookings a month
            <input data-testid="hub-orders" inputMode="numeric" className={field} style={{ borderColor: RT.line }} value={orders} onChange={(e) => setOrders(e.target.value)} onBlur={() => setOrders(grp(num(orders)))} />
          </label>
          <label className="block text-[13px] font-bold" style={{ color: RT.ink }}>Website visitors a month <span className="font-normal" style={{ color: RT.mute }}>(optional)</span>
            <input data-testid="hub-visitors" inputMode="numeric" className={field} style={{ borderColor: RT.line }} placeholder={grp(defaultVisitors(num(orders)))} value={visitors} onChange={(e) => setVisitors(e.target.value)} onBlur={() => visitors.trim() && setVisitors(grp(num(visitors)))} />
          </label>
          <div className="text-[13px] font-bold" style={{ color: RT.ink }}>Do you send a newsletter?
            <div className="mt-1 grid grid-cols-2 gap-2" role="group" aria-label="Newsletter">
              {([[true, "Yes"], [false, "No"]] as const).map(([v, l]) => <button key={l} type="button" aria-pressed={news === v} onClick={() => setNews(v)} data-testid={`hub-news-${l.toLowerCase()}`} className="h-12 rounded-xl text-[15px] font-bold" style={seg(news === v)}>{l}</button>)}
            </div>
            {news ? <input data-testid="hub-list" aria-label="Email list size" inputMode="numeric" className={field} style={{ borderColor: RT.line }} value={list} onChange={(e) => setList(e.target.value)} onBlur={() => setList(grp(num(list)))} placeholder="List size" /> : null}
            {news ? <span className="mt-1 block text-[11px] font-normal" style={{ color: RT.mute }}>Email list size. We assume {SENDS_PER_MONTH} sends a month and about a third opened.</span> : null}
          </div>
          <label className="block text-[13px] font-bold" style={{ color: RT.ink }}>Locations <span className="font-normal" style={{ color: RT.mute }}>(optional)</span>
            <input data-testid="hub-locations" inputMode="numeric" className={field} style={{ borderColor: RT.line }} placeholder="e.g. 3" value={locations} onChange={(e) => setLocations(e.target.value)} />
            <span className="mt-1 block text-[11px] font-normal" style={{ color: RT.mute }}>In-location screens are priced separately, so they are not in this number.</span>
          </label>
        </div>
        <div className="mt-4" data-testid="hub-cart">
          <p className="text-[13px] font-bold" style={{ color: RT.ink }}>Average order value</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {CART_PRESETS.map((c) => <button key={c} type="button" aria-pressed={!custom.trim() && cart === c} onClick={() => { setCart(c); setCustom(""); }} data-testid={`hub-cart-${c}`} className="h-12 min-w-[4.25rem] rounded-xl px-3 text-[15px] font-bold" style={seg(!custom.trim() && cart === c)}>${c}</button>)}
            <input data-testid="hub-cart-custom" aria-label="Custom average order value" inputMode="numeric" placeholder="Custom" className="h-12 w-28 rounded-xl border bg-white px-3 text-[15px] font-semibold" style={{ borderColor: custom.trim() ? "#0b1f3a" : RT.line }} value={custom} onChange={(e) => setCustom(e.target.value)} />
          </div>
          <p className="mt-3 text-[13px] font-bold" style={{ color: RT.ink }}>How well do offers perform?</p>
          <div className="mt-1 grid grid-cols-3 gap-2 sm:max-w-sm" role="group" aria-label="Performance level">
            {levels.map(([k, l]) => <button key={k} type="button" aria-pressed={level === k} onClick={() => setLevel(k)} data-testid={`hub-level-${k}`} className="h-12 rounded-xl text-[15px] font-bold" style={seg(level === k)}>{l}</button>)}
          </div>
        </div>
      </div>
      <div className={`p-5 md:p-6 ${split ? "lg:col-span-2 lg:rounded-3xl lg:p-8" : ""}`} style={{ background: "#0B1F3A", color: "#fff", ...(split ? { fontFamily: RT_SANS } : {}) }} data-testid="hub-result" aria-live="polite">
      <div className={split ? "lg:grid lg:grid-cols-2 lg:gap-x-12" : undefined}>
      <div>
        <div className="flex items-center gap-2"><span className={eyebrow} style={{ color: GREEN }}>You could earn</span><span className="ml-auto"><Pill tone="mint">Estimate · {cad ? "CAD" : "USD"}</Pill></span></div>
        <div data-testid="hub-headline-month">
          <p className="mt-2 text-[64px] font-bold leading-none tabular-nums md:text-[88px]" style={{ fontFamily: RT_SERIF, color: GREEN, textShadow: "0 0 32px rgba(74,222,128,.45)" }}>{has ? mny(month, cad) : "—"}</p>
          <p className="mt-1 text-[16px] font-semibold">a month</p>
        </div>
        {has ? (
          <>
            <p className="mt-3 text-[28px] leading-none tabular-nums md:text-[36px]" style={{ fontFamily: RT_SERIF, color: GREEN }} data-testid="hub-headline-year">{mny(year, cad)} <span className="text-[16px] font-semibold text-white">a year</span></p>
            <ul className="mt-4 space-y-1.5 text-[15px] font-semibold" data-testid="hub-lines">
              <li>That's {mny(o.year, cad)} a year from space you already have.</li>
              <li>Your hub could help drive about {mny(o.sales, cad)} a month in sales for brands.</li>
              <li>Brands pay for the space. You keep {o.sharePct}% of that media revenue.</li>
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="hub-chain">
              {chain.map(([t, v, sub], n) => (
                <div key={t} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.08)" }} data-testid={`hub-chain-${n}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">{t}</p>
                  <p className="mt-1 text-[28px] leading-none tabular-nums" style={{ fontFamily: RT_SERIF }}>{v}</p>
                  <p className="mt-1 text-[11px] text-white/70">{sub}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-white/70">Views, then clicks, then orders, then sales. Your earnings come from the space brands pay for, not from their sales.</p>
          </>
        ) : <p className="mt-3 text-[15px] text-white/85">Add your orders or visitors to see an estimate.</p>}
      </div>
      <div>
        {has ? (
          <>
            <button type="button" onClick={claim} data-testid="hub-claim" className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-full px-6 text-[17px] font-bold md:w-auto" style={{ background: "#BEF264", color: "#0b1f3a" }}>Claim my kit</button>
            <p className="mt-3 text-[12px] text-white/70" data-testid="hub-range">Range {mny(o.earn.low, cad)}–{mny(o.earn.high, cad)} a month.</p>
          </>
        ) : null}
        {has ? <HubOnboardingNote views={o.views} compact dark /> : null}
        {has ? <div className="mt-4"><HubDifferentiators dark /></div> : null}
        <Details dark label="How we estimate this" testId="hub-details">
          <p><strong className="text-white">Views</strong> come from your answers: orders = thank-you and confirmation page views; visitors drive hub home, product and services pages; returning members follow orders; email views are opens = list × {SENDS_PER_MONTH} sends × a {Math.round((EMAIL.openRate.lo + EMAIL.openRate.hi) / 2)}% open rate (midpoint of public health and fitness benchmarks).</p>
          <p><strong className="text-white">Earnings</strong> = views × the share of space sold ({SELL_BAND[0]}–{SELL_BAND[2]}%, midpoint {SELL_BAND[1]}%: from our {SELL_BAND[0]}% ramp assumption up to the bottom of the 60–80% direct sell-through target Google News Initiative cites) × the published starter price per 1,000 views × your {o.sharePct}% share (70% under 1MM views a month, 75% at 1MM+, 80% at 3MM+, 85% at 5MM+, a flat rate at the tier you reach). The range uses the low and high ends of both. Brand sales are value for brands and are not added to your earnings.</p>
          <p><strong className="text-white">Clicks and orders</strong> apply only to the offers actually shown, so the click rate is on that share of views, not on all of them. Thank-you and confirmation pages average our post-purchase and thank-you ranges ({ctrB.lo}–{ctrB.hi}% and {PERFORMANCE_RANGES.rows[1]!.ctr.lo}–{PERFORMANCE_RANGES.rows[1]!.ctr.hi}% clicks, {cvB.lo}–{cvB.hi}% and {PERFORMANCE_RANGES.rows[1]!.conversion.lo}–{PERFORMANCE_RANGES.rows[1]!.conversion.hi}% conversion). Hub home, dashboard, product and services pages use the activation range ({PERFORMANCE_RANGES.rows[2]!.ctr.lo}–{PERFORMANCE_RANGES.rows[2]!.ctr.hi}% clicks, {PERFORMANCE_RANGES.rows[2]!.conversion.lo}–{PERFORMANCE_RANGES.rows[2]!.conversion.hi}% conversion). Email uses health and fitness benchmarks of {EMAIL.clickPerSend.lo}–{EMAIL.clickPerSend.hi}% clicks per send and {EMAIL.openRate.lo}–{EMAIL.openRate.hi}% opens, and assumes one sponsored slot gets {EMAIL.slotShare.lo}–{EMAIL.slotShare.hi}% of an email's clicks (our assumption). Sales = orders × your average order value.</p>
          <p data-testid="hub-compare"><strong className="text-white">Compared with typical publisher earnings:</strong> this works out to about ${(o.earn.likely / Math.max(1, o.views) * 1000).toFixed(2)} per 1,000 views ({o.surfaces[0] && o.surfaces[0].views > 0 ? `about $${(o.surfaces[0].earn / o.surfaces[0].views).toFixed(3)} per order on thank-you pages` : "thank-you pages need orders"}). Full-page programmatic ads on health and wellness sites typically pay $14–45 per 1,000 pageviews across every ad unit (Ezoic, Mediavine, Raptive; more cautious estimates start near $5–9), direct-sold display about $10–20 CPM at 60–80% sold, Rokt Thanks reports $0.20–0.60 per order to merchants, and wellness newsletters about $15 per 1,000 opens. Your Birch placements are extra, brand-priced units set so brands can earn back about 2.5× at typical performance, and your {o.sharePct}% share sits inside what networks pay publishers (Rokt Thanks 50%, AdSense about 68%, Mediavine and Raptive 75% and up), but Birch placements are priced for brand return rather than open-auction demand, so this still sits below ad-network averages. Estimates, not quotes.</p>
          <p className="text-[11px]">Sources: {[...EMAIL.sources, ...COMPARE_SOURCES].map((x, i) => <span key={x.url}>{i ? "; " : ""}<a href={x.url} target="_blank" rel="noopener noreferrer" className="underline">{x.label}</a></span>)}.</p>
          <p>Every figure is monthly; a year is 12 months at that run-rate. {cad ? "Shown in CAD, converted from our USD model at 1.4 CAD per USD." : "Shown in USD."} A planning estimate, not a quote, forecast or guarantee.</p>
        </Details>
        {cta ? <div className="mt-4">{cta}</div> : null}
      </div>
      </div>
      </div>
    </section>
  );
}
