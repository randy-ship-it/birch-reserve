/**
 * ONE FORM intake, the default on /intake (Randy voice 8:30 AM + via Emma 9:34 AM ET, Nov 19 2026).
 * - Roles: Supplier (performance-only terms: pay on results, no CPC/CPM) + Hub, BOTH preselected (Randy 9:39 AM ET). Accelerate (premium
 *   display placements) is an option INSIDE the supplier card, never a separate "advertiser" role (sent as the kit role).
 *   Category / area locks keep their own page. Visitor copy never says advertiser / publisher / sponsor.
 * - Positive framing: a hub unlocks maximum performance exposure (shelf space and eyeballs); supplier-only still works.
 * - Fast first: website + work email + one button. Shared answers (brand, location, categories, SKUs, audience) are
 *   optional here and asked ONCE for both sides. Role-specific detail comes after the submit (IntakeDetails), prefilled,
 *   updating the same record. Friday is contacted only on the final click (server routes add the secret).
 */
import { IntakeWarnings } from "@/components/br/intake-warnings";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, ChevronDown, Loader2, ShieldAlert, Store, Package, Plus, Rocket } from "lucide-react";
import type { IntakeRole } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { RETAIL_COPY, RETAIL_TAG } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { FRIDAY_CATEGORIES } from "../../../../api-server/src/lib/kitCalc/fridayV12";
import { HELD_COPY, PARTIAL_EMAIL_RE, adapterMode, fridayIntake, reportPath, saveRef, type IntakeRef } from "@/lib/fridayBrandIntake";
import { basePayload } from "@/components/br/intake-kit";
import { LeadGatesStatus, PrimaryCta } from "@/components/br/intake-sell";
import { DEFAULT_MARKET, MarketPicker } from "@/components/br/intake-geo";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { errorDetail, fieldStart, trackIntake, type IntakeSide } from "@/lib/intakeTrack";
import { reviewGates, type LeadGates } from "@/lib/fridayBrandIntake";
import { savePrefill } from "@/lib/intakePrefill";
import { birchHref } from "@/lib/shareTrack";
import { FastReport, type QuickResult } from "@/components/br/fast-report";
import { numOrU, type SharedAnswers } from "@/components/br/intake-details";
import { Details } from "@/components/br/details";
import { cleanPhysical, inLocationReach, type PhysicalAnswer } from "../../../../api-server/src/lib/overhaul/inLocation";
import { ExposureLadder, SupplierDone, SupplierFees, brandFromUrl, hubSlugOf, levelOf, rolesForLevel, type IntakePreset } from "@/components/br/supplier-mode";

/** "Do you have physical locations?" (Randy, Nov 19 2026 10:54 AM ET): yes/no; if yes, how many + monthly visitors. */
export type PhysForm = { has: boolean | null; locations: string; visitors: string; basis: "per_location" | "total" };
export const EMPTY_PHYS: PhysForm = { has: null, locations: "", visitors: "", basis: "per_location" };
export const physOf = (p: PhysForm): PhysicalAnswer | undefined => (p.has === null ? undefined : cleanPhysical({ has: p.has, locations: numOrU(p.locations), visitors_month: numOrU(p.visitors), basis: p.basis }) ?? undefined);
const fmt = (n: number) => n.toLocaleString("en-US");

export function LocationsQuestion({ value: p, onChange, side }: { value: PhysForm; onChange: (p: PhysForm) => void; side: IntakeSide }) {
  const seg = (on: boolean) => `h-9 rounded-full px-4 text-sm font-bold transition ${on ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/75 ring-1 ring-foreground/15 hover:ring-foreground/40"}`;
  const reach = inLocationReach(physOf(p));
  return (
    <div className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3" data-testid="intake-locations">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-bold text-[#0b1f3a]">Physical locations?</span>
        <button type="button" aria-pressed={p.has === true} onClick={() => { onChange({ ...p, has: true }); trackIntake(side, "field_start", "locations", { dedupe: true }); }} className={seg(p.has === true)} data-testid="locations-yes">Yes</button>
        <button type="button" aria-pressed={p.has === false} onClick={() => onChange({ ...p, has: false })} className={seg(p.has === false)} data-testid="locations-no">No</button>
      </div>
      {p.has ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr]">
          <label className="block min-w-0"><span className="text-[11px] font-bold uppercase tracking-wide text-foreground/55">Locations</span>
          <input data-testid="locations-count" aria-label="Number of locations" inputMode="numeric" value={p.locations} onChange={(e) => onChange({ ...p, locations: e.target.value })} placeholder="e.g. 12" className={`mt-0.5 ${small}`} /></label>
          <label className="block min-w-0"><span className="text-[11px] font-bold uppercase tracking-wide text-foreground/55">Visitors a month (est.)</span>
          <div className="mt-0.5 flex min-w-0 gap-2">
            <input data-testid="locations-visitors" aria-label="Estimated visitors a month" inputMode="numeric" value={p.visitors} onChange={(e) => onChange({ ...p, visitors: e.target.value })} placeholder="e.g. 3000" className={`${small} min-w-0`} />
            <div className="flex shrink-0 rounded-xl bg-white p-0.5 ring-1 ring-foreground/15" role="radiogroup" aria-label="Visitors are">
              {(["per_location", "total"] as const).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={p.basis === b} onClick={() => onChange({ ...p, basis: b })} data-testid={`locations-basis-${b}`} className={`rounded-lg px-2.5 text-xs font-bold ${p.basis === b ? "bg-[#0b1f3a] text-white" : "text-foreground/70"}`}>{b === "total" ? "total" : "each"}</button>
              ))}
            </div>
          </div></label>
          {reach ? <p className="text-[12px] text-foreground/65 sm:col-span-2" data-testid="locations-reach">≈ {fmt(reach.monthlyVisits)} in-person visits a month. Shown in your kit as In-location display.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

const hostOf = (w: string) => w.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0]!.toLowerCase().slice(0, 80) || "your site";
const input = "h-12 w-full rounded-xl border border-foreground/20 bg-white px-3 text-base outline-none focus:border-foreground focus:ring-2 focus:ring-accent";
const small = "h-11 w-full rounded-xl border border-foreground/20 bg-white px-3 text-sm outline-none focus:border-foreground";
const ERR: Record<string, string> = { fast_needs_website_email: "Add your website and a work email to get your Monetization Kit.", too_fast: "One sec: give it a moment and try again.", email: "Use a valid work email.", website: "Add your website.", individual_data: "Please keep it to business-level details (no customer names or contacts).", rate_limited: "Too many tries. Please wait a minute." };

export type OneFormRoles = { supplier: boolean; hub: boolean; accelerate: boolean };
export const rolesOf = (r: OneFormRoles): IntakeRole[] => [...(r.supplier ? (["supplier"] as const) : []), ...(r.hub ? (["publisher"] as const) : []), ...(r.supplier && r.accelerate ? (["kit"] as const) : [])];
const sideFor = (r: OneFormRoles): IntakeSide => (r.hub && !r.supplier ? "publisher" : "advertiser");
const EMPTY_SHARED: SharedAnswers = { brand: "", categories: [], skus: "", audience: "" };

function RoleCard({ on, onClick, icon: Icon, title, sub, tag, testId, children }: { on: boolean; onClick: () => void; icon: typeof Store; title: string; sub: string; tag?: string; testId: string; children?: ReactNode }) {
  return (
    <div data-testid={`${testId}-card`} className={`rounded-2xl border-2 p-4 transition ${on ? "border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg" : "border-foreground/15 bg-white hover:border-foreground/40"}`}>
      <button type="button" role="checkbox" aria-checked={on} onClick={onClick} data-testid={testId} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-lime-300 bg-lime-300 text-[#0b1f3a]" : "border-foreground/30"}`}>{on ? <Check className="size-4" /> : null}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2"><Icon className={`size-4 ${on ? "text-lime-300" : "text-foreground/50"}`} aria-hidden /><span className="text-base font-bold">{title}</span>{tag ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${on ? "bg-lime-300 text-[#0b1f3a]" : "bg-foreground/[0.07] text-foreground/70"}`}>{tag}</span> : null}</span>
          <span className={`mt-1 block text-[13px] leading-snug ${on ? "text-white/80" : "text-foreground/65"}`}>{sub}</span>
        </span>
      </button>
      {children}
    </div>
  );
}

/** Accelerate lives INSIDE the supplier card: the accelerated supplier option (premium display), never a separate "advertiser" role. */
function AccelerateToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} data-testid="intake-accelerate" className={`mt-3 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${on ? "bg-lime-300 text-[#0b1f3a]" : "bg-white/10 text-white hover:bg-white/15"}`}>
      <Rocket className={`size-5 shrink-0 ${on ? "text-[#0b1f3a]" : "text-lime-300"}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-bold">Accelerate<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${on ? "bg-[#0b1f3a] text-lime-300" : "bg-white/15 text-white/80"}`}>Optional</span></span>
        <span className={`mt-0.5 block text-[12px] leading-snug ${on ? "text-[#0b1f3a]/80" : "text-white/75"}`}>Add premium display placements to speed up exposure.</span>
      </span>
      <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-[#0b1f3a]" : "bg-white/25"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span>
    </button>
  );
}

/** preset "supplier" (/intake/supplier): exposure ladder instead of role cards, brand prefill (?brand=), quiet fees, own hub as pending approval. No preset = the default /intake, unchanged. */
export function IntakeShortForm({ onExpand, preset }: { onExpand?: (side: IntakeSide) => void; preset?: IntakePreset }) {
  const sup = preset === "supplier";
  const [r, setR] = useState<OneFormRoles>({ supplier: true, hub: true, accelerate: false });
  const roles = rolesOf(r);
  const side = sideFor(r);
  const [market, setMarketRaw] = useState<Market>(DEFAULT_MARKET);
  const [marketTouched, setMarketTouched] = useState(false);
  const setMarket = (m: Market) => { setMarketTouched(true); setMarketRaw(m); };
  const [shared, setShared] = useState<SharedAnswers>(() => (sup ? { ...EMPTY_SHARED, brand: brandFromUrl() } : EMPTY_SHARED));
  const [phys, setPhys] = useState<PhysForm>(EMPTY_PHYS);
  const [more, setMore] = useState(false);
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: IntakeRef; held: boolean; gates: LeadGates | null } | null>(null);
  const [quick, setQuick] = useState<QuickResult | null>(null);
  const t0 = useRef(Date.now());
  useEffect(() => trackIntake(side, "view", "intake", { dedupe: true }), [side]);
  // Drop-off nudge resume link (Randy, Nov 19 2026 10:54 AM ET): /intake?resume=<signed token> reopens the form
  // prefilled (email, website, roles). ?mock=1&resume=demo shows the prefilled state on previews without the API.
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("resume");
    if (!t) return;
    const apply = (x: { email?: string; website?: string; roles?: string[] }) => {
      if (x.email) setEmail(x.email);
      if (x.website) setWebsite(x.website);
      if (x.roles?.length) setR((c) => ({ supplier: x.roles!.includes("supplier") || (!x.roles!.includes("publisher") && c.supplier), hub: x.roles!.includes("publisher"), accelerate: x.roles!.includes("kit") }));
      setResumed(true);
      trackIntake(side, "step_complete", "resume", { dedupe: true });
    };
    if (t === "demo" && adapterMode() === "mock") return apply({ email: "test+resume@silverbirchgrowth.com", website: "example-brand.com", roles: ["supplier", "publisher"] });
    fetch(`/v1/kit-resume?t=${encodeURIComponent(t)}`).then((r) => (r.ok ? r.json() : null)).then((x) => x && apply(x)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const flip = (k: keyof OneFormRoles) => {
    setR((cur) => {
      const next = { ...cur, [k]: !cur[k] };
      if (k === "accelerate" && !cur.supplier) return cur; // Accelerate is a supplier option
      if (!next.supplier) next.accelerate = false;
      if (!next.supplier && !next.hub) return cur; // keep at least one
      return next;
    });
    trackIntake("advertiser", "field_start", k === "supplier" ? "supplier" : k === "hub" ? "add_hub" : "accelerate", { dedupe: true });
  };
  const addHub = () => { setR((c) => ({ ...c, hub: true })); trackIntake("advertiser", "cta_click", "add_hub"); };
  const toggleCat = (k: string) => setShared((s) => ({ ...s, categories: s.categories.includes(k) ? s.categories.filter((x) => x !== k) : s.categories.length >= 3 ? s.categories : [...s.categories, k] }));

  const buildPayload = () => ({
    ...basePayload(roles[0]!),
    roles,
    ...(marketTouched && market.sells_in.length ? { market } : {}),
    ...(shared.brand.trim() ? { company_name: shared.brand.trim() } : {}),
    shared: { categories: shared.categories, skus: numOrU(shared.skus), audience_customers: numOrU(shared.audience), ...(physOf(phys) ? { physical: physOf(phys) } : {}) },
    // Supplier preset + own hub: the hub is created as pending_approval (Randy or Jon approve; never auto-publish).
    ...(sup && r.hub ? { hub_request: { role: "supplier" as const, status: "pending_approval" as const, ...(shared.brand.trim() ? { hub_name: shared.brand.trim().slice(0, 120) } : {}), ...(hubSlugOf(shared.brand.trim() || hostOf(website).split(".")[0]!) ? { hub_slug: hubSlugOf(shared.brand.trim() || hostOf(website).split(".")[0]!) } : {}) }, notes: [`Supplier intake (/intake/supplier), exposure level ${levelOf(r)}: ${r.accelerate ? "own hub + CPM/CPC display" : "own hub"}, pending Birch Reserve approval.`] } : sup ? { notes: ["Supplier intake (/intake/supplier), exposure level 1: performance only."] } : {}),
  });
  // Partial lead (Randy via Emma, Nov 19 2026 10:21 AM ET): once the email is valid, save what's filled in
  // (debounced) and keep updating the SAME record. It stays "abandoned" until the final click flips it to submitted.
  // Never without a valid email; never for the honeypot. ?mock=1 keeps it in this browser.
  const partialRef = useRef<IntakeRef | null>(null);
  const partialBusy = useRef<Promise<void> | null>(null);
  const partialSig = useRef("");
  const submitted = useRef(false);
  const emailOk = PARTIAL_EMAIL_RE.test(email.trim());
  const partialKey = JSON.stringify([email.trim(), website.trim(), roles, shared, phys, marketTouched ? market : null]);
  useEffect(() => {
    if (!emailOk || hp || submitted.current || partialKey === partialSig.current) return;
    const t = window.setTimeout(() => {
      if (submitted.current) return;
      const run = async () => {
        await partialBusy.current;
        if (submitted.current || partialKey === partialSig.current) return;
        try {
          partialRef.current = await fridayIntake().partial(partialRef.current, buildPayload(), { email: email.trim(), website: website.trim() });
          partialSig.current = partialKey;
          trackIntake(side, "step_complete", "partial_saved", { dedupe: true });
        } catch {
          /* a failed partial save never blocks the form; the final click still sends everything */
        }
      };
      partialBusy.current = run();
    }, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partialKey, emailOk, hp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (hp) return setDone({ ref: { id: "", editToken: "", reportToken: "", version: 0 }, held: false, gates: null }); // honeypot: send nothing
    trackIntake(side, "step_complete", "contact");
    if (r.supplier && !r.hub && !r.accelerate) trackIntake("advertiser", "submit", "supply_only");
    setBusy(true);
    submitted.current = true;
    try {
      const api = fridayIntake();
      const payload = buildPayload();
      await partialBusy.current; // a partial save in flight finishes first, so the final click reuses its record
      const contact = { email: email.trim(), website: website.trim(), elapsed_ms: Date.now() - t0.current };
      const fr = partialRef.current ? await api.finishPartial(partialRef.current, payload, contact) : await api.fast(payload, contact);
      const { ref: next, sub, autofill } = fr;
      saveRef(roles[0]!, next);
      if (r.supplier && r.accelerate) saveRef("kit", next); // Expanded (kit builder) upgrades this same record
      const af = autofill?.fields ?? {};
      const afMarket = af.geo?.value?.sells?.length ? { sells_in: af.geo.value.sells.filter((c): c is "CA" | "US" => c === "CA" || c === "US"), ships_to: (af.geo.value.ships ?? af.geo.value.sells).filter((c): c is "CA" | "US" => c === "CA" || c === "US"), regions: [] } : undefined;
      savePrefill({ website: website.trim(), email: email.trim(), market: marketTouched ? market : afMarket ?? market, category: shared.categories[0] ?? af.category?.value, categorySource: shared.categories[0] ? "typed" : af.category ? "site" : "default", brand: shared.brand.trim() || af.company_name?.value, aov: af.avg_cart_usd?.value, needs: autofill?.needs_input, physical: physOf(phys) });
      setDone({ ref: next, held: sub.public_mirror === "held", gates: reviewGates(sub, sub.mock) });
      setQuick({ side, roles, host: hostOf(website), autofill, fallback: fr.fallback, typedMarket: marketTouched ? market : null, held: sub.public_mirror === "held", ref: next, payload, contact: { email: email.trim(), website: website.trim() }, shared, brand: shared.brand.trim() || null, category: shared.categories[0] ?? null, physical: physOf(phys) ?? null });
      trackIntake(side, "submit", "fast");
      trackIntake(side, "view", "quick_report");
    } catch (x) {
      submitted.current = false;
      trackIntake(side, "submit_error", errorDetail((x as Error).message));
      setErr(ERR[(x as Error).message] ?? "Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done && quick)
    return (
      <>
      {sup ? <SupplierDone brand={quick.brand ?? ""} level={levelOf(r)} /> : null}
      <FastReport
        q={quick}
        onAddDetail={() => {
          trackIntake(side, "cta_click", "add_detail");
          trackIntake(side, "mode", "expanded");
          if (onExpand) onExpand(side);
          else window.location.assign(birchHref("/brand-kit#my-kit"));
        }}
      />
      </>
    );
  if (done)
    return (
      <div data-testid="intake-short-done" className="rounded-3xl border border-foreground/10 bg-white p-6 shadow-xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-lime-200 px-3 py-1 text-xs font-bold uppercase tracking-wider"><Check className="size-3.5" />Received · pending review</p>
        <h2 className="mt-3 font-display text-3xl">Thanks. A person at Birch Reserve reviews every request.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Nothing is booked, charged or accepted automatically.</p>
        <LeadGatesStatus gates={done.gates} />
        <IntakeWarnings />
        {done.held ? <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="intake-held"><ShieldAlert className="size-4 shrink-0" />{HELD_COPY}</p> : null}
        <div className="mt-5"><PrimaryCta side={side} where="done" /></div>
        {!done.held && done.ref.reportToken && !done.ref.legacy ? <Link href={reportPath(done.ref.reportToken)} className="mt-4 inline-block text-sm font-semibold underline" data-testid="intake-report-link">Open your report</Link> : null}
      </div>
    );

  const supplierOnly = r.supplier && !r.hub;
  return (
    <form onSubmit={submit} data-testid="intake-short-form" data-roles={roles.join(",")} className="rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
      {sup ? <ExposureLadder level={levelOf(r)} onPick={(l) => { setR(rolesForLevel(l)); trackIntake("advertiser", "field_start", l === 3 ? "accelerate" : l === 2 ? "add_hub" : "supplier", { dedupe: true }); }} /> : null}
      {sup ? null : <fieldset>
        <legend className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">You are… <span className="font-semibold normal-case tracking-normal text-foreground/50">(most brands are both)</span></legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2" data-testid="intake-roles">
          <RoleCard on={r.supplier} onClick={() => flip("supplier")} icon={Package} title="Supplier" tag="Performance-only" sub="Get into curated hubs. Pay on results." testId="intake-role-supplier">
            {r.supplier ? <AccelerateToggle on={r.accelerate} onClick={() => flip("accelerate")} /> : null}
          </RoleCard>
          <RoleCard on={r.hub} onClick={() => flip("hub")} icon={Store} title="Hub" tag="Max exposure" sub="Your audience, shelf or screens. Earn a share." testId="intake-role-hub" />
        </div>
        {supplierOnly ? (
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-lime-300 bg-lime-50 p-4 md:flex-row md:items-center md:justify-between" data-testid="supplier-only-note">
            <div>
              <p className="text-sm font-bold text-[#0b1f3a]">Supplier-only works. Add your hub for max exposure.</p>
              <Details testId="supplier-only-details" className="mt-1"><p>A hub puts your products on your own shelf and pages too. Network: {RETAIL_COPY} ({RETAIL_TAG}).</p></Details>
            </div>
            <button type="button" onClick={addHub} data-testid="supplier-only-add-hub" className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white hover:bg-lime-300 hover:text-[#0b1f3a]"><Plus className="size-4" />Add my hub</button>
          </div>
        ) : null}
      </fieldset>}
      {resumed ? <p className="mt-3 rounded-xl bg-lime-50 p-3 text-sm font-semibold text-[#0b1f3a]" data-testid="intake-resumed">Welcome back. We saved your answers: check them and get your kit.</p> : null}
      <LocationsQuestion value={phys} onChange={setPhys} side={side} />

      <div className={`mt-4 grid gap-3 ${sup ? "md:grid-cols-[1fr_1fr_1fr_auto]" : "md:grid-cols-[1fr_1fr_auto]"}`}>
        {sup ? <input data-testid="intake-brand" aria-label="Brand name" value={shared.brand} onFocus={fieldStart(side, "brand")} onChange={(e) => setShared({ ...shared, brand: e.target.value })} placeholder="Brand name" autoComplete="organization" className={input} /> : null}
        <input data-testid="intake-website" aria-label="Website" required value={website} onFocus={fieldStart(side, "website")} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbrand.com" autoComplete="url" className={input} />
        <input data-testid="intake-email" aria-label="Work email" required type="email" value={email} onFocus={fieldStart(side, "email")} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbrand.com" autoComplete="email" className={input} />
        <button type="submit" disabled={busy} data-testid="intake-submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-base font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30 transition hover:bg-[#0b1f3a] hover:text-white">
          {busy ? <Loader2 className="size-5 animate-spin" /> : null} {sup && r.hub ? "Create my hub" : "Get my Monetization Kit"} <ArrowRight className="size-5" />
        </button>
      </div>
      <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {err ? <p className="mt-2 text-sm font-semibold text-red-700" data-testid="intake-error">{err}</p> : null}

      <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} data-testid="intake-more-toggle" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground/70 underline-offset-2 hover:underline">
        <ChevronDown className={`size-4 transition ${more ? "rotate-180" : ""}`} />More detail (optional)
      </button>
      {more ? (
        <div className="mt-3 grid gap-3 rounded-2xl bg-foreground/[0.03] p-3 md:grid-cols-2" data-testid="intake-shared">
          {sup ? null : <input data-testid="shared-brand" aria-label="Brand name" value={shared.brand} onFocus={fieldStart(side, "brand")} onChange={(e) => setShared({ ...shared, brand: e.target.value })} placeholder="Brand name" className={small} />}
          <div className="grid grid-cols-2 gap-3">
            <input data-testid="shared-skus" aria-label="Products or SKUs" inputMode="numeric" value={shared.skus} onChange={(e) => setShared({ ...shared, skus: e.target.value })} placeholder="Products / SKUs" className={small} />
            <input data-testid="shared-audience" aria-label="Customers (audience size)" inputMode="numeric" value={shared.audience} onChange={(e) => setShared({ ...shared, audience: e.target.value })} placeholder="Customers (approx.)" className={small} />
          </div>
          <div className="md:col-span-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-foreground/60">Categories (up to 3)</span>
            <div className="mt-1 flex flex-wrap gap-1.5" data-testid="shared-categories">
              {FRIDAY_CATEGORIES.map((c) => {
                const on = shared.categories.includes(c.key);
                return <button key={c.key} type="button" aria-pressed={on} onClick={() => toggleCat(c.key)} data-testid={`shared-cat-${c.key}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/75 ring-1 ring-foreground/15 hover:ring-foreground/40"}`}>{c.label}</button>;
              })}
            </div>
          </div>
          <div className="md:col-span-2"><MarketPicker value={market} onChange={setMarket} side={side} compact /></div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-foreground/10 pt-3 text-[13px]" data-testid="intake-secondary">
        <a href="/intake/sponsor" className="text-foreground/60 underline-offset-2 hover:underline" data-testid="intake-sponsor-link">Want to own a category or an area? See category and area locks</a>
      </div>
      {sup ? <SupplierFees /> : null}
      <Details testId="intake-fine"><p>Business-level only, no customer data. Every figure is an estimate, reviewed by a person. Nothing is booked or charged. Optional answers are asked once and used for both sides.</p></Details>
    </form>
  );
}
