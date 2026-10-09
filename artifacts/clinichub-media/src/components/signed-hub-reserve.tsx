import { useEffect, useMemo, useState } from "react";

// Signed-hub category seat: hero + calculator shared by birchreserve.net (Reserve List, /buycalc) and scalehealth.ca/tam.
// Engine unchanged: reached views x CTR x click-to-order, from the public feed /inventory/api/tam.
// Palette: navy #0A1D56, green #00FF88 only on the seat number, purple #9D4EDD single accent, white + #F0F4F8 cards.
const NAVY = "#0A1D56", GREEN = "#00FF88", PURPLE = "#9D4EDD", CARD = "#F0F4F8";
export const LIVE_HUB_URL = "https://physio.drhonow.com";

type Cat = { category: string; pv_total: number; orders_yr: number };
type Feed = { totals: Cat; categories: Cat[]; assumptions?: Record<string, number | string>; pipeline: { live_orders: number; y2027_orders: number; labels: Record<string, string> } };

export function useFeed(url: string) {
  const [feed, setFeed] = useState<Feed | null>(null);
  useEffect(() => {
    let on = true;
    fetch(url, { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (on && j && Array.isArray(j.categories)) setFeed(j); }).catch(() => {});
    return () => { on = false; };
  }, [url]);
  return feed;
}

const SURFACES = [
  { key: "hub", label: "Confirmation, plan, booking, member hub", ctr: [0.0025, 0.0045, 0.007] },
  { key: "brand", label: "Brand-site display", ctr: [0.0008, 0.0014, 0.002] },
  { key: "post", label: "Post-purchase module only", ctr: [0.015, 0.025, 0.04] },
] as const;
const C2O = [0.012, 0.022, 0.035];
const BANDS = ["Low", "Mid", "High"] as const;
const ACTIVATION = 0.8;
const SEAT = 1; // one brand per category: the seat is the whole category surface
const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1000) + "K" : n >= 100 ? (Math.round(n / 10) * 10).toLocaleString() : Math.round(n).toString());
const pct = (x: number) => (x * 100).toFixed(2).replace(/0$/, "") + "%";

export function SignedHubHero({ reserveHref, lookHref, cardsLive = true, eyebrow }: { reserveHref: string; lookHref: string; cardsLive?: boolean; eyebrow: string }) {
  return (
    <section style={{ background: NAVY }} className="text-white" data-testid="signed-hub-hero">
      <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: PURPLE }}>{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">Lock one category inside signed health hubs. Not an open auction.</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-white p-5 text-[#0A1D56]">
            <p className="text-sm font-bold">$490 USD locks the category.</p>
            <p className="mt-1 text-sm">100% media credit. Nothing runs until the insertion order names the hub. Credit expires 12 months.</p>
            <a href={reserveHref} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold text-white" style={{ background: NAVY }} data-testid="cta-lock-category">Lock the category · $490 USD</a>
          </div>
          <div className="rounded-lg p-5 text-[#0A1D56]" style={{ background: CARD }}>
            <p className="text-sm font-bold">$190 USD is a 7-day look.</p>
            <p className="mt-1 text-sm">It does not lock a seat. Converts in full to the $490 within 7 days, else refunded.</p>
            <a href={lookHref} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md border-2 px-5 text-base font-semibold" style={{ borderColor: NAVY }} data-testid="cta-look">Take a 7-day look · $190 USD</a>
          </div>
        </div>
        {!cardsLive && <p className="mt-3 text-sm text-white/80">Card checkout is not live yet. Reserve by email and we invoice in USD.</p>}
        <p className="mt-6 text-sm text-white/85">
          Live placement: <a href={LIVE_HUB_URL} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4" style={{ textDecorationColor: PURPLE }}>physio.drhonow.com</a>. A signed physio hub. Your module sits at the booking and the plan, in the category.
        </p>
        <p className="mt-3 text-xs text-white/65" data-testid="exclusions">One brand per category · No PHI · No clinical pixels · No impression guarantee · Aggregate reporting only · Canada only</p>
      </div>
    </section>
  );
}

export function SeatCalculator({ feed }: { feed: Feed | null }) {
  const [scope, setScope] = useState("");
  const [surface, setSurface] = useState<(typeof SURFACES)[number]["key"]>("hub");
  const [band, setBand] = useState(1);
  const [y27, setY27] = useState(false);
  const cats = feed?.categories || [];
  const cat = cats.find((c) => c.category === scope) || cats[0];
  const r = useMemo(() => {
    if (!feed || !cat) return null;
    const s = SURFACES.find((x) => x.key === surface)!;
    const k = y27 ? feed.pipeline.y2027_orders / (feed.pipeline.live_orders || 1) : 1;
    const reached = (Number(cat.pv_total) || 0) * ACTIVATION * SEAT * k;
    const ctr = s.ctr[band], c2o = C2O[band], clicks = reached * ctr;
    return { reached, ctr, c2o, clicks, orders: clicks * c2o };
  }, [feed, cat, surface, band, y27]);
  return (
    <div className="grid overflow-hidden rounded-lg border border-[#0A1D56]/15 bg-white text-[#0A1D56] lg:grid-cols-2" data-testid="seat-calculator">
      <div className="space-y-5 p-5 md:p-7">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Category</span>
          <select value={cat?.category || ""} onChange={(e) => setScope(e.target.value)} className="min-h-12 w-full rounded-md border border-[#0A1D56]/20 bg-white px-3">
            {cats.map((c) => <option key={c.category}>{c.category}</option>)}
          </select></label>
        <div><span className="mb-1.5 block text-sm font-semibold">Surface</span>
          <div className="grid gap-1" role="radiogroup">
            {SURFACES.map((s) => (
              <button key={s.key} type="button" role="radio" aria-checked={surface === s.key} onClick={() => setSurface(s.key)}
                className="min-h-11 rounded-md px-3 text-left text-sm font-semibold" style={surface === s.key ? { background: NAVY, color: "#fff" } : { background: CARD }}>
                {s.label} <span className="font-normal opacity-75">· {s.ctr.map(pct).join(" / ")} CTR</span>
              </button>))}
          </div>
          {surface === "post" && <p className="mt-1.5 text-xs text-[#0A1D56]/70">Post-purchase rate applies to that module only. Never blended into the hub rate.</p>}
        </div>
        <div><span className="mb-1.5 block text-sm font-semibold">Band</span>
          <div className="flex gap-1">{BANDS.map((b, i) => (
            <button key={b} type="button" onClick={() => setBand(i)} className="min-h-11 flex-1 rounded-md text-sm font-semibold" style={band === i ? { background: NAVY, color: "#fff" } : { background: CARD }}>{b}</button>))}</div>
          <p className="mt-1.5 text-xs text-[#0A1D56]/70">Click-to-order 1.2 / 2.2 / 3.5%. Click-to-order, not view-to-order.</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={y27} onChange={(e) => setY27(e.target.checked)} /> Illustrative 2027</label>
      </div>
      <div className="flex flex-col justify-center p-5 md:p-8" style={{ background: NAVY }} aria-live="polite">
        {r && cat ? (<>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Your category surface</p>
          <div className="mt-1 text-6xl font-bold leading-none md:text-7xl" style={{ color: GREEN }} data-testid="seat-number">1 seat</div>
          <p className="mt-2 text-lg font-semibold text-white">{cat.category}. One brand in the category.</p>
          <p className="mt-5 text-base text-white/80">Scenario clicks: about {fmt(r.clicks)} a month</p>
          <p className="mt-1 text-sm text-white/55">Scenario orders: about {fmt(r.orders)} a month{y27 ? " (illustrative 2027)" : ""}</p>
          <p className="mt-4 text-xs leading-relaxed text-white/60">Reached views × surface CTR × click-to-order: {fmt(r.reached)} × {pct(r.ctr)} × {pct(r.c2o)}. Reached views = category monthly views × 80% activation × seat. Activation is the share of signed partner surfaces switched on to carry your module.</p>
        </>) : <p className="text-sm text-white/70">Loading the live feed…</p>}
      </div>
      <p className="border-t border-[#0A1D56]/10 p-5 text-xs leading-relaxed text-[#0A1D56]/65 lg:col-span-2">
        Views modeled at 6.4 monthly views per annual order from partner category data. Not audited served impressions. Bands are industry scenarios (healthcare display 0.10–0.25%, native floor above 0.4%). Email CTR is not used.
      </p>
    </div>
  );
}

export function HowCalculated({ feed }: { feed: Feed | null }) {
  const L = feed?.pipeline?.labels || {};
  return (
    <details className="rounded-lg border border-[#0A1D56]/15 p-5 text-[#0A1D56]" style={{ background: CARD }} data-testid="how-calculated">
      <summary className="cursor-pointer text-base font-semibold">How this is calculated <span className="ml-2 text-xs font-normal opacity-70">Scenario, not a guarantee, not Scale measured performance.</span></summary>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
        <li>Audience: {L.live_orders || "8.7M"} orders a year mapped across partner categories, about {L.live_views || "56M"} monthly views (est.).</li>
        <li>2027 projection (est.): {L.y2027_orders || "100M+"} orders a year. Used only when "Illustrative 2027" is on.</li>
        <li>Views are modeled at 6.4 monthly views per annual order. They are not served impressions.</li>
        <li>Surface CTR bands come from industry ranges. They are not Scale measured results.</li>
        <li>Orders use click-to-order, not view-to-order. Email CTR is not used.</li>
      </ul>
    </details>
  );
}
