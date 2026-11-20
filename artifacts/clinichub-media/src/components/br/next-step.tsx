/**
 * Next-step path (Randy, Nov 20 2026 review: "get companies past the $190–$490 test and into significant media credit").
 *
 * <NextStep>     annotated mock of the ad card on a live hub (DR-HO'S physio or SOLE) beside the $190 / $490 CTAs,
 *                then the mid-tier band. Used after the Monetization Kit, on the intake advertiser path and the media kit.
 * <MidTier>      "significant but still low-risk" step: starter view block, agency client test ($1K–$5K) with a short
 *                "Prepay a client test budget" form (pre-filled IO request on the existing /v1/leads path), and the
 *                live sponsorship credit tiers ($1.5K / $3K / $6K with +5/+10/+15% bonus credit, /sponsor).
 *
 * Only tiers that already exist: hold-190 / reserve-490 (card, /buy), STARTER_BLOCK (pricing.ts), AGENCY_TEST (twoLane.ts),
 * DEPOSIT_TIERS (sponsorKit.ts), premium $25K–$50K inquire-only. No new prices, no new Stripe prices, nothing charged here.
 * Refund wording is the live /terms line for the $490 reserve; everything else says the IO sets the terms.
 * Copy rules: no counts, never "open/available/unclaimed", no impression/CTR/ROAS guarantees, modelled figures labelled.
 */
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { Details } from "@/components/br/details";
import { EARLY_RATE_LINE } from "@/components/br/prime-hero";
import { HubMock, twoLaneMock } from "@/components/br/two-lane";
import { STARTER_BLOCK } from "@/components/br/start-small";
import { trackCta } from "@/lib/track-cta";
import { MODELLED_PLAN_LABEL } from "@/components/br/modelled";
export { MODELLED_PLAN_LABEL, PlanChip } from "@/components/br/modelled";
import { RATE_SURFACES, fmtUsd } from "../../../../api-server/src/lib/overhaul/pricing";
import { DEPOSIT_TIERS } from "../../../../api-server/src/lib/sponsorKit";
import { AGENCY_TEST, agencyPrepayLeadPayload, clampAgencyBudget, draftRef } from "../../../../api-server/src/lib/twoLane";

export const MID_TIER_LINE = `Prepay a client test or sponsorship credit. 100% media credit. ${AGENCY_TEST.cashPct}% cash to the agency of record.`;
/** Straight cut of the live /terms reserve-490 line, plus "the IO sets the terms" for everything else. */
export const MID_TIER_REFUND = "Nothing runs until you sign the IO, and the IO sets the refund terms. The $490 card reserve is fully refundable until 14 days before the launch date in your IO.";
export const AGENCY_REPORTING_LINE = "UTM and promo-code reporting per hub and surface";

const NAVY = "#0b1f3a";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const input = "h-11 w-full min-w-0 rounded-xl border border-foreground/15 bg-white px-3 text-[15px] text-[#0b1f3a] outline-none focus:border-[#0b1f3a] focus:ring-2 focus:ring-lime-300";

function withUtm(href: string, where: string, key: string): string {
  const [path, hash] = href.split("#");
  const sep = path!.includes("?") ? "&" : "?";
  return `${path}${sep}utm_source=birchreserve&utm_medium=next-step&utm_campaign=${encodeURIComponent(`${where}-${key}`)}${hash ? `#${hash}` : ""}`;
}

/** 93,750 -> "94K"; 1,250,000 -> "1.3M". Rounded so modelled numbers never look precise. */
function views(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `${Math.round(n / 1000)}K`;
}

const surface = (k: "landing" | "dashboard") => RATE_SURFACES.find((s) => s.key === k)!;
/** Straight-line split 50/50 across two non-premium surfaces at the published starter CPM range. */
export function twoSurfaceExample(creditUsd: number) {
  return (["landing", "dashboard"] as const).map((k) => {
    const s = surface(k);
    const half = creditUsd / 2;
    return { key: k, label: k === "landing" ? "Hub home" : "Member dashboard", cpm: s.cpmStarter, lo: (half / s.cpmStarter[1]) * 1000, hi: (half / s.cpmStarter[0]) * 1000, spend: half };
  });
}

/** Live-hub mock with numbered callouts. Pick DR-HO'S physio or SOLE (the two live hubs). */
export function AnnotatedHubMock({ brand = "" }: { brand?: string }) {
  const [hub, setHub] = useState<"drho" | "sole">("drho");
  const notes = [
    { n: 1, t: "Your ad card", d: "Logo, one line, one button. A person approves it before it runs." },
    { n: 2, t: hub === "drho" ? "DR-HO'S physio, live hub" : "SOLE, live hub", d: "Members-only. They come here to book and buy." },
    { n: 3, t: "Clicks go to your site", d: "Tagged with your UTMs or a promo code." },
  ];
  return (
    <div data-testid="annotated-hub-mock">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/55" role="group" aria-label="Live hub">
        {(["drho", "sole"] as const).map((h) => (
          <button key={h} type="button" aria-pressed={hub === h} onClick={() => setHub(h)} className={`rounded-full px-3 py-1 ${hub === h ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/70 ring-1 ring-foreground/15"}`} data-testid={`annotated-hub-${h}`}>
            {h === "drho" ? "DR-HO'S physio" : "SOLE"}
          </button>
        ))}
      </div>
      <div className="relative">
        <HubMock brand={brand} logo={null} hub={hub} category="Your category" />
        {/* Numbered pins line up with the legend below. */}
        <span className="absolute bottom-[38%] right-[52%] grid size-7 place-items-center rounded-full bg-lime-300 text-xs font-black text-[#0b1f3a] shadow-lg ring-2 ring-white" aria-hidden>1</span>
        <span className="absolute left-3 top-14 grid size-7 place-items-center rounded-full bg-lime-300 text-xs font-black text-[#0b1f3a] shadow-lg ring-2 ring-white" aria-hidden>2</span>
        <span className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-lime-300 text-xs font-black text-[#0b1f3a] shadow-lg ring-2 ring-white" aria-hidden>3</span>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3" data-testid="annotated-hub-legend">
        {notes.map((x) => (
          <li key={x.n} className="flex gap-2 text-[12px] leading-snug text-foreground/70">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lime-300 text-[10px] font-black text-[#0b1f3a]">{x.n}</span>
            <span><b className="block text-[#0b1f3a]">{x.t}</b>{x.d}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[11px] text-foreground/50">Mock of the card on a live hub. The IO names the exact hub and spot.</p>
    </div>
  );
}

/** "Prepay a client test budget": agency, client, email, budget ($1K–$5K) -> pre-filled IO request. No card. */
export function AgencyPrepayForm({ where, dark = false }: { where: string; dark?: boolean }) {
  const [agency, setAgency] = useState("");
  const [client, setClient] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState<number>(2_500);
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [ref, setRef] = useState("");
  const b = clampAgencyBudget(budget);
  const cash = Math.round((b * AGENCY_TEST.cashPct) / 100);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setState("error"); return; }
    const r = draftRef(client || agency);
    setRef(r);
    if (hp) { setState("sent"); return; }
    setState("busy");
    if (twoLaneMock()) { setState("sent"); return; }
    try {
      const path = typeof window === "undefined" ? "/" : window.location.pathname;
      const res = await fetch("/v1/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(agencyPrepayLeadPayload({ email, agency, client, budgetUsd: b, where }, r, path)) });
      setState(res.ok ? "sent" : "error");
    } catch { setState("error"); }
  };
  const txt = dark ? "text-white" : "text-[#0b1f3a]";
  if (state === "sent")
    return (
      <p className={`text-sm font-semibold ${txt}`} data-testid="agency-prepay-sent">
        <Check className="mr-1 inline size-4 text-lime-400" />Request in ({ref}). We reply with a pre-filled IO for {fmtUsd(b)} USD. No card was charged.
      </p>
    );
  return (
    <form onSubmit={send} className="grid gap-2" data-testid="agency-prepay-form">
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Agency" placeholder="Agency" value={agency} onChange={(e) => setAgency(e.target.value)} className={input} data-testid="agency-prepay-agency" />
        <input aria-label="Client brand" placeholder="Client brand" value={client} onChange={(e) => setClient(e.target.value)} className={input} data-testid="agency-prepay-client" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input aria-label="Work email" type="email" required placeholder="you@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} data-testid="agency-prepay-email" />
        <label className={`flex h-11 items-center gap-2 rounded-xl px-3 text-sm ${dark ? "bg-white/10 text-white" : "bg-foreground/[0.04] text-[#0b1f3a]"}`}>
          <span className="text-[11px] font-bold uppercase tracking-wide opacity-70">Budget</span>
          <span aria-hidden>$</span>
          <input aria-label="Client test budget in USD" type="number" min={AGENCY_TEST.lowUsd} max={AGENCY_TEST.highUsd} step={250} value={budget} onChange={(e) => setBudget(Number(e.target.value))} onBlur={() => setBudget(b)} className="w-20 bg-transparent font-bold outline-none" data-testid="agency-prepay-budget" />
          <span className="text-[11px] opacity-70">USD</span>
        </label>
      </div>
      <input tabIndex={-1} aria-hidden autoComplete="off" name="company_url" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <button type="submit" disabled={state === "busy"} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime-300 px-5 text-sm font-bold text-[#0b1f3a] hover:bg-white" data-testid="agency-prepay-send">
        {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : null}Prepay a client test budget · get the IO <ArrowRight className="size-4" />
      </button>
      <p className={`text-[12px] ${dark ? "text-white/65" : "text-foreground/60"}`}>
        {fmtUsd(b)} USD budget · agency earns <b>{fmtUsd(cash)} USD</b> cash ({AGENCY_TEST.cashPct}%). No card today: we send a pre-filled IO to sign.
      </p>
      {state === "error" ? <p className="text-[12px] font-semibold text-red-400" role="alert">Add a work email, or email sales@silverbirchgrowth.com.</p> : null}
    </form>
  );
}

function TwoSurfaceExample({ dark = false }: { dark?: boolean }) {
  const rows = [1_500, 5_000].map((c) => ({ c, parts: twoSurfaceExample(c) }));
  return (
    <div className="mt-2 overflow-x-auto" data-testid="two-surface-example">
      <table className={`w-full min-w-[420px] text-left text-[12px] ${dark ? "text-white/85" : "text-foreground/80"}`}>
        <thead><tr className="opacity-70"><th className="py-1 pr-3 font-semibold">Credit</th><th className="py-1 pr-3 font-semibold">Hub home (${surface("landing").cpmStarter.join("–$")} CPM)</th><th className="py-1 font-semibold">Member dashboard (${surface("dashboard").cpmStarter.join("–$")} CPM)</th></tr></thead>
        <tbody>
          {rows.map(({ c, parts }) => (
            <tr key={c} className={`border-t ${dark ? "border-white/15" : "border-foreground/10"}`}>
              <td className="py-1.5 pr-3 font-bold">{fmtUsd(c)} USD</td>
              {parts.map((p) => <td key={p.key} className="py-1.5 pr-3">{fmtUsd(p.spend)} ≈ {views(p.lo)}–{views(p.hi)} views</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`mt-1 text-[11px] ${dark ? "text-white/60" : "text-foreground/55"}`}>{MODELLED_PLAN_LABEL}. Straight-line split 50/50 at the starter CPM range on the rate card. No impression, click or sales guarantee. Your IO sets the final rate and split.</p>
    </div>
  );
}

/** Mid-tier band: the bridge from a $490 test to real spend. */
export function MidTier({ where, compact = false }: { where: string; compact?: boolean }) {
  const [agencyOpen, setAgencyOpen] = useState(false);
  const tiers = DEPOSIT_TIERS.map((t) => `${fmtUsd(t.usd)} (+${t.bonusPct}%)`).join(" · ");
  const card = "flex flex-col rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/15";
  return (
    <section className="rounded-3xl p-5 text-white md:p-7" style={{ background: NAVY }} data-testid="mid-tier" data-where={where}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">Bigger test, still low risk</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-lime-300 px-2.5 py-0.5 text-[11px] font-bold text-[#0b1f3a]" data-testid="early-rate-line"><Sparkles className="size-3" aria-hidden />{EARLY_RATE_LINE}</span>
      </div>
      <h3 className="mt-2 font-display text-2xl leading-tight md:text-3xl" data-testid="mid-tier-line">{MID_TIER_LINE}</h3>
      <div className={`mt-4 grid gap-3 ${compact ? "md:grid-cols-3" : "md:grid-cols-3"}`}>
        <article className={card} data-testid="mid-tier-agency">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Agency client test</p>
          <p className="mt-1 font-display text-3xl leading-none">$1K–$5K <span className="text-base">USD</span></p>
          <p className="mt-2 text-[13px] text-white/75">One IO per client. <b className="text-lime-300">{AGENCY_TEST.cashPct}% cash</b> to the agency. {AGENCY_REPORTING_LINE}.</p>
          <button type="button" onClick={() => setAgencyOpen((v) => !v)} aria-expanded={agencyOpen} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full bg-lime-300 px-4 pt-0 text-sm font-bold text-[#0b1f3a] hover:bg-white sm:mt-4" data-testid="mid-tier-agency-cta">Prepay a client test budget <ArrowRight className="size-4" /></button>
        </article>
        <article className={card} data-testid="mid-tier-sponsor">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Sponsorship credit</p>
          <p className="mt-1 font-display text-3xl leading-none">$1.5K–$6K <span className="text-base">USD</span></p>
          <p className="mt-2 text-[13px] text-white/75">{tiers} bonus credit. Spends down on live hubs under your IO.</p>
          <a href={withUtm("/sponsor?currency=usd", where, "sponsor")} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white ring-1 ring-white/40 hover:bg-white hover:text-[#0b1f3a] sm:mt-4" data-testid="mid-tier-sponsor-cta">Pick a sponsorship tier <ArrowRight className="size-4" /></a>
        </article>
        <article className={card} data-testid="mid-tier-block">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Starter view block</p>
          <p className="mt-1 font-display text-3xl leading-none">From {fmtUsd(STARTER_BLOCK.startingUsd)} <span className="text-base">USD</span></p>
          <p className="mt-2 text-[13px] text-white/75">100K modelled views on one hub surface at the starter rate.</p>
          <a href={withUtm("/?inquire=pack&block=100000&surfaces=landing#quick-buy", where, "block")} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white ring-1 ring-white/40 hover:bg-white hover:text-[#0b1f3a] sm:mt-4" data-testid="mid-tier-block-cta">Request a block <ArrowRight className="size-4" /></a>
        </article>
      </div>
      {agencyOpen ? <div className="mt-4 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-lime-300/50" data-testid="mid-tier-agency-panel"><AgencyPrepayForm where={where} dark /></div> : null}
      <p className="mt-4 text-[13px] text-white/75" data-testid="mid-tier-refund">{MID_TIER_REFUND}</p>
      <p className="mt-1 text-[13px] text-white/75">Premium, one brand per category: $25K–$50K, inquire only. <a href={withUtm("/buy?plan=exclusive", where, "exclusive")} className="font-semibold text-lime-300 underline underline-offset-2" data-testid="mid-tier-exclusive">Request an invoice</a></p>
      <Details dark label="What a $1.5K–$5K credit looks like across two surfaces" testId="mid-tier-two-surface"><TwoSurfaceExample dark /></Details>
    </section>
  );
}

/** Next step after the kit: annotated live-hub mock beside the $190 / $490 CTAs, then the mid-tier band. */
export function NextStep({ where, brand = "", anchor = true }: { where: string; brand?: string; anchor?: boolean }) {
  const cta = "flex items-center gap-3 rounded-2xl p-4 text-left transition";
  return (
    <section id={anchor ? "next-step" : undefined} className="scroll-mt-20" data-testid="next-step" data-where={where}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">Your next step</p>
      <h2 className="mt-1 font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">See it on a live hub. Then lock it in.</h2>
      <div className="mt-4 grid items-start gap-5 md:grid-cols-[1.15fr_1fr]">
        <AnnotatedHubMock brand={brand} />
        <div className="grid gap-3">
          <a href={withUtm("/buy?plan=hold-190", where, "look")} onClick={() => trackCta("cta_hold_190", { offer: "hold-190" })} className={`${cta} bg-white ring-1 ring-foreground/15 hover:ring-[#0b1f3a]`} data-testid="next-step-look">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime-100"><CreditCard className="size-5 text-[#0b1f3a]" /></span>
            <span className="min-w-0"><span className="block text-lg font-extrabold text-[#0b1f3a]">Start with the $190 look</span><span className="block text-[13px] text-foreground/65">See your card on a live hub for 7 days. 100% credit if you reserve within 7 days, otherwise a cash refund.</span></span>
            <ArrowRight className="ml-auto size-5 shrink-0 text-[#0b1f3a]" />
          </a>
          <a href={withUtm("/buy?plan=reserve-490", where, "reserve")} onClick={() => trackCta("cta_reserve_490", { offer: "reserve-490" })} className={`${cta} bg-[#0b1f3a] text-white ring-2 ring-lime-300`} data-testid="next-step-reserve">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime-300"><CreditCard className="size-5 text-[#0b1f3a]" /></span>
            <span className="min-w-0"><span className="block text-lg font-extrabold">Reserve $490 as media credit</span><span className="block text-[13px] text-white/70">All $490 is media credit. Fully refundable until 14 days before the launch date in your IO.</span></span>
            <ArrowRight className="ml-auto size-5 shrink-0" />
          </a>
          <p className="text-[12px] text-foreground/60">Card checkout by Stripe. Upload your ad on the same page. A person approves every order before it runs.</p>
          <p className="rounded-xl bg-lime-50 px-3 py-2 text-[12px] font-semibold text-[#0b1f3a]" data-testid="next-step-agency-line">Agencies: {AGENCY_TEST.cashPct}% of media spend paid to you in cash · {AGENCY_REPORTING_LINE}.</p>
        </div>
      </div>
      <div className="mt-6"><MidTier where={where} /></div>
    </section>
  );
}
