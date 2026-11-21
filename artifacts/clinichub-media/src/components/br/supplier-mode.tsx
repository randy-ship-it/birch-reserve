/**
 * Supplier-first preset of the shared /intake one form (Randy, Nov 19 2026 1:37 PM + 1:47 PM ET via Emma). Used by
 * IntakeShortForm when preset="supplier" (/intake/supplier, /intake?role=supplier). The plain /intake is unchanged.
 * - Exposure ladder: Performance only → + Own hub → + Display CPM/CPC (Accelerate). Exposure grows at each step;
 *   performance-only exposure is limited to what curation and merchandising need.
 * - Own hub = pending approval (Birch Reserve: Randy or Jon) before it goes live. Never auto-publish.
 * - Fees kept quiet: chips + "How fees work" expander; $5,000 stand-up fee struck through (waived before 2027). USD.
 */
import { HubDemandCard } from "@/components/br/hundred";
import { skinText } from "@/lib/siteSkin";
import { BadgeCheck, Check, Clock, Package, Rocket, Store } from "lucide-react";
import { Details } from "@/components/br/details";

export type IntakePreset = "supplier";

/** /intake?role=supplier → the supplier preset (in place). Anything else → default /intake. */
export const presetOf = (search: string): IntakePreset | undefined => (new URLSearchParams(search).get("role") === "supplier" ? "supplier" : undefined);

/** ?brand=crossover-symmetry → "Crossover Symmetry" (a typed name is kept as typed). */
export function brandFromParam(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().slice(0, 80);
  if (!v) return "";
  if (/[A-Z\s]/.test(v)) return v.replace(/\s+/g, " ");
  return v.split(/[-_]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
export const brandFromUrl = () => (typeof window === "undefined" ? "" : brandFromParam(new URLSearchParams(window.location.search).get("brand")));
export const hubSlugOf = (name: string) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64).replace(/-+$/, "");

/** Fee lines (template Randy sent the brand). */
export const SUPPLIER_FEES = {
  standUpUsd: 5000,
  waiver: "waived for brands live before 2027",
  lines: [
    { k: "own", v: "10%", l: "on post-purchase activated sales through your own hub" },
    { k: "network", v: "~35%", l: "on sales through partner clinics and other hubs" },
  ],
} as const;

export type Level = 1 | 2 | 3;
export const levelOf = (r: { hub: boolean; accelerate: boolean }): Level => (r.accelerate ? 3 : r.hub ? 2 : 1);
export const rolesForLevel = (l: Level) => ({ supplier: true, hub: l >= 2, accelerate: l === 3 });

const STEPS: Array<{ l: Level; icon: typeof Package; t: string; s: string; tag: string }> = [
  { l: 1, icon: Package, t: "Performance only", s: "Placed where our curation and merchandising need it", tag: "Pay on results" },
  { l: 2, icon: Store, t: "+ Own hub", s: "Your own shelf across retail hubs and partner clinics", tag: "Pending approval" },
  { l: 3, icon: Rocket, t: "+ Display CPM/CPC", s: "Accelerate: paid display on top, any time", tag: "Optional" },
];

/** The exposure ladder (replaces the role cards in the supplier preset). Each step includes the ones before it. */
export function ExposureLadder({ level, onPick }: { level: Level; onPick: (l: Level) => void }) {
  return (
    <fieldset data-testid="exposure-ladder" data-level={level}>
      <legend className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">Your exposure <span className="font-semibold normal-case tracking-normal text-foreground/50">(start performance-only, add more any time)</span></legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Exposure level">
        {STEPS.map((x) => {
          const on = level >= x.l;
          const cur = level === x.l;
          return (
            <button key={x.l} type="button" role="radio" aria-checked={cur} onClick={() => onPick(x.l)} data-testid={`ladder-step-${x.l}`} className={`flex flex-col rounded-2xl border-2 p-3 text-left transition ${on ? "border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg" : "border-foreground/15 bg-white hover:border-foreground/40"} ${cur ? "ring-2 ring-lime-300 ring-offset-2" : ""}`}>
              <span className="flex items-center gap-2">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-lime-300 bg-lime-300 text-[#0b1f3a]" : "border-foreground/30"}`}>{on ? <Check className="size-4" /> : null}</span>
                <x.icon className={`size-4 ${on ? "text-lime-300" : "text-foreground/50"}`} aria-hidden />
                <span className="text-sm font-bold">{x.t}</span>
              </span>
              <span className={`mt-1 block text-[12px] leading-snug ${on ? "text-white/75" : "text-foreground/60"}`}>{x.s}</span>
              <span className="mt-3 flex items-center gap-2">
                <span className={`h-1.5 flex-1 overflow-hidden rounded-full ${on ? "bg-white/15" : "bg-foreground/[0.07]"}`} aria-hidden>
                  <span className={`block h-full rounded-full ${on ? "bg-gradient-to-r from-sky-300 to-lime-300" : "bg-foreground/20"}`} style={{ width: `${x.l * 33.3}%` }} />
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${on ? "bg-lime-300 text-[#0b1f3a]" : "bg-foreground/[0.07] text-foreground/65"}`}>{x.tag}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-foreground/60" data-testid="ladder-note">
        <BadgeCheck className="size-3.5 shrink-0 text-lime-600" aria-hidden />
        {level === 1 ? "Performance-only exposure is limited to what curation needs. Add your own hub to max it out." : level === 2 ? "Your own hub goes live once our team approves it." : "Max exposure: own hub + CPM/CPC display. You approve every placement."}
      </p>
    </fieldset>
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
        <p>Performance-only to start: fees apply only to sales, in USD. CPM/CPC display is an optional upgrade, priced on its own. You approve every placement before it runs.</p>
      </Details>
    </div>
  );
}

/** Submitted state on the supplier preset (above the Monetization Kit estimate). */
export function SupplierDone({ brand, level }: { brand: string; level: Level }) {
  const hub = level >= 2;
  return (
    <div data-testid="supplier-pending" data-level={level} className="mb-4 rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
      <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-950 ring-1 ring-amber-300" data-testid="supplier-pending-chip"><Clock className="size-3.5" />{hub ? "Pending approval" : "Received · in review"}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl" data-testid="supplier-pending-title">{hub ? "Your hub is created and goes live once our team approves it." : "You're in on a performance-only basis."}</h2>
      {hub ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#0b1f3a] p-4 text-white" data-testid="supplier-hub-card">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-lg font-black text-[#0b1f3a]">{(brand || "H").charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold" data-testid="supplier-hub-name">{brand ? `${brand} hub` : "Your hub"}</p>
            <p className="text-[12px] text-white/70">{level === 3 ? "Own hub + CPM/CPC display requested" : "Own hub · performance-only"}</p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 sm:inline">Not live yet</span>
        </div>
      ) : null}
      <div className="pointer-events-none mt-4" aria-disabled><ExposureLadder level={level} onPick={() => undefined} /></div>
      {hub ? <HubDemandCard className="mt-4" /> : null}
      <Details testId="supplier-pending-details">
        <p>{skinText("Birch Reserve")} reviews every request{hub ? " and every new hub before it goes live" : ""}. Nothing is published, booked or charged automatically, and you approve every placement.</p>
      </Details>
    </div>
  );
}
