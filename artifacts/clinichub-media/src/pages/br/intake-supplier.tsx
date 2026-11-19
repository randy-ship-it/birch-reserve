import { useMemo, useRef, useState } from "react";
import { Eye, Radar, ShieldCheck, Send } from "lucide-react";
import { usePageMeta } from "@/components/br/ui";
import { ChannelTiles, EstimateTag, InfoPop, MockBanner, RoleTabs, SaveChip, Segmented, Toggle, basePayload, useAutosave } from "@/components/br/intake-kit";
import { FIRST_LOOK, INTEREST_FINE, MAX_DISTRIBUTION, SUPPLIER_CATEGORIES, type TriState } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { fridayIntake, reportPath } from "@/lib/fridayBrandIntake";

const fmtM = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}MM` : `${Math.round(n / 1000)}K`);
const TONE: Record<TriState, string> = { off: "bg-foreground/80 text-background", on: "bg-lime-300 text-[#0b1f3a]", maybe: "bg-amber-200 text-amber-950" };

export default function BrIntakeSupplier() {
  usePageMeta("Supplier interest | Birch Reserve", "Pick your categories, ask for a first look and choose max distribution. Interest only, subject to approval.");
  const [maxDist, setMaxDist] = useState(true);
  const [state, setState] = useState<Record<string, TriState>>(() => Object.fromEntries(SUPPLIER_CATEGORIES.map((c) => [c.key, c.rank <= 3 ? "on" : "maybe"])));
  const [fl, setFl] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState<"idle" | "busy" | "pending_review" | "error">("idle");
  const [reportToken, setReportToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [err, setErr] = useState("");
  const t0 = useRef(Date.now());
  const top = Math.max(...SUPPLIER_CATEGORIES.map((c) => c.ordersYr));
  const payload = useMemo(
    () => ({ ...basePayload("supplier"), supplier: { max_distribution: maxDist, categories: SUPPLIER_CATEGORIES.map((c) => ({ key: c.key, state: state[c.key]!, first_look: c.firstLook && state[c.key] !== "off" && !!fl[c.key] })) } }),
    [maxDist, state, fl],
  );
  const { ref, state: save } = useAutosave("supplier", payload, touched);
  const onCount = Object.values(state).filter((s) => s === "on").length;
  const flCount = payload.supplier.categories.filter((c) => c.first_look).length;

  async function submit() {
    setSent("busy");
    setErr("");
    try {
      const api = fridayIntake();
      const r = ref ?? (await api.create(payload));
      const res = await api.submit(r, payload, { email: email.trim(), website: website.trim(), elapsed_ms: Date.now() - t0.current });
      setReportToken(r.reportToken);
      setSent(res.status === "submitted" || Object.values(res.approvals ?? {}).includes("pending_review") ? "pending_review" : "error");
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setErr(code === "email" ? "Add a valid work email." : code === "website" ? "Add your website." : code === "too_fast" ? "One moment, then try again." : "The Friday intake is not open yet. Nothing was sent.");
      setSent("error");
    }
  }

  return (
    <div className="bg-[radial-gradient(ellipse_at_top_right,_#e0f2fe_0%,_transparent_55%)]">
      <MockBanner />
      <RoleTabs active="supplier" />
      <header className="container mx-auto px-4 pb-4 pt-8 md:pt-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">For performance brands · Supplier</p>
        <h1 className="font-display text-4xl leading-[1.02] md:text-6xl">Where your offers should run</h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">Turn categories on, off or maybe. Ask for a first look where it is offered. Nothing here is binding.</p>
      </header>

      <section className="container mx-auto grid gap-5 px-4 pb-6 lg:grid-cols-3">
        <div data-testid="max-distribution" className="relative overflow-hidden rounded-3xl bg-[#0b1f3a] p-6 text-white shadow-xl lg:col-span-2">
          <div className="pointer-events-none absolute -bottom-20 -right-10 size-72 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="flex items-center gap-3">
            <Radar className="size-6 text-lime-200" aria-hidden />
            <h2 className="text-lg font-bold">{MAX_DISTRIBUTION.label}</h2>
            <span className="ml-auto"><Toggle on={maxDist} onChange={(v) => { setTouched(true); setMaxDist(v); }} label="Max distribution" testId="toggle-max-distribution" /></span>
          </div>
          <p className="mt-2 text-sm text-white/80">{MAX_DISTRIBUTION.line}</p>
          <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/85" data-testid="tam-note">{MAX_DISTRIBUTION.note}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div><p className="font-display text-4xl text-lime-200">{onCount}</p><p className="text-[11px] text-white/70">categories on</p></div>
            <div><p className="font-display text-4xl text-amber-200">{Object.values(state).filter((s) => s === "maybe").length}</p><p className="text-[11px] text-white/70">maybe</p></div>
            <div><p className="font-display text-4xl text-sky-200">{flCount}</p><p className="text-[11px] text-white/70">first looks asked</p></div>
          </div>
        </div>
        <div className="rounded-3xl border border-foreground/10 bg-white p-6" data-testid="first-look-card">
          <div className="flex items-center gap-2"><Eye className="size-5" aria-hidden /><h2 className="font-bold">{FIRST_LOOK.title}</h2><EstimateTag /></div>
          <p className="mt-1 text-sm">{FIRST_LOOK.line}</p>
          <p className="mt-3 font-display text-2xl">from ${FIRST_LOOK.cpmUsd} CPM · ${FIRST_LOOK.cpcUsd.toFixed(2)} CPC</p>
          <p className="text-[11px] text-muted-foreground">Limited, published starter rates · USD</p>
          <div className="mt-3"><InfoPop title="First look" testId="first-look-pop"><p>{FIRST_LOOK.fine}</p></InfoPop></div>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl md:text-3xl">Your predicted strongest categories</h2>
          <EstimateTag>Modelled</EstimateTag>
          <InfoPop title="How we rank" testId="rank-pop"><p>Ranked by modelled annual orders in each category (TAM feed snapshot, Nov 13 2026, shown on /audiences). First look is offered on the top {3} categories. Modelled, not measured.</p></InfoPop>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {SUPPLIER_CATEGORIES.map((c) => {
            const s = state[c.key]!;
            return (
              <li key={c.key} data-testid={`cat-${c.key}`} className={`rounded-2xl border bg-white p-4 transition ${s === "on" ? "border-foreground/80 shadow-md" : s === "maybe" ? "border-amber-300" : "border-foreground/10 opacity-70"}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] text-xs font-bold">#{c.rank}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{c.label}</h3>
                    <p className="truncate text-xs text-muted-foreground">{c.intents}</p>
                  </div>
                  <div className="w-full sm:w-auto"><Segmented<TriState> value={s} onChange={(v) => { setTouched(true); setState({ ...state, [c.key]: v }); }} testId={`tri-${c.key}`} options={[{ v: "off", l: "Off", tone: TONE.off }, { v: "on", l: "On", tone: TONE.on }, { v: "maybe", l: "Maybe", tone: TONE.maybe }]} /></div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/[0.06]" aria-hidden>
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-lime-300" style={{ width: `${Math.max(4, (c.ordersYr / top) * 100)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{fmtM(c.ordersYr)} orders/yr · {c.age} · {c.skew} <EstimateTag>Modelled</EstimateTag></span>
                  {c.firstLook ? (
                    <label className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${fl[c.key] && s !== "off" ? "bg-sky-100 text-sky-900 ring-1 ring-sky-300" : "bg-foreground/[0.05]"}`}>
                      <input type="checkbox" data-testid={`fl-${c.key}`} disabled={s === "off"} checked={!!fl[c.key] && s !== "off"} onChange={(e) => { setTouched(true); setFl({ ...fl, [c.key]: e.target.checked }); }} className="accent-[#0b1f3a]" />
                      First look
                    </label>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">First look not offered</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container mx-auto px-4 pb-10">
        <div className="flex flex-col gap-3 rounded-3xl border-2 border-dashed border-foreground/20 bg-white/70 p-5 md:flex-row md:items-center">
          <ShieldCheck className="size-6 shrink-0" aria-hidden />
          <p className="flex-1 text-sm" data-testid="interest-fine">{INTEREST_FINE}</p>
          <div className="grid gap-2 sm:grid-cols-2 md:w-96">
            <input data-testid="supplier-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbrand.com" aria-label="Website" className="h-11 rounded-full border border-foreground/20 bg-white px-4 text-sm" />
            <input data-testid="supplier-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" aria-label="Work email" className="h-11 rounded-full border border-foreground/20 bg-white px-4 text-sm" />
            <input tabIndex={-1} aria-hidden name="company_url" className="hidden" defaultValue="" />
          </div>
          <SaveChip state={save} version={ref?.version} />
          <button type="button" data-testid="supplier-submit" onClick={submit} disabled={sent === "busy" || sent === "pending_review"} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-bold text-background disabled:opacity-80">
            <Send className="size-4" aria-hidden /> {sent === "pending_review" ? "Sent · pending approval" : sent === "busy" ? "Sending…" : "Send my interest"}
          </button>
        </div>
        {sent === "pending_review" ? <p data-testid="pending-review" className="mt-3 rounded-xl bg-lime-100 p-3 text-sm">Received as <strong>pending approval</strong>. A person at Birch Reserve reviews every request; nothing is accepted automatically and nothing is booked or charged.{reportToken ? <> <a className="font-semibold underline" href={reportPath(reportToken)}>View your report</a></> : null}</p> : null}
        {sent === "error" ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">{err || "Nothing was sent."}</p> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">Your email and website are used only to review your request. They are never shown on any page.</p>
      </section>
      <ChannelTiles />
    </div>
  );
}
