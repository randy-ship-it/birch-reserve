/** /kit/r/:reportToken (noindex): the two-sided kit rendered from Friday's brand-report.v1 (view=brand). */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Download, Loader2 } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { CtaBand, LeadGatesStatus, PrimaryCta } from "@/components/br/intake-sell";
import { ActivationRange, pickActivation } from "@/components/br/intake-geo";
import { advertiserActivation } from "../../../../api-server/src/lib/kitCalc/activation";
import { withGeo } from "@/lib/kitView";
import { trackIntake } from "@/lib/intakeTrack";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { MockBanner } from "@/components/br/intake-kit";
import { KitSides } from "@/components/br/kit-builder";
import { fridayIntake, HELD_COPY, type FridayReport } from "@/lib/fridayBrandIntake";
import { fridayView } from "@/lib/kitView";
import { kitSideA, kitSideB, kitPdfBlob, kitPngBlob, saveBlob, imageToDataUrl } from "@/lib/kitRender";
import { KIT_CALC_CONFIG, kitCalc } from "../../../../api-server/src/lib/kitCalc";

const REPEAT_LABEL = (n: number) => KIT_CALC_CONFIG.repeatBands.find((b) => n >= b.lo && n <= b.hi)?.label ?? String(n);

export default function BrKitReport() {
  const { token = "" } = useParams<{ token: string }>();
  usePageMeta("Your media kit | Birch Reserve", "Private kit report.");
  const [state, setState] = useState<"loading" | "draft" | "missing" | "ready" | "error">("loading");
  const [report, setReport] = useState<FridayReport | null>(null);
  const [side, setSide] = useState<"a" | "b">("a");
  const [map, setMap] = useState<string>();
  useEffect(() => {
    imageToDataUrl("/street-team/door-route.jpg").then(setMap);
    fridayIntake()
      .reportView(token, "brand")
      .then((r) => (r === null ? setState("missing") : r.ready ? (setReport(r.report), setState("ready")) : setState("draft")))
      .catch(() => setState("error"));
  }, [token]);
  useEffect(() => {
    if (state !== "loading") trackIntake("advertiser", "view", state === "ready" ? (report?.status?.public_mirror === "held" ? "report_held" : "report_ready") : state === "draft" ? "report_draft" : state === "missing" ? "report_missing" : "report_error", { dedupe: true });
  }, [state, report]);
  const market: Market | null = report?.geo ? { sells_in: (report.geo.sells_in ?? []).filter((c): c is "CA" | "US" => c === "CA" || c === "US"), ships_to: (report.geo.ships_to ?? []).filter((c): c is "CA" | "US" => c === "CA" || c === "US"), regions: report.geo.regions } : null;
  const view = useMemo(() => {
    if (!report) return null;
    const i = (report.ltv?.inputs ?? {}) as { avg_cart_usd?: number; orders_per_month?: number; purchases_per_year?: number; margin_band?: string };
    const calc = kitCalc({ aovUsd: i.avg_cart_usd ?? 0, monthlyOrders: i.orders_per_month ?? 0, purchasesPerYear: i.purchases_per_year ?? 1, marginBand: i.margin_band ?? "" });
    return withGeo(fridayView(report, calc, { brand: report.brand?.name ?? "", categoryLabel: "Your category", repeatLabel: REPEAT_LABEL(i.purchases_per_year ?? 1), mapDataUrl: map }), market, report.geo?.channels);
  }, [report, map]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgA = view ? kitSideA(view) : "";
  const svgB = view ? kitSideB(view) : "";
  async function dl() {
    saveBlob(await kitPdfBlob([svgA, svgB]), "birch-reserve-kit.pdf");
    saveBlob(await kitPngBlob([svgA, svgB]), "birch-reserve-kit.png");
    for (const f of ["pdf", "png"] as const) {
      trackIntake("advertiser", "kit_download", f);
      await fridayIntake().download(token, f).catch(() => undefined);
    }
  }
  return (
    <div data-testid="kit-report-page">
      <MockBanner />
      <div className="container mx-auto px-4 py-8 md:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Private link · not indexed</p>
        <h1 className="font-display text-4xl md:text-6xl">Your media kit</h1>
        {state === "loading" ? <p className="mt-6 flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Loading from Friday…</p> : null}
        {state === "draft" ? <p className="mt-6" data-testid="kit-report-draft">This kit is still a draft. Finish it on <a href="/brand-kit" className="underline">your kit page</a>.</p> : null}
        {state === "missing" ? <p className="mt-6" data-testid="kit-report-missing">We couldn't find this kit. The link may have been rotated.</p> : null}
        {state === "error" ? <p className="mt-6">Friday is unreachable right now. Try again shortly.</p> : null}
        {report?.status?.public_mirror === "held" ? <p className="mt-6 rounded-xl bg-amber-50 p-3 text-amber-900" data-testid="kit-held">{HELD_COPY}</p> : null}
        {view && report?.status?.public_mirror !== "held" ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full bg-foreground/[0.06] p-1" role="tablist">
                {(["a", "b"] as const).map((s) => (
                  <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${side === s ? "bg-foreground text-background" : "text-foreground/60"}`}>{s === "a" ? "Side A · Revenue" : "Side B · Exposure"}</button>
                ))}
              </div>
              <button type="button" onClick={dl} data-testid="kit-report-download" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground"><Download className="size-4" />Download PDF + PNG</button>
              <span className="text-xs text-muted-foreground">LTV and channel fit as returned by Friday{report?.mock ? " (mock on preview)" : ""}. Channel fit is subject to human confirmation.</span>
            </div>
            <LeadGatesStatus gates={report ? { partner_match: report.status?.partner_match, inventory_approval: report.status?.inventory_approval, mock: !!report.mock } : null} testId="report-lead-gates" />
            <div className="mt-4 max-w-3xl"><ActivationRange kind="advertiser" {...pickActivation(report?.activation?.advertiser_exposure_usd, advertiserActivation(view.revenueOpp, market))} /></div>
            <div className="mt-4"><KitSides svgA={svgA} svgB={svgB} side={side} /></div>
          </>
        ) : null}
        {state !== "loading" ? <div className="mt-6" data-testid="report-primary-cta"><PrimaryCta side="advertiser" where="report" /></div> : null}
      </div>
      <CtaBand side="advertiser" where="report" />
    </div>
  );
}
