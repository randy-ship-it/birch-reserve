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
import { URGENCY_LINE } from "../../../../api-server/src/lib/overhaul/pilotPath";
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Details } from "@/components/br/details";
import { ExclusiveReserveCard, SpendDown } from "@/components/br/inventory-plan";
import { HubMock, twoLaneMock } from "@/components/br/two-lane";
import { HUB_MOCKS, HUB_KEYS, type HubKey } from "@/lib/hub-mocks";
import { STARTER_BLOCK } from "@/components/br/start-small";
import { trackCta } from "@/lib/track-cta";
import { MODELLED_PLAN_LABEL } from "@/components/br/modelled";
export { MODELLED_PLAN_LABEL, PlanChip } from "@/components/br/modelled";
import { RATE_SURFACES, fmtUsd } from "../../../../api-server/src/lib/overhaul/pricing";
import { DEPOSIT_TIERS } from "../../../../api-server/src/lib/sponsorKit";
import { CARRY_OVER_CLAUSE } from "../../../../api-server/src/lib/sponsorTerms";
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

/** Live-hub mock with numbered pins (DR-HO'S physio or SOLE, the two live hubs). Legend lives in an expander. */
/** Audit #3 (Randy, Nov 20 2026): always-visible badge + pin legend + DR-HO'S/SOLE toggle. */
export const MOCK_PINS = ["Your ad card, approved by a person", "Live members-only hub", "Clicks to your site, UTM-tagged"] as const;
export function mockBadge(hub: HubKey): string {
  return `Illustrative mock · your ad on the live ${HUB_MOCKS[hub].name} hub`;
}
export function AnnotatedHubMock({ brand = "", testId = "annotated-hub-mock", initial = "drho" }: { brand?: string; testId?: string; initial?: HubKey }) {
  const [hub, setHub] = useState<HubKey>(initial);
  return (
    <div data-testid={testId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-[#F1D58F] bg-[#FFF4DB] px-2.5 py-1 text-[11px] font-bold text-[#8A5A00]" data-testid="mock-badge">{mockBadge(hub)}</span>
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto text-[11px] font-bold uppercase tracking-wider [scrollbar-width:none]" role="group" aria-label="Live hub">
          {HUB_KEYS.map((h) => (
            <button key={h} type="button" aria-pressed={hub === h} onClick={() => setHub(h)} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 ${hub === h ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/70 ring-1 ring-foreground/15"}`} data-testid={`mock-hub-${h}`}>
              {HUB_MOCKS[h].tab}
            </button>
          ))}
        </div>
      </div>
      <HubMock brand={brand} logo={null} hub={hub} category="Your category" pins badge={mockBadge(hub)} />
      <p className="mt-1.5 text-[11px] text-foreground/55" data-testid="mock-coming-soon">Coming soon: Food &amp; Nutrition hub</p>
      <ol className="mt-2 grid gap-1 text-[12px] text-foreground/75 sm:grid-cols-3" data-testid="annotated-hub-legend">
        {MOCK_PINS.map((p, i) => (
          <li key={p} className="flex items-start gap-1.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lime-300 text-[10px] font-black text-[#0b1f3a]" aria-hidden>{i + 1}</span>
            <span><span className="sr-only">{i + 1} </span>{p}</span>
          </li>
        ))}
      </ol>
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
        {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : null}Get a pre-filled IO <ArrowRight className="size-4" />
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

/** Pack button: /sponsor?pack=…#prepay; with kit details, the same sealed token as /buy prefills brand + email there. */
async function openSponsorPack(key: string, where: string, kit?: KitPrefill | null): Promise<void> {
  const base = withUtm(`/sponsor?pack=${key}`, where, key);
  let href = `${base}#prepay`;
  if (kit && (kit.email || kit.brand)) {
    try {
      const r = await fetch("/v1/buy/prefill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: kit.email ?? "", company: kit.brand ?? "", website: kit.website ?? "" }) });
      const j = (await r.json().catch(() => ({}))) as { pf?: string };
      if (r.ok && j.pf) href = `${base}&pf=${encodeURIComponent(j.pf)}#prepay`;
    } catch { /* plain link still works */ }
  }
  goTo(href);
}

/**
 * Mid-tier band (Randy, Nov 20 2026 audit #6): three sponsorship packs, each "Prepay $X" (card on /sponsor, existing
 * deposit checkout), plus the agency $1K–$5K client test (pre-filled IO, no card). USD only.
 */
/** Static annotated sample card on the live SOLE hub, beside the deposit CTAs (Randy t291u). Labelled "Illustrative mock". */
export function DepositMock({ hub = "sole" }: { hub?: HubKey }) {
  return (
    <figure className="w-full max-w-[300px] shrink-0" data-testid="deposit-mock">
      <span className="mb-1.5 inline-block rounded-full border border-[#F1D58F] bg-[#FFF4DB] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8A5A00]">Illustrative mock</span>
      <HubMock brand="" logo={null} hub={hub} category="Your category" pins badge="Illustrative mock" />
      <figcaption className="mt-1.5 text-[11px] leading-snug text-white/70">Sample card on the live {HUB_MOCKS[hub].name} hub: <b className="text-lime-300">1</b> your card, approved by a person · <b className="text-lime-300">2</b> members-only hub · <b className="text-lime-300">3</b> UTM-tagged click to your site.</figcaption>
    </figure>
  );
}

export function MidTier({ where, kit, showMock = true }: { where: string; compact?: boolean; kit?: KitPrefill | null; showMock?: boolean }) {
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const cardCls = "flex flex-col rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/15";
  const prepay = (key: string) => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (busy) return;
    setBusy(key);
    void openSponsorPack(key, where, kit).finally(() => setBusy(""));
  };
  return (
    <section className="rounded-3xl p-5 text-white md:p-6" style={{ background: NAVY }} data-testid="mid-tier" data-where={where}>
      <div className={showMock ? "flex flex-col gap-4 md:flex-row md:items-start md:justify-between" : ""}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">Next step after your kit or $190 look</p>
          <h3 className="mt-1 font-display text-2xl leading-tight md:text-3xl" data-testid="mid-tier-line">Bigger test? Prepay a sponsorship pack.</h3>
          <p className="mt-1 text-[13px] text-white/75">Card now. Your insertion order names the hub and dates before anything runs.</p>
          <p className="mt-2 inline-flex rounded-full bg-lime-300/15 px-3 py-1 text-[12px] font-semibold text-lime-200 ring-1 ring-lime-300/40" data-testid="mid-tier-carry-over">Credit carries over: {CARRY_OVER_CLAUSE.replace(/^A paid/, "a paid")}</p>
          <p className="mt-2 text-[13px] font-semibold text-lime-300" data-testid="early-rate-line">{URGENCY_LINE}</p>
        </div>
        {showMock ? <DepositMock hub="calmjoints" /> : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {DEPOSIT_TIERS.map((t) => {
          const credit = Math.round(t.usd * (1 + t.bonusPct / 100));
          const href = `${withUtm(`/sponsor?pack=${t.key}`, where, t.key)}#prepay`;
          return (
            <article key={t.key} className={`${cardCls} ${t.bonusPct === 10 ? "ring-2 ring-lime-300/70" : ""}`} data-testid={`mid-tier-pack-${t.usd}`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">{t.label}</p>
              <p className="mt-1 font-display text-3xl leading-none">{fmtUsd(t.usd)} <span className="text-sm">USD</span></p>
              <p className="mb-3 mt-1.5 text-[13px] text-white/75">+{t.bonusPct}% bonus media credit · {fmtUsd(credit)} USD to spend.</p>
              <a href={href} onClick={prepay(t.key)} className="mt-auto inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-lime-300 px-4 text-sm font-bold text-[#0b1f3a] hover:bg-white" data-testid={`mid-tier-prepay-${t.usd}`}>
                {busy === t.key ? <Loader2 className="size-4 animate-spin" /> : null}Prepay {fmtUsd(t.usd)} <ArrowRight className="size-4" />
              </a>
            </article>
          );
        })}
      </div>
      <article className={`${cardCls} mt-3 md:flex-row md:items-center md:justify-between md:gap-4`} data-testid="mid-tier-agency">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Agency client test</p>
          <p className="mt-1 font-display text-2xl leading-none">$1K–$5K <span className="text-sm">USD</span></p>
          <p className="mt-1 text-[13px] text-white/75">{AGENCY_TEST.cashPct}% cash to the agency. Pre-filled IO, no card.</p>
        </div>
        <button type="button" onClick={() => setAgencyOpen((v) => !v)} aria-expanded={agencyOpen} className="mt-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-white ring-1 ring-white/40 hover:bg-white hover:text-[#0b1f3a] md:mt-0" data-testid="mid-tier-agency-cta">
          Prepay a test <ArrowRight className="size-4" />
        </button>
      </article>
      {agencyOpen ? <div className="mt-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-lime-300/50" data-testid="mid-tier-agency-panel"><AgencyPrepayForm where={where} dark /></div> : null}
      <div className="mt-3"><ExclusiveReserveCard where={where} /></div>
      <p className="mt-3 text-[12px] text-white/70" data-testid="mid-tier-pack-terms">Packs: refundable until 14 days before the IO launch date. Bonus is media credit only, no cash value. No impression guarantees; reporting is aggregate. A paid $190 look or $490 reserve counts in full toward a pack within 30 days.</p>
      <div className="mt-3"><SpendDown dark testId="mid-tier-spend-down" /></div>
      <Details dark label="Agency terms, view blocks and a $1.5K–$5K example" testId="mid-tier-details">
        <p data-testid="mid-tier-agency-terms">{MID_TIER_LINE} One IO per client. {AGENCY_REPORTING_LINE}.</p>
        <p data-testid="mid-tier-refund">{MID_TIER_REFUND}</p>
        <p>View block: from {fmtUsd(STARTER_BLOCK.startingUsd)} USD for 100K modelled views. <a href={withUtm("/?inquire=pack&block=100000&surfaces=landing#quick-buy", where, "block")} className="font-semibold text-lime-300 underline underline-offset-2" data-testid="mid-tier-block-cta">Request a block</a></p>
        <p>Premium, one brand per category: $25K–$50K by invoice, or lock a $5K–$50K CAD package with the <a href={withUtm("https://birchreserve.net/exclusive", where, "exclusive-1900")} className="font-semibold text-lime-300 underline underline-offset-2">$1,900 CAD reserve</a>. <a href={withUtm("/buy?plan=exclusive", where, "exclusive")} className="font-semibold text-lime-300 underline underline-offset-2" data-testid="mid-tier-exclusive">Request an invoice</a></p>
        <TwoSurfaceExample dark />
      </Details>
    </section>
  );
}

/**
 * Next step after the kit: live-hub mock beside ONE primary button ($190 look) and a text link ($490), then the
 * mid-tier band. `yieldToPostKit`: the page-level copy on /intake hides once the post-kit copy mounts (never two on a page).
 */
const POST_KIT_EVENT = "birch:post-kit-next" as const;
export function NextStep({ where, brand = "", anchor = true, yieldToPostKit = false, showMock = true }: { where: string; brand?: string; anchor?: boolean; yieldToPostKit?: boolean; showMock?: boolean }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (where === "post_kit") {
      (window as unknown as Record<string, boolean>).__birchPostKit = true;
      window.dispatchEvent(new Event(POST_KIT_EVENT));
      return () => { (window as unknown as Record<string, boolean>).__birchPostKit = false; };
    }
    if (!yieldToPostKit) return;
    if ((window as unknown as Record<string, boolean>).__birchPostKit) setHidden(true);
    const on = () => setHidden(true);
    window.addEventListener(POST_KIT_EVENT, on);
    return () => window.removeEventListener(POST_KIT_EVENT, on);
  }, [where, yieldToPostKit]);
  if (hidden) return null;
  return (
    <section id={anchor ? "next-step" : undefined} className="scroll-mt-20" data-testid="next-step" data-where={where}>
      <h2 className="font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">{showMock ? "See it on a live hub first." : "Start with a $190 look."}</h2>
      <div className={`mt-4 grid grid-cols-[minmax(0,1fr)] items-center gap-5 ${showMock ? "md:grid-cols-[1.2fr_1fr]" : ""}`}>
        {showMock ? <AnnotatedHubMock brand={brand} initial="effortless" /> : null}
        <div>
          <p className="font-display text-5xl leading-none text-[#0b1f3a]">$190 <span className="text-lg">USD</span></p>
          <p className="mt-2 text-[15px] text-foreground/75">Your ad, live for 7 days.</p>
          <a href={withUtm("/buy?plan=hold-190", where, "look")} onClick={() => trackCta("cta_hold_190", { offer: "hold-190" })} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-base font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30 hover:bg-[#0b1f3a] hover:text-white sm:w-auto" data-testid="next-step-look">
            Start the $190 look <ArrowRight className="size-5" />
          </a>
          <p className="mt-3 text-sm">
            <a href={withUtm("/buy?plan=reserve-490", where, "reserve")} onClick={() => trackCta("cta_reserve_490", { offer: "reserve-490" })} className="font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="next-step-reserve">or reserve $490 as media credit</a>
          </p>
          <Details label="Refunds, checkout and agencies" testId="next-step-details">
            <p>$190: 100% credit if you reserve within 7 days, otherwise a cash refund. $490: fully refundable until 14 days before the launch date in your IO.</p>
            <p>Card checkout by Stripe. Upload your ad on the same page. A person approves every order before it runs.</p>
            <p data-testid="next-step-agency-line">Agencies: {AGENCY_TEST.cashPct}% of media spend paid in cash · {AGENCY_REPORTING_LINE}.</p>
          </Details>
        </div>
      </div>
      <div className="mt-6"><MidTier where={where} showMock={!showMock} /></div>
    </section>
  );
}

/* ------------------------------------------------------------------ post-kit (Randy, Nov 20 2026 9:47 AM ET) */
export type KitPrefill = { brand?: string | null; email?: string | null; website?: string | null; /** What the kit headline calls them (brand, else the site host). */ label?: string | null };

/** Same-origin navigation that also works on the scalehealth.ca mirror (its boot shim maps paths to birchreserve.net). */
function goTo(path: string) {
  const m = (window as { __BR_MIRROR?: { href?: (u: string) => string } }).__BR_MIRROR;
  window.location.assign(m?.href ? m.href(path) : path);
}

/**
 * Kit details -> encrypted /buy prefill token (POST /v1/buy/prefill), then /buy?plan=…&pf=<token>.
 * The email never goes in the URL. If the token call fails, the plain /buy link still works.
 */
export async function openPrefilledBuy(plan: "hold-190" | "reserve-490", kit: KitPrefill, where: string): Promise<void> {
  const base = withUtm(`/buy?plan=${plan}`, where, plan === "hold-190" ? "look" : "reserve");
  try {
    const r = await fetch("/v1/buy/prefill", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: kit.email ?? "", company: kit.brand ?? "", website: kit.website ?? "" }) });
    const j = (await r.json().catch(() => ({}))) as { pf?: string };
    goTo(r.ok && j.pf ? `${base}&pf=${encodeURIComponent(j.pf)}` : base);
  } catch {
    goTo(base);
  }
}

/** Post-kit next step: right under the kit's headline numbers. Mock left, button right; mobile sticky bar. */
export function PostKitNext({ kit, where = "post_kit" }: { kit: KitPrefill; where?: string }) {
  const [busy, setBusy] = useState<"" | "hold-190" | "reserve-490">("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    (window as unknown as Record<string, boolean>).__birchPostKit = true;
    window.dispatchEvent(new Event(POST_KIT_EVENT));
    return () => { (window as unknown as Record<string, boolean>).__birchPostKit = false; };
  }, []);
  const go = (plan: "hold-190" | "reserve-490") => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (busy) return;
    setBusy(plan);
    trackCta(plan === "hold-190" ? "cta_hold_190" : "cta_reserve_490", { offer: plan });
    void openPrefilledBuy(plan, kit, where).finally(() => setBusy(""));
  };
  const brand = (kit.brand ?? "").trim();
  const label = (kit.label ?? "").trim() || brand;
  return (
    <section className="rounded-3xl bg-white p-4 md:p-6" data-testid="post-kit-next" data-where={where}>
      <h2 className="font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">Your kit is ready. See your ad live.</h2>
      <div className="mt-4 grid items-center gap-5 md:grid-cols-[1.2fr_1fr]">
        <AnnotatedHubMock brand={brand} initial="sole" />
        <div>
          <p className="mb-3 text-[13px] font-semibold text-[#0b1f3a]" data-testid="post-kit-urgency">{URGENCY_LINE}</p>
          <a href={withUtm("/buy?plan=hold-190", where, "look")} onClick={go("hold-190")} className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-7 text-lg font-bold text-white hover:bg-[#13305a] md:w-auto" data-testid="post-kit-look">
            {busy === "hold-190" ? <Loader2 className="size-5 animate-spin" /> : null}Start the $190 look <ArrowRight className="size-5" />
          </a>
          <p className="mt-3 text-sm">
            <a href={withUtm("/buy?plan=reserve-490", where, "reserve")} onClick={go("reserve-490")} className="font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="post-kit-reserve">or reserve $490 as media credit</a>
          </p>
          <p className="mt-3 text-[13px] text-foreground/70" data-testid="post-kit-prefill-line">
            {label ? `Prefilled for ${label}. ` : "Prefilled from your kit. "}100% credit toward $490 within 7 days, otherwise refunded.
          </p>
        </div>
      </div>
      <div className="mt-6"><MidTier where={where} kit={kit} showMock={false} /></div>
      {/* Mobile: one sticky bar for the two card offers, portalled to <body> so no transformed ancestor (Scale skin) breaks `fixed`. The chat/voice dock lifts above it (randy-chat.tsx --birch-dock-bottom). */}
      {mounted ? createPortal(
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-foreground/10 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-8px_24px_-12px_rgba(7,26,57,0.35)] backdrop-blur md:hidden" data-testid="post-kit-sticky">
        <a href={withUtm("/buy?plan=hold-190", where, "look")} onClick={go("hold-190")} className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-[#0b1f3a] text-sm font-bold text-white" data-testid="post-kit-sticky-look">$190 look</a>
        <span aria-hidden className="text-foreground/40">·</span>
        <a href={withUtm("/buy?plan=reserve-490", where, "reserve")} onClick={go("reserve-490")} className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-[#0b1f3a] text-sm font-bold text-[#0b1f3a]" data-testid="post-kit-sticky-reserve">$490 reserve</a>
      </div>,
        document.body,
      ) : null}
      <div className="h-16 md:hidden" aria-hidden />
    </section>
  );
}
