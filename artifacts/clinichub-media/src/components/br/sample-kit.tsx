/**
 * "What you'll get": a labelled SAMPLE of the report and the two-sided kit, example values only
 * (Randy, Nov 18 2026). Rendered with Friday's report design system v2 (report-v2.tsx); the example brand is fictional.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { kitCalc } from "../../../../api-server/src/lib/kitCalc";
import { KIT_FIT_FINE } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { SAMPLE_INPUTS, sampleView } from "@/lib/kitView";
import { kitSideA, kitSideB, imageToDataUrl } from "@/lib/kitRender";
import { sampleReport } from "@/lib/fridayMockReport";
import { KitSides } from "@/components/br/kit-builder";
import { InfoPop } from "@/components/br/intake-kit";
import { ReportV2 } from "@/components/br/report-v2";
import { RT, RT_SERIF, RT_SANS } from "@/lib/reportTokens";

export function SampleKit({ publisherFirst = false, costExtra }: { publisherFirst?: boolean; costExtra?: ReactNode }) {
  const [map, setMap] = useState<string>();
  const [side, setSide] = useState<"a" | "b">("a");
  useEffect(() => void imageToDataUrl("/street-team/door-route.jpg").then(setMap), []);
  const view = useMemo(() => sampleView(kitCalc({ aovUsd: SAMPLE_INPUTS.aovUsd, monthlyOrders: SAMPLE_INPUTS.monthlyOrders, purchasesPerYear: SAMPLE_INPUTS.repeat, marginBand: SAMPLE_INPUTS.marginBand, spendUsd: SAMPLE_INPUTS.spendUsd, conversionPct: SAMPLE_INPUTS.conversionPct }), map), [map]);
  const report = useMemo(() => {
    const r = sampleReport();
    if (publisherFirst) r.roles = ["publisher", "advertiser"];
    return r;
  }, [publisherFirst]);
  return (
    <section data-testid="sample-kit" className="relative" style={{ fontFamily: RT_SANS }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: RT.mint, color: RT.forest }} data-testid="sample-label">Sample · example values only</span>
        <InfoPop title="About this sample" label="What is this?" testId="sample-fine">
          <p>This is what your report and kit look like, filled with example inputs: $80 USD average cart, 500 orders a month, 2–3 purchases a year, 30–50% margin, a $490 USD test. "Example brand" is not a real brand and this is not a result.</p>
          <p className="mt-2">{KIT_FIT_FINE}</p>
        </InfoPop>
      </div>
      <h2 className="mt-3 text-3xl md:text-5xl" style={{ fontFamily: RT_SERIF, color: RT.ink }}>What you get: your report and a two-sided kit.</h2>
      <p className="mt-1 max-w-2xl text-sm" style={{ color: RT.mute }}>Where your customers fit, what it costs to reach them, and what a hub could earn. Every figure is an estimate.</p>
      <div className="mt-4"><ReportV2 report={report} sample compact costExtra={costExtra} /></div>
      <div className="mt-6 p-3 md:p-6" style={{ background: RT.paper, borderRadius: 24 }} data-testid="sample-kit-sides">
        <h3 className="text-[24px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Build your free Monetization Kit</h3>
        <div className="mt-3 inline-flex rounded-full p-1 xl:hidden" style={{ background: RT.track }} role="tablist">
          {(["a", "b"] as const).map((s) => (
            <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} data-testid={`sample-tab-${s}`} className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider" style={side === s ? { background: RT.forest, color: "#fff" } : { color: RT.mute }}>{s === "a" ? "Side A · Revenue" : "Side B · Exposure"}</button>
          ))}
        </div>
        <div className="mt-4"><KitSides svgA={kitSideA(view)} svgB={kitSideB(view)} side={side} /></div>
      </div>
    </section>
  );
}
