/**
 * Supplier-first preset of the shared /intake one form (Randy, Nov 19 2026 1:37 PM + 1:47 PM ET via Emma). Used by
 * IntakeShortForm when preset="supplier" (/intake/supplier, /intake?role=supplier). The plain /intake is unchanged.
 * - Paths (Nov 26 2026): Supply, Your own hub, Display / CPC, Ads only. Pick some or all; nothing forced on.
 *   Categories multi-select; a lightweight "ask what demand we see" switch.
 * - Own hub = pending approval (Birch Reserve: Randy or Jon) before it goes live. Never auto-publish.
 * - Fees kept quiet: chips + "How fees work" expander; $5,000 stand-up fee struck through (waived before 2027). USD.
 */
import { HubDemandCard } from "@/components/br/hundred";
import { skinText } from "@/lib/siteSkin";
import { Check, Clock, Megaphone, MousePointerClick, Package, Search, Store } from "lucide-react";
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

/**
 * Paths (Randy, voice, Nov 26 2026 1:07 + 1:10 PM ET): supply-side framing, pick SOME OR ALL. No "say you're a supplier"
 * step: nothing is forced on. Own hub = performance-based and you earn from it; max CPC exposure needs your own hub.
 * Display / CPC and Ads only can buy small slots right away (existing self-serve checkout); CPC itself is request-only
 * until it has a published price.
 */
export type PathKey = "supply" | "hub" | "display" | "ads";
export type Paths = Record<PathKey, boolean>;
export const NO_PATHS: Paths = { supply: false, hub: false, display: false, ads: false };
export const DEFAULT_PATHS: Paths = { supply: true, hub: false, display: false, ads: false };
export const PATHS: Array<{ k: PathKey; icon: typeof Package; t: string; s: string; tag: string }> = [
  { k: "supply", icon: Package, t: "Supply", s: "Your products or services in hub micro-stores, 200+ brick-and-mortar locations, or street-team door-to-door sampling.", tag: "Pay on results" },
  { k: "hub", icon: Store, t: "Your own hub", s: "Performance-based. You earn from your hub. Needed for max CPC exposure.", tag: "Pending approval" },
  { k: "display", icon: MousePointerClick, t: "Display / CPC", s: "Performance placements for brands without a hub.", tag: "Buy now" },
  { k: "ads", icon: Megaphone, t: "Ads only", s: "Exposure only. No supply needed.", tag: "Buy now" },
];
/** ?paths=supply,hub preselects (media kit links). Unknown keys are ignored; nothing valid → the supply default. */
export function pathsFromParam(raw: string | null | undefined): Paths {
  const keys = (raw ?? "").split(",").map((x) => x.trim()).filter((x): x is PathKey => PATHS.some((p) => p.k === x));
  return keys.length ? { ...NO_PATHS, ...Object.fromEntries(keys.map((x) => [x, true])) } : DEFAULT_PATHS;
}
export const pathsFromUrl = () => (typeof window === "undefined" ? DEFAULT_PATHS : pathsFromParam(new URLSearchParams(window.location.search).get("paths")));
export const anyPath = (p: Paths) => p.supply || p.hub || p.display || p.ads;
/** Friday roles: supply → supplier, own hub → publisher (hub request), display / ads → kit. Nothing picked (demand question only) → supplier. */
export function rolesForPaths(p: Paths): Array<"supplier" | "publisher" | "kit"> {
  const r = [...(p.supply ? (["supplier"] as const) : []), ...(p.hub ? (["publisher"] as const) : []), ...(p.display || p.ads ? (["kit"] as const) : [])];
  return r.length ? r : ["supplier"];
}
export const pathLabels = (p: Paths) => PATHS.filter((x) => p[x.k]).map((x) => x.t);

/** Verticals (multi-select). Each maps to the closest shared kit category key, so the kit and CRM keep working. */
export const VERTICALS = [
  { k: "recovery", label: "Recovery", cat: "recovery_devices" },
  { k: "longevity", label: "Longevity", cat: "health_testing_longevity" },
  { k: "sleep", label: "Sleep", cat: "sleep_breathing" },
  { k: "fitness", label: "Fitness", cat: "strength_home_fitness" },
  { k: "nutrition", label: "Nutrition", cat: "sports_nutrition" },
] as const;
export type VerticalKey = (typeof VERTICALS)[number]["k"];
export const VERTICALS_NOTE = "Most hubs are recovery-focused today. More categories are coming.";
export const verticalCats = (v: VerticalKey[]) => VERTICALS.filter((x) => v.includes(x.k)).map((x) => x.cat);
export const verticalLabels = (v: VerticalKey[]) => VERTICALS.filter((x) => v.includes(x.k)).map((x) => x.label);

/** Pick some or all paths. Each card is a checkbox; nothing is forced on. */
export function PathPicker({ value, onToggle }: { value: Paths; onToggle: (k: PathKey) => void }) {
  return (
    <fieldset data-testid="supplier-paths" data-paths={PATHS.filter((x) => value[x.k]).map((x) => x.k).join(",")}>
      <legend className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">Your path <span className="font-semibold normal-case tracking-normal text-foreground/50">(pick some or all)</span></legend>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        {PATHS.map((x) => {
          const on = value[x.k];
          return (
            <button key={x.k} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(x.k)} data-testid={`supplier-path-${x.k}`} className={`flex min-w-0 flex-col rounded-2xl border-2 p-3 text-left transition ${on ? "border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg" : "border-foreground/15 bg-white hover:border-foreground/40"}`}>
              <span className="flex items-center gap-2">
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-lime-300 bg-lime-300 text-[#0b1f3a]" : "border-foreground/30"}`}>{on ? <Check className="size-3.5" /> : null}</span>
                <x.icon className={`size-4 shrink-0 ${on ? "text-lime-300" : "text-foreground/50"}`} aria-hidden />
                <span className="min-w-0 text-sm font-bold leading-tight">{x.t}</span>
              </span>
              <span className={`mt-1 block text-[12px] leading-snug ${on ? "text-white/75" : "text-foreground/60"}`}>{x.s}</span>
              <span className={`mt-auto self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${on ? "bg-lime-300 text-[#0b1f3a]" : "bg-foreground/[0.07] text-foreground/65"}`} style={{ marginTop: "0.6rem" }}>{x.tag}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Buy right away (Display / CPC, Ads only): the existing 7-day look and reserve checkout. CPC stays a request (no published price). */
export function PathBuyNow({ paths, look, seat, lookHref, reserveHref }: { paths: Paths; look: string; seat: string; lookHref: string; reserveHref: string }) {
  if (!paths.display && !paths.ads) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-lime-300 bg-lime-50 p-3 md:flex-row md:flex-wrap md:items-center md:justify-between" data-testid="path-buy-now">
      <p className="text-sm font-bold text-[#0b1f3a]">Skip the wait. Buy a small slot now.</p>
      <div className="flex flex-wrap gap-2">
        <a href={lookHref} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#0b1f3a] px-4 text-sm font-bold text-white hover:bg-lime-300 hover:text-[#0b1f3a]" data-testid="path-buy-look">Buy display now · {look}</a>
        <a href={reserveHref} className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-bold text-[#0b1f3a] ring-1 ring-[#0b1f3a]/20 hover:ring-[#0b1f3a]" data-testid="path-buy-reserve">Category placement · {seat}</a>
      </div>
      {paths.display ? <p className="text-[12px] text-foreground/65 md:basis-full" data-testid="path-cpc-note">Request CPC: keep Display / CPC ticked and send. Max CPC exposure needs your own hub.</p> : null}
    </div>
  );
}

/** Categories (multi-select) + the honest note. */
export function VerticalPicker({ value, onToggle }: { value: VerticalKey[]; onToggle: (k: VerticalKey) => void }) {
  return (
    <fieldset className="mt-4" data-testid="supplier-verticals" data-verticals={value.join(",")}>
      <legend className="text-[11px] font-bold uppercase tracking-wider text-foreground/60">Categories <span className="font-semibold normal-case tracking-normal text-foreground/50">(pick any)</span></legend>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {VERTICALS.map((x) => {
          const on = value.includes(x.k);
          return <button key={x.k} type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(x.k)} data-testid={`vertical-${x.k}`} className={`h-9 rounded-full px-3.5 text-sm font-semibold transition ${on ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/75 ring-1 ring-foreground/15 hover:ring-foreground/40"}`}>{x.label}</button>;
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-foreground/55" data-testid="verticals-note">{VERTICALS_NOTE}</p>
    </fieldset>
  );
}

/** Lightweight option: just ask what demand we see. Works alone (no path needed). */
export function DemandAsk({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} data-testid="supplier-demand-ask" className={`mt-3 flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${on ? "bg-lime-300 text-[#0b1f3a]" : "bg-foreground/[0.03] text-[#0b1f3a] hover:bg-foreground/[0.06]"}`}>
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-sm font-bold">Just curious? Ask what demand we see for your category.</span>
      <span aria-hidden data-static-toggle className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wider ${on ? "bg-[#0b1f3a] text-lime-300" : "bg-foreground/15 text-foreground/70"}`}>{on ? "On" : "Off"}</span>
    </button>
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
        <p>Supply and your own hub: fees apply only to sales, in USD. Display and CPC are priced on their own. You approve every placement before it runs.</p>
      </Details>
    </div>
  );
}

/** Submitted state on the supplier preset (above the Monetization Kit estimate). */
export function SupplierDone({ brand, paths, demand }: { brand: string; paths: Paths; demand?: boolean }) {
  const hub = paths.hub;
  const picked = pathLabels(paths);
  return (
    <div data-testid="supplier-pending" data-paths={PATHS.filter((x) => paths[x.k]).map((x) => x.k).join(",")} className="mb-4 rounded-3xl border border-foreground/10 bg-white p-5 shadow-xl md:p-6">
      <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-950 ring-1 ring-amber-300" data-testid="supplier-pending-chip"><Clock className="size-3.5" />{hub ? "Pending approval" : "Received · in review"}</p>
      <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl" data-testid="supplier-pending-title">{hub ? "Your hub is created and goes live once our team approves it." : picked.length ? "You're in. We review it and reply by email." : "Got it. We'll show you the demand we see."}</h2>
      {picked.length ? <p className="mt-3 flex flex-wrap gap-1.5" data-testid="supplier-done-paths">{picked.map((t) => <span key={t} className="rounded-full bg-[#0b1f3a] px-3 py-1 text-xs font-bold text-white">{t}</span>)}{demand ? <span className="rounded-full bg-lime-200 px-3 py-1 text-xs font-bold text-[#0b1f3a]">Demand question</span> : null}</p> : null}
      {hub ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#0b1f3a] p-4 text-white" data-testid="supplier-hub-card">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-300 text-lg font-black text-[#0b1f3a]">{(brand || "H").charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold" data-testid="supplier-hub-name">{brand ? `${brand} hub` : "Your hub"}</p>
            <p className="text-[12px] text-white/70">Own hub · performance-based</p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 sm:inline">Not live yet</span>
        </div>
      ) : null}
      {hub ? <HubDemandCard className="mt-4" /> : null}
      <Details testId="supplier-pending-details">
        <p>{skinText("Birch Reserve")} reviews every request{hub ? " and every new hub before it goes live" : ""}. Nothing is published, booked or charged automatically, and you approve every placement.</p>
      </Details>
    </div>
  );
}
