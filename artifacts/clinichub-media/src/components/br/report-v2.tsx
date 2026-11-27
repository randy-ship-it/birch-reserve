/**
 * brand-report.v1 rendered with Friday's report design system v2 (report-design-system.md, Friday PR #214):
 * hero + fit-score ring, channel tiles with fit meters, ranked hub cards, two labelled sides (advertising cost vs
 * publisher earnings; the intake's first role decides the order), range bars and one Estimate pop-out per side.
 * Used by /kit/r/:token (Friday data) and the /intake sample (labelled sample). Birch's site chrome stays Birch's.
 *
 * Never rendered: Friday's internal "excluded: competes" data (stripped server-side too), match results, private
 * partners. Hub names are checked against Birch's never-mention list (Kalaya is allowed; known anchors show by name).
 */
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { RT, RT_SERIF, RT_SANS, RT_SHADOW, fitLabelOf, monogramBg } from "@/lib/reportTokens";
import type { FridayReport } from "@/lib/fridayBrandIntake";
import { fridayEligibility } from "@/lib/fridayBrandIntake";
import { CHANNEL_TILES, PUBLISHER_SURFACES, RETAIL_COPY, RETAIL_TAG, STREET_REACH_SENTENCE, anchorName } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { NEVER_HUB_NAME } from "../../../../api-server/src/lib/overhaul/hubNameFilter";
import { visibleHubs } from "../../../../api-server/src/lib/overhaul/hubMatch";
import { CHANNEL_GEO } from "../../../../api-server/src/lib/kitCalc/channelGeo";
import { mockExposure, readExposure, type FridayExposure } from "../../../../api-server/src/lib/kitCalc/activation";
import { HubView, SupplierExposureView } from "@/components/br/report-views";
import { Details } from "@/components/br/details";
import { MODELLED_PLAN_LABEL, PlanChip } from "@/components/br/modelled";
import type { PhysicalAnswer } from "../../../../api-server/src/lib/overhaul/inLocation";
import { ClinicLayerTerm } from "@/components/br/clinic-layer-term";

const FKEY: Record<string, string> = { hubs: "scale-hubs", calm_joints: "calm-joints", street_team: "street-team", retail: "retail-network" };
type LoHi = { low: number; high: number };
const usd = (n: number, d = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const money = (r: LoHi, d?: number) => { const dd = d ?? (r.high < 10 ? 2 : 0); return `${usd(r.low, dd)}–${usd(r.high, dd)}`; };
const k = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}MM` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

/* ----------------------------------- model ----------------------------------- */
export type ReportModel = ReturnType<typeof buildModel>;
export function buildModel(r: FridayReport) {
  const name = r.brand?.name || r.brand?.domain || "Your brand";
  const domain = r.brand?.domain ?? "";
  const df = r.demand_fit?.channels ?? [];
  const elig = fridayEligibility(r);
  const tiles = CHANNEL_TILES.map((t) => {
    const fk = Object.keys(FKEY).find((x) => FKEY[x] === t.key)!;
    const fc = r.channels?.find((c) => (FKEY[c.key] ?? c.key) === t.key);
    const fit = df.find((c) => (FKEY[c.key] ?? c.key) === t.key);
    const g = CHANNEL_GEO.find((x) => x.key === t.key);
    const e = elig.find((x) => x.key === fk);
    const fig = t.key === "retail-network" ? t.stats.map((s) => ({ v: s.v, l: s.l })) : t.stats.map((s) => ({ v: s.v, l: s.l }));
    return {
      key: t.key, name: fc?.name ?? t.name, fig,
      line: t.key === "retail-network" ? `${RETAIL_COPY} · ${RETAIL_TAG}` : t.key === "street-team" ? STREET_REACH_SENTENCE : fc?.line ?? t.line,
      fit: fit?.fit ?? fc?.fit ?? null, fitLabel: fit?.fit_label ?? fc?.fit_label ?? null,
      geo: e?.label ?? fc?.geo_label ?? g?.label ?? "", eligible: e?.eligibility ?? "now",
      image: "image" in t ? t.image : null,
    };
  });
  const scored = df.filter((c) => typeof c.fit === "number").sort((a, b) => b.fit - a.fit).slice(0, 3);
  const score = scored.length ? Math.round(scored.reduce((s, c) => s + c.fit, 0) / scored.length) : null;
  const rawHubs = ((r as { hubs?: Array<{ key: string; name: string; status?: string; fit?: number; fit_label?: string; reason?: string | null; tier?: string; logo?: string }> }).hubs ?? r.demand_fit?.anchor_hubs ?? []) as Array<{ key: string; name: string; status?: string; fit?: number; fit_label?: string; reason?: string | null; tier?: string; logo?: string }>;
  // Hub matching rules (hubMatch.ts): conflicting hubs are flagged hidden, never shown; opposite kind first.
  const ruled = visibleHubs(rawHubs as Array<(typeof rawHubs)[number] & { hidden?: boolean }>, { domain, category: r.brand?.category ?? r.demand_opportunity?.category?.key ?? null });
  const hubs = ruled.map((h) => (h && h.name ? { ...h, name: anchorName(h.key, h.name) } : h)).filter((h) => h && h.name && !NEVER_HUB_NAME.test(h.name)).slice(0, 5);
  const placements = (r.placements ?? []).filter((p) => p.label);
  const cpm = r.headline?.best_fit_cpm_usd ?? avg(placements.map((p) => p.cpm_usd));
  const cpc = r.headline?.best_fit_cpc_usd ?? avg(placements.map((p) => p.cpc_usd));
  // Publisher side (view=publisher only): v1.1 publisher_monetization, else v1 surfaces (last ramp step), else mock surfaces.
  const rd = (r.role_data ?? {}) as Record<string, unknown>;
  const pm = rd.publisher_monetization as { monthly_usd?: LoHi | null; now?: { min: number; max: number } | null; later?: { min: number; max: number } | null } | undefined;
  const mm = (x: { min: number; max: number } | null | undefined): LoHi | null => (x && typeof x.min === "number" && typeof x.max === "number" ? { low: x.min, high: x.max } : null);
  const pub = rd.publisher as { surfaces?: Array<Record<string, unknown>>; config?: { base_share?: number } } | undefined;
  const label = (key: string) => PUBLISHER_SURFACES.find((s) => s.key === key)?.label ?? key.replace(/_/g, " ");
  const earnings = (pub?.surfaces ?? []).map((s) => {
    const ramp = Array.isArray(s.ramp) ? (s.ramp as Array<{ display_payout_usd?: number | LoHi }>) : [];
    const last = ramp[ramp.length - 1]?.display_payout_usd;
    const pay = (s.payout_usd as LoHi | undefined) ?? (typeof last === "number" ? { low: last, high: last } : (last as LoHi | undefined));
    const ok = !s.needs_rate && pay && typeof pay.low === "number" && pay.high > 0;
    return { surface: label(String(s.surface)), pay: ok ? pay! : null, needs: !ok };
  });
  const sum = earnings.filter((e) => e.pay).reduce((a, e) => ({ low: a.low + e.pay!.low, high: a.high + e.pay!.high }), { low: 0, high: 0 });
  // v1.2 §4: now = surfaces the hub turned on, later = every surface with views. monthly_usd (v1.1) equals now.
  const total = mm(pm?.now) ?? pm?.monthly_usd ?? (earnings.some((e) => e.pay) ? sum : null);
  const later = mm(pm?.later);
  const dop = r.demand_opportunity ?? null;
  return { name, domain, updated: r.updated, tiles, score, top3: scored.map((c) => ({ name: c.name, label: c.fit_label })), hubs, placements, cpm, cpc, share: pub?.config?.base_share ?? 0.35, earnings, total, later, dop, isPublisher: (r.roles ?? []).includes("publisher"), publisherFirst: (r.roles ?? [])[0] === "publisher", isSupplier: (r.roles ?? []).includes("supplier"), isAccelerate: (r.roles ?? []).some((x) => x === "brand" || x === "kit" || x === "advertiser" || x === "sponsor"), mock: !!r.mock, geo: r.geo ?? null, exposure: readExposure((r as { exposure?: unknown }).exposure) };
}
function avg(xs: Array<LoHi | null | undefined>): LoHi | null {
  const v = xs.filter((x): x is LoHi => !!x);
  return v.length ? { low: v.reduce((s, x) => s + x.low, 0) / v.length, high: v.reduce((s, x) => s + x.high, 0) / v.length } : null;
}

/* --------------------------------- primitives --------------------------------- */
const card = { background: RT.surface, border: `1px solid ${RT.line}`, borderRadius: 16, boxShadow: RT_SHADOW } as const;
const eyebrow = "text-[11px] font-bold uppercase tracking-[0.14em]";

export function FitMeter({ pct, label, dark = false }: { pct: number | null; label?: string | null; dark?: boolean }) {
  if (pct == null) return null;
  return (
    <div className="mt-2 flex items-center gap-2" data-testid="fit-meter">
      <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ background: dark ? "rgba(255,255,255,.18)" : RT.track }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, pct))}%`, background: dark ? RT.mint : RT.forest2 }} />
      </div>
      <span className="text-[11px] font-semibold" style={{ color: dark ? RT.mint : RT.mintInk }}>{label ?? fitLabelOf(pct)}</span>
    </div>
  );
}

export function EstimatePop({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid={testId ?? "estimate-pop"} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: RT.gold, background: RT.goldBg, border: `1px solid ${RT.goldLine}` }}>Estimate ⓘ</button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setOpen(false)} data-testid={`${testId ?? "estimate-pop"}-dialog`}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto p-6" style={{ ...card, borderRadius: 24, fontFamily: RT_SANS, color: RT.body }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-2xl" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{title}</h3>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-2" style={{ background: RT.paper }}><X className="size-4" /></button>
            </div>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function RangeBar({ label, range, unit, axisMax, note, d }: { label: string; range: LoHi | null; unit: string; axisMax: number; note?: string; d?: number }) {
  return (
    <div className="mt-4" data-testid="range-bar">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: RT.ink }}>{label}</span>
        <span className="whitespace-nowrap text-lg tabular-nums md:text-xl" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{range ? `${money(range, d)} ${unit}` : "— (needs rate)"}</span>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full" style={{ background: RT.track }}>
        {range ? <div className="absolute inset-y-0 rounded-full" style={{ left: `${(range.low / axisMax) * 100}%`, width: `${Math.max(2, ((range.high - range.low) / axisMax) * 100)}%`, background: RT.forest2 }} /> : null}
      </div>
      <div className="mt-1 flex justify-between text-[11px]" style={{ color: RT.mute }}><span>$0</span><span>{usd(axisMax, axisMax < 10 ? 2 : 0)}</span></div>
      {note ? <p className="mt-1 text-[12px]" style={{ color: RT.mute }}>{note}</p> : null}
    </div>
  );
}

function FitRing({ score }: { score: number }) {
  return (
    <div className="relative size-24 shrink-0 rounded-full" style={{ background: `conic-gradient(${RT.mint} ${score * 3.6}deg, rgba(255,255,255,.15) 0)` }} data-testid="fit-ring">
      <div className="absolute inset-[7px] flex items-center justify-center rounded-full" style={{ background: RT.forest }}>
        <span className="text-[38px] leading-none" style={{ fontFamily: RT_SERIF, color: "#fff" }}>{score}</span>
      </div>
    </div>
  );
}

/* --------------------------------- sections --------------------------------- */
export function ReportHero({ m, sample }: { m: ReportModel; sample?: boolean }) {
  const top = m.hubs[0]?.name;
  const more = Math.max(0, m.hubs.length - 1);
  return (
    <section data-testid="report-hero" className="overflow-hidden px-5 py-8 md:px-8 md:py-10" style={{ background: RT.forest, color: "#fff", borderRadius: 24, fontFamily: RT_SANS }}>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg text-lg" style={{ background: monogramBg(m.domain || m.name), fontFamily: RT_SERIF }}>{m.name.slice(0, 1).toUpperCase()}</span>
            <div className="text-sm"><p className="font-semibold">{m.name}</p><p className="text-white/60">{[m.domain, m.updated ? `Updated ${new Date(m.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""].filter(Boolean).join(" · ")}</p></div>
            {sample ? <span className="ml-auto inline-block shrink-0 whitespace-nowrap rounded-[3px] border border-current px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70" data-testid="report-sample-pill">Sample · example values</span> : null}
          </div>
          <p className={`${eyebrow} mt-6`} style={{ color: RT.mint }}>Where your customers convert best</p>
          <h2 className="mt-2 text-[34px] leading-[1.05] md:text-[52px]" style={{ fontFamily: RT_SERIF }}>
            {top ? <>{m.name}'s customers fit best with <em style={{ color: RT.mint }}>{top}</em>{more ? ` and ${more} more partner${more > 1 ? "s" : ""}.` : "."}</> : <>Where {m.name}'s customers fit best.</>}
          </h2>
          <Details dark testId="hero-details"><p>Ranked by fit with your customers. Every fit is an estimate, confirmed by a person.</p></Details>
        </div>
        {m.score != null ? (
          <div className="flex items-center gap-4 p-4" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 24 }} data-testid="fit-score">
            <FitRing score={m.score} />
            <div className="text-sm">
              <p className="font-semibold">Fit score · {fitLabelOf(m.score).replace(" fit", "")}</p>
              <ul className="mt-1 space-y-0.5">{m.top3.map((c) => <li key={c.name}><span className="font-semibold">{c.name}</span> <span className="text-white/60">· {c.label}</span></li>)}</ul>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ChannelTilesV2({ m, map }: { m: ReportModel; map?: string }) {
  return (
    <section data-testid="report-tiles" style={{ fontFamily: RT_SANS, color: RT.body }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[24px] md:text-[28px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Where you fit</h2>
        <PlanChip />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {m.tiles.map((t) => (
          <article key={t.key} data-testid={`v2-tile-${t.key}`} data-eligibility={t.eligible} className="overflow-hidden p-5" style={card}>
            {t.image ? <img src={map ?? t.image} alt="Street team route areas shown as an area-level heat map. No homes or addresses." className="mb-3 h-28 w-full object-cover" style={{ borderRadius: 10 }} loading="lazy" /> : null}
            <div className="flex flex-wrap items-center gap-2">
              <span className={eyebrow} style={{ color: RT.mintInk }}>{t.name}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: t.eligible === "now" ? RT.mint : RT.track, color: t.eligible === "now" ? RT.forest : RT.mute }}>{t.eligible === "now" ? "Live now" : t.eligible === "later" ? "Later" : "Not in your markets yet"}</span>
              <span className="text-[11px]" style={{ color: RT.mute }}>{t.geo}</span>
            </div>
            {t.fig.length ? (
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {t.fig.map((f) => <div key={f.l}><dd className="text-[34px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{f.v}</dd><dt className="mt-1 text-[12px]" style={{ color: RT.mute }}>{f.l}</dt></div>)}
              </dl>
              ) : null}
            {t.fig.length ? (
              <p className="mt-2 text-[11px] font-semibold" style={{ color: RT.mute }} data-testid={`v2-tile-${t.key}-plan`}>{MODELLED_PLAN_LABEL}</p>
            ) : <p className="mt-3 text-[20px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Counted with the Street Team: 1MM+ consumers now, 3MM+ est. in 2027</p>}
            <FitMeter pct={t.fit} label={t.fitLabel} />
            <Details label="About this channel" testId={`v2-tile-${t.key}-details`}><p>{t.line}</p></Details>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HubCards({ m }: { m: ReportModel }) {
  if (!m.hubs.length) return null;
  return (
    <section data-testid="report-hubs" style={{ fontFamily: RT_SANS, color: RT.body }}>
      <h2 className="text-[24px] md:text-[28px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Partners, ranked</h2>
      <Details testId="hubs-details"><p>Proposed clinic layers, subject to human confirmation.</p></Details>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {m.hubs.map((h, i) => (
          <article key={h.key ?? h.name} data-testid={`hub-card-${i + 1}`} className={`p-5 ${i === 0 ? "md:col-span-2" : ""}`} style={card}>
            <div className="flex items-start gap-3">
              {h.logo ? <img src={h.logo} alt="" className="size-10 rounded-lg object-contain" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg text-white" style={{ background: RT.forest, fontFamily: RT_SERIF }}>{h.name.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                <p className="text-[19px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{h.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {h.tier ? <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: RT.mint, color: RT.mintInk }}>{h.tier}</span> : null}
                  {h.status ? <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: RT.paper, color: RT.mute, border: `1px solid ${RT.line}` }}>{h.status}</span> : null}
                </div>
              </div>
              <span className="text-[13px] tabular-nums" style={{ color: RT.mute }}>{String(i + 1).padStart(2, "0")}</span>
            </div>
            {h.reason ? <p className="mt-3 text-[14px]">{h.reason}</p> : null}
            <FitMeter pct={typeof h.fit === "number" ? h.fit : null} label={h.fit_label} />
          </article>
        ))}
      </div>
      <SelfLaunchedHub />
    </section>
  );
}

/**
 * Hub a location switched on itself (Randy, Nov 27 2026: show a hub added organically, next to Integrity).
 * Source: Scale Activity doc (Dima-lates signed, page live at scalehealth.ca/dima-lates-ajax-review) and Jon's
 * Oct 27 Slack note that the owner activated it unprompted. One verified hub only, no counts.
 */
const SELF_LAUNCHED = { name: "Dima-lates", where: "Pilates studio · Ajax, ON", url: "https://www.scalehealth.ca/dima-lates-ajax-review", img: "/hub-gallery/dima-lates.webp" } as const;

export function SelfLaunchedHub() {
  const h = SELF_LAUNCHED;
  return (
    <a href={h.url} target="_blank" rel="noopener" data-testid="self-launched-hub" className="group mt-4 grid overflow-hidden md:grid-cols-[1.15fr_1fr]" style={{ ...card, borderRadius: 20, textDecoration: "none", color: "inherit" }}>
      <div className="relative aspect-[16/10] overflow-hidden md:aspect-auto md:min-h-[260px]" style={{ background: RT.paper }}>
        <img src={h.img} alt={`A class at ${h.name}`} className="absolute inset-0 size-full object-cover object-[50%_25%] transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "rgba(255,255,255,.92)", color: RT.ink }}>
          <span className="size-1.5 rounded-full" style={{ background: "#16a34a" }} aria-hidden />Live
        </span>
      </div>
      <div className="flex flex-col justify-center gap-2 p-5 md:p-7">
        <span className={`${eyebrow} inline-flex items-center gap-2`} style={{ color: RT.mintInk }}>
          <span className="size-1.5 rounded-full" style={{ background: RT.mintInk }} aria-hidden />Added by a member studio
        </span>
        <p className="text-[26px] leading-tight md:text-[30px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{h.name}</p>
        <p className="text-[14px]" style={{ color: RT.mute }}>{h.where}</p>
        <p className="text-[15px]">Switched on its own members' club.</p>
        <span className="mt-1 text-[14px] font-semibold underline-offset-4 group-hover:underline" style={{ color: RT.forest }}>Open the live clinic layer →</span>
      </div>
    </a>
  );
}

export function CostSide({ m, extra }: { m: ReportModel; extra?: ReactNode }) {
  const axis = (r: LoHi | null, fallback: number) => (r ? Math.ceil(r.high * 1.25 * (r.high < 10 ? 10 : 1)) / (r.high < 10 ? 10 : 1) : fallback);
  const views = m.cpm ? { low: (1000 / m.cpm.high) * 1000, high: (1000 / m.cpm.low) * 1000 } : null;
  const clicks = m.cpc ? { low: 1000 / m.cpc.high, high: 1000 / m.cpc.low } : null;
  return (
    <section data-report-half="advertiser-cost" data-testid="report-half-advertiser" className="p-5 md:p-6" style={{ ...card, borderRadius: 24, fontFamily: RT_SANS, color: RT.body }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={eyebrow} style={{ color: RT.mintInk }}>Accelerate · premium display</p>
          <h3 className="mt-1 text-[24px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>What it costs to reach customers</h3>
        </div>
        <EstimatePop title="Estimate: what it costs" testId="estimate-cost">
          <p style={{ color: RT.mute }}>Starter clinic layer rate ranges (illustrative) and modelled monthly views per surface. USD. Planning ranges, not quotes or measured delivery.</p>
          {m.placements.length ? (
            <table className="w-full text-left text-[14px]"><thead><tr className="text-[11px] uppercase tracking-wider" style={{ color: RT.mute }}><th className="py-2">Placement</th><th>CPM</th><th>CPC</th></tr></thead>
              <tbody>{m.placements.map((p) => <tr key={p.key} style={{ borderTop: `1px solid ${RT.line}` }}><td className="py-2 pr-2">{p.label}</td><td className="pr-2">{p.cpm_usd ? money(p.cpm_usd) : "— (needs rate)"}</td><td>{p.cpc_usd ? money(p.cpc_usd, 2) : "— (needs rate)"}</td></tr>)}</tbody></table>
          ) : null}
          <p>A $1,000 test buys about {views ? `${k(views.low)}–${k(views.high)}` : "—"} views on display, or {clicks ? `${Math.round(clicks.low)}–${Math.round(clicks.high)}` : "—"} clicks on CPC. Views = budget ÷ CPM × 1,000; clicks = budget ÷ CPC.</p>
          {m.dop && !m.dop.needs_input ? <p>Revenue opportunity from Scale demand = Scale demand orders a year in your category × a capture share of {pct(m.dop.capture_share?.min)}–{pct(m.dop.capture_share?.max)} (placeholder) × your average cart. Canada orders only.</p> : null}
          <p style={{ color: RT.mute }}>Network figures are reported figures and targets, not promises of any result.</p>
        </EstimatePop>
      </div>
      <RangeBar label="Cost per 1,000 views (CPM)" range={m.cpm} unit="CPM" axisMax={axis(m.cpm, 40)} note="Display on your best-fit placements." />
      <RangeBar label="Cost per click (CPC)" range={m.cpc} unit="CPC" axisMax={axis(m.cpc, 4)} d={2} note="Pay only when someone clicks through." />
      <div className="mt-4 grid grid-cols-2 gap-3" data-testid="exposure-stats">
        <div className="p-3" style={{ background: RT.paper, borderRadius: 10 }}><p className="text-[28px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{views ? `${k(views.low)}–${k(views.high)}` : "—"}</p><p className="mt-1 text-[12px]" style={{ color: RT.mute }}>views for a $1,000 display test</p></div>
        <div className="p-3" style={{ background: RT.paper, borderRadius: 10 }}><p className="text-[28px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{clicks ? `${Math.round(clicks.low)}–${Math.round(clicks.high)}` : "—"}</p><p className="mt-1 text-[12px]" style={{ color: RT.mute }}>clicks for a $1,000 CPC test</p></div>
      </div>
      <DemandOpportunityBox m={m} />
      {m.placements.length ? (
        <table className="mt-4 w-full text-left text-[13px]" data-testid="placement-table"><thead><tr className="text-[11px] uppercase tracking-wider" style={{ color: RT.mute }}><th className="py-2">Placement</th><th>CPM</th><th>CPC</th></tr></thead>
          <tbody>{m.placements.map((p) => <tr key={p.key} style={{ borderTop: `1px solid ${RT.line}` }}><td className="py-2 pr-2"><span className="font-semibold" style={{ color: RT.ink }}>{p.label}</span>{p.fit_label ? <FitMeter pct={p.fit || null} label={p.fit_label} /> : null}</td><td className="pr-2 tabular-nums">{p.cpm_usd ? money(p.cpm_usd) : "—"}</td><td className="tabular-nums">{p.cpc_usd ? money(p.cpc_usd, 2) : "—"}</td></tr>)}</tbody></table>
      ) : null}
      {extra}
    </section>
  );
}

const pct = (n?: number) => (typeof n === "number" ? `${Math.round(n * (n <= 1 ? 100 : 1))}%` : "—");
const MISSING: Record<string, string> = {
  category: "your category",
  avg_cart_usd: "your average cart",
  markets_include_canada: "Canada in your markets (Scale demand covers Canada orders)",
  no_scale_demand_in_category: "Scale demand in your category (none yet)",
  scale_demand_unavailable: "Scale demand data (not available yet)",
};
/** v1.2 §5 demand_opportunity: a range when Friday has one; otherwise what it still needs, gently. */
function DemandOpportunityBox({ m }: { m: ReportModel }) {
  const d = m.dop;
  if (!d) return null;
  const mo = d.monthly_usd;
  return (
    <div className="mt-4 p-4" style={{ background: RT.paper, borderRadius: 10 }} data-testid="demand-opportunity" data-needs-input={d.needs_input ? "true" : "false"}>
      <p className="text-sm font-semibold" style={{ color: RT.ink }}>Revenue opportunity from Scale demand{d.mock ? " (mock)" : ""}</p>
      {!d.needs_input && mo ? (
        <>
          <p className="mt-1 text-[28px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{money({ low: mo.min, high: mo.max }, 0)} <span className="text-sm">/ mo</span></p>
          <p className="mt-1 text-[12px]" style={{ color: RT.mute }}>{d.category?.label ? `${d.category.label} · ` : ""}{d.scale_demand_orders_yr ? `about ${k(d.scale_demand_orders_yr)} Scale demand orders a year · ` : ""}capture share is a placeholder.</p>
        </>
      ) : (
        <p className="mt-1 text-[13px]" style={{ color: RT.mute }}>We can estimate this once we have {(d.missing ?? []).map((x) => MISSING[x] ?? x.replace(/_/g, " ")).join(", ") || "a little more detail"}.</p>
      )}
    </div>
  );
}

export function EarningsSide({ m, cta }: { m: ReportModel; cta?: ReactNode }) {
  const axisMax = Math.max(100, ...m.earnings.filter((e) => e.pay).map((e) => e.pay!.high * 1.25));
  return (
    <section data-report-half="publisher-earnings" data-testid="report-half-publisher" className="p-5 md:p-6" style={{ ...card, borderRadius: 24, fontFamily: RT_SANS, color: RT.body }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={eyebrow} style={{ color: RT.mintInk }}>Clinic layer · max exposure</p>
          <h3 className="mt-1 text-[24px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>What you could earn</h3>
        </div>
        <EstimatePop title="Estimate: what you could earn" testId="estimate-earn">
          <p>Your share starts at {Math.round(m.share * 100)}% of media revenue (base). Tiers above base are placeholders until confirmed.</p>
          <p>Display earnings per surface at month 12 = monthly views × CPM ÷ 1,000 × your share. Surfaces without a rate card or monthly views show "needs rate".</p>
          <p style={{ color: RT.mute }}>Planning ranges in USD, not quotes or guaranteed payouts.</p>
        </EstimatePop>
      </div>
      {m.isPublisher && (m.total || m.earnings.length) ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3" style={{ background: RT.paper, borderRadius: 10 }}><p className="text-[28px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{Math.round(m.share * 100)}%</p><p className="mt-1 text-[12px]" style={{ color: RT.mute }}>your share of media revenue (base)</p></div>
            <div className="p-3" style={{ background: RT.paper, borderRadius: 10 }} data-testid="earnings-total"><p className="text-[28px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{m.total ? money(m.total) : "—"}</p><p className="mt-1 text-[12px]" style={{ color: RT.mute }}>a month at month 12, surfaces on now</p></div>
          </div>
          {m.later ? <div className="mt-3 p-3" style={{ background: RT.paper, borderRadius: 10 }} data-testid="earnings-later"><p className="text-[22px] leading-none" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{money(m.later)} <span className="text-sm">/ mo</span></p><p className="mt-1 text-[12px]" style={{ color: RT.mute }}>later, with every surface that has views turned on</p></div> : null}
          {m.earnings.map((e) => e.pay ? <RangeBar key={e.surface} label={e.surface} range={e.pay} unit="/ mo" axisMax={axisMax} d={0} /> : <p key={e.surface} className="mt-3 flex justify-between text-sm"><span className="font-semibold" style={{ color: RT.ink }}>{e.surface}</span><span style={{ color: RT.mute }}>— (needs rate / needs monthly views)</span></p>)}
        </>
      ) : (
        <p className="mt-4 text-[14px]" data-testid="earnings-empty">Add your clinic layer to unlock max exposure. Clinic layers keep a share of media revenue from their own shelf space, screens and pages, and your products get the most eyeballs. Supplier-only works too.</p>
      )}
      {cta ? <div className="mt-5">{cta}</div> : null}
    </section>
  );
}

/**
 * The report's views follow the roles (Randy, Nov 19 2026 9:39 AM ET): one form, both answers. Supplier exposure view
 * (performance-only terms vs with Accelerate) + hub max-exposure + earnings view. Legacy two-sided order kept otherwise.
 */
export function TwoSides({ m, costExtra, earnCta, supplierCta, exposure, exposureSource, onAccelerate, physical }: { m: ReportModel; costExtra?: ReactNode; earnCta?: ReactNode; supplierCta?: ReactNode; exposure?: FridayExposure; exposureSource?: "report" | "mock" | "sample"; onAccelerate?: ReactNode; physical?: PhysicalAnswer | null }) {
  const cost = <CostSide key="cost" m={m} extra={costExtra} />;
  const earn = <EarningsSide key="earn" m={m} cta={earnCta} />;
  if (m.isSupplier || m.isPublisher) {
    const mk = m.geo?.markets?.length ? { sells_in: m.geo.markets as Array<"CA" | "US">, ships_to: m.geo.markets as Array<"CA" | "US">, regions: Object.values(m.geo.regions ?? {}).flat() } : null;
    const ex = exposure ?? m.exposure ?? mockExposure(mk);
    const src = exposureSource ?? (exposure || !m.exposure ? "mock" : "report");
    const sides = [m.isSupplier ? "supplier" : null, m.isPublisher ? "hub" : null].filter(Boolean) as string[];
    return (
      <section data-testid="report-two-sides" data-first={sides[0]} data-sides={sides.join(",")} data-accelerate={m.isAccelerate ? "true" : "false"} style={{ fontFamily: RT_SANS }}>
        <h2 className="text-[26px] md:text-[34px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>{m.isSupplier && m.isPublisher ? <>Your exposure and your <ClinicLayerTerm testId="clinic-layer-term-report" /> earnings</> : m.isSupplier ? "Your supplier exposure" : <>Your <ClinicLayerTerm testId="clinic-layer-term-report" /> earnings</>}</h2>
        <p className="text-[13px]" style={{ color: RT.mute }} data-testid="two-sides-plan">Estimates, not guarantees. {MODELLED_PLAN_LABEL}.</p>
        <div className={`mt-4 grid items-stretch gap-4 ${sides.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {m.isSupplier ? <div key="sup" className="min-w-0"><SupplierExposureView m={m} exposure={ex} source={src} cta={supplierCta} onAccelerate={onAccelerate} physical={physical} /></div> : null}
          {m.isPublisher ? <HubView key="hub" m={m} exposure={ex} cta={earnCta} physical={physical} split={sides.length > 1} /> : null}
        </div>
      </section>
    );
  }
  return (
    <section data-testid="report-two-sides" data-first={m.publisherFirst ? "hub" : "accelerate"} style={{ fontFamily: RT_SANS }}>
      <h2 className="text-[24px] md:text-[28px]" style={{ fontFamily: RT_SERIF, color: RT.ink }}>Exposure + earnings, side by side</h2>
      <p className="text-[13px]" style={{ color: RT.mute }}>Accelerate is optional paid display; your clinic layer earns a share. Each side is labelled.</p>
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">{m.publisherFirst ? [earn, cost] : [cost, earn]}</div>
    </section>
  );
}

/** The full report body on the design system's paper background. */
export function ReportV2({ report, sample, map, costExtra, earnCta, supplierCta, compact, exposure, exposureSource, onAccelerate, physical, afterHero }: { afterHero?: ReactNode; report: FridayReport; sample?: boolean; map?: string; costExtra?: ReactNode; earnCta?: ReactNode; supplierCta?: ReactNode; compact?: boolean; exposure?: FridayExposure; exposureSource?: "report" | "mock" | "sample"; onAccelerate?: ReactNode; physical?: PhysicalAnswer | null }) {
  const m = buildModel(report);
  return (
    <div data-testid={sample ? "report-v2-sample" : "report-v2"} className="space-y-8 p-3 md:p-6" style={{ background: RT.paper, borderRadius: 24 }}>
      <ReportHero m={m} sample={sample} />
      {afterHero}
      {compact ? <Details label="Where it fits: network reach" testId="report-reach-details" className="!mt-0 text-[13px]"><ChannelTilesV2 m={m} map={map} /></Details> : <ChannelTilesV2 m={m} map={map} />}
      {compact ? null : <HubCards m={m} />}
      <TwoSides m={m} costExtra={costExtra} earnCta={earnCta} supplierCta={supplierCta} exposure={exposure} exposureSource={exposureSource} onAccelerate={onAccelerate} physical={physical} />
    </div>
  );
}
