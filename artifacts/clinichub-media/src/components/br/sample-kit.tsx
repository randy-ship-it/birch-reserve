/** "What you'll get": a labelled SAMPLE of the two-sided kit, example values only (Randy, Nov 18 2026 10:23 PM ET). */
import { useEffect, useMemo, useState } from "react";
import { kitCalc } from "../../../../api-server/src/lib/kitCalc";
import { KIT_FIT_FINE } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { SAMPLE_INPUTS, sampleView } from "@/lib/kitView";
import { kitSideA, kitSideB, imageToDataUrl } from "@/lib/kitRender";
import { KitSides } from "@/components/br/kit-builder";
import { EstimateTag, InfoPop } from "@/components/br/intake-kit";

export function SampleKit() {
  const [map, setMap] = useState<string>();
  const [side, setSide] = useState<"a" | "b">("a");
  useEffect(() => void imageToDataUrl("/street-team/door-route.jpg").then(setMap), []);
  const view = useMemo(() => sampleView(kitCalc({ aovUsd: SAMPLE_INPUTS.aovUsd, monthlyOrders: SAMPLE_INPUTS.monthlyOrders, purchasesPerYear: SAMPLE_INPUTS.repeat, marginBand: SAMPLE_INPUTS.marginBand, spendUsd: SAMPLE_INPUTS.spendUsd, conversionPct: SAMPLE_INPUTS.conversionPct }), map), [map]);
  return (
    <section data-testid="sample-kit" className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-900" data-testid="sample-label">Sample · example values only</span>
        <EstimateTag />
        <InfoPop title="About this sample" label="What is this?" testId="sample-fine">
          <p>This is what your kit looks like, filled with example inputs: $80 USD average cart, 500 orders a month, 2–3 purchases a year, 30–50% margin, a $490 USD test. It is not a real brand and not a result.</p>
          <p className="mt-2">{KIT_FIT_FINE}</p>
        </InfoPop>
      </div>
      <h2 className="mt-3 font-display text-3xl md:text-5xl">What you get: a two-sided kit.</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Side A: your revenue opportunity. Side B: your exposure fit across Scale Hubs, Calm Joints, Street Team and the Retail Network.</p>
      <div className="mt-4 inline-flex rounded-full bg-foreground/[0.06] p-1 xl:hidden" role="tablist">
        {(["a", "b"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} data-testid={`sample-tab-${s}`} className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${side === s ? "bg-foreground text-background" : "text-foreground/60"}`}>{s === "a" ? "Side A · Revenue" : "Side B · Exposure"}</button>
        ))}
      </div>
      <div className="mt-4"><KitSides svgA={kitSideA(view)} svgB={kitSideB(view)} side={side} /></div>
    </section>
  );
}
