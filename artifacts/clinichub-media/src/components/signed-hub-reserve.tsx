import { useEffect, useMemo, useState } from "react";
import { usePriceText } from "@/lib/currency";

// Listed-hub category seat: hero + reach calculator shared by birchreserve.net (Reserve List, /buycalc) and scalehealth.ca/tam.
// Reach only: modelled monthly category views x activation, from the public feed /inventory/api/tam. No CTR or conversion inputs.
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

const ACTIVATION = 0.8;
const SEAT = 1; // one brand per category: the seat is the whole category surface
const fmt = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1000) + "K" : n >= 100 ? (Math.round(n / 10) * 10).toLocaleString() : Math.round(n).toString());

export const PREPAY_REFUND_CUTOFF_DAYS = 14;

export function SignedHubHero({ reserveHref, lookHref, cardsLive = true, eyebrow }: { reserveHref: string; lookHref: string; cardsLive?: boolean; eyebrow: string }) {
  const t = usePriceText();
  return (
    <section style={{ background: NAVY }}  className="text-white" data-testid="signed-hub-hero">
      <div className="mx-auto max-w-5xl px-6 py-14 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: PURPLE }}>{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">Prepay your category's display space. One brand. No bidding.</h1>
        <div className="mt-8 max-w-xl rounded-lg bg-white p-6 text-[#0A1D56]" data-testid="prepay-offer">
          <p className="text-4xl font-bold tracking-tight" data-testid="prepay-price">{t("$490 USD")}</p>
          <p className="mt-2 text-base font-semibold">Prepay once. All of it becomes display credit in your category.</p>
          <p className="mt-1 text-sm" data-testid="prepay-refund">Fully refundable until {PREPAY_REFUND_CUTOFF_DAYS} days before your launch date.</p>
          <p className="mt-3 text-sm" data-testid="prepay-why">Why it beats Meta: Meta sells you a cold click in an auction. Here you pay once, own the category, and your offer meets customers right after they have bought.</p>
          <a href={reserveHref} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-md px-5 text-base font-semibold text-white" style={{ background: NAVY }} data-testid="cta-lock-category">{t("Prepay your category · $490 USD")}</a>
          <p className="mt-4 text-sm">
            Not ready? <a href={lookHref} className="font-semibold underline underline-offset-4" data-testid="cta-look">{t("Take a 7-day look for $190 USD")}</a>. It converts in full to the prepay, or it is refunded.
          </p>
        </div>
        {!cardsLive && <p className="mt-3 text-sm text-white/80">Card checkout is not live yet. Reserve by email and we invoice in USD or CAD.</p>}
        <p className="mt-6 text-sm text-white/85">
          Live placement: <a href={LIVE_HUB_URL} target="_blank" rel="noopener" className="font-semibold underline underline-offset-4" style={{ textDecorationColor: PURPLE }}>physio.drhonow.com</a>. A listed physio hub. Your module sits at the booking and the plan, in the category.
        </p>
        <p className="mt-3 text-xs text-white/65" data-testid="meta-benchmark">Public benchmark, not a Birch result: Meta health and wellness ads, median CPM $21.80 and median $40.53 per customer (Triple Whale, Meta Ads Benchmarks, Aug 17, 2026, USD).</p>
        <p className="mt-3 text-xs text-white/65" data-testid="exclusions">One brand per category · No PHI · No clinical pixels · No impression guarantee · Aggregate reporting only · Canada only</p>
      </div>
    </section>
  );
}

export function SeatCalculator({ feed }: { feed: Feed | null }) {
  const [scope, setScope] = useState("");
  const [y27, setY27] = useState(false);
  const cats = feed?.categories || [];
  const cat = cats.find((c) => c.category === scope) || cats[0];
  const r = useMemo(() => {
    if (!feed || !cat) return null;
    const k = y27 ? feed.pipeline.y2027_orders / (feed.pipeline.live_orders || 1) : 1;
    const reached = (Number(cat.pv_total) || 0) * ACTIVATION * SEAT * k;
    return { reached };
  }, [feed, cat, y27]);
  return (
    <div className="grid overflow-hidden rounded-lg border border-[#0A1D56]/15 bg-white text-[#0A1D56] lg:grid-cols-2" data-testid="seat-calculator">
      <div className="space-y-5 p-5 md:p-7">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Category</span>
          <select value={cat?.category || ""} onChange={(e) => setScope(e.target.value)} className="min-h-12 w-full rounded-md border border-[#0A1D56]/20 bg-white px-3">
            {cats.map((c) => <option key={c.category}>{c.category}</option>)}
          </select></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={y27} onChange={(e) => setY27(e.target.checked)} /> Illustrative 2027 (modelled)</label>
        <p className="text-xs text-[#0A1D56]/70">Assumption: {Math.round(ACTIVATION * 100)}% of listed partner surfaces in the category are switched on to carry your module. One brand per category.</p>
      </div>
      <div className="flex flex-col justify-center p-5 md:p-8" style={{ background: NAVY }} aria-live="polite">
        {r && cat ? (<>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Your category surface</p>
          <div className="mt-1 text-6xl font-bold leading-none md:text-7xl" style={{ color: GREEN }} data-testid="seat-number">1 seat</div>
          <p className="mt-2 text-lg font-semibold text-white">{cat.category}. One brand in the category.</p>
          <p className="mt-5 text-base text-white/80" data-testid="seat-reach">Modelled monthly views in your category surface: about {fmt(r.reached)}{y27 ? " (illustrative 2027)" : ""}</p>
          <p className="mt-4 text-xs leading-relaxed text-white/60">Modelled category monthly views × {Math.round(ACTIVATION * 100)}% activation × 1 seat. Activation is the share of listed partner surfaces switched on to carry your module.</p>
        </>) : <p className="text-sm text-white/70">Loading the modelled feed…</p>}
      </div>
      <p className="border-t border-[#0A1D56]/10 p-5 text-xs leading-relaxed text-[#0A1D56]/65 lg:col-span-2">
        Modelled estimate. Views are modelled at 6.4 monthly views per annual order from partner category data. Not audited served impressions, not a delivery or impression guarantee, and not a performance or click forecast.
      </p>
    </div>
  );
}

export function HowCalculated({ feed, showAudience = false }: { feed: Feed | null; showAudience?: boolean }) {
  const L = feed?.pipeline?.labels || {};
  return (
    <details className="rounded-lg border border-[#0A1D56]/15 p-5 text-[#0A1D56]" style={{ background: CARD }} data-testid="how-calculated">
      <summary className="cursor-pointer text-base font-semibold">How this is calculated <span className="ml-2 text-xs font-normal opacity-70">Modelled estimate, not a guarantee, not Scale measured performance.</span></summary>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
        {showAudience ? (<>
          <li>Audience: {L.live_orders || "8.7M"} modelled network audience orders a year across listed partner categories, about {L.live_views || "56M"} monthly views (est.).</li>
          <li>2027 projection (est.): {L.y2027_orders || "100M+"} orders a year. Used only when "Illustrative 2027" is on.</li>
        </>) : <li>"Illustrative 2027" scales views by the partner pipeline projection (est.). Off by default.</li>}
        <li>Views are modeled at 6.4 monthly views per annual order. They are not served impressions.</li>
        <li>This calculator shows modelled reach only. It makes no click, conversion or order forecast.</li>
      </ul>
    </details>
  );
}
