/**
 * /intake/supplier: supplier-first intake (Randy voice, Nov 19 2026 1:37 PM ET via Emma; first link out: Crossover
 * Symmetry). Same look as the /intake one form + Monetization Kit output, reworked to lead with the supplier:
 * - One form: brand, website, work email (+ optional detail in an expander). Accelerate (paid display) is an optional
 *   switch inside the Supplier card; the hub is included and pitched as the exposure play.
 * - Submit creates the supplier's OWN hub in "pending approval". Birch Reserve (Randy or Jon) approves it before it
 *   goes live; nothing auto-publishes. Sent on the existing brand-intake path with `hub_request` (role supplier,
 *   status pending_approval), a Birch-only key the server strips and tags into the v1 blurb + BR leads meta.
 * - Fees stay quiet (small print + expander): no setup fee, no monthly fee, 10% / ~35%, brand approves every
 *   placement; $5,000 stand-up fee struck through, waived for brands live before 2027. USD only.
 * - ?brand=crossover-symmetry prefills "Crossover Symmetry"; the plain URL works too. ?mock=1 = labelled preview mock.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Clock, Loader2, Package, Rocket, ShieldCheck, Sparkles, Store } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { MockBanner, basePayload } from "@/components/br/intake-kit";
import { Details } from "@/components/br/details";
import { DEFAULT_MARKET, MarketPicker } from "@/components/br/intake-geo";
import { FastReport, type QuickResult } from "@/components/br/fast-report";
import { numOrU } from "@/components/br/intake-details";
import { fridayIntake, saveRef, type IntakeRef } from "@/lib/fridayBrandIntake";
import { savePrefill } from "@/lib/intakePrefill";
import { fieldStart, trackIntake } from "@/lib/intakeTrack";
import type { IntakePayload, IntakeRole } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { RETAIL_COPY } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { FRIDAY_CATEGORIES } from "../../../../api-server/src/lib/kitCalc/fridayV12";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";

/** ?brand=crossover-symmetry → "Crossover Symmetry" (a typed name is kept as typed). */
export function brandFromParam(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().slice(0, 80);
  if (!v) return "";
  if (/[A-Z\s]/.test(v)) return v.replace(/\s+/g, " ");
  return v.split(/[-_]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
export const hubSlugOf = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/, "");
const hostOf = (w: string) => w.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0]!.toLowerCase().slice(0, 80) || "your site";

/** Fee lines (template Randy sent the brand). Quiet by design: small print + an expander, never a banner. */
export const SUPPLIER_FEES = {
  standUpUsd: 5000,
  waiver: "waived for brands live before 2027",
  lines: [
    { k: "own", v: "10%", l: "on post-purchase activated sales through your own hub" },
    { k: "network", v: "~35%", l: "on sales through partner clinics and other hubs" },
  ],
} as const;

const ERR: Record<string, string> = { fast_needs_website_email: "Add your website and a work email.", too_fast: "One sec: give it a moment and try again.", email: "Use a valid work email.", website: "Add your website.", individual_data: "Please keep it to business-level details.", rate_limited: "Too many tries. Please wait a minute." };
const input = "h-12 w-full rounded-xl border border-foreground/20 bg-white px-3 text-base outline-none focus:border-foreground focus:ring-2 focus:ring-accent";
const small = "h-11 w-full rounded-xl border border-foreground/20 bg-white px-3 text-sm outline-none focus:border-foreground";

function Steps({ done }: { done: boolean }) {
  const steps = [
    { icon: Package, t: "Tell us your products", s: "2 minutes" },
    { icon: Store, t: "We set up your hub", s: done ? "Created" : "Automatic" },
    { icon: ShieldCheck, t: "Goes live once approved", s: "You approve every placement" },
  ];
  return (
    <ol className="grid grid-cols-3 gap-2" data-testid="supplier-steps">
      {steps.map((x, i) => {
        const on = done ? i <= 1 : i === 0;
        return (
          <li key={x.t} className={`rounded-2xl p-3 ${on ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground ring-1 ring-foreground/10"}`}>
            <span className={`flex size-8 items-center justify-center rounded-full ${on ? "bg-lime-300 text-[#0b1f3a]" : "bg-foreground/[0.06]"}`}>{done && i <= 1 ? <Check className="size-4" /> : <x.icon className="size-4" aria-hidden />}</span>
            <p className="mt-2 text-[13px] font-bold leading-tight md:text-sm">{x.t}</p>
            <p className={`mt-0.5 hidden text-[11px] leading-tight sm:block ${on ? "text-white/70" : "text-foreground/55"}`}>{x.s}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Fees, kept quiet: three small chips + "How fees work". Strike-through stand-up fee, never a promo banner. */
export function SupplierFees({ testId = "supplier-fees" }: { testId?: string }) {
  return (
    <div className="mt-4 border-t border-foreground/10 pt-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-foreground/65">
        <span className="inline-flex items-center gap-1"><Check className="size-3.5 text-lime-600" />No setup fee</span>
        <span className="inline-flex items-center gap-1"><Check className="size-3.5 text-lime-600" />No monthly fee</span>
        <span className="inline-flex items-center gap-1"><Check className="size-3.5 text-lime-600" />You approve every placement</span>
      </div>
      <Details label="How fees work" testId="supplier-fee-details">
        <ul className="space-y-1" data-testid="supplier-fee-lines">
          {SUPPLIER_FEES.lines.map((f) => <li key={f.k}><strong className="text-foreground/80">{f.v}</strong> {f.l}</li>)}
          <li data-testid="supplier-standup-fee"><span className="text-foreground/80">Stand-up fee</span> <s className="text-foreground/45" data-testid="supplier-standup-struck">${SUPPLIER_FEES.standUpUsd.toLocaleString("en-US")} USD</s> · {SUPPLIER_FEES.waiver}</li>
        </ul>
        <p>No setup fee and no monthly fee. Fees apply only to sales, in USD. You approve every placement before it runs.</p>
      </Details>
    </div>
  );
}

function PendingHub({ brand, accelerate }: { brand: string; accelerate: boolean }) {
  return (
    <div data-testid="supplier-pending" className="rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
      <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-950 ring-1 ring-amber-300" data-testid="supplier-pending-chip"><Clock className="size-3.5" />Pending approval</p>
      <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl" data-testid="supplier-pending-title">Your hub is created and goes live once our team approves it.</h2>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#0b1f3a] p-4 text-white" data-testid="supplier-hub-card">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-lg font-black text-[#0b1f3a]">{(brand || "H").charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold" data-testid="supplier-hub-name">{brand ? `${brand} hub` : "Your hub"}</p>
          <p className="text-[12px] text-white/70">Max exposure · {accelerate ? "Accelerate requested" : "Performance-only"}</p>
        </div>
        <span className="hidden shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 sm:inline">Not live yet</span>
      </div>
      <div className="mt-4"><Steps done /></div>
      <Details testId="supplier-pending-details">
        <p>Birch Reserve reviews every new hub before it goes live. Nothing is published, booked or charged automatically, and you approve every placement.</p>
      </Details>
    </div>
  );
}

export default function BrIntakeSupplier() {
  usePageMeta("Supplier intake · Your own hub | Birch Reserve", "Suppliers: get your own hub on Birch Reserve. No setup fee, no monthly fee, you approve every placement. Goes live once our team approves it.");
  const prefill = useMemo(() => brandFromParam(typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("brand")), []);
  const [brand, setBrand] = useState(prefill);
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [accelerate, setAccelerate] = useState(false);
  const [more, setMore] = useState(false);
  const [skus, setSkus] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [market, setMarketRaw] = useState<Market>(DEFAULT_MARKET);
  const [marketTouched, setMarketTouched] = useState(false);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: IntakeRef } | null>(null);
  const [quick, setQuick] = useState<QuickResult | null>(null);
  const t0 = useRef(Date.now());
  useEffect(() => trackIntake("advertiser", "view", "supplier", { dedupe: true }), []);
  const setMarket = (m: Market) => { setMarketTouched(true); setMarketRaw(m); };
  const toggleCat = (k: string) => setCats((c) => (c.includes(k) ? c.filter((x) => x !== k) : c.length >= 3 ? c : [...c, k]));
  const roles: IntakeRole[] = ["supplier", "publisher", ...(accelerate ? (["kit"] as const) : [])];

  const buildPayload = (): IntakePayload => {
    const name = brand.trim();
    const slug = hubSlugOf(name || hostOf(website).split(".")[0] || "");
    return {
      ...basePayload("supplier"),
      roles,
      ...(name ? { company_name: name.slice(0, 120) } : {}),
      ...(marketTouched && market.sells_in.length ? { market } : {}),
      shared: { categories: cats, skus: numOrU(skus) },
      hub_request: { role: "supplier", status: "pending_approval", ...(name ? { hub_name: name.slice(0, 120) } : {}), ...(slug ? { hub_slug: slug } : {}) },
      notes: ["Supplier intake (/intake/supplier): own hub requested, pending Birch Reserve approval."],
    };
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (hp) return setDone({ ref: { id: "", editToken: "", reportToken: "", version: 0 } }); // honeypot: send nothing
    trackIntake("advertiser", "step_complete", "contact");
    setBusy(true);
    try {
      const payload = buildPayload();
      const contact = { email: email.trim(), website: website.trim(), elapsed_ms: Date.now() - t0.current };
      const fr = await fridayIntake().fast(payload, contact);
      saveRef("supplier", fr.ref);
      if (accelerate) saveRef("kit", fr.ref);
      const af = fr.autofill?.fields ?? {};
      savePrefill({ website: contact.website, email: contact.email, market, category: cats[0] ?? af.category?.value, categorySource: cats[0] ? "typed" : af.category ? "site" : "default", brand: brand.trim() || af.company_name?.value, aov: af.avg_cart_usd?.value, needs: fr.autofill?.needs_input });
      setDone({ ref: fr.ref });
      setQuick({ side: "advertiser", roles, host: hostOf(website), autofill: fr.autofill, fallback: fr.fallback, typedMarket: marketTouched ? market : null, held: fr.sub.public_mirror === "held", ref: fr.ref, payload, contact: { email: contact.email, website: contact.website }, shared: { brand: brand.trim(), categories: cats, skus, audience: "" }, brand: brand.trim() || null, category: cats[0] ?? null, physical: null });
      trackIntake("advertiser", "submit", "supplier");
      setTimeout(() => document.getElementById("supplier-top")?.scrollIntoView({ behavior: "smooth" }), 30);
    } catch (x) {
      trackIntake("advertiser", "submit_error", "supplier");
      setErr(ERR[(x as Error).message] ?? "Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="supplier-intake" id="supplier-top">
      <MockBanner />
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)]">
        <div className="container mx-auto max-w-5xl px-4 pb-10 pt-8 md:pt-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Birch Reserve · For suppliers</p>
          <h1 className="font-display text-4xl leading-[1.02] md:text-6xl" data-testid="supplier-h1">{prefill ? <>{prefill}, get your own hub.</> : "Get your own hub."}</h1>
          <p className="mt-2 max-w-2xl text-base text-muted-foreground">Your products in front of recovery customers. Pay only on results.</p>
          <p className="mt-3 inline-flex items-start gap-2 rounded-2xl bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#0b1f3a] ring-1 ring-foreground/10" data-testid="supplier-network">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-lime-600" aria-hidden /><span>{RETAIL_COPY} <span className="font-normal text-foreground/50">· network figures</span></span>
          </p>

          <div className="mt-6">
            {done ? (
              <PendingHub brand={brand.trim()} accelerate={accelerate} />
            ) : (
              <form onSubmit={submit} data-testid="supplier-form" data-roles={roles.join(",")} className="relative rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
                <Steps done={false} />
                <div className="mt-4 grid gap-2 md:grid-cols-2" data-testid="supplier-roles">
                  <div className="rounded-2xl border-2 border-[#0b1f3a] bg-[#0b1f3a] p-4 text-white shadow-lg" data-testid="supplier-role-card">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-lime-300 bg-lime-300 text-[#0b1f3a]"><Check className="size-4" /></span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2"><Package className="size-4 text-lime-300" aria-hidden /><span className="text-base font-bold">Supplier</span><span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0b1f3a]">Performance-only</span></span>
                        <span className="mt-1 block text-[13px] leading-snug text-white/80">Get into curated hubs. Pay on results.</span>
                      </span>
                    </div>
                    <button type="button" role="switch" aria-checked={accelerate} onClick={() => { setAccelerate((v) => !v); trackIntake("advertiser", "field_start", "accelerate", { dedupe: true }); }} data-testid="supplier-accelerate" className={`mt-3 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${accelerate ? "bg-lime-300 text-[#0b1f3a]" : "bg-white/10 text-white hover:bg-white/15"}`}>
                      <Rocket className={`size-5 shrink-0 ${accelerate ? "text-[#0b1f3a]" : "text-lime-300"}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-bold">Accelerate<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${accelerate ? "bg-[#0b1f3a] text-lime-300" : "bg-white/15 text-white/80"}`}>Optional</span></span>
                        <span className={`mt-0.5 block text-[12px] leading-snug ${accelerate ? "text-[#0b1f3a]/80" : "text-white/75"}`}>Add premium display placements to speed up exposure.</span>
                      </span>
                      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition ${accelerate ? "bg-[#0b1f3a]" : "bg-white/25"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${accelerate ? "left-[22px]" : "left-0.5"}`} /></span>
                    </button>
                  </div>
                  <div className="rounded-2xl border-2 border-lime-300 bg-lime-50 p-4" data-testid="supplier-hub-included">
                    <span className="flex flex-wrap items-center gap-2"><Store className="size-4 text-[#0b1f3a]" aria-hidden /><span className="text-base font-bold text-[#0b1f3a]">Your own hub</span><span className="rounded-full bg-[#0b1f3a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">Max exposure</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0b1f3a] ring-1 ring-lime-300">Included</span></span>
                    <span className="mt-1 block text-[13px] leading-snug text-foreground/70">Your shelf across retail hubs and partner clinics, set up for you.</span>
                    <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[#0b1f3a]"><BadgeCheck className="size-4 text-lime-600" />Goes live once our team approves it.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <input data-testid="supplier-brand" aria-label="Brand name" value={brand} onFocus={fieldStart("advertiser", "brand")} onChange={(e) => setBrand(e.target.value)} placeholder="Brand name" autoComplete="organization" className={input} />
                  <input data-testid="supplier-website" aria-label="Website" required value={website} onFocus={fieldStart("advertiser", "website")} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbrand.com" autoComplete="url" className={input} />
                  <input data-testid="supplier-email" aria-label="Work email" type="email" required value={email} onFocus={fieldStart("advertiser", "email")} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" autoComplete="email" className={input} />
                </div>
                <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

                <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} data-testid="supplier-more-toggle" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground/70 underline-offset-2 hover:underline">
                  <ChevronDown className={`size-4 transition ${more ? "rotate-180" : ""}`} />More detail (optional)
                </button>
                {more ? (
                  <div className="mt-3 grid gap-3 rounded-2xl bg-foreground/[0.03] p-3" data-testid="supplier-more">
                    <input data-testid="supplier-skus" aria-label="Products or SKUs" inputMode="numeric" value={skus} onChange={(e) => setSkus(e.target.value)} placeholder="Products / SKUs (e.g. 3)" className={`${small} md:w-64`} />
                    <div>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-foreground/60">Categories (up to 3)</span>
                      <div className="mt-1 flex flex-wrap gap-1.5" data-testid="supplier-categories">
                        {FRIDAY_CATEGORIES.map((c) => {
                          const on = cats.includes(c.key);
                          return <button key={c.key} type="button" aria-pressed={on} onClick={() => toggleCat(c.key)} data-testid={`supplier-cat-${c.key}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/75 ring-1 ring-foreground/15 hover:ring-foreground/40"}`}>{c.label}</button>;
                        })}
                      </div>
                    </div>
                    <MarketPicker value={market} onChange={setMarket} compact />
                  </div>
                ) : null}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-foreground/55">Business details only. Reviewed by a person. Nothing is charged.</p>
                  <button type="submit" disabled={busy} data-testid="supplier-submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-base font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30 transition hover:bg-[#0b1f3a] hover:text-white">
                    {busy ? <Loader2 className="size-5 animate-spin" /> : null} Create my hub <ArrowRight className="size-5" />
                  </button>
                </div>
                {err ? <p className="mt-2 text-sm font-semibold text-red-700" data-testid="supplier-error">{err}</p> : null}
                <SupplierFees />
              </form>
            )}
          </div>
        </div>
      </section>
      {done && quick ? (
        <section className="container mx-auto max-w-5xl px-4 pb-12" data-testid="supplier-kit">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Your Monetization Kit · Estimate</p>
          <FastReport q={quick} onAddDetail={() => { trackIntake("advertiser", "cta_click", "add_detail"); window.location.assign("/brand-kit#my-kit"); }} />
        </section>
      ) : null}
    </div>
  );
}
