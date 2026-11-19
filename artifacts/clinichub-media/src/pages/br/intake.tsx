/**
 * /intake (birchreserve.net only; no links out to the CRM). Simplified one-form intake (Randy, Nov 19 2026 8:30 AM ET
 * voice + 9:34 AM ET via Emma): Supplier + Hub preselected, one fast form (website + email), optional shared answers,
 * role detail after submit on the same record. The full advertiser form stays one click away (#expanded).
 * Below: a labelled sample showing both sides (supplier exposure + hub earnings).
 */
import { useEffect, useMemo, useState } from "react";
import { KitBuilder } from "@/components/br/kit-builder";
import { trackIntake, type IntakeSide } from "@/lib/intakeTrack";
import { usePageMeta } from "@/components/br/ui";
import { MockBanner } from "@/components/br/intake-kit";
import { IntakeShortForm } from "@/components/br/intake-short-form";
import { ReportV2 } from "@/components/br/report-v2";
import { ShareBar } from "@/components/br/share-bar";
import { sampleReport } from "@/lib/fridayMockReport";
import { RT, RT_SANS, RT_SERIF } from "@/lib/reportTokens";
import { mockExposure } from "../../../../api-server/src/lib/kitCalc/activation";

const SAMPLE_EXPOSURE = { ...mockExposure({ sells_in: ["CA", "US"], ships_to: ["CA", "US"], regions: ["ON"] }), basis: "Sample: network figures / targets × example activation shares (1%–5%)" };

type Mode = "fast" | "expanded";
export default function BrIntake() {
  const [mode, setMode] = useState<Mode>(() => (typeof window !== "undefined" && window.location.hash === "#expanded" ? "expanded" : "fast"));
  useEffect(() => trackIntake("advertiser", "mode", mode), [mode]);
  const expand = (side: IntakeSide) => {
    if (side === "publisher") return window.location.assign("/intake/publisher#expanded");
    setMode("expanded");
    setTimeout(() => document.getElementById("my-kit")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const sample = useMemo(() => {
    const r = sampleReport();
    r.roles = ["supplier", "publisher"];
    return r;
  }, []);
  usePageMeta("Get your Monetization Kit | Birch Reserve", "One short form for suppliers and hubs. See your hub earnings and supplier performance exposure, side by side. Estimates in USD, reviewed by a person.");
  return (
    <div data-testid="intake-landing">
      <MockBanner />
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)]">
        <div className="container mx-auto max-w-5xl px-4 pb-8 pt-8 md:pt-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Birch Reserve · Monetization Kit</p>
          <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Get your Monetization Kit.</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">One short form. See what your hub could earn and where your products get seen, side by side. Estimates, reviewed by a person.</p>
          <div className="mt-5">{mode === "fast" ? <IntakeShortForm onExpand={expand} /> : null}</div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <ShareBar testId="share-bar-intake" />
            {mode === "fast" ? (
              <button type="button" onClick={() => setMode("expanded")} className="text-left text-[13px] text-foreground/60 underline-offset-2 hover:underline" data-testid="intake-mode-expanded">Prefer the detailed calculator? Open the full kit builder</button>
            ) : (
              <button type="button" onClick={() => setMode("fast")} className="text-left text-[13px] font-semibold text-foreground/70 underline" data-testid="intake-mode-fast">Back to the short form</button>
            )}
          </div>
        </div>
      </section>
      {mode === "expanded" ? (
        <div data-testid="intake-expanded">
          <KitBuilder showMockBanner={false} />
        </div>
      ) : null}
      <div className="container mx-auto px-4 pb-12 pt-6" style={{ fontFamily: RT_SANS }} data-testid="sample-kit">
        <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ background: RT.mint, color: RT.forest }} data-testid="sample-label">Sample · example values only</span>
        <h2 className="mt-3 text-3xl md:text-5xl" style={{ fontFamily: RT_SERIF, color: RT.ink }}>What you get: both answers from one form.</h2>
        <p className="mt-1 max-w-2xl text-sm" style={{ color: RT.mute }}>Supplier exposure (performance only and with Accelerate) and hub max exposure + earnings, for a fictional example brand. Every figure is an estimate or modelled range in USD, not a result or a guarantee.</p>
        <div className="mt-4"><ReportV2 report={sample} sample compact exposure={SAMPLE_EXPOSURE} exposureSource="sample" /></div>
      </div>
    </div>
  );
}
