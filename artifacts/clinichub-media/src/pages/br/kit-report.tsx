/** /kit/r/:reportToken (noindex): Friday's brand-report.v1 (view=brand, + view=publisher role_data) in Friday's report design system v2, inside Birch chrome. */
import { ShareBar } from "@/components/br/share-bar";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Download, Loader2 } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { CtaBand, LeadGatesStatus, PrimaryCta } from "@/components/br/intake-sell";
import { ExposureCard, pickExposure } from "@/components/br/intake-geo";
import { ReportV2 } from "@/components/br/report-v2";
import { RT, RT_SERIF, RT_SANS } from "@/lib/reportTokens";
import { withGeo } from "@/lib/kitView";
import { trackIntake } from "@/lib/intakeTrack";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { MockBanner } from "@/components/br/intake-kit";
import { KitSides } from "@/components/br/kit-builder";
import { fridayEligibility, fridayIntake, HELD_COPY, type FridayReport } from "@/lib/fridayBrandIntake";
import { fridayView } from "@/lib/kitView";
import { kitCover, kitSideA, kitSideB, kitPdfBlob, kitPngBlob, saveBlob, imageToDataUrl } from "@/lib/kitRender";
import { kitSummary } from "@/lib/kitSummary";
import { loadPrefill } from "@/lib/intakePrefill";
import { KIT_CALC_CONFIG, kitCalc } from "../../../../api-server/src/lib/kitCalc";

const REPEAT_LABEL = (n: number) => KIT_CALC_CONFIG.repeatBands.find((b) => n >= b.lo && n <= b.hi)?.label ?? String(n);

export default function BrKitReport() {
  const { token = "" } = useParams<{ token: string }>();
  usePageMeta("Your Monetization Kit | Birch Reserve", "Private kit report.");
  const [state, setState] = useState<"loading" | "draft" | "missing" | "ready" | "error">("loading");
  const [report, setReport] = useState<FridayReport | null>(null);
  const [side, setSide] = useState<"a" | "b">("a");
  const [map, setMap] = useState<string>();
  const kitPending = (report?.status?.kits_pending ?? 0) > 0;
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
  // Publisher earnings live only in view=publisher (role_data.publisher_monetization, Friday v1.1 §2).
  const [pubData, setPubData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!report?.roles?.includes("publisher")) return;
    fridayIntake().reportView(token, "publisher").then((r) => {
      if (r && r.ready && r.report.role_data) setPubData(r.report.role_data);
    }).catch(() => undefined);
  }, [report, token]);
  const full = report && pubData ? { ...report, role_data: { ...(report.role_data ?? {}), ...pubData } } : report;
  const market: Market | null = report?.geo?.markets ? { sells_in: report.geo.markets.filter((c): c is "CA" | "US" => c === "CA" || c === "US"), ships_to: report.geo.markets.filter((c): c is "CA" | "US" => c === "CA" || c === "US"), regions: Object.values(report.geo.regions ?? {}).flat() } : null;
  const view = useMemo(() => {
    if (!report) return null;
    const i = (report.ltv?.inputs ?? {}) as { avg_cart_usd?: number; orders_per_month?: number; purchases_per_year?: number; margin_band?: string };
    const calc = kitCalc({ aovUsd: i.avg_cart_usd ?? 0, monthlyOrders: i.orders_per_month ?? 0, purchasesPerYear: i.purchases_per_year ?? 1, marginBand: i.margin_band ?? "" });
    return withGeo(fridayView(report, calc, { brand: report.brand?.name ?? "", categoryLabel: "Your category", repeatLabel: REPEAT_LABEL(i.purchases_per_year ?? 1), mapDataUrl: map }), market, fridayEligibility(report));
  }, [report, map]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgA = view ? kitSideA(view) : "";
  const svgB = view ? kitSideB(view) : "";
  const expo = pickExposure(report?.exposure, market, !!report?.mock);
  const physical = useMemo(() => loadPrefill()?.physical ?? null, []);
  async function dl() {
    const cover = full ? kitCover(kitSummary(full, expo.ex, physical, full.mock ? "mock" : "friday", typeof window !== "undefined" ? window.location.href.split("?")[0] : undefined)) : null;
    saveBlob(await kitPdfBlob(cover ? [cover, svgA, svgB] : [svgA, svgB]), "birch-reserve-monetization-kit.pdf");
    saveBlob(await kitPngBlob([svgA, svgB]), "birch-reserve-monetization-kit.png");
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
        <h1 className="font-display text-4xl md:text-6xl">Your report and Monetization Kit</h1>
        {/* Sharing from a private report shares the public intake, never this report's token link. */}
        <div className="mt-4"><ShareBar testId="share-bar-report" href="intake" text="Get your own free Monetization Kit: hub earnings and supplier exposure, estimated and reviewed by a person." /></div>
        {state === "loading" ? <p className="mt-6 flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Loading your report…</p> : null}
        {state === "draft" ? <p className="mt-6" data-testid="kit-report-draft">This Monetization Kit is still a draft. Finish it on <a href="/brand-kit" className="underline">your kit page</a>.</p> : null}
        {state === "missing" ? <p className="mt-6" data-testid="kit-report-missing">We couldn't find this kit. The link may have been rotated.</p> : null}
        {state === "error" ? <p className="mt-6">We couldn't load your report right now. Try again shortly.</p> : null}
        {report?.status?.public_mirror === "held" ? <p className="mt-6 rounded-xl bg-amber-50 p-3 text-amber-900" data-testid="kit-held">{HELD_COPY}</p> : null}
        <LeadGatesStatus gates={kitPending ? { review: "pending_review", mock: !!report?.mock } : null} testId="report-lead-gates" />
        {view && report?.status?.public_mirror !== "held" ? (
          /* Friday report design system v2 (report-design-system.md, Friday PR #214): hero + fit score, channel tiles,
             ranked hubs, then two labelled sides; the intake's first role decides which side comes first. */
          <div className="mt-6 space-y-6">
            <ReportV2
              report={full ?? report!}
              map={map}
              exposure={expo.ex}
              exposureSource={expo.source === "friday" ? "report" : "mock"}
              physical={physical}
              costExtra={
                <>
                  <div className="mt-5 rounded-[10px] p-4 text-white" style={{ background: RT.forest }} data-testid="report-cost">
                    <p className="text-xs text-white/70">Start</p>
                    <p className="text-2xl" style={{ fontFamily: RT_SERIF }}>$190 USD look · $490 USD reserve</p>
                    <p className="mt-1 text-[11px] text-white/70">Existing offers; refund and credit terms on /media-kit and /terms.</p>
                  </div>
                  <ExposureCard exposure={expo.ex} source={expo.source} testId="report-exposure" v2 />
                </>
              }
              earnCta={<PrimaryCta side="publisher" where="report" />}
            />
            <section className="p-3 md:p-6" style={{ background: RT.paper, borderRadius: 24, fontFamily: RT_SANS }} data-testid="report-kit">
              <h2 className="text-[24px] md:text-[28px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Build your Monetization Kit</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-full p-1" style={{ background: RT.track }} role="tablist">
                  {(["a", "b"] as const).map((s) => (
                    <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider" style={side === s ? { background: RT.forest, color: "#fff" } : { color: RT.mute }}>{s === "a" ? "Side A · Revenue" : "Side B · Exposure"}</button>
                  ))}
                </div>
                <button type="button" onClick={dl} data-testid="kit-report-download" className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold" style={{ background: RT.mint, color: RT.forest }}><Download className="size-4" />Download PDF + PNG</button>
                <span className="text-xs" style={{ color: RT.mute }}>LTV and channel fit from your report{report?.mock ? " (preview · mock data)" : ""}. Channel fit is subject to human confirmation.</span>
              </div>
              <div className="mt-4"><KitSides svgA={svgA} svgB={svgB} side={side} /></div>
            </section>
          </div>
        ) : null}
        {state !== "loading" ? <div className="mt-6" data-testid="report-primary-cta"><PrimaryCta side="advertiser" where="report" /></div> : null}
      </div>
      <CtaBand side="advertiser" where="report" />
    </div>
  );
}
