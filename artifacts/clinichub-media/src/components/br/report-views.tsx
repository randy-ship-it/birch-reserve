/**
 * The report's two views (Randy, Nov 19 2026 9:39 AM ET): one form, both answers.
 *   (a) Supplier exposure view, performance only vs with Accelerate (premium display, optional).
 *   (b) Hub max-exposure + earnings view.
 * Every number is derived from existing model inputs only:
 *   - network figures and targets (CHANNEL_TILES / activation.ts FIG, as reported by Scale Health),
 *   - the placeholder activation shares (MOCK_SHARES 1%–5%, or Friday's `exposure.activation` when present),
 *   - rate-card CPMs (report placements) for Accelerate display views per $1,000,
 *   - the hub surface model (PUBLISHER_SURFACES median views, 35% base share) or Friday's publisher figures.
 * Tiers are a modelling choice on the placeholder range: performance only = lower half (min → mid share),
 * Accelerate = upper half (mid → max share). Low / likely / high = the ends and middle of each half.
 * Labelled Estimate / Modelled everywhere. USD. No CTR/ROAS, no guarantees.
 */
import { useState, type ReactNode } from "react";
import { Check, Rocket, Store, Package, TrendingUp } from "lucide-react";
import { RT, RT_SERIF, RT_SANS, RT_SHADOW } from "@/lib/reportTokens";
import type { FridayExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import { MOCK_SHARES } from "../../../../api-server/src/lib/kitCalc/activation";
import { PUBLISHER_SURFACES, RETAIL_COPY } from "../../../../api-server/src/lib/overhaul/brandIntake";
import type { ReportModel } from "@/components/br/report-v2";
import { EstimatePop } from "@/components/br/report-v2";

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
  hubs: { name: "Scale Hubs", unit: "page views", monthly: true },
  retail: { name: "Retail hubs", unit: "recovery customers", monthly: false },
  street_team: { name: "Street Team · Ontario", unit: "homes", monthly: false },
  calm_joints: { name: "Calm Joints", unit: "", monthly: false },
};
const ORDER = ["hubs", "retail", "street_team", "calm_joints"];
export type Tier = "performance" | "accelerate";
export type ChannelRow = { key: string; name: string; unit: string; monthly: boolean; geo: string; range: LLH | null; later: LLH | null; note: string | null };

export function sharesOf(ex: FridayExposure) {
  const a = ex.activation ?? MOCK_SHARES;
  const min = a.min_share, max = a.max_share, mid = (min + max) / 2;
  return { min, mid, max, placeholder: a.placeholder !== false };
}
/** Channel rows for one tier: base figure (= channel now.min ÷ min share) × the tier's share band. */
export function channelRows(ex: FridayExposure, tier: Tier): ChannelRow[] {
  const s = sharesOf(ex);
  const [lo, hi] = tier === "performance" ? [s.min, s.mid] : [s.mid, s.max];
  return ORDER.map((key) => {
    const c = ex.channels.find((x) => x.key === key);
    const n = NAMES[key]!;
    const base = c?.now ? c.now.min / s.min : null;
    const baseLater = c?.later ? c.later.min / s.min : null;
    const range = base && base > 0 ? llh(base * lo, base * hi) : null;
    const later = baseLater && base && baseLater > base ? llh(baseLater * lo, baseLater * hi) : null;
    const note = c?.needs_figure ? "Figures to come" : !c?.eligible_now ? (c?.reason ?? "Not in your markets yet") : null;
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
function Stat({ label, value, sub, testId, wide }: { label: string; value: string; sub?: string; testId?: string; wide?: boolean }) {
  return (
    <div className={`p-3 ${wide ? "col-span-2 sm:col-span-1" : ""}`} style={{ background: RT.paper, borderRadius: 12 }} data-testid={testId}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: RT.mute }}>{label}</p>
      <p className="mt-1 text-[26px] leading-none tabular-nums" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{value}</p>
      {sub ? <p className="mt-1 text-[12px]" style={{ color: RT.mute }}>{sub}</p> : null}
    </div>
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
            <span className="block text-[11px]" style={{ color: RT.mute }}>{r.unit ? `${r.unit}${r.monthly ? " / month" : " in reach"} · ` : ""}{r.geo}</span>
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
            <span className="text-right text-[12px] md:col-span-2" style={{ color: RT.mute }}>{r.note ?? "Figures to come"}</span>
          )}
        </div>
      ))}
      {extra}
    </div>
  );
}

/* ------------------------------------------------------------------ (a) supplier exposure view */
export function SupplierExposureView({ m, exposure, source, cta, onAccelerate }: { m: ReportModel; exposure: FridayExposure; source: "report" | "mock" | "sample"; cta?: ReactNode; onAccelerate?: ReactNode }) {
  const [tier, setTier] = useState<Tier>(m.isAccelerate ? "accelerate" : "performance");
  const perf = channelRows(exposure, "performance");
  const acc = channelRows(exposure, "accelerate");
  const rows = tier === "accelerate" ? acc : perf;
  const hubs = rows.find((r) => r.key === "hubs")?.range ?? null;
  const perfHubs = perf.find((r) => r.key === "hubs")?.range ?? null;
  const accHubs = acc.find((r) => r.key === "hubs")?.range ?? null;
  const reach = rows.filter((r) => !r.monthly && r.range).reduce((a, r) => ({ low: a.low + r.range!.low, likely: a.likely + r.range!.likely, high: a.high + r.range!.high }), { low: 0, likely: 0, high: 0 });
  const disp = tier === "accelerate" ? displayPer1k(m.cpm) : null;
  const own = ownHubViews();
  const s = sharesOf(exposure);
  const pct = (n: number) => `${+(n * 100).toFixed(1)}%`;
  const src = source === "report" ? "From your report" : source === "sample" ? "Sample values" : "Modelled";
  return (
    <section data-testid="view-supplier" data-tier={tier} className="overflow-hidden" style={{ ...card, fontFamily: RT_SANS, color: RT.body }}>
      <div className="p-5 md:p-6" style={{ background: RT.forest, color: "#fff" }}>
        <div className="flex flex-wrap items-center gap-2">
          <Package className="size-4" style={{ color: RT.mint }} aria-hidden />
          <span className={eyebrow} style={{ color: RT.mint }}>Supplier · exposure view</span>
          <span className="ml-auto flex items-center gap-2"><Pill tone="mint">{src}</Pill>
            <EstimatePop title="How the supplier exposure is modelled" testId="estimate-supplier">
              <p>Exposure = network figures and targets × an activation share, scoped to where you sell and ship. Activation shares are placeholders ({pct(s.min)}–{pct(s.max)}) until real placements confirm them.</p>
              <p><strong>Performance only</strong> uses the lower half of that range ({pct(s.min)}–{pct(s.mid)}). You pay on results, not for ad space.</p>
              <p><strong>Accelerate</strong> adds premium display placements, modelled as the upper half ({pct(s.mid)}–{pct(s.max)}), plus the display views a $1,000 test buys at rate-card CPM (budget ÷ CPM × 1,000).</p>
              <p>12 months = the monthly figure × 12 for page views. Customers and homes are an audience in reach, so they are not multiplied.</p>
              <p style={{ color: RT.mute }}>Network figures as reported by Scale Health; targets are goals. Estimates in USD where money is shown. Not a forecast, not a guarantee. No CTR or ROAS is promised.</p>
            </EstimatePop>
          </span>
        </div>
        <h3 className="mt-3 text-[26px] leading-tight md:text-[32px]" style={{ fontFamily: RT_SERIF }}>Where your products get seen</h3>
        <div className="mt-4 grid w-full grid-cols-2 rounded-full p-1 sm:inline-grid sm:w-auto" style={{ background: "rgba(255,255,255,.1)" }} role="tablist" aria-label="Supplier tier">
          {(["performance", "accelerate"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tier === t} onClick={() => setTier(t)} data-testid={`supplier-tier-${t}`} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition sm:px-4" style={tier === t ? { background: RT.mint, color: RT.forest } : { color: "rgba(255,255,255,.75)" }}>
              {(t === "accelerate") === m.isAccelerate ? <Check className="size-3.5" aria-hidden /> : t === "accelerate" ? <Rocket className="size-3.5" aria-hidden /> : null}{t === "performance" ? "Performance only" : "With Accelerate"}{(t === "accelerate") === m.isAccelerate ? <span className="sr-only"> (your pick)</span> : null}
            </button>
          ))}
        </div>
        {hubs ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Headline value={hubs.likely} unit="page-view exposures a month, likely" range={hubs} fmt={big} dark testId="supplier-headline-month" />
            <Headline value={hubs.likely * 12} unit="page-view exposures over 12 months, likely" range={scale(hubs, 12)} fmt={big} dark testId="supplier-headline-year" />
          </div>
        ) : null}
        {reach.likely > 0 ? <p className="mt-4 text-[14px] text-white/85" data-testid="supplier-reach">Plus about <strong className="text-white">{big(reach.likely)}</strong> recovery customers and homes in reach ({big(reach.low)}–{big(reach.high)}).</p> : null}
      </div>
      <div className="p-5 md:p-6">
        <div className="grid gap-3 sm:grid-cols-2" data-testid="supplier-compare">
          <div className="p-3" style={{ background: tier === "performance" ? RT.mint : RT.paper, borderRadius: 12 }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: RT.mintInk }}>Performance only · pay on results</p>
            <p className="mt-1 text-[24px] leading-none tabular-nums" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{perfHubs ? `${big(perfHubs.likely)} / mo` : "—"}</p>
            <p className="mt-1 text-[12px]" style={{ color: RT.mute }}>Curated placement on hubs that fit your category.</p>
          </div>
          <div className="p-3" style={{ background: tier === "accelerate" ? RT.mint : RT.paper, borderRadius: 12 }}>
            <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: RT.mintInk }}><Rocket className="size-3" aria-hidden />With Accelerate · optional</p>
            <p className="mt-1 text-[24px] leading-none tabular-nums" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{accHubs ? `${big(accHubs.likely)} / mo` : "—"}</p>
            <p className="mt-1 text-[12px]" style={{ color: RT.mute }}>Premium display placements to speed up exposure.</p>
          </div>
        </div>
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
            </>
          }
        />
        <p className="mt-3 text-[12px]" style={{ color: RT.mute }}>{RETAIL_COPY} · network figures and targets. Estimates, not guarantees.</p>
        {onAccelerate && !m.isAccelerate ? <div className="mt-4">{onAccelerate}</div> : null}
        {cta ? <div className="mt-4">{cta}</div> : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ (b) hub max-exposure + earnings view */
export function HubView({ m, exposure, cta }: { m: ReportModel; exposure: FridayExposure; cta?: ReactNode }) {
  const now = m.total;
  const later = m.later && now && m.later.high > now.high ? m.later : null;
  const earn: LLH | null = now ? { low: now.low, likely: (now.low + now.high) / 2, high: later?.high ?? now.high } : null;
  const own = ownHubViews();
  const rows = channelRows(exposure, m.isAccelerate ? "accelerate" : "performance");
  const surfaces = m.earnings.filter((e) => e.pay).sort((a, b) => b.pay!.high - a.pay!.high);
  const needs = m.earnings.filter((e) => !e.pay);
  return (
    <section data-testid="view-hub" className="overflow-hidden" style={{ ...card, fontFamily: RT_SANS, color: RT.body }}>
      <div className="p-5 md:p-6" style={{ background: "#0B1F3A", color: "#fff" }}>
        <div className="flex flex-wrap items-center gap-2">
          <Store className="size-4 text-lime-300" aria-hidden />
          <span className={eyebrow} style={{ color: "#BEF264" }}>Hub · max exposure + earnings</span>
          <span className="ml-auto flex items-center gap-2"><Pill tone="mint">Estimate · USD</Pill>
            <EstimatePop title="How the hub view is modelled" testId="estimate-earn">
              <p>Your share starts at {Math.round(m.share * 100)}% of media revenue (base). Tiers above base are placeholders until confirmed.</p>
              <p>Earnings per surface = monthly views × rate-card CPM ÷ 1,000 × your share. Low = at ramp, high = once pricing normalizes{later ? ", with every surface that has views on" : ""}; likely = the middle.</p>
              <p>12 months = the monthly run-rate × 12. Your own views use a typical (network median) hub until you tell us your numbers.</p>
              <p style={{ color: RT.mute }}>Planning ranges in USD, not quotes or guaranteed payouts.</p>
            </EstimatePop>
          </span>
        </div>
        <h3 className="mt-3 text-[26px] leading-tight md:text-[32px]" style={{ fontFamily: RT_SERIF }}>What your hub earns, and the exposure it unlocks</h3>
        {earn ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Headline value={earn.likely} unit="a month, likely (USD)" range={earn} fmt={usd} dark testId="hub-headline-month" />
            <Headline value={earn.likely * 12} unit="over 12 months at that run-rate, likely (USD)" range={scale(earn, 12)} fmt={usd} dark testId="hub-headline-year" />
          </div>
        ) : (
          <p className="mt-4 text-[15px] text-white/85" data-testid="earnings-empty">Add your hub to unlock max exposure. Hubs keep a share of media revenue from their own shelf space, screens and pages, and your products get the most eyeballs. Supplier-only works too.</p>
        )}
      </div>
      <div className="p-5 md:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="hub-stats">
          <Stat label="Your share" value={`${Math.round(m.share * 100)}%`} sub="of media revenue (base)" />
          <Stat label="Your own views" value={big(own.on)} sub={`a month on your surfaces; up to ${big(own.all)} with every surface on · modelled`} testId="hub-own-views" />
          <Stat wide label="Network reach" value={rows[0]?.range ? big(rows[0].range.likely) : "—"} sub="Scale Hubs page views a month for your products, likely" />
        </div>
        {surfaces.length ? (
          <div className="mt-4 overflow-hidden" style={{ border: `1px solid ${RT.line}`, borderRadius: 14 }} data-testid="hub-surfaces">
            <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider md:grid-cols-[1.3fr_1fr_1fr]" style={{ background: RT.paper, color: RT.mute }}>
              <span>Earnings by surface</span><span className="text-right">Monthly · USD</span><span className="hidden text-right md:block">12 months · likely</span>
            </div>
            {surfaces.map((e) => {
              const mid = (e.pay!.low + e.pay!.high) / 2;
              return (
                <div key={e.surface} className="grid grid-cols-[1fr_auto] items-baseline gap-2 px-3 py-2.5 text-[13px] md:grid-cols-[1.3fr_1fr_1fr]" style={{ borderTop: `1px solid ${RT.line}` }}>
                  <span className="font-semibold" style={{ color: RT.ink }}>{e.surface}</span>
                  <span className="text-right tabular-nums text-[15px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{Math.round(e.pay!.low) === Math.round(e.pay!.high) ? usd(e.pay!.low) : `${usd(e.pay!.low)}–${usd(e.pay!.high)}`}</span>
                  <span className="col-span-2 text-[11px] md:col-span-1 md:text-right md:text-[13px]" style={{ color: RT.mute }}><span className="md:hidden">12 months: </span><span className="font-semibold tabular-nums" style={{ color: RT.ink }}>{usd(mid * 12)}</span></span>
                </div>
              );
            })}
            {needs.map((e) => <div key={e.surface} className="flex justify-between px-3 py-2.5 text-[13px]" style={{ borderTop: `1px solid ${RT.line}` }}><span className="font-semibold" style={{ color: RT.ink }}>{e.surface}</span><span style={{ color: RT.mute }}>needs a rate or monthly views</span></div>)}
          </div>
        ) : null}
        <p className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: RT.ink }}><TrendingUp className="size-4" style={{ color: RT.mintInk }} aria-hidden />Max exposure: your products on your own hub plus across the network</p>
        <ChannelTable rows={rows} testId="hub-channels" />
        <p className="mt-3 text-[12px]" style={{ color: RT.mute }}>{RETAIL_COPY} · network figures and targets. Estimates, not guarantees.</p>
        {cta ? <div className="mt-4">{cta}</div> : null}
      </div>
    </section>
  );
}
