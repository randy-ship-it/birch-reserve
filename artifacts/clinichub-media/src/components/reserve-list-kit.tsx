import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle2, Loader2, Lock } from "lucide-react";

// Reserve List surfaces shared with scalehealth.ca/tam. Every number comes from the same public feed
// (birchreserve.net/inventory/api/tam, served by birch-inventory) so the two sites never diverge.
// Email capture posts to the same backend as /inventory and scalehealth.ca (Friday + Birch log, daily digest).
export const TAM_FEED = "/inventory/api/tam";
export const SUBSCRIBE_URL = "/inventory/api/subscribe";
export const SCALE_TAM_URL = "https://www.scalehealth.ca/tam?utm_source=birchreserve&utm_medium=referral&utm_campaign=reserve-list";
// Request access / brand onboarding slot: one href for every "Request access" CTA on birchreserve.net.
// It opens the request form on /inventory; swap this when the brand onboarding questionnaire ships.
// Reserve List onboarding questionnaire (birch-inventory, same page as scalehealth.ca/brands/onboard).
export const ONBOARD_HREF = "/inventory/onboard";
export const REQUEST_ACCESS_HREF = "/inventory#request-access";

type Cat = { category: string; pv_total: number; ctr_lo: number; ctr_hi: number; orders_yr: number };
export type TamFeed = {
  totals: Cat & { categories: number };
  categories: Cat[];
  assumptions?: Record<string, number | string>;
  pipeline: { live_orders: number; y2027_orders: number; labels: Record<string, string> };
};
export const FALLBACK_LABELS: Record<string, string> = {
  live_orders: "9M+", mapped_orders: "8.7M", live_views: "56M", queue_orders: "20M+", queue_views: "~130M",
  live_queue_orders: "29M+", live_queue_views: "~180M", y2027_orders: "100M+", y2027_views: "~640M",
};

export function useTamFeed() {
  const [feed, setFeed] = useState<TamFeed | null>(null);
  useEffect(() => {
    let on = true;
    fetch(TAM_FEED, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (on && j && Array.isArray(j.categories) && j.pipeline?.labels) setFeed(j); })
      .catch(() => {});
    return () => { on = false; };
  }, []);
  const labels = { ...FALLBACK_LABELS, ...(feed?.pipeline?.labels || {}) };
  return { feed, labels };
}

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
export function NotifyMe({ source = "br-home", dark = true }: { source?: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const t0 = useRef(Date.now());
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(em)) { setState("error"); setMsg("Enter a valid email."); return; }
    setState("sending"); setMsg("");
    const qs = new URLSearchParams(window.location.search);
    const body: Record<string, unknown> = { email: em, source, company_url: hp, t: t0.current, referrer: document.referrer || undefined, ref: qs.get("ref") || undefined };
    for (const k of UTM) { const v = qs.get(k); if (v) body[k] = v; }
    try {
      const r = await fetch(SUBSCRIBE_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setState("done");
    } catch (err) { setState("error"); setMsg(err instanceof Error ? err.message : "Something went wrong."); }
  }
  const lab = dark ? "text-background/80" : "text-muted-foreground";
  if (state === "done") {
    return (
      <div className={`flex max-w-xl items-start gap-2.5 border px-4 py-3 text-sm ${dark ? "border-accent/50 bg-accent/10 text-background" : "border-border bg-secondary/40"}`} role="status" data-testid="reserve-list-notify-done">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <span><b>You're on the list.</b> We'll email you when slots open. No spam; unsubscribe anytime.</span>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="max-w-xl" data-testid="reserve-list-notify">
      <label htmlFor={`notify-${source}`} className={`mb-2 block text-sm font-medium ${lab}`}>Get early-slot alerts: new categories and openings, by email.</label>
      <div className="flex gap-2">
        <input id={`notify-${source}`} type="email" inputMode="email" autoComplete="email" required maxLength={200} placeholder="you@brand.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 min-w-0 flex-1 border border-border bg-background px-3.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent" />
        <input type="text" name="company_url" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-px w-px opacity-0" />
        <button type="submit" disabled={state === "sending"} className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap bg-accent px-5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-70">
          {state === "sending" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Notify me
        </button>
      </div>
      <p className="mt-1.5 text-sm text-red-400" role="status" aria-live="polite">{state === "error" ? msg : ""}</p>
    </form>
  );
}

// Same model as /inventory and scalehealth.ca/tam:
// clicks = monthly views x activation cap x share x category CTR (low / mid / high); orders = clicks x 1% / 2% / 3%.
const PRESETS = [{ key: "conservative", label: "Conservative", cvr: 0.01 }, { key: "typical", label: "Typical", cvr: 0.02 }, { key: "strong", label: "Strong", cvr: 0.03 }] as const;
function about(n: number) { const a = Math.abs(n); const st = a >= 100000 ? 1000 : a >= 10000 ? 500 : a >= 1000 ? 100 : a >= 100 ? 10 : 1; return (Math.round(n / st) * st).toLocaleString("en-US"); }
export function ReserveListCalculator({ feed }: { feed: TamFeed | null }) {
  const [scope, setScope] = useState("all");
  const [share, setShare] = useState(0.05);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("typical");
  const r = useMemo(() => {
    if (!feed) return null;
    const A = feed.assumptions || {};
    const sc = scope === "all" ? feed.totals : feed.categories.find((c) => c.category === scope) || feed.totals;
    const cap = Number(A.activation_cap) || 0.8;
    const lo = Number(sc.ctr_lo) || 0, hi = Number(sc.ctr_hi) || 0;
    const p = PRESETS.find((x) => x.key === preset)!;
    const ctr = preset === "conservative" ? lo : preset === "strong" ? hi : (lo + hi) / 2;
    const cvr = Number(A[`cvr_${p.key}`]) || p.cvr;
    const reach = (Number(sc.pv_total) || 0) * cap * share, clicks = reach * ctr, orders = clicks * cvr;
    const k27 = feed.pipeline.y2027_orders / (feed.pipeline.live_orders || 1);
    return { reach, clicks, orders, ctr, cvr, k27, label: p.label, maxShare: Number(A.max_brand_share) || 0.2 };
  }, [feed, scope, share, preset]);
  return (
    <div className="grid overflow-hidden border border-border bg-background shadow-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" data-testid="reserve-list-calculator">
      <div className="min-w-0 space-y-5 p-5 md:p-7">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">1. Category</span>
          <select value={scope} onChange={(e) => setScope(e.target.value)} className="min-h-12 w-full border border-border bg-background px-3 text-base">
            <option value="all">All categories</option>
            {(feed?.categories || []).map((c) => <option key={c.category} value={c.category}>{c.category}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 flex justify-between text-sm font-semibold"><span>2. Share of the TAM you'd target</span><output className="tabular-nums">{Math.round(share * 100)}%</output></span>
          <input type="range" min={1} max={Math.round((r?.maxShare || 0.2) * 100)} step={1} value={Math.round(share * 100)} onChange={(e) => setShare(Number(e.target.value) / 100)} className="h-11 w-full accent-[hsl(var(--accent))]" />
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-semibold">3. Click-through preset</span>
          <div className="flex gap-1 border border-border p-1" role="radiogroup">
            {PRESETS.map((x) => (
              <button key={x.key} type="button" role="radio" aria-checked={preset === x.key} onClick={() => setPreset(x.key)}
                className={`min-h-11 flex-1 px-2 text-sm font-semibold ${preset === x.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary/50"}`}>{x.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center border-t border-border bg-secondary/30 p-5 md:p-8 lg:border-l lg:border-t-0" aria-live="polite">
        {r ? (
          <>
            <div className="font-display text-6xl leading-none tabular-nums md:text-7xl" data-testid="reserve-list-calc-big">{about(r.orders)}</div>
            <div className="mt-2 text-lg font-semibold">orders a month</div>
            <p className="mt-3 text-lg font-semibold">About {about(r.clicks)} clicks and {about(r.orders)} orders a month.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {r.reach >= 1e6 ? (r.reach / 1e6).toFixed(1) + "M" : about(r.reach)} monthly views reached × {(r.ctr * 100).toFixed(2)}% click-through × {Math.round(r.cvr * 100)}% conversion. With the 2027 projection (est.): about {about(r.clicks * r.k27)} clicks and {about(r.orders * r.k27)} orders a month. Estimates from industry benchmarks, not a forecast or a guarantee.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading the live feed…</p>
        )}
      </div>
    </div>
  );
}

export function ReserveListLinks({ dark = true }: { dark?: boolean }) {
  const ghost = dark ? "border-background/30 text-background hover:bg-background/10" : "border-border hover:bg-secondary/50";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" data-testid="reserve-list-links">
      <a href={REQUEST_ACCESS_HREF} className={`inline-flex min-h-12 items-center justify-center gap-2 border px-5 text-sm font-semibold ${ghost}`} data-testid="link-reserve-list-request-access">
        <Lock className="size-4" aria-hidden /> Request access
      </a>
      <a href="#reserve-list-calculator" className={`inline-flex min-h-12 items-center justify-center gap-2 border px-5 text-sm font-semibold ${ghost}`} data-testid="link-reserve-list-calculator">
        Model your capture <ArrowRight className="size-4" aria-hidden />
      </a>
      <a href={SCALE_TAM_URL} target="_blank" rel="noopener" className={`inline-flex min-h-12 items-center justify-center gap-2 border px-5 text-sm font-semibold ${ghost}`} data-testid="link-reserve-list-scale">
        See it on Scale Health <ArrowUpRight className="size-4" aria-hidden />
      </a>
      <a href={ONBOARD_HREF} className={`inline-flex min-h-12 items-center justify-center px-1 text-sm underline underline-offset-4 ${dark ? "text-background/80" : "text-muted-foreground"}`} data-testid="link-reserve-list-onboard">
        Partner brand? Add your brand
      </a>
    </div>
  );
}
