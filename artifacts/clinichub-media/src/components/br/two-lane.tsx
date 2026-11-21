/**
 * Two-lane conversion layer on /intake (Randy t227u, Nov 19 2026 ET): "we want companies to put down a cc quickly"
 * and "big ad blocks by buyers via agency or brands that we can collect real cheques on".
 *
 * Lane A · Reserve space (card): brand, email, category -> a live-looking mock of their card on a live hub (DR-HO'S or
 *   SOLE only) -> the EXISTING /buycalc card checkout (it posts /v1/checkout -> Stripe and asks for the terms tick).
 *   No new payment code. Brand + email ride in sessionStorage, never in the URL. Agency client tests ($1K–$5K) have
 *   no checkout, so they are an inquiry on the existing /v1/leads path.
 * Lane B · Big block / agency (IO + cheque): band, flight, client, agency, email -> existing /v1/leads path (sales
 *   alert) + a downloadable draft IO / pro-forma PDF (cheque, wire or EFT to Silver Birch Growth Inc.).
 *
 * ?mock=1 (or a QA session): nothing is posted and the checkout page is not opened; the built link is shown instead.
 * Copy rules: no "open/still open/not taken/unclaimed", no zero counts, no CTR/ROAS/guarantees, estimates labelled.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, CreditCard, Download, FileText, ImagePlus, Landmark, Loader2, Lock } from "lucide-react";
import { Details } from "@/components/br/details";
import { LIVE_HUB_IMAGE, SOLE_HUB_IMAGE } from "@/components/br/prime-hero";
import { trackCta as trackCtaRaw } from "@/lib/track-cta";
import { trackIntake as trackIntakeRaw } from "@/lib/intakeTrack";
import { openRandyChat } from "@/lib/book-call";
import { kitPdfBlob, saveBlob } from "@/lib/kitRender";
import { ioDraftSvg } from "@/lib/ioDraft";
import {
  AGENCY_TEST,
  BLOCK_BANDS,
  CARD_OFFERS,
  LIVE_TERMS,
  PAYMENT_METHODS_LINE,
  QUICK_RESERVE_STORAGE_KEY,
  REMIT_LINE,
  TERM_CHIPS,
  TWO_LANE_CATEGORIES,
  agencyCashLabel,
  agencyTestLeadPayload,
  blockLeadPayload,
  draftRef,
  quickReserveHref,
  validFlight,
  type BlockBand,
  type CardSku,
} from "../../../../api-server/src/lib/twoLane";

export type Lane = "card" | "block";
export const OPEN_LANE_EVENT = "birch:open-lane" as const;
export type OpenLaneDetail = { lane: Lane; sku?: CardSku };
const MOCK_KEY = "br_two_lane_mock";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAVY = "#0b1f3a";

/** Explicit QA mock only (?mock=1 in this tab). Never inferred from a backend failure, so real leads are never dropped. */
export function twoLaneMock(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (new URLSearchParams(window.location.search).get("mock") === "1") sessionStorage.setItem(MOCK_KEY, "1");
    return sessionStorage.getItem(MOCK_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("mock") === "1";
  }
}

/** Aggregate funnel events, skipped in QA mock so a ?mock=1 run writes nothing. */
const trackIntake: typeof trackIntakeRaw = (...a) => { if (!twoLaneMock()) trackIntakeRaw(...a); };
const trackCta: typeof trackCtaRaw = (...a) => { if (!twoLaneMock()) trackCtaRaw(...a); };

/** Open a lane from anywhere on the page (the kit report CTAs use this when the lanes are on the page). */
export function openLane(detail: OpenLaneDetail): boolean {
  if (typeof window === "undefined" || !document.getElementById("two-lane")) return false;
  window.dispatchEvent(new CustomEvent(OPEN_LANE_EVENT, { detail }));
  return true;
}

const input = "h-12 w-full min-w-0 rounded-xl border border-foreground/15 bg-white px-3 text-base outline-none transition focus:border-[#0b1f3a] focus:ring-2 focus:ring-lime-300";
const label = "text-[11px] font-bold uppercase tracking-wide text-foreground/55";

function Steps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide" aria-label="Progress" data-testid="lane-steps">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span className={`grid size-6 place-items-center rounded-full ${i < step ? "bg-lime-300 text-[#0b1f3a]" : i === step ? "bg-[#0b1f3a] text-white" : "bg-foreground/10 text-foreground/50"}`}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
          <span className={i === step ? "text-[#0b1f3a]" : "text-foreground/45"}>{l}</span>
          {i < labels.length - 1 ? <span className="h-px w-4 bg-foreground/20 sm:w-8" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

function Chips({ items, dark }: { items: readonly string[]; dark?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="lane-terms-chips">
      {items.map((t) => (
        <li key={t} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${dark ? "bg-white/10 text-white/85" : "bg-lime-100 text-[#0b1f3a]"}`}>
          <Check className="size-3" aria-hidden />{t}
        </li>
      ))}
    </ul>
  );
}

/** Live-looking mock of the buyer's square card on a live hub surface. Logo stays in this browser (object URL). */
export function HubMock({ brand, logo, hub, category, pins = false, badge }: { brand: string; logo: string | null; hub: "drho" | "sole"; category: string; pins?: boolean; badge?: string }) {
  const name = brand.trim() || "Your brand";
  const hubName = hub === "drho" ? "DR-HO'S physio" : "SOLE";
  const surface = hub === "drho" ? "Booking confirmation" : "Hub home";
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <figure className="relative overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-foreground/10" data-testid="hub-mock" data-hub={hub}>
      <div className="flex items-center gap-1.5 border-b border-foreground/10 bg-foreground/[0.03] px-3 py-2">
        <span className="size-2 rounded-full bg-red-300" /><span className="size-2 rounded-full bg-amber-300" /><span className="size-2 rounded-full bg-lime-400" />
        <span className="ml-2 truncate text-[11px] text-foreground/55">{hub === "drho" ? "physio.drhonow.com" : "scalehealth.ca/sole"}</span>
      </div>
      <div className="relative aspect-[4/3] w-full">
        <img src={hub === "drho" ? LIVE_HUB_IMAGE : SOLE_HUB_IMAGE} alt={`${hubName} live hub`} className="absolute inset-0 size-full object-cover object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        <div className="absolute bottom-3 right-3 w-[52%] max-w-[230px] rounded-xl bg-white p-3 shadow-2xl ring-2 ring-lime-300" data-testid="hub-mock-card">
          {pins ? <><span className="absolute grid size-6 place-items-center rounded-full bg-lime-300 text-[11px] font-black text-[#0b1f3a] shadow-lg ring-2 ring-white -left-3 -top-3" aria-hidden>1</span><span className="absolute grid size-6 place-items-center rounded-full bg-lime-300 text-[11px] font-black text-[#0b1f3a] shadow-lg ring-2 ring-white -bottom-3 -right-2" aria-hidden>3</span></> : null}
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/45">Featured · {surface}</p>
          <div className="mt-2 flex items-center gap-2">
            {logo ? (
              <img src={logo} alt="" className="size-10 shrink-0 rounded-lg object-contain ring-1 ring-foreground/10" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-black text-white" style={{ background: NAVY }}>{initials || "YB"}</span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-[#0b1f3a]" data-testid="hub-mock-brand">{name}</p>
              <p className="truncate text-[11px] text-foreground/60">{category}</p>
            </div>
          </div>
          <span className="mt-2 inline-flex h-7 w-full items-center justify-center rounded-full bg-lime-300 text-[11px] font-bold text-[#0b1f3a]">Shop the offer</span>
        </div>
        {badge ? null : <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0b1f3a]">Mock · live hub</span>}
        {pins ? <span className="absolute grid size-6 place-items-center rounded-full bg-lime-300 text-[11px] font-black text-[#0b1f3a] shadow-lg ring-2 ring-white left-3 top-12" aria-hidden>2</span> : null}
      </div>
    </figure>
  );
}

function LaneShell({ id, children }: { id: string; children: ReactNode }) {
  return <div id={id} className="scroll-mt-20 rounded-3xl border border-foreground/10 bg-white p-4 shadow-[0_8px_30px_rgba(11,31,58,.08)] md:p-6" data-testid={id}>{children}</div>;
}

function CardLane({ initialSku }: { initialSku: CardSku }) {
  const mock = twoLaneMock();
  const [sku, setSku] = useState<CardSku>(initialSku);
  const [brand, setBrand] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>("");
  const [hub, setHub] = useState<"drho" | "sole">("drho");
  const [logo, setLogo] = useState<string | null>(null);
  const [agency, setAgency] = useState(false);
  const [built, setBuilt] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => setSku(initialSku), [initialSku]);
  useEffect(() => () => { if (logo) URL.revokeObjectURL(logo); }, [logo]);
  const catLabel = TWO_LANE_CATEGORIES.find((c) => c.slug === category)?.label ?? "Your category";
  const ready = brand.trim().length > 0 && EMAIL_RE.test(email.trim()) && Boolean(category);
  const step = built ? 2 : ready ? 1 : 0;
  const go = () => {
    if (!ready) { setError("Add your brand, work email and category."); return; }
    setError("");
    const href = quickReserveHref(sku, category);
    try { sessionStorage.setItem(QUICK_RESERVE_STORAGE_KEY, JSON.stringify({ brand: brand.trim().slice(0, 160), email: email.trim().slice(0, 320) })); } catch { /* storage blocked: the checkout page asks again */ }
    trackIntake("advertiser", "cta_click", sku === "hold-190" ? "look_190" : "reserve_490");
    trackCta(sku === "hold-190" ? "cta_hold_190" : "cta_reserve_490", { offer: sku });
    setBuilt(href);
    if (!mock) window.location.assign(href);
  };
  return (
    <LaneShell id="lane-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-2xl text-[#0b1f3a] md:text-3xl">Reserve space by card</h3>
        <Steps step={step} labels={["Details", "Preview", "Checkout"]} />
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1.05fr]">
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pick your start">
            {(Object.values(CARD_OFFERS)).map((o) => (
              <button key={o.sku} type="button" role="radio" aria-checked={sku === o.sku} onClick={() => setSku(o.sku)} data-testid={`lane-sku-${o.sku}`} className={`rounded-2xl p-3 text-left transition ${sku === o.sku ? "bg-[#0b1f3a] text-white ring-2 ring-lime-300" : "bg-foreground/[0.03] ring-1 ring-foreground/15 hover:ring-foreground/40"}`}>
                <span className={`block text-[10px] font-bold uppercase tracking-[0.18em] ${sku === o.sku ? "text-lime-300" : "text-foreground/50"}`}>{o.name}</span>
                <span className="mt-1 block whitespace-nowrap font-display text-[26px] leading-none sm:text-3xl">{o.label}</span>
                <span className={`mt-1 block text-[12px] ${sku === o.sku ? "text-white/75" : "text-foreground/60"}`}>{o.line}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            <label className="block"><span className={label}>Brand</span><input data-testid="lane-brand" className={`mt-0.5 ${input}`} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={160} autoComplete="organization" placeholder="e.g. Northfield Labs" /></label>
            <label className="block"><span className={label}>Work email</span><input data-testid="lane-email" className={`mt-0.5 ${input}`} value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@brand.com" /></label>
            <label className="block"><span className={label}>Category</span>
              <select data-testid="lane-category" className={`mt-0.5 ${input}`} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Pick one</option>
                {TWO_LANE_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-[12px] font-semibold text-foreground/60">Placements are curated hub by hub.</p>
          <button type="button" onClick={go} data-testid="lane-card-go" className="mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-base font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30 transition hover:bg-[#0b1f3a] hover:text-white">
            <Lock className="size-4" aria-hidden /> Continue to secure checkout · {CARD_OFFERS[sku].label} <ArrowRight className="size-5" aria-hidden />
          </button>
          {error ? <p className="mt-2 text-sm font-semibold text-red-700" role="alert" data-testid="lane-card-error">{error}</p> : null}
          {built && mock ? (
            <p className="mt-2 break-all rounded-xl bg-violet-50 p-3 text-[12px] text-violet-900" data-testid="lane-card-built">Preview · mock: checkout link ready, not opened. <a className="font-semibold underline" href={built}>{built}</a></p>
          ) : null}
          <div className="mt-3"><Chips items={TERM_CHIPS} /></div>
          <Details testId="lane-card-terms" label="Refund terms">
            <p>{LIVE_TERMS.look}</p>
            <p>{LIVE_TERMS.reserve}</p>
            <p>{LIVE_TERMS.io} Card checkout is Stripe-hosted. <a className="underline" href="/terms">Terms of sale</a> · <a className="underline" href="/sample-io">Sample IO</a></p>
          </Details>
          <div className="mt-3 rounded-2xl bg-foreground/[0.03] p-3 ring-1 ring-foreground/10">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#0b1f3a]">
              <input type="checkbox" checked={agency} onChange={(e) => setAgency(e.target.checked)} className="size-4 accent-[#0b1f3a]" data-testid="lane-agency-toggle" /> Placing for a client?
            </label>
            {agency ? <AgencyTest brand={brand} email={email} /> : <p className="mt-1 text-[12px] text-foreground/60">Agencies earn {AGENCY_TEST.cashPct}% of media spend, paid in cash.</p>}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/55">Your card, on a live hub</span>
            <div className="flex rounded-full bg-foreground/[0.05] p-0.5" role="radiogroup" aria-label="Live hub">
              {(["drho", "sole"] as const).map((h) => (
                <button key={h} type="button" role="radio" aria-checked={hub === h} onClick={() => setHub(h)} data-testid={`lane-hub-${h}`} className={`rounded-full px-3 py-1 text-[11px] font-bold ${hub === h ? "bg-[#0b1f3a] text-white" : "text-foreground/60"}`}>{h === "drho" ? "DR-HO'S" : "SOLE"}</button>
              ))}
            </div>
          </div>
          <HubMock brand={brand} logo={logo} hub={hub} category={catLabel} />
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-foreground/70 underline-offset-2 hover:underline">
            <ImagePlus className="size-4" aria-hidden /> Add your logo (stays in your browser)
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" data-testid="lane-logo" onChange={(e) => { const f = e.target.files?.[0]; if (f && f.size < 5_000_000) setLogo(URL.createObjectURL(f)); }} />
          </label>
          <Details testId="lane-card-how" label="What happens next">
            <p>1. Pay by card on the secure checkout. All of it is media credit.</p>
            <p>2. We send your insertion order (IO). It names the hub and placement.</p>
            <p>3. You approve the IO. Then it runs. Reporting is aggregate: views, clicks, UTM visits and promo codes (modelled until live).</p>
          </Details>
        </div>
      </div>
    </LaneShell>
  );
}

function AgencyTest({ brand, email: emailIn }: { brand: string; email: string }) {
  const mock = twoLaneMock();
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState(emailIn);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  useEffect(() => { if (!email) setEmail(emailIn); }, [emailIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = async () => {
    if (!EMAIL_RE.test(email.trim())) { setState("error"); return; }
    setState("busy");
    trackIntake("advertiser", "cta_click", "agency_test");
    if (mock) { setState("sent"); return; }
    try {
      const r = await fetch("/v1/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(agencyTestLeadPayload({ email, agency, client: brand })) });
      setState(r.ok ? "sent" : "error");
    } catch { setState("error"); }
  };
  if (state === "sent") return <p className="mt-2 text-sm font-semibold text-[#0b1f3a]" data-testid="lane-agency-sent"><Check className="mr-1 inline size-4 text-lime-600" />Request in. We reply with a client IO. No card was charged.{mock ? " (Preview · mock: nothing sent.)" : ""}</p>;
  return (
    <div className="mt-2" data-testid="lane-agency-test">
      <p className="text-sm text-foreground/75"><b className="text-[#0b1f3a]">Client test $1K–$5K USD.</b> One IO per client. {AGENCY_TEST.cashPct}% of media spend paid to the agency in cash. UTM + promo-code reporting.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input aria-label="Agency" placeholder="Agency" autoComplete="organization" className={input} value={agency} onChange={(e) => setAgency(e.target.value)} data-testid="lane-agency-name" />
        <input aria-label="Your email" placeholder="you@agency.com" type="email" inputMode="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} data-testid="lane-agency-email" />
      </div>
      <button type="button" onClick={send} disabled={state === "busy"} className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white" data-testid="lane-agency-send">{state === "busy" ? <Loader2 className="size-4 animate-spin" /> : null}Request a client test</button>
      {state === "error" ? <p className="mt-1 text-[12px] font-semibold text-red-700" role="alert">Add a work email, or email sales@silverbirchgrowth.com.</p> : null}
    </div>
  );
}

function BlockLane() {
  const mock = twoLaneMock();
  const [band, setBand] = useState<BlockBand>("category_lock");
  const [flightStart, setStart] = useState("");
  const [flightEnd, setEnd] = useState("");
  const [client, setClient] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const ready = client.trim().length > 0 && EMAIL_RE.test(email.trim()) && validFlight(flightStart, flightEnd);
  const step = state === "done" ? 2 : ready ? 1 : 0;
  const req = () => ({ band, flightStart, flightEnd, client, agency, email, name });
  const submit = async () => {
    if (!ready) { setError(validFlight(flightStart, flightEnd) || !flightStart ? "Add the client, your work email and flight dates." : "The flight end date is before the start."); return; }
    setError("");
    setState("busy");
    const r = draftRef(client);
    trackIntake("advertiser", "submit", "big_block");
    if (!mock) {
      try {
        const res = await fetch("/v1/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(blockLeadPayload(req(), r)) });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setState("idle");
        setError("We could not send that. Call (647) 931-6278 or email sales@silverbirchgrowth.com.");
        return;
      }
    }
    setRef(r);
    setState("done");
  };
  const download = async () => {
    setPdfBusy(true);
    trackIntake("advertiser", "kit_download", "io_pdf");
    try { saveBlob(await kitPdfBlob([ioDraftSvg(req(), ref, { mock })], "Birch Reserve draft IO"), `birch-reserve-draft-io-${ref.toLowerCase()}.pdf`); } finally { setPdfBusy(false); }
  };
  return (
    <LaneShell id="lane-block">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-2xl text-[#0b1f3a] md:text-3xl">Big block or agency buy</h3>
        <Steps step={step} labels={["Budget", "Flight", "Draft IO"]} />
      </div>
      {state === "done" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-center" data-testid="lane-block-done">
          <div>
            <p className="text-lg font-bold text-[#0b1f3a]"><Check className="mr-1 inline size-5 text-lime-600" />Request in. Your draft IO is ready.</p>
            <p className="mt-1 text-sm text-foreground/70">Ref {ref} · {BLOCK_BANDS.find((b) => b.key === band)!.label} · sales replies within 1 business day.{mock ? " Preview · mock: nothing sent." : ""}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={download} disabled={pdfBusy} data-testid="lane-block-pdf" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30">{pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Download draft IO (PDF)</button>
              <button type="button" onClick={() => openRandyChat({ reason: "book-a-call" })} className="inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-bold text-[#0b1f3a] ring-1 ring-[#0b1f3a]/30" data-testid="lane-block-call">Book a call</button>
            </div>
          </div>
          <div className="rounded-2xl p-4 text-white" style={{ background: NAVY }}>
            <Landmark className="size-5 text-lime-300" aria-hidden />
            <p className="mt-2 text-sm font-bold">{PAYMENT_METHODS_LINE}</p>
            <p className="text-[12px] text-white/70">{REMIT_LINE}</p>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Budget">
              {BLOCK_BANDS.map((b) => (
                <button key={b.key} type="button" role="radio" aria-checked={band === b.key} onClick={() => setBand(b.key)} data-testid={`lane-band-${b.key}`} className={`min-w-0 rounded-2xl p-3 text-left transition ${band === b.key ? "bg-[#0b1f3a] text-white ring-2 ring-lime-300" : "bg-foreground/[0.03] ring-1 ring-foreground/15 hover:ring-foreground/40"}`}>
                  <span className="block font-display text-xl leading-none sm:text-3xl">{b.label}</span>
                  <span className={`mt-1 block text-[11px] leading-tight ${band === b.key ? "text-white/75" : "text-foreground/60"}`}>{b.sub}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block min-w-0"><span className={label}>Flight start</span><input type="date" data-testid="lane-flight-start" className={`mt-0.5 ${input}`} value={flightStart} onChange={(e) => setStart(e.target.value)} /></label>
              <label className="block min-w-0"><span className={label}>Flight end</span><input type="date" data-testid="lane-flight-end" className={`mt-0.5 ${input}`} value={flightEnd} min={flightStart || undefined} onChange={(e) => setEnd(e.target.value)} /></label>
              <label className="block min-w-0"><span className={label}>Client (brand)</span><input data-testid="lane-client" className={`mt-0.5 ${input}`} value={client} onChange={(e) => setClient(e.target.value)} maxLength={120} placeholder="Brand" /></label>
              <label className="block min-w-0"><span className={label}>Agency (optional)</span><input data-testid="lane-agency" className={`mt-0.5 ${input}`} value={agency} onChange={(e) => setAgency(e.target.value)} maxLength={120} placeholder="Agency" /></label>
              <label className="block min-w-0"><span className={label}>Work email</span><input data-testid="lane-block-email" type="email" inputMode="email" autoComplete="email" className={`mt-0.5 ${input}`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" /></label>
              <label className="block min-w-0"><span className={label}>Name (optional)</span><input data-testid="lane-block-name" autoComplete="name" className={`mt-0.5 ${input}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>
            </div>
            <button type="button" onClick={submit} disabled={state === "busy"} data-testid="lane-block-go" className="mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-6 text-base font-bold text-white shadow-lg transition hover:bg-lime-300 hover:text-[#0b1f3a]">
              {state === "busy" ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />} Get my draft IO
            </button>
            {error ? <p className="mt-2 text-sm font-semibold text-red-700" role="alert" data-testid="lane-block-error">{error}</p> : null}
          </div>
          <div className="min-w-0 rounded-2xl p-5 text-white" style={{ background: NAVY }} data-testid="lane-block-summary">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">Pay by cheque, wire or EFT</p>
            <p className="mt-2 font-display text-4xl leading-none">{BLOCK_BANDS.find((b) => b.key === band)!.label}</p>
            <p className="text-sm text-white/75">{BLOCK_BANDS.find((b) => b.key === band)!.sub} · USD</p>
            {agency.trim() ? <p className="mt-3 text-sm"><b className="text-lime-300">{AGENCY_TEST.cashPct}% agency cash</b> · est. {agencyCashLabel(band)}</p> : <p className="mt-3 text-sm text-white/75">Agencies earn {AGENCY_TEST.cashPct}% of media spend, paid in cash.</p>}
            <div className="mt-3"><Chips dark items={["Draft IO PDF now", "Nothing runs until the IO names the hub", "Aggregate reporting"]} /></div>
            <Details dark testId="lane-block-terms" label="Details">
              <p>{PAYMENT_METHODS_LINE} {REMIT_LINE} The IO sets the hubs, placements, flight and invoice terms.</p>
              <p>The $25K–$50K Category Lock is the premium slot: one brand per category for its term, set on an insertion order.</p>
              <p>{LIVE_TERMS.io} Views are modelled estimates. <a className="underline" href="/sample-io">Sample IO</a> · <a className="underline" href="/media-kit">Media kit</a></p>
            </Details>
          </div>
        </div>
      )}
    </LaneShell>
  );
}

/** Two equal entry buttons + the lane panel. Sits above the existing kit form on /intake. */
export function TwoLane() {
  const [lane, setLane] = useState<Lane | null>(() => {
    if (typeof window === "undefined") return null;
    return window.location.hash === "#reserve-card" ? "card" : window.location.hash === "#big-block" ? "block" : null;
  });
  const [sku, setSku] = useState<CardSku>("hold-190");
  const panel = useRef<HTMLDivElement>(null);
  const open = (l: Lane, s?: CardSku) => {
    setLane(l);
    if (s) setSku(s);
    trackIntake("advertiser", "cta_click", l === "card" ? "lane_card" : "lane_block");
    setTimeout(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent<OpenLaneDetail>).detail; if (d?.lane) open(d.lane, d.sku); };
    window.addEventListener(OPEN_LANE_EVENT, on);
    return () => window.removeEventListener(OPEN_LANE_EVENT, on);
  }, []);
  const btn = (on: boolean) => `group flex min-h-[88px] w-full min-w-0 items-center gap-3 rounded-2xl p-4 text-left transition ${on ? "bg-[#0b1f3a] text-white ring-2 ring-lime-300" : "bg-white text-[#0b1f3a] ring-1 ring-foreground/15 shadow-sm hover:ring-[#0b1f3a]"}`;
  return (
    <div id="two-lane" className="scroll-mt-20" data-testid="two-lane">
      <div className="grid gap-2 sm:grid-cols-2" data-testid="two-lane-entry">
        <button type="button" onClick={() => open("card")} aria-expanded={lane === "card"} className={btn(lane === "card")} data-testid="lane-entry-card">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${lane === "card" ? "bg-lime-300 text-[#0b1f3a]" : "bg-lime-100"}`}><CreditCard className="size-5" /></span>
          <span className="min-w-0"><span className="block text-base font-extrabold">Reserve space (card)</span><span className={`block text-[12px] ${lane === "card" ? "text-white/70" : "text-foreground/60"}`}>From $190 USD · refundable credit</span></span>
          <ArrowRight className="ml-auto size-5 shrink-0 transition group-hover:translate-x-0.5" />
        </button>
        <button type="button" onClick={() => open("block")} aria-expanded={lane === "block"} className={btn(lane === "block")} data-testid="lane-entry-block">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${lane === "block" ? "bg-lime-300 text-[#0b1f3a]" : "bg-lime-100"}`}><Landmark className="size-5" /></span>
          <span className="min-w-0"><span className="block text-base font-extrabold">Big block / agency (IO + cheque)</span><span className={`block text-[12px] ${lane === "block" ? "text-white/70" : "text-foreground/60"}`}>$10K to $100K+ · draft IO now</span></span>
          <ArrowRight className="ml-auto size-5 shrink-0 transition group-hover:translate-x-0.5" />
        </button>
      </div>
      <div ref={panel} className="scroll-mt-20">
        {lane === "card" ? <div className="mt-3"><CardLane initialSku={sku} /></div> : null}
        {lane === "block" ? <div className="mt-3"><BlockLane /></div> : null}
      </div>
    </div>
  );
}

/** Compact lane buttons for the kit report on /intake ("from the report"). Renders only when the lanes are on the page. */
export function LaneCtas({ testId = "report-lane-ctas" }: { testId?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(Boolean(document.getElementById("two-lane"))), []);
  if (!on) return null;
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row" data-testid={testId}>
      <button type="button" onClick={() => openLane({ lane: "card", sku: "hold-190" })} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-lime-300 px-6 text-sm font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30" data-testid={`${testId}-card`}><CreditCard className="size-4" aria-hidden />Reserve space (card) · from $190 USD</button>
      <button type="button" onClick={() => openLane({ lane: "block" })} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-[#0b1f3a] ring-1 ring-[#0b1f3a]/30" data-testid={`${testId}-block`}><Landmark className="size-4" aria-hidden />Big block / agency (IO + cheque)</button>
    </div>
  );
}
