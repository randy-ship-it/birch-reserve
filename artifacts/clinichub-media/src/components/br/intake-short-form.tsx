/**
 * FAST MODE, the default on /intake (Randy, Nov 18 2026 11:36 PM ET): website + email, optional role chips and
 * sells/ships, one button. Friday is contacted ONLY on that final click, with the email (create + submit via
 * Birch's server routes, which add the intake secret server-side). An instant on-page quick estimate follows,
 * built from the site's title/meta (one light server-side fetch) and labelled defaults. Nothing is booked,
 * charged or auto-accepted. "Add detail" opens Expanded mode prefilled; it PATCHes the same Friday record.
 */
import { IntakeWarnings } from "@/components/br/intake-warnings";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Loader2, ShieldAlert } from "lucide-react";
import type { IntakeRole } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { HELD_COPY, fridayIntake, reportPath, saveRef, type IntakeRef } from "@/lib/fridayBrandIntake";
import { basePayload } from "@/components/br/intake-kit";
import { LeadGatesStatus, PrimaryCta, SideSwitch } from "@/components/br/intake-sell";
import { DEFAULT_MARKET, MarketPicker } from "@/components/br/intake-geo";
import type { Market } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { errorDetail, fieldStart, trackIntake, type IntakeSide } from "@/lib/intakeTrack";
import { reviewGates, type LeadGates } from "@/lib/fridayBrandIntake";
import { savePrefill } from "@/lib/intakePrefill";
import { FastReport, type QuickResult } from "@/components/br/fast-report";

const hostOf = (w: string) => w.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0]!.toLowerCase().slice(0, 80) || "your site";

/** Advertiser side: Brand (kit), Supplier, Sponsor. The publisher side is a single role. */
const ROLE_CHIPS: Array<{ key: IntakeRole; label: string; sub: string }> = [
  { key: "kit", label: "Brand", sub: "Get my kit" },
  { key: "supplier", label: "Supplier", sub: "Performance brand" },
  { key: "sponsor", label: "Sponsor", sub: "Own a category or area" },
];
const input = "h-12 w-full rounded-xl border border-foreground/20 bg-white px-3 text-base outline-none focus:border-foreground focus:ring-2 focus:ring-accent";
const ERR: Record<string, string> = { fast_needs_website_email: "Add your website and a work email to get your quick estimate.", too_fast: "One sec: give it a moment and try again.", email: "Use a valid work email.", website: "Add your brand's website.", individual_data: "Please keep it to brand-level details.", rate_limited: "Too many tries. Please wait a minute." };

export function IntakeShortForm({ onExpand }: { onExpand?: (side: IntakeSide) => void }) {
  const [side, setSide] = useState<IntakeSide>("advertiser");
  const [adRoles, setAdRoles] = useState<IntakeRole[]>(["kit"]);
  const roles: IntakeRole[] = side === "publisher" ? ["publisher"] : adRoles;
  const setRoles = setAdRoles;
  const [market, setMarketRaw] = useState<Market>(DEFAULT_MARKET);
  const [marketTouched, setMarketTouched] = useState(false); // typed values always override Friday's auto-fill
  const setMarket = (m: Market) => { setMarketTouched(true); setMarketRaw(m); };
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: IntakeRef; held: boolean; gates: LeadGates | null } | null>(null);
  const [quick, setQuick] = useState<QuickResult | null>(null);
  const t0 = useRef(Date.now());
  useEffect(() => trackIntake(side, "view", "intake", { dedupe: true }), [side]);
  const pickSide = (s: IntakeSide) => { if (s !== side) { trackIntake(s, "field_start", "side", { dedupe: true }); setSide(s); } };
  const toggle = (k: IntakeRole) => setRoles((r) => (r.includes(k) ? (r.length > 1 ? r.filter((x) => x !== k) : r) : [...r, k]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (hp) return setDone({ ref: { id: "", editToken: "", reportToken: "", version: 0 }, held: false, gates: null }); // honeypot: send nothing
    trackIntake(side, "step_complete", "contact");
    setBusy(true);
    try {
      const api = fridayIntake();
      const payload = { ...basePayload(roles[0]!), roles, ...(marketTouched && market.sells_in.length ? { market } : {}) };
      // The ONLY moment Friday is contacted: this final click, with the email. v1.3: one POST submit_mode "fast";
      // Friday reads the brand's public pages and auto-fills. Until v1.3 is live: v1 create + submit, labelled defaults.
      const fr = await api.fast(payload, { email: email.trim(), website: website.trim(), elapsed_ms: Date.now() - t0.current });
      const { ref: next, sub, autofill } = fr;
      saveRef(roles[0]!, next);
      if (side === "advertiser") saveRef("kit", next); // Expanded (kit builder) upgrades this same record
      const af = autofill?.fields ?? {};
      const afMarket = af.geo?.value?.sells?.length ? { sells_in: af.geo.value.sells.filter((c): c is "CA" | "US" => c === "CA" || c === "US"), ships_to: (af.geo.value.ships ?? af.geo.value.sells).filter((c): c is "CA" | "US" => c === "CA" || c === "US"), regions: [] } : undefined;
      savePrefill({ website: website.trim(), email: email.trim(), market: marketTouched ? market : afMarket ?? market, category: af.category?.value, categorySource: af.category ? "site" : "default", brand: af.company_name?.value, aov: af.avg_cart_usd?.value, needs: autofill?.needs_input });
      setDone({ ref: next, held: sub.public_mirror === "held", gates: reviewGates(sub, sub.mock) });
      setQuick({ side, roles, host: hostOf(website), autofill, fallback: fr.fallback, typedMarket: marketTouched ? market : null, held: sub.public_mirror === "held" });
      trackIntake(side, "submit", "fast");
      trackIntake(side, "view", "quick_report");
    } catch (x) {
      trackIntake(side, "submit_error", errorDetail((x as Error).message));
      setErr(ERR[(x as Error).message] ?? "Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done && quick)
    return (
      <FastReport
        q={quick}
        onAddDetail={() => {
          trackIntake(side, "cta_click", "add_detail");
          trackIntake(side, "mode", "expanded");
          if (onExpand) onExpand(side);
          else window.location.assign(side === "publisher" ? "/intake/publisher#expanded" : "/brand-kit#my-kit");
        }}
      />
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
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          {!done.held && done.ref.reportToken && !done.ref.legacy ? <Link href={reportPath(done.ref.reportToken)} className="underline" data-testid="intake-report-link">Open your report</Link> : null}
          {side === "advertiser" ? <a href="/brand-kit#my-kit" className="underline">Add four numbers for your full kit</a> : null}
          {roles.includes("publisher") ? <a href="/intake/publisher" className="underline">Publisher payouts</a> : null}
          {roles.includes("supplier") ? <a href="/intake/supplier" className="underline">Supplier first look</a> : null}
          {roles.includes("sponsor") ? <a href="/intake/sponsor" className="underline">Sponsor locks</a> : null}
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} data-testid="intake-short-form" className="rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
      <SideSwitch side={side} onChange={pickSide} />
      {side === "advertiser" ? (
      <fieldset className="mt-3">
        <legend className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">Advertiser · pick any</legend>
        <div className="mt-2 grid grid-cols-3 gap-2" data-testid="intake-roles">
          {ROLE_CHIPS.map((r) => {
            const on = roles.includes(r.key);
            return (
              <button key={r.key} type="button" aria-pressed={on} onClick={() => { trackIntake("advertiser", "field_start", "role", { dedupe: true }); toggle(r.key); }} data-testid={`intake-role-${r.label.toLowerCase()}`} className={`rounded-2xl px-3 py-2.5 text-left transition ${on ? "bg-[#0b1f3a] text-white shadow" : "bg-foreground/[0.05] hover:bg-foreground/[0.09]"}`}>
                <span className="block text-sm font-bold">{r.label}</span>
                <span className={`block text-[11px] ${on ? "text-lime-200" : "text-foreground/60"}`}>{r.sub}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      ) : <p className="mt-3 text-sm text-muted-foreground" data-testid="intake-publisher-line">Tell us your hub's website. We send back what your screens and pages could earn, reviewed by a person.</p>}
      <div className="mt-3"><MarketPicker value={market} onChange={setMarket} side={side} /></div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input data-testid="intake-website" aria-label={side === "publisher" ? "Hub website" : "Brand website"} required value={website} onFocus={fieldStart(side, "website")} onChange={(e) => setWebsite(e.target.value)} placeholder={side === "publisher" ? "yourhub.com" : "yourbrand.com"} autoComplete="url" className={input} />
        <input data-testid="intake-email" aria-label="Work email" required type="email" value={email} onFocus={fieldStart(side, "email")} onChange={(e) => setEmail(e.target.value)} placeholder={side === "publisher" ? "you@yourhub.com" : "you@yourbrand.com"} autoComplete="email" className={input} />
        <button type="submit" disabled={busy} data-testid="intake-submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-base font-bold text-accent-foreground shadow-lg shadow-lime-500/20 transition hover:bg-foreground hover:text-background">
          {busy ? <Loader2 className="size-5 animate-spin" /> : null} {side === "publisher" ? "See my hub estimate" : "Get my quick estimate"} <ArrowRight className="size-5" />
        </button>
      </div>
      <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      {err ? <p className="mt-2 text-sm font-semibold text-red-700" data-testid="intake-error">{err}</p> : null}
      <p className="mt-3 text-[11px] text-muted-foreground">{side === "publisher" ? "Hub-level only, no visitor data." : "Brand-level only, no customer data."} Every figure is an estimate, reviewed by a person. Nothing is booked or charged.</p>
    </form>
  );
}
