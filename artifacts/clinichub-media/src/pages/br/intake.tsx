/**
 * /intake (birchreserve.net only; Friday is backend/API only, no links out to Friday pages). Two paths (Randy, Nov 18
 * 2026 11:36 PM ET): FAST (default: website + email → instant quick estimate) and EXPANDED (the full form, prefilled
 * after a fast submit, PATCHing the same Friday record). The labelled sample stays below the form.
 */
import { useEffect, useState } from "react";
import { KitBuilder } from "@/components/br/kit-builder";
import { trackIntake, type IntakeSide } from "@/lib/intakeTrack";
import { usePageMeta } from "@/components/br/ui";
import { MockBanner } from "@/components/br/intake-kit";
import { IntakeShortForm } from "@/components/br/intake-short-form";
import { SampleKit } from "@/components/br/sample-kit";
import { CtaBand, SampleLeadStatus } from "@/components/br/intake-sell";
import { ActivationRange, ExposureCard } from "@/components/br/intake-geo";
import { mockExposure, publisherActivation } from "../../../../api-server/src/lib/kitCalc/activation";

/** Sample-only inputs (example values, not a real brand or hub). */
const SAMPLE_EXPOSURE = { ...mockExposure({ sells_in: ["CA", "US"], ships_to: ["CA", "US"], regions: ["BC"] }), basis: "Sample: network figures / targets × example activation shares (1%–5%)" };
const SAMPLE_PUB = publisherActivation({ on: { post_purchase: true, home: true }, mode: "cpm", sizeX: 1, conversionPct: 0, valuePerConversionUsd: 0 });

type Mode = "fast" | "expanded";
export default function BrIntake() {
  const [mode, setMode] = useState<Mode>(() => (typeof window !== "undefined" && window.location.hash === "#expanded" ? "expanded" : "fast"));
  useEffect(() => trackIntake("advertiser", "mode", mode), [mode]);
  const expand = (side: IntakeSide) => {
    if (side === "publisher") return window.location.assign("/intake/publisher#expanded"); // the publisher's full form
    setMode("expanded");
    setTimeout(() => document.getElementById("my-kit")?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  usePageMeta("Get your Monetization Kit | Birch Reserve", "Website + email for a quick estimate, or the full form. A two-sided Monetization Kit: your revenue opportunity and your exposure fit. Estimates only, reviewed by a person.");
  return (
    <div data-testid="intake-landing">
      <MockBanner />
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)]">
        <div className="container mx-auto max-w-5xl px-4 pb-8 pt-10 md:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Birch Reserve</p>
          <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Get your Monetization Kit.</h1>
          <p className="mt-2 max-w-xl text-base text-muted-foreground">Pick your side. Advertisers get a two-sided kit: revenue opportunity and where the brand fits across the network. Publishers get what their hub could earn.</p>
          <div className="mt-6 inline-flex rounded-full bg-foreground/[0.06] p-1" role="tablist" aria-label="Intake mode" data-testid="intake-mode">
            {(["fast", "expanded"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} data-testid={`intake-mode-${m}`} onClick={() => setMode(m)} className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${mode === m ? "bg-foreground text-background" : "text-foreground/60"}`}>{m === "fast" ? "Fast · 2 fields" : "Expanded · full form"}</button>
            ))}
          </div>
          <div className="mt-4" hidden={mode !== "fast"}><IntakeShortForm onExpand={expand} /></div>
        </div>
      </section>
      {mode === "expanded" ? (
        <div data-testid="intake-expanded">
          <div className="container mx-auto max-w-5xl px-4"><p className="text-sm text-muted-foreground">Publisher? <a href="/intake/publisher#expanded" className="font-semibold underline" data-testid="intake-expanded-publisher">Open the full hub form</a>.</p></div>
          <KitBuilder showMockBanner={false} />
        </div>
      ) : null}
      <div className="container mx-auto px-4 pb-10 pt-6">
        <SampleKit costExtra={<ExposureCard exposure={SAMPLE_EXPOSURE} source="sample" sync={false} testId="sample-exposure" v2 />} />
        <div className="mt-6 max-w-2xl" data-testid="sample-activation">
          <ActivationRange kind="publisher" block={SAMPLE_PUB} source="sample" testId="sample-activation-publisher" />
        </div>
        <div className="mt-4 max-w-2xl"><SampleLeadStatus /></div>
      </div>
      <CtaBand side="advertiser" where="intake" />
    </div>
  );
}
