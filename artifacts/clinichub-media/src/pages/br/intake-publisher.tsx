import { KitCta } from "@/components/br/kit-cta";
import { isScaleSkin, skinText } from "@/lib/siteSkin";
import { ShareBar } from "@/components/br/share-bar";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles, TrendingUp, Layers } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { ActivationRange, DEFAULT_MARKET, MarketPicker, pickActivation } from "@/components/br/intake-geo";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { publisherActivation } from "../../../../api-server/src/lib/kitCalc/activation";
import { useCurrency } from "@/lib/currency";
import { HubDifferentiators } from "@/components/br/hub-differentiators";
import { CAD_PER_USD } from "../../../../api-server/src/lib/overhaul/model";
import { trackIntake } from "@/lib/intakeTrack";
import { CountUp, EstimateTag, InfoPop, MockBanner, RoleTabs, SaveChip, Segmented, Toggle, basePayload, useAutosave, ChannelTiles, ContactSubmit } from "@/components/br/intake-kit";
import { PAYOUT, EMAIL_OPEN_PCT_MID, PUBLISHER_ASSUMPTIONS, PUBLISHER_SURFACES, projectPublisher, type PricingMode, type PubSurfaceKey } from "../../../../api-server/src/lib/overhaul/brandIntake";

const usdFmt = (n: number, d = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;

export default function BrIntakePublisher() {
  // The model runs in USD. A CAD visitor sees every computed figure x CAD_PER_USD and labelled CAD, like the hub calculator.
  const { currency } = useCurrency();
  const cad = currency === "cad";
  const k = cad ? CAD_PER_USD : 1;
  const usd = (n: number, d = 0) => usdFmt(n * k, d);
  const cur = cad ? "CAD" : "USD";
  usePageMeta("Hub · max exposure + earnings | Birch Reserve", "Put curated products in front of your audience for max exposure, and see what your hub could earn. Estimates in USD.");
  const [on, setOn] = useState<Partial<Record<PubSurfaceKey, boolean>>>({});
  const [mode, setMode] = useState<PricingMode>("cpm");
  const [sizeX, setSizeX] = useState(1);
  const [conv, setConv] = useState(0);
  const [value, setValue] = useState(0);
  const [touched, setTouched] = useState(false);
  const [market, setMarket] = useState<Market>(DEFAULT_MARKET);
  const valueUsd = value / k; // entered in the visitor's currency
  const p = useMemo(() => projectPublisher({ on, mode, sizeX, conversionPct: conv, valuePerConversionUsd: valueUsd }), [on, mode, sizeX, conv, valueUsd]);
  const touch = <T,>(f: (v: T) => void) => (v: T) => {
    if (!touched) trackIntake("publisher", "field_start", "inputs", { dedupe: true });
    setTouched(true);
    f(v);
  };
  const payload = useMemo(
    () => ({ ...basePayload("publisher"), publisher: { surfaces: p.rows.map((r) => ({ key: r.key, on: r.on })), mode, size_x: sizeX, conversion_pct: conv, value_per_conversion_usd: valueUsd }, ...(market.sells_in.length ? { market } : {}) }),
    [p, mode, sizeX, conv, valueUsd, market],
  );
  const { ref, state, setRef } = useAutosave("publisher", payload, touched);
  const chart = p.rows.filter((r) => r.on && r.priced).map((r) => ({ name: r.label, ramp: r.payoutUsd[0] * k, normalized: (r.payoutUsd[1] - r.payoutUsd[0]) * k }));

  return (
    <div className="bg-[radial-gradient(ellipse_at_top,_#ecfccb_0%,_transparent_55%)]">
      <MockBanner />
      <RoleTabs active="publisher" />
      <header className="container mx-auto px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">For hubs · Max exposure</p>
        <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Max exposure for your hub, plus a share.</h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">Switch surfaces on. Watch the estimate move. You keep {PAYOUT.basePct}% of media revenue, rising to {PAYOUT.tiers[3].pct}% as your views grow.</p>
        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <KitCta placement="hero_role_publisher" size="md" sub="One form for hub + supplier. Website + email to start." />
          <ShareBar testId="share-bar-role" />
        </div>
      </header>

      <section className="container mx-auto px-4 pb-5"><HubDifferentiators /></section>
      <section className="container mx-auto grid gap-5 px-4 pb-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Hero number */}
        <div data-testid="publisher-hero" data-currency-fixed className="relative overflow-hidden rounded-3xl bg-[#0b1f3a] p-6 text-white shadow-xl md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-lime-300/30 blur-3xl" />
          <div className="flex flex-wrap items-center gap-2">
            <EstimateTag />
            <span className="text-xs text-white/70">Monthly payout to you · estimate</span>
            <span className="ml-auto"><InfoPop dark title="Assumptions" label="Assumptions" testId="publisher-assumptions">{PUBLISHER_ASSUMPTIONS.map((a) => <p key={a}>• {skinText(a)}</p>)}</InfoPop></span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Low</p>
              <CountUp value={p.monthlyTotalUsd[0] * k} className="block pt-1 font-display text-2xl sm:text-4xl md:text-5xl" />
            </div>
            <div data-testid="publisher-typical">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">Typical</p>
              <CountUp value={p.monthlyLikelyUsd * k} className="block pt-1 font-display text-2xl text-white sm:text-4xl md:text-5xl" />
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-lime-200"><TrendingUp className="size-3.5" /> High</p>
              <CountUp value={p.monthlyTotalUsd[1] * k} className="block pt-1 font-display text-2xl text-lime-200 sm:text-4xl md:text-5xl" />
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="h-full rounded-full bg-gradient-to-r from-lime-200 to-lime-400 transition-all duration-500" style={{ width: `${p.monthlyTotalUsd[1] ? Math.max(6, (p.monthlyTotalUsd[0] / p.monthlyTotalUsd[1]) * 100) : 0}%` }} />
          </div>
          <p className="mt-3 text-xs text-white/70">
            Per year: {usd(p.yearTotalUsd[0])} to {usd(p.yearTotalUsd[1])}, typical {usd(p.yearLikelyUsd)} · {p.sellBand[0]}/{p.sellBand[1]}/{p.sellBand[2]}% sold (low/typical/high) · {p.payoutPct}% payout · {cur}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 [&_[data-testid=save-chip]]:bg-white/10 [&_[data-testid=save-chip]]:text-white/75 [&_[role=radio][aria-checked=false]]:text-white/70 [&_[role=radiogroup]]:bg-white/10">
            <Segmented<PricingMode> value={mode} onChange={touch<PricingMode>(setMode)} testId="pricing-mode" options={[{ v: "cpm", l: "CPM", tone: "bg-lime-200 text-[#0b1f3a]" }, { v: "cpc", l: "CPC", tone: "bg-lime-200 text-[#0b1f3a]" }]} />
            <SaveChip state={state} version={ref?.version} />
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-3xl border border-foreground/10 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-2 flex items-center gap-2">
            <Layers className="size-4" aria-hidden />
            <h2 className="text-sm font-bold">Payout by surface</h2>
            <EstimateTag />
          </div>
          <div className="h-64" data-currency-fixed data-testid="publisher-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, k: string) => [usdFmt(v), k === "ramp" ? "Low case" : "Added up to the high case"]} />
                <Bar dataKey="ramp" stackId="a" fill="#0b1f3a" radius={[4, 0, 0, 4]} isAnimationActive />
                <Bar dataKey="normalized" stackId="a" radius={[0, 4, 4, 0]} isAnimationActive>
                  {chart.map((c) => <Cell key={c.name} fill="#a3e635" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground">Navy = low case ({p.sellBand[0]}% sold, low end of the starter price). Lime = added up to the high case ({p.sellBand[2]}% sold, top of the range).</p>
        </div>
      </section>

      {/* Surfaces */}
      <section className="container mx-auto px-4 pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl md:text-3xl">Your surfaces</h2>
          <label className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Hub size</span>
            <input data-testid="size-slider" type="range" min={0.25} max={5} step={0.25} value={sizeX} onChange={(e) => touch(setSizeX)(Number(e.target.value))} className="w-36 accent-[#0b1f3a]" />
            <span className="w-24 text-xs tabular-nums">{sizeX}× median hub</span>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLISHER_SURFACES.map((s) => {
            const row = p.rows.find((r) => r.key === s.key)!;
            return (
              <article key={s.key} data-testid={`surface-${s.key}`} className={`rounded-2xl border p-4 transition ${row.on ? "border-foreground/80 bg-white shadow-md" : "border-foreground/10 bg-white/60"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{s.label}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{skinText(s.where)}</p>
                  </div>
                  <Toggle on={row.on} onChange={(v) => touch(setOn)({ ...on, [s.key]: v })} label={`Turn ${s.label} on or off`} testId={`toggle-${s.key}`} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-foreground/[0.04] p-2">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-foreground/55">CPM</dt>
                    <dd className="text-sm font-semibold tabular-nums">{s.cpm ? (s.cpm[0] === s.cpm[1] ? usdFmt(s.cpm[0]) : `${usdFmt(s.cpm[0])}–${s.cpm[1]}`) : "Not set"}</dd>
                  </div>
                  <div className="rounded-lg bg-foreground/[0.04] p-2">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-foreground/55">CPC</dt>
                    <dd className="text-sm font-semibold tabular-nums">{s.cpc ? `${usdFmt(s.cpc[0], 2)}–${s.cpc[1].toFixed(2)}` : "Not set"}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-sm">
                    {row.on && row.priced ? (
                      <>
                        <span data-currency-fixed className="font-semibold tabular-nums">{usd(row.payoutUsd[0])}–{usd(row.payoutUsd[1])}</span>
                        <span className="text-xs text-muted-foreground"> /mo to you</span>
                      </>
                    ) : row.on ? (
                      <span className="text-xs text-muted-foreground">No rate on file yet: priced by IO</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Off</span>
                    )}
                  </p>
                  <InfoPop title={s.label} testId={`surface-pop-${s.key}`}>
                    <p>{skinText(s.source)}</p>
                    <p>Modelled {s.key === "newsletter" ? "sends" : "views"} at a median hub: {s.monthlyViews == null ? "none on file" : `${s.monthlyViews.toLocaleString("en-US")}/mo`}.{s.key === "newsletter" && s.monthlyViews != null ? ` Priced per 1,000 opens: about ${Math.round((s.monthlyViews * EMAIL_OPEN_PCT_MID) / 100).toLocaleString("en-US")} opens at a typical open rate.` : ""}</p>
                    <p>Starter rates are illustrative 2026 planning estimates, not sold rates.</p>
                  </InfoPop>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Transactions + tiers */}
      <section className="container mx-auto grid gap-5 px-4 pb-10 lg:grid-cols-2">
        <div className="rounded-3xl border border-foreground/10 bg-white p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden />
            <h2 className="font-semibold">Bookings and product sales</h2>
            <EstimateTag />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Optional. Use your own numbers: what share of clicks become a physio booking or product order, and what one is worth to you.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Conversion % of clicks
              <input data-testid="conv-pct" type="number" min={0} max={100} step={0.5} value={conv} onChange={(e) => touch(setConv)(Number(e.target.value))} className="mt-1 h-11 w-full rounded-lg border border-foreground/20 px-3 text-base" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              Value each ({cur})
              <input data-testid="conv-value" type="number" min={0} step={5} value={value} onChange={(e) => touch(setValue)(Number(e.target.value))} className="mt-1 h-11 w-full rounded-lg border border-foreground/20 px-3 text-base" />
            </label>
          </div>
          <p className="mt-3 text-sm">
            {p.conversions.toLocaleString("en-US")} transactions/mo · <span data-currency-fixed className="font-semibold">{usd(p.transactionsUsd)}</span> <span className="text-xs text-muted-foreground">(your inputs)</span>
          </p>
        </div>
        <div className="rounded-3xl border border-foreground/10 bg-white p-5 md:p-6" data-testid="payout-tiers">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Payout share</h2>
            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{PAYOUT.tiersLabel}</span>
            <span className="ml-auto"><InfoPop title="Payout tiers" testId="tiers-pop"><p>{PAYOUT.line}</p><p>Tiers are on your total monthly views and paid as a flat rate at the tier you reach, the way ad networks tier their shares (Mediavine: 75% to 90%). Your estimate above uses the tier for the views it models. Modelled; the hub agreement governs.</p></InfoPop></span>
          </div>
          <ol className="mt-4 flex items-end gap-2">
            {PAYOUT.tiers.map((t, i) => (
              <li key={t.key} className="flex-1">
                <div className={`flex items-end justify-center rounded-t-xl pb-2 font-display text-xl ${t.pct === p.payoutPct ? "bg-lime-300 text-[#0b1f3a]" : "border-2 border-dashed border-foreground/25 text-foreground/50"}`} style={{ height: 56 + i * 28 }}>
                  {t.pct}%
                </div>
                <p className="mt-1 text-center text-xs font-semibold">{t.label}</p>
                <p className="text-center text-[10px] text-muted-foreground">{t.pct === p.payoutPct ? "Your estimate" : t.breakpoint}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="container mx-auto grid gap-4 px-4 pb-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <MarketPicker value={market} onChange={touch(setMarket)} side="publisher" />
        <ActivationRange kind="publisher" {...pickActivation(undefined, publisherActivation({ on, mode, sizeX, conversionPct: conv, valuePerConversionUsd: valueUsd }))} />
      </section>
      <section className="container mx-auto px-4 pb-8"><ContactSubmit role="publisher" payload={payload} draft={ref} setRef={setRef} label={isScaleSkin() ? "Send to Scale Health" : "Send to Birch"} /></section>
      <ChannelTiles market={market} />
    </div>
  );
}
