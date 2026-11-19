/** /kit/r/:reportToken (noindex): the two-sided kit rendered from Friday's brand-report.v1 (view=brand). */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Download, Loader2 } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { CtaBand, LeadGatesStatus, PrimaryCta } from "@/components/br/intake-sell";
import { ExposureCard, pickExposure } from "@/components/br/intake-geo";
import { EstimateTag } from "@/components/br/intake-kit";
import { withGeo } from "@/lib/kitView";
import { trackIntake } from "@/lib/intakeTrack";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { MockBanner } from "@/components/br/intake-kit";
import { KitSides } from "@/components/br/kit-builder";
import { fridayEligibility, fridayIntake, HELD_COPY, type FridayReport } from "@/lib/fridayBrandIntake";
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
  const [pubMoney, setPubMoney] = useState<{ low: number; high: number } | null>(null);
  useEffect(() => {
    if (!report?.roles?.includes("publisher")) return;
    fridayIntake().reportView(token, "publisher").then((r) => {
      const m = r && r.ready ? (r.report.role_data?.publisher_monetization as { monthly_usd?: { low: number; high: number } | null } | undefined)?.monthly_usd : null;
      if (m && typeof m.low === "number" && typeof m.high === "number") setPubMoney(m);
    }).catch(() => undefined);
  }, [report, token]);
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
  const cpm = report?.headline?.best_fit_cpm_usd;
  const cpc = report?.headline?.best_fit_cpc_usd;
  async function dl() {
    saveBlob(await kitPdfBlob([svgA, svgB]), "birch-reserve-kit.pdf");
    saveBlob(await kitPngBlob([svgA, svgB]), "birch-reserve-kit.png");
    for (const f of ["pdf", "png"] as const) {
      trackIntake("advertiser", "kit_download", f);
      await fridayIntake().download(token, f).catch(() => undefined);
    }
  }
  const $ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
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
        <LeadGatesStatus gates={kitPending ? { review: "pending_review", mock: !!report?.mock } : null} testId="report-lead-gates" />
        {view && report?.status?.public_mirror !== "held" ? (
          /* Two halves, ready to align with Friday's report-design-system.md (publisher earnings vs advertiser cost). */
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section data-report-half="advertiser-cost" data-testid="report-half-advertiser" className="rounded-3xl border border-foreground/10 bg-white/60 p-4 md:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Advertiser · what it costs, what you reach</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#0b1f3a] p-4 text-white" data-testid="report-cost">
                  <p className="text-xs text-white/70">Start</p>
                  <p className="font-display text-2xl">$190 USD look · $490 USD reserve</p>
                  <p className="mt-1 text-[11px] text-white/70">Existing offers; refund and credit terms on /media-kit and /terms.</p>
                </div>
                <div className="rounded-2xl bg-foreground/[0.04] p-4" data-testid="report-rates">
                  <p className="text-xs text-muted-foreground">Best-fit placements <span className="ml-1 inline-block align-middle"><EstimateTag /></span></p>
                  <p className="font-display text-2xl tabular-nums">{cpm ? `${$(cpm.low)}–${$(cpm.high)} CPM` : "— (needs rate)"}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">{cpc ? `$${cpc.low.toFixed(2)}–$${cpc.high.toFixed(2)} CPC` : ""}</p>
                </div>
              </div>
              <div className="mt-4"><ExposureCard exposure={expo.ex} source={expo.source} testId="report-exposure" /></div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-full bg-foreground/[0.06] p-1" role="tablist">
                  {(["a", "b"] as const).map((s) => (
                    <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${side === s ? "bg-foreground text-background" : "text-foreground/60"}`}>{s === "a" ? "Side A · Revenue" : "Side B · Exposure"}</button>
                  ))}
                </div>
                <button type="button" onClick={dl} data-testid="kit-report-download" className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground"><Download className="size-4" />Download PDF + PNG</button>
                <span className="text-xs text-muted-foreground">LTV and channel fit as returned by Friday{report?.mock ? " (mock on preview)" : ""}. Channel fit is subject to human confirmation.</span>
              </div>
              <div className="mt-4"><KitSides svgA={svgA} svgB={svgB} side={side} /></div>
            </section>
            <section data-report-half="publisher-earnings" data-testid="report-half-publisher" className="self-start rounded-3xl border border-foreground/10 bg-lime-50/60 p-4 md:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Publisher · what a hub earns</p>
              {pubMoney ? (
                <div className="mt-3" data-testid="report-publisher-money">
                  <p className="font-display text-3xl tabular-nums">{$(pubMoney.low)}–{$(pubMoney.high)}<span className="text-base"> / month</span></p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><EstimateTag /> From Friday · your own surfaces, at the last ramp step.</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground" data-testid="report-publisher-empty">Run a hub too? Publishers keep a share of media revenue from their own screens and pages. Estimates only, reviewed by a person.</p>
              )}
              <div className="mt-4"><PrimaryCta side="publisher" where="report" /></div>
            </section>
          </div>
        ) : null}
        {state !== "loading" ? <div className="mt-6" data-testid="report-primary-cta"><PrimaryCta side="advertiser" where="report" /></div> : null}
      </div>
      <CtaBand side="advertiser" where="report" />
    </div>
  );
}
