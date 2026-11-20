/**
 * /intake (birchreserve.net only; no links out to the CRM). Simplified one-form intake (Randy, Nov 19 2026 8:30 AM ET
 * voice + 9:34 AM ET via Emma): Supplier + Hub preselected, one fast form (website + email), optional shared answers,
 * role detail after submit on the same record. The full advertiser form stays one click away (#expanded).
 * Below: a labelled sample showing both sides (supplier exposure + hub earnings).
 */
import { skinText } from "@/lib/siteSkin";
import { useEffect, useMemo, useState } from "react";
import { KitBuilder } from "@/components/br/kit-builder";
import { trackIntake, type IntakeSide } from "@/lib/intakeTrack";
import { usePageMeta } from "@/components/br/ui";
import { MockBanner } from "@/components/br/intake-kit";
import { IntakeShortForm } from "@/components/br/intake-short-form";
import { ReportV2 } from "@/components/br/report-v2";
import { ShareBar } from "@/components/br/share-bar";
import { Details } from "@/components/br/details";
import { sampleReport } from "@/lib/fridayMockReport";
import { RT, RT_SANS, RT_SERIF } from "@/lib/reportTokens";
import { TwoLane } from "@/components/br/two-lane";
import { NextStep } from "@/components/br/next-step";
import { mockExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import { brandFromUrl, presetOf, type IntakePreset } from "@/components/br/supplier-mode";
import { RETAIL_COPY, RETAIL_TAG } from "../../../../api-server/src/lib/overhaul/brandIntake";

const SAMPLE_EXPOSURE = { ...mockExposure({ sells_in: ["CA", "US"], ships_to: ["CA", "US"], regions: ["ON"] }), basis: "Sample: network figures / targets × example activation shares (1%–5%)" };

type Mode = "fast" | "expanded";

/**
 * preset "supplier" = the same page + one form opened supplier-first (/intake/supplier, or /intake?role=supplier):
 * supplier hero, exposure ladder, quiet fees; the agency lanes stay on the default page. No preset = unchanged.
 */
export default function BrIntake({ preset: forced }: { preset?: IntakePreset } = {}) {
  const preset = forced ?? (typeof window === "undefined" ? undefined : presetOf(window.location.search));
  const sup = preset === "supplier";
  const brand = useMemo(() => (sup ? brandFromUrl() : ""), [sup]);
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
  usePageMeta(sup ? "Supplier intake · Max your exposure | Birch Reserve" : "Get your Monetization Kit | Birch Reserve", sup ? "Suppliers start performance-only: no setup fee, no monthly fee, you approve every placement. Max your exposure with your own hub or CPM/CPC display." : "One short form for suppliers and hubs. See your hub earnings and your supplier exposure on performance-only terms (pay on results), side by side. Estimates in USD, reviewed by a person.");
  return (
    <div data-testid="intake-landing">
      <MockBanner />
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)]">
        <div className="container mx-auto max-w-5xl px-4 pb-8 pt-8 md:pt-14">
          {sup ? (
            <div data-testid="supplier-hero">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{skinText("Birch Reserve · For suppliers")}</p>
              <h1 className="font-display text-4xl leading-[1.02] md:text-6xl" data-testid="supplier-h1">{brand ? `${brand}, start performance-only.` : "Start performance-only."}</h1>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">No setup fee, no monthly fee. Max your exposure with your own hub or CPM/CPC display.</p>
              <p className="mt-3 inline-flex items-start gap-2 rounded-2xl bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#0b1f3a] ring-1 ring-foreground/10" data-testid="supplier-network"><span>{RETAIL_COPY} <span className="font-normal text-foreground/50">· {RETAIL_TAG}</span></span></p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{skinText("Birch Reserve · Monetization Kit")}</p>
              <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Get your Monetization Kit.</h1>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">Reserve space now, book a big block, or get your free kit.</p>
              <div className="mt-5"><TwoLane /></div>
              <div className="mt-6 flex items-center gap-3" data-testid="kit-divider"><span className="h-px flex-1 bg-foreground/15" /><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">Or get your free Monetization Kit</span><span className="h-px flex-1 bg-foreground/15" /></div>
            </>
          )}
          <div className={sup ? "mt-5" : "mt-3"}>{mode === "fast" ? <IntakeShortForm onExpand={expand} preset={preset} /> : null}</div>
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
        <h2 className="mt-3 text-3xl md:text-5xl" style={{ fontFamily: RT_SERIF, color: RT.ink }}>What you get.</h2>
        <Details testId="sample-details"><p>Supplier exposure (performance-only, pay on results, and with Accelerate) and hub max exposure + earnings, for a fictional example brand. Every figure is an estimate or modelled range in USD, not a result or a guarantee.</p></Details>
        <div className="mt-4"><ReportV2 report={sample} sample compact exposure={SAMPLE_EXPOSURE} exposureSource="sample" /></div>
        {sup ? null : <div className="mt-10" data-testid="intake-next-step"><NextStep where="intake" yieldToPostKit /></div>}
      </div>
    </div>
  );
}
