/**
 * /intake (birchreserve.net and the scalehealth.ca/intake mirror; no links out to the CRM). Simplified one-form intake
 * (Randy, Nov 19 2026 8:30 AM ET voice + 9:34 AM ET via Emma): Supplier + Hub preselected, one fast form (website +
 * email), optional shared answers, role detail after submit on the same record. The full advertiser form stays one click
 * away (#expanded). Below: a labelled sample showing both sides (supplier exposure + hub earnings).
 * Scale-facing (?ref=scale or Scale skin): define a Hub at the top, drop the reserve/block hero and activity toasts;
 * form fields and submit stay the same. The default Birch /intake is unchanged.
 */
import { WatchHowItWorks } from "@/components/br/reel-button";
import { HUB_DEFINITION, isScaleFacing, skinText } from "@/lib/siteSkin";
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
import { GtmSetup } from "@/components/br/gtm-setup";
import { LiveHubGrid, HubFunnel } from "@/components/br/hub-funnel";
import { OwnTheMoment, FourSteps, SeeTheProof } from "@/components/br/hub-story";
import { priceLabels, useAvailability } from "@/components/br/prime-hero";
import { useAttention } from "@/lib/attention";
import { ActivityPulse, CategoriesWeServe, QuestionsBrandsAskCompact } from "@/components/br/market-pulse";
import { mockExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import { brandFromUrl, presetOf, type IntakePreset } from "@/components/br/supplier-mode";
import { BuyJourney } from "@/components/br/journey";
import { RETAIL_COPY, RETAIL_TAG } from "../../../../api-server/src/lib/overhaul/brandIntake";

const SAMPLE_EXPOSURE = { ...mockExposure({ sells_in: ["CA", "US"], ships_to: ["CA", "US"], regions: ["ON"] }), basis: "Sample: network figures / targets × example activation shares (1%–5%)" };

type Mode = "fast" | "expanded";

/**
 * preset "supplier" = the same page + one form opened supplier-first (/intake/supplier, or /intake?role=supplier):
 * supplier hero, exposure ladder, quiet fees; the agency lanes stay on the default page. No preset = unchanged.
 */
export default function BrIntake({ preset: forced }: { preset?: IntakePreset } = {}) {
  const price = priceLabels(useAvailability());
  const preset = forced ?? (typeof window === "undefined" ? undefined : presetOf(window.location.search));
  const sup = preset === "supplier";
  const brand = useMemo(() => (sup ? brandFromUrl() : ""), [sup]);
  const [mode, setMode] = useState<Mode>(() => (typeof window !== "undefined" && window.location.hash === "#expanded" ? "expanded" : "fast"));
  const [scaleFacing] = useState(() => (typeof window === "undefined" ? false : isScaleFacing()));
  const [showLanes, setShowLanes] = useState(false);
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
  // Scroll depth, first touch and time to first interaction for the intake (same code serves scalehealth.ca/intake via the mirror).
  useAttention({ ladder: "[data-testid=intake-next-step]" });
  usePageMeta(sup ? "Supplier intake · Pick your path | Birch Reserve" : "Get your free Monetization Kit | Birch Reserve", sup ? "Pick some or all: supply (hub micro-stores, 200+ brick-and-mortar locations, street-team sampling), your own hub, display / CPC, or ads only. Buy small slots now, make an offer on mid-size inventory, or inquire for bigger slots." : scaleFacing ? HUB_DEFINITION : "One short form for suppliers and hubs. See your hub earnings and your supplier exposure on performance-only terms (pay on results), side by side. Estimates in USD, reviewed by a person.");
  return (
    <div data-testid="intake-landing">
      <MockBanner />
      <section>
        <div className="container mx-auto max-w-5xl px-4 pb-8 pt-8 md:pt-14">
          {sup ? (
            <div data-testid="supplier-hero">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{skinText("Birch Reserve · For suppliers")}</p>
              <h1 className="font-display text-4xl leading-[1.02] md:text-6xl" data-testid="supplier-h1">{brand ? `${brand}, pick your path.` : "Pick your path."}</h1>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">Supply, your own hub, display or ads. Some or all. No setup fee.</p>
              <div className="mt-3"><WatchHowItWorks placement="hero_intake_supplier" testId="intake-watch-reel" /></div>
              <p className="mt-3 inline-flex items-start gap-2 rounded-2xl bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#0b1f3a] ring-1 ring-foreground/10" data-testid="supplier-network"><span>{RETAIL_COPY} <span className="font-normal text-foreground/50">· {RETAIL_TAG}</span></span></p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{scaleFacing ? "Scale Health · Monetization Kit" : skinText("Birch Reserve · Monetization Kit")}</p>
              <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Get your free Monetization Kit.</h1>
              {scaleFacing ? (
                <p className="mt-3 max-w-2xl text-base text-foreground/80" data-testid="hub-definition">{HUB_DEFINITION}</p>
              ) : (
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">Buy space now, book a big block, or get your free kit.</p>
              )}
              <div className="mt-3"><WatchHowItWorks placement="hero_intake" testId="intake-watch-reel" /></div>
              {scaleFacing ? null : (
                <>
                  <div className="mt-5"><TwoLane /></div>
                  <div className="mt-6 flex items-center gap-3" data-testid="kit-divider"><span className="h-px flex-1 bg-foreground/15" /><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">Or get your free Monetization Kit</span><span className="h-px flex-1 bg-foreground/15" /></div>
                  <ActivityPulse mode="inline" className="mt-3" />
                </>
              )}
            </>
          )}
          <div className={sup ? "mt-5" : "mt-3"}>{mode === "fast" ? <IntakeShortForm onExpand={expand} preset={preset} /> : null}</div>
          {sup ? <BuyJourney where="intake_supplier" title="Buying ad space? Buy small. Offer mid. Inquire big." className="mt-6" testId="supplier-journey" /> : null}
          {scaleFacing && !sup ? (
            <div className="mt-3">
              {showLanes ? (
                <TwoLane />
              ) : (
                <button type="button" onClick={() => setShowLanes(true)} className="text-left text-[13px] text-foreground/60 underline-offset-2 hover:underline" data-testid="intake-reserve-space-link">Buying ads on existing hubs? Buy space</button>
              )}
            </div>
          ) : null}
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
        <Details testId="sample-details"><p>Supplier exposure (performance-only, pay on results, and with Accelerate) and hub max exposure + earnings, for a fictional example brand. Every figure is an estimate or modelled range, not a result or a guarantee.</p></Details>
        <div className="mt-4"><ReportV2 report={sample} sample compact exposure={SAMPLE_EXPOSURE} exposureSource="sample" /></div>
        {sup || scaleFacing ? null : <div className="mt-10" data-testid="intake-next-step"><NextStep where="intake" yieldToPostKit /></div>}
        {sup ? null : (
          <div className="mt-10 space-y-10" data-testid="intake-hub-story">
            <div><LiveHubGrid /><HubFunnel /></div>
            {scaleFacing ? null : (
              <>
                <OwnTheMoment testId="intake-own-moment" />
                <FourSteps look={price.look} seat={price.seat} testId="intake-four-steps" />
                <SeeTheProof testId="intake-see-proof" />
              </>
            )}
          </div>
        )}
        {sup ? null : (
          <div className="mt-10 space-y-8" style={{ fontFamily: "inherit" }} data-testid="intake-market-signals">
            {scaleFacing ? null : <div className="hidden min-h-[6.5rem] md:block" data-testid="pulse-row"><ActivityPulse desktopInline /></div>}
            <Details label="Categories we serve and questions brands ask" testId="intake-more-details" className="text-[14px]">
              <div className="space-y-8 pt-3">
                <CategoriesWeServe />
                <QuestionsBrandsAskCompact testId="intake-questions-compact" />
              </div>
            </Details>
          </div>
        )}
        {/* GTM setup packages (Randy Nov 21 2026): same shared block as home + media kit, below the main intake options. */}
        {sup || scaleFacing ? null : <div className="mx-auto mt-10 max-w-5xl" data-testid="intake-gtm-setup"><GtmSetup where="intake" /></div>}
      </div>
    </div>
  );
}
