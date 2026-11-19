/**
 * "Download my kit": the primary CTA (Randy, Nov 18 2026 9:57 PM ET). Light inputs → a personalized,
 * two-sided media kit (Side A revenue, Side B exposure) rendered on screen and downloaded as PDF + PNG.
 *
 * Numbers (Randy, 10:11 PM ET): while typing, the shared calculator module gives an instant "Live preview".
 * Once Friday answers (after submit), the LTV estimate and channel fit are shown EXACTLY as Friday returns
 * them (brand-report.v1 `ltv` + `demand_fit`), never recomputed here. Mock adapter on previews.
 */
import { loadPrefill } from "@/lib/intakePrefill";
import { IntakeWarnings } from "@/components/br/intake-warnings";
import { useBrandCategories } from "@/lib/brandCategories";
import { toBirchCategory } from "../../../../api-server/src/lib/kitCalc/fridayV12";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Download, Loader2, Check, Minus, Plus, Link2, ShieldAlert } from "lucide-react";
import { KIT_CALC_ASSUMPTIONS, KIT_CALC_CONFIG, KIT_CALC_FORMULA, kitCalc, repeatRange } from "../../../../api-server/src/lib/kitCalc";
import { KIT_FIT_FINE } from "../../../../api-server/src/lib/overhaul/brandIntake";
import type { IntakePayload } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { kitSideA, kitSideB, kitPdfBlob, kitPngBlob, saveBlob, imageToDataUrl } from "@/lib/kitRender";
import { previewView, fridayView, type KitView } from "@/lib/kitView";
import { EDIT_TOKEN_WARNING, HELD_COPY, adoptResumeFragment, fridayIntake, reportPath, resumeLink, saveRef, type FridayReport } from "@/lib/fridayBrandIntake";
import { EstimateTag, InfoPop, MockBanner, basePayload, useAutosave, SaveChip } from "@/components/br/intake-kit";
import { DEFAULT_MARKET, ExposureCard, MarketPicker, pickExposure } from "@/components/br/intake-geo";
import { LeadGatesStatus, PrimaryCta } from "@/components/br/intake-sell";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { withGeo } from "@/lib/kitView";
import { errorDetail, trackIntake } from "@/lib/intakeTrack";
import { fridayEligibility, reviewGates, type LeadGates } from "@/lib/fridayBrandIntake";

const numIn = "mt-1 h-12 w-full rounded-xl border border-foreground/20 bg-white px-3 text-base tabular-nums outline-none focus:border-foreground focus:ring-2 focus:ring-accent";
const lab = "block text-[11px] font-bold uppercase tracking-wider text-foreground/60";
const chip = (on: boolean) => `h-11 rounded-xl text-sm font-bold transition ${on ? "bg-foreground text-background shadow" : "bg-foreground/[0.06] hover:bg-foreground/[0.1]"}`;
const $ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const ERR: Record<string, string> = { too_fast: "One sec: give it a moment and try again.", email: "Use a valid work email.", website: "Add your brand's website.", individual_data: "Please keep it to brand-level details.", rate_limited: "Too many tries. Please wait a minute." };

export function KitBuilder({ id = "my-kit", showMockBanner = true }: { id?: string; showMockBanner?: boolean }) {
  const [pre] = useState(() => loadPrefill()); // fast → expanded hand-off (same tab)
  const [brand, setBrand] = useState(pre?.brand?.slice(0, 40) ?? "");
  const [cat, setCat] = useState<string>(pre?.category ?? "recovery_devices"); // Friday v1.2 §6 shared category key
  const cats = useBrandCategories();
  const [aov, setAov] = useState(pre?.aov ?? 80); // Friday v1.3 auto-fill (USD sites only), else the default
  const [orders, setOrders] = useState(500);
  const [repeat, setRepeat] = useState(KIT_CALC_CONFIG.repeatBands[1]!.key);
  const [band, setBand] = useState(KIT_CALC_CONFIG.marginBands[1]!.key);
  const [spend, setSpend] = useState(KIT_CALC_CONFIG.spendLevels[0]!.usd);
  const [conv, setConv] = useState(KIT_CALC_CONFIG.defaultConversionPct);
  const [market, setMarket] = useState<Market>(pre?.market ?? DEFAULT_MARKET);
  const [gates, setGates] = useState<LeadGates | null>(null);
  const [touched, setTouched] = useState(false);
  const [side, setSide] = useState<"a" | "b">("a");
  const [step, setStep] = useState<"inputs" | "contact">("inputs");
  const [email, setEmail] = useState(pre?.email ?? "");
  const [website, setWebsite] = useState(pre?.website ?? "");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [held, setHeld] = useState(false);
  const [queued, setQueued] = useState(false);
  const [report, setReport] = useState<FridayReport | null>(null);
  const [map, setMap] = useState<string | undefined>();
  const t0 = useRef(Date.now());
  useState(() => adoptResumeFragment("kit")); // #edit=… → localStorage before autosave reads the ref
  useEffect(() => {
    imageToDataUrl("/street-team/door-route.jpg").then(setMap);
    trackIntake("advertiser", "view", window.location.pathname.startsWith("/media-kit") ? "media_kit" : "brand_kit", { dedupe: true });
  }, []);
  const tap = <T,>(f: (v: T) => void) => (v: T) => { if (!touched) trackIntake("advertiser", "field_start", "inputs", { dedupe: true }); setTouched(true); setReport(null); f(v); };

  const ppyR = repeatRange(repeat);
  const repeatLabel = KIT_CALC_CONFIG.repeatBands.find((b) => b.key === repeat)!.label;
  const calc = useMemo(() => kitCalc({ aovUsd: aov, monthlyOrders: orders, purchasesPerYear: ppyR, marginBand: band, spendUsd: spend, conversionPct: conv }), [aov, orders, repeat, band, spend, conv]); // eslint-disable-line react-hooks/exhaustive-deps
  const catLabel = cats.find((c) => c.key === cat)?.label ?? cat;
  const birchCat = toBirchCategory(cat);
  const brandLabel = brand.trim().slice(0, 40);
  const payload: IntakePayload = {
    ...basePayload("kit"),
    ...(market.sells_in.length || market.ships_to.length ? { market } : {}),
    kit_calculator: { aov_usd: aov, monthly_orders: orders, purchases_per_year: ppyR[0], purchases_per_year_range: ppyR, repeat_band: repeat, margin_band: band, spend_usd: spend, conversion_pct: conv, category: cat, brand_label: brandLabel || undefined, calc_version: KIT_CALC_CONFIG.version },
  };
  const { ref, state, setRef } = useAutosave("kit", payload, touched);

  const view: KitView = useMemo(
    () => withGeo(report ? fridayView(report, calc, { brand: brandLabel, categoryLabel: catLabel, repeatLabel, mapDataUrl: map }) : previewView(calc, { brand: brandLabel, categoryKey: birchCat, categoryLabel: catLabel, repeatLabel, mapDataUrl: map }), market, fridayEligibility(report)),
    [report, calc, brandLabel, cat, map, market], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const expo = pickExposure(report?.exposure, market, !!report?.mock);
  const svgA = useMemo(() => kitSideA(view), [view]);
  const svgB = useMemo(() => kitSideB(view), [view]);

  async function exportKit(reportToken: string | null) {
    const slug = (brandLabel || "my").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my";
    saveBlob(await kitPdfBlob([svgA, svgB]), `birch-reserve-kit-${slug}.pdf`);
    saveBlob(await kitPngBlob([svgA, svgB]), `birch-reserve-kit-${slug}.png`);
    trackIntake("advertiser", "kit_download", "pdf");
    trackIntake("advertiser", "kit_download", "png");
    if (reportToken) for (const f of ["pdf", "png"] as const) await fridayIntake().download(reportToken, f).catch(() => undefined); // kit_download lead event
  }

  async function getKit() {
    if (step === "inputs" && !report) {
      trackIntake("advertiser", "step_complete", "calculator");
      return setStep("contact");
    }
    setErr(null);
    setBusy("busy");
    try {
      if (report && ref) {
        await exportKit(ref.reportToken);
        return setBusy("done");
      }
      if (hp) return setBusy("done"); // honeypot: pretend success, send nothing
      trackIntake("advertiser", "step_complete", "contact");
      const api = fridayIntake();
      const r0 = ref ?? (await api.create(payload));
      const r1 = await api.update(r0, payload).catch(() => r0);
      const sub = await api.submit(r1, payload, { email: email.trim(), website: website.trim(), elapsed_ms: Date.now() - t0.current });
      const next = { ...r1, version: sub.version };
      saveRef("kit", next);
      setRef(next);
      trackIntake("advertiser", "submit", r0.version >= 1 ? "update" : "kit");
      trackIntake("advertiser", "mode", "expanded");
      setGates(reviewGates(sub, sub.mock));
      if (sub.public_mirror === "held") {
        setHeld(true);
        await exportKit(next.reportToken); // preview kit only; Friday's numbers are released after review
        return setBusy("done");
      }
      const rep = await api.reportView(next.reportToken, "brand");
      if (rep?.ready) {
        setReport(rep.report);
      }
      else {
        setQueued(true); // received by Friday; the full report is released once Friday's kit report is live
        await exportKit(null);
      }
      setBusy("done");
    } catch (e) {
      trackIntake("advertiser", "submit_error", errorDetail((e as Error).message));
      setErr(ERR[(e as Error).message] ?? "Couldn't reach Friday. Your inputs are saved on this device; try again.");
      setBusy("error");
    }
  }
  // After Friday answers, re-render with Friday's numbers, then export.
  const pendingExport = useRef(false);
  useEffect(() => {
    if (report && busy === "done" && !pendingExport.current && ref) {
      pendingExport.current = true;
      exportKit(ref.reportToken).catch(() => undefined);
    }
  }, [svgA]); // eslint-disable-line react-hooks/exhaustive-deps

  const ltv = view.ltvGp;
  return (
    <section id={id} data-testid="kit-builder" className="scroll-mt-20 border-b border-border/70 bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_50%)]">
      {showMockBanner ? <MockBanner /> : null}
      <div className="container mx-auto grid gap-6 px-4 py-10 md:py-14 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Your personalized media kit</p>
          <h2 className="font-display text-4xl leading-[1.02] md:text-5xl">Download my kit</h2>
          <p className="mt-2 text-sm text-muted-foreground">Four quick numbers. A two-sided kit: your revenue opportunity and your exposure opportunity.</p>
          <div className="mt-2"><SaveChip state={state} version={ref?.version} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className={lab}>Brand (optional)</span>
              <input data-testid="kit-brand" value={brand} maxLength={40} onChange={(e) => tap(setBrand)(e.target.value)} placeholder="Your brand" className={numIn} />
            </label>
            <label className="col-span-2">
              <span className={lab}>Category</span>
              <select data-testid="kit-category" value={cat} onChange={(e) => tap(setCat)(e.target.value)} className={numIn}>
                {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
            <div className="col-span-2">
              <span className={lab}>Average cart (USD)</span>
              <div className="mt-1 flex items-center gap-3">
                <input data-testid="kit-aov" type="number" inputMode="decimal" min={0} value={aov} onChange={(e) => tap(setAov)(Math.max(0, Number(e.target.value)))} className={`${numIn} mt-0 w-28 shrink-0`} />
                <input data-testid="kit-aov-slider" aria-label="Average cart slider" type="range" min={KIT_CALC_CONFIG.cartSlider.min} max={KIT_CALC_CONFIG.cartSlider.max} step={KIT_CALC_CONFIG.cartSlider.step} value={Math.min(aov, KIT_CALC_CONFIG.cartSlider.max)} onChange={(e) => tap(setAov)(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-[#0b1f3a]" />
              </div>
            </div>
            <div className="col-span-2">
              <span className={lab}>Orders or bookings / month</span>
              <div className="mt-1 flex items-center gap-2" data-testid="kit-orders-stepper">
                {[...KIT_CALC_CONFIG.ordersStepper.steps].reverse().map((s) => (
                  <button key={`-${s}`} type="button" aria-label={`Minus ${s}`} onClick={() => tap(setOrders)(Math.max(0, orders - s))} className="inline-flex h-12 min-w-12 items-center justify-center rounded-xl bg-foreground/[0.06] px-2 text-xs font-bold"><Minus className="size-3" />{s}</button>
                ))}
                <input data-testid="kit-orders" type="number" inputMode="numeric" min={0} value={orders} onChange={(e) => tap(setOrders)(Math.max(0, Math.round(Number(e.target.value))))} className={`${numIn} mt-0 text-center`} />
                {KIT_CALC_CONFIG.ordersStepper.steps.map((s) => (
                  <button key={`+${s}`} type="button" aria-label={`Plus ${s}`} onClick={() => tap(setOrders)(orders + s)} className="inline-flex h-12 min-w-12 items-center justify-center rounded-xl bg-foreground/[0.06] px-2 text-xs font-bold"><Plus className="size-3" />{s}</button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <span className={lab}>Repeat purchases / customer / year</span>
              <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" data-testid="kit-repeat">
                {KIT_CALC_CONFIG.repeatBands.map((b) => (
                  <button key={b.key} type="button" role="radio" aria-checked={repeat === b.key} onClick={() => tap(setRepeat)(b.key)} className={chip(repeat === b.key)}>{b.label}</button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <span className={lab}>Gross margin</span>
              <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" data-testid="kit-margin">
                {KIT_CALC_CONFIG.marginBands.map((b) => (
                  <button key={b.key} type="button" role="radio" aria-checked={band === b.key} onClick={() => tap(setBand)(b.key)} className={chip(band === b.key)}>{b.label}</button>
                ))}
              </div>
            </div>
            <div className="col-span-2"><MarketPicker value={market} onChange={(m) => tap(setMarket)(m)} compact /></div>
            <label>
              <span className={lab}>Scale test spend</span>
              <select data-testid="kit-spend" value={spend} onChange={(e) => tap(setSpend)(Number(e.target.value))} className={numIn}>
                {KIT_CALC_CONFIG.spendLevels.map((s) => <option key={s.usd} value={s.usd}>{s.label}</option>)}
              </select>
            </label>
            <label>
              <span className={lab}>Conversion scenario</span>
              <select data-testid="kit-conv" value={conv} onChange={(e) => tap(setConv)(Number(e.target.value))} className={numIn}>
                {KIT_CALC_CONFIG.conversionScenariosPct.map((p) => <option key={p} value={p}>{p}% of visits</option>)}
              </select>
            </label>
          </div>
          <div className="mt-5 rounded-2xl bg-[#0b1f3a] p-4 text-white" data-testid="kit-quick" data-source={view.source}>
            <div className="flex items-center gap-2"><EstimateTag /><span className="text-xs text-white/70">GP LTV per customer</span>
              <span data-testid="kit-source" className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${view.source === "friday" ? "bg-lime-300 text-[#0b1f3a]" : "bg-white/15 text-white"}`}>{view.source === "friday" ? (view.mock ? "From Friday · mock" : "From Friday") : "Live preview"}</span>
              <span className="ml-auto"><InfoPop dark title="Formula and assumptions" label="Formula" testId="kit-formula">{(view.source === "friday" ? view.formula : KIT_CALC_FORMULA).map((f) => <p key={f}>• {f}</p>)}<hr className="my-2" />{KIT_CALC_ASSUMPTIONS.map((a) => <p key={a} className="text-xs">{a}</p>)}<p className="mt-2 text-xs">While you type, numbers are a live preview. After you send, the LTV and channel fit come from Friday as returned.</p></InfoPop></span>
            </div>
            <p className="mt-1 font-display text-3xl tabular-nums text-lime-200" data-testid="kit-ltv">{ltv ? `${$(ltv[0])}–${$(ltv[1])}` : "Needs inputs"}</p>
            <p className="text-xs text-white/70">Revenue opportunity {$(view.revenueOpp[0])}–{$(view.revenueOpp[1])} from a {$(spend)} USD test <EstimateTag /></p>
            {view.source === "friday" ? <p className="mt-1 text-[11px] text-lime-200/90">Channel fit: {view.fitHeader}</p> : null}
          </div>
          <div className="mt-3"><ExposureCard exposure={expo.ex} source={expo.source} testId="kit-exposure" /></div>
          {step === "contact" && !report && !held ? (
            <div className="mt-4 grid gap-2 rounded-2xl border border-foreground/15 bg-white p-4" data-testid="kit-contact">
              <p className="text-sm font-semibold">Where should we send your kit?</p>
              <p className="text-xs text-muted-foreground">Brand-level only. Friday checks the numbers and confirms fit by hand. Nothing is booked or charged.</p>
              <input data-testid="kit-website" onFocus={() => trackIntake("advertiser", "field_start", "website", { dedupe: true })} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbrand.com" autoComplete="url" className={numIn} />
              <input data-testid="kit-email" onFocus={() => trackIntake("advertiser", "field_start", "email", { dedupe: true })} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbrand.com" autoComplete="email" className={numIn} />
              <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
            </div>
          ) : null}
          {err ? <p className="mt-2 text-sm font-semibold text-red-700" data-testid="kit-error">{err}</p> : null}
          {queued ? <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm" data-testid="kit-queued">Received as pending review. Your kit above is a live preview; the full report from Friday follows after review.</p> : null}
          {held ? <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="kit-held"><ShieldAlert className="size-4 shrink-0" />{HELD_COPY}</p> : null}
          <LeadGatesStatus gates={gates} testId="kit-lead-gates" />
          <IntakeWarnings testId="kit-warnings" />
          <button type="button" data-testid="kit-download" onClick={getKit} disabled={busy === "busy"} className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-bold text-accent-foreground shadow-lg shadow-lime-500/20 transition hover:bg-foreground hover:text-background">
            {busy === "busy" ? <Loader2 className="size-5 animate-spin" /> : busy === "done" ? <Check className="size-5" /> : <Download className="size-5" />} {busy === "done" ? "Kit downloaded (PDF + PNG)" : step === "contact" && !report ? "Get my kit" : "Download my kit"}
          </button>
          {busy === "done" || queued || held ? <div className="mt-4" data-testid="kit-next-cta"><PrimaryCta side="advertiser" where="kit" /></div> : null}
          {ref && (report || held) ? (
            <div className="mt-3 space-y-1 text-sm" data-testid="kit-links">
              {report ? <Link href={reportPath(ref.reportToken)} className="font-semibold underline" data-testid="kit-report-link">Open your report</Link> : null}
              <p><button type="button" data-testid="kit-resume-copy" onClick={() => navigator.clipboard?.writeText(resumeLink(ref)).catch(() => undefined)} className="inline-flex items-center gap-1 font-semibold underline"><Link2 className="size-3.5" />Copy your “Resume editing” link</button></p>
              <p className="text-[11px] text-muted-foreground">{EDIT_TOKEN_WARNING}</p>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] text-muted-foreground">PDF + PNG. Estimates only. Anchor hubs are proposed and unconfirmed. <InfoPop title="Fit and figures" label="Fine print" testId="kit-fine"><p>{KIT_FIT_FINE}</p><p>Channel fit is subject to human confirmation. No checkout here. Prices, refunds and the prepaid + IO rules are on /media-kit and /terms.</p></InfoPop></p>
        </div>
        <div>
          <div className="mb-3 inline-flex rounded-full bg-foreground/[0.06] p-1" role="tablist">
            {(["a", "b"] as const).map((s) => (
              <button key={s} role="tab" aria-selected={side === s} data-testid={`kit-side-tab-${s}`} onClick={() => setSide(s)} className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider ${side === s ? "bg-foreground text-background" : "text-foreground/60"}`}>
                {s === "a" ? "Side A · Revenue" : "Side B · Exposure"}
              </button>
            ))}
          </div>
          <KitSides svgA={svgA} svgB={svgB} side={side} />
        </div>
      </div>
    </section>
  );
}

export function KitSides({ svgA, svgB, side }: { svgA: string; svgB: string; side: "a" | "b" }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div data-testid="kit-side-a" className={`${side === "a" ? "block" : "hidden"} overflow-hidden rounded-2xl shadow-2xl xl:block [&>svg]:h-auto [&>svg]:w-full`} dangerouslySetInnerHTML={{ __html: svgA }} />
      <div data-testid="kit-side-b" className={`${side === "b" ? "block" : "hidden"} overflow-hidden rounded-2xl shadow-2xl xl:block [&>svg]:h-auto [&>svg]:w-full`} dangerouslySetInnerHTML={{ __html: svgB }} />
    </div>
  );
}
