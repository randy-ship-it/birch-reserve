/**
 * After the fast submit: role-specific questions on the SAME record (Randy via Emma, Nov 19 2026 9:34 AM ET).
 * Shared answers from the first step are prefilled and never asked twice. Hub questions are a DRAFT list: Randy's
 * voice note ("make sure that they have…") was cut off, so the list is pending his confirmation.
 * Saves PATCH the same Friday record (autosave semantics, no second lead); ?mock=1 keeps it in this browser.
 */
import { useState } from "react";
import { Check, Loader2, Package, Store } from "lucide-react";
import { fridayIntake, type IntakeRef } from "@/lib/fridayBrandIntake";
import type { IntakePayload } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { trackIntake } from "@/lib/intakeTrack";
import { RT, RT_SERIF } from "@/lib/reportTokens";

export type SharedAnswers = { brand: string; categories: string[]; skus: string; audience: string };
export const numOrU = (s: string) => {
  const n = Number(String(s).replace(/[,\s]/g, ""));
  return s.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};
export const HUB_TYPES = ["Clinic / physio", "Studio / gym", "Retail store", "Online community / app", "Brand with members", "Other"] as const;
export const HUB_SURFACES = [
  { key: "post_purchase", label: "Post-purchase / booking pages" },
  { key: "home", label: "Hub home" },
  { key: "product", label: "Product pages" },
  { key: "services", label: "Services pages" },
  { key: "dashboard", label: "Member dashboard" },
  { key: "newsletter", label: "Newsletter" },
  { key: "social", label: "Social" },
] as const;
/** The draft hub question list (also reported to Randy). */
export const HUB_QUESTIONS_DRAFT = [
  "Hub type",
  "Locations (count)",
  "Monthly in-person visits (foot traffic)",
  "Monthly website visitors",
  "Monthly page views",
  "Email list size",
  "Screens / in-store display surfaces (count)",
  "Online surfaces you can turn on",
  "Cities or regions served",
  "Decision maker (role or title only, no names)",
] as const;
const MARGINS = [{ k: "lt_30", l: "Under 30%" }, { k: "30_50", l: "30–50%" }, { k: "50_70", l: "50–70%" }, { k: "70_plus", l: "70%+" }] as const;

const f = "h-11 w-full rounded-xl border border-foreground/20 bg-white px-3 text-sm outline-none focus:border-foreground";
const lab = "block text-[11px] font-bold uppercase tracking-wider text-foreground/60";

const fmtN = (v: string) => { const n = numOrU(v); return n == null ? v : n.toLocaleString("en-US"); };

export function IntakeDetails({ intake: intakeRef, payload, roles, shared, onSaved }: { intake: IntakeRef; payload: IntakePayload; roles: string[]; shared: SharedAnswers; onSaved?: () => void }) {
  const isHub = roles.includes("publisher");
  const isSup = roles.includes("supplier");
  const [hub, setHub] = useState({ type: "", locations: "", foot: "", visitors: "", views: "", emails: "", screens: "", cities: "", dm: "", surfaces: [] as string[] });
  const isAcc = roles.includes("kit");
  const [sup, setSup] = useState({ price: "", margin: "", retail: "", ships: "", budget: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!isHub && !isSup) return null;
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const next: IntakePayload = {
        ...payload,
        ...(isHub ? { hub: { type: hub.type || undefined, locations: numOrU(hub.locations), foot_traffic_month: numOrU(hub.foot), web_visitors_month: numOrU(hub.visitors), page_views_month: numOrU(hub.views), email_list: numOrU(hub.emails), screens: numOrU(hub.screens), surfaces: hub.surfaces, cities: hub.cities.trim() || undefined, decision_maker_role: hub.dm.trim() || undefined } } : {}),
        ...(isSup ? { supplier_detail: { avg_price_usd: numOrU(sup.price), margin_band: sup.margin || undefined, retail_now: sup.retail || undefined, ships: sup.ships || undefined, accelerate_budget: (isAcc && sup.budget) || undefined } } : {}),
      };
      await fridayIntake().update(intakeRef, next);
      trackIntake("advertiser", "step_complete", "hub_details");
      setSaved(true);
      onSaved?.();
    } catch (x) {
      setErr((x as Error).message === "individual_data" ? "Please keep it to business-level details (role or title, no names or contacts)." : "Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const prefilled = [shared.brand && `Brand: ${shared.brand}`, shared.categories.length && `${shared.categories.length} ${shared.categories.length === 1 ? "category" : "categories"}`, shared.skus && `${fmtN(shared.skus)} SKUs`, shared.audience && `${fmtN(shared.audience)} customers`].filter(Boolean) as string[];
  return (
    <section className="rounded-3xl bg-white p-5 shadow-xl md:p-6" style={{ border: `1px solid ${RT.line}` }} data-testid="intake-details">
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: RT.mintInk }}>Optional · 2 minutes · updates the same request</p>
      <h3 className="mt-1 text-2xl md:text-3xl" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Sharpen your numbers</h3>
      {prefilled.length ? <p className="mt-1 text-[13px]" style={{ color: RT.mute }} data-testid="details-prefilled">Already have: {prefilled.join(" · ")}. You won't be asked again.</p> : <p className="mt-1 text-[13px]" style={{ color: RT.mute }}>Only the questions for the roles you picked.</p>}
      <div className={`mt-4 grid gap-4 ${isHub && isSup ? "lg:grid-cols-2" : ""}`}>
        {isSup ? (
          <div className="rounded-2xl p-4" style={{ background: RT.paper }} data-testid="details-supplier">
            <p className="flex items-center gap-2 text-sm font-bold" style={{ color: RT.ink }}><Package className="size-4" />Supplier · performance only{isAcc ? " + Accelerate" : ""}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><span className={lab}>Typical price / cart (USD)</span><input className={f} inputMode="numeric" value={sup.price} onChange={(e) => setSup({ ...sup, price: e.target.value })} placeholder="e.g. 60" data-testid="sup-price" /></label>
              <label><span className={lab}>Gross margin</span><select className={f} value={sup.margin} onChange={(e) => setSup({ ...sup, margin: e.target.value })} data-testid="sup-margin"><option value="">Pick one</option>{MARGINS.map((m) => <option key={m.k} value={m.k}>{m.l}</option>)}</select></label>
              <label><span className={lab}>In retail today?</span><select className={f} value={sup.retail} onChange={(e) => setSup({ ...sup, retail: e.target.value })} data-testid="sup-retail"><option value="">Pick one</option><option>Yes, in stores</option><option>Online only</option><option>Not yet</option></select></label>
              <label><span className={lab}>Fulfilment</span><select className={f} value={sup.ships} onChange={(e) => setSup({ ...sup, ships: e.target.value })} data-testid="sup-ships"><option value="">Pick one</option><option>We ship direct</option><option>Wholesale to stores</option><option>Both</option></select></label>
              {isAcc ? <label className="sm:col-span-2"><span className={lab}>Accelerate test budget (USD)</span><select className={f} value={sup.budget} onChange={(e) => setSup({ ...sup, budget: e.target.value })} data-testid="sup-accelerate-budget"><option value="">Pick one</option><option>$1,000 test</option><option>$1,000–$5,000 a month</option><option>$5,000+ a month</option><option>Not sure yet</option></select></label> : null}
            </div>
          </div>
        ) : null}
        {isHub ? (
          <div className="rounded-2xl p-4" style={{ background: RT.paper }} data-testid="details-hub">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold" style={{ color: RT.ink }}><Store className="size-4" />Your hub <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: RT.goldBg, color: RT.gold }} data-testid="hub-draft-tag">Draft questions</span></p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><span className={lab}>Hub type</span><select className={f} value={hub.type} onChange={(e) => setHub({ ...hub, type: e.target.value })} data-testid="hub-type"><option value="">Pick one</option>{HUB_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label><span className={lab}>Locations</span><input className={f} inputMode="numeric" value={hub.locations} onChange={(e) => setHub({ ...hub, locations: e.target.value })} placeholder="e.g. 3" data-testid="hub-locations" /></label>
              <label><span className={lab}>In-person visits / month</span><input className={f} inputMode="numeric" value={hub.foot} onChange={(e) => setHub({ ...hub, foot: e.target.value })} placeholder="e.g. 4,000" data-testid="hub-foot" /></label>
              <label><span className={lab}>Website visitors / month</span><input className={f} inputMode="numeric" value={hub.visitors} onChange={(e) => setHub({ ...hub, visitors: e.target.value })} placeholder="e.g. 20,000" data-testid="hub-visitors" /></label>
              <label><span className={lab}>Page views / month</span><input className={f} inputMode="numeric" value={hub.views} onChange={(e) => setHub({ ...hub, views: e.target.value })} placeholder="e.g. 60,000" data-testid="hub-views" /></label>
              <label><span className={lab}>Email list size</span><input className={f} inputMode="numeric" value={hub.emails} onChange={(e) => setHub({ ...hub, emails: e.target.value })} placeholder="e.g. 8,000" data-testid="hub-emails" /></label>
              <label><span className={lab}>Screens / display surfaces</span><input className={f} inputMode="numeric" value={hub.screens} onChange={(e) => setHub({ ...hub, screens: e.target.value })} placeholder="e.g. 2" data-testid="hub-screens" /></label>
              <label><span className={lab}>Cities / regions</span><input className={f} value={hub.cities} onChange={(e) => setHub({ ...hub, cities: e.target.value })} placeholder="e.g. Toronto, Ottawa" data-testid="hub-cities" /></label>
              <label className="sm:col-span-2"><span className={lab}>Who decides? (role or title, no names)</span><input className={f} value={hub.dm} onChange={(e) => setHub({ ...hub, dm: e.target.value })} placeholder="e.g. Owner, Marketing lead" data-testid="hub-dm" /></label>
              <div className="sm:col-span-2">
                <span className={lab}>Online surfaces you could turn on</span>
                <div className="mt-1 flex flex-wrap gap-1.5" data-testid="hub-surfaces">
                  {HUB_SURFACES.map((s) => {
                    const on = hub.surfaces.includes(s.key);
                    return <button key={s.key} type="button" aria-pressed={on} onClick={() => setHub({ ...hub, surfaces: on ? hub.surfaces.filter((x) => x !== s.key) : [...hub.surfaces, s.key] })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-[#0b1f3a] text-white" : "bg-white ring-1 ring-foreground/15"}`}>{s.label}</button>;
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy} data-testid="details-save" className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-bold shadow-lg" style={{ background: RT.forest, color: "#fff" }}>{busy ? <Loader2 className="size-5 animate-spin" /> : saved ? <Check className="size-5" /> : null}{saved ? "Saved to your request" : "Save and sharpen my kit"}</button>
        {err ? <span className="text-sm font-semibold text-red-700">{err}</span> : null}
        <span className="text-[11px]" style={{ color: RT.mute }}>Hub-reported, business-level figures only. Estimates, reviewed by a person.</span>
      </div>
    </section>
  );
}
