/**
 * Selling the inventory on every intake view (Randy via Emma, Nov 18 2026 10:44 PM ET).
 * Two sides: Advertiser (Brand · Supplier · Sponsor) and Publisher. Every view and report state ends in one
 * strong primary CTA. Only a generic review state is shown (Friday's hub-partner match is internal only and never rendered).
 * No approval controls on Birch.
 */
import { openLane } from "@/components/br/two-lane";
import { Details } from "@/components/br/details";
import { ArrowRight, Clock, FlaskConical, Store, Megaphone } from "lucide-react";
import type { IntakeRole } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { LOOK_HREF, RESERVE_HREF, lookHref} from "@/components/br/pricing";
import { skinText } from "@/lib/siteSkin";
import { trackCta } from "@/lib/track-cta";
import { trackIntake, type IntakeDetail, type IntakeSide } from "@/lib/intakeTrack";
import type { LeadGates } from "@/lib/fridayBrandIntake";

export const sideOf = (roles: readonly IntakeRole[] | IntakeRole): IntakeSide => ((Array.isArray(roles) ? roles : [roles]).every((r) => r === "publisher") ? "publisher" : "advertiser");

export const SIDES: Record<IntakeSide, { label: string; sub: string; icon: typeof Store }> = {
  advertiser: { label: "Supplier", sub: "Performance-only (pay on results, no CPC/CPM), plus optional Accelerate for premium placements", icon: Megaphone },
  publisher: { label: "Hub", sub: "Max exposure: earn from your screens and pages", icon: Store },
};

export function SideSwitch({ side, onChange }: { side: IntakeSide; onChange: (s: IntakeSide) => void }) {
  return (
    <div role="radiogroup" aria-label="Which side are you on?" data-testid="intake-sides" className="grid grid-cols-2 gap-2 rounded-2xl bg-foreground/[0.05] p-1.5">
      {(["advertiser", "publisher"] as const).map((s) => {
        const on = side === s;
        const S = SIDES[s];
        return (
          <button key={s} type="button" role="radio" aria-checked={on} data-testid={`intake-side-${s}`} onClick={() => onChange(s)} className={`flex items-start gap-2 rounded-xl px-3 py-3 text-left transition ${on ? "bg-[#0b1f3a] text-white shadow-lg" : "hover:bg-white"}`}>
            <S.icon className={`mt-0.5 size-5 shrink-0 ${on ? "text-lime-300" : "text-foreground/50"}`} aria-hidden />
            <span>
              <span className="block text-base font-bold">{S.label}</span>
              <span className={`block text-[11px] leading-snug ${on ? "text-lime-100" : "text-foreground/60"}`}>{S.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type CtaKind = "look" | "publisher";
/** The one strong primary CTA. Advertiser → the $190 USD look (existing offer, no new terms); publisher → list a hub. */
export function PrimaryCta({ side, where, tone = "light", secondary = true }: { side: IntakeSide; where: IntakeDetail; tone?: "light" | "dark"; secondary?: boolean }) {
  const kind: CtaKind = side === "publisher" ? "publisher" : "look";
  const big = "inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-bold shadow-lg transition";
  const sub = tone === "dark" ? "text-white/80" : "text-foreground/70";
  return (
    <div data-testid={`primary-cta-${where}`} data-side={side} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      {kind === "look" ? (
        <>
          <a href={lookHref("intake_sell_look")} data-testid="primary-cta-look" onClick={(e) => { if (openLane({ lane: "card", sku: "hold-190" })) { e.preventDefault(); return; } trackIntake(side, "cta_click", "look_190"); trackCta("cta_hold_190", { offer: "hold-190" }); }} className={`${big} bg-lime-300 text-[#0b1f3a] shadow-lime-500/30 hover:bg-[#0b1f3a] hover:text-white`}>
            Start the $190 USD look <ArrowRight className="size-5" />
          </a>
          {secondary ? <a href={RESERVE_HREF} data-testid="primary-cta-reserve" onClick={(e) => { if (openLane({ lane: "card", sku: "reserve-490" })) { e.preventDefault(); return; } trackIntake(side, "cta_click", "reserve_490"); trackCta("cta_reserve_490", { offer: "reserve-490" }); }} className={`text-sm font-semibold underline ${sub}`}>or a $490 USD category placement</a> : null}
        </>
      ) : (
        <a href={where === "done" ? "/intake/publisher" : "/intake/publisher#publisher-contact-submit"} data-testid="primary-cta-publisher" onClick={() => trackIntake(side, "cta_click", where === "done" ? "publisher_payout" : "send_for_review")} className={`${big} bg-lime-300 text-[#0b1f3a] shadow-lime-500/30 hover:bg-[#0b1f3a] hover:text-white`}>
          {where === "done" ? "See my full hub payout estimate" : skinText("List my hub with Birch Reserve")} <ArrowRight className="size-5" />
        </a>
      )}
    </div>
  );
}

/** A full-width band carrying the primary CTA, for the top of role pages and the foot of report states. */
export function CtaBand({ side, where, line }: { side: IntakeSide; where: IntakeDetail; line?: string }) {
  return (
    <section data-testid={`cta-band-${where}`} className="border-y border-border/70 bg-[#0b1f3a] text-white">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:justify-between">
        <p className="max-w-xl text-sm text-white/85">{line ?? (side === "publisher" ? skinText("Your hub's screens and pages: max exposure for curated products, and a share for you. A person at Birch Reserve reviews every hub.") : "Accelerate on live hub screens, by category. Start with the $190 USD look; the reserve is $490 USD.")}</p>
        <PrimaryCta side={side} where={where} tone="dark" />
      </div>
    </section>
  );
}

/**
 * Plain-language review state. Only "In review, pending BR approval", and only when Friday reports pending_review.
 * Friday's hub-partner match is internal only: no match badge is ever rendered here (withheld per Friday's contract).
 */
export function LeadGatesStatus({ gates, testId = "lead-gates", details = true }: { gates: LeadGates | undefined | null; testId?: string; details?: boolean }) {
  if (gates?.review !== "pending_review") return null;
  return (
    <div data-testid={testId} className="mt-3 flex flex-wrap items-center gap-2">
      {gates.mock ? <span data-testid={`${testId}-mock`} className="inline-flex items-center gap-1 rounded-full bg-violet-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"><FlaskConical className="size-3" />Mock · preview state</span> : null}
      <span data-testid={`${testId}-pending`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-800"><Clock className="size-3.5" />In review, pending BR approval</span>
      {details ? <Details className="basis-full !mt-0" testId={`${testId}-details`}><p>{skinText("A person at Birch Reserve approves before anything changes on a hub screen or page. Nothing is booked or charged until then.")}</p></Details> : null}
    </div>
  );
}

/** /intake: what the statuses look like after you send. Sample states only, clearly labelled. */
export function SampleLeadStatus() {
  return (
    <div data-testid="sample-lead-status" className="rounded-2xl border border-dashed border-foreground/25 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/60"><span className="mr-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] text-background">Sample</span>After you send · example status</p>
      <div className="-mt-1"><LeadGatesStatus testId="sample-lead-gates" gates={{ review: "pending_review" }} /></div>
      <p className="mt-2 text-[11px] text-muted-foreground">{skinText("Example only. Every request is reviewed by a person at Birch Reserve.")}</p>
    </div>
  );
}
